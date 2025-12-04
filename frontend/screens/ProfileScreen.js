import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import axios from 'axios';

const ProfileScreen = () => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    bio: '',
    interests: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      const response = await axios.get('http://localhost:5000/users/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProfile(response.data);
      setFormData({
        age: response.data.age?.toString() || '',
        gender: response.data.gender || '',
        bio: response.data.bio || '',
        interests: response.data.interests?.join(', ') || '',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      // Get location
      const location = await Location.getCurrentPositionAsync({});

      const response = await axios.put(
        'http://localhost:5000/users/profile',
        {
          age: parseInt(formData.age),
          gender: formData.gender,
          bio: formData.bio,
          interests: formData.interests.split(',').map((i) => i.trim()),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          city: profile?.city || 'Unknown',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setProfile(response.data);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userId');
      // Navigate to login screen
      Alert.alert('Logged out', 'You have been logged out');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        {!isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)}>
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.profileContainer}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.displayText}>{profile.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.displayText}>{profile.email}</Text>

        {isEditing ? (
          <>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="Age"
              value={formData.age}
              onChangeText={(text) => setFormData({ ...formData, age: text })}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              {['male', 'female', 'other'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    formData.gender === option && styles.genderOptionSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, gender: option })}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      formData.gender === option && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell us about yourself"
              value={formData.bio}
              onChangeText={(text) => setFormData({ ...formData, bio: text })}
              multiline
            />

            <Text style={styles.label}>Interests (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="e.g., Travel, Music, Hiking"
              value={formData.interests}
              onChangeText={(text) => setFormData({ ...formData, interests: text })}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateProfile}
              >
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {profile.age && (
              <>
                <Text style={styles.label}>Age</Text>
                <Text style={styles.displayText}>{profile.age}</Text>
              </>
            )}
            {profile.gender && (
              <>
                <Text style={styles.label}>Gender</Text>
                <Text style={styles.displayText}>
                  {profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}
                </Text>
              </>
            )}
            {profile.bio && (
              <>
                <Text style={styles.label}>Bio</Text>
                <Text style={styles.displayText}>{profile.bio}</Text>
              </>
            )}
            {profile.interests?.length > 0 && (
              <>
                <Text style={styles.label}>Interests</Text>
                <View style={styles.interestsContainer}>
                  {profile.interests.map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  editButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  profileContainer: {
    padding: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginTop: 15,
    marginBottom: 5,
  },
  displayText: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  genderOptionText: {
    color: '#333',
    fontWeight: '600',
  },
  genderOptionTextSelected: {
    color: 'white',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  interestTag: {
    backgroundColor: '#FFE0E0',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#d32f2f',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
});

export default ProfileScreen;
