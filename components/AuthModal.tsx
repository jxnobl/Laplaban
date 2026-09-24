import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  onSuccess?: () => void;
}

const FONT_STACK =
  Platform.OS === 'web'
    ? "system-ui, -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', Roboto, sans-serif"
    : undefined;

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data?.user) {
          await supabase.from('profiles').upsert([
            {
              id: data.user.id,
              full_name: email.split('@')[0],
              fitness_mode: 'RunnerFinder',
              pace: '5:30 min/km',
              city: 'Metro Manila',
              bio: 'Ready to stay consistent and train together.',
            },
          ]);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.glassAuthCard}>
      {/* Featured App Icon with Glow */}
      <View style={styles.logoBadgeContainer}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.brandTitle}>LAPLABAN</Text>
      <Text style={styles.tagline}>
        {isSignUp
          ? 'CREATE YOUR FITNESS & CADENCE PROFILE'
          : 'THE SECRET SOCIAL FITNESS NETWORK'}
      </Text>

      {errorMessage ? (
        <View style={styles.errorPill}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
        <TextInput
          style={styles.glassInput}
          placeholder="runner@laplaban.ph"
          placeholderTextColor="rgba(255, 255, 255, 0.25)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>SECURE KEY / PASSWORD</Text>
        <TextInput
          style={styles.glassInput}
          placeholder="••••••••••••"
          placeholderTextColor="rgba(255, 255, 255, 0.25)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryActionBtn, loading && { opacity: 0.6 }]}
        onPress={handleAuth}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.primaryActionText}>
            {isSignUp ? 'INITIALIZE MEMBERSHIP' : 'ACCESS RADAR'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => {
          setIsSignUp(!isSignUp);
          setErrorMessage('');
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.togglePrompt}>
          {isSignUp ? 'ALREADY REGISTERED?' : 'NEW CADENCE?'}
        </Text>
        <Text style={styles.toggleAction}>
          {isSignUp ? 'ENTER RADAR' : 'CREATE ACCOUNT'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  glassAuthCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(16, 18, 25, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 36,
    elevation: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(30px)' } : {}),
  },
  logoBadgeContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#FF4B2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  brandTitle: {
    fontFamily: FONT_STACK,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  tagline: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorPill: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
    width: '100%',
  },
  errorText: {
    fontFamily: FONT_STACK,
    color: '#FF6B6B',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  glassInput: {
    fontFamily: FONT_STACK,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  primaryActionBtn: {
    width: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  primaryActionText: {
    fontFamily: FONT_STACK,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  togglePrompt: {
    fontFamily: FONT_STACK,
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1,
  },
  toggleAction: {
    fontFamily: FONT_STACK,
    color: '#00F0FF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
});