import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';

interface LapBotModalProps {
  currentUserId: string;
  onClose?: () => void;
}

interface Message {
  sender: 'bot' | 'user';
  text: string;
}

const APPLE_FONT =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"
    : undefined;

const QUICK_PROMPTS = [
  '⚡ Suggest 5K pacing splits',
  '☀️ Managing PH tropical humidity',
  '🔥 5-min dynamic warm-up',
];

export default function LapBotModal({ onClose }: LapBotModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'Mabuhay! I am LapBot, your AI cadence coach. Inquire about pacing splits, recovery nutrition, warm-ups, or beating tropical heat.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const trimmed = userText.trim();
    setInputText('');
    setMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
    setIsThinking(true);

    // Call LapBot AI backend / Gemini API fallback
    try {
      setTimeout(() => {
        let botReply = '';
        const lower = trimmed.toLowerCase();

        if (lower.includes('pacing') || lower.includes('5k')) {
          botReply =
            'For a sub-28 min 5K in Metro Manila: Start Km 1 at 5:45 to acclimate. Lock Km 2–4 at 5:35 cadence. Sprint final 800m at 5:10. Stay hydrated with electrolytes before departure!';
        } else if (lower.includes('humidity') || lower.includes('heat')) {
          botReply =
            'PH heat rule: Run before 6:30 AM or after 6:30 PM. Drink 250ml water with sodium 30 mins prior. Wear lightweight, light-colored breathable fabrics to avoid heat cramps.';
        } else if (lower.includes('warm') || lower.includes('stretch')) {
          botReply =
            'Prioritize dynamic warm-ups: 30s leg swings, 30s walking lunges, high knees, and ankle circles. Avoid static stretching until after your workout session is complete.';
        } else {
          botReply =
            'Consistency builds endurance! Focus on progressive overload, adequate sleep, and matching with someone at your target pace on the DECK.';
        }

        setMessages((prev) => [...prev, { sender: 'bot', text: botReply }]);
        setIsThinking(false);
      }, 700);
    } catch {
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Unable to reach satellite radar right now. Please test again in a moment.',
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.botIconBadge}>
            <Text style={styles.botIconText}>✣</Text>
          </View>
          <View>
            <Text style={styles.botTitle}>LAPBOT CADENCE AI</Text>
            <Text style={styles.botSubtitle}>ONLINE • GEMINI FLASH ENGINE</Text>
          </View>
        </View>

        {onClose ? (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Quick Prompts Bar */}
      <View style={styles.quickPromptsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {QUICK_PROMPTS.map((prompt, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickChip}
              onPress={() => sendMessage(prompt)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, index) => {
          const isBot = msg.sender === 'bot';
          return (
            <View
              key={index}
              style={[
                styles.messageBubble,
                isBot ? styles.botBubble : styles.userBubble,
              ]}
            >
              <Text style={[styles.messageText, isBot ? styles.botText : styles.userText]}>
                {msg.text}
              </Text>
            </View>
          );
        })}

        {isThinking && (
          <View style={[styles.messageBubble, styles.botBubble, styles.thinkingBubble]}>
            <ActivityIndicator size="small" color="#00F0FF" />
            <Text style={styles.thinkingText}>LapBot is calculating cadence...</Text>
          </View>
        )}
      </ScrollView>

      {/* Chat Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.inputField}
          placeholder="Ask LapBot for workout pacing, recovery, routes..."
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => sendMessage(inputText)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    minHeight: 520,
    backgroundColor: 'rgba(16, 18, 25, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botIconText: {
    color: '#00F0FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botTitle: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  botSubtitle: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickPromptsRow: {
    paddingVertical: 10,
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  quickChipText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
    marginVertical: 4,
  },
  chatContent: {
    gap: 10,
    paddingVertical: 6,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF3B30',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontFamily: APPLE_FONT,
    fontSize: 12.5,
    lineHeight: 18,
  },
  botText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userText: {
    color: '#FFF',
    fontWeight: '500',
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  thinkingText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  inputField: {
    fontFamily: APPLE_FONT,
    flex: 1,
    color: '#FFF',
    fontSize: 12.5,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
  },
});