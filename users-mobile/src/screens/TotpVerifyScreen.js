import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { captureMobileEvent } from '../analytics/posthog';
import { API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

const TOTP_PERIOD_SECONDS = 30;

function secondsUntilAuthenticatorRefresh() {
  const elapsed = Math.floor(Date.now() / 1000) % TOTP_PERIOD_SECONDS;
  return TOTP_PERIOD_SECONDS - elapsed;
}

function maskCardNumber(cardNumber) {
  if (!cardNumber) return '**** 1234';
  const visible = String(cardNumber).slice(-4);
  return `**** ${visible}`;
}

export default function TotpVerifyScreen({ navigation }) {
  const posthog = usePostHog();
  const { login } = useAuth();
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [refreshSeconds, setRefreshSeconds] = useState(secondsUntilAuthenticatorRefresh());
  const [pendingCardNumber, setPendingCardNumber] = useState(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    SecureStore.getItemAsync('tempToken').then((token) => {
      if (!token) navigation.replace('Login');
    });
    SecureStore.getItemAsync('pendingCardNumber').then(setPendingCardNumber);
  }, [navigation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshSeconds(secondsUntilAuthenticatorRefresh());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLockSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const maskedCardNumber = useMemo(() => maskCardNumber(pendingCardNumber), [pendingCardNumber]);

  const handleVerify = async () => {
    if (lockSeconds > 0) return;
    if (totpCode.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your Google Authenticator app.');
      return;
    }

    setVerifying(true);

    try {
      const tempToken = await SecureStore.getItemAsync('tempToken');
      const response = await fetch(`${API_PASSENGER_BASE}/auth/verify-totp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.message || 'Invalid code');
        error.retryAfterSeconds = Number(data.data?.retryAfterSeconds || 0);
        throw error;
      }

      const { token, passengerName } = data.data || {};
      await login(token, passengerName);
      await SecureStore.deleteItemAsync('tempToken');
      await SecureStore.deleteItemAsync('pendingCardNumber');
      captureMobileEvent(posthog, 'mobile_login_success', {
        method: 'totp',
      });
    } catch (error) {
      setTotpCode('');
      if (error.retryAfterSeconds > 0) {
        setLockSeconds(error.retryAfterSeconds);
      }
      captureMobileEvent(posthog, 'mobile_login_totp_failed');
      Alert.alert('Verification failed', error.message || 'Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={false}>
          <Pressable style={styles.back} onPress={() => navigation.replace('Login')}>
            <Feather name="arrow-left" size={20} color={colors.maroon} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.hero}>
            <View style={[styles.ring, styles.ringOuter]} />
            <View style={[styles.ring, styles.ringMid]} />
            <View style={styles.orbitLineOne} />
            <View style={styles.orbitLineTwo} />
            <View style={[styles.dot, styles.dotOne]} />
            <View style={[styles.dot, styles.dotTwo]} />
            <View style={[styles.dot, styles.dotThree]} />
            <View style={styles.shieldCircle}>
              <MaterialCommunityIcons name="shield-lock-outline" size={48} color="#fff" />
            </View>
            <View style={styles.busBadge}>
              <MaterialCommunityIcons name="bus" size={18} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>Open Google Authenticator and enter the current 6-digit code.</Text>

          <View style={styles.cardPanel}>
            <Feather name="credit-card" size={28} color={colors.maroon} />
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Verifying RFID Card</Text>
              <Text style={styles.cardNumber}>Card No.  <Text style={styles.cardNumberStrong}>{maskedCardNumber}</Text></Text>
            </View>
          </View>

          <Pressable style={[styles.codeRow, lockSeconds > 0 && styles.codeRowLocked]} onPress={() => lockSeconds <= 0 && inputRef.current?.focus()}>
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const value = totpCode[index];
              const active = index === totpCode.length;
              const waiting = index > totpCode.length;
              return (
                <View key={index} style={[styles.codeBox, value && styles.codeBoxFilled, active && styles.codeBoxActive]}>
                  <Text style={[styles.codeText, waiting && styles.codeDot]}>{value || (active ? '|' : '.')}</Text>
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              value={totpCode}
              onChangeText={(value) => setTotpCode(value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              keyboardType="number-pad"
              editable={lockSeconds <= 0}
              style={styles.hiddenInput}
              autoFocus
            />
          </Pressable>

          <View style={styles.refreshPill}>
            <Feather name="refresh-cw" size={15} color={colors.maroon} />
            <Text style={styles.refreshText}>Authenticator code refreshes in <Text style={styles.refreshStrong}>00:{String(refreshSeconds).padStart(2, '0')}</Text></Text>
          </View>

          {lockSeconds > 0 && (
            <View style={styles.lockoutNotice}>
              <MaterialCommunityIcons name="timer-lock-outline" size={20} color="#B4232D" />
              <Text style={styles.lockoutText}>
                Too many incorrect codes. Try again in {Math.floor(lockSeconds / 60)}:{String(lockSeconds % 60).padStart(2, '0')}.
              </Text>
            </View>
          )}

          <Button loading={verifying} disabled={totpCode.length !== 6 || lockSeconds > 0} onPress={handleVerify} style={styles.verifyButton} icon={<Feather name="lock" size={21} color="#fff" />}>
            {lockSeconds > 0 ? 'Temporarily Locked' : 'Verify & Continue'}
          </Button>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.maroon} />
            </View>
            <Text style={styles.infoText}>Use the current 6-digit code shown in your Google Authenticator app.</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.footerPortal}>
            <Feather name="lock" size={13} color={colors.maroon} />
            <Text style={styles.portalText}>Secure Passenger Portal</Text>
          </View>
          <Text style={styles.copyright}>(C) 2026 Premier Transport Corp.</Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFCFD',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 24,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 22,
  },
  backText: {
    color: colors.maroon,
    fontSize: 16,
    fontWeight: '800',
  },
  hero: {
    width: 154,
    height: 154,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 12,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: 'rgba(123, 24, 30, 0.14)',
    borderRadius: 999,
  },
  ringOuter: { width: 142, height: 142 },
  ringMid: { width: 104, height: 104, backgroundColor: 'rgba(123, 24, 30, 0.06)' },
  orbitLineOne: {
    position: 'absolute',
    width: 100,
    height: 1,
    backgroundColor: 'rgba(123, 24, 30, 0.11)',
    transform: [{ rotate: '22deg' }],
  },
  orbitLineTwo: {
    position: 'absolute',
    width: 112,
    height: 1,
    backgroundColor: 'rgba(123, 24, 30, 0.08)',
    transform: [{ rotate: '-28deg' }],
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.maroon,
  },
  dotOne: { left: 38, top: 40 },
  dotTwo: { right: 36, top: 36 },
  dotThree: { left: 40, bottom: 42, opacity: 0.2 },
  shieldCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.22,
  },
  busBadge: {
    position: 'absolute',
    right: 32,
    bottom: 27,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.maroon,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.2,
  },
  title: {
    color: colors.maroon,
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#555C65',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 12,
    paddingHorizontal: 18,
  },
  cardPanel: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: '#FFF8F8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 22,
    ...shadow,
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: '#555C65',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 5,
  },
  cardNumber: {
    color: '#555C65',
    fontSize: 17,
    fontWeight: '500',
  },
  cardNumberStrong: {
    color: colors.maroon,
    fontWeight: '900',
    letterSpacing: 2,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 11,
    position: 'relative',
    marginBottom: 22,
  },
  codeRowLocked: {
    opacity: 0.55,
  },
  codeBox: {
    flex: 1,
    height: 58,
    minWidth: 0,
    borderRadius: 15,
    borderWidth: 1.3,
    borderColor: '#DDE2EA',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.045,
    shadowRadius: 8,
  },
  codeBoxFilled: {
    borderColor: colors.maroon,
  },
  codeBoxActive: {
    borderColor: '#E11D2E',
    borderWidth: 1.8,
  },
  codeText: {
    color: colors.maroon,
    fontSize: 24,
    fontWeight: '900',
  },
  codeDot: {
    color: '#C8CBD0',
    fontSize: 28,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  refreshPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F8F0F1',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 22,
  },
  refreshText: {
    color: '#555C65',
    fontSize: 14,
  },
  refreshStrong: {
    color: colors.maroon,
    fontWeight: '900',
  },
  lockoutNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1BFC5',
    backgroundColor: '#FDECEC',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  lockoutText: {
    flex: 1,
    color: '#B4232D',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  verifyButton: {
    borderRadius: 15,
    minHeight: 64,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 36,
    marginTop: 26,
  },
  infoIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F8F0F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    color: '#555C65',
    fontSize: 15,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: '#E9E0E2',
    marginTop: 32,
    marginBottom: 22,
  },
  footerPortal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  portalText: {
    color: '#555C65',
    fontSize: 14,
  },
  copyright: {
    color: '#555C65',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
