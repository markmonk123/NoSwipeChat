const express = require('express');
const User = require('../models/User');
const { Report, REPORT_REASONS } = require('../models/Report');
const { authMiddleware } = require('../middleware/auth');
const { complianceMiddleware } = require('../middleware/compliance');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  isValidPhoneNumber,
  isAdult,
  getComplianceStatus,
  MIN_AGE
} = require('../utils/compliance');

const router = express.Router();

const REPORT_REASON_OPTIONS = [
  { code: 'bot', example: 'This looks like a bot' },
  { code: 'harassment', example: 'This person will not leave me alone' },
  { code: 'inappropriate_content', example: 'This person said inappropriate things' },
  { code: 'spam', example: 'This person is spamming or advertising' },
  { code: 'other', example: 'Other' }
];

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const normalizeVector = (values, expectedLength) => {
  if (!Array.isArray(values)) return null;
  if (expectedLength && values.length !== expectedLength) return null;
  return values.map((value) => clamp01(Number(value)));
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

// Get current user profile
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const payload = user.toObject();
  payload.compliance = getComplianceStatus(user);
  res.json(payload);
}));

// Compliance status helper
router.get('/compliance', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('facebookId phoneVerified dateOfBirth');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ compliance: getComplianceStatus(user) });
}));

// Update user profile
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const {
    age,
    gender,
    bio,
    city,
    latitude,
    longitude,
    interests,
    dateOfBirth,
    phoneNumber
  } = req.body;

  const updates = {
    age,
    gender,
    bio,
    city,
    interests,
    updatedAt: new Date()
  };

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    updates.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
  }

  if (dateOfBirth) {
    const parsed = parseDate(dateOfBirth);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid dateOfBirth format' });
    }
    if (!isAdult(parsed)) {
      return res.status(400).json({
        error: 'Users must be at least 18 years old',
        minAge: MIN_AGE
      });
    }
    updates.dateOfBirth = parsed;
  }

  if (phoneNumber) {
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    updates.phoneNumber = phoneNumber;
    updates.phoneVerified = false;
    updates.phoneVerifiedAt = undefined;
  }

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    updates,
    { new: true }
  );

  res.json({
    ...user.toObject(),
    compliance: getComplianceStatus(user)
  });
}));

// Phone verification (dev/test code based)
router.post('/phone/verify', authMiddleware, asyncHandler(async (req, res) => {
  const { code } = req.body;
  const expectedCode = process.env.PHONE_VERIFICATION_TEST_CODE || '000000';

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  const user = await User.findById(req.user.userId).select('phoneNumber');
  if (!user || !user.phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required before verification' });
  }

  if (String(code).trim() !== expectedCode) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  user.phoneVerified = true;
  user.phoneVerifiedAt = new Date();
  await user.save();

  res.json({
    message: 'Phone number verified',
    compliance: getComplianceStatus(user)
  });
}));

// Update personality profile (35 or 73-point vectors)
router.put('/personality', authMiddleware, asyncHandler(async (req, res) => {
  const { vector35, vector73, consent, visibility } = req.body;

  const normalized35 = normalizeVector(vector35, 35);
  const normalized73 = normalizeVector(vector73, 73);

  if (vector35 && !normalized35) {
    return res.status(400).json({ error: 'vector35 must be an array of 35 numbers' });
  }

  if (vector73 && !normalized73) {
    return res.status(400).json({ error: 'vector73 must be an array of 73 numbers' });
  }

  const user = await User.findById(req.user.userId).select('personalityProfile');
  const existingConsent = user?.personalityProfile?.consent?.status || false;
  const consentStatus = typeof consent?.status === 'boolean' ? consent.status : existingConsent;

  if ((normalized35 || normalized73) && !consentStatus) {
    return res.status(400).json({ error: 'Consent is required to store personality vectors' });
  }

  const updates = {
    'personalityProfile.updatedAt': new Date()
  };

  if (typeof visibility === 'string') {
    updates['personalityProfile.visibility'] = visibility === 'private' ? 'private' : 'matches';
  }

  if (consent && typeof consent.status === 'boolean') {
    updates['personalityProfile.consent'] = {
      status: consent.status,
      sources: Array.isArray(consent.sources) ? consent.sources : [],
      grantedAt: consent.status ? new Date() : undefined,
      revokedAt: consent.status ? undefined : new Date()
    };

    if (!consent.status) {
      updates['personalityProfile.vector35'] = undefined;
      updates['personalityProfile.vector73'] = undefined;
      updates['personalityProfile.visibility'] = 'private';
    }
  }

  if (normalized35) {
    updates['personalityProfile.vector35'] = normalized35;
  }

  if (normalized73) {
    updates['personalityProfile.vector73'] = normalized73;
  }

  const updated = await User.findByIdAndUpdate(req.user.userId, updates, { new: true });

  res.json({
    personalityProfile: updated.personalityProfile
  });
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

// Get nearby users (compliance gated)
router.get('/nearby', authMiddleware, complianceMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('location preferredDistance blockedUsers');

  if (!user || !user.location) {
    return res.status(400).json({ error: 'User location not set' });
  }

  const blockedUserIds = user.blockedUsers || [];
  const cutoffDate = new Date();
  cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - MIN_AGE);

  const nearbyUsers = await User.find({
    location: {
      $near: {
        $geometry: user.location,
        $maxDistance: (user.preferredDistance || 50) * 1000 // Convert km to meters
      }
    },
    _id: { $ne: req.user.userId, $nin: blockedUserIds },
    blockedUsers: { $nin: [req.user.userId] },
    isVerified: true,
    phoneVerified: true,
    facebookId: { $exists: true, $ne: null },
    dateOfBirth: { $lte: cutoffDate }
  }).limit(20);

  const sanitizedUsers = nearbyUsers.map((nearbyUser) => {
    const payload = nearbyUser.toObject();
    const profile = payload.personalityProfile;
    const consented = profile?.consent?.status;
    const visible = profile?.visibility !== 'private';
    if (!consented || !visible) {
      payload.personalityProfile = undefined;
    } else if (profile?.vector35) {
      payload.personalityProfile = {
        vector35: profile.vector35,
        updatedAt: profile.updatedAt
      };
    }
    return payload;
  });

  res.json(sanitizedUsers);
}));

module.exports = router;
