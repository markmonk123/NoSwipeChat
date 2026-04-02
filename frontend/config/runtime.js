import { Platform } from 'react-native';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const getWindowConfig = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  return window.__APP_CONFIG__ || {};
};

const getWebOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }

  return window.location.origin;
};

const windowConfig = getWindowConfig();
const webOrigin = getWebOrigin();

const defaultApiBaseUrl =
  Platform.OS === 'web' && webOrigin
    ? `${webOrigin}/api`
    : 'http://localhost:5000';

const defaultSocketUrl =
  Platform.OS === 'web' && webOrigin
    ? webOrigin
    : 'http://localhost:5000';

export const API_BASE_URL = trimTrailingSlash(
  windowConfig.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl
);

export const SOCKET_URL = trimTrailingSlash(
  windowConfig.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL || defaultSocketUrl
);

export const SOCKET_PATH =
  windowConfig.socketPath || process.env.EXPO_PUBLIC_SOCKET_PATH || '/socket.io';
export const FACEBOOK_APP_ID =
  windowConfig.facebookAppId || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';

export const buildApiUrl = (path = '') => {
  if (!path) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

let publicConfigPromise;

const fetchPublicConfig = async () => {
  if (!publicConfigPromise) {
    publicConfigPromise = fetch(buildApiUrl('/config/public'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Public config request failed with ${response.status}`);
        }

        return response.json();
      })
      .catch(() => ({}));
  }

  return publicConfigPromise;
};

export const getFacebookAppId = async () => {
  if (FACEBOOK_APP_ID) {
    return FACEBOOK_APP_ID;
  }

  const publicConfig = await fetchPublicConfig();
  return publicConfig.facebookAppId || '';
};
