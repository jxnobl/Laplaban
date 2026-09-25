import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { supabase } from './lib/supabase';
import FinderDeck from './components/FinderDeck';
import CommunityForum from './components/CommunityForum';
import MatchesList from './components/MatchesList';
import ProfileSettings from './components/ProfileSettings';
import ActivityTracker from './components/ActivityTracker';
import LapBotModal from './components/LapBotModal';
import ChatModal from './components/ChatModal';

const SYSTEM_FONT =
  Platform.OS === 'ios'
    ? 'SF Pro Display'
    : Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
    : undefined;

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<'deck' | 'community' | 'track' | 'lapbot' | 'profile' | 'inbox'>('deck');
  const [selectedBuddy, setSelectedBuddy] = useState<any>(null);

  // Settings & Deactivation Modal State
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deactivating, setDeactivating] = useState(false);

  // Unread badge pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both email and password.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setAuthError(error.message);
      } else if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: email.split('@')[0],
          fitness_mode: 'Runner Finder',
          dating_status: 'Single & Ready to Lap 🏃‍♂️',
          city: 'Metro Manila',
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setAuthError(error.message);
      }
    }

    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    setSettingsModalVisible(false);
    await supabase.auth.signOut();
    setSelectedBuddy(null);
  };

  // Explicit Deactivation / Account Deletion Confirmation
  const handleDeactivateAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      const msg = 'Please type the word DELETE exactly to confirm deactivation.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Confirmation Required', msg);
      return;
    }

    setDeactivating(true);

    try {
      const userId = session?.user?.id;
      if (userId) {
        // Delete user's public profile data and activities
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.from('activities').delete().eq('user_id', userId);
        await supabase.from('community_posts').delete().eq('user_id', userId);
      }

      await supabase.auth.signOut();
      setDeactivateModalVisible(false);
      setSettingsModalVisible(false);
      setDeleteConfirmationText('');

      const successMsg = 'Your account and athlete radar data have been permanently deactivated.';
      Platform.OS === 'web' ? window.alert(successMsg) : Alert.alert('Deactivated', successMsg);
    } catch (err: any) {
      const errorMsg = err.message || 'Error deactivating account.';
      Platform.OS === 'web' ? window.alert(errorMsg) : Alert.alert('Error', errorMsg);
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="small" color="#FF3B30" />
      </View>
    );
  }

  // AUTHENTICATION SCREEN
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authWrapper}>
          <View style={styles.authGlassCard}>
            <View style={styles.authLogoRow}>
              <Image source={require('./assets/logo.png')} style={styles.appLogo} />
              <View>
                <Text style={styles.authBrandTitle}>L A P L A B A N</Text>
                <Text style={styles.authBrandSubtitle}>VELOCITY SOCIAL RADAR</Text>
              </View>
            </View>

            <Text style={styles.authHeading}>
              {isSignUp ? 'Create Athlete Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.authSubheading}>
              Find running partners, gym spotters, and cardio soulmates.
            </Text>

            {authError ? (
              <View style={styles.authErrorBanner}>
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            ) : null}

            <View style={styles.authInputsGroup}>
              <View style={styles.authInputRow}>
                <Text style={styles.authInputLabel}>Email</Text>
                <TextInput
                  style={styles.authTextInput}
                  placeholder="runner@laplaban.ph"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <View style={styles.authDivider} />
              <View style={styles.authInputRow}>
                <Text style={styles.authInputLabel}>Password</Text>
                <TextInput
                  style={styles.authTextInput}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255, 255, 255, 0.25)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryAuthBtn, authLoading && { opacity: 0.6 }]}
              onPress={handleAuth}
              disabled={authLoading}
              activeOpacity={0.8}
            >
              {authLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryAuthBtnText}>
                  {isSignUp ? 'REGISTER PROFILE' : 'ENTER RADAR'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.authToggleBtn}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.authToggleText}>
                {isSignUp
                  ? 'Already registered? Sign In'
                  : "Don't have an athlete account? Register"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.viewportFrame}>
        {/* Top Header with Brand and Top-Right Inbox & Settings Gear */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => setActiveTab('deck')}
            activeOpacity={0.8}
          >
            <Image source={require('./assets/logo.png')} style={styles.headerLogo} />
            <View>
              <Text style={styles.brandTitle}>LAPLABAN</Text>
              <View style={styles.radarStatusRow}>
                <View style={styles.radarPulsar} />
                <Text style={styles.radarStatusText}>METRO MANILA • ACTIVE</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            {/* Top-Right Inbox Trigger */}
            <TouchableOpacity
              style={[
                styles.headerInboxBtn,
                activeTab === 'inbox' && styles.headerInboxBtnActive,
              ]}
              onPress={() => setActiveTab(activeTab === 'inbox' ? 'deck' : 'inbox')}
              activeOpacity={0.7}
            >
              <Text style={[styles.headerInboxIcon, activeTab === 'inbox' && { color: '#00F0FF' }]}>
                ◎
              </Text>
              <Text style={[styles.headerInboxText, activeTab === 'inbox' && { color: '#00F0FF' }]}>
                INBOX
              </Text>
              <Animated.View style={[styles.inboxDot, { transform: [{ scale: pulseAnim }] }]} />
            </TouchableOpacity>

            {/* FUTURISTIC SETTINGS GEAR TRIGGER */}
            <TouchableOpacity
              style={styles.settingsGearBtn}
              onPress={() => setSettingsModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsGearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Body */}
        <ScrollView
          style={styles.mainScrollView}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'deck' && <FinderDeck currentUserId={session.user.id} />}

          {activeTab === 'inbox' && (
            <MatchesList
              currentUserId={session.user.id}
              onSelectBuddy={(buddy) => setSelectedBuddy(buddy)}
            />
          )}

          {activeTab === 'community' && (
            <CommunityForum currentUserId={session.user.id} />
          )}

          {activeTab === 'track' && (
            <ActivityTracker currentUserId={session.user.id} />
          )}

          {activeTab === 'lapbot' && (
            <LapBotModal
              currentUserId={session.user.id}
              onClose={() => setActiveTab('deck')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileSettings
              currentUserId={session.user.id}
              userEmail={session.user.email}
            />
          )}
        </ScrollView>

        {/* Conversation Modal */}
        {selectedBuddy && (
          <ChatModal
            buddy={selectedBuddy}
            currentUserId={session.user.id}
            onClose={() => setSelectedBuddy(null)}
          />
        )}

        {/* ----------------------------------------------------------- */}
        {/* SETTINGS MODAL (LOGOUT & DEACTIVATE)                         */}
        {/* ----------------------------------------------------------- */}
        <Modal
          visible={settingsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSettingsModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.settingsCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.settingsHeaderTitleRow}>
                  <Text style={styles.settingsGearIconBig}>⚙</Text>
                  <Text style={styles.settingsModalTitle}>SETTINGS & ACCOUNT</Text>
                </View>
                <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Account Overview Shelf */}
              <View style={styles.settingsAccountShelf}>
                <Text style={styles.accountLabel}>LOGGED IN AS</Text>
                <Text style={styles.accountEmail}>{session.user.email}</Text>
                <View style={styles.accountVerifiedRow}>
                  <View style={styles.verifiedDot} />
                  <Text style={styles.verifiedText}>RADAR VERIFIED ATHLETE</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.settingsActionsBlock}>
                {/* Logout Button */}
                <TouchableOpacity
                  style={styles.settingsActionBtn}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <Text style={styles.settingsActionIcon}>⇥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsActionTitle}>Sign Out</Text>
                    <Text style={styles.settingsActionSub}>End session and lock your radar</Text>
                  </View>
                </TouchableOpacity>

                {/* Deactivate Button */}
                <TouchableOpacity
                  style={[styles.settingsActionBtn, styles.deactivateActionBtn]}
                  onPress={() => {
                    setSettingsModalVisible(false);
                    setDeleteConfirmationText('');
                    setDeactivateModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deactivateActionIcon}>⚠</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deactivateActionTitle}>Deactivate Account</Text>
                    <Text style={styles.deactivateActionSub}>Permanently delete profile & matches</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.settingsDoneBtn}
                onPress={() => setSettingsModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.settingsDoneText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ----------------------------------------------------------- */}
        {/* DEACTIVATION CONFIRMATION MODAL ("DELETE" INPUT REQUIRED)    */}
        {/* ----------------------------------------------------------- */}
        <Modal
          visible={deactivateModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDeactivateModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.settingsCard, styles.deactivateCard]}>
              <View style={styles.deactivateHeaderRow}>
                <Text style={styles.deactivateWarningIcon}>⚠</Text>
                <Text style={styles.deactivateTitle}>DEACTIVATE ACCOUNT</Text>
              </View>

              <Text style={styles.deactivateWarningBody}>
                This action is irreversible. All your matched training buddies, GPS workout logs, and discovery deck cards will be permanently erased.
              </Text>

              <View style={styles.confirmationInputBlock}>
                <Text style={styles.confirmationInstruction}>
                  To confirm, type <Text style={styles.deleteKeyword}>DELETE</Text> in the box below:
                </Text>
                <TextInput
                  style={styles.deleteTextInput}
                  value={deleteConfirmationText}
                  onChangeText={setDeleteConfirmationText}
                  placeholder="Type DELETE"
                  placeholderTextColor="rgba(255, 59, 48, 0.4)"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.deactivateButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelDeactivateBtn}
                  onPress={() => {
                    setDeactivateModalVisible(false);
                    setDeleteConfirmationText('');
                  }}
                >
                  <Text style={styles.cancelDeactivateText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmDeactivateBtn,
                    deleteConfirmationText.trim().toUpperCase() !== 'DELETE' && { opacity: 0.45 },
                  ]}
                  onPress={handleDeactivateAccount}
                  disabled={deactivating || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                  activeOpacity={0.8}
                >
                  {deactivating ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.confirmDeactivateText}>DELETE ACCOUNT</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Streamlined Bottom Dock */}
        <View style={styles.dockWrapper}>
          <View style={styles.dockBar}>
            {/* Deck */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('deck')}
              activeOpacity={0.7}
            >
              <Text style={[styles.dockIcon, activeTab === 'deck' && styles.dockIconActive]}>
                ❖
              </Text>
              <Text style={[styles.dockLabel, activeTab === 'deck' && styles.dockLabelActive]}>
                DECK
              </Text>
              {activeTab === 'deck' && <View style={styles.activePip} />}
            </TouchableOpacity>

            {/* Forum */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('community')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dockIcon,
                  activeTab === 'community' && styles.dockIconActive,
                ]}
              >
                ⊛
              </Text>
              <Text
                style={[
                  styles.dockLabel,
                  activeTab === 'community' && styles.dockLabelActive,
                ]}
              >
                FORUM
              </Text>
              {activeTab === 'community' && <View style={styles.activePip} />}
            </TouchableOpacity>

            {/* Track */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('track')}
              activeOpacity={0.7}
            >
              <Text style={[styles.dockIcon, activeTab === 'track' && styles.dockIconActive]}>
                ⌁
              </Text>
              <Text style={[styles.dockLabel, activeTab === 'track' && styles.dockLabelActive]}>
                TRACK
              </Text>
              {activeTab === 'track' && <View style={styles.activePip} />}
            </TouchableOpacity>

            {/* LapBot */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('lapbot')}
              activeOpacity={0.7}
            >
              <Text style={[styles.dockIcon, activeTab === 'lapbot' && styles.dockIconActive]}>
                ✣
              </Text>
              <Text style={[styles.dockLabel, activeTab === 'lapbot' && styles.dockLabelActive]}>
                LAPBOT
              </Text>
              {activeTab === 'lapbot' && <View style={styles.activePip} />}
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.7}
            >
              <Text style={[styles.dockIcon, activeTab === 'profile' && styles.dockIconActive]}>
                □
              </Text>
              <Text style={[styles.dockLabel, activeTab === 'profile' && styles.dockLabelActive]}>
                PROFILE
              </Text>
              {activeTab === 'profile' && <View style={styles.activePip} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#07080C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewportFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    position: 'relative',
    height: '100%',
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(10, 12, 18, 0.85)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  brandTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2.4,
    textShadowColor: 'rgba(0, 240, 255, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  radarStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  radarPulsar: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F0FF',
  },
  radarStatusText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerInboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    position: 'relative',
  },
  headerInboxBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  headerInboxIcon: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  headerInboxText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  inboxDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },

  /* SETTINGS GEAR ICON BUTTON */
  settingsGearBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
  },
  settingsGearIcon: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
  },

  /* BODY */
  mainScrollView: {
    flex: 1,
    width: '100%',
  },
  mainScrollContent: {
    padding: 12,
    paddingBottom: 95,
  },

  /* DOCK */
  dockWrapper: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  dockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '92%',
    backgroundColor: 'rgba(12, 14, 20, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 3,
    minWidth: 50,
  },
  dockIcon: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 2,
  },
  dockIconActive: {
    color: '#FFFFFF',
  },
  dockLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  dockLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activePip: {
    position: 'absolute',
    bottom: -2,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FF3B30',
  },

  /* SETTINGS MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(16, 22, 34, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(35px)' } : {}),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsGearIconBig: {
    color: '#00F0FF',
    fontSize: 17,
  },
  settingsModalTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  modalCloseText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsAccountShelf: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  accountLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  accountEmail: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  accountVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00F0FF',
  },
  verifiedText: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  settingsActionsBlock: {
    gap: 10,
  },
  settingsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
  },
  settingsActionIcon: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 18,
  },
  settingsActionTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  settingsActionSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10.5,
  },
  deactivateActionBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.06)',
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  deactivateActionIcon: {
    color: '#FF3B30',
    fontSize: 16,
  },
  deactivateActionTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FF3B30',
    fontSize: 13.5,
    fontWeight: '800',
  },
  deactivateActionSub: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 59, 48, 0.7)',
    fontSize: 10.5,
  },
  settingsDoneBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  settingsDoneText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* DEACTIVATION MODAL */
  deactivateCard: {
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  deactivateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deactivateWarningIcon: {
    color: '#FF3B30',
    fontSize: 18,
  },
  deactivateTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  deactivateWarningBody: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  confirmationInputBlock: {
    gap: 8,
    marginVertical: 4,
  },
  confirmationInstruction: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  deleteKeyword: {
    color: '#FF3B30',
    fontWeight: '900',
    letterSpacing: 1,
  },
  deleteTextInput: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    color: '#FF3B30',
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  deactivateButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelDeactivateBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelDeactivateText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  confirmDeactivateBtn: {
    flex: 1.2,
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmDeactivateText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* AUTH STYLES */
  authWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  authGlassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(16, 18, 25, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 24,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  authLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  appLogo: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  authBrandTitle: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  authBrandSubtitle: {
    fontFamily: SYSTEM_FONT,
    color: '#00F0FF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  authHeading: {
    fontFamily: SYSTEM_FONT,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  authSubheading: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 16,
  },
  authErrorBanner: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  authErrorText: {
    fontFamily: SYSTEM_FONT,
    color: '#FF3B30',
    fontSize: 11.5,
    textAlign: 'center',
    fontWeight: '600',
  },
  authInputsGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  authInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  authInputLabel: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    width: 75,
    fontWeight: '500',
  },
  authTextInput: {
    fontFamily: SYSTEM_FONT,
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    padding: 0,
  },
  authDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 16,
  },
  primaryAuthBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryAuthBtnText: {
    fontFamily: SYSTEM_FONT,
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  authToggleBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  authToggleText: {
    fontFamily: SYSTEM_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11.5,
    fontWeight: '600',
  },
});