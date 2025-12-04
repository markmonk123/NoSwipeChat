const express = require('express');
const User = require('../models/User');
const { Report, REPORT_REASONS } = require('../models/Report');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const REPORT_REASON_OPTIONS = [
  { code: 'bot', example: 'This looks like a bot' },
  { code: 'harassment', example: 'This person will not leave me alone' },
  { code: 'inappropriate_content', example: 'This person said inappropriate things' },
  { code: 'spam', example: 'This person is spamming or advertising' },
  { code: 'other', example: 'Other' }
];

// Get current user profile
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  res.json(user);
}));

// Update user profile
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const { age, gender, bio, city, latitude, longitude, interests } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    {
      age,
      gender,
      bio,
      city,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      interests,
      updatedAt: new Date()
    },
    { new: true }
  );

  res.json(user);
}));

// Block a user
router.post('/block/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId: userToBlock } = req.params;

  if (!userToBlock) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (userToBlock === req.user.userId) {
    return res.status(400).json({ error: 'You cannot block yourself' });
  }

  const targetUser = await User.findById(userToBlock);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user.userId,
    {
      $addToSet: { blockedUsers: userToBlock },
      updatedAt: new Date()
    },
    { new: true }
  ).populate('blockedUsers', 'name profilePicture');

  res.json({
    message: 'User blocked successfully',
    blockedUsers: updatedUser.blockedUsers
  });
}));

// Unblock a user
router.delete('/block/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId: userToUnblock } = req.params;

  const updatedUser = await User.findByIdAndUpdate(
    req.user.userId,
    {
      $pull: { blockedUsers: userToUnblock },
      updatedAt: new Date()
    },
    { new: true }
  ).populate('blockedUsers', 'name profilePicture');

  res.json({
    message: 'User unblocked successfully',
    blockedUsers: updatedUser.blockedUsers
  });
}));

// List blocked users
router.get('/blocked', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId)
    .populate('blockedUsers', 'name email profilePicture');

  res.json({
    blockedUsers: user.blockedUsers || []
  });
}));

// Report reasons helper
router.get('/report/reasons', authMiddleware, (req, res) => {
  res.json(REPORT_REASON_OPTIONS);
});

// Report a user
router.post('/report', authMiddleware, asyncHandler(async (req, res) => {
  const { reportedUserId, reason, details } = req.body;

  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'reportedUserId and reason are required' });
  }

  if (reportedUserId === req.user.userId) {
    return res.status(400).json({ error: 'You cannot report yourself' });
  }

  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason code', validReasons: REPORT_REASON_OPTIONS });
  }

  const reportedUser = await User.findById(reportedUserId);
  if (!reportedUser) {
    return res.status(404).json({ error: 'Reported user not found' });
  }

  const report = await Report.create({
    reporterId: req.user.userId,
    reportedUserId,
    reason,
    details
  });

  res.status(201).json({
    message: 'Report submitted',
    reportId: report._id,
    reason,
    details
  });
}));

// Block and report a user in one request
router.post('/block-and-report', authMiddleware, asyncHandler(async (req, res) => {
  const { reportedUserId, reason, details } = req.body;

  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'reportedUserId and reason are required' });
  }

  if (reportedUserId === req.user.userId) {
    return res.status(400).json({ error: 'You cannot report yourself' });
  }

  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason code', validReasons: REPORT_REASON_OPTIONS });
  }

  const reportedUser = await User.findById(reportedUserId);
  if (!reportedUser) {
    return res.status(404).json({ error: 'Reported user not found' });
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user.userId,
    {
      $addToSet: { blockedUsers: reportedUserId },
      updatedAt: new Date()
    },
    { new: true }
  ).populate('blockedUsers', 'name profilePicture');

  const report = await Report.create({
    reporterId: req.user.userId,
    reportedUserId,
    reason,
    details
  });

  res.status(201).json({
    message: 'User blocked and report submitted',
    reportId: report._id,
    reason,
    details,
    blockedUsers: updatedUser.blockedUsers
  });
}));

// Get nearby users
router.get('/nearby', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('location preferredDistance blockedUsers');

  if (!user || !user.location) {
    return res.status(400).json({ error: 'User location not set' });
  }

  const blockedUserIds = user.blockedUsers || [];

  const nearbyUsers = await User.find({
    location: {
      $near: {
        $geometry: user.location,
        $maxDistance: (user.preferredDistance || 50) * 1000 // Convert km to meters
      }
    },
    _id: { $ne: req.user.userId, $nin: blockedUserIds },
    blockedUsers: { $nin: [req.user.userId] },
    isVerified: true
  }).limit(20);

  res.json(nearbyUsers);
}));

module.exports = router;
