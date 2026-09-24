import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { supabase } from './lib/supabase';
import FinderDeck from './components/FinderDeck';
import MatchesList from './components/MatchesList';
import ProfileSettings from './components/ProfileSettings';
import ActivityTracker from './components/ActivityTracker';
import LapBotModal from './components/LapBotModal';
import ChatModal from './components/ChatModal';

const APPLE_FONT =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"
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
  const [activeTab, setActiveTab] = useState<'deck' | 'inbox' | 'track' | 'lapbot' | 'profile'>('deck');
  const [selectedBuddy, setSelectedBuddy] = useState<any>(null);

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
          fitness_mode: 'RunnerFinder',
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
    await supabase.auth.signOut();
    setSelectedBuddy(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="small" color="#FF3B30" />
      </View>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATION SCREEN
  // -------------------------------------------------------------
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authWrapper}>
          <View style={styles.authGlassCard}>
            <View style={styles.authLogoRow}>
              <Image source={require('./assets/logo.png')} style={styles.appLogo} />
              <View>
                <Text style={styles.authBrandTitle}>LAPLABAN</Text>
                <Text style={styles.authBrandSubtitle}>VELOCITY SOCIAL NETWORK</Text>
              </View>
            </View>

            <Text style={styles.authHeading}>
              {isSignUp ? 'Create Athlete Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.authSubheading}>
              Connect with accountability partners across Metro Manila.
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
                  {isSignUp ? 'CREATE ATHLETE PROFILE' : 'ENTER RADAR'}
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
                  ? 'Already have an account? Sign In'
                  : "Don't have an athlete account? Register"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // MAIN VIEWPORT (PHONE-ALIGNED CONTAINER)
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.viewportFrame}>
        {/* Minimalist Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require('./assets/logo.png')} style={styles.headerLogo} />
            <View>
              <Text style={styles.brandTitle}>LAPLABAN</Text>
              <View style={styles.radarStatusRow}>
                <View style={styles.radarPulsar} />
                <Text style={styles.radarStatusText}>METRO MANILA RADAR</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.disconnectBtnText}>DISCONNECT</Text>
          </TouchableOpacity>
        </View>

        {/* Center Content Scroll Body */}
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

        {/* Chat Conversation Modal (Only shown when a buddy is selected) */}
        {selectedBuddy && (
          <ChatModal
            buddy={selectedBuddy}
            currentUserId={session.user.id}
            onClose={() => setSelectedBuddy(null)}
          />
        )}

        {/* Minimalist Apple Glass Bottom Dock */}
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

            {/* Inbox */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('inbox')}
              activeOpacity={0.7}
            >
              <Text style={[styles.dockIcon, activeTab === 'inbox' && styles.dockIconActive]}>
                ◎
              </Text>
              <Text style={[styles.dockLabel, activeTab === 'inbox' && styles.dockLabelActive]}>
                INBOX
              </Text>
              {activeTab === 'inbox' && <View style={styles.activePip} />}
            </TouchableOpacity>

            {/* Track */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setActiveTab('track')}
              activeOpacity={0.7}
            >
              <Text style={[styles.dockIcon, activeTab === 'track' && styles.dockIconActive]}>
                ⚡
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
    backgroundColor: '#090A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#090A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* FIXED-WIDTH APP FRAME FOR ALIGNMENT */
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(10, 12, 18, 0.7)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  brandTitle: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  radarStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  radarPulsar: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00F0FF',
  },
  radarStatusText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  disconnectBtnText: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* MAIN SCROLL VIEWPORT */
  mainScrollView: {
    flex: 1,
    width: '100%',
  },
  mainScrollContent: {
    padding: 14,
    paddingBottom: 95,
  },

  /* MINIMALIST BOTTOM DOCK */
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
    backgroundColor: 'rgba(14, 16, 22, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
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
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 2,
  },
  dockIconActive: {
    color: '#FFFFFF',
  },
  dockLabel: {
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 8.5,
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
    backgroundColor: 'rgba(16, 18, 25, 0.75)',
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
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  authBrandSubtitle: {
    fontFamily: APPLE_FONT,
    color: '#00F0FF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  authHeading: {
    fontFamily: APPLE_FONT,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  authSubheading: {
    fontFamily: APPLE_FONT,
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
    fontFamily: APPLE_FONT,
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
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12.5,
    width: 75,
    fontWeight: '500',
  },
  authTextInput: {
    fontFamily: APPLE_FONT,
    flex: 1,
    color: '#FFF',
    fontSize: 12.5,
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
    fontFamily: APPLE_FONT,
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
    fontFamily: APPLE_FONT,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11.5,
    fontWeight: '600',
  },
});