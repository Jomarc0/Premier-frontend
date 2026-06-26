import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

export default function TotpVerifyScreen({ navigation }) {
  const { login, enableBiometrics } = useAuth();
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    SecureStore.getItemAsync('tempToken').then((token) => {
      if (!token) navigation.replace('Login');
    });
  }, [navigation]);

  const promptBiometrics = () => {
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
  };

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
        throw new Error(data.message || 'Invalid code');
      }

      const { token, passengerName } = data.data || {};
      await login(token, passengerName);
      await SecureStore.deleteItemAsync('tempToken');
      promptBiometrics();
    } catch (error) {
      setTotpCode('');
      Alert.alert('Verification failed', error.message || 'Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <SafeAreaView style={styles.content}>
        <Pressable style={styles.back} onPress={() => navigation.replace('Login')}>
          <Feather name="arrow-left" size={22} color={colors.maroon} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMid]} />
          <View style={[styles.ring, styles.ringInner]} />
          <View style={[styles.dot, styles.dotOne]} />
          <View style={[styles.dot, styles.dotTwo]} />
          <View style={[styles.dot, styles.dotThree]} />
          <View style={styles.shield}>
            <MaterialCommunityIcons name="shield-lock-outline" size={54} color="#fff" />
          </View>
          <View style={styles.busBadge}>
            <MaterialCommunityIcons name="bus" size={21} color="#fff" />
          </View>
        </View>

        <Text style={styles.title}>Verify Your Identity</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code from your authenticator app to continue.</Text>

        <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const value = totpCode[index];
            const active = index === totpCode.length;
            const waiting = index > totpCode.length;
            return (
              <View key={index} style={[styles.codeBox, value && styles.codeBoxFilled, active && styles.codeBoxActive]}>
                <Text style={[styles.codeText, waiting && styles.codeDot]}>{value || (waiting ? '•' : '')}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={totpCode}
            onChangeText={(value) => setTotpCode(value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            keyboardType="number-pad"
            style={styles.hiddenInput}
            autoFocus
          />
        </Pressable>

        <View style={styles.expiryPill}>
          <Feather name="clock" size={16} color={colors.maroon} />
          <Text style={styles.expiryText}>Expires in <Text style={styles.expiryStrong}>00:48</Text></Text>
        </View>

        <Button loading={verifying} disabled={totpCode.length !== 6} onPress={handleVerify} style={styles.verifyButton} icon={<Feather name="check" size={21} color="#fff" />}>
          Verify & Login
        </Button>

        <Text style={styles.resend}>Didn't receive the code? <Text style={styles.resendStrong}>Resend</Text></Text>

        <View style={styles.footer}>
          <Feather name="lock" size={15} color="#68717E" />
          <Text style={styles.copyright}>© 2026 Premier Transport Corp. - Encrypted Portal</Text>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFCFD',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 42,
    paddingBottom: 28,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.maroon,
    fontSize: 17,
    fontWeight: '700',
  },
  hero: {
    width: 170,
    height: 170,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(123, 24, 30, 0.14)',
    borderRadius: 999,
  },
  ringOuter: { width: 170, height: 170 },
  ringMid: { width: 134, height: 134 },
  ringInner: { width: 102, height: 102 },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.maroon,
  },
  dotOne: { left: 18, top: 38 },
  dotTwo: { right: 25, top: 51 },
  dotThree: { left: 22, bottom: 37, opacity: 0.24 },
  shield: {
    width: 92,
    height: 104,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.28,
  },
  busBadge: {
    position: 'absolute',
    right: 29,
    bottom: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.maroon,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.24,
  },
  title: {
    color: colors.maroon,
    textAlign: 'center',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
  },
  subtitle: {
    color: '#5F6670',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 27,
    marginTop: 22,
    marginBottom: 46,
    paddingHorizontal: 16,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    marginBottom: 36,
  },
  codeBox: {
    width: 48,
    height: 68,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#DDE2EA',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  codeBoxFilled: {
    borderColor: colors.maroon,
  },
  codeBoxActive: {
    borderColor: '#E11D2E',
  },
  codeText: {
    color: colors.maroon,
    fontSize: 21,
    fontWeight: '900',
  },
  codeDot: {
    color: '#C8CBD0',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  expiryPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F1F2',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 46,
  },
  expiryText: {
    color: '#555C65',
    fontSize: 14,
  },
  expiryStrong: {
    color: colors.maroon,
    fontWeight: '900',
  },
  verifyButton: {
    borderRadius: 16,
    minHeight: 72,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.26,
    shadowRadius: 20,
  },
  resend: {
    color: '#606873',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
  },
  resendStrong: {
    color: colors.maroon,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 'auto',
  },
  copyright: {
    color: '#646D78',
    fontSize: 12,
  },
});

