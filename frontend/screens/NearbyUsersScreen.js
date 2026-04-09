import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import io from 'socket.io-client';
import PersonalityOrb from '../components/PersonalityOrb';
import { buildApiUrl, SOCKET_PATH, SOCKET_URL } from '../config/runtime';

const NearbyUsersScreen = () => {
  const EMOJIS = [
    '😀','😂','😍','🥰','😎','🤔','😭','😡','👍','🙏',
    '🎉','🔥','❤️','😅','😉','🙃','😴','🤯','🤗','🤮',
    '🤫','🤝','🤖','👀'
  ];
  const REPORT_REASONS = [
    { code: 'bot', label: 'This looks like a bot' },
    { code: 'harassment', label: 'This person will not leave me alone' },
    { code: 'inappropriate_content', label: 'This person said inappropriate things' },
    { code: 'spam', label: 'This person is spamming/advertising' },
    { code: 'other', label: 'Other' },
  ];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [dmVisible, setDmVisible] = useState(false);
  const [dmText, setDmText] = useState('');
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [dmWindows, setDmWindows] = useState({});
  const [reportOpen, setReportOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[1].code); // default harassment
  const [reportDetails, setReportDetails] = useState('');
  const [actionAlert, setActionAlert] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [deliveryAlert, setDeliveryAlert] = useState('');
  const [personalityVisible, setPersonalityVisible] = useState(false);
  const [personalityUser, setPersonalityUser] = useState(null);
  const dmVisibleRef = useRef(false);

  useEffect(() => {
    fetchNearbyUsers();
  }, []);

  useEffect(() => {
    let activeSocket;
    const connectSocket = async () => {
      const token = await AsyncStorage.getItem('authToken');
      const uid = await AsyncStorage.getItem('userId');
      setCurrentUserId(uid || '');

      activeSocket = io(SOCKET_URL, {
        path: SOCKET_PATH,
        auth: { token },
      });

      activeSocket.on('connect', () => {
        if (uid) {
          activeSocket.emit('register-user', { userId: uid });
        }
      });

      activeSocket.on('receive-direct-message', (payload) => {
        const otherUserId =
          payload.fromUserId === uid ? payload.toUserId : payload.fromUserId;

        setDmWindows((prev) => {
          const existingMessages = prev[otherUserId]?.messages || [];
          return {
            ...prev,
            [otherUserId]: {
              userId: otherUserId,
              messages: [...existingMessages, payload],
            },
          };
        });

        // Auto-open the popup if a new inbound message arrives
        if (!dmVisibleRef.current && payload.fromUserId !== uid) {
          setActiveChatUser({ _id: otherUserId, name: 'Direct Message' });
          setDmVisible(true);
        }
      });

      activeSocket.on('direct-message-blocked', (payload) => {
        if (payload?.toUserId === activeChatUser?._id || payload?.fromUserId === activeChatUser?._id) {
          setDeliveryAlert('Message not delivered. You may have been blocked.');
        } else {
          setDeliveryAlert('Message not delivered. You may have been blocked.');
        }
      });

      setSocket(activeSocket);
    };

    connectSocket();

    return () => {
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
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load nearby users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDirectMessage = (user) => {
    setActiveChatUser(user);
    setDmVisible(true);
    setReportOpen(false);
    setEmojiOpen(false);
    setActionAlert('');
    setDeliveryAlert('');
    setDmWindows((prev) => {
      if (prev[user._id]) return prev;
      return { ...prev, [user._id]: { userId: user._id, messages: [] } };
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

  const openPersonality = (user) => {
    setPersonalityUser(user);
    setPersonalityVisible(true);
  };

  const closePersonality = () => {
    setPersonalityVisible(false);
    setPersonalityUser(null);
  };

  const sendDirectMessage = () => {
    if (!socket || !dmText.trim() || !activeChatUser || !currentUserId) {
      return;
    }

    const messagePayload = {
      fromUserId: currentUserId,
      toUserId: activeChatUser._id,
      message: dmText.trim(),
      timestamp: new Date().toISOString(),
    };

    socket.emit('send-direct-message', messagePayload);

    setDmWindows((prev) => {
      const existingMessages = prev[activeChatUser._id]?.messages || [];
      return {
        ...prev,
        [activeChatUser._id]: {
          userId: activeChatUser._id,
          messages: [...existingMessages, messagePayload],
        },
      };
    });

    setDmText('');
    setEmojiOpen(false);
  };

  const addEmoji = (emoji) => {
    setDmText((prev) => `${prev}${emoji}`);
  };

  const buildAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return { Authorization: `Bearer ${token}` };
  };

  const handleBlock = async () => {
    if (!activeChatUser) return;
    try {
      setIsSubmittingAction(true);
      const headers = await buildAuthHeaders();
      await axios.post(buildApiUrl(`/users/block/${activeChatUser._id}`), {}, { headers });
      setActionAlert('User blocked. You will not receive messages from them.');
      setUsers((prev) => prev.filter((item) => item._id !== activeChatUser._id));
      if (personalityUser?._id === activeChatUser._id) {
        closePersonality();
      }
      setDmVisible(false);
    } catch (err) {
      console.error('Block failed', err);
      setActionAlert('Could not block user. Try again.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReport = async ({ blockToo } = { blockToo: false }) => {
    if (!activeChatUser || !reportReason) {
      setActionAlert('Select a reason to report.');
      return;
    }

    try {
      setIsSubmittingAction(true);
      const headers = await buildAuthHeaders();
      if (blockToo) {
        await axios.post(
          buildApiUrl('/users/block-and-report'),
          {
            reportedUserId: activeChatUser._id,
            reason: reportReason,
            details: reportDetails,
          },
          { headers }
        );
        setActionAlert('Blocked and reported. Thank you for letting us know.');
        setDmVisible(false);
      } else {
        await axios.post(
          buildApiUrl('/users/report'),
          {
            reportedUserId: activeChatUser._id,
            reason: reportReason,
            details: reportDetails,
          },
          { headers }
        );
        setActionAlert('Report submitted. We will review this conversation.');
      }
      setReportOpen(false);
    } catch (err) {
      console.error('Report failed', err);
      setActionAlert('Could not submit report. Try again.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const renderDirectMessage = ({ item }) => {
    const isMine = item.fromUserId === currentUserId;
    return (
      <View
        style={[
          styles.dmBubble,
          isMine ? styles.dmBubbleMine : styles.dmBubbleTheirs,
        ]}
      >
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
        {item.age && <Text style={styles.userAge}>{item.age} years old</Text>}
        {item.city && <Text style={styles.userLocation}>📍 {item.city}</Text>}
      </View>
      {item.bio && <Text style={styles.userBio}>{item.bio}</Text>}
      <View style={styles.interestsContainer}>
        {item.interests?.map((interest, index) => (
          <View key={index} style={styles.interestTag}>
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

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchNearbyUsers}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Singles</Text>
        <Text style={styles.headerSubtitle}>Verified profiles in your area</Text>
      </View>

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No nearby users found</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchNearbyUsers}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContainer,
            dmVisible && styles.listContainerWithPopup,
          ]}
        />
      )}

      {dmVisible && activeChatUser && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
          style={styles.directMessageWrapper}
        >
          <View style={styles.directMessageContainer}>
            <View style={styles.directMessageHeader}>
              <Text style={styles.directMessageTitle}>
                Chat with {activeChatUser.name || 'User'}
              </Text>
              <TouchableOpacity onPress={closeDirectMessage}>
                <Text style={styles.directMessageClose}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dmActionsRow}>
              <TouchableOpacity
                style={styles.dmActionButton}
                onPress={handleBlock}
                disabled={isSubmittingAction}
              >
                <Text style={styles.dmActionText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dmActionButton, styles.dmActionButtonSecondary]}
                onPress={() => setReportOpen((prev) => !prev)}
              >
                <Text style={styles.dmActionText}>Report</Text>
              </TouchableOpacity>
            </View>

            {reportOpen && (
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
                  style={styles.reportDetailsInput}
                  placeholder="Add any details (optional)"
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  maxLength={300}
                />
                <View style={styles.reportActionsRow}>
                  <TouchableOpacity
                    style={[styles.dmActionButton, styles.reportActionButton]}
                    onPress={() => handleReport({ blockToo: false })}
                    disabled={isSubmittingAction}
                  >
                    <Text style={styles.dmActionText}>Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dmActionButton, styles.reportActionButtonDanger]}
                    onPress={() => handleReport({ blockToo: true })}
                    disabled={isSubmittingAction}
                  >
                    <Text style={styles.dmActionText}>Block & Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {actionAlert ? <Text style={styles.actionAlert}>{actionAlert}</Text> : null}
            {deliveryAlert ? <Text style={styles.actionAlert}>{deliveryAlert}</Text> : null}

            <FlatList
              data={dmWindows[activeChatUser._id]?.messages || []}
              renderItem={renderDirectMessage}
              keyExtractor={(item, index) => `${item.timestamp}-${index}`}
              contentContainerStyle={styles.directMessageList}
            />

            <View style={styles.directMessageInputRow}>
              <TouchableOpacity
                style={[styles.emojiToggle, emojiOpen && styles.emojiToggleActive]}
                onPress={() => setEmojiOpen((prev) => !prev)}
              >
                <Text style={styles.emojiToggleText}>😀</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.directMessageInput}
                placeholder="Send a direct message..."
                value={dmText}
                onChangeText={setDmText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={styles.directMessageSendButton}
                onPress={sendDirectMessage}
              >
                <Text style={styles.directMessageSendText}>Send</Text>
              </TouchableOpacity>
            </View>

            {emojiOpen && (
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
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={personalityVisible}
        animationType="slide"
        transparent
        onRequestClose={closePersonality}
      >
        <View style={styles.personalityModalBackdrop}>
          <View style={styles.personalityModalCard}>
            <Text style={styles.personalityModalTitle}>
              {personalityUser?.name || 'User'}'s Personality
            </Text>
            {personalityUser?.personalityProfile?.vector35?.length === 35 ? (
              <PersonalityOrb vector={personalityUser.personalityProfile.vector35} size={260} />
            ) : (
              <View style={styles.personalityPlaceholder}>
                <Text style={styles.personalityPlaceholderText}>
                  Personality profile not available yet.
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  listContainer: {
    padding: 10,
  },
  listContainerWithPopup: {
    paddingBottom: 260,
  },
  userCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  userInfo: {
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  userAge: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  userLocation: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 3,
  },
  userBio: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  interestTag: {
    backgroundColor: '#FFE0E0',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 5,
    marginBottom: 5,
  },
  interestText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  messageButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
  },
  messageButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  personalityButton: {
    backgroundColor: '#ffe5e5',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginLeft: 10,
    flex: 1,
  },
  personalityButtonText: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 15,
  },
  refreshButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 15,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  directMessageWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  directMessageContainer: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: '90%',
    maxHeight: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    overflow: 'hidden',
  },
  directMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FF6B6B',
  },
  directMessageTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  directMessageClose: {
    color: '#fff',
    fontSize: 20,
    paddingHorizontal: 4,
  },
  dmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  dmActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
  },
  dmActionButtonSecondary: {
    backgroundColor: '#ffb3b3',
  },
  dmActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  reportPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  reportTitle: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
    color: '#333',
  },
  reportChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  reportChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    marginRight: 6,
    marginBottom: 6,
  },
  reportChipActive: {
    backgroundColor: '#FF6B6B',
  },
  reportChipText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  reportChipTextActive: {
    color: '#fff',
  },
  reportDetailsInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  reportActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportActionButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#ffb3b3',
  },
  reportActionButtonDanger: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#d32f2f',
  },
  actionAlert: {
    color: '#d32f2f',
    paddingHorizontal: 14,
    paddingTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  directMessageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dmBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '90%',
  },
  dmBubbleMine: {
    backgroundColor: '#FFE0E0',
    alignSelf: 'flex-end',
  },
  dmBubbleTheirs: {
    backgroundColor: '#f1f1f1',
    alignSelf: 'flex-start',
  },
  dmBubbleText: {
    color: '#333',
    fontSize: 14,
  },
  dmBubbleTime: {
    color: '#777',
    fontSize: 10,
    marginTop: 4,
  },
  directMessageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  emojiToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  emojiToggleActive: {
    borderColor: '#FF6B6B',
    backgroundColor: '#fff3f3',
  },
  emojiToggleText: {
    fontSize: 20,
  },
  directMessageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 120,
  },
  directMessageSendButton: {
    marginLeft: 10,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  directMessageSendText: {
    color: '#fff',
    fontWeight: '700',
  },
  emojiPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  emojiButton: {
    width: '12.5%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  personalityModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  personalityModalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  personalityModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  personalityPlaceholder: {
    width: 240,
    height: 240,
    borderRadius: 120,
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
  personalityCloseButton: {
    marginTop: 16,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  personalityCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default NearbyUsersScreen;
