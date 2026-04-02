import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
import { buildApiUrl, SOCKET_PATH, SOCKET_URL } from '../config/runtime';

const toMessageId = (message) => {
  if (message._id) {
    return message._id;
  }

  return [
    message.userId?._id || message.userId || 'user',
    message.message || 'message',
    message.createdAt || message.timestamp || 'time',
  ].join(':');
};

const normalizeMessage = (message) => ({
  id: toMessageId(message),
  userId: message.userId?._id || message.userId || '',
  userName: message.userId?.name || message.userName || 'Unknown',
  message: message.message || '',
  timestamp: message.createdAt || message.timestamp || new Date().toISOString(),
});

const appendUniqueMessage = (currentMessages, nextMessage) => {
  if (currentMessages.some((message) => message.id === nextMessage.id)) {
    return currentMessages;
  }

  return [...currentMessages, nextMessage];
};

const formatTimestamp = (value) => {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (error) {
    return '';
  }
};

const ChatScreen = ({ route }) => {
  const requestedCity = route?.params?.city;
  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roomCity, setRoomCity] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [socketReady, setSocketReady] = useState(false);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) =>
          new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
      ),
    [messages]
  );

  useEffect(() => {
    let isMounted = true;
    let activeSocket;

    const initializeChat = async () => {
      try {
        setLoading(true);
        setError('');
        setMessages([]);
        setSocketReady(false);

        const [token, userId] = await Promise.all([
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('userId'),
        ]);

        if (!token || !userId) {
          throw new Error('You need to sign in before joining chat.');
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const profileResponse = await axios.get(buildApiUrl('/users/profile'), { headers });
        const userProfile = profileResponse.data || {};
        const activeCity = requestedCity || userProfile.city;

        if (!activeCity) {
          throw new Error('Add your city to your profile before entering chat.');
        }

        const historyResponse = await axios.get(
          buildApiUrl(`/chat/city/${encodeURIComponent(activeCity)}`),
          { headers }
        );

        if (!isMounted) {
          return;
        }

        setCurrentUserId(userId);
        setRoomCity(activeCity);
        setMessages((historyResponse.data || []).map(normalizeMessage));

        activeSocket = io(SOCKET_URL, {
          path: SOCKET_PATH,
          auth: { token },
        });

        activeSocket.on('connect', () => {
          setSocketReady(true);
          activeSocket.emit('join-room', {
            userId,
            city: activeCity,
            latitude: userProfile.location?.coordinates?.[1],
            longitude: userProfile.location?.coordinates?.[0],
          });
        });

        activeSocket.on('disconnect', () => {
          setSocketReady(false);
        });

        activeSocket.on('receive-message', (payload) => {
          setMessages((currentMessages) =>
            appendUniqueMessage(currentMessages, normalizeMessage(payload))
          );
        });

        socketRef.current = activeSocket;
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(
          requestError?.response?.data?.error ||
            requestError?.message ||
            'Could not open city chat.'
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeChat();

    return () => {
      isMounted = false;
      socketRef.current = null;
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, [requestedCity]);

  useEffect(() => {
    if (sortedMessages.length === 0) {
      return;
    }

    flatListRef.current?.scrollToEnd({ animated: true });
  }, [sortedMessages]);

  const handleSend = () => {
    const trimmedDraft = messageDraft.trim();
    if (!trimmedDraft || !roomCity || !currentUserId || !socketRef.current) {
      return;
    }

    socketRef.current.emit('send-message', {
      userId: currentUserId,
      city: roomCity,
      message: trimmedDraft,
    });

    setMessageDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>City Chat</Text>
        <Text style={styles.headerSubtitle}>
          {roomCity ? `Live room: ${roomCity}` : 'Connect to your city feed'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f04c3e" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isOwnMessage = item.userId === currentUserId;

              return (
                <View
                  style={[
                    styles.messageRow,
                    isOwnMessage ? styles.messageRowOwn : styles.messageRowOther,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageAuthor,
                        isOwnMessage
                          ? styles.messageAuthorOwn
                          : styles.messageAuthorOther,
                      ]}
                    >
                      {isOwnMessage ? 'You' : item.userName}
                    </Text>
                    <Text
                      style={[
                        styles.messageText,
                        isOwnMessage ? styles.messageTextOwn : styles.messageTextOther,
                      ]}
                    >
                      {item.message}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isOwnMessage ? styles.messageTimeOwn : styles.messageTimeOther,
                      ]}
                    >
                      {formatTimestamp(item.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>
                  No messages yet. Start the room with the first message.
                </Text>
              </View>
            }
          />

          <View style={styles.composer}>
            <View style={styles.composerMeta}>
              <Text style={styles.composerStatus}>
                {socketReady ? 'Connected' : 'Connecting'}
              </Text>
              <Text style={styles.composerCity}>{roomCity}</Text>
            </View>
            <View style={styles.composerRow}>
              <TextInput
                style={styles.input}
                value={messageDraft}
                onChangeText={setMessageDraft}
                placeholder="Say something to the room"
                placeholderTextColor="#9b8f89"
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!messageDraft.trim() || !socketReady) && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!messageDraft.trim() || !socketReady}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
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
    marginTop: 6,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBubbleOwn: {
    backgroundColor: '#f04c3e',
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f2dfd8',
    borderBottomLeftRadius: 6,
  },
  messageAuthor: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  messageAuthorOwn: {
    color: 'rgba(255,255,255,0.82)',
  },
  messageAuthorOther: {
    color: '#d45443',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextOwn: {
    color: '#ffffff',
  },
  messageTextOther: {
    color: '#2d2522',
  },
  messageTime: {
    marginTop: 8,
    fontSize: 11,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.72)',
  },
  messageTimeOther: {
    color: '#8d8079',
  },
  emptyText: {
    color: '#6a615d',
    fontSize: 15,
    textAlign: 'center',
  },
  errorText: {
    color: '#b02b2b',
    fontSize: 15,
    textAlign: 'center',
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: '#f2dfd8',
    backgroundColor: '#fff4ef',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  composerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  composerStatus: {
    color: '#d45443',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  composerCity: {
    color: '#7d6f68',
    fontSize: 12,
    fontWeight: '600',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#edd8cf',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#2d2522',
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#f04c3e',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ChatScreen;
