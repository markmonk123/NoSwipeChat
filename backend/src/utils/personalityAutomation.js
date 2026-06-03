const Message = require('../models/Message');
const User = require('../models/User');
const { buildPersonalityVector73 } = require('./embeddings');

const MAX_TIMELINE_POST_TEXTS = 20;
const MAX_RECENT_CHAT_TEXTS = 20;
const MAX_TOTAL_TEXTS = 64;
const MIN_TEXT_LENGTH = 3;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));

const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');

const uniqueTexts = (texts) => {
  const seen = new Set();
  const output = [];

  texts.forEach((entry) => {
    const normalized = toSafeString(entry).replace(/\s+/g, ' ');
    if (!normalized || normalized.length < MIN_TEXT_LENGTH) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });

  return output;
};

const buildSocialTexts = ({ user, recentMessages }) => {
  const texts = [];
  const facebook = user?.socialData?.facebook || {};
  const timelineSample = Array.isArray(facebook?.timelinePosts?.sample)
    ? facebook.timelinePosts.sample.slice(0, MAX_TIMELINE_POST_TEXTS)
    : [];

  timelineSample.forEach((post) => {
    if (post?.message) {
      texts.push(post.message);
    }
  });

  if (user?.bio) {
    texts.push(user.bio);
  }

  if (Array.isArray(user?.interests) && user.interests.length > 0) {
    texts.push(user.interests.join(', '));
  }

  recentMessages.slice(0, MAX_RECENT_CHAT_TEXTS).forEach((message) => {
    if (message?.message) {
      texts.push(message.message);
    }
  });

  return uniqueTexts(texts).slice(0, MAX_TOTAL_TEXTS);
};

const buildSocialMetrics = ({ user, socialTexts, recentMessages }) => {
  const facebook = user?.socialData?.facebook || {};
  const friendsCount = Number(facebook?.friendsList?.totalCount) || 0;
  const timelineCount = Number(facebook?.timelinePosts?.totalCount) || 0;
  const connectedFriendsCount = Number(facebook?.extendedSocialGraph?.connectedFriendsCount) || 0;
  const totalChars = socialTexts.reduce((sum, text) => sum + text.length, 0);

  return {
    friends_count: Math.max(0, friendsCount),
    timeline_post_count: Math.max(0, timelineCount),
    connected_friends_count: Math.max(0, connectedFriendsCount),
    text_sample_count: socialTexts.length,
    avg_text_length: socialTexts.length > 0 ? totalChars / socialTexts.length : 0,
    recent_chat_count: recentMessages.length
  };
};

const normalizeVector = (vector, expectedLength) => {
  if (!Array.isArray(vector) || vector.length !== expectedLength) {
    return null;
  }

  return vector.map((value) => clamp01(value));
};

const loadRecentMessages = async (userId, recentMessages) => {
  if (Array.isArray(recentMessages)) {
    return recentMessages
      .map((entry) => ({
        message: toSafeString(entry?.message || entry)
      }))
      .filter((entry) => entry.message);
  }

  const stored = await Message.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_RECENT_CHAT_TEXTS)
    .select('message createdAt')
    .lean();

  return stored || [];
};

const mergeConsentSources = (existingSources, newSources) => {
  const merged = new Set();

  (Array.isArray(existingSources) ? existingSources : []).forEach((source) => {
    if (source) merged.add(String(source));
  });

  (Array.isArray(newSources) ? newSources : []).forEach((source) => {
    if (source) merged.add(String(source));
  });

  return Array.from(merged);
};

const hasSignal = (texts, metrics) =>
  texts.length > 0 || Object.values(metrics).some((value) => Number(value) > 0);

async function autoPopulatePersonalityProfile({
  userId,
  source = 'noswipechat_social_submission',
  recentMessages
}) {
  try {
    const user = await User.findById(userId).select(
      'bio interests personalityProfile socialData updatedAt'
    );

    if (!user) {
      return { updated: false, reason: 'user_not_found' };
    }

    const existingConsent = user?.personalityProfile?.consent || {};
    const revoked = existingConsent.status === false && Boolean(existingConsent.revokedAt);
    if (revoked) {
      return { updated: false, reason: 'consent_revoked' };
    }

    const recent = await loadRecentMessages(userId, recentMessages);
    const socialTexts = buildSocialTexts({ user, recentMessages: recent });
    const metrics = buildSocialMetrics({ user, socialTexts, recentMessages: recent });

    if (!hasSignal(socialTexts, metrics)) {
      return { updated: false, reason: 'no_social_signal' };
    }

    const personality = await buildPersonalityVector73({
      texts: socialTexts,
      metrics
    });

    const vector73 = normalizeVector(personality?.vector73, 73);
    const vector35 = normalizeVector(personality?.vector35, 35);

    if (!vector73 || !vector35) {
      return { updated: false, reason: 'invalid_personality_response' };
    }

    const consentSources = mergeConsentSources(existingConsent.sources, [
      source,
      'noswipechat_social_data',
      personality?.model ? `huggingface:${personality.model}` : 'huggingface:roberta-base'
    ]);

    const visibility = user?.personalityProfile?.visibility === 'matches' ? 'matches' : 'private';
    const now = new Date();

    const updates = {
      'personalityProfile.vector73': vector73,
      'personalityProfile.vector35': vector35,
      'personalityProfile.updatedAt': now,
      'personalityProfile.visibility': visibility,
      'personalityProfile.consent.status': true,
      'personalityProfile.consent.sources': consentSources,
      'personalityProfile.consent.grantedAt': existingConsent.grantedAt || now,
      'personalityProfile.consent.revokedAt': undefined,
      updatedAt: now
    };

    const updated = await User.findByIdAndUpdate(userId, updates, { new: true }).select(
      'personalityProfile'
    );

    return {
      updated: Boolean(updated),
      personalityProfile: updated?.personalityProfile,
      model: personality?.model || 'roberta-base',
      textSamplesUsed: personality?.textSamplesUsed || socialTexts.length
    };
  } catch (error) {
    console.error('Automatic personality update failed:', error.message);
    return { updated: false, reason: 'exception', error: error.message };
  }
}

module.exports = {
  autoPopulatePersonalityProfile
};
