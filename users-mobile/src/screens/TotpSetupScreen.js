import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Feather name="lock" size={30} color="#fff" />
        </View>
        <Text style={styles.title}>Set up Two-Factor Authentication</Text>
        <Text style={styles.subtitle}>Secure your account with Google Authenticator or Authy.</Text>

        <View style={styles.step}>
          <Text style={styles.stepText}><Text style={styles.stepStrong}>Step 1:</Text> Download Google Authenticator or Authy on your phone.</Text>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepText}><Text style={styles.stepStrong}>Step 2:</Text> Scan this QR code with the app.</Text>
          <View style={styles.qrBox}>
            {setup?.qrCodeUrl ? (
              <QRCode value={setup.qrCodeUrl} size={205} />
            ) : (
              <Text style={styles.errorText}>QR code unavailable</Text>
            )}
          </View>
        </View>

        <View style={styles.manual}>
          <Text style={styles.manualLabel}>Can't scan? Enter this code manually:</Text>
          <Text selectable style={styles.manualCode}>{setup?.manualEntryKey || '-'}</Text>
        </View>

        <Text style={styles.stepText}><Text style={styles.stepStrong}>Step 3:</Text> Enter the 6-digit code from the app.</Text>
        <TextInput
          value={totpCode}
          onChangeText={(value) => setTotpCode(value.replace(/\D/g, ''))}
          maxLength={6}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor="#E2A8AD"
          style={styles.codeInput}
        />

        <Button loading={verifying} disabled={totpCode.length !== 6} onPress={handleVerify}>
          Verify & Enable 2FA
        </Button>
        <Button variant="ghost" onPress={() => navigation.replace('Login')} icon={<Feather name="arrow-left" size={16} color={colors.maroon} />}>
          Back to Login
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingTop: 48,
    paddingBottom: 36,
    alignItems: 'center',
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
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    ...shadow,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.maroon,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: colors.maroon,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  step: {
    borderLeftWidth: 4,
    borderLeftColor: colors.maroon,
    backgroundColor: '#FAE7E9',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  stepText: {
    color: '#392D33',
    fontSize: 13,
    lineHeight: 19,
  },
  stepStrong: {
    color: colors.maroon,
    fontWeight: '900',
  },
  qrBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    alignSelf: 'center',
    marginTop: 14,
  },
  manual: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  manualLabel: {
    color: '#392D33',
    fontSize: 13,
    marginBottom: 8,
  },
  manualCode: {
    color: colors.text,
    backgroundColor: colors.soft,
    borderRadius: 8,
    padding: 10,
    fontSize: 11,
    fontWeight: '800',
  },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.maroon,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 9,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 18,
  },
  errorText: {
    color: colors.maroon,
    fontWeight: '800',
  },
});
