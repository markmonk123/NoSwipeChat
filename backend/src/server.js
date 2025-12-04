const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
require('dotenv').config();
const User = require('./models/User');

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

const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store Socket.io instance for access in routes
app.set('io', io);

// Routes
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
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
        User.findById(fromUserId).select('blockedUsers'),
        User.findById(toUserId).select('blockedUsers')
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

  socket.on('send-message', (data) => {
    const { userId, city, message } = data;
    io.to(`city-${city}`).emit('receive-message', {
      userId,
      message,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSocketMap.delete(socket.userId);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = server;
