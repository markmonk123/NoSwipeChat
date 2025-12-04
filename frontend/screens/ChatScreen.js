import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [city, setCity] = useState('');
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userCity = await AsyncStorage.getItem('userCity');
        const uid = await AsyncStorage.getItem('userId');

        setCity(userCity || 'Unknown');
        setUserId(uid);

        const newSocket = io('http://localhost:5000', {
          auth: { token },
        });

        newSocket.on('connect', () => {
          console.log('Connected to chat server');
          newSocket.emit('join-room', {
            userId: uid,
            city: userCity,
            latitude: 0,
            longitude: 0,
          });
        });

        newSocket.on('receive-message', (data) => {
          setMessages((prev) => [data, ...prev]);
        });

        setSocket(newSocket);
        setLoading(false);
      } catch (error) {
        console.error('Socket setup error:', error);
        setLoading(false);
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const sendMessage = () => {
    if (inputText.trim() && socket) {
      socket.emit('send-message', {
        userId,
        city,
        message: inputText,
      });
      setInputText('');
    }
  };

  const renderMessage = ({ item }) => (
    <View style={styles.messageContainer}>
      <Text style={styles.messageUser}>{item.userId || 'Anonymous'}</Text>
      <Text style={styles.messageText}>{item.message}</Text>
      <Text style={styles.messageTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.headerContainer}>
        <Text style={styles.headerCity}>{city} Chat Room</Text>
        <Text style={styles.headerSubtitle}>Free chat with verified singles</Text>
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => index.toString()}
        inverted
        contentContainerStyle={styles.messagesContainer}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerContainer: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  headerCity: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  messagesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  messageContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
  },
  messageUser: {
    fontWeight: 'bold',
    color: '#FF6B6B',
    fontSize: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    marginVertical: 5,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default ChatScreen;
