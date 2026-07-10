import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

const TOTP_PERIOD_SECONDS = 30;

function secondsUntilAuthenticatorRefresh() {
  const elapsed = Math.floor(Date.now() / 1000) % TOTP_PERIOD_SECONDS;
  return TOTP_PERIOD_SECONDS - elapsed;
}

export default function TotpSetupScreen({ navigation }) {
  const { login } = useAuth();
  const [setup, setSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [refreshSeconds, setRefreshSeconds] = useState(secondsUntilAuthenticatorRefresh());
  const inputRef = useRef(null);

  useEffect(() => {
    const fetchSetup = async () => {
      try {
        const tempToken = await SecureStore.getItemAsync('tempToken');

        if (!tempToken) {
          navigation.replace('Login');
          return;
        }

        const response = await fetch(`${API_PASSENGER_BASE}/auth/totp/setup`, {
          headers: {
            Authorization: `Bearer ${tempToken}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load QR code');
        }

        setSetup(data.data);
      } catch (error) {
        Alert.alert('Setup failed', error.message || 'Please login again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSetup();
  }, [navigation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshSeconds(secondsUntilAuthenticatorRefresh());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (totpCode.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
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
        throw new Error(data.message || 'Verification failed');
      }

      const { token, passengerName } = data.data || {};
      await login(token, passengerName);
      await SecureStore.deleteItemAsync('tempToken');
      await SecureStore.deleteItemAsync('pendingCardNumber');
    } catch (error) {
      setTotpCode('');
      Alert.alert('Setup failed', error.message || 'Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const copySetupKey = async () => {
    const setupKey = setup?.manualEntryKey;

    if (!setupKey) {
      Alert.alert('Setup key unavailable', 'Please refresh the setup screen and try again.');
      return;
    }

    await Clipboard.setStringAsync(setupKey);
    Alert.alert('Copied', 'The setup key was copied to your clipboard.');
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.maroon} />
        <Text style={styles.loadingText}>Loading your 2FA setup...</Text>
      </View>
    );
  }

  const codeDigits = Array.from({ length: 6 }, (_, index) => totpCode[index] || '');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Pressable style={styles.back} onPress={() => navigation.replace('Login')}>
            <Feather name="arrow-left" size={20} color={colors.maroon} />
            <Text style={styles.backText}>Back to login</Text>
          </Pressable>

          <View style={styles.heroIconWrap}>
            <View style={[styles.orbit, styles.orbitOuter]} />
            <View style={[styles.orbit, styles.orbitInner]} />
            <View style={[styles.orbitDot, styles.orbitDotLeft]} />
            <View style={[styles.orbitDot, styles.orbitDotRight]} />
            <View style={styles.heroIcon}>
              <Feather name="shield" size={20} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Set up 2FA</Text>
          <Text style={styles.subtitle}>Scan the QR code with Google Authenticator or Authy, then enter the current 6-digit code.</Text>

          <View style={styles.setupCard}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Open your authenticator app.</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Scan this QR code.</Text>
            </View>

            <View style={styles.qrBox}>
              {setup?.qrCodeUrl ? (
                <QRCode value={setup.qrCodeUrl} size={214} backgroundColor="#FFFFFF" color="#000000" quietZone={12} />
              ) : (
                <Text style={styles.errorText}>QR code unavailable</Text>
              )}
            </View>
          </View>

          <View style={styles.manualCard}>
            <View style={styles.manualHeader}>
              <View style={styles.smallIconGold}>
                <Feather name="key" size={15} color="#C99418" />
              </View>
              <Text style={styles.manualLabel}>Can't scan? Use this setup key</Text>
            </View>
            <View style={styles.manualCodeBox}>
              <Text selectable numberOfLines={1} adjustsFontSizeToFit style={styles.manualCode}>{setup?.manualEntryKey || '-'}</Text>
              <View style={styles.copyDivider} />
              <Pressable onPress={copySetupKey} hitSlop={10} style={styles.copyButton}>
                <Feather name="copy" size={20} color="#C99418" />
              </Pressable>
            </View>
          </View>

          <View style={styles.verifyPanel}>
            <View style={styles.verifyHeader}>
              <View style={styles.smallIconGold}>
                <Feather name="lock" size={15} color="#C99418" />
              </View>
              <Text style={styles.verifyTitle}>Enter 6-digit code</Text>
              <View style={styles.timerRow}>
                <Feather name="clock" size={14} color="#C99418" />
                <Text style={styles.timerText}>00:{String(refreshSeconds).padStart(2, '0')}</Text>
              </View>
            </View>

            <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
              {codeDigits.map((digit, index) => {
                const active = index === totpCode.length && totpCode.length < 6;
                return (
                  <View key={index} style={[styles.codeBox, active && styles.codeBoxActive, digit && styles.codeBoxFilled]}>
                    <Text style={styles.codeText}>{digit}</Text>
                  </View>
                );
              })}
              <TextInput
                ref={inputRef}
                value={totpCode}
                onChangeText={(value) => setTotpCode(value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                style={styles.hiddenInput}
                autoFocus
              />
            </Pressable>
            <Text style={styles.timerHint}>Code changes every 30 seconds.</Text>
          </View>

          <Button loading={verifying} disabled={totpCode.length !== 6} onPress={handleVerify} style={styles.verifyButton}>
            Verify & Enable 2FA
          </Button>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFCFD' },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 20 },
  loading: { flex: 1, backgroundColor: '#FFFCFD', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, marginTop: 14 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, marginBottom: 2 },
  backText: { color: colors.maroon, fontSize: 15, fontWeight: '800' },
  heroIconWrap: { width: 74, height: 74, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 0, marginBottom: 7 },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(201, 148, 24, 0.38)', borderRadius: 999 },
  orbitOuter: { width: 74, height: 74 },
  orbitInner: { width: 58, height: 58 },
  orbitDot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#C99418' },
  orbitDotLeft: { left: 4, top: 33 },
  orbitDotRight: { right: 3, top: 13 },
  heroIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center', ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.16 },
  title: { color: colors.maroon, fontSize: 30, lineHeight: 34, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: '#555C65', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4, marginBottom: 14, paddingHorizontal: 12 },
  setupCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E5E1E1', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10, ...shadow, shadowOpacity: 0.04, shadowRadius: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 32 },
  stepConnector: { width: 1, height: 12, backgroundColor: '#E6B045', marginLeft: 15 },
  stepNumber: { width: 31, height: 31, borderRadius: 15.5, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  stepText: { color: '#171A22', flex: 1, fontSize: 14, fontWeight: '900' },
  qrBox: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E8C58A', padding: 8, marginTop: 12 },
  manualCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E1E1', borderRadius: 15, padding: 10, marginBottom: 10, ...shadow, shadowOpacity: 0.03, shadowRadius: 9 },
  manualHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  smallIconGold: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF3DF', alignItems: 'center', justifyContent: 'center' },
  manualLabel: { color: '#171A22', fontSize: 13, fontWeight: '900', flex: 1 },
  manualCodeBox: { minHeight: 34, borderRadius: 12, borderWidth: 1, borderColor: '#D9DCE1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  manualCode: { flex: 1, color: colors.maroon, fontSize: 9, fontWeight: '900', letterSpacing: 0 },
  copyDivider: { width: 1, height: 24, backgroundColor: '#D9DCE1' },
  copyButton: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  verifyPanel: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#E5E1E1', padding: 10, marginBottom: 10, ...shadow, shadowOpacity: 0.03, shadowRadius: 9 },
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  verifyTitle: { color: '#171A22', fontSize: 11, fontWeight: '900', flex: 1 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timerText: { color: '#555C65', fontSize: 12, fontWeight: '700' },
  codeRow: { flexDirection: 'row', gap: 8, position: 'relative', paddingLeft: 0 },
  codeBox: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1.2, borderColor: '#D9DCE1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  codeBoxActive: { borderColor: '#D11A2A', borderWidth: 1.8 },
  codeBoxFilled: { borderColor: colors.maroon, backgroundColor: '#FFF8F8' },
  codeText: { color: colors.maroon, fontWeight: '900', fontSize: 17 },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  timerHint: { color: '#636B75', fontSize: 10, marginTop: 5, paddingLeft: 0 },
  verifyButton: { minHeight: 48, borderRadius: 14, ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.22, shadowRadius: 14 },
  errorText: { color: colors.maroon, fontWeight: '800' },
});
