import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface LapInviteData {
  type: 'lap_invite';
  location: string;
  date: string;
  time: string;
  distance: string;
  targetPace: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  metadata?: LapInviteData | null;
}

interface ChatModalProps {
  currentUserId: string;
  buddy: { id: string; full_name: string };
  onClose: () => void;
}

const FONT_STACK =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"
    : undefined;

const POPULAR_HUBS = [
  'UP Diliman Sunken Garden',
  'BGC Greenway Park',
  'Ayala Triangle Gardens',
  'Mall of Asia Seaside Blvd',
  'Filinvest City Alabang',
];

export default function ChatModal({ currentUserId, buddy, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Invite Form State
  const [inviteLocation, setInviteLocation] = useState(POPULAR_HUBS[0]);
  const [inviteDate, setInviteDate] = useState('Tomorrow');
  const [inviteTime, setInviteTime] = useState('5:30 AM');
  const [inviteDistance, setInviteDistance] = useState('5 KM');
  const [invitePace, setInvitePace] = useState('5:30 min/km');
  const [sendingInvite, setSendingInvite] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${buddy.id}),and(sender_id.eq.${buddy.id},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true });

    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat_${buddy.id}_${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            if (
              (newMsg.sender_id === currentUserId && newMsg.receiver_id === buddy.id) ||
              (newMsg.sender_id === buddy.id && newMsg.receiver_id === currentUserId)
            ) {
              setMessages((prev) => [...prev, newMsg]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages((prev) =>
              prev.map((msg) => (msg.id === updatedMsg.id ? updatedMsg : msg))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [buddy.id]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    await supabase.from('messages').insert([
      {
        sender_id: currentUserId,
        receiver_id: buddy.id,
        content: text,
      },
    ]);
  };

  const handleSendInvite = async () => {
    setSendingInvite(true);
    const invitePayload: LapInviteData = {
      type: 'lap_invite',
      location: inviteLocation,
      date: inviteDate,
      time: inviteTime,
      distance: inviteDistance,
      targetPace: invitePace,
      status: 'pending',
    };

    const summaryText = `🏃 LAP PROPOSAL: ${inviteDistance} @ ${inviteLocation} on ${inviteDate} (${inviteTime})`;

    await supabase.from('messages').insert([
      {
        sender_id: currentUserId,
        receiver_id: buddy.id,
        content: summaryText,
        metadata: invitePayload,
      },
    ]);

    setSendingInvite(false);
    setInviteModalVisible(false);
  };

  const handleUpdateInviteStatus = async (
    messageId: string,
    currentMetadata: LapInviteData,
    newStatus: 'accepted' | 'declined'
  ) => {
    const updatedMetadata = { ...currentMetadata, status: newStatus };

    await supabase
      .from('messages')
      .update({ metadata: updatedMetadata })
      .eq('id', messageId);

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, metadata: updatedMetadata } : m))
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.glassContainer}
    >
      {/* Top Chat Header */}
      <View style={styles.header}>
        <View style={styles.buddyInfo}>
          <View style={styles.statusDot} />
          <View>
            <Text style={styles.buddyName}>{buddy.full_name}</Text>
            <Text style={styles.chatStatus}>CONNECTED PARTNER</Text>
          </View>
        </View>

        <View style={styles.headerActionRow}>
          <TouchableOpacity
            style={styles.coordinateBtn}
            onPress={() => setInviteModalVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.coordinateBtnText}>⚡ PLAN LAP</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Message Stream */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#FF3B30" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 14 }}
          renderItem={({ item }) => {
            const isMe = item.sender_id === currentUserId;
            const invite = item.metadata;

            // Render Lap Invite Card
            if (invite && invite.type === 'lap_invite') {
              const isPending = invite.status === 'pending';
              return (
                <View style={[styles.msgRow, isMe ? styles.myRow : styles.theirRow]}>
                  <View style={[styles.inviteCard, isMe ? styles.myInviteCard : styles.theirInviteCard]}>
                    <View style={styles.inviteHeader}>
                      <Text style={styles.inviteTag}>⚡ WORKOUT PROPOSAL</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          invite.status === 'accepted' && styles.statusBadgeAccepted,
                          invite.status === 'declined' && styles.statusBadgeDeclined,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            invite.status === 'accepted' && styles.statusBadgeTextAccepted,
                            invite.status === 'declined' && styles.statusBadgeTextDeclined,
                          ]}
                        >
                          {invite.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.inviteLocationText}>📍 {invite.location}</Text>

                    <View style={styles.inviteDetailsGrid}>
                      <View style={styles.inviteDetailCol}>
                        <Text style={styles.inviteDetailLabel}>WHEN</Text>
                        <Text style={styles.inviteDetailVal}>
                          {invite.date} • {invite.time}
                        </Text>
                      </View>
                      <View style={styles.inviteDetailCol}>
                        <Text style={styles.inviteDetailLabel}>GOAL</Text>
                        <Text style={styles.inviteDetailVal}>
                          {invite.distance} ({invite.targetPace})
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons for receiver */}
                    {!isMe && isPending && (
                      <View style={styles.inviteActionRow}>
                        <TouchableOpacity
                          style={[styles.inviteBtn, styles.declineBtn]}
                          onPress={() => handleUpdateInviteStatus(item.id, invite, 'declined')}
                        >
                          <Text style={styles.declineBtnText}>Pass</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.inviteBtn, styles.acceptBtn]}
                          onPress={() => handleUpdateInviteStatus(item.id, invite, 'accepted')}
                        >
                          <Text style={styles.acceptBtnText}>Accept Lap 🔥</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            }

            // Normal text message
            return (
              <View style={[styles.msgRow, isMe ? styles.myRow : styles.theirRow]}>
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                  <Text style={[styles.msgText, isMe && styles.myMsgText]}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Message partner..."
          placeholderTextColor="rgba(255, 255, 255, 0.25)"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
          <Text style={styles.sendBtnText}>SEND</Text>
        </TouchableOpacity>
      </View>

      {/* Coordinate Lap Setup Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalGlassCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coordinate Next Lap</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionLabel}>MEETUP SPOT</Text>
            <View style={styles.chipsContainer}>
              {POPULAR_HUBS.map((hub) => (
                <TouchableOpacity
                  key={hub}
                  style={[styles.hubChip, inviteLocation === hub && styles.hubChipActive]}
                  onPress={() => setInviteLocation(hub)}
                >
                  <Text style={[styles.hubChipText, inviteLocation === hub && styles.hubChipTextActive]}>
                    {hub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGridRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalSectionLabel}>DAY</Text>
                <TextInput
                  style={styles.modalInput}
                  value={inviteDate}
                  onChangeText={setInviteDate}
                  placeholder="e.g. Saturday"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSectionLabel}>TIME</Text>
                <TextInput
                  style={styles.modalInput}
                  value={inviteTime}
                  onChangeText={setInviteTime}
                  placeholder="e.g. 6:00 AM"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.inputGridRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalSectionLabel}>TARGET DISTANCE</Text>
                <TextInput
                  style={styles.modalInput}
                  value={inviteDistance}
                  onChangeText={setInviteDistance}
                  placeholder="e.g. 5 KM"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSectionLabel}>PACE</Text>
                <TextInput
                  style={styles.modalInput}
                  value={invitePace}
                  onChangeText={setInvitePace}
                  placeholder="e.g. 5:45 min/km"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, sendingInvite && { opacity: 0.6 }]}
              onPress={handleSendInvite}
              disabled={sendingInvite}
              activeOpacity={0.8}
            >
              {sendingInvite ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Send Workout Proposal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    width: '100%',
    backgroundColor: 'rgba(16, 18, 25, 0.65)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 540,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buddyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F0FF',
  },
  buddyName: {
    fontFamily: FONT_STACK,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  chatStatus: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordinateBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  coordinateBtnText: {
    fontFamily: FONT_STACK,
    color: '#FF4B2B',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
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
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgRow: {
    paddingHorizontal: 16,
    marginVertical: 4,
    flexDirection: 'row',
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  myBubble: {
    backgroundColor: '#FF3B30',
  },
  theirBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  msgText: {
    fontFamily: FONT_STACK,
    color: '#FFFFFF',
    fontSize: 12.5,
    lineHeight: 18,
  },
  myMsgText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  inviteCard: {
    width: '100%',
    maxWidth: 290,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  myInviteCard: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  theirInviteCard: {
    backgroundColor: 'rgba(16, 20, 28, 0.8)',
    borderColor: 'rgba(0, 240, 255, 0.3)',
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteTag: {
    fontFamily: FONT_STACK,
    color: '#FF4B2B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusBadgeAccepted: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusBadgeDeclined: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  statusBadgeText: {
    fontFamily: FONT_STACK,
    fontSize: 8.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statusBadgeTextAccepted: {
    color: '#34C759',
  },
  statusBadgeTextDeclined: {
    color: '#FF3B30',
  },
  inviteLocationText: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inviteDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 8,
    borderRadius: 10,
  },
  inviteDetailCol: {
    gap: 2,
  },
  inviteDetailLabel: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8,
    fontWeight: '700',
  },
  inviteDetailVal: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 10.5,
    fontWeight: '600',
  },
  inviteActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inviteBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  declineBtnText: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  acceptBtn: {
    backgroundColor: '#FF3B30',
  },
  acceptBtnText: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  input: {
    fontFamily: FONT_STACK,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
  },
  sendBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendBtnText: {
    fontFamily: FONT_STACK,
    color: '#00F0FF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.5,
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)' } : {}),
  },
  modalGlassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(22, 24, 32, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSectionLabel: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hubChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  hubChipActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  hubChipText: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  hubChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  inputGridRow: {
    flexDirection: 'row',
  },
  modalInput: {
    fontFamily: FONT_STACK,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 12,
  },
  modalSubmitBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSubmitBtnText: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});