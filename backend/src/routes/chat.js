const express = require('express');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get messages for a city
router.get('/city/:city', authMiddleware, asyncHandler(async (req, res) => {
  const { city } = req.params;
  const limit = req.query.limit || 50;

  const messages = await Message.find({ city })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate('userId', 'name profilePicture');

  res.json(messages);
}));

// Post a message (handled via Socket.io in production)
router.post('/send', authMiddleware, asyncHandler(async (req, res) => {
  const { city, message } = req.body;

  const newMessage = await Message.create({
    userId: req.user.userId,
    city,
    message
  });

  res.status(201).json(newMessage);
}));

module.exports = router;
