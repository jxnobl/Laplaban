import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 95;

const ABS_MIN_AGE = 18;
const ABS_MAX_AGE = 60;
const MIN_GAP = 3;

interface Profile {
  id: string;
  full_name: string;
  age?: number | null;
  height?: string | null;
  fitness_mode: string;
  pace: string;
  city: string;
  workout_time?: string | null;
  workout_frequency?: string | null;
  bio: string;
  photos?: string[];
  latitude: number | null;
  longitude: number | null;
}

interface FinderDeckProps {
  currentUserId: string;
}

const MODES = [
  { key: 'All', label: 'ALL MODES' },
  { key: 'WalkerFinder', label: 'WALKER' },
  { key: 'RunnerFinder', label: 'RUNNER' },
  { key: 'BikerFinder', label: 'BIKER' },
  { key: 'GymFinder', label: 'GYM' },
];

const APPLE_FONT =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"
    : undefined;

export default function FinderDeck({ currentUserId }: FinderDeckProps) {
  const [rawProfiles, setRawProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState('All');

  // Dual-Handle Range State (with strict 3-yr gap)
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(35);

  const [allowExpandAge, setAllowExpandAge] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isExpandedActive, setIsExpandedActive] = useState(false);

  // Animations
  const position = useRef(new Animated.ValueXY()).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;
  const drawerHeight = useRef(new Animated.Value(0)).current;
  const toggleAnim = useRef(new Animated.Value(allowExpandAge ? 1 : 0)).current;

  const calculateDistance = (lat1?: number | null, lon1?: number | null) => {
    if (!lat1 || !lon1) return 'METRO MANILA';
    const userLat = 14.6537;
    const userLon = 121.0685;
    const R = 6371;
    const dLat = ((lat1 - userLat) * Math.PI) / 180;
    const dLon = ((lon1 - userLon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLat * Math.PI) / 180) *
        Math.cos((lat1 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return `${(R * c).toFixed(1)} KM PROXIMITY`;
  };

  const fetchCandidates = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').neq('id', currentUserId);

    if (activeFilter !== 'All') {
      query = query.eq('fitness_mode', activeFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRawProfiles(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCandidates();
  }, [activeFilter]);

  // Dual-Handle Age Range Filtering with Fallback Logic
  useEffect(() => {
    if (rawProfiles.length === 0) {
      setFilteredProfiles([]);
      setIsExpandedActive(false);
      return;
    }

    const exactMatches = rawProfiles.filter((p) => {
      if (p.age == null) return false;
      return p.age >= minAge && p.age <= maxAge;
    });

    if (exactMatches.length > 0) {
      setFilteredProfiles(exactMatches);
      setIsExpandedActive(false);
    } else if (allowExpandAge) {
      const expandedMatches = rawProfiles.filter((p) => {
        if (p.age == null) return false;
        return p.age >= Math.max(18, minAge - 5) && p.age <= maxAge + 5;
      });

      if (expandedMatches.length > 0) {
        setFilteredProfiles(expandedMatches);
        setIsExpandedActive(true);
      } else {
        setFilteredProfiles(rawProfiles);
        setIsExpandedActive(true);
      }
    } else {
      setFilteredProfiles([]);
      setIsExpandedActive(false);
    }

    setCurrentIndex(0);
    setPhotoIndex(0);
    nextCardScale.setValue(0.95);
  }, [rawProfiles, minAge, maxAge, allowExpandAge]);

  // Drawer Animation
  const toggleDrawer = () => {
    const toValue = filterDrawerOpen ? 0 : 1;
    setFilterDrawerOpen(!filterDrawerOpen);
    Animated.spring(drawerHeight, {
      toValue,
      friction: 8,
      tension: 45,
      useNativeDriver: false,
    }).start();
  };

  const toggleExpandAgeSwitch = () => {
    const nextVal = !allowExpandAge;
    setAllowExpandAge(nextVal);
    Animated.spring(toggleAnim, {
      toValue: nextVal ? 1 : 0,
      friction: 6,
      tension: 60,
      useNativeDriver: false,
    }).start();
  };

  const handleMinSliderChange = (newVal: number) => {
    if (newVal + MIN_GAP <= maxAge) {
      setMinAge(newVal);
    } else {
      setMinAge(maxAge - MIN_GAP);
    }
  };

  const handleMaxSliderChange = (newVal: number) => {
    if (newVal - MIN_GAP >= minAge) {
      setMaxAge(newVal);
    } else {
      setMaxAge(minAge + MIN_GAP);
    }
  };

  const applyPreset = (min: number, max: number) => {
    setMinAge(min);
    setMaxAge(max);
  };

  const forceSwipe = (direction: 'right' | 'left') => {
    const x = direction === 'right' ? SCREEN_WIDTH + 140 : -SCREEN_WIDTH - 140;
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x, y: 0 },
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.spring(nextCardScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: false,
      }),
    ]).start(() => onSwipeComplete(direction === 'right'));
  };

  const onSwipeComplete = async (isLiked: boolean) => {
    const candidate = filteredProfiles[currentIndex];
    position.setValue({ x: 0, y: 0 });
    nextCardScale.setValue(0.95);
    setPhotoIndex(0);

    if (candidate) {
      await supabase.from('matches').upsert([
        {
          swiper_id: currentUserId,
          swiped_id: candidate.id,
          is_liked: isLiked,
        },
      ]);
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        const progress = Math.min(Math.abs(gesture.dx) / SWIPE_THRESHOLD, 1);
        nextCardScale.setValue(0.95 + progress * 0.05);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 4,
            useNativeDriver: false,
          }).start();
          Animated.spring(nextCardScale, {
            toValue: 0.95,
            friction: 4,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-18deg', '0deg', '18deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [20, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-80, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const toggleTranslateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const toggleBgColor = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.1)', '#FF3B30'],
  });

  const drawerHeightInterpolated = drawerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  });

  const minPercent = ((minAge - ABS_MIN_AGE) / (ABS_MAX_AGE - ABS_MIN_AGE)) * 100;
  const maxPercent = ((maxAge - ABS_MIN_AGE) / (ABS_MAX_AGE - ABS_MIN_AGE)) * 100;

  const candidate = filteredProfiles[currentIndex];
  const nextCandidate = filteredProfiles[currentIndex + 1];

  const candidatePhotos =
    candidate?.photos && candidate.photos.length > 0
      ? candidate.photos
      : ['https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop'];

  return (
    <View style={styles.container}>
      {/* Filter Tabs & Age Pill Trigger */}
      <View style={styles.topControlRow}>
        <View style={styles.glassFilterBar}>
          {MODES.map((mode) => {
            const isActive = activeFilter === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[styles.filterSegment, isActive && styles.filterSegmentActive]}
                onPress={() => setActiveFilter(mode.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.ageDrawerBtn, filterDrawerOpen && styles.ageDrawerBtnActive]}
          onPress={toggleDrawer}
          activeOpacity={0.75}
        >
          <Text style={styles.ageDrawerIcon}>⚡</Text>
          <Text style={styles.ageDrawerLabel}>
            {minAge}–{maxAge >= ABS_MAX_AGE ? '60+' : maxAge}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Animated Age Filter Drawer */}
      <Animated.View style={[styles.drawerContainer, { maxHeight: drawerHeightInterpolated }]}>
        <View style={styles.drawerInner}>
          <View style={styles.sliderHeaderRow}>
            <Text style={styles.drawerHeading}>DISCOVERY AGE RANGE</Text>
            <View style={styles.sliderValBadge}>
              <Text style={styles.sliderValText}>
                {minAge} – {maxAge >= ABS_MAX_AGE ? '60+' : maxAge} YRS
              </Text>
            </View>
          </View>

          {/* Quick Preset Buttons */}
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(18, 24)}>
              <Text style={styles.presetChipText}>18–24</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(22, 28)}>
              <Text style={styles.presetChipText}>22–28</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(26, 35)}>
              <Text style={styles.presetChipText}>26–35</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(18, 60)}>
              <Text style={styles.presetChipText}>All (18–60+)</Text>
            </TouchableOpacity>
          </View>

          {/* Range Sliders */}
          <View style={styles.sliderBox}>
            <View style={styles.trackBackground}>
              <View
                style={[
                  styles.trackHighlight,
                  {
                    left: `${minPercent}%`,
                    width: `${Math.max(0, maxPercent - minPercent)}%`,
                  },
                ]}
              />
            </View>

            {/* Slider 1: MINIMUM AGE */}
            <View style={styles.individualSliderRow}>
              <Text style={styles.handleLabel}>MINIMUM: {minAge} YRS</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="range"
                  min={ABS_MIN_AGE}
                  max={ABS_MAX_AGE - MIN_GAP}
                  value={minAge}
                  onChange={(e) => handleMinSliderChange(Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#FF3B30',
                    cursor: 'pointer',
                    height: 20,
                  } as any}
                />
              ) : null}
            </View>

            {/* Slider 2: MAXIMUM AGE */}
            <View style={styles.individualSliderRow}>
              <Text style={styles.handleLabel}>
                MAXIMUM: {maxAge >= ABS_MAX_AGE ? '60+' : maxAge} YRS
              </Text>
              {Platform.OS === 'web' ? (
                <input
                  type="range"
                  min={ABS_MIN_AGE + MIN_GAP}
                  max={ABS_MAX_AGE}
                  value={maxAge}
                  onChange={(e) => handleMaxSliderChange(Number(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#00F0FF',
                    cursor: 'pointer',
                    height: 20,
                  } as any}
                />
              ) : null}
            </View>
          </View>

          {/* Auto-Expand Animated Toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Auto-Expand If No Matches</Text>
              <Text style={styles.toggleSub}>
                Expands range smoothly so your training radar is never empty
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleExpandAgeSwitch}
              activeOpacity={0.8}
              style={styles.switchTouchTarget}
            >
              <Animated.View style={[styles.switchTrack, { backgroundColor: toggleBgColor }]}>
                <Animated.View
                  style={[
                    styles.switchThumb,
                    { transform: [{ translateX: toggleTranslateX }] },
                  ]}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Expanded Range Notice Pill */}
      {isExpandedActive && (
        <View style={styles.expandedNoticePill}>
          <Text style={styles.expandedNoticeDot}>•</Text>
          <Text style={styles.expandedNoticeText}>
            EXPANDED RADAR: Showing active athletes closest to {minAge}–{maxAge} yrs
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#FF3B30" />
          <Text style={styles.radarText}>CALIBRATING LOCAL RADAR...</Text>
        </View>
      ) : candidate ? (
        <View style={styles.deckViewport}>
          {/* Peeking Background Card */}
          {nextCandidate && (
            <Animated.View
              style={[
                styles.underlyingGlassCard,
                { transform: [{ scale: nextCardScale }] },
              ]}
            >
              <View style={styles.underlyingCardPhotoPlaceholder} />
            </Animated.View>
          )}

          {/* Active Top Draggable Glass Card */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.glassCard,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ],
              },
            ]}
          >
            {/* Holographic Glowing Stamps */}
            <Animated.View style={[styles.stampPill, styles.likeStamp, { opacity: likeOpacity }]}>
              <Text style={styles.likeStampText}>LAP MATCH 🔥</Text>
            </Animated.View>

            <Animated.View style={[styles.stampPill, styles.passStamp, { opacity: passOpacity }]}>
              <Text style={styles.passStampText}>PASS ✖</Text>
            </Animated.View>

            {/* Edge-to-Edge 4:5 Portrait Viewport */}
            <View style={styles.showcasePhotoViewport}>
              <Image
                source={{ uri: candidatePhotos[photoIndex] || candidatePhotos[0] }}
                style={styles.showcaseMainPhoto}
              />
              <View style={styles.vignetteOverlay} />

              {/* Multi-Photo Carousel Story Bars (Top) */}
              {candidatePhotos.length > 1 && (
                <View style={styles.photoDotsRow}>
                  {candidatePhotos.map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.photoDot,
                        i === photoIndex && styles.photoDotActive,
                      ]}
                      onPress={() => setPhotoIndex(i)}
                      activeOpacity={0.8}
                    />
                  ))}
                </View>
              )}

              {/* Left / Right Interactive Tap Zones */}
              {candidatePhotos.length > 1 && (
                <View style={styles.tapHitboxLayer}>
                  <TouchableOpacity
                    style={styles.tapSide}
                    activeOpacity={1}
                    onPress={() =>
                      setPhotoIndex((prev) =>
                        prev > 0 ? prev - 1 : candidatePhotos.length - 1
                      )
                    }
                  />
                  <TouchableOpacity
                    style={styles.tapSide}
                    activeOpacity={1}
                    onPress={() =>
                      setPhotoIndex((prev) =>
                        prev < candidatePhotos.length - 1 ? prev + 1 : 0
                      )
                    }
                  />
                </View>
              )}

              {/* Mode, Proximity & Age HUD Overlay */}
              <View style={styles.hudOverlay}>
                <View style={styles.hudTopBadges}>
                  <View style={styles.glassBadgeNeon}>
                    <Text style={styles.badgeNeonText}>
                      {candidate.fitness_mode.replace('Finder', '').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.glassBadgeMuted}>
                    <Text style={styles.badgeMutedText}>
                      {calculateDistance(candidate.latitude, candidate.longitude)}
                    </Text>
                  </View>
                </View>

                {/* Name & Age Title Bar */}
                <View style={styles.hudNameRow}>
                  <Text style={styles.nameText}>{candidate.full_name}</Text>
                  {candidate.age ? (
                    <View style={styles.agePill}>
                      <Text style={styles.agePillText}>{candidate.age} YRS</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.locationCity}>📍 {candidate.city?.toUpperCase() || 'METRO MANILA'}</Text>
              </View>
            </View>

            {/* Glass Profile Details Body */}
            <View style={styles.cardBody}>
              {/* Metric Capsules */}
              <View style={styles.metricsCapsuleRow}>
                <View style={styles.detailCapsule}>
                  <Text style={styles.capsuleLabel}>PACE</Text>
                  <Text style={styles.capsuleValue}>{candidate.pace || 'Adaptive'}</Text>
                </View>
                {candidate.height ? (
                  <View style={styles.detailCapsule}>
                    <Text style={styles.capsuleLabel}>HEIGHT</Text>
                    <Text style={styles.capsuleValue}>{candidate.height}</Text>
                  </View>
                ) : null}
                {candidate.workout_time ? (
                  <View style={styles.detailCapsule}>
                    <Text style={styles.capsuleLabel}>SCHEDULE</Text>
                    <Text style={styles.capsuleValue}>{candidate.workout_time}</Text>
                  </View>
                ) : null}
              </View>

              {/* Bio Card */}
              {candidate.bio ? (
                <View style={styles.bioGlassCard}>
                  <Text style={styles.bioHeading}>TRAINING ETHOS</Text>
                  <Text style={styles.bioContent} numberOfLines={2}>
                    {candidate.bio}
                  </Text>
                </View>
              ) : null}

              {/* Tactile Action Pedestals */}
              <View style={styles.pedestalActionRow}>
                <TouchableOpacity
                  style={[styles.glassPedestal, styles.passBorder]}
                  onPress={() => forceSwipe('left')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passIcon}>✖</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.glassPedestal, styles.matchGlowBorder]}
                  onPress={() => forceSwipe('right')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.matchIcon}>🔥</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.glassEmpty}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>RADAR COMPLETED</Text>
          <Text style={styles.emptySubtitle}>
            No athletes found in the {minAge}–{maxAge} bracket. Adjust your age sliders or tap below to reset the radar.
          </Text>
          <TouchableOpacity
            style={styles.glassActionBtn}
            onPress={() => {
              setMinAge(18);
              setMaxAge(60);
              fetchCandidates();
            }}
          >
            <Text style={styles.actionBtnText}>RESET TO FULL SPECTRUM (18–60+)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  topControlRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginBottom: 10,
  },
  glassFilterBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 3,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  filterSegment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterSegmentActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  filterLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  filterLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  ageDrawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ageDrawerBtnActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  ageDrawerIcon: {
    fontSize: 10,
  },
  ageDrawerLabel: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  drawerContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  drawerInner: {
    backgroundColor: 'rgba(16, 18, 25, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerHeading: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sliderValBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sliderValText: {
    fontFamily: APPLE_FONT,
    color: '#FF4B2B',
    fontSize: 10.5,
    fontWeight: '800',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 2,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  presetChipText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  sliderBox: {
    gap: 6,
    paddingVertical: 4,
  },
  trackBackground: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  trackHighlight: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 3,
  },
  individualSliderRow: {
    gap: 2,
  },
  handleLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9.5,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  toggleTitle: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  toggleSub: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    marginTop: 1,
    lineHeight: 12,
  },
  switchTouchTarget: {
    padding: 4,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  expandedNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 8,
    gap: 6,
  },
  expandedNoticeDot: {
    color: '#00F0FF',
    fontSize: 14,
  },
  expandedNoticeText: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingBox: {
    padding: 50,
    alignItems: 'center',
    gap: 12,
  },
  radarText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  deckViewport: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
  },
  underlyingGlassCard: {
    position: 'absolute',
    top: 10,
    width: '98%',
    borderRadius: 24,
    backgroundColor: 'rgba(16, 18, 25, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    height: 520,
    zIndex: 1,
  },
  underlyingCardPhotoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#050608',
    borderRadius: 20,
  },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(20, 22, 32, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },

  /* SHOWCASE 4:5 PORTRAIT VIEWPORT */
  showcasePhotoViewport: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#050608',
    position: 'relative',
    overflow: 'hidden',
  },
  showcaseMainPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    ...(Platform.OS === 'web' ? { objectPosition: 'center top' } : {}),
  },
  vignetteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  photoDotsRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 6,
    zIndex: 30,
  },
  photoDot: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  photoDotActive: {
    backgroundColor: '#00F0FF',
  },
  tapHitboxLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 20,
  },
  tapSide: {
    flex: 1,
    height: '100%',
  },
  hudOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
    zIndex: 25,
    pointerEvents: 'none',
  },
  hudTopBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  glassBadgeNeon: {
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeNeonText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  glassBadgeMuted: {
    backgroundColor: 'rgba(10, 12, 18, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  badgeMutedText: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hudNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontFamily: APPLE_FONT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#FFFFFF',
  },
  agePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  agePillText: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  locationCity: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  metricsCapsuleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailCapsule: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  capsuleLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  capsuleValue: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  bioGlassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 4,
  },
  bioHeading: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bioContent: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 17,
  },
  pedestalActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    paddingTop: 4,
  },
  glassPedestal: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  passBorder: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  matchGlowBorder: {
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  passIcon: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 18,
    fontWeight: '800',
  },
  matchIcon: {
    fontSize: 22,
  },
  stampPill: {
    position: 'absolute',
    top: 24,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  likeStamp: {
    left: 20,
    borderColor: '#00F0FF',
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    transform: [{ rotate: '-12deg' }],
  },
  passStamp: {
    right: 20,
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    transform: [{ rotate: '12deg' }],
  },
  likeStampText: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  passStampText: {
    fontFamily: APPLE_FONT,
    color: '#FF3B30',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  glassEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 17,
  },
  glassActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  actionBtnText: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
  },
});