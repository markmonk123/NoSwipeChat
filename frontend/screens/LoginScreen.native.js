import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { buildApiUrl, getFacebookAppId } from '../config/runtime';

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

      const result = await Facebook.logInWithReadPermissionsAsync({
        permissions: ['public_profile', 'email']
      });

      if (result.type !== 'success' || !result.token) {
        return;
      }

      const profile = await fetchFacebookProfile(result.token);
      const response = await axios.post(buildApiUrl('/auth/facebook/callback'), {
        facebookId: profile.id,
        name: profile.name,
        email: profile.email,
        profilePicture: profile.picture?.data?.url
      });

      await persistSession(response.data);

      if (navigation?.replace) {
        navigation.replace('Nearby');
      }
    } catch (error) {
      Alert.alert('Login failed', error.message || 'Unable to sign in with Facebook');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>NoSwipeChat</Text>
        <Text style={styles.title}>Verified matching with a real identity layer.</Text>
        <Text style={styles.subtitle}>
          Adults only, Facebook-linked, phone-verified, and built for controlled data use.
        </Text>

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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7f3'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
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
