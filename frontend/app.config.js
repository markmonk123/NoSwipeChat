const slug = process.env.EXPO_SLUG || 'noswipechat';
const version = process.env.APP_VERSION || '1.0.0';

module.exports = () => ({
  expo: {
    name: 'NoSwipeChat',
    slug,
    scheme: slug,
    version,
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    ios: {
      bundleIdentifier:
        process.env.IOS_BUNDLE_IDENTIFIER || 'com.markmonk123.noswipechat',
      supportsTablet: false
    },
    android: {
      package:
        process.env.ANDROID_PACKAGE || 'com.markmonk123.noswipechat',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      }
    },
    web: {
      bundler: 'metro'
    },
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || '',
      facebookAppId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '',
      eas: {
        projectId: process.env.EAS_PROJECT_ID || ''
      }
    }
  }
});
