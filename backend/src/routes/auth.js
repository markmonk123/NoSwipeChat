const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ProfileVerification = require('../models/ProfileVerification');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createHttpError,
  requestVerificationCode,
  ensurePhoneVerificationRiskChecks,
  buildPhoneVerificationToken,
  toUserPhoneVerificationContext,
  verifyPhoneVerificationToken
} = require('../utils/phoneVerification');
const { autoPopulatePersonalityProfile } = require('../utils/personalityAutomation');

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

const toStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];

const sanitizeConsent = (value, fallback = {}) => {
  const status = typeof value?.status === 'boolean' ? value.status : Boolean(fallback?.status);
  const available = typeof value?.available === 'boolean'
    ? value.available
    : (typeof fallback?.available === 'boolean' ? fallback.available : true);

  return {
    status,
    available,
    requestedAt: status ? new Date() : undefined,
    grantedAt: value?.grantedAt ? new Date(value.grantedAt) : (status && available ? new Date() : undefined),
    revokedAt: status ? undefined : new Date(),
    note: typeof value?.note === 'string' ? value.note : fallback?.note
  };
};

const sanitizeFriendsList = (value) => {
  const sample = Array.isArray(value?.sample)
    ? value.sample.slice(0, 25).map((item) => ({
      id: item?.id ? String(item.id) : '',
      name: item?.name ? String(item.name) : 'Facebook friend'
    })).filter((item) => item.id || item.name)
    : [];

  return {
    totalCount: Number.isFinite(Number(value?.totalCount)) ? Number(value.totalCount) : sample.length,
    sample,
    fetchedAt: value?.fetchedAt ? new Date(value.fetchedAt) : new Date()
  };
};

const sanitizeTimelinePosts = (value) => {
  const sample = Array.isArray(value?.sample)
    ? value.sample.slice(0, 10).map((item) => ({
      id: item?.id ? String(item.id) : '',
      message: item?.message ? String(item.message).slice(0, 500) : '',
      createdTime: item?.createdTime ? new Date(item.createdTime) : undefined,
      permalinkUrl: item?.permalinkUrl ? String(item.permalinkUrl) : ''
    })).filter((item) => item.id)
    : [];

  return {
    totalCount: Number.isFinite(Number(value?.totalCount)) ? Number(value.totalCount) : sample.length,
    sample,
    fetchedAt: value?.fetchedAt ? new Date(value.fetchedAt) : new Date()
  };
};

const sanitizeExtendedSocialGraph = (value, fallbackFriendsCount = 0) => ({
  connectedFriendsCount: Number.isFinite(Number(value?.connectedFriendsCount))
    ? Number(value.connectedFriendsCount)
    : fallbackFriendsCount,
  note: typeof value?.note === 'string'
    ? value.note
    : 'Facebook only returns app-connected friend graph signals that the current app is allowed to access.',
  fetchedAt: value?.fetchedAt ? new Date(value.fetchedAt) : new Date()
});

const handleProviderCallback = (provider) => async (req, res) => {
  const config = PROVIDER_CONFIG[provider];
  if (!config) {
    return res.status(400).json({ error: 'Unsupported provider' });
  }

  const { idField, verificationFlag, verificationDateField } = config;
  const {
    name,
    email,
    profilePicture,
    facebookDataAccess,
    phoneNumber,
    phoneVerificationToken
  } = req.body;
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
    const phoneVerification = verifyPhoneVerificationToken({
      token: phoneVerificationToken,
      req,
      phoneNumber
    });

    user = await User.create({
      [idField]: providerId,
      name,
      email,
      profilePicture,
      isVerified: false,
      phoneNumber: phoneVerification.phoneNumber,
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      phoneVerificationContext: toUserPhoneVerificationContext(phoneVerification)
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

  if (provider === 'facebook' && facebookDataAccess) {
    const requestedScopes = toStringArray(facebookDataAccess.requestedScopes);
    const grantedScopes = toStringArray(facebookDataAccess.grantedScopes);
    const declinedScopes = toStringArray(facebookDataAccess.declinedScopes);
    const friendsCount = Number(facebookDataAccess?.data?.friendsList?.totalCount) || 0;

    user.socialDataSettings = user.socialDataSettings || {};
    user.socialDataSettings.facebook = {
      requestedScopes,
      grantedScopes,
      declinedScopes,
      friendsList: sanitizeConsent(facebookDataAccess?.consents?.friendsList),
      timelinePosts: sanitizeConsent(facebookDataAccess?.consents?.timelinePosts),
      privateMessages: sanitizeConsent(
        facebookDataAccess?.consents?.privateMessages,
        {
          available: false,
          note: 'Facebook Login does not provide direct access to private messages in this app flow.'
        }
      ),
      extendedSocialGraph: sanitizeConsent(facebookDataAccess?.consents?.extendedSocialGraph),
      lastUpdatedAt: new Date()
    };

    user.socialData = user.socialData || {};
    user.socialData.facebook = user.socialData.facebook || {};

    if (facebookDataAccess?.data?.friendsList) {
      user.socialData.facebook.friendsList = sanitizeFriendsList(facebookDataAccess.data.friendsList);
    }

    if (facebookDataAccess?.data?.timelinePosts) {
      user.socialData.facebook.timelinePosts = sanitizeTimelinePosts(facebookDataAccess.data.timelinePosts);
    }

    if (facebookDataAccess?.data?.extendedSocialGraph) {
      user.socialData.facebook.extendedSocialGraph = sanitizeExtendedSocialGraph(
        facebookDataAccess.data.extendedSocialGraph,
        friendsCount
      );
    } else if (facebookDataAccess?.consents?.extendedSocialGraph?.status) {
      user.socialData.facebook.extendedSocialGraph = sanitizeExtendedSocialGraph(
        undefined,
        friendsCount
      );
    }

    await user.save();
  }

  const hasSocialPayload = Boolean(facebookDataAccess?.data) || Boolean(user?.socialData?.facebook);
  if (provider === 'facebook' && hasSocialPayload) {
    const personalityResult = await autoPopulatePersonalityProfile({
      userId: user._id,
      source: 'facebook_callback_social_data'
    });

    if (!personalityResult?.updated) {
      console.warn('Personality profile was not updated during facebook callback:', personalityResult?.reason);
    }
  }

  res.json(buildTokenResponse(user));
};

router.post('/phone/request-code', asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw createHttpError(400, 'Phone number is required');
  }

  await requestVerificationCode(phoneNumber);

  res.json({
    message: 'Verification code sent'
  });
}));

router.post('/phone/verify', asyncHandler(async (req, res) => {
  const { phoneNumber, code, deviceLocation } = req.body;

  if (!phoneNumber) {
    throw createHttpError(400, 'Phone number is required');
  }

  const verification = await ensurePhoneVerificationRiskChecks({
    req,
    phoneNumber,
    code,
    deviceLocation
  });

  res.json({
    message: 'Phone verified for signup',
    phoneVerificationToken: buildPhoneVerificationToken(verification),
    phoneVerification: {
      lineType: verification.lineType,
      distanceMiles: verification.distanceMiles,
      ipGeo: verification.ipGeo
    }
  });
}));

// OAuth callbacks (simplified - integrate with Passport.js or production OAuth in a real app)
router.post('/facebook/callback', asyncHandler(handleProviderCallback('facebook')));
router.post('/google/callback', asyncHandler(handleProviderCallback('google')));
router.post('/linkedin/callback', asyncHandler(handleProviderCallback('linkedin')));

// Logout endpoint
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
