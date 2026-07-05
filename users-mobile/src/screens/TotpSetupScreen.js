import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

export default function TotpSetupScreen({ navigation }) {
  const { login, enableBiometrics } = useAuth();
  const [setup, setSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
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

      Alert.alert(
        'Enable biometric login?',
        'Use fingerprint or Face ID next time instead of entering OTP on this device.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              try {
                await enableBiometrics();
              } catch (error) {
                Alert.alert('Biometrics unavailable', error.message || 'You can enable it later in Settings.');
              }
            },
          },
        ],
      );
    } catch (error) {
      setTotpCode('');
      Alert.alert('Setup failed', error.message || 'Please try again.');
    } finally {
      setVerifying(false);
    }
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Pressable style={styles.back} onPress={() => navigation.replace('Login')}>
            <Feather name="arrow-left" size={20} color={colors.maroon} />
            <Text style={styles.backText}>Back to login</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.icon}>
              <Feather name="shield" size={25} color="#fff" />
            </View>
            <Text style={styles.title}>Set up 2FA</Text>
            <Text style={styles.subtitle}>Scan the QR code with Google Authenticator or Authy, then enter the current 6-digit code.</Text>
          </View>

          <View style={styles.setupCard}>
            <View style={styles.stepLine}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Open your authenticator app.</Text>
            </View>
            <View style={styles.stepLine}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Scan this QR code.</Text>
            </View>

            <View style={styles.qrBox}>
              {setup?.qrCodeUrl ? (
                <QRCode value={setup.qrCodeUrl} size={206} />
              ) : (
                <Text style={styles.errorText}>QR code unavailable</Text>
              )}
            </View>
          </View>

          <View style={styles.manual}>
            <Text style={styles.manualLabel}>Can't scan? Use this setup key</Text>
            <Text selectable style={styles.manualCode}>{setup?.manualEntryKey || '-'}</Text>
          </View>

          <View style={styles.verifyPanel}>
            <Text style={styles.verifyTitle}>Enter 6-digit code</Text>
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
            <Button loading={verifying} disabled={totpCode.length !== 6} onPress={handleVerify} style={styles.verifyButton}>
              Verify & Enable 2FA
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
    marginTop: 14,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  backText: {
    color: colors.maroon,
    fontSize: 15,
    fontWeight: '800',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.18,
  },
  title: {
    color: colors.maroon,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  setupCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    ...shadow,
    shadowOpacity: 0.07,
  },
  stepLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  stepText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: colors.soft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 4,
  },
  manual: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  manualLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  manualCode: {
    color: colors.maroon,
    backgroundColor: colors.soft,
    borderRadius: 10,
    padding: 11,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  verifyPanel: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  verifyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeBox: {
    flex: 1,
    height: 54,
    borderRadius: 13,
    borderWidth: 1.4,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: colors.maroon,
    borderWidth: 2,
  },
  codeBoxFilled: {
    backgroundColor: '#FFF8F8',
  },
  codeText: {
    color: colors.maroon,
    fontWeight: '900',
    fontSize: 21,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  timerHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  verifyButton: {
    minHeight: 54,
    borderRadius: 16,
  },
  errorText: {
    color: colors.maroon,
    fontWeight: '800',
  },
});
