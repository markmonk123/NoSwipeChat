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
import PersonalityOrb from '../components/PersonalityOrb';
import { buildApiUrl } from '../config/runtime';
import {
  DEFAULT_SOCIAL_DATA_CHOICES,
  SOCIAL_DATA_OPTIONS
} from '../config/facebookSocialData';
import {
  profileFieldLabels,
  toListText,
  fromListText,
  labelFor
} from '../config/profileFields';

// Options-driven dropdown for the enum-backed profile fields. Values come
// from profileFieldLabels and mirror the enums the API accepts.
const EnumSelector = ({ label, field, options = [], value, onChange }) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.select}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
          {value ? labelFor(field, value) : `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={styles.selectChevron}>{open ? '\u25BC' : '\u25B6'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.selectMenu}>
          <TouchableOpacity
            style={styles.selectOption}
            onPress={() => {
              onChange('');
              setOpen(false);
            }}
          >
            <Text style={styles.selectOptionText}>Not specified</Text>
          </TouchableOpacity>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.selectOption}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <Text
                style={[
                  styles.selectOptionText,
                  value === option && styles.selectOptionTextSelected,
                ]}
              >
                {labelFor(field, option)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const ProfileScreen = () => {
  const [profile, setProfile] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socialChoices, setSocialChoices] = useState(DEFAULT_SOCIAL_DATA_CHOICES);
  const [profileOptions, setProfileOptions] = useState(profileFieldLabels);
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    education: '',
    spirituality: '',
    ethnicity: '',
    relationshipStatus: '',
    hometown: '',
    locationLabel: '',
    bio: '',
    interests: '',
    hobbies: '',
    skillsets: '',
    dateOfBirth: '',
    phoneNumber: '',
    phoneVerificationCode: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  // Enum values come from the API so this screen never drifts from what the
  // backend accepts. Falls back to the bundled labels if the call fails.
  const fetchProfileOptions = async (token) => {
    try {
      const response = await axios.get(buildApiUrl('/users/profile/options'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = response.data || {};
      setProfileOptions((prev) => ({
        ...prev,
        gender: data.gender?.length ? data.gender : prev.gender,
        education: data.education?.length ? data.education : prev.education,
        spirituality: data.spirituality?.length ? data.spirituality : prev.spirituality,
        ethnicity: data.ethnicity?.length ? data.ethnicity : prev.ethnicity,
        relationshipStatus: data.relationshipStatus?.length
          ? data.relationshipStatus
          : prev.relationshipStatus,
      }));
    } catch (error) {
      console.warn('Using built-in profile options', error);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      fetchProfileOptions(token);

      const response = await axios.get(buildApiUrl('/users/profile'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;
      setProfile(data);
      setCompliance(data.compliance || null);
      setSocialChoices({
        friendsList: Boolean(data?.socialDataSettings?.facebook?.friendsList?.status),
        timelinePosts: Boolean(data?.socialDataSettings?.facebook?.timelinePosts?.status),
        privateMessages: Boolean(data?.socialDataSettings?.facebook?.privateMessages?.status),
        extendedSocialGraph: Boolean(data?.socialDataSettings?.facebook?.extendedSocialGraph?.status)
      });
      setFormData((prev) => ({
        ...prev,
        age: data.age?.toString() || '',
        gender: data.gender || '',
        education: data.education || '',
        spirituality: data.spirituality || '',
        ethnicity: data.ethnicity || '',
        relationshipStatus: data.relationshipStatus || '',
        hometown: data.hometown || '',
        locationLabel: data.locationLabel || '',
        bio: data.bio || '',
        interests: toListText(data.interests),
        hobbies: toListText(data.hobbies),
        skillsets: toListText(data.skillsets),
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
        phoneNumber: data.phoneNumber || '',
      }));
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

      // Location is optional: a user may edit their profile without granting
      // location permission, so fall back to leaving the stored point alone.
      let coordinates;
      try {
        const location = await Location.getCurrentPositionAsync({});
        coordinates = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } catch (locError) {
        console.warn('Location unavailable, keeping existing coordinates', locError);
      }

      const payload = {
        age: formData.age === '' ? null : Number(formData.age),
        gender: formData.gender,
        education: formData.education,
        spirituality: formData.spirituality,
        ethnicity: formData.ethnicity,
        relationshipStatus: formData.relationshipStatus,
        hometown: formData.hometown,
        locationLabel: formData.locationLabel,
        bio: formData.bio,
        interests: fromListText(formData.interests),
        hobbies: fromListText(formData.hobbies),
        skillsets: fromListText(formData.skillsets),
        dateOfBirth: formData.dateOfBirth,
        phoneNumber: formData.phoneNumber,
        ...(coordinates || {}),
      };

      const response = await axios.put(
        buildApiUrl('/users/profile'),
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setProfile(response.data);
      setCompliance(response.data.compliance || null);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      const payload = error?.response?.data?.error;
      const message =
        (typeof payload === 'string' ? payload : payload?.message) ||
        'Failed to update profile';
      Alert.alert('Error', message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (!formData.phoneVerificationCode) {
      Alert.alert('Error', 'Enter the verification code.');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      await axios.post(
        buildApiUrl('/users/phone/verify'),
        { code: formData.phoneVerificationCode },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await fetchProfile();
      Alert.alert('Success', 'Phone number verified');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to verify phone');
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

  const toggleSocialChoice = (key) => {
    setSocialChoices((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  const handleSaveSocialData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const currentFacebookSettings = profile?.socialDataSettings?.facebook || {};
      const response = await axios.put(
        buildApiUrl('/users/social-data'),
        {
          facebook: {
            requestedScopes: currentFacebookSettings.requestedScopes || [],
            grantedScopes: currentFacebookSettings.grantedScopes || [],
            declinedScopes: currentFacebookSettings.declinedScopes || [],
            friendsList: { status: socialChoices.friendsList },
            timelinePosts: { status: socialChoices.timelinePosts },
            privateMessages: {
              status: socialChoices.privateMessages,
              available: false,
              note: 'Facebook Login does not provide direct access to private messages in this app flow.'
            },
            extendedSocialGraph: { status: socialChoices.extendedSocialGraph }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setProfile((current) => ({
        ...current,
        socialDataSettings: response.data.socialDataSettings,
        socialData: response.data.socialData
      }));

      Alert.alert(
        'Social data choices saved',
        'Turning a Facebook category on may require logging in again before new data can be imported.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error?.response?.data?.error || 'Failed to save social data choices'
      );
      console.error(error);
    } finally {
      setLoading(false);
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

  const socialSettings = profile?.socialDataSettings?.facebook || {};
  const socialData = profile?.socialData?.facebook || {};

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
        <View style={styles.personalitySection}>
          <Text style={styles.sectionTitle}>Personality Profile</Text>
          {profile?.personalityProfile?.vector35?.length === 35 ? (
            <PersonalityOrb vector={profile.personalityProfile.vector35} size={220} />
          ) : (
            <View style={styles.personalityPlaceholder}>
              <Text style={styles.personalityPlaceholderText}>
                Personality profile not available yet.
              </Text>
            </View>
          )}
        </View>

        {compliance && (
          <View style={styles.complianceBox}>
            <Text style={styles.sectionTitle}>Compliance Status</Text>
            <Text style={styles.complianceItem}>
              Age 18+: {compliance.adult ? 'OK' : 'Missing'}
            </Text>
            <Text style={styles.complianceItem}>
              Phone Verified: {compliance.phoneVerified ? 'OK' : 'Missing'}
            </Text>
            <Text style={styles.complianceItem}>
              Facebook Linked: {compliance.hasFacebook ? 'OK' : 'Missing'}
            </Text>
          </View>
        )}

        <View style={styles.socialDataBox}>
          <Text style={styles.sectionTitle}>Social Data Controls</Text>
          <Text style={styles.socialDataIntro}>
            Choose which Facebook-linked categories NoSwipeChat should keep requesting or storing.
            Turning a category on may require you to sign in with Facebook again before fresh data is imported.
          </Text>

          {SOCIAL_DATA_OPTIONS.map((option) => {
            const selected = socialChoices[option.key];
            const savedSetting = socialSettings[option.key];
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.socialRow, selected && styles.socialRowSelected]}
                onPress={() => toggleSocialChoice(option.key)}
              >
                <View style={[styles.socialBadge, selected && styles.socialBadgeSelected]}>
                  <Text style={[styles.socialBadgeText, selected && styles.socialBadgeTextSelected]}>
                    {selected ? 'On' : 'Off'}
                  </Text>
                </View>
                <View style={styles.socialRowCopy}>
                  <Text style={styles.socialRowTitle}>{option.label}</Text>
                  <Text style={styles.socialRowBody}>{option.description}</Text>
                  {savedSetting?.note ? (
                    <Text style={styles.socialRowNote}>{savedSetting.note}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.socialSaveButton} onPress={handleSaveSocialData}>
            <Text style={styles.socialSaveButtonText}>Save Social Data Choices</Text>
          </TouchableOpacity>

          {socialData?.friendsList?.totalCount ? (
            <Text style={styles.socialSummary}>
              Imported app-connected Facebook friends: {socialData.friendsList.totalCount}
            </Text>
          ) : null}
          {socialData?.timelinePosts?.totalCount ? (
            <Text style={styles.socialSummary}>
              Imported Facebook timeline posts: {socialData.timelinePosts.totalCount}
            </Text>
          ) : null}
          {typeof socialData?.extendedSocialGraph?.connectedFriendsCount === 'number' ? (
            <Text style={styles.socialSummary}>
              Derived social graph friend signals: {socialData.extendedSocialGraph.connectedFriendsCount}
            </Text>
          ) : null}
        </View>

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

            <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="1995-04-23"
              value={formData.dateOfBirth}
              onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+15551234567"
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Phone Verification Code</Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              value={formData.phoneVerificationCode}
              onChangeText={(text) => setFormData({ ...formData, phoneVerificationCode: text })}
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyPhone}>
              <Text style={styles.verifyButtonText}>Verify Phone</Text>
            </TouchableOpacity>

            <EnumSelector
              label="Gender"
              field="gender"
              options={profileOptions.gender}
              value={formData.gender}
              onChange={(value) => setFormData({ ...formData, gender: value })}
            />
            <EnumSelector
              label="Education"
              field="education"
              options={profileOptions.education}
              value={formData.education}
              onChange={(value) => setFormData({ ...formData, education: value })}
            />
            <EnumSelector
              label="Spirituality / Beliefs"
              field="spirituality"
              options={profileOptions.spirituality}
              value={formData.spirituality}
              onChange={(value) => setFormData({ ...formData, spirituality: value })}
            />
            <EnumSelector
              label="Ethnicity"
              field="ethnicity"
              options={profileOptions.ethnicity}
              value={formData.ethnicity}
              onChange={(value) => setFormData({ ...formData, ethnicity: value })}
            />
            <EnumSelector
              label="Relationship Status"
              field="relationshipStatus"
              options={profileOptions.relationshipStatus}
              value={formData.relationshipStatus}
              onChange={(value) => setFormData({ ...formData, relationshipStatus: value })}
            />
            <Text style={styles.label}>Hometown</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., San Antonio, TX"
              value={formData.hometown}
              onChangeText={(text) => setFormData({ ...formData, hometown: text })}
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Austin, TX or Remote (EST)"
              value={formData.locationLabel}
              onChangeText={(text) => setFormData({ ...formData, locationLabel: text })}
            />
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
            <Text style={styles.label}>Hobbies (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="e.g., Climbing, Cooking, Photography"
              value={formData.hobbies}
              onChangeText={(text) => setFormData({ ...formData, hobbies: text })}
            />

            <Text style={styles.label}>Skillsets (comma-separated)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="e.g., React, Python, Graphic design"
              value={formData.skillsets}
              onChangeText={(text) => setFormData({ ...formData, skillsets: text })}
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
            {profile.dateOfBirth && (
              <>
                <Text style={styles.label}>Date of Birth</Text>
                <Text style={styles.displayText}>
                  {profile.dateOfBirth.slice(0, 10)}
                </Text>
              </>
            )}
            {profile.phoneNumber && (
              <>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.displayText}>
                  {profile.phoneNumber}{' '}
                  {profile.phoneVerified ? '(Verified)' : '(Unverified)'}
                </Text>
              </>
            )}
            {profile.gender && (
              <>
                <Text style={styles.label}>Gender</Text>
                <Text style={styles.displayText}>
                  {labelFor('gender', profile.gender)}
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
            )}            {profile.hobbies?.length > 0 && (
              <>
                <Text style={styles.label}>Hobbies</Text>
                <View style={styles.interestsContainer}>
                  {profile.hobbies.map((item, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {profile.skillsets?.length > 0 && (
              <>
                <Text style={styles.label}>Skillsets</Text>
                <View style={styles.interestsContainer}>
                  {profile.skillsets.map((item, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {profile.education && (
              <>
                <Text style={styles.label}>Education</Text>
                <Text style={styles.displayText}>
                  {labelFor("education", profile.education)}
                </Text>
              </>
            )}
            {profile.spirituality && (
              <>
                <Text style={styles.label}>Spirituality / Beliefs</Text>
                <Text style={styles.displayText}>
                  {labelFor("spirituality", profile.spirituality)}
                </Text>
              </>
            )}
            {profile.ethnicity && (
              <>
                <Text style={styles.label}>Ethnicity</Text>
                <Text style={styles.displayText}>
                  {labelFor("ethnicity", profile.ethnicity)}
                </Text>
              </>
            )}
            {profile.relationshipStatus && (
              <>
                <Text style={styles.label}>Relationship Status</Text>
                <Text style={styles.displayText}>
                  {labelFor("relationshipStatus", profile.relationshipStatus)}
                </Text>
              </>
            )}
            {profile.hometown && (
              <>
                <Text style={styles.label}>Hometown</Text>
                <Text style={styles.displayText}>{profile.hometown}</Text>
              </>
            )}
            {profile.locationLabel && (
              <>
                <Text style={styles.label}>Location</Text>
                <Text style={styles.displayText}>{profile.locationLabel}</Text>
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
  personalitySection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  personalityPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  personalityPlaceholderText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
  },
  complianceBox: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    backgroundColor: '#fff9f9',
  },
  complianceItem: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    fontWeight: '600',
  },
  socialDataBox: {
    borderWidth: 1,
    borderColor: '#f0d3cd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    backgroundColor: '#fff7f3',
  },
  socialDataIntro: {
    fontSize: 13,
    lineHeight: 20,
    color: '#5d5552',
    marginBottom: 12,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#f1d5cf',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  socialRowSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#fff0f0',
  },
  socialBadge: {
    minWidth: 44,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#efe4e0',
    alignItems: 'center',
    marginRight: 12,
  },
  socialBadgeSelected: {
    backgroundColor: '#FF6B6B',
  },
  socialBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7c706c',
  },
  socialBadgeTextSelected: {
    color: '#ffffff',
  },
  socialRowCopy: {
    flex: 1,
  },
  socialRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  socialRowBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5d5552',
  },
  socialRowNote: {
    fontSize: 12,
    lineHeight: 18,
    color: '#b35d4e',
    marginTop: 6,
  },
  socialSaveButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  socialSaveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  socialSummary: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5d5552',
    marginTop: 10,
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
  verifyButton: {
    marginTop: 10,
    backgroundColor: '#ffe5e5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 4,
  },
  select: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  selectValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  selectChevron: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectOptionTextSelected: {
    fontWeight: '700',
    color: '#FF6B6B',
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
