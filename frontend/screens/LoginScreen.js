import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Facebook from 'expo-facebook';
import axios from 'axios';

const LoginScreen = ({ route }) => {
  const [loading, setLoading] = useState(false);
  const { setIsLoggedIn } = route.params;

  const handleFacebookLogin = async () => {
    try {
      setLoading(true);
      await Facebook.initializeAsync({
        appId: 'YOUR_FACEBOOK_APP_ID',
        appName: 'Singles Connect',
      });

      const { type, token } = await Facebook.logInWithReadPermissionsAsync({
        permissions: ['public_profile', 'email'],
      });

      if (type === 'success' && token) {
        // Get user info
        const response = await fetch(
          `https://graph.facebook.com/me?access_token=${token}&fields=id,name,email,picture.width(200).height(200)`
        );
        const data = await response.json();

        // Send to backend
        const backendResponse = await axios.post('http://localhost:5000/auth/facebook/callback', {
          facebookId: data.id,
          name: data.name,
          email: data.email,
          profilePicture: data.picture?.data?.url,
        });

        if (backendResponse.data.token) {
          // Store token and navigate
          await AsyncStorage.setItem('authToken', backendResponse.data.token);
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.adHeader}>
        <Text style={styles.adHeaderTitle}>Sponsored</Text>
        <Text style={styles.adHeaderCopy}>Premium placement for your brand goes here.</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Singles Connect</Text>
        <Text style={styles.subtitle}>Meet local singles in your city</Text>
      </View>

      <View style={styles.content}>
        <Image
          source={require('../CustomArtwork.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />
        <Text style={styles.description}>
          Free chat with verified profiles. Location-based matching for your city.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleFacebookLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.loginButtonText}>Login with Facebook</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        By logging in, you agree to our Terms of Service and Privacy Policy.
        All profiles are verified through Facebook.
      </Text>

      <View style={styles.adFooter}>
        <Text style={styles.adFooterTitle}>Advertise Here</Text>
        <Text style={styles.adFooterCopy}>Reach thousands of local singles daily.</Text>
        <TouchableOpacity style={styles.adFooterCta}>
          <Text style={styles.adFooterCtaText}>Contact Sales</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  adHeader: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  adHeaderTitle: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  adHeaderCopy: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    alignItems: 'center',
    marginTop: 20,
  },
  heroImage: {
    width: '100%',
    height: 240,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: '#1877F2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  adFooter: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  adFooterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  adFooterCopy: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
  },
  adFooterCta: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  adFooterCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default LoginScreen;
