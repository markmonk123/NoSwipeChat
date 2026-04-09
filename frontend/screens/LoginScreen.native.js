import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
    ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
  const [socialChoices, setSocialChoices] = useState(DEFAULT_SOCIAL_DATA_CHOICES);

  const handleLogin = async () => {
    try {
      setIsSubmitting(true);

      const facebookAppId = await getFacebookAppId();

      if (!facebookAppId) {
        throw new Error('Missing Facebook app ID');
      }

      const Facebook = await import('expo-facebook');

      await Facebook.initializeAsync({
        appId: facebookAppId
      });

      const requestedPermissions = buildFacebookPermissions(socialChoices);
      const result = await Facebook.logInWithReadPermissionsAsync({
        permissions: requestedPermissions
      });

      if (result.type !== 'success' || !result.token) {
        return;
      }

      const profile = await fetchFacebookProfile(result.token);
      const facebookDataAccess = await buildFacebookDataAccess(result.token, socialChoices);
      const response = await axios.post(buildApiUrl('/auth/facebook/callback'), {
        facebookId: profile.id,
        name: profile.name,
        email: profile.email,
        profilePicture: profile.picture?.data?.url,
        facebookDataAccess
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
      Alert.alert('Login failed', error.message || 'Unable to sign in with Facebook');
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
          style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>Continue With Facebook</Text>
          )}
        </TouchableOpacity>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Release Gate</Text>
          <Text style={styles.policyText}>18+ only</Text>
          <Text style={styles.policyText}>Phone verification required</Text>
          <Text style={styles.policyText}>Facebook identity required</Text>
          <Text style={styles.policyText}>Personality profiling requires explicit opt-in</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7f3'
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24
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
