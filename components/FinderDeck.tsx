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
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;

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

function calculateAccurateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const R = 6371.0088;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function FinderDeck({ currentUserId }: { currentUserId: string }) {
  const [rawProfiles, setRawProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Exact Coordinates
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userCity, setUserCity] = useState('');

  // Committed Radar Filters
  const [maxDistanceKm, setMaxDistanceKm] = useState(50);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(35);

  // Temporary State for Smooth In-Modal Dragging
  const [tempMinAge, setTempMinAge] = useState(18);
  const [tempMaxAge, setTempMaxAge] = useState(35);
  const [tempDistance, setTempDistance] = useState(50);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Track bar width
  const SLIDER_WIDTH = 270;
  const MIN_POSSIBLE_AGE = 18;
  const MAX_POSSIBLE_AGE = 65;

  // Swipe Animation values
  const pan = useRef(new Animated.ValueXY()).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // Sync temp modal filters when opened
  useEffect(() => {
    if (isFilterModalOpen) {
      setTempMinAge(minAge);
      setTempMaxAge(maxAge);
      setTempDistance(maxDistanceKm);
    }
  }, [isFilterModalOpen]);

  // Resolve user GPS
  useEffect(() => {
    let isMounted = true;
    async function resolveLocation() {
      try {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('latitude, longitude, city')
          .eq('id', currentUserId)
          .maybeSingle();

        if (myProfile?.latitude && myProfile?.longitude) {
          if (isMounted) {
            setUserLocation({
              latitude: Number(myProfile.latitude),
              longitude: Number(myProfile.longitude),
            });
            if (myProfile.city) setUserCity(myProfile.city);
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isMounted) {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            const [geo] = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            if (geo && (geo.city || geo.subregion)) {
              setUserCity(geo.city || geo.subregion || '');
            }
          }
        }
      } catch (err) {
        console.warn('GPS location resolution error:', err);
      }
    }

    resolveLocation();
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [currentIndex]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*').neq('id', currentUserId);

      if (selectedMode !== 'ALL') {
        const modeMap: Record<string, string> = {
          WALK: 'Walker Finder',
          RUN: 'Runner Finder',
          BIKE: 'Biker Finder',
          GYM: 'Gym Buddy',
        };
        const target = modeMap[selectedMode];
        if (target) {
          query = query.or(`fitness_mode.eq.${target},fitness_mode.ilike.%${selectedMode}%`);
        }
      }

      const { data, error } = await query;
      let athletePool: Profile[] = [];

      if (!error && data && data.length > 0) {
        athletePool = data;
      } else {
        athletePool = [
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
            bio: 'Looking for a spotter who will not judge me for crying during Romanian deadlifts.',
            avatar_url:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
            photos: [
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
              'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
            ],
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
          },
          {
            id: 'mock-sofia',
            full_name: 'Sofia Mendoza',
            age: 23,
            fitness_mode: 'Walker Finder',
            dating_status: 'Cardio Over Feelings ⚡',
            city: 'Quezon City',
            latitude: 14.6507,
            longitude: 121.0494,
            pace: '6.0 km/h Walk',
            height: "5'4",
            schedule: '7:00 PM Evenings',
            bio: 'Sunset walks around UP Diliman Oval to decompress after long days.',
            avatar_url:
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80',
            photos: [
              'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80',
            ],
          },
        ];
      }

      setRawProfiles(athletePool);
    } catch (err) {
      console.warn('Error fetching profiles:', err);
    } finally {
      setLoading(false);
      setCurrentIndex(0);
      pan.setValue({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [selectedMode, userLocation]);

  // Instant in-memory filter against committed parameters
  const profiles = useMemo(() => {
    const mapped = rawProfiles.map((athlete) => {
      let exactDistance = 999;
      if (
        userLocation &&
        typeof athlete.latitude === 'number' &&
        typeof athlete.longitude === 'number'
      ) {
        exactDistance = calculateAccurateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          athlete.latitude,
          athlete.longitude
        );
      } else if (typeof athlete.distance === 'number') {
        exactDistance = athlete.distance;
      }
      return { ...athlete, distance: exactDistance };
    });

    return mapped
      .filter((athlete) => {
        const aAge = athlete.age ?? 24;
        return aAge >= minAge && aAge <= maxAge && (athlete.distance || 0) <= maxDistanceKm;
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [rawProfiles, userLocation, minAge, maxAge, maxDistanceKm]);

  // PanResponder for swiping cards
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderGrant: () => {
        Animated.spring(cardScale, {
          toValue: 0.98,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy * 0.4 });
      },
      onPanResponderRelease: (_, gesture) => {
        Animated.spring(cardScale, {
          toValue: 1,
          useNativeDriver: false,
        }).start();

        if (gesture.dx > SWIPE_THRESHOLD) {
          triggerSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          triggerSwipe('left');
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 50,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const triggerSwipe = (direction: 'left' | 'right') => {
    const xDest = direction === 'right' ? SCREEN_WIDTH + 140 : -SCREEN_WIDTH - 140;
    Animated.timing(pan, {
      toValue: { x: xDest, y: 0 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setCurrentIndex((prev) => prev + 1);
    });
  };

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

  // Convert Age to position
  const getPositionFromAge = (val: number) => {
    const ratio = (val - MIN_POSSIBLE_AGE) / (MAX_POSSIBLE_AGE - MIN_POSSIBLE_AGE);
    return Math.max(0, Math.min(SLIDER_WIDTH, ratio * SLIDER_WIDTH));
  };

  // Drag responder references
  const startDragAgeMin = useRef(minAge);
  const minThumbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startDragAgeMin.current = tempMinAge;
        },
        onPanResponderMove: (_, gestureState) => {
          const ageDelta = Math.round(
            (gestureState.dx / SLIDER_WIDTH) * (MAX_POSSIBLE_AGE - MIN_POSSIBLE_AGE)
          );
          const computed = startDragAgeMin.current + ageDelta;
          const clamped = Math.max(MIN_POSSIBLE_AGE, Math.min(tempMaxAge - 3, computed));
          setTempMinAge(clamped);
        },
      }),
    [tempMaxAge]
  );

  const startDragAgeMax = useRef(maxAge);
  const maxThumbPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startDragAgeMax.current = tempMaxAge;
        },
        onPanResponderMove: (_, gestureState) => {
          const ageDelta = Math.round(
            (gestureState.dx / SLIDER_WIDTH) * (MAX_POSSIBLE_AGE - MIN_POSSIBLE_AGE)
          );
          const computed = startDragAgeMax.current + ageDelta;
          const clamped = Math.min(MAX_POSSIBLE_AGE, Math.max(tempMinAge + 3, computed));
          setTempMaxAge(clamped);
        },
      }),
    [tempMinAge]
  );

  const handleApplyParameters = () => {
    setMinAge(tempMinAge);
    setMaxAge(tempMaxAge);
    setMaxDistanceKm(tempDistance);
    setIsFilterModalOpen(false);
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

        <TouchableOpacity
          style={styles.filterTriggerPill}
          onPress={() => setIsFilterModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterTriggerBolt}>⚡</Text>
          <Text style={styles.filterTriggerText}>
            {minAge}–{maxAge} • ≤{maxDistanceKm}KM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discovery Deck Card */}
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
          {/* Stamps */}
          <Animated.View
            pointerEvents="none"
            style={[styles.decisionStamp, styles.stampRight, { opacity: connectOpacity }]}
          >
            <Text style={styles.stampRightText}>CONNECT ⚡</Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.decisionStamp, styles.stampLeft, { opacity: passOpacity }]}
          >
            <Text style={styles.stampLeftText}>PASS ✕</Text>
          </Animated.View>

          {/* Photo Viewport */}
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
                  <TouchableOpacity
                    style={styles.storyProgressRow}
                    activeOpacity={0.8}
                    onPress={() => handleNextPhoto(photoList.length)}
                  >
                    {photoList.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.storyPip,
                          i === activePhotoIdx ? styles.storyPipActive : styles.storyPipDim,
                        ]}
                      />
                    ))}
                  </TouchableOpacity>
                )}

                {/* Overlaid Badges */}
                <View style={styles.photoOverlayRow} pointerEvents="none">
                  <View style={styles.sportBadge}>
                    <Text style={styles.sportBadgeText}>
                      {(currentProfile.fitness_mode || 'ATHLETE').toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>
                      {typeof currentProfile.distance === 'number'
                        ? `${currentProfile.distance} KM AWAY`
                        : 'NEARBY'}
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
              <View style={styles.verifiedGpsPill}>
                <Text style={styles.verifiedGpsText}>GPS VERIFIED</Text>
              </View>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>PACE / FOCUS</Text>
                <Text style={styles.metricVal}>{currentProfile.pace || '5:30 / km'}</Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>HEIGHT</Text>
                <Text style={styles.metricVal}>{currentProfile.height || '—'}</Text>
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
                  'Looking for an accountability partner to lock in paces, share hydration breaks, and train together.'}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NO ATHLETES WITHIN {maxDistanceKm} KM</Text>
          <Text style={styles.emptySub}>
            No active athletes match your {maxDistanceKm} km GPS radius and age range. Widen your parameters to see more athletes.
          </Text>
          <TouchableOpacity
            style={styles.widenRadiusBtn}
            onPress={() => setMaxDistanceKm((prev) => Math.min(100, prev + 25))}
            activeOpacity={0.8}
          >
            <Text style={styles.widenRadiusBtnText}>
              + EXPAND RADIUS TO {Math.min(100, maxDistanceKm + 25)} KM
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Trigger Buttons */}
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

      {/* Lag-Free Dual Slider Radar Parameters Modal */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>RADAR PARAMETERS</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* LAG-FREE DUAL SLIDER FOR AGE */}
            <View style={styles.filterSection}>
              <View style={styles.sliderHeaderRow}>
                <Text style={styles.sectionHeading}>ATHLETE AGE RANGE</Text>
                <Text style={styles.sliderAgeRangeVal}>{tempMinAge} – {tempMaxAge} YRS</Text>
              </View>

              <View style={[styles.sliderTrackContainer, { width: SLIDER_WIDTH }]}>
                {/* Background Full Track */}
                <View style={styles.sliderTrackBg} />

                {/* Highlight Active Range Bar */}
                <View
                  style={[
                    styles.sliderTrackActive,
                    {
                      left: getPositionFromAge(tempMinAge),
                      width: Math.max(16, getPositionFromAge(tempMaxAge) - getPositionFromAge(tempMinAge)),
                    },
                  ]}
                />

                {/* Left Thumb (Min Age) */}
                <View
                  {...minThumbPanResponder.panHandlers}
                  style={[
                    styles.sliderThumb,
                    styles.sliderThumbMin,
                    { left: Math.max(0, getPositionFromAge(tempMinAge) - 12) },
                  ]}
                >
                  <View style={styles.thumbDotCyan} />
                </View>

                {/* Right Thumb (Max Age) */}
                <View
                  {...maxThumbPanResponder.panHandlers}
                  style={[
                    styles.sliderThumb,
                    styles.sliderThumbMax,
                    { left: Math.max(0, getPositionFromAge(tempMaxAge) - 12) },
                  ]}
                >
                  <View style={styles.thumbDotOrange} />
                </View>
              </View>

              {/* Slider scale limits footer */}
              <View style={[styles.sliderScaleBounds, { width: SLIDER_WIDTH }]}>
                <Text style={styles.scaleBoundText}>{MIN_POSSIBLE_AGE} YRS</Text>
                <Text style={styles.scaleGapNotice}>Smooth drag handles (min 3-yr gap)</Text>
                <Text style={styles.scaleBoundText}>{MAX_POSSIBLE_AGE} YRS</Text>
              </View>
            </View>

            {/* GPS Radius Limit (up to 100 KM) */}
            <View style={styles.filterSection}>
              <View style={styles.radiusHeaderRow}>
                <Text style={styles.sectionHeading}>GPS PROXIMITY RADIUS</Text>
                <Text style={styles.radiusValText}>{tempDistance} KM</Text>
              </View>
              <View style={styles.radiusChipsGrid}>
                {[5, 15, 25, 50, 75, 100].map((dist) => (
                  <TouchableOpacity
                    key={dist}
                    style={[
                      styles.radiusPill,
                      tempDistance === dist && styles.radiusPillActive,
                    ]}
                    onPress={() => setTempDistance(dist)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.radiusPillText,
                        tempDistance === dist && styles.radiusPillTextActive,
                      ]}
                    >
                      {dist} KM
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApplyParameters}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>APPLY PARAMETERS</Text>
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
    paddingVertical: 6,
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
    backgroundColor: 'rgba(3, 7, 18, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.55)',
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
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  verifiedGpsPill: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  verifiedGpsText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    paddingVertical: 90,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 19,
  },
  widenRadiusBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: '#00F0FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  widenRadiusBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(16, 22, 34, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 22,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterSection: {
    gap: 10,
    alignItems: 'center',
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  sectionHeading: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sliderAgeRangeVal: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
  },

  /* DUAL-THUMB SLIDER TRACK */
  sliderTrackContainer: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  sliderTrackBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    width: '100%',
  },
  sliderTrackActive: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#00F0FF',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0D111A',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    zIndex: 5,
  },
  sliderThumbMin: {
    borderColor: '#00F0FF',
  },
  sliderThumbMax: {
    borderColor: '#FC5200',
  },
  thumbDotCyan: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F0FF',
  },
  thumbDotOrange: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FC5200',
  },
  sliderScaleBounds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scaleBoundText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    fontWeight: '700',
  },
  scaleGapNotice: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 9,
    fontStyle: 'italic',
  },

  /* Radius Section */
  radiusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  radiusValText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 13,
    fontWeight: '900',
  },
  radiusChipsGrid: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  radiusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
  },
  radiusPillActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.16)',
    borderColor: '#00F0FF',
  },
  radiusPillText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11.5,
    fontWeight: '700',
  },
  radiusPillTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },

  applyBtn: {
    backgroundColor: '#00F0FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  applyBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#030812',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});