import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface Buddy {
  id: string;
  full_name: string;
  fitness_mode: string;
  pace: string;
  city: string;
  photos?: string[];
}

interface MatchesListProps {
  currentUserId: string;
  onSelectBuddy: (buddy: Buddy) => void;
}

const FONT_STACK =
  Platform.OS === 'web'
    ? "system-ui, -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', Roboto, sans-serif"
    : undefined;

export default function MatchesList({ currentUserId, onSelectBuddy }: MatchesListProps) {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async () => {
    setLoading(true);
    // Find mutual matches
    const { data: myLikes } = await supabase
      .from('matches')
      .select('swiped_id')
      .eq('swiper_id', currentUserId)
      .eq('is_liked', true);

    const swipedIds = (myLikes || []).map((m) => m.swiped_id);

    if (swipedIds.length === 0) {
      setBuddies([]);
      setLoading(false);
      return;
    }

    const { data: mutualLikes } = await supabase
      .from('matches')
      .select('swiper_id')
      .eq('swiped_id', currentUserId)
      .eq('is_liked', true)
      .in('swiper_id', swipedIds);

    const mutualIds = (mutualLikes || []).map((m) => m.swiper_id);

    if (mutualIds.length === 0) {
      setBuddies([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, fitness_mode, pace, city, photos')
      .in('id', mutualIds);

    setBuddies(profiles || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMatches();
  }, [currentUserId]);

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="small" color="#00F0FF" />
        <Text style={styles.loadingText}>SCANNING SYNCHRONIZED CADENCES...</Text>
      </View>
    );
  }

  return (
    <View style={styles.glassContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>INBOX & MATCHES</Text>
          <Text style={styles.subtitle}>ACTIVE WORKOUT COMPANIONS</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{buddies.length}</Text>
        </View>
      </View>

      {buddies.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>◎</Text>
          <Text style={styles.emptyTitle}>NO ACTIVE MUTUAL MATCHES</Text>
          <Text style={styles.emptySub}>
            Swipe right on profiles in DECK to connect with training partners.
          </Text>
        </View>
      ) : (
        <FlatList
          data={buddies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const avatarUrl =
              item.photos && item.photos.length > 0 ? item.photos[0] : null;

            return (
              <TouchableOpacity
                style={styles.buddyCard}
                onPress={() => onSelectBuddy(item)}
                activeOpacity={0.7}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {item.full_name ? item.full_name.charAt(0).toUpperCase() : '⚡'}
                    </Text>
                  </View>
                )}

                <View style={styles.infoCol}>
                  <Text style={styles.nameText}>{item.full_name}</Text>
                  <Text style={styles.metaText}>
                    {item.fitness_mode.toUpperCase()} • {item.pace || 'CADENCE SET'}
                  </Text>
                  <Text style={styles.cityText}>📍 {item.city || 'METRO MANILA'}</Text>
                </View>

                <View style={styles.chatActionIcon}>
                  <Text style={styles.arrowIcon}>→</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    width: '100%',
    backgroundColor: 'rgba(16, 18, 25, 0.65)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    minHeight: 380,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  countText: {
    fontFamily: FONT_STACK,
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '900',
  },
  buddyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    gap: 12,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#050608',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 75, 43, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 43, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FF4B2B',
    fontSize: 18,
    fontWeight: '900',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaText: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cityText: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9,
    fontWeight: '600',
  },
  chatActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.25)',
  },
  emptyTitle: {
    fontFamily: FONT_STACK,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  emptySub: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 15,
  },
  centerBox: {
    backgroundColor: 'rgba(16, 18, 25, 0.65)',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  loadingText: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 10,
  },
});