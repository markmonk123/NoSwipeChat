import * as Location from 'expo-location';
import axios from 'axios';
import { buildApiUrl } from '../config/runtime';

const buildAuthConfig = (authToken) => ({
  headers: {
    Authorization: `Bearer ${authToken}`
  }
});

const getCurrentDeviceLocation = async () => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required to complete phone verification');
  }

  const position = await Location.getCurrentPositionAsync({});

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    capturedAt: new Date().toISOString()
  };
};

export const getApiErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallbackMessage;

export const requestSignupPhoneCode = async (phoneNumber) => {
  const response = await axios.post(buildApiUrl('/auth/phone/request-code'), {
    phoneNumber
  });

  return response.data;
};

export const verifySignupPhoneCode = async ({ phoneNumber, code }) => {
  const deviceLocation = await getCurrentDeviceLocation();
  const response = await axios.post(buildApiUrl('/auth/phone/verify'), {
    phoneNumber,
    code,
    deviceLocation
  });

  return response.data;
};

export const requestUserPhoneCode = async (authToken) => {
  const response = await axios.post(
    buildApiUrl('/users/phone/request-code'),
    {},
    buildAuthConfig(authToken)
  );

  return response.data;
};

export const verifyUserPhoneCode = async ({ authToken, code }) => {
  const deviceLocation = await getCurrentDeviceLocation();
  const response = await axios.post(
    buildApiUrl('/users/phone/verify'),
    {
      code,
      deviceLocation
    },
    buildAuthConfig(authToken)
  );

  return response.data;
};