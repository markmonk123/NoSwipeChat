import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import io from 'socket.io-client';
import PersonalityOrb from '../components/PersonalityOrb';
import { buildApiUrl, SOCKET_PATH, SOCKET_URL } from '../config/runtime';

const EMOJIS = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '😡', '👍', '🙏',
  '🎉', '🔥', '❤️', '😅', '😉', '🙃', '😴', '🤯', '🤗', '🤖',
  '👀', '✨', '💬', '🌍'
];

const REPORT_REASONS = [
  { code: 'bot', label: 'This looks like a bot' },
  { code: 'harassment', label: 'This person will not leave me alone' },
  { code: 'inappropriate_content', label: 'This person said inappropriate things' },
  { code: 'spam', label: 'This person is spamming or advertising' },
  { code: 'other', label: 'Other' },
];

const NearbyUsersScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [dmVisible, setDmVisible] = useState(false);
  const [dmText, setDmText] = useState('');
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [dmWindows, setDmWindows] = useState({});
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[1].code);
  const [reportDetails, setReportDetails] = useState('');
  const [actionAlert, setActionAlert] = useState('');
  const [deliveryAlert, setDeliveryAlert] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [personalityVisible, setPersonalityVisible] = useState(false);
  const [personalityUser, setPersonalityUser] = useState(null);
  const dmVisibleRef = useRef(false);
  const usersRef = useRef([]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    fetchNearbyUsers();
  }, []);

  useEffect(() => {
    let activeSocket;
    let isMounted = true;

    const connectSocket = async () => {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');

      if (!isMounted) {
        return;
      }

      setCurrentUserId(userId || '');

      activeSocket = io(SOCKET_URL, {
        path: SOCKET_PATH,
        auth: { token }
      });

      activeSocket.on('connect', () => {
        if (userId) {
          activeSocket.emit('register-user', { userId });
        }
      });

      activeSocket.on('receive-direct-message', (payload) => {
        const otherUserId =
          payload.fromUserId === userId ? payload.toUserId : payload.fromUserId;

        setDmWindows((prev) => {
          const existingMessages = prev[otherUserId]?.messages || [];
          return {
            ...prev,
            [otherUserId]: {
              userId: otherUserId,
              messages: [...existingMessages, payload]
            }
          };
        });

        if (!dmVisibleRef.current && payload.fromUserId !== userId) {
          const matchedUser = usersRef.current.find((item) => item._id === otherUserId);
          setActiveChatUser(matchedUser || { _id: otherUserId, name: 'Direct Message' });
          setDmVisible(true);
        }
      });

      activeSocket.on('direct-message-blocked', (payload) => {
        if (payload?.reason === 'compliance') {
          setDeliveryAlert(
            'Message not delivered because one account does not meet release requirements.'
          );
          return;
        }

        setDeliveryAlert('Message not delivered. The other user may have blocked you.');
      });

      setSocket(activeSocket);
    };

    connectSocket();

    return () => {
      isMounted = false;
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    dmVisibleRef.current = dmVisible;
  }, [dmVisible]);

  const fetchNearbyUsers = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      const response = await axios.get(buildApiUrl('/users/nearby'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setUsers(response.data);
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Failed to load nearby users');
    } finally {
      setLoading(false);
    }
  };

  const buildAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return { Authorization: `Bearer ${token}` };
  };

  const openDirectMessage = (user) => {
    setActiveChatUser(user);
    setDmVisible(true);
    setReportOpen(false);
    setEmojiOpen(false);
    setActionAlert('');
    setDeliveryAlert('');
    setDmWindows((prev) => {
      if (prev[user._id]) {
        return prev;
      }

      return {
        ...prev,
        [user._id]: {
          userId: user._id,
          messages: []
        }
      };
    });
  };

  const closeDirectMessage = () => {
    setDmVisible(false);
    setActiveChatUser(null);
    setDmText('');
    setReportOpen(false);
    setEmojiOpen(false);
    setActionAlert('');
    setDeliveryAlert('');
  };

  const sendDirectMessage = () => {
    if (!socket || !dmText.trim() || !activeChatUser || !currentUserId) {
      return;
    }

    socket.emit('send-direct-message', {
      fromUserId: currentUserId,
      toUserId: activeChatUser._id,
      message: dmText.trim(),
      timestamp: new Date().toISOString()
    });

    setDmText('');
    setEmojiOpen(false);
  };

  const addEmoji = (emoji) => {
    setDmText((prev) => `${prev}${emoji}`);
  };

  const handleBlock = async () => {
    if (!activeChatUser) {
      return;
    }

    try {
      setIsSubmittingAction(true);
      const headers = await buildAuthHeaders();
      await axios.post(buildApiUrl(`/users/block/${activeChatUser._id}`), {}, { headers });
      setUsers((prev) => prev.filter((item) => item._id !== activeChatUser._id));
      if (personalityUser?._id === activeChatUser._id) {
        setPersonalityVisible(false);
        setPersonalityUser(null);
      }
      setActionAlert('User blocked. You will no longer see them in matches.');
      setDmVisible(false);
    } catch (requestError) {
      setActionAlert(requestError?.response?.data?.error || 'Could not block user right now.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReport = async ({ blockToo } = { blockToo: false }) => {
    if (!activeChatUser || !reportReason) {
      setActionAlert('Choose a reason before submitting the report.');
      return;
    }

    try {
      setIsSubmittingAction(true);
      const headers = await buildAuthHeaders();
      const url = blockToo ? '/users/block-and-report' : '/users/report';

      await axios.post(
        buildApiUrl(url),
        {
          reportedUserId: activeChatUser._id,
          reason: reportReason,
          details: reportDetails
        },
        { headers }
      );

      if (blockToo) {
        setUsers((prev) => prev.filter((item) => item._id !== activeChatUser._id));
        setActionAlert('Blocked and reported. Thank you for the report.');
        setDmVisible(false);
      } else {
        setActionAlert('Report submitted. Thank you.');
      }

      setReportOpen(false);
      setReportDetails('');
    } catch (requestError) {
      setActionAlert(requestError?.response?.data?.error || 'Could not submit report.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const openPersonality = (user) => {
    setPersonalityUser(user);
    setPersonalityVisible(true);
  };

  const closePersonality = () => {
    setPersonalityVisible(false);
    setPersonalityUser(null);
  };

  const renderDirectMessage = ({ item }) => {
    const isMine = item.fromUserId === currentUserId;

    return (
      <View style={[styles.dmBubble, isMine ? styles.dmBubbleMine : styles.dmBubbleTheirs]}>
        <Text style={styles.dmBubbleText}>{item.message}</Text>
        <Text style={styles.dmBubbleTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  const renderUserCard = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.age ? <Text style={styles.userAge}>{item.age} years old</Text> : null}
        {item.city ? <Text style={styles.userLocation}>{item.city}</Text> : null}
      </View>

      {item.bio ? <Text style={styles.userBio}>{item.bio}</Text> : null}

      <View style={styles.interestsContainer}>
        {item.interests?.map((interest, index) => (
          <View key={`${interest}-${index}`} style={styles.interestTag}>
            <Text style={styles.interestText}>{interest}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.messageButton} onPress={() => openDirectMessage(item)}>
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.personalityButton} onPress={() => openPersonality(item)}>
          <Text style={styles.personalityButtonText}>Personality</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Singles</Text>
        <Text style={styles.headerSubtitle}>Verified people who passed the release gate.</Text>
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNearbyUsers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No nearby users found right now.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNearbyUsers}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {dmVisible && activeChatUser ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={72}
          style={styles.dmWrapper}
        >
          <View style={styles.dmContainer}>
            <View style={styles.dmHeader}>
              <Text style={styles.dmTitle}>Chat with {activeChatUser.name || 'User'}</Text>
              <TouchableOpacity onPress={closeDirectMessage}>
                <Text style={styles.dmClose}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dmActionsRow}>
              <TouchableOpacity
                style={styles.dmActionButton}
                onPress={handleBlock}
                disabled={isSubmittingAction}
              >
                <Text style={styles.dmActionButtonText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dmActionButton, styles.dmActionButtonSecondary]}
                onPress={() => setReportOpen((prev) => !prev)}
              >
                <Text style={styles.dmActionButtonText}>Report</Text>
              </TouchableOpacity>
            </View>

            {reportOpen ? (
              <View style={styles.reportPanel}>
                <Text style={styles.reportTitle}>Why are you reporting?</Text>
                <View style={styles.reportChipsRow}>
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.code}
                      style={[
                        styles.reportChip,
                        reportReason === reason.code && styles.reportChipActive,
                      ]}
                      onPress={() => setReportReason(reason.code)}
                    >
                      <Text
                        style={[
                          styles.reportChipText,
                          reportReason === reason.code && styles.reportChipTextActive,
                        ]}
                      >
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.reportInput}
                  placeholder="Add detail if needed"
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  maxLength={300}
                />

                <View style={styles.reportActionsRow}>
                  <TouchableOpacity
                    style={[styles.dmActionButton, styles.reportButton]}
                    onPress={() => handleReport({ blockToo: false })}
                    disabled={isSubmittingAction}
                  >
                    <Text style={styles.dmActionButtonText}>Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dmActionButton, styles.reportDangerButton]}
                    onPress={() => handleReport({ blockToo: true })}
                    disabled={isSubmittingAction}
                  >
                    <Text style={styles.dmActionButtonText}>Block and Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {actionAlert ? <Text style={styles.inlineAlert}>{actionAlert}</Text> : null}
            {deliveryAlert ? <Text style={styles.inlineAlert}>{deliveryAlert}</Text> : null}

            <FlatList
              data={dmWindows[activeChatUser._id]?.messages || []}
              renderItem={renderDirectMessage}
              keyExtractor={(item, index) => `${item.timestamp}-${index}`}
              contentContainerStyle={styles.dmList}
            />

            <View style={styles.dmComposer}>
              <TouchableOpacity
                style={[styles.emojiToggle, emojiOpen && styles.emojiToggleActive]}
                onPress={() => setEmojiOpen((prev) => !prev)}
              >
                <Text style={styles.emojiToggleText}>😀</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.dmInput}
                placeholder="Send a direct message"
                value={dmText}
                onChangeText={setDmText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendDirectMessage}>
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>

            {emojiOpen ? (
              <View style={styles.emojiPanel}>
                {EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiButton}
                    onPress={() => addEmoji(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <Modal
        visible={personalityVisible}
        transparent
        animationType="fade"
        onRequestClose={closePersonality}
      >
        <View style={styles.personalityBackdrop}>
          <View style={styles.personalityCard}>
            <Text style={styles.personalityTitle}>
              {`${personalityUser?.name || 'User'}'s Personality Map`}
            </Text>
            {personalityUser?.personalityProfile?.vector35?.length === 35 ? (
              <PersonalityOrb vector={personalityUser.personalityProfile.vector35} size={260} />
            ) : (
              <View style={styles.personalityPlaceholder}>
                <Text style={styles.personalityPlaceholderText}>
                  This user has not shared a 35-point visual profile.
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.personalityCloseButton} onPress={closePersonality}>
              <Text style={styles.personalityCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf7',
  },
  header: {
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: '#f04c3e',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    marginTop: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  listContainer: {
    padding: 14,
    paddingBottom: 180,
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f2dfd8',
  },
  userInfo: {
    marginBottom: 10,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d1b1a',
  },
  userAge: {
    fontSize: 14,
    color: '#6a615d',
    marginTop: 4,
  },
  userLocation: {
    fontSize: 13,
    color: '#f04c3e',
    marginTop: 4,
  },
  userBio: {
    fontSize: 14,
    lineHeight: 22,
    color: '#5d5552',
    marginBottom: 12,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  interestTag: {
    backgroundColor: '#fff0ea',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#d45443',
    fontSize: 12,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
  },
  messageButton: {
    flex: 1,
    backgroundColor: '#f04c3e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  personalityButton: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: '#fff0ea',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  personalityButtonText: {
    color: '#d45443',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#b02b2b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyText: {
    color: '#6a615d',
    fontSize: 15,
    marginBottom: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#f04c3e',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dmWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dmContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f2dfd8',
    overflow: 'hidden',
    maxHeight: '60%',
  },
  dmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f04c3e',
  },
  dmTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  dmClose: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  dmActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff7f3',
  },
  dmActionButton: {
    backgroundColor: '#f04c3e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 10,
  },
  dmActionButtonSecondary: {
    backgroundColor: '#f7a398',
  },
  dmActionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  reportPanel: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  reportTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 10,
  },
  reportChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  reportChip: {
    borderWidth: 1,
    borderColor: '#f04c3e',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  reportChipActive: {
    backgroundColor: '#f04c3e',
  },
  reportChipText: {
    color: '#f04c3e',
    fontSize: 12,
    fontWeight: '700',
  },
  reportChipTextActive: {
    color: '#ffffff',
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#ead8d2',
    borderRadius: 12,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  reportActionsRow: {
    flexDirection: 'row',
  },
  reportButton: {
    flex: 1,
    backgroundColor: '#f7a398',
  },
  reportDangerButton: {
    flex: 1,
    backgroundColor: '#b02b2b',
    marginLeft: 10,
  },
  inlineAlert: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    color: '#b02b2b',
    fontSize: 12,
    fontWeight: '700',
  },
  dmList: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  dmBubble: {
    maxWidth: '88%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dmBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff0ea',
  },
  dmBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f0ee',
  },
  dmBubbleText: {
    color: '#1d1b1a',
    fontSize: 14,
  },
  dmBubbleTime: {
    color: '#7a726e',
    fontSize: 10,
    marginTop: 5,
  },
  dmComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f2dfd8',
  },
  emojiToggle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead8d2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emojiToggleActive: {
    backgroundColor: '#fff0ea',
    borderColor: '#f04c3e',
  },
  emojiToggleText: {
    fontSize: 20,
  },
  dmInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ead8d2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxHeight: 96,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#f04c3e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emojiPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  emojiButton: {
    width: '12.5%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  emojiText: {
    fontSize: 22,
  },
  personalityBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 14, 12, 0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  personalityCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  personalityTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1d1b1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  personalityPlaceholder: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: '#ead8d2',
    backgroundColor: '#fff7f3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  personalityPlaceholderText: {
    color: '#6a615d',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  personalityCloseButton: {
    marginTop: 16,
    backgroundColor: '#f04c3e',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  personalityCloseText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});

export default NearbyUsersScreen;
