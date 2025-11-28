import { sendMessage } from '@/utils/gemini';
import { AlertCircle, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'hey there I am here to support you how are you feeling today',
      role: 'assistant',
      timestamp: 'Just now',
    },
  ]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      role: 'user',
      timestamp: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const chatHistory = messages
        .filter((msg) => msg.id !== '1')
        .map((msg) => ({
          role: msg.role,
          parts: msg.text,
        }));

      const response = await sendMessage(userMessage.text, chatHistory);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        role: 'assistant',
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: error?.message || 'Sorry, something went wrong. Please try again.',
        role: 'assistant',
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Sparkles size={24} color="#8B5CF6" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>AI Companion</Text>
          <Text style={styles.subtitle}>Here to support you</Text>
        </View>
      </View>

      <View style={styles.banner}>
        <AlertCircle size={16} color="#DC2626" />
        <Text style={styles.bannerText}>
          This chat is not a substitute for professional careif you are in crisis please contact emergency services.
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}>
        {messages.map((message) => (
          <View
            key={message.id}
            style={message.role === 'user' ? styles.messageRight : styles.messageLeft}>
            <View
              style={
                message.role === 'user' ? styles.messageBubbleRight : styles.messageBubbleLeft
              }>
              <Text
                style={
                  message.role === 'user' ? styles.messageTextRight : styles.messageTextLeft
                }>
                {message.text}
              </Text>
            </View>
            <Text style={message.role === 'user' ? styles.timestampRight : styles.timestamp}>
              {message.timestamp}
            </Text>
          </View>
        ))}

        {isLoading && (
          <View style={styles.messageLeft}>
            <View style={styles.messageBubbleLeft}>
              <ActivityIndicator size="small" color="#8B5CF6" />
            </View>
          </View>
        )}

        {messages.length === 1 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Try these tools:</Text>
            <TouchableOpacity style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>3-Minute Breathing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>Grounding Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>Talk to a Professional</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor="#9CA3AF"
          multiline
          value={inputText}
          onChangeText={setInputText}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isLoading || !inputText.trim()}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    marginLeft: 8,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  messageLeft: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  messageBubbleLeft: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageTextLeft: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    marginLeft: 8,
  },
  messageRight: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageBubbleRight: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 14,
    maxWidth: '80%',
  },
  messageTextRight: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  timestampRight: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    marginRight: 8,
  },
  suggestionsContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});
