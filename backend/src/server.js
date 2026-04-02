const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
require('dotenv').config();
const User = require('./models/User');
const Message = require('./models/Message');
const { connectDatabase } = require('./config/db');
const { getComplianceStatus } = require('./utils/compliance');

// Import routes and middleware
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/users');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Create HTTP or HTTPS server depending on env-provided cert paths
let server;
if (process.env.HTTPS_KEY_PATH && process.env.HTTPS_CERT_PATH) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(process.env.HTTPS_KEY_PATH),
      cert: fs.readFileSync(process.env.HTTPS_CERT_PATH)
    };
    if (process.env.HTTPS_CA_PATH) {
      httpsOptions.ca = fs.readFileSync(process.env.HTTPS_CA_PATH);
    }
    server = https.createServer(httpsOptions, app);
    console.log('HTTPS enabled using provided certificates');
  } catch (err) {
    console.error('Failed to load HTTPS certificates, falling back to HTTP:', err.message);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
  console.log('HTTPS cert paths not set; using HTTP');
}

const parseAllowedOrigins = () => {
  const rawOrigins = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const isAllowedOrigin = (origin) => {
  if (!origin || allowedOrigins.length === 0) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
};

const io = socketIO(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: process.env.SOCKET_IO_PATH || '/socket.io'
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store Socket.io instance for access in routes
app.set('io', io);

// Routes
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get(['/config/public', '/api/config/public'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    facebookAppId:
      process.env.FACEBOOK_APP_ID || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '',
    socketPath: process.env.SOCKET_IO_PATH || '/socket.io'
  });
});

// Error handling middleware
app.use(errorHandler);

// Socket.io events
const userSocketMap = new Map(); // Track which socket a user is on for direct messaging

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', (data) => {
    const { userId, city, latitude, longitude } = data;
    socket.join(`city-${city}`);
    if (userId) {
      userSocketMap.set(userId, socket.id);
      socket.userId = userId;
    }
    socket.broadcast.to(`city-${city}`).emit('user-joined', {
      userId,
      city,
      timestamp: new Date()
    });
  });

  socket.on('register-user', ({ userId }) => {
    if (userId) {
      userSocketMap.set(userId, socket.id);
      socket.userId = userId;
    }
  });

  socket.on('send-direct-message', async (data) => {
    const { fromUserId, toUserId, message } = data;
    if (!fromUserId || !toUserId || !message) return;

    try {
      const [fromUser, toUser] = await Promise.all([
        User.findById(fromUserId).select('blockedUsers facebookId phoneVerified dateOfBirth'),
        User.findById(toUserId).select('blockedUsers facebookId phoneVerified dateOfBirth')
      ]);

      const isBlocked =
        !fromUser ||
        !toUser ||
        (fromUser.blockedUsers || []).some((id) => id.equals(toUserId)) ||
        (toUser.blockedUsers || []).some((id) => id.equals(fromUserId));

      if (isBlocked) {
        io.to(socket.id).emit('direct-message-blocked', {
          toUserId,
          reason: 'blocked'
        });
        return;
      }

      const fromCompliance = getComplianceStatus(fromUser);
      const toCompliance = getComplianceStatus(toUser);

      if (!fromCompliance.isCompliant || !toCompliance.isCompliant) {
        io.to(socket.id).emit('direct-message-blocked', {
          toUserId,
          reason: 'compliance'
        });
        return;
      }

      const payload = {
        fromUserId,
        toUserId,
        message,
        timestamp: new Date()
      };

      const targetSocketId = userSocketMap.get(toUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('receive-direct-message', payload);
      }

      // Echo back to sender so their UI updates immediately
      io.to(socket.id).emit('receive-direct-message', payload);
    } catch (err) {
      console.error('Error delivering direct message', err);
    }
  });

  socket.on('send-message', async (data) => {
    const { userId, city, message } = data;
    if (!userId || !city || !message) return;

    try {
      const trimmedMessage = String(message).trim();
      if (!trimmedMessage) {
        return;
      }

      const user = await User.findById(userId).select(
        'facebookId phoneVerified dateOfBirth name profilePicture'
      );
      const compliance = getComplianceStatus(user);
      if (!compliance.isCompliant) {
        return;
      }

      const createdMessage = await Message.create({
        userId,
        city,
        message: trimmedMessage
      });

      io.to(`city-${city}`).emit('receive-message', {
        userId,
        userName: user.name,
        profilePicture: user.profilePicture,
        message: createdMessage.message,
        timestamp: createdMessage.createdAt || new Date().toISOString()
      });
    } catch (err) {
      console.error('Error delivering city message', err);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSocketMap.delete(socket.userId);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = server;
