import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  Animated,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface ProfileSettingsProps {
  currentUserId: string;
  userEmail: string;
  onProfileUpdated?: () => void;
}

const MODES = [
  { key: 'WalkerFinder', label: 'Walker', defaultPace: 'Casual (5-6 km/h)' },
  { key: 'RunnerFinder', label: 'Runner', defaultPace: '5:30 min/km' },
  { key: 'BikerFinder', label: 'Biker', defaultPace: '22-25 km/h' },
  { key: 'GymFinder', label: 'Gym', defaultPace: 'Strength / Hypertrophy' },
];

const TIME_PREFERENCES = ['Early Morning', 'Late Afternoon', 'Night Owl', 'Flexible'];
const FREQUENCY_OPTIONS = ['1-2x / week', '3-4x / week', '5+ times / week', 'Weekends'];

const APPLE_FONT =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif"
    : undefined;

export default function ProfileSettings({
  currentUserId,
  userEmail,
  onProfileUpdated,
}: ProfileSettingsProps) {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [fitnessMode, setFitnessMode] = useState('RunnerFinder');
  const [pace, setPace] = useState('');
  const [city, setCity] = useState('');
  const [workoutTime, setWorkoutTime] = useState('Early Morning');
  const [workoutFreq, setWorkoutFreq] = useState('3-4x / week');
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<string[]>(['', '', '']);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activePreviewPhotoIdx, setActivePreviewPhotoIdx] = useState(0);

  // Animated view transition between showcase and editing
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const triggerTransition = (toEditMode: boolean) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: toEditMode ? -15 : 15,
        duration: 160,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsEditing(toEditMode);
      slideAnim.setValue(toEditMode ? 15 : -15);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: false,
        }),
      ]).start();
    });
  };

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (!error && data) {
      setFullName(data.full_name || '');
      setAge(data.age ? String(data.age) : '');
      setHeight(data.height || '');
      setFitnessMode(data.fitness_mode || 'RunnerFinder');
      setPace(data.pace || '');
      setCity(data.city || 'Metro Manila');
      setWorkoutTime(data.workout_time || 'Early Morning');
      setWorkoutFreq(data.workout_frequency || '3-4x / week');
      setBio(data.bio || '');

      const existingPhotos = data.photos || [];
      setPhotos([
        existingPhotos[0] || '',
        existingPhotos[1] || '',
        existingPhotos[2] || '',
      ]);

      if (data.full_name && data.age) {
        setIsEditing(false);
      } else {
        setIsEditing(true);
      }
    } else {
      setIsEditing(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [currentUserId]);

  const handlePhotoUpload = (slotIndex: number) => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const result = uploadEvent.target?.result as string;
            if (result) {
              const updated = [...photos];
              updated[slotIndex] = result;
              setPhotos(updated);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const removePhoto = (slotIndex: number) => {
    const updated = [...photos];
    updated[slotIndex] = '';
    setPhotos(updated);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setStatusMessage('Please enter your name.');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (!age.trim() || isNaN(parsedAge) || parsedAge < 18) {
      setStatusMessage('Please enter a valid age (18+ required).');
      return;
    }

    setSaving(true);
    setStatusMessage('');

    const validPhotos = photos.map((p) => p.trim()).filter((p) => p.length > 0);

    const { error } = await supabase.from('profiles').upsert({
      id: currentUserId,
      full_name: fullName.trim(),
      age: parsedAge,
      height: height.trim(),
      fitness_mode: fitnessMode,
      pace: pace.trim(),
      city: city.trim(),
      workout_time: workoutTime,
      workout_frequency: workoutFreq,
      bio: bio.trim(),
      photos: validPhotos,
    });

    setSaving(false);

    if (error) {
      setStatusMessage(`Error: ${error.message}`);
    } else {
      setActivePreviewPhotoIdx(0);
      if (onProfileUpdated) onProfileUpdated();
      triggerTransition(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="small" color="#FF3B30" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  const validPhotosList = photos.filter((p) => Boolean(p.trim()));

  return (
    <ScrollView
      style={styles.glassContainer}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* ========================================================= */}
        {/* VIEW 1: READ-ONLY SHOWCASE CARD                           */}
        {/* ========================================================= */}
        {!isEditing ? (
          <View style={styles.previewContainer}>
            {/* Header with Edit Button */}
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.title}>{fullName}</Text>
                <Text style={styles.subtitle}>{userEmail}</Text>
              </View>
              <TouchableOpacity
                style={styles.editActionBtn}
                onPress={() => triggerTransition(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.editActionIcon}>✎</Text>
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Interactive Photo Carousel Viewport */}
            <View style={styles.showcasePhotoViewport}>
              {validPhotosList.length > 0 ? (
                <Image
                  source={{
                    uri: validPhotosList[activePreviewPhotoIdx] || validPhotosList[0],
                  }}
                  style={styles.showcaseMainPhoto}
                />
              ) : (
                <View style={styles.emptyShowcasePhoto}>
                  <Text style={styles.emptyPhotoIcon}>📸</Text>
                  <Text style={styles.emptyPhotoText}>No profile photo uploaded</Text>
                </View>
              )}

              {/* Progress Indicator Bars (Top) */}
              {validPhotosList.length > 1 && (
                <View style={styles.photoDotsRow}>
                  {validPhotosList.map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.photoDot,
                        i === activePreviewPhotoIdx && styles.photoDotActive,
                      ]}
                      onPress={() => setActivePreviewPhotoIdx(i)}
                      activeOpacity={0.8}
                    />
                  ))}
                </View>
              )}

              {/* Left / Right Interactive Tap Zones */}
              {validPhotosList.length > 1 && (
                <View style={styles.tapHitboxLayer}>
                  {/* Left Tap -> Previous Photo */}
                  <TouchableOpacity
                    style={styles.tapSide}
                    activeOpacity={1}
                    onPress={() =>
                      setActivePreviewPhotoIdx((prev) =>
                        prev > 0 ? prev - 1 : validPhotosList.length - 1
                      )
                    }
                  />

                  {/* Right Tap -> Next Photo */}
                  <TouchableOpacity
                    style={styles.tapSide}
                    activeOpacity={1}
                    onPress={() =>
                      setActivePreviewPhotoIdx((prev) =>
                        prev < validPhotosList.length - 1 ? prev + 1 : 0
                      )
                    }
                  />
                </View>
              )}

              {/* Mode & Age Floating Badges */}
              <View style={styles.showcaseBadgesRow}>
                <View style={styles.showcaseModeBadge}>
                  <Text style={styles.showcaseModeText}>
                    {fitnessMode.replace('Finder', '').toUpperCase()}
                  </Text>
                </View>
                {age ? (
                  <View style={styles.showcaseAgeBadge}>
                    <Text style={styles.showcaseAgeText}>{age} YRS</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Quick Metrics Capsules */}
            <View style={styles.metricsCapsuleRow}>
              <View style={styles.detailCapsule}>
                <Text style={styles.capsuleLabel}>PACE</Text>
                <Text style={styles.capsuleValue}>{pace || 'Flexible'}</Text>
              </View>
              {height ? (
                <View style={styles.detailCapsule}>
                  <Text style={styles.capsuleLabel}>HEIGHT</Text>
                  <Text style={styles.capsuleValue}>{height}</Text>
                </View>
              ) : null}
              <View style={styles.detailCapsule}>
                <Text style={styles.capsuleLabel}>CITY</Text>
                <Text style={styles.capsuleValue}>{city || 'Metro Manila'}</Text>
              </View>
            </View>

            {/* Schedule & Habit Insets */}
            <View style={styles.detailsGlassCard}>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailLabel}>Schedule</Text>
                <Text style={styles.detailValue}>{workoutTime || 'Flexible'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailLabel}>Frequency</Text>
                <Text style={styles.detailValue}>{workoutFreq || 'Regular'}</Text>
              </View>
            </View>

            {/* Bio Card */}
            {bio ? (
              <View style={styles.bioGlassCard}>
                <Text style={styles.bioHeading}>About</Text>
                <Text style={styles.bioContent}>{bio}</Text>
              </View>
            ) : null}

            {/* Bottom Edit Action */}
            <TouchableOpacity
              style={styles.editBottomBtn}
              onPress={() => triggerTransition(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.editBottomBtnText}>Edit Profile Details</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ========================================================= */
          /* VIEW 2: EDITING FORM                                      */
          /* ========================================================= */
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Edit Profile</Text>
                <Text style={styles.subtitle}>{userEmail}</Text>
              </View>
              {fullName && age ? (
                <TouchableOpacity
                  style={styles.cancelActionBtn}
                  onPress={() => triggerTransition(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelActionText}>Done</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {statusMessage ? (
              <View style={styles.statusBanner}>
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            ) : null}

            {/* 3 Photos Slot Uploader */}
            <Text style={styles.sectionTitle}>Profile Photos</Text>
            <Text style={styles.subHint}>Upload up to 3 photos for your matchmaking card</Text>
            <View style={styles.photoGrid}>
              {[0, 1, 2].map((idx) => {
                const hasPhoto = Boolean(photos[idx]);
                return (
                  <View key={idx} style={styles.photoSlotWrapper}>
                    <TouchableOpacity
                      style={[styles.photoSlot, hasPhoto && styles.photoSlotFilled]}
                      onPress={() => handlePhotoUpload(idx)}
                      activeOpacity={0.75}
                    >
                      {hasPhoto ? (
                        <Image source={{ uri: photos[idx] }} style={styles.previewImage} />
                      ) : (
                        <View style={styles.emptySlotContent}>
                          <View style={styles.plusCircle}>
                            <Text style={styles.plusIcon}>＋</Text>
                          </View>
                          <Text style={styles.uploadText}>Slot 0{idx + 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {hasPhoto && (
                      <TouchableOpacity
                        style={styles.deleteBadge}
                        onPress={() => removePhoto(idx)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.deleteBadgeText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Personal Details */}
            <Text style={styles.sectionTitle}>Personal Details</Text>
            <View style={styles.glassGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Required"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Required (18+)"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <Text style={styles.fieldLabel}>Height</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 5'9"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={height}
                  onChangeText={setHeight}
                />
              </View>
            </View>

            {/* Primary Focus Activity */}
            <Text style={styles.sectionTitle}>Primary Focus</Text>
            <View style={styles.glassSegment}>
              {MODES.map((mode) => {
                const isSelected = fitnessMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]}
                    onPress={() => {
                      setFitnessMode(mode.key);
                      if (!pace) setPace(mode.defaultPace);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pace & Location */}
            <Text style={styles.sectionTitle}>Pace & Location</Text>
            <View style={styles.glassGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.fieldLabel}>Target Pace</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 5:30 min/km"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={pace}
                  onChangeText={setPace}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <Text style={styles.fieldLabel}>City / Hub</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Quezon City"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
            </View>

            {/* Schedule */}
            <Text style={styles.sectionTitle}>Schedule</Text>
            <View style={styles.chipsRow}>
              {TIME_PREFERENCES.map((time) => {
                const isSelected = workoutTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.glassChip, isSelected && styles.glassChipActive]}
                    onPress={() => setWorkoutTime(time)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.glassChipText, isSelected && styles.glassChipTextActive]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Weekly Frequency */}
            <Text style={styles.sectionTitle}>Weekly Frequency</Text>
            <View style={styles.chipsRow}>
              {FREQUENCY_OPTIONS.map((freq) => {
                const isSelected = workoutFreq === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.glassChip, isSelected && styles.glassChipActive]}
                    onPress={() => setWorkoutFreq(freq)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.glassChipText, isSelected && styles.glassChipTextActive]}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* About You */}
            <Text style={styles.sectionTitle}>About You</Text>
            <View style={styles.glassGroup}>
              <TextInput
                style={styles.bioTextarea}
                placeholder="Share your running routes, accountability goals, or fitness routine..."
                placeholderTextColor="rgba(255, 255, 255, 0.25)"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    width: '100%',
    backgroundColor: 'rgba(16, 18, 25, 0.65)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
    height: '100%',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120, // Clean clearance above the floating footer dock
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  cancelActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelActionText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  /* SHOWCASE STYLES */
  previewContainer: {
    gap: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  editActionIcon: {
    color: '#FF4B2B',
    fontSize: 12,
  },
  editActionText: {
    fontFamily: APPLE_FONT,
    color: '#FF4B2B',
    fontSize: 12,
    fontWeight: '700',
  },
  showcasePhotoViewport: {
    width: '100%',
    aspectRatio: 4 / 5, // Edge-to-edge flush framing without side bars
    borderRadius: 20,
    backgroundColor: '#050608',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  showcaseMainPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    ...(Platform.OS === 'web' ? { objectPosition: 'center top' } : {}),
  },
  emptyShowcasePhoto: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPhotoIcon: {
    fontSize: 32,
  },
  emptyPhotoText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
  },
  photoDotsRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
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
  showcaseBadgesRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 25,
    pointerEvents: 'none',
  },
  showcaseModeBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  showcaseModeText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  showcaseAgeBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  showcaseAgeText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  metricsCapsuleRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
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
  detailsGlassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  detailLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  detailValue: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bioGlassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 4,
  },
  bioHeading: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bioContent: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  editBottomBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  editBottomBtnText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* FORM STYLES */
  statusBanner: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionTitle: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 4,
  },
  subHint: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  photoSlotWrapper: {
    flex: 1,
    position: 'relative',
  },
  photoSlot: {
    width: '100%',
    height: 115,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoSlotFilled: {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: '#050608',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptySlotContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  plusIcon: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '300',
  },
  uploadText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10.5,
    fontWeight: '500',
  },
  deleteBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22, 24, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  deleteBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  glassGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 16,
  },
  fieldLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13.5,
    width: 100,
    fontWeight: '500',
  },
  fieldInput: {
    fontFamily: APPLE_FONT,
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    padding: 0,
  },
  bioTextarea: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 13.5,
    padding: 14,
    height: 80,
    textAlignVertical: 'top',
    lineHeight: 18,
  },
  glassSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  segmentText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  glassChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  glassChipActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  glassChipText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '500',
  },
  glassChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 26,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  saveBtnText: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  centerBox: {
    backgroundColor: 'rgba(16, 18, 25, 0.65)',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  loadingText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '500',
  },
});