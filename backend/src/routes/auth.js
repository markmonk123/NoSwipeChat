const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ProfileVerification = require('../models/ProfileVerification');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const PROVIDER_CONFIG = {
  facebook: {
    idField: 'facebookId',
    verificationFlag: 'facebookVerified',
    verificationDateField: 'facebookVerifiedAt'
  },
  google: {
    idField: 'googleId',
    verificationFlag: 'googleVerified',
    verificationDateField: 'googleVerifiedAt'
  },
  linkedin: {
    idField: 'linkedinId',
    verificationFlag: 'linkedinVerified',
    verificationDateField: 'linkedinVerifiedAt'
  }
};

const buildTokenResponse = (user) => {
  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified
    }
  };
};

const handleProviderCallback = (provider) => async (req, res) => {
  const config = PROVIDER_CONFIG[provider];
  if (!config) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  const { idField, verificationFlag, verificationDateField } = config;
  const { name, email, profilePicture } = req.body;
  const providerId = req.body[config.idField];

  if (!providerId || !email || !name) {
    return res.status(400).json({ error: 'Missing required profile fields' });
  }

  // Try to find by provider id or email to support linking accounts
  const userQuery = {
    $or: [
      { [idField]: providerId },
      { email }
    ]
  };

  let user = await User.findOne(userQuery);

  if (!user) {
    user = await User.create({
      [idField]: providerId,
      name,
      email,
      profilePicture,
      isVerified: false
    });
  } else {
    // Attach provider id if missing
    if (!user[idField]) {
      user[idField] = providerId;
    }
    // Update basic profile data if changed
    user.name = user.name || name;
    user.email = user.email || email;
    if (!user.profilePicture && profilePicture) {
      user.profilePicture = profilePicture;
    }
    await user.save();
  }

  let verification = await ProfileVerification.findOne({ userId: user._id });
  if (!verification) {
    verification = await ProfileVerification.create({
      userId: user._id
    });
  }

  verification[verificationFlag] = true;
  verification[verificationDateField] = new Date();
  await verification.save();

  // isVerified if any provider is verified
  const verified = Boolean(
    verification.facebookVerified ||
    verification.googleVerified ||
    verification.linkedinVerified
  );
  if (user.isVerified !== verified) {
    user.isVerified = verified;
    await user.save();
  }

  res.json(buildTokenResponse(user));
};

// OAuth callbacks (simplified - integrate with Passport.js or production OAuth in a real app)
router.post('/facebook/callback', asyncHandler(handleProviderCallback('facebook')));
router.post('/google/callback', asyncHandler(handleProviderCallback('google')));
router.post('/linkedin/callback', asyncHandler(handleProviderCallback('linkedin')));

// Logout endpoint
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
