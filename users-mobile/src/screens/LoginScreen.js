import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

export default function LoginScreen({ navigation }) {
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedCardNumber = cardNumber.trim().replace(/\s/g, '');

    if (!normalizedCardNumber) {
      Alert.alert('Card number required', 'Enter your Premier card number to continue.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_PASSENGER_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber: normalizedCardNumber }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const { tempToken, requireSetup } = data.data || {};

      if (!tempToken) {
        throw new Error('No session token received from backend.');
      }

      await SecureStore.setItemAsync('tempToken', tempToken);
      await SecureStore.setItemAsync('pendingCardNumber', normalizedCardNumber);
      navigation.navigate(requireSetup ? 'TotpSetup' : 'TotpVerify');
    } catch (error) {
      Alert.alert('Login failed', error.message || 'Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <SafeAreaView style={styles.content}>
        <Image source={require('../../assets/image/logo-premier-transparent.png')} style={styles.logo} />

        <Text style={styles.brand}>Premier Transport</Text>
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.tagline}>Safe Travel For Everyone</Text>
          <View style={styles.taglineLine} />
        </View>

        <View style={styles.welcomeBox}>
          <View style={styles.userCircle}>
            <Feather name="user" size={23} color={colors.maroon} />
          </View>
          <View style={styles.welcomeTextBlock}>
            <Text style={styles.welcomeTitle}>Welcome, Passenger</Text>
            <Text style={styles.welcomeText}>Enter your card number to securely access your transport account.</Text>
          </View>
        </View>

        <View style={styles.separator}>
          <View style={styles.line} />
          <Text style={styles.separatorText}>Enter Card Number</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.inputShell}>
          <Feather name="credit-card" size={21} color={colors.maroon} />
          <TextInput
            value={cardNumber}
            onChangeText={setCardNumber}
            placeholder="Enter card number"
            placeholderTextColor="#7B8794"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        <View style={styles.helperRow}>
          <View style={styles.helperIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.maroon} />
          </View>
          <Text style={styles.helper}>Find this number on your physical Premier Transit card or tag.</Text>
        </View>

        <Button loading={loading} onPress={handleLogin} style={styles.loginButton} icon={<Feather name="lock" size={21} color="#fff" />}>
          Login Securely
        </Button>

        <View style={styles.secureRow}>
          <View style={styles.secureIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={21} color="#9A6514" />
          </View>
          <Text style={styles.secureText}>Your data is encrypted and secure.</Text>
        </View>

        <View style={styles.footer}>
          <Feather name="lock" size={18} color="#68717E" />
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
    paddingTop: 56,
    paddingBottom: 28,
  },
  logo: {
    width: 112,
    height: 112,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 24,
  },
  brand: {
    color: colors.maroon,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    marginBottom: 44,
  },
  taglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2B12C',
  },
  tagline: {
    color: '#D89A0C',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  welcomeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#F2C9CE',
    backgroundColor: '#FFF9FA',
    borderRadius: 18,
    paddingHorizontal: 20,
    marginBottom: 38,
    ...shadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  userCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF0D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTextBlock: {
    flex: 1,
  },
  welcomeTitle: {
    color: colors.maroon,
    fontWeight: '900',
    fontSize: 17,
    marginBottom: 8,
  },
  welcomeText: {
    color: '#5D6773',
    fontSize: 13,
    lineHeight: 21,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 30,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0BDC4',
  },
  separatorText: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  inputShell: {
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0BDC4',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    ...shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  input: {
    flex: 1,
    color: '#1C2A44',
    fontSize: 18,
    fontWeight: '500',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 42,
  },
  helperIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    flex: 1,
    color: '#626C77',
    fontSize: 12,
    lineHeight: 18,
  },
  loginButton: {
    borderRadius: 16,
    minHeight: 72,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.26,
    shadowRadius: 20,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 40,
  },
  secureIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureText: {
    color: '#565F6B',
    fontSize: 13,
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





