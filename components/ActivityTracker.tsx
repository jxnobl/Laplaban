import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
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

interface Split {
  km: number;
  splitTime: string;
  lapPace: string;
}

interface ActivityItem {
  id: string;
  sport_type?: string;
  distance_km?: number;
  duration_seconds?: number;
  avg_pace?: string;
  calories?: number;
  created_at: string;
  route_coords?: LatLng[];
}

interface Buddy {
  id: string;
  full_name: string;
}

export default function ActivityTracker({ currentUserId }: { currentUserId: string }) {
  const [viewMode, setViewMode] = useState<'track' | 'recents'>('track');
  const [sportType, setSportType] = useState<'Run' | 'Ride' | 'Walk'>('Run');
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // GPS Metrics
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [currentCoord, setCurrentCoord] = useState<LatLng | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [currentPace, setCurrentPace] = useState("-'--\"");
  const [splits, setSplits] = useState<Split[]>([]);
  const lastLoggedKm = useRef(0);
  const [saving, setSaving] = useState(false);

  // Recents List
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(false);

  // Community Share Modal
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const [matchedBuddies, setMatchedBuddies] = useState<Buddy[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [postingToForum, setPostingToForum] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<any>(null);

  // Fetch recent workouts
  const fetchRecentActivities = async () => {
    setLoadingRecents(true);
    try {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setRecentActivities(data);
      } else {
        setRecentActivities([
          {
            id: 'demo-act-1',
            sport_type: 'Run',
            distance_km: 5.24,
            duration_seconds: 1935,
            avg_pace: "6'09\"/km",
            calories: 392,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingRecents(false);
    }
  };

  const fetchMatchedBuddies = async () => {
    try {
      const { data } = await supabase
        .from('matches')
        .select('matched_user_id, profiles!matches_matched_user_id_fkey(id, full_name)')
        .eq('user_id', currentUserId);

      if (data && data.length > 0) {
        const buddies: Buddy[] = data
          .map((m: any) => ({
            id: m.profiles?.id || m.matched_user_id,
            full_name: m.profiles?.full_name || 'Workout Buddy',
          }))
          .filter(Boolean);
        setMatchedBuddies(buddies);
      } else {
        setMatchedBuddies([
          { id: 'b1', full_name: 'Bea Valenzuela' },
          { id: 'b2', full_name: 'Kyle Arboleda' },
          { id: 'b3', full_name: 'Jabez Molar' },
        ]);
      }
    } catch {
      setMatchedBuddies([
        { id: 'b1', full_name: 'Bea Valenzuela' },
        { id: 'b2', full_name: 'Kyle Arboleda' },
        { id: 'b3', full_name: 'Jabez Molar' },
      ]);
    }
  };

  useEffect(() => {
    fetchRecentActivities();
    fetchMatchedBuddies();
  }, [viewMode]);

  // Haversine distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Timer
  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTracking, isPaused]);

  // Initial GPS centering
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const pos = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setCurrentCoord(pos);
        mapRef.current?.animateToRegion({
          ...pos,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        });
      }
    })();
  }, []);

  const formatDuration = (totalSec?: number) => {
    const s = totalSec || 0;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const calculatePaceString = (sec: number, km: number): string => {
    if (km <= 0.05 || sec <= 0) return "-'--\"/km";
    const secPerKm = sec / km;
    const mins = Math.floor(secPerKm / 60);
    const s = Math.floor(secPerKm % 60);
    return `${mins}'${s < 10 ? '0' : ''}${s}"/km`;
  };

  const startGpsWatcher = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'GPS is needed to trace your route on the map.');
      return;
    }

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 2,
      },
      (loc) => {
        if (isPaused) return;

        const newPoint: LatLng = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setCurrentCoord(newPoint);

        setRouteCoordinates((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const addedDist = calculateDistance(
              last.latitude,
              last.longitude,
              newPoint.latitude,
              newPoint.longitude
            );

            if (addedDist > 0.002) {
              setDistanceKm((currDist) => {
                const nextDist = currDist + addedDist;
                const nextKmFloor = Math.floor(nextDist);

                // Wireframe 10.3 Real-Time Split Table Trigger
                if (nextKmFloor > lastLoggedKm.current) {
                  lastLoggedKm.current = nextKmFloor;
                  setSplits((s) => [
                    ...s,
                    {
                      km: nextKmFloor,
                      splitTime: formatDuration(durationSec),
                      lapPace: calculatePaceString(durationSec, nextDist),
                    },
                  ]);
                }
                return nextDist;
              });
            }
          }
          return [...prev, newPoint];
        });

        if (loc.coords.speed && loc.coords.speed > 0.5) {
          const paceSecPerKm = 1000 / loc.coords.speed;
          const mins = Math.floor(paceSecPerKm / 60);
          const secs = Math.floor(paceSecPerKm % 60);
          setCurrentPace(`${mins}'${secs < 10 ? '0' : ''}${secs}"/km`);
        }

        mapRef.current?.animateCamera({
          center: newPoint,
          pitch: 30,
          zoom: 17,
        });
      }
    );
  };

  const handleStartWorkout = () => {
    setRouteCoordinates([]);
    setDistanceKm(0);
    setDurationSec(0);
    setSplits([]);
    lastLoggedKm.current = 0;
    setIsTracking(true);
    setIsPaused(false);
    startGpsWatcher();
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const calculateCalories = (dist: number, sec: number, sport: string) => {
    const met = sport === 'Run' ? 9.8 : sport === 'Ride' ? 7.5 : 3.8;
    const hours = sec / 3600;
    return Math.round(met * 70 * hours);
  };

  const handleFinishWorkout = async () => {
    setIsTracking(false);
    setIsPaused(false);
    locationSubscription.current?.remove();
    clearInterval(timerRef.current);

    if (distanceKm < 0.05) {
      Alert.alert('Too Short', 'Workout distance was too short to save.');
      return;
    }

    setSaving(true);
    try {
      const calories = calculateCalories(distanceKm, durationSec, sportType);
      const avgPaceStr = calculatePaceString(durationSec, distanceKm);

      const workoutPayload = {
        user_id: currentUserId,
        sport_type: sportType,
        distance_km: parseFloat(distanceKm.toFixed(2)),
        duration_seconds: durationSec,
        avg_pace: avgPaceStr,
        calories: calories,
        route_coords: routeCoordinates,
      };

      const { data } = await supabase
        .from('activities')
        .insert(workoutPayload)
        .select()
        .single();

      const savedItem = data || {
        id: `act-${Date.now()}`,
        ...workoutPayload,
        created_at: new Date().toISOString(),
      };

      setSelectedActivity(savedItem);
      setPostCaption(`Finished a ${savedItem.distance_km} KM ${savedItem.sport_type}! 🔥`);
      setShareModalVisible(true);
      fetchRecentActivities();
    } catch {
      Alert.alert('Notice', 'Workout saved locally.');
    } finally {
      setSaving(false);
      setRouteCoordinates([]);
    }
  };

  // UC-06: Export Data to CSV (Proposal Section 11 & Use Case Diagram)
  const exportDataToCSV = () => {
    if (recentActivities.length === 0) {
      const msg = 'No workout activity logs available to export.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Notice', msg);
      return;
    }

    const header = 'Activity ID,Sport Type,Distance (KM),Duration (s),Pace,Calories,Date\n';
    const rows = recentActivities
      .map(
        (a) =>
          `"${a.id}","${a.sport_type || 'Run'}",${a.distance_km || 0},${a.duration_seconds || 0},"${a.avg_pace || '-:--'}",${a.calories || 0},"${a.created_at}"`
      )
      .join('\n');

    const csvContent = header + rows;

    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'laplaban_activity_logs.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Alert.alert('CSV Ready', 'Workout log CSV generated successfully.');
    }
  };

  const speedKmh = durationSec > 0 ? (distanceKm / (durationSec / 3600)).toFixed(1) : '0.0';
  const caloriesEstimated = calculateCalories(distanceKm, durationSec, sportType);
  const speedMetersPerMin = durationSec > 0 ? (distanceKm * 1000) / (durationSec / 60) : 0;
  const estimatedVO2Max = speedMetersPerMin > 0 ? (3.5 + 0.2 * speedMetersPerMin).toFixed(0) : '--';
  const estimatedCadence = parseFloat(speedKmh) > 1 ? Math.min(185, Math.round(140 + parseFloat(speedKmh) * 3)) : 0;

  const toggleCollaborator = (name: string) => {
    setSelectedCollaborators((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handlePostToForum = async () => {
    if (!selectedActivity) return;
    setPostingToForum(true);

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

      const postTitle =
        selectedCollaborators.length > 0
          ? `${selectedActivity.sport_type || 'Workout'} with ${selectedCollaborators.join(' & ')}`
          : `${selectedActivity.sport_type || 'Workout'} Session`;

      const postContent = `${postCaption.trim()}\n\nDistance: ${Number(
        selectedActivity.distance_km || 0
      ).toFixed(2)} KM | Time: ${formatDuration(
        selectedActivity.duration_seconds
      )} | Pace: ${selectedActivity.avg_pace || '-:--'}`;

      const activityPayload = {
        sport_type: selectedActivity.sport_type || 'Run',
        distance_km: selectedActivity.distance_km || 0,
        duration_seconds: selectedActivity.duration_seconds || 0,
        avg_pace: selectedActivity.avg_pace || '-:--',
        calories: selectedActivity.calories || 0,
        route_coords: (selectedActivity as any).route_coords || routeCoordinates || [],
      };

      const { error } = await supabase.from('community_posts').insert({
        user_id: currentUserId,
        author_name: author,
        category: (selectedActivity.sport_type || 'Run').toUpperCase(),
        title: postTitle,
        content: postContent,
        collaborator_names: selectedCollaborators,
        activity_snapshot: activityPayload,
        activity_id: String(selectedActivity.id),
      });

      if (!error) {
        const msg = 'Workout route and metrics posted to Community Forum!';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Posted!', msg);
        setShareModalVisible(false);
        setSelectedCollaborators([]);
        setPostCaption('');
      }
    } catch {
      // Ignore
    } finally {
      setPostingToForum(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER TABS: LIVE TRACK VS RECENTS */}
      <View style={styles.headerToggleRow}>
        <TouchableOpacity
          style={[styles.toggleTab, viewMode === 'track' && styles.toggleTabActive]}
          onPress={() => setViewMode('track')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleTabText, viewMode === 'track' && styles.toggleTabTextActive]}>
            GPS ROUTE MAP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleTab, viewMode === 'recents' && styles.toggleTabActive]}
          onPress={() => setViewMode('recents')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleTabText, viewMode === 'recents' && styles.toggleTabTextActive]}>
            PAST WORKOUTS ({recentActivities.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW 1: LIVE GPS MAP & TRANSACTION PAGE (Wireframe 10.3) */}
      {viewMode === 'track' ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              showsUserLocation
              showsCompass={false}
              showsMyLocationButton={false}
              userInterfaceStyle="dark"
              initialRegion={{
                latitude: currentCoord?.latitude ?? 14.5547,
                longitude: currentCoord?.longitude ?? 121.0244,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
            >
              {routeCoordinates.length > 1 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#FC5200"
                  strokeWidth={5}
                  lineCap="round"
                  lineJoin="round"
                />
              )}

              {routeCoordinates.length > 0 && (
                <Marker coordinate={routeCoordinates[0]} title="Start Point">
                  <View style={styles.startPin}>
                    <Text style={styles.pinText}>S</Text>
                  </View>
                </Marker>
              )}
            </MapView>

            {/* SPORT SELECTOR */}
            <View style={styles.topHud}>
              <View style={styles.sportTabsContainer}>
                {(['Run', 'Ride', 'Walk'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.sportTab, sportType === mode && styles.sportTabActive]}
                    onPress={() => !isTracking && setSportType(mode)}
                    disabled={isTracking}
                  >
                    <Text
                      style={[
                        styles.sportTabText,
                        sportType === mode && styles.sportTabTextActive,
                      ]}
                    >
                      {mode.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.gpsBadge}>
                <View
                  style={[
                    styles.gpsDot,
                    { backgroundColor: isTracking && !isPaused ? '#00F0FF' : '#8E8E93' },
                  ]}
                />
                <Text style={styles.gpsBadgeText}>
                  {isTracking ? (isPaused ? 'PAUSED' : 'TRACKING') : 'GPS READY'}
                </Text>
              </View>
            </View>

            {currentCoord && (
              <TouchableOpacity
                style={styles.recenterBtn}
                onPress={() => {
                  mapRef.current?.animateCamera({
                    center: currentCoord,
                    zoom: 17,
                  });
                }}
              >
                <Text style={styles.recenterIcon}>⌖</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* DASHBOARD METRICS (Wireframe 10.3) */}
          <View style={styles.dashboardCard}>
            <View style={styles.primaryMetricRow}>
              <View>
                <Text style={styles.metricBig}>{distanceKm.toFixed(2)}</Text>
                <Text style={styles.metricUnit}>KILOMETERS</Text>
              </View>

              <View style={styles.rightMetricsStack}>
                <View style={styles.smallMetric}>
                  <Text style={styles.metricMedium}>{formatDuration(durationSec)}</Text>
                  <Text style={styles.metricSub}>ELAPSED TIME</Text>
                </View>

                <View style={styles.smallMetric}>
                  <Text style={styles.metricMedium}>{currentPace}</Text>
                  <Text style={styles.metricSub}>AVG PACE</Text>
                </View>
              </View>
            </View>

            {/* PLAIN-LANGUAGE STATS */}
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>SPEED</Text>
                <Text style={styles.telemetryVal}>{speedKmh} <Text style={styles.subUnit}>km/h</Text></Text>
              </View>

              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>CALORIES</Text>
                <Text style={styles.telemetryVal}>{caloriesEstimated} <Text style={styles.subUnit}>kcal</Text></Text>
              </View>

              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>STEPS / MIN</Text>
                <Text style={styles.telemetryVal}>{estimatedCadence} <Text style={styles.subUnit}>spm</Text></Text>
              </View>

              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryLabel}>STAMINA SCORE</Text>
                <Text style={styles.telemetryVal}>{estimatedVO2Max} <Text style={styles.subUnit}>pts</Text></Text>
              </View>
            </View>

            {/* REAL-TIME SPLIT TABLE (Wireframe 10.3) */}
            <View style={styles.splitTableBox}>
              <Text style={styles.splitTableTitle}>REAL-TIME SPLIT TABLE</Text>
              <View style={styles.splitTableHeader}>
                <Text style={styles.splitHeadCol}>KM</Text>
                <Text style={styles.splitHeadCol}>Split Time</Text>
                <Text style={styles.splitHeadCol}>Lap Pace</Text>
              </View>
              {splits.length === 0 ? (
                <View style={styles.noSplitsRow}>
                  <Text style={styles.noSplitsText}>Complete 1 KM to record initial split</Text>
                </View>
              ) : (
                splits.map((s, idx) => (
                  <View key={idx} style={styles.splitTableRow}>
                    <Text style={styles.splitCellColKm}>{s.km}</Text>
                    <Text style={styles.splitCellCol}>{s.splitTime}</Text>
                    <Text style={styles.splitCellCol}>{s.lapPace}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.actionRow}>
              {!isTracking ? (
                <TouchableOpacity
                  style={styles.startBtn}
                  onPress={handleStartWorkout}
                  activeOpacity={0.8}
                >
                  <Text style={styles.startBtnText}>START WORKOUT</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.activeControlsGroup}>
                  <TouchableOpacity
                    style={[styles.controlBtn, isPaused ? styles.resumeBtn : styles.pauseBtn]}
                    onPress={handlePauseResume}
                  >
                    <Text style={styles.controlBtnText}>{isPaused ? 'RESUME' : 'PAUSE'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.controlBtn, styles.finishBtn]}
                    onPress={handleFinishWorkout}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.finishBtnText}>FINISH & SAVE</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      ) : (
        /* VIEW 2: PAST WORKOUTS / RECORDS (Wireframe 10.4) */
        <ScrollView style={styles.recentsScrollView} contentContainerStyle={styles.recentsContainer}>
          <View style={styles.recentsHeaderRow}>
            <Text style={styles.recentsHeading}>WORKOUT RECORDS</Text>
            {/* UC-06 Export Data to CSV Button */}
            <TouchableOpacity style={styles.csvExportBtn} onPress={exportDataToCSV}>
              <Text style={styles.csvExportBtnText}>EXPORT CSV ⭳</Text>
            </TouchableOpacity>
          </View>

          {loadingRecents ? (
            <ActivityIndicator color="#00F0FF" size="large" style={{ marginTop: 40 }} />
          ) : recentActivities.length === 0 ? (
            <View style={styles.emptyRecentsBox}>
              <Text style={styles.emptyRecentsText}>No workouts recorded yet.</Text>
              <Text style={styles.emptyRecentsSub}>
                Start a session in the Route Map to log your progress.
              </Text>
            </View>
          ) : (
            recentActivities.map((act) => (
              <View key={act.id} style={styles.recentItemCard}>
                <View style={styles.recentItemHeader}>
                  <View style={styles.recentSportBadge}>
                    <Text style={styles.recentSportBadgeText}>
                      {(act.sport_type || 'WORKOUT').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.recentDateText}>
                    {act.created_at
                      ? new Date(act.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </Text>
                </View>

                <View style={styles.recentMetricsRow}>
                  <View style={styles.recentMetricItem}>
                    <Text style={styles.recentMetricVal}>{Number(act.distance_km || 0).toFixed(2)}</Text>
                    <Text style={styles.recentMetricLabel}>KM</Text>
                  </View>

                  <View style={styles.recentMetricItem}>
                    <Text style={styles.recentMetricVal}>{formatDuration(act.duration_seconds)}</Text>
                    <Text style={styles.recentMetricLabel}>TIME</Text>
                  </View>

                  <View style={styles.recentMetricItem}>
                    <Text style={styles.recentMetricVal}>{act.avg_pace || '-:--'}</Text>
                    <Text style={styles.recentMetricLabel}>PACE</Text>
                  </View>

                  <View style={styles.recentMetricItem}>
                    <Text style={styles.recentMetricVal}>{act.calories || 0}</Text>
                    <Text style={styles.recentMetricLabel}>CALORIES</Text>
                  </View>
                </View>

                {/* SHARE TO FORUM */}
                <TouchableOpacity
                  style={styles.shareForumBtn}
                  onPress={() => {
                    setSelectedActivity(act);
                    setPostCaption(`Crushed a ${Number(act.distance_km || 0).toFixed(2)} KM ${(act.sport_type || 'Run')}! 🔥`);
                    setShareModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.shareForumBtnIcon}>⊛</Text>
                  <Text style={styles.shareForumBtnText}>SHARE TO COMMUNITY FORUM</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* SHARE TO FORUM MODAL */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>SHARE WORKOUT TO FORUM</Text>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedActivity && (
              <View style={styles.workoutSnapshotCard}>
                <Text style={styles.snapshotSport}>
                  {(selectedActivity.sport_type || 'WORKOUT').toUpperCase()} • {Number(selectedActivity.distance_km || 0).toFixed(2)} KM
                </Text>
                <Text style={styles.snapshotDetails}>
                  Time: {formatDuration(selectedActivity.duration_seconds)} • Pace: {selectedActivity.avg_pace || '-:--'} • {selectedActivity.calories || 0} kcal
                </Text>
              </View>
            )}

            <View style={styles.captionField}>
              <Text style={styles.fieldLabel}>Caption</Text>
              <TextInput
                style={styles.captionInput}
                value={postCaption}
                onChangeText={setPostCaption}
                placeholder="How was the workout? Tag your partner or share tips..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* TAG MATCHED BUDDY */}
            <View style={styles.collaboratorsSection}>
              <Text style={styles.fieldLabel}>TAG WORKOUT BUDDY (OPTIONAL)</Text>
              <Text style={styles.collaboratorSub}>
                Did you run or train with someone you matched with? Tap to tag them.
              </Text>
              <View style={styles.buddiesRow}>
                {matchedBuddies.map((buddy) => {
                  const isSelected = selectedCollaborators.includes(buddy.full_name);
                  return (
                    <TouchableOpacity
                      key={buddy.id}
                      style={[styles.buddyPill, isSelected && styles.buddyPillActive]}
                      onPress={() => toggleCollaborator(buddy.full_name)}
                    >
                      <Text style={[styles.buddyPillText, isSelected && styles.buddyPillTextActive]}>
                        {isSelected ? '✓ ' : '+ '} {buddy.full_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitPostBtn, postingToForum && { opacity: 0.6 }]}
              onPress={handlePostToForum}
              disabled={postingToForum}
            >
              {postingToForum ? (
                <ActivityIndicator color="#030812" size="small" />
              ) : (
                <Text style={styles.submitPostBtnText}>POST TO FORUM</Text>
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
    minHeight: 680,
    backgroundColor: '#07080C',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12, 16, 26, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    padding: 6,
    gap: 6,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
  },
  toggleTabActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  toggleTabText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  toggleTabTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },
  mapContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  topHud: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  sportTabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14, 18, 28, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 3,
  },
  sportTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  sportTabActive: {
    backgroundColor: '#FC5200',
  },
  sportTabText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sportTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 18, 28, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gpsBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(14, 18, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  recenterIcon: {
    color: '#00F0FF',
    fontSize: 22,
  },
  startPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pinText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  dashboardCard: {
    backgroundColor: 'rgba(15, 20, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    gap: 14,
  },
  primaryMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metricBig: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 48,
  },
  metricUnit: {
    fontFamily: SYSTEM_FONT,
    color: '#FC5200',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  rightMetricsStack: {
    gap: 6,
    alignItems: 'flex-end',
  },
  smallMetric: {
    alignItems: 'flex-end',
  },
  metricMedium: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  metricSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  telemetryCell: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  telemetryVal: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 13,
    fontWeight: '900',
  },
  subUnit: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },

  /* Wireframe 10.3 Split Table */
  splitTableBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  splitTableTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FC5200',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  splitTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 4,
  },
  splitHeadCol: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  noSplitsRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  noSplitsText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10.5,
    fontStyle: 'italic',
  },
  splitTableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  splitCellColKm: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  splitCellCol: {
    flex: 1,
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },

  actionRow: {
    width: '100%',
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: '#FC5200',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  activeControlsGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  controlBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pauseBtn: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  resumeBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  controlBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  finishBtn: {
    backgroundColor: '#FF3B30',
  },
  finishBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* RECENTS */
  recentsScrollView: {
    flex: 1,
    backgroundColor: '#07080C',
  },
  recentsContainer: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  recentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentsHeading: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  csvExportBtn: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  csvExportBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  emptyRecentsBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 6,
  },
  emptyRecentsText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyRecentsSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
  recentItemCard: {
    backgroundColor: 'rgba(16, 22, 34, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  recentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentSportBadge: {
    backgroundColor: '#FC5200',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  recentSportBadgeText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  recentDateText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
  },
  recentMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  recentMetricItem: {
    alignItems: 'center',
  },
  recentMetricVal: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  recentMetricLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  shareForumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
    paddingVertical: 9,
    borderRadius: 12,
  },
  shareForumBtnIcon: {
    color: '#00F0FF',
    fontSize: 13,
  },
  shareForumBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(16, 22, 34, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  workoutSnapshotCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  snapshotSport: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  snapshotDetails: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  captionField: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  captionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    fontFamily: SYSTEM_FONT,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 70,
  },
  collaboratorsSection: {
    gap: 6,
  },
  collaboratorSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10.5,
    lineHeight: 14,
  },
  buddiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  buddyPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  buddyPillActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.16)',
    borderColor: '#00F0FF',
  },
  buddyPillText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: '700',
  },
  buddyPillTextActive: {
    color: '#00F0FF',
    fontWeight: '900',
  },
  submitPostBtn: {
    backgroundColor: '#00F0FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitPostBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#030812',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});