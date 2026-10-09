import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../lib/supabase';

const SYSTEM_FONT =
  Platform.OS === 'ios'
    ? 'SF Pro Display'
    : Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
    : undefined;

interface LatLng {
  latitude: number;
  longitude: number;
}

interface ActivitySnapshot {
  sport_type?: string;
  distance_km?: number;
  duration_seconds?: number;
  avg_pace?: string;
  calories?: number;
  route_coords?: LatLng[];
}

interface Post {
  id: string;
  user_id: string;
  author_name?: string;
  title: string;
  content: string;
  category?: string;
  created_at: string;
  collaborator_names?: string[];
  activity_snapshot?: ActivitySnapshot;
}

const CATEGORIES = ['ALL', 'RUN', 'RIDE', 'WALK', 'WORKOUT', 'GENERAL'];

export default function CommunityForum({ currentUserId }: { currentUserId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [newPostModal, setNewPostModal] = useState(false);

  // New Post Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPosts(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const filteredPosts = posts.filter((p) => {
    if (selectedCategory === 'ALL') return true;
    const cat = (p.category || 'GENERAL').toUpperCase();
    if (selectedCategory === 'WORKOUT') {
      return cat === 'WORKOUT' || cat === 'RUN' || cat === 'RIDE' || cat === 'WALK' || !!p.activity_snapshot;
    }
    return cat === selectedCategory;
  });

  const handleCreatePost = async () => {
    if (!title.trim() || !content.trim()) {
      const msg = 'Please enter both a title and description.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Required', msg);
      return;
    }

    setPosting(true);
    try {
      let author = 'Athlete';
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUserId)
          .maybeSingle();
        if (prof?.full_name) author = prof.full_name;
      } catch {
        // Fallback
      }

      const newPayload = {
        user_id: currentUserId,
        author_name: author,
        title: title.trim(),
        content: content.trim(),
        category: selectedCategory === 'ALL' ? 'GENERAL' : selectedCategory,
      };

      const { data, error } = await supabase
        .from('community_posts')
        .insert(newPayload)
        .select()
        .single();

      if (!error && data) {
        setPosts((prev) => [data, ...prev]);
        setTitle('');
        setContent('');
        setNewPostModal(false);
      } else {
        const errMessage = error?.message || 'Could not post to community.';
        Platform.OS === 'web' ? window.alert(errMessage) : Alert.alert('Error', errMessage);
      }
    } catch (err: any) {
      const errMessage = err.message || 'Error creating post.';
      Platform.OS === 'web' ? window.alert(errMessage) : Alert.alert('Error', errMessage);
    } finally {
      setPosting(false);
    }
  };

  const formatDuration = (totalSec?: number) => {
    const s = totalSec || 0;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  return (
    <View style={styles.container}>
      {/* FUTURISTIC HEADER */}
      <View style={styles.headerBlock}>
        <View style={styles.topHudLine}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={styles.sectionKicker}>COMMUNITY RADAR</Text>
          </View>

          <View style={styles.actionsCluster}>
            <TouchableOpacity
              style={styles.minimalGlassBtn}
              onPress={fetchPosts}
              activeOpacity={0.7}
            >
              <Text style={styles.refreshIcon}>⟳</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.minimalGlassBtn, styles.createGlassBtn]}
              onPress={() => setNewPostModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.createBtnPlus}>+</Text>
              <Text style={styles.createBtnLabel}>POST</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Community Feed & Analytics</Text>
        <Text style={styles.sectionSub}>
          Live activity traces, partner workout collaborations, and DOH wellness goals.
        </Text>
      </View>

      {/* DOH COMMUNITY ANALYTICS & LEADERS (Wireframe 10.5) */}
      <View style={styles.dohAnalyticsCard}>
        <Text style={styles.analyticsTitle}>COMMUNITY LEADERS THIS MONTH</Text>
        <View style={styles.leaderList}>
          {[
            '1. Edmarc Justin Oabel — 142.4 KM',
            '2. Jabez C. Molar — 118.2 KM',
            '3. Kyle Arboleda — 94.0 KM',
            '4. Bea Valenzuela — 78.5 KM',
          ].map((leader, i) => (
            <View key={i} style={styles.leaderRow}>
              <Text style={styles.leaderText}>{leader}</Text>
            </View>
          ))}
        </View>

        <View style={styles.goalTrackerBlock}>
          <Text style={styles.goalTrackerTitle}>MONTHLY DOH GOAL TRACKER</Text>
          <Text style={styles.goalProgressLabel}>
            Community Target: 5,000 KM • Progress: [=======> ] 74%
          </Text>
          <View style={styles.goalProgressBarBg}>
            <View style={[styles.goalProgressBarFill, { width: '74%' }]} />
          </View>
        </View>
      </View>

      {/* CATEGORY SELECTOR */}
      <View style={styles.categoryRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* POSTS LIST */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#00F0FF" size="large" />
        </View>
      ) : filteredPosts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NO POSTS FOUND</Text>
          <Text style={styles.emptySub}>
            No workouts or discussions in {selectedCategory}. Tap + POST to start a conversation or share a workout from the Track tab.
          </Text>
        </View>
      ) : (
        <View style={styles.postsList}>
          {filteredPosts.map((post) => {
            const snapshot = post.activity_snapshot;
            const coords = snapshot?.route_coords || [];
            const hasRoute = Array.isArray(coords) && coords.length > 1;

            return (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.authorBadge}>
                    <View style={styles.avatarGlowDot} />
                    <Text style={styles.authorName}>{post.author_name || 'Athlete'}</Text>
                  </View>

                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {(post.category || 'WORKOUT').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Tagged Collaborator Banner */}
                {post.collaborator_names && post.collaborator_names.length > 0 && (
                  <View style={styles.collaboratorBanner}>
                    <Text style={styles.collaboratorBolt}>⚡</Text>
                    <Text style={styles.collaboratorBannerText}>
                      Worked out with {post.collaborator_names.join(', ')}
                    </Text>
                  </View>
                )}

                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent}>{post.content}</Text>

                {/* SHARED WORKOUT CARD WITH INTEGRATED ROUTE MAP */}
                {snapshot && (
                  <View style={styles.activityHudCard}>
                    <View style={styles.hudTopLine}>
                      <View style={styles.hudSportBadge}>
                        <Text style={styles.hudSportText}>
                          {(snapshot.sport_type || 'WORKOUT').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.hudDistance}>
                        {Number(snapshot.distance_km || 0).toFixed(2)}{' '}
                        <Text style={styles.hudDistanceUnit}>KM</Text>
                      </Text>
                    </View>

                    {/* INTERACTIVE ROUTE MAP TRACE */}
                    {hasRoute ? (
                      <View style={styles.mapPreviewWrapper}>
                        <MapView
                          provider={PROVIDER_DEFAULT}
                          style={styles.postMap}
                          userInterfaceStyle="dark"
                          scrollEnabled={false}
                          zoomEnabled={false}
                          pitchEnabled={false}
                          rotateEnabled={false}
                          initialRegion={{
                            latitude: coords[0].latitude,
                            longitude: coords[0].longitude,
                            latitudeDelta: 0.012,
                            longitudeDelta: 0.012,
                          }}
                        >
                          <Polyline
                            coordinates={coords}
                            strokeColor="#FC5200"
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                          />
                          <Marker coordinate={coords[0]}>
                            <View style={styles.mapPointStart}>
                              <Text style={styles.mapPointText}>S</Text>
                            </View>
                          </Marker>
                          <Marker coordinate={coords[coords.length - 1]}>
                            <View style={styles.mapPointEnd}>
                              <Text style={styles.mapPointText}>F</Text>
                            </View>
                          </Marker>
                        </MapView>
                        <View style={styles.mapOverlayPill}>
                          <Text style={styles.mapOverlayPillText}>📍 GPS TRACE VERIFIED</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Metrics Grid */}
                    <View style={styles.hudStatsGrid}>
                      <View style={styles.hudStatCell}>
                        <Text style={styles.hudStatValue}>
                          {formatDuration(snapshot.duration_seconds)}
                        </Text>
                        <Text style={styles.hudStatLabel}>DURATION</Text>
                      </View>

                      <View style={styles.hudStatCell}>
                        <Text style={styles.hudStatValue}>{snapshot.avg_pace || '-:--'}</Text>
                        <Text style={styles.hudStatLabel}>PACE / KM</Text>
                      </View>

                      <View style={styles.hudStatCell}>
                        <Text style={styles.hudStatValue}>{snapshot.calories || 0}</Text>
                        <Text style={styles.hudStatLabel}>CALORIES</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.postFooter}>
                  <Text style={styles.timestampText}>
                    {post.created_at
                      ? new Date(post.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* CREATE POST MODAL */}
      <Modal
        visible={newPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNewPostModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalGlassCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CREATE A POST</Text>
              <TouchableOpacity onPress={() => setNewPostModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>TITLE</Text>
              <TextInput
                style={styles.modalInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Morning 5K in BGC or Spotter check"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>WHAT'S ON YOUR MIND?</Text>
              <TextInput
                style={[styles.modalInput, styles.modalBioInput]}
                value={content}
                onChangeText={setContent}
                placeholder="Share your running tips, workout route, or ask for a buddy..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitDispatchBtn, posting && { opacity: 0.6 }]}
              onPress={handleCreatePost}
              disabled={posting}
              activeOpacity={0.8}
            >
              {posting ? (
                <ActivityIndicator color="#030812" size="small" />
              ) : (
                <Text style={styles.submitDispatchText}>PUBLISH POST</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 18,
  },
  headerBlock: {
    gap: 6,
    paddingHorizontal: 4,
  },
  topHudLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F0FF',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  sectionKicker: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  actionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  minimalGlassBtn: {
    backgroundColor: 'rgba(16, 22, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: '#00F0FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createGlassBtn: {
    width: 'auto',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
  },
  createBtnPlus: {
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
  },
  createBtnLabel: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  sectionSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    lineHeight: 20,
  },

  /* Wireframe 10.5 DOH Leaders & Target */
  dohAnalyticsCard: {
    backgroundColor: 'rgba(16, 22, 34, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  analyticsTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  leaderList: {
    gap: 6,
  },
  leaderRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  leaderText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  goalTrackerBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    gap: 4,
  },
  goalTrackerTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FC5200',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  goalProgressLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  goalProgressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
  },
  goalProgressBarFill: {
    height: '100%',
    backgroundColor: '#FC5200',
  },

  categoryRow: {
    width: '100%',
  },
  categoryScroll: {
    gap: 8,
    paddingHorizontal: 2,
  },
  categoryPill: {
    backgroundColor: 'rgba(14, 18, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  categoryPillActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.16)',
    borderColor: '#00F0FF',
  },
  categoryText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  categoryTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },
  loadingBox: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: 'rgba(15, 20, 32, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  emptySub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  postsList: {
    gap: 16,
  },
  postCard: {
    backgroundColor: 'rgba(13, 17, 26, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarGlowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F0FF',
  },
  authorName: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  collaboratorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  collaboratorBolt: {
    color: '#00F0FF',
    fontSize: 12,
  },
  collaboratorBannerText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '700',
  },
  postTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  postContent: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  activityHudCard: {
    backgroundColor: 'rgba(252, 82, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(252, 82, 0, 0.3)',
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  hudTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudSportBadge: {
    backgroundColor: '#FC5200',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  hudSportText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  hudDistance: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  hudDistanceUnit: {
    fontSize: 11,
    color: '#FC5200',
    fontWeight: '800',
  },

  /* MINI MAP TRACE */
  mapPreviewWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  postMap: {
    width: '100%',
    height: '100%',
  },
  mapPointStart: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00F0FF',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPointEnd: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FC5200',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPointText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  mapOverlayPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(10, 14, 24, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  mapOverlayPillText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  hudStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  hudStatCell: {
    alignItems: 'center',
  },
  hudStatValue: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  hudStatLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  postFooter: {
    marginTop: 2,
  },
  timestampText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalGlassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(16, 22, 34, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 22,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalField: {
    gap: 6,
  },
  modalFieldLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 12,
    color: '#FFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
  },
  modalBioInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  submitDispatchBtn: {
    backgroundColor: '#00F0FF',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  submitDispatchText: {
    fontFamily: SYSTEM_FONT,
    color: '#030812',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});