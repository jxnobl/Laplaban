import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface ActivityTrackerProps {
  currentUserId: string;
}

type ActivityType = 'Runner' | 'Biker' | 'Walker' | 'Gym';

const ACTIVITIES: { key: ActivityType; label: string; icon: string; met: number }[] = [
  { key: 'Runner', label: 'RUN', icon: '🏃', met: 9.8 },
  { key: 'Biker', label: 'RIDE', icon: '🚴', met: 7.5 },
  { key: 'Walker', label: 'WALK', icon: '🚶', met: 3.8 },
  { key: 'Gym', label: 'LIFT', icon: '🏋️', met: 6.0 },
];

const APPLE_FONT =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"
    : undefined;

export default function ActivityTracker({ currentUserId }: ActivityTrackerProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('Runner');
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Manual / Tuned Inputs
  const [distanceKm, setDistanceKm] = useState('5.0');
  const [manualDurationMin, setManualDurationMin] = useState('30');
  const [gymSets, setGymSets] = useState('4');
  const [gymReps, setGymReps] = useState('12');
  const [gymWeightKg, setGymWeightKg] = useState('60');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when live tracking
  useEffect(() => {
    if (isLiveTracking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLiveTracking]);

  // Live Stopwatch Handler
  useEffect(() => {
    if (isLiveTracking) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isLiveTracking]);

  // Fetch logged activity history
  const fetchHistory = async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) setHistory(data);
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUserId]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Dynamic Activity Physics & Calculations
  const computeMetrics = () => {
    const activeSeconds = isLiveTracking ? secondsElapsed : (parseFloat(manualDurationMin) || 0) * 60;
    const dist = parseFloat(distanceKm) || 0;
    const durationHrs = activeSeconds / 3600;
    const standardWeightKg = 70; // baseline body weight

    let calories = 0;
    let primaryStatLabel = '';
    let primaryStatVal = '';
    let secondaryStatLabel = '';
    let secondaryStatVal = '';

    if (selectedActivity === 'Runner') {
      // Pace: min/km
      if (dist > 0 && activeSeconds > 0) {
        const paceSecPerKm = activeSeconds / dist;
        const pMins = Math.floor(paceSecPerKm / 60);
        const pSecs = Math.floor(paceSecPerKm % 60);
        primaryStatVal = `${pMins}:${pSecs < 10 ? '0' : ''}${pSecs} /km`;
      } else {
        primaryStatVal = '--:-- /km';
      }
      primaryStatLabel = 'AVG PACE';
      // Cadence estimate: ~162 spm
      secondaryStatLabel = 'CADENCE';
      secondaryStatVal = dist > 0 ? '164 SPM' : '-- SPM';
      calories = Math.round(dist * standardWeightKg * 1.036);
    } else if (selectedActivity === 'Biker') {
      // Speed: km/h
      const speed = durationHrs > 0 ? (dist / durationHrs).toFixed(1) : '0.0';
      primaryStatLabel = 'AVG SPEED';
      primaryStatVal = `${speed} KM/H`;
      secondaryStatLabel = 'EST. POWER';
      secondaryStatVal = dist > 0 ? `${Math.round(dist * 28)} WATTS` : '-- W';
      calories = Math.round(7.5 * standardWeightKg * (durationHrs || 0.1));
    } else if (selectedActivity === 'Walker') {
      // Steps: ~1320 steps per km
      const steps = Math.round(dist * 1320);
      primaryStatLabel = 'EST. STEPS';
      primaryStatVal = `${steps.toLocaleString()}`;
      const speed = durationHrs > 0 ? (dist / durationHrs).toFixed(1) : '0.0';
      secondaryStatLabel = 'SPEED';
      secondaryStatVal = `${speed} KM/H`;
      calories = Math.round(3.8 * standardWeightKg * (durationHrs || 0.1));
    } else {
      // Gym
      const sets = parseInt(gymSets, 10) || 0;
      const reps = parseInt(gymReps, 10) || 0;
      const weight = parseFloat(gymWeightKg) || 0;
      const tonnage = (sets * reps * weight) / 1000;
      primaryStatLabel = 'TOTAL TONNAGE';
      primaryStatVal = `${tonnage.toFixed(1)} TONS`;
      secondaryStatLabel = 'EST. HEART RATE';
      secondaryStatVal = '134 BPM (ZONE 3)';
      calories = Math.round(6.0 * standardWeightKg * (durationHrs || 0.5));
    }

    return {
      activeSeconds,
      calories: Math.max(calories, 1),
      primaryStatLabel,
      primaryStatVal,
      secondaryStatLabel,
      secondaryStatVal,
    };
  };

  const computed = computeMetrics();

  const handleSaveActivity = async () => {
    setSaving(true);
    setStatusMsg('');

    const dist = selectedActivity === 'Gym' ? 0 : parseFloat(distanceKm) || 0;
    const duration = computed.activeSeconds;

    const { error } = await supabase.from('activities').insert([
      {
        user_id: currentUserId,
        activity_type: selectedActivity,
        title: `${selectedActivity.toUpperCase()} SESSION`,
        duration_seconds: duration,
        distance_km: dist,
        calories_burned: computed.calories,
        avg_pace: computed.primaryStatVal,
        metrics: {
          secondary: computed.secondaryStatVal,
          secondary_label: computed.secondaryStatLabel,
        },
        notes: notes.trim(),
      },
    ]);

    setSaving(false);

    if (error) {
      setStatusMsg(`Failed to save: ${error.message}`);
    } else {
      setStatusMsg('Activity successfully committed to timeline!');
      setIsLiveTracking(false);
      setSecondsElapsed(0);
      setNotes('');
      fetchHistory();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Activity Mode Segmented Glass */}
      <View style={styles.modeRow}>
        {ACTIVITIES.map((act) => {
          const isSelected = selectedActivity === act.key;
          return (
            <TouchableOpacity
              key={act.key}
              style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
              onPress={() => setSelectedActivity(act.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.modeIcon}>{act.icon}</Text>
              <Text style={[styles.modeLabel, isSelected && styles.modeLabelActive]}>
                {act.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Telemetry & Apple Glass HUD */}
      <View style={styles.telemetryCard}>
        <View style={styles.hudTopBar}>
          <View style={styles.activityBadge}>
            <Text style={styles.activityBadgeText}>{selectedActivity.toUpperCase()} SESSION</Text>
          </View>
          <View style={styles.liveIndicatorRow}>
            <Animated.View
              style={[
                styles.livePulseDot,
                { transform: [{ scale: pulseAnim }] },
                isLiveTracking ? { backgroundColor: '#00F0FF' } : { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            />
            <Text style={styles.liveText}>{isLiveTracking ? 'LIVE TRACKING' : 'READY'}</Text>
          </View>
        </View>

        {/* Stopwatch Readout */}
        <View style={styles.stopwatchCenter}>
          <Text style={styles.stopwatchTime}>
            {isLiveTracking
              ? formatTimer(secondsElapsed)
              : formatTimer((parseFloat(manualDurationMin) || 0) * 60)}
          </Text>
          <Text style={styles.stopwatchSub}>ELAPSED TIME</Text>
        </View>

        {/* Dynamic Computed Metric Capsules */}
        <View style={styles.metricGrid}>
          <View style={styles.metricCapsule}>
            <Text style={styles.capsuleHeader}>CALORIES</Text>
            <Text style={styles.capsuleLargeVal}>{computed.calories}</Text>
            <Text style={styles.capsuleUnit}>KCAL BURNED</Text>
          </View>

          {selectedActivity !== 'Gym' ? (
            <View style={styles.metricCapsule}>
              <Text style={styles.capsuleHeader}>DISTANCE</Text>
              <Text style={styles.capsuleLargeVal}>{distanceKm || '0.0'}</Text>
              <Text style={styles.capsuleUnit}>KILOMETERS</Text>
            </View>
          ) : (
            <View style={styles.metricCapsule}>
              <Text style={styles.capsuleHeader}>VOLUME</Text>
              <Text style={styles.capsuleLargeVal}>
                {((parseInt(gymSets, 10) || 0) * (parseInt(gymReps, 10) || 0))}
              </Text>
              <Text style={styles.capsuleUnit}>TOTAL REPS</Text>
            </View>
          )}

          <View style={styles.metricCapsule}>
            <Text style={styles.capsuleHeader}>{computed.primaryStatLabel}</Text>
            <Text style={styles.capsuleLargeVal}>{computed.primaryStatVal}</Text>
            <Text style={styles.capsuleUnit}>TARGET RATE</Text>
          </View>

          <View style={styles.metricCapsule}>
            <Text style={styles.capsuleHeader}>{computed.secondaryStatLabel}</Text>
            <Text style={styles.capsuleLargeVal}>{computed.secondaryStatVal}</Text>
            <Text style={styles.capsuleUnit}>EFFICIENCY</Text>
          </View>
        </View>

        {/* Live Controls */}
        <View style={styles.controlRow}>
          {!isLiveTracking ? (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => setIsLiveTracking(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.startBtnText}>START LIVE TRACKER</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={() => setIsLiveTracking(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.pauseBtnText}>PAUSE SESSION</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Manual Metric Adjusters */}
      <Text style={styles.sectionTitle}>Input Calibration</Text>
      <View style={styles.glassGroup}>
        {selectedActivity !== 'Gym' ? (
          <>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Distance (KM)</Text>
              <TextInput
                style={styles.inputField}
                value={distanceKm}
                onChangeText={setDistanceKm}
                keyboardType="numeric"
                placeholder="5.0"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
            </View>
            <View style={styles.divider} />
          </>
        ) : (
          <>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Sets × Reps</Text>
              <View style={styles.gymInputRow}>
                <TextInput
                  style={[styles.inputField, { width: 50, textAlign: 'center' }]}
                  value={gymSets}
                  onChangeText={setGymSets}
                  keyboardType="numeric"
                />
                <Text style={{ color: 'rgba(255,255,255,0.4)' }}>×</Text>
                <TextInput
                  style={[styles.inputField, { width: 50, textAlign: 'center' }]}
                  value={gymReps}
                  onChangeText={setGymReps}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Load (KG)</Text>
              <TextInput
                style={styles.inputField}
                value={gymWeightKg}
                onChangeText={setGymWeightKg}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
            </View>
            <View style={styles.divider} />
          </>
        )}

        {!isLiveTracking && (
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Duration (Mins)</Text>
            <TextInput
              style={styles.inputField}
              value={manualDurationMin}
              onChangeText={setManualDurationMin}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </View>
        )}
      </View>

      {/* Session Notes */}
      <Text style={styles.sectionTitle}>Session Notes</Text>
      <View style={styles.glassGroup}>
        <TextInput
          style={styles.notesArea}
          placeholder="Felt strong, pushed cadence along Ayala Triangle loops..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      {statusMsg ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMsg}</Text>
        </View>
      ) : null}

      {/* Commit Activity Button */}
      <TouchableOpacity
        style={[styles.saveActivityBtn, saving && { opacity: 0.6 }]}
        onPress={handleSaveActivity}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.saveActivityBtnText}>SAVE & COMMIT SESSION</Text>
        )}
      </TouchableOpacity>

      {/* Recent Activity Timeline */}
      <Text style={styles.sectionTitle}>Recent Activities</Text>
      {history.length > 0 ? (
        history.map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyTop}>
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historyDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.historyStatsRow}>
              <Text style={styles.historyStatPill}>🔥 {item.calories_burned} kcal</Text>
              {item.distance_km > 0 ? (
                <Text style={styles.historyStatPill}>📍 {item.distance_km} km</Text>
              ) : null}
              <Text style={styles.historyStatPill}>⏱️ {Math.round(item.duration_seconds / 60)} min</Text>
              {item.avg_pace ? (
                <Text style={styles.historyStatPill}>⚡ {item.avg_pace}</Text>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyHistoryBox}>
          <Text style={styles.emptyHistoryText}>No workouts recorded yet. Start tracking above!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 130, // Clearance for bottom dock
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  modeBtnActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  modeIcon: {
    fontSize: 14,
  },
  modeLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeLabelActive: {
    color: '#FFF',
    fontWeight: '900',
  },
  telemetryCard: {
    backgroundColor: 'rgba(16, 18, 25, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 18,
    gap: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  hudTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  activityBadgeText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stopwatchCenter: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  stopwatchTime: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  stopwatchSub: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCapsule: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  capsuleHeader: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  capsuleLargeVal: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontSize: 16,
    fontWeight: '800',
  },
  capsuleUnit: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 8,
    fontWeight: '700',
  },
  controlRow: {
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: '#00F0FF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.35,
    shadowRadius: 15,
  },
  startBtnText: {
    fontFamily: APPLE_FONT,
    color: '#000',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pauseBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  pauseBtnText: {
    fontFamily: APPLE_FONT,
    color: '#FF3B30',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
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
  inputLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    width: 120,
    fontWeight: '500',
  },
  inputField: {
    fontFamily: APPLE_FONT,
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    padding: 0,
  },
  gymInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notesArea: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 13,
    padding: 14,
    height: 70,
    textAlignVertical: 'top',
  },
  statusBanner: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  statusText: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontSize: 11.5,
    textAlign: 'center',
    fontWeight: '600',
  },
  saveActivityBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  saveActivityBtnText: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTitle: {
    fontFamily: APPLE_FONT,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  historyDate: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
  },
  historyStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyStatPill: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  emptyHistoryBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
  },
});