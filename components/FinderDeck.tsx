import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 0.28 * SCREEN_WIDTH;

const SYSTEM_FONT =
  Platform.OS === 'ios'
    ? 'SF Pro Display'
    : Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
    : undefined;

interface Profile {
  id: string;
  full_name: string;
  age?: number;
  fitness_mode: string;
  dating_status?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  pace?: string;
  height?: string;
  schedule?: string;
  bio?: string;
  avatar_url?: string;
  photos?: string[];
  distance?: number;
}

const CATEGORIES = [
  { id: 'ALL', label: 'ALL MODES' },
  { id: 'WALK', label: 'WALKER FINDER' },
  { id: 'RUN', label: 'RUNNER FINDER' },
  { id: 'BIKE', label: 'BIKER FINDER' },
  { id: 'GYM', label: 'GYM BUDDY' },
];

// Haversine distance formula in kilometers
function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

export default function FinderDeck({ currentUserId }: { currentUserId: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // GPS Location State
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState(25);

  // Age Filter Range (Minimum 3 years difference enforced)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(32);

  // Consistent useNativeDriver animations (no driver conflict crashes)
  const pan = useRef(new Animated.ValueXY()).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // Track GPS on Mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {
        // Fallback default coordinates (Metro Manila Center)
        setUserCoords({ latitude: 14.5547, longitude: 121.0244 });
      }
    })();
  }, []);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [currentIndex]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*').neq('id', currentUserId);

      if (selectedMode !== 'ALL') {
        const modeMap: Record<string, string> = {
          WALK: 'Walker',
          RUN: 'RunnerFinder',
          BIKE: 'Biker',
          GYM: 'Gym',
        };
        query = query.eq('fitness_mode', modeMap[selectedMode] || selectedMode);
      }

      const { data, error } = await query;
      let matchedList: Profile[] = [];

      if (!error && data && data.length > 0) {
        matchedList = data.map((item: any) => {
          let dist = item.distance ?? 3.5;
          if (userCoords && item.latitude && item.longitude) {
            dist = getHaversineDistance(
              userCoords.latitude,
              userCoords.longitude,
              item.latitude,
              item.longitude
            );
          }
          return { ...item, distance: dist };
        });
      } else {
        // Demo athletes with varied GPS coordinates around Metro Manila
        matchedList = [
          {
            id: 'mock-bea',
            full_name: 'Bea Valenzuela',
            age: 26,
            fitness_mode: 'Gym Buddy',
            dating_status: 'Leg Day Survivor 🏋️‍♀️',
            city: 'Makati City',
            latitude: 14.5547,
            longitude: 121.0244,
            pace: 'Hypertrophy Focus',
            height: "5'6",
            schedule: 'Late Afternoon',
            bio: 'Looking for a spotter at Anytime Fitness Ayala Triangle who will not judge me for crying during Romanian deadlifts.',
            avatar_url:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
            photos: [
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
              'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
            ],
            distance: userCoords
              ? getHaversineDistance(userCoords.latitude, userCoords.longitude, 14.5547, 121.0244)
              : 4.2,
          },
          {
            id: 'mock-kyle',
            full_name: 'Kyle Arboleda',
            age: 24,
            fitness_mode: 'Runner Finder',
            dating_status: 'Single & Ready to Lap 🏃‍♂️',
            city: 'BGC, Taguig',
            latitude: 14.5492,
            longitude: 121.0507,
            pace: '5:15 / km',
            height: "5'10",
            schedule: '5:30 AM Mornings',
            bio: 'Training for 21K at BGC Greenway. Guaranteed to pace you and bring iced Pocari Sweat after.',
            avatar_url:
              'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
            photos: [
              'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
            ],
            distance: userCoords
              ? getHaversineDistance(userCoords.latitude, userCoords.longitude, 14.5492, 121.0507)
              : 2.1,
          },
        ];
      }

      // Filter by Age Bounds and GPS Max Radius
      const filtered = matchedList.filter((p) => {
        const pAge = p.age ?? 24;
        const pDist = p.distance ?? 0;
        return pAge >= minAge && pAge <= maxAge && pDist <= maxDistanceKm;
      });

      setProfiles(filtered);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
      setCurrentIndex(0);
      pan.setValue({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [selectedMode, minAge, maxAge, maxDistanceKm, userCoords]);

  // UNIFIED ANIMATION RESPONDER (useNativeDriver: false across all calls)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderGrant: () => {
          Animated.spring(cardScale, {
            toValue: 0.98,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gestureState) => {
          Animated.spring(cardScale, {
            toValue: 1,
            useNativeDriver: false,
          }).start();

          if (gestureState.dx > SWIPE_THRESHOLD) {
            triggerSwipe('right');
          } else if (gestureState.dx < -SWIPE_THRESHOLD) {
            triggerSwipe('left');
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              friction: 6,
              tension: 60,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    []
  );

  const triggerSwipe = (direction: 'left' | 'right') => {
    const xDest = direction === 'right' ? SCREEN_WIDTH + 140 : -SCREEN_WIDTH - 140;
    Animated.timing(pan, {
      toValue: { x: xDest, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) => prev + 1);
    });
  };

  // Interpolations
  const rotateCard = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const connectOpacity = pan.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const currentProfile = profiles[currentIndex];

  const handleNextPhoto = (total: number) => {
    setActivePhotoIdx((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  const handlePrevPhoto = (total: number) => {
    setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  // Age Adjusters with Minimum 3-Year Gap
  const handleMinAgeChange = (delta: number) => {
    const target = minAge + delta;
    if (target >= 18 && maxAge - target >= 3) {
      setMinAge(target);
    }
  };

  const handleMaxAgeChange = (delta: number) => {
    const target = maxAge + delta;
    if (target <= 65 && target - minAge >= 3) {
      setMaxAge(target);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#00F0FF" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.deckRoot}>
      {/* Category Pills & Radar Controls */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedMode === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setSelectedMode(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter Trigger Button */}
        <TouchableOpacity
          style={styles.filterTriggerPill}
          onPress={() => setIsFilterModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterTriggerBolt}>⚡</Text>
          <Text style={styles.filterTriggerText}>
            {minAge}–{maxAge} • {maxDistanceKm}KM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discovery Card */}
      {currentProfile ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.cardWrapper,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate: rotateCard },
                { scale: cardScale },
              ],
            },
          ]}
        >
          {/* Holographic Decision Stamps */}
          <Animated.View
            style={[styles.decisionStamp, styles.stampRight, { opacity: connectOpacity }]}
          >
            <Text style={styles.stampRightText}>CONNECT ⚡</Text>
          </Animated.View>

          <Animated.View
            style={[styles.decisionStamp, styles.stampLeft, { opacity: passOpacity }]}
          >
            <Text style={styles.stampLeftText}>PASS ✕</Text>
          </Animated.View>

          {/* Photo Carousel Area */}
          {(() => {
            const photoList =
              currentProfile.photos && currentProfile.photos.length > 0
                ? currentProfile.photos
                : [
                    currentProfile.avatar_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
                  ];

            return (
              <View style={styles.photoViewport}>
                <Image source={{ uri: photoList[activePhotoIdx] }} style={styles.photoImg} />

                {photoList.length > 1 && (
                  <View style={styles.storyProgressRow}>
                    {photoList.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.storyPip,
                          i === activePhotoIdx ? styles.storyPipActive : styles.storyPipDim,
                        ]}
                      />
                    ))}
                  </View>
                )}

                {/* Left/Right Story Navigation */}
                <TouchableOpacity
                  style={styles.tapLeft}
                  onPress={() => handlePrevPhoto(photoList.length)}
                  activeOpacity={1}
                />
                <TouchableOpacity
                  style={styles.tapRight}
                  onPress={() => handleNextPhoto(photoList.length)}
                  activeOpacity={1}
                />

                {/* Overlaid Badges */}
                <View style={styles.photoOverlayRow}>
                  <View style={styles.sportBadge}>
                    <Text style={styles.sportBadgeText}>
                      {(currentProfile.fitness_mode || 'ATHLETE').toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>
                      {currentProfile.distance ?? 3.5} KM AWAY
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Profile Details Shelf */}
          <View style={styles.profileDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.athleteName}>{currentProfile.full_name}</Text>
              <View style={styles.ageBubble}>
                <Text style={styles.ageText}>{currentProfile.age ?? 25} YRS</Text>
              </View>
            </View>

            {/* Dating & Fitness Status */}
            {currentProfile.dating_status ? (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{currentProfile.dating_status}</Text>
              </View>
            ) : null}

            <View style={styles.locationLine}>
              <Text style={styles.pinIcon}>📍</Text>
              <Text style={styles.locationText}>
                {(currentProfile.city || 'METRO MANILA').toUpperCase()}
              </Text>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>PACE / FOCUS</Text>
                <Text style={styles.metricVal}>{currentProfile.pace || '5:30 / km'}</Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>HEIGHT</Text>
                <Text style={styles.metricVal}>{currentProfile.height || "5'8"}</Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>SCHEDULE</Text>
                <Text style={styles.metricVal}>{currentProfile.schedule || 'Afternoons'}</Text>
              </View>
            </View>

            {/* Bio Card */}
            <View style={styles.bioCard}>
              <Text style={styles.bioTitle}>TRAINING ETHOS & GOALS</Text>
              <Text style={styles.bioBody}>
                {currentProfile.bio ||
                  'Looking for an accountability partner to lock in paces, share hydration breaks, and get faster together.'}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>RADAR EXPANDED</Text>
          <Text style={styles.emptySub}>
            No athletes found matching {minAge}–{maxAge} yrs within {maxDistanceKm} km. Adjust
            filters to widen your scan.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchProfiles} activeOpacity={0.8}>
            <Text style={styles.refreshBtnText}>RE-SCAN RADAR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Control Buttons */}
      {currentProfile && (
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.passBtn]}
            onPress={() => triggerSwipe('left')}
            activeOpacity={0.7}
          >
            <Text style={styles.passIcon}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.swipeBtn, styles.connectBtn]}
            onPress={() => triggerSwipe('right')}
            activeOpacity={0.7}
          >
            <Text style={styles.connectIcon}>⚡</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Futuristic Interactive Radar Parameters Sheet */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>RADAR PARAMETERS</Text>
            <Text style={styles.modalSub}>
              Adjust age limits (min 3-year gap) and GPS radius to track athletes nearby.
            </Text>

            {/* Minimum Age Slider Stepper */}
            <View style={styles.sliderControlBlock}>
              <View style={styles.sliderHeaderRow}>
                <Text style={styles.sliderLabel}>MINIMUM AGE (18+)</Text>
                <Text style={styles.sliderValueText}>{minAge} YRS</Text>
              </View>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleMinAgeChange(-1)}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>

                <View style={styles.stepperBarBackground}>
                  <View
                    style={[
                      styles.stepperBarFill,
                      { width: `${((minAge - 18) / (maxAge - 3 - 18 || 1)) * 100}%` },
                    ]}
                  />
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleMinAgeChange(1)}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Maximum Age Slider Stepper */}
            <View style={styles.sliderControlBlock}>
              <View style={styles.sliderHeaderRow}>
                <Text style={styles.sliderLabel}>MAXIMUM AGE</Text>
                <Text style={styles.sliderValueText}>{maxAge} YRS</Text>
              </View>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleMaxAgeChange(-1)}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>

                <View style={styles.stepperBarBackground}>
                  <View
                    style={[
                      styles.stepperBarFill,
                      { width: `${((maxAge - (minAge + 3)) / (60 - (minAge + 3))) * 100}%` },
                    ]}
                  />
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleMaxAgeChange(1)}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sliderNotice}>
                ⚡ Enforced gap: minimum 3 years between lower and upper bound.
              </Text>
            </View>

            {/* GPS Radius Setting */}
            <View style={styles.sliderControlBlock}>
              <View style={styles.sliderHeaderRow}>
                <Text style={styles.sliderLabel}>GPS PROXIMITY RADIUS</Text>
                <Text style={styles.sliderValueText}>{maxDistanceKm} KM</Text>
              </View>
              <View style={styles.radiusOptionsRow}>
                {[5, 10, 20, 35, 50].map((dist) => (
                  <TouchableOpacity
                    key={dist}
                    style={[
                      styles.radiusChip,
                      maxDistanceKm === dist && styles.radiusChipActive,
                    ]}
                    onPress={() => setMaxDistanceKm(dist)}
                  >
                    <Text
                      style={[
                        styles.radiusChipText,
                        maxDistanceKm === dist && styles.radiusChipTextActive,
                      ]}
                    >
                      {dist} KM
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Close / Apply */}
            <TouchableOpacity
              style={styles.modalApplyBtn}
              onPress={() => setIsFilterModalOpen(false)}
            >
              <Text style={styles.modalApplyText}>APPLY RADAR FILTERS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  deckRoot: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  loadingBox: {
    paddingVertical: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* CATEGORY & RADAR CONTROLS */
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
    paddingHorizontal: 2,
  },
  categoryScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  categoryPill: {
    backgroundColor: 'rgba(16, 22, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
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
    letterSpacing: 1,
  },
  categoryTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },
  filterTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 22, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  filterTriggerBolt: {
    color: '#FFB800',
    fontSize: 12,
  },
  filterTriggerText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  /* VELOCITY CARD */
  cardWrapper: {
    width: '100%',
    backgroundColor: 'rgba(15, 20, 32, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(35px)' } : {}),
  },
  photoViewport: {
    width: '100%',
    aspectRatio: 0.96,
    position: 'relative',
    backgroundColor: '#030508',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyProgressRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  storyPip: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  storyPipActive: {
    backgroundColor: '#00F0FF',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  storyPipDim: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tapLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '38%',
    zIndex: 5,
  },
  tapRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '38%',
    zIndex: 5,
  },
  photoOverlayRow: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 6,
  },
  sportBadge: {
    backgroundColor: '#FF3B30',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sportBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  distanceBadge: {
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
  },
  distanceBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* DETAILS */
  profileDetails: {
    padding: 20,
    gap: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  athleteName: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ageBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  ageText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusPill: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontFamily: SYSTEM_FONT,
    color: '#FF7B72',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinIcon: {
    fontSize: 14,
  },
  locationText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  metricCell: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricVal: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  bioCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  bioTitle: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bioBody: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 21,
  },

  /* DECISION STAMPS */
  decisionStamp: {
    position: 'absolute',
    top: 40,
    zIndex: 30,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  stampRight: {
    right: 20,
    borderColor: '#00F0FF',
    backgroundColor: 'rgba(0, 240, 255, 0.2)',
    transform: [{ rotate: '12deg' }],
  },
  stampRightText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  stampLeft: {
    left: 20,
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    transform: [{ rotate: '-12deg' }],
  },
  stampLeftText: {
    fontFamily: SYSTEM_FONT,
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  /* CONTROLS */
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 4,
    marginBottom: 8,
  },
  swipeBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  passBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.45)',
  },
  passIcon: {
    color: '#FF3B30',
    fontSize: 22,
    fontWeight: 'bold',
  },
  connectBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderColor: 'rgba(0, 240, 255, 0.55)',
  },
  connectIcon: {
    color: '#00F0FF',
    fontSize: 24,
    fontWeight: 'bold',
  },

  emptyCard: {
    paddingVertical: 100,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  emptySub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  refreshBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  refreshBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* RADAR PARAMETERS MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(16, 22, 34, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  modalTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  modalSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  sliderControlBlock: {
    gap: 8,
    marginTop: 4,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sliderValueText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepperBarFill: {
    height: '100%',
    backgroundColor: '#00F0FF',
  },
  sliderNotice: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  radiusOptionsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  radiusChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
  },
  radiusChipActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.18)',
    borderColor: '#00F0FF',
  },
  radiusChipText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: '700',
  },
  radiusChipTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },
  modalApplyBtn: {
    backgroundColor: '#00F0FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  modalApplyText: {
    fontFamily: SYSTEM_FONT,
    color: '#030812',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});