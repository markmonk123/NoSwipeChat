import axios from 'axios';

export const REQUIRED_FACEBOOK_PERMISSIONS = ['public_profile', 'email'];

export const SOCIAL_DATA_OPTIONS = [
  {
    key: 'friendsList',
    label: 'Friends list',
    description:
      'Requests Facebook app-connected friend data so NoSwipeChat can import a limited friends summary when Facebook grants it.',
    permission: 'user_friends'
  },
  {
    key: 'timelinePosts',
    label: 'Timeline posts',
    description:
      'Requests timeline post access so NoSwipeChat can import a small post sample when Facebook grants it.',
    permission: 'user_posts'
  },
  {
    key: 'privateMessages',
    label: 'Private messages',
    description:
      'Records your consent preference, but Facebook Login does not expose personal inbox messages to this app flow today.',
    permission: null
  },
  {
    key: 'extendedSocialGraph',
    label: 'Extra social graph data',
    description:
      'Uses the same friend permission to derive limited social graph signals from app-connected Facebook friends.',
    permission: 'user_friends'
  }
];

export const DEFAULT_SOCIAL_DATA_CHOICES = SOCIAL_DATA_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.key] = false;
  return accumulator;
}, {});

const unique = (values) => [...new Set(values.filter(Boolean))];

export const buildFacebookPermissions = (choices = {}) =>
  unique([
    ...REQUIRED_FACEBOOK_PERMISSIONS,
    ...SOCIAL_DATA_OPTIONS.map((option) => (choices[option.key] ? option.permission : null))
  ]);

export const fetchGrantedPermissions = async (accessToken) => {
  try {
    const response = await axios.get('https://graph.facebook.com/me/permissions', {
      params: { access_token: accessToken }
    });
    const data = Array.isArray(response.data?.data) ? response.data.data : [];

    return {
      grantedScopes: data
        .filter((item) => item?.status === 'granted')
        .map((item) => item.permission),
      declinedScopes: data
        .filter((item) => item?.status && item.status !== 'granted')
        .map((item) => item.permission)
    };
  } catch (error) {
    return {
      grantedScopes: [],
      declinedScopes: []
    };
  }
};

const fetchFriendsListSummary = async (accessToken) => {
  const response = await axios.get('https://graph.facebook.com/me/friends', {
    params: {
      access_token: accessToken,
      limit: 25
    }
  });

  const sample = Array.isArray(response.data?.data)
    ? response.data.data.map((friend) => ({
      id: friend.id,
      name: friend.name || 'Facebook friend'
    }))
    : [];

  return {
    totalCount: sample.length,
    sample,
    fetchedAt: new Date().toISOString()
  };
};

const fetchTimelinePostsSummary = async (accessToken) => {
  const response = await axios.get('https://graph.facebook.com/me/posts', {
    params: {
      access_token: accessToken,
      limit: 10,
      fields: 'id,message,created_time,permalink_url'
    }
  });

  const sample = Array.isArray(response.data?.data)
    ? response.data.data.map((post) => ({
      id: post.id,
      message: post.message || '',
      createdTime: post.created_time,
      permalinkUrl: post.permalink_url || ''
    }))
    : [];

  return {
    totalCount: sample.length,
    sample,
    fetchedAt: new Date().toISOString()
  };
};

const buildConsentResult = ({ status, available, note }) => ({
  status,
  available,
  note
});

export const buildFacebookDataAccess = async (accessToken, choices = {}) => {
  const requestedScopes = buildFacebookPermissions(choices);
  const { grantedScopes, declinedScopes } = await fetchGrantedPermissions(accessToken);
  const now = new Date().toISOString();
  const hasFriendsPermission = grantedScopes.includes('user_friends');
  const hasTimelinePermission = grantedScopes.includes('user_posts');

  const consents = {
    friendsList: buildConsentResult({
      status: Boolean(choices.friendsList),
      available: !choices.friendsList || hasFriendsPermission,
      note: choices.friendsList && !hasFriendsPermission
        ? 'Facebook did not grant friends-list access for this session.'
        : undefined
    }),
    timelinePosts: buildConsentResult({
      status: Boolean(choices.timelinePosts),
      available: !choices.timelinePosts || hasTimelinePermission,
      note: choices.timelinePosts && !hasTimelinePermission
        ? 'Facebook did not grant timeline-post access for this session.'
        : undefined
    }),
    privateMessages: buildConsentResult({
      status: Boolean(choices.privateMessages),
      available: false,
      note: choices.privateMessages
        ? 'Facebook Login does not provide direct access to private messages in this app flow.'
        : 'Private-message access remains off.'
    }),
    extendedSocialGraph: buildConsentResult({
      status: Boolean(choices.extendedSocialGraph),
      available: !choices.extendedSocialGraph || hasFriendsPermission,
      note: choices.extendedSocialGraph && !hasFriendsPermission
        ? 'Extended social graph signals require the same Facebook friends permission.'
        : 'Extended social graph signals are limited to app-connected friend data that Facebook returns.'
    })
  };

  const data = {};

  if ((choices.friendsList || choices.extendedSocialGraph) && hasFriendsPermission) {
    try {
      const friendsList = await fetchFriendsListSummary(accessToken);
      if (choices.friendsList) {
        data.friendsList = friendsList;
      }
      if (choices.extendedSocialGraph) {
        data.extendedSocialGraph = {
          connectedFriendsCount: friendsList.totalCount,
          note: 'Derived from Facebook app-connected friend data only.',
          fetchedAt: now
        };
      }
    } catch (error) {
      if (choices.friendsList) {
        consents.friendsList.available = false;
        consents.friendsList.note = 'Facebook friends data was requested but could not be imported.';
      }
      if (choices.extendedSocialGraph) {
        consents.extendedSocialGraph.available = false;
        consents.extendedSocialGraph.note =
          'Extended social graph signals could not be derived from the granted Facebook data.';
      }
    }
  }

  if (choices.timelinePosts && hasTimelinePermission) {
    try {
      data.timelinePosts = await fetchTimelinePostsSummary(accessToken);
    } catch (error) {
      consents.timelinePosts.available = false;
      consents.timelinePosts.note =
        'Facebook timeline access was requested but timeline posts could not be imported.';
    }
  }

  return {
    requestedScopes,
    grantedScopes,
    declinedScopes,
    consents,
    data
  };
};
