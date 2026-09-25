import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const SYSTEM_FONT =
  Platform.OS === 'ios'
    ? 'SF Pro Display'
    : Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
    : undefined;

interface ProfileSettingsProps {
  currentUserId: string;
  userEmail?: string;
}

const FITNESS_MODES = [
  { id: 'RunnerFinder', label: 'Runner Finder' },
  { id: 'Gym', label: 'Gym Buddy' },
  { id: 'Biker', label: 'Biker Finder' },
  { id: 'Walker', label: 'Walker Finder' },
];

const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];

const PRESET_STATUSES = [
  'Single & Ready to Lap 🏃‍♂️',
  'Cardio Over Feelings ⚡',
  'Looking for a Pacing Partner',
  'Leg Day Survivor 🏋️‍♀️',
  'Training for 21K 🏁',
  'Morning Runs & Iced Pocari 🧊',
];

export default function ProfileSettings({ currentUserId, userEmail }: ProfileSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('24');
  const [gender, setGender] = useState('Male');
  const [datingStatus, setDatingStatus] = useState('Single & Ready to Lap 🏃‍♂️');
  const [fitnessMode, setFitnessMode] = useState('RunnerFinder');
  const [pace, setPace] = useState('5:30 / km');
  const [height, setHeight] = useState("5'8");
  const [schedule, setSchedule] = useState('6:00 AM Mornings');
  const [bio, setBio] = useState('');

  // GPS-locked location details (no manual text editing allowed)
  const [gpsCity, setGpsCity] = useState('Metro Manila');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsVerified, setGpsVerified] = useState(false);

  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
  ]);

  useEffect(() => {
    fetchProfile();
    detectDeviceLocation();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .single();

      if (!error && data) {
        if (data.full_name) setFullName(data.full_name);
        if (data.age) setAge(String(data.age));
        if (data.gender) setGender(data.gender);
        if (data.dating_status) setDatingStatus(data.dating_status);
        if (data.city) setGpsCity(data.city);
        if (data.latitude && data.longitude) {
          setGpsCoords({ latitude: data.latitude, longitude: data.longitude });
          setGpsVerified(true);
        }
        if (data.fitness_mode) setFitnessMode(data.fitness_mode);
        if (data.pace) setPace(data.pace);
        if (data.height) setHeight(data.height);
        if (data.schedule) setSchedule(data.schedule);
        if (data.bio) setBio(data.bio);
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
        } else if (data.avatar_url) {
          setPhotos([data.avatar_url]);
        }
      }
    } catch {
      // Ignore initial read failure
    } finally {
      setLoading(false);
    }
  };

  // Automatic GPS Location Lock
  const detectDeviceLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setGpsCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode) {
        const found =
          geocode.city ||
          geocode.subregion ||
          geocode.district ||
          geocode.region ||
          'Metro Manila';
        setGpsCity(found);
        setGpsVerified(true);
      }
    } catch {
      // Keep existing city
    } finally {
      setLocating(false);
    }
  };

  // Direct Phone Photo Library Picker
  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const msg = 'Photos permission is required to add showcase images.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Permission Denied', msg);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch {
      // Pick canceled
    }
  };

  const handleRemovePhoto = (index: number) => {
    if (photos.length <= 1) {
      const msg = 'Your discovery card requires at least one photo.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Required', msg);
      return;
    }
    setPhotos(photos.filter((_, i) => i !== index));
    setActivePhotoIdx(0);
  };

  // Profile Save
  const handleSave = async () => {
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18) {
      const msg = 'Laplaban requires all athletes to be 18 years or older.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Invalid Age', msg);
      return;
    }

    setSaving(true);

    const payload: any = {
      id: currentUserId,
      full_name: fullName.trim() || userEmail?.split('@')[0] || 'Athlete',
      age: ageNum,
      gender,
      dating_status: datingStatus.trim(),
      city: gpsCity,
      latitude: gpsCoords?.latitude ?? 14.5547,
      longitude: gpsCoords?.longitude ?? 121.0244,
      fitness_mode: fitnessMode,
      pace: pace.trim(),
      height: height.trim(),
      schedule: schedule.trim(),
      bio: bio.trim(),
      photos: photos,
      avatar_url: photos[0] || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(payload);

    setSaving(false);

    if (!error) {
      const msg = 'Profile settings and GPS location updated successfully.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Saved', msg);
    } else {
      const errorMsg = error.message || 'Error updating profile. Please check database permissions.';
      Platform.OS === 'web' ? window.alert(errorMsg) : Alert.alert('Save Failed', errorMsg);
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
    <View style={styles.container}>
      {/* SECTION HEADER */}
      <View style={styles.headerBlock}>
        <View style={styles.radarKickerRow}>
          <View style={styles.kickerDot} />
          <Text style={styles.sectionKicker}>RADAR IDENTITY</Text>
        </View>
        <Text style={styles.sectionTitle}>Profile & Showcase</Text>
        <Text style={styles.sectionSub}>
          Your discovery card is verified through hardware GPS to eliminate fake locations.
        </Text>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* LIVE DISCOVERY CARD PREVIEW                                   */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.previewHeaderRow}>
        <Text style={styles.previewLabel}>LIVE DISCOVERY PREVIEW</Text>
        <View style={styles.previewBadge}>
          <Text style={styles.previewBadgeText}>SHOWCASE VIEW</Text>
        </View>
      </View>

      <View style={styles.cardWrapper}>
        <View style={styles.photoViewport}>
          <Image source={{ uri: photos[activePhotoIdx] }} style={styles.photoImg} />

          {photos.length > 1 && (
            <View style={styles.storyProgressRow}>
              {photos.map((_, i) => (
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

          <TouchableOpacity
            style={styles.tapLeft}
            onPress={() =>
              setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
            }
            activeOpacity={1}
          />
          <TouchableOpacity
            style={styles.tapRight}
            onPress={() =>
              setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
            }
            activeOpacity={1}
          />

          <View style={styles.photoOverlayRow}>
            <View style={styles.sportBadge}>
              <Text style={styles.sportBadgeText}>{fitnessMode.toUpperCase()}</Text>
            </View>

            <View style={styles.distanceBadge}>
              <Text style={styles.distanceBadgeText}>YOU (PREVIEW)</Text>
            </View>
          </View>
        </View>

        {/* Card Shelf */}
        <View style={styles.profileDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.athleteName}>{fullName || 'Athlete Name'}</Text>
            <View style={styles.ageBubble}>
              <Text style={styles.ageText}>{age} YRS • {gender.toUpperCase()}</Text>
            </View>
          </View>

          {datingStatus ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{datingStatus}</Text>
            </View>
          ) : null}

          {/* GPS-Verified Location Line */}
          <View style={styles.locationLine}>
            <Text style={styles.pinIcon}>📍</Text>
            <Text style={styles.locationText}>{gpsCity.toUpperCase()}</Text>
            <View style={styles.verifiedGpsPill}>
              <Text style={styles.verifiedGpsText}>GPS VERIFIED</Text>
            </View>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>PACE / FOCUS</Text>
              <Text style={styles.metricVal}>{pace || '5:30 / km'}</Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>HEIGHT</Text>
              <Text style={styles.metricVal}>{height || "5'8"}</Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>SCHEDULE</Text>
              <Text style={styles.metricVal}>{schedule || 'Mornings'}</Text>
            </View>
          </View>

          <View style={styles.bioCard}>
            <Text style={styles.bioTitle}>TRAINING ETHOS & GOALS</Text>
            <Text style={styles.bioBody}>
              {bio ||
                'Consistency over intensity. Looking for someone to match cadences and stay accountable.'}
            </Text>
          </View>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* PROFILE SETTINGS FORM                                         */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.formContainer}>
        <Text style={styles.formSectionTitle}>PERSONAL & SOCIAL STATUS</Text>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Athlete Name"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
          />
        </View>

        <View style={styles.twoColRow}>
          <View style={[styles.fieldRow, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Age (18+)</Text>
            <TextInput
              style={styles.fieldInput}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="24"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
            />
          </View>

          <View style={[styles.fieldRow, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Height</Text>
            <TextInput
              style={styles.fieldInput}
              value={height}
              onChangeText={setHeight}
              placeholder="5'8"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
            />
          </View>
        </View>

        {/* Gender Selection */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.chipsContainer}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.chipActive]}
                onPress={() => setGender(g)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dating & Fitness Status */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Dating & Fitness Status</Text>
          <TextInput
            style={styles.fieldInput}
            value={datingStatus}
            onChangeText={setDatingStatus}
            placeholder="Add your status"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
          />
          <View style={styles.chipsContainer}>
            {PRESET_STATUSES.map((status, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.statusChip,
                  datingStatus === status && styles.statusChipActive,
                ]}
                onPress={() => setDatingStatus(status)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    datingStatus === status && styles.statusChipTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ANTI-SCAM AUTOMATIC GPS LOCATION (NON-EDITABLE) */}
        <View style={styles.gpsLockBlock}>
          <View style={styles.gpsLockHeader}>
            <View>
              <Text style={styles.fieldLabel}>Automatic GPS Location</Text>
              <Text style={styles.gpsSubNotice}>
                Locked to device hardware to prevent fake locations and scams.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshGpsBtn}
              onPress={detectDeviceLocation}
              disabled={locating}
              activeOpacity={0.7}
            >
              {locating ? (
                <ActivityIndicator size="small" color="#00F0FF" />
              ) : (
                <Text style={styles.refreshGpsText}>REFRESH GPS</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.gpsStatusDisplay}>
            <View style={styles.gpsIndicatorRow}>
              <View
                style={[
                  styles.gpsPulseDot,
                  { backgroundColor: gpsVerified ? '#00F0FF' : '#FFB800' },
                ]}
              />
              <Text style={styles.gpsCityDetectedText}>{gpsCity.toUpperCase()}</Text>
            </View>
            <Text style={styles.gpsCoordsText}>
              {gpsCoords
                ? `LAT: ${gpsCoords.latitude.toFixed(4)} • LON: ${gpsCoords.longitude.toFixed(4)}`
                : 'Acquiring satellite lock...'}
            </Text>
          </View>
        </View>

        {/* Fitness Discipline & Schedule */}
        <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>
          FITNESS METRICS
        </Text>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Primary Discipline</Text>
          <View style={styles.chipsContainer}>
            {FITNESS_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[styles.chip, fitnessMode === mode.id && styles.chipActive]}
                onPress={() => setFitnessMode(mode.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    fitnessMode === mode.id && styles.chipTextActive,
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.twoColRow}>
          <View style={[styles.fieldRow, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Pace / Athletic Goal</Text>
            <TextInput
              style={styles.fieldInput}
              value={pace}
              onChangeText={setPace}
              placeholder="e.g. 5:15 / km"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
            />
          </View>

          <View style={[styles.fieldRow, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Active Schedule</Text>
            <TextInput
              style={styles.fieldInput}
              value={schedule}
              onChangeText={setSchedule}
              placeholder="e.g. 6:00 AM Mornings"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Bio & Training Ethos</Text>
          <TextInput
            style={[styles.fieldInput, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="What keeps you moving? Looking for friendly pacing or athletic accountability?"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Photos */}
        <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>
          SHOWCASE PHOTOS
        </Text>

        <View style={styles.photoThumbnailsRow}>
          {photos.map((pUrl, idx) => (
            <View key={idx} style={styles.thumbWrapper}>
              <Image source={{ uri: pUrl }} style={styles.thumbImg} />
              <TouchableOpacity
                style={styles.deletePhotoBtn}
                onPress={() => handleRemovePhoto(idx)}
              >
                <Text style={styles.deletePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={styles.uploadCardBtn}
            onPress={handlePickPhoto}
            activeOpacity={0.7}
          >
            <Text style={styles.uploadIcon}>+</Text>
            <Text style={styles.uploadLabel}>ADD PHOTO</Text>
          </TouchableOpacity>
        </View>

        {/* SAVE PROFILE BUTTON */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#030812" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>SAVE PROFILE</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 20,
  },
  loadingBox: {
    paddingVertical: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    gap: 6,
    paddingHorizontal: 4,
  },
  radarKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F0FF',
  },
  sectionKicker: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
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

  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  previewLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  previewBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  previewBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  cardWrapper: {
    width: '100%',
    backgroundColor: 'rgba(15, 20, 32, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
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
  },
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinIcon: {
    fontSize: 14,
  },
  locationText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  verifiedGpsPill: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    paddingVertical: 2,
    paddingHorizontal: 7,
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

  /* FORM STYLING */
  formContainer: {
    backgroundColor: 'rgba(16, 22, 34, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 26,
    padding: 22,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(35px)' } : {}),
  },
  formSectionTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  fieldRow: {
    gap: 8,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13.5,
    fontWeight: '700',
  },
  fieldInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#FFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 15,
  },
  bioInput: {
    height: 90,
    textAlignVertical: 'top',
    lineHeight: 22,
  },

  /* GPS LOCK COMPONENT */
  gpsLockBlock: {
    backgroundColor: 'rgba(0, 240, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  gpsLockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  gpsSubNotice: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
    maxWidth: 220,
  },
  refreshGpsBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  refreshGpsText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  gpsStatusDisplay: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  gpsIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gpsCityDetectedText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  gpsCoordsText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '600',
  },

  /* CHIPS */
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  chipActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.16)',
    borderColor: '#00F0FF',
  },
  chipText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#00F0FF',
    fontWeight: '800',
  },

  statusChip: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusChipActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    borderColor: '#FF3B30',
  },
  statusChipText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12.5,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },

  /* THUMBNAILS */
  photoThumbnailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumbWrapper: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: 'bold',
  },
  uploadCardBtn: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 240, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    gap: 4,
  },
  uploadIcon: {
    color: '#00F0FF',
    fontSize: 24,
    fontWeight: '300',
  },
  uploadLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* SAVE BUTTON */
  saveBtn: {
    backgroundColor: '#00F0FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  saveBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#030812',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});