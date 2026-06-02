import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { buildApiUrl, getFacebookAppId } from '../config/runtime';
import {
  buildFacebookDataAccess,
  buildFacebookPermissions,
  DEFAULT_SOCIAL_DATA_CHOICES,
  SOCIAL_DATA_OPTIONS
} from '../config/facebookSocialData';
import {
  getApiErrorMessage,
  requestSignupPhoneCode,
  verifySignupPhoneCode
} from '../utils/phoneVerification';
import AppScrollView from '../components/AppScrollView';

const FACEBOOK_GRAPH_FIELDS = 'id,name,email,picture.type(large)';

const persistSession = async (payload) => {
  await AsyncStorage.setItem('authToken', payload.token);
  await AsyncStorage.setItem('userId', payload.user.id);
};

const fetchFacebookProfile = async (accessToken) => {
  const response = await axios.get('https://graph.facebook.com/me', {
    params: {
      fields: FACEBOOK_GRAPH_FIELDS,
      access_token: accessToken
    }
  });

  return response.data;
};

const LoginScreen = ({ navigation }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [socialChoices, setSocialChoices] = useState(DEFAULT_SOCIAL_DATA_CHOICES);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');
  const [phoneStatus, setPhoneStatus] = useState('');

  const handlePhoneNumberChange = (value) => {
    setPhoneNumber(value);
    setPhoneVerificationToken('');
    setPhoneStatus('');
  };

  const handleRequestPhoneCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone number required', 'Enter a mobile number before requesting a verification code.');
      return;
    }

    try {
      setIsSendingCode(true);
      await requestSignupPhoneCode(phoneNumber.trim());
      setPhoneStatus('Verification code sent. Enter the code and allow location access to continue.');
    } catch (error) {
      Alert.alert('Unable to send code', getApiErrorMessage(error, 'Failed to send verification code'));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone number required', 'Enter a mobile number before verifying.');
      return;
    }

    if (!phoneVerificationCode.trim()) {
      Alert.alert('Verification code required', 'Enter the SMS code before verifying your phone.');
      return;
    }

    try {
      setIsVerifyingPhone(true);
      const result = await verifySignupPhoneCode({
        phoneNumber: phoneNumber.trim(),
        code: phoneVerificationCode.trim()
      });
      setPhoneVerificationToken(result.phoneVerificationToken);
      setPhoneStatus(
        `Phone verified. IP and device location matched within ${Math.round(result.phoneVerification?.distanceMiles || 0)} miles.`
      );
    } catch (error) {
      setPhoneVerificationToken('');
      Alert.alert('Phone verification failed', getApiErrorMessage(error, 'Failed to verify phone'));
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsSubmitting(true);

      if (!phoneVerificationToken) {
        throw new Error('Verify your phone number before continuing with Facebook');
      }

      const facebookAppId = await getFacebookAppId();

      if (!facebookAppId) {
        throw new Error('Missing Facebook app ID');
      }

      const redirectUri = `${window.location.origin}/facebook-auth-callback.html`;
      const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      const requestedPermissions = buildFacebookPermissions(socialChoices);
      authUrl.searchParams.set('client_id', facebookAppId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', requestedPermissions.join(','));

      const popup = window.open(
        authUrl.toString(),
        'facebook-login',
        'width=560,height=720'
      );

      if (!popup) {
        throw new Error('Popup was blocked by the browser');
      }

      const accessToken = await new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          reject(new Error('Facebook login timed out'));
        }, 120000);

        const handleMessage = (event) => {
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data?.type !== 'facebook-auth-result') {
            return;
          }

          window.clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);

          if (event.data.error) {
            reject(new Error(event.data.error));
            return;
          }

          resolve(event.data.accessToken);
        };

        window.addEventListener('message', handleMessage);
      });

      const profile = await fetchFacebookProfile(accessToken);
      const facebookDataAccess = await buildFacebookDataAccess(accessToken, socialChoices);
      const response = await axios.post(buildApiUrl('/auth/facebook/callback'), {
        facebookId: profile.id,
        name: profile.name,
        email: profile.email,
        profilePicture: profile.picture?.data?.url,
        facebookDataAccess,
        phoneNumber: phoneNumber.trim(),
        phoneVerificationToken
      });

      await persistSession(response.data);

      if (navigation?.reset) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp' }]
        });
      } else if (navigation?.replace) {
        navigation.replace('MainApp');
      }
    } catch (error) {
      Alert.alert('Login failed', getApiErrorMessage(error, 'Unable to sign in with Facebook'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleChoice = (key) => {
    setSocialChoices((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  return (
    <AppScrollView
      style={styles.container}
      contentContainerStyle={styles.containerContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <Text style={styles.eyebrow}>NoSwipeChat</Text>
        <Text style={styles.title}>Verified matching with a real identity layer.</Text>
        <Text style={styles.subtitle}>
          Adults only, Facebook-linked, phone-verified, and built for controlled data use.
        </Text>

        <TouchableOpacity
          style={styles.secondaryLink}
          onPress={() => navigation?.navigate?.('Welcome')}
        >
          <Text style={styles.secondaryLinkText}>Read the overview and disclaimer again</Text>
        </TouchableOpacity>

        <View style={styles.phoneCard}>
          <Text style={styles.phoneTitle}>Secondary phone verification</Text>
          <Text style={styles.phoneIntro}>
            New accounts must pass SMS verification, avoid VOIP numbers, and match device location
            against the signup IP routed through nginx.
          </Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="+15551234567"
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.phoneInput}
            placeholder="6-digit verification code"
            value={phoneVerificationCode}
            onChangeText={setPhoneVerificationCode}
            keyboardType="number-pad"
            autoCapitalize="none"
          />
          <View style={styles.phoneActionRow}>
            <TouchableOpacity
              style={[
                styles.phoneButton,
                styles.phoneButtonSecondary,
                isSendingCode && styles.phoneButtonDisabled
              ]}
              onPress={handleRequestPhoneCode}
              disabled={isSendingCode}
            >
              {isSendingCode ? (
                <ActivityIndicator color="#b35d4e" />
              ) : (
                <Text style={styles.phoneButtonTextSecondary}>Send code</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.phoneButton,
                styles.phoneButtonPrimary,
                isVerifyingPhone && styles.phoneButtonDisabled
              ]}
              onPress={handleVerifyPhone}
              disabled={isVerifyingPhone}
            >
              {isVerifyingPhone ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.phoneButtonTextPrimary}>Verify phone</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.phoneStatus, phoneVerificationToken && styles.phoneStatusVerified]}>
            {phoneStatus || 'Phone verification must complete before Facebook signup is enabled.'}
          </Text>
        </View>

        <View style={styles.socialCard}>
          <Text style={styles.socialTitle}>Choose Facebook-linked data to request</Text>
          <Text style={styles.socialIntro}>
            Public profile and email stay required for sign-in. The options below are optional and
            will only be requested if you turn them on.
          </Text>
          {SOCIAL_DATA_OPTIONS.map((option) => {
            const selected = socialChoices[option.key];
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.socialOption, selected && styles.socialOptionSelected]}
                onPress={() => toggleChoice(option.key)}
              >
                <View style={[styles.socialToggle, selected && styles.socialToggleSelected]}>
                  <Text style={[styles.socialToggleText, selected && styles.socialToggleTextSelected]}>
                    {selected ? 'On' : 'Off'}
                  </Text>
                </View>
                <View style={styles.socialCopy}>
                  <Text style={styles.socialOptionTitle}>{option.label}</Text>
                  <Text style={styles.socialOptionBody}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.loginButton,
            (isSubmitting || !phoneVerificationToken) && styles.loginButtonDisabled
          ]}
          onPress={handleLogin}
          disabled={isSubmitting || !phoneVerificationToken}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>
              {phoneVerificationToken ? 'Continue With Facebook' : 'Verify Phone To Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Release Gate</Text>
          <Text style={styles.policyText}>18+ only</Text>
          <Text style={styles.policyText}>Phone verification required</Text>
          <Text style={styles.policyText}>Facebook identity required</Text>
          <Text style={styles.policyText}>Personality profiling requires explicit opt-in</Text>
        </View>
      </View>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7f3'
  },
  containerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  content: {
    width: '100%',
    maxWidth: 520
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#b35d4e',
    textTransform: 'uppercase',
    marginBottom: 12
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 14
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5d5552',
    marginBottom: 28
  },
  loginButton: {
    backgroundColor: '#f04c3e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  secondaryLink: {
    alignSelf: 'flex-start',
    marginBottom: 16
  },
  secondaryLinkText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b35d4e',
    fontWeight: '700'
  },
  phoneCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1d5cf',
    marginBottom: 18
  },
  phoneTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 8
  },
  phoneIntro: {
    fontSize: 14,
    lineHeight: 22,
    color: '#5d5552',
    marginBottom: 14
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: '#f1d5cf',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1d1b1a',
    backgroundColor: '#fffaf8',
    marginBottom: 10
  },
  phoneActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  phoneButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  phoneButtonPrimary: {
    backgroundColor: '#f04c3e'
  },
  phoneButtonSecondary: {
    backgroundColor: '#fff3f0',
    borderWidth: 1,
    borderColor: '#f1d5cf'
  },
  phoneButtonDisabled: {
    opacity: 0.7
  },
  phoneButtonTextPrimary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  phoneButtonTextSecondary: {
    color: '#b35d4e',
    fontSize: 14,
    fontWeight: '700'
  },
  phoneStatus: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8a5a51'
  },
  phoneStatusVerified: {
    color: '#1f7a4d',
    fontWeight: '700'
  },
  socialCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1d5cf',
    marginBottom: 18
  },
  socialTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 8
  },
  socialIntro: {
    fontSize: 14,
    lineHeight: 22,
    color: '#5d5552',
    marginBottom: 14
  },
  socialOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#f1d5cf',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10
  },
  socialOptionSelected: {
    borderColor: '#f04c3e',
    backgroundColor: '#fff3f0'
  },
  socialToggle: {
    minWidth: 44,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#efe4e0',
    alignItems: 'center',
    marginRight: 12
  },
  socialToggleSelected: {
    backgroundColor: '#f04c3e'
  },
  socialToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7c706c'
  },
  socialToggleTextSelected: {
    color: '#ffffff'
  },
  socialCopy: {
    flex: 1
  },
  socialOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 4
  },
  socialOptionBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#5d5552'
  },
  loginButtonDisabled: {
    opacity: 0.7
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  },
  policyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1d5cf'
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 10
  },
  policyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#5d5552'
  }
});

export default LoginScreen;
