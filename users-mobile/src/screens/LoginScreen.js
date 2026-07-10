import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

export default function LoginScreen({ navigation }) {
  const { biometricUnlockAvailable, unlockWithBiometrics } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportForm, setSupportForm] = useState({
    cardNumber: '',
    email: '',
    issueType: 'LOST_CARD',
    reason: '',
  });
  const biometricPromptedRef = useRef(false);

  const issueTypes = [
    ['LOST_CARD', 'Lost Card'],
    ['FREEZE_CARD', 'Freeze Card'],
    ['DAMAGED_CARD', 'Damaged Card'],
    ['TOP_UP_ISSUE', 'Top-up Issue'],
    ['BALANCE_CONCERN', 'Balance Concern'],
    ['LOGIN_PROBLEM', 'Login Problem'],
    ['RFID_NOT_WORKING', 'RFID Not Working'],
    ['OTHER', 'Other'],
  ];


  const openBiometricPrompt = useCallback(async () => {
    if (!biometricUnlockAvailable || biometricLoading || supportOpen) return;

    setBiometricLoading(true);

    try {
      await unlockWithBiometrics();
    } catch {
      // Stay on Login. Passenger must use card number after cancelling or failing biometrics.
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricLoading, biometricUnlockAvailable, supportOpen, unlockWithBiometrics]);

  useEffect(() => {
    if (
      biometricPromptedRef.current ||
      !biometricUnlockAvailable ||
      supportOpen
    ) {
      return;
    }

    biometricPromptedRef.current = true;

    const timer = setTimeout(() => {
      openBiometricPrompt();
    }, 450);

    return () => clearTimeout(timer);
  }, [biometricUnlockAvailable, openBiometricPrompt, supportOpen]);

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

  const openSupport = (issueType = 'LOST_CARD', reason = '') => {
    setSupportForm({
      cardNumber: cardNumber.trim().replace(/\s/g, ''),
      email: '',
      issueType,
      reason,
    });
    setSupportOpen(true);
  };

  const submitSupportTicket = async () => {
    const normalizedCardNumber = supportForm.cardNumber.trim().replace(/\s/g, '');
    const email = supportForm.email.trim();
    const reason = supportForm.reason.trim();

    if (!normalizedCardNumber) {
      Alert.alert('Card number required', 'You must know your card number before submitting a support ticket.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Valid email required', 'Enter an email address where admin can send confirmation.');
      return;
    }
    if (!reason) {
      Alert.alert('Description required', 'Tell admin what happened so they can review the ticket.');
      return;
    }

    setSupportLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/support-tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: normalizedCardNumber,
          email,
          issueType: supportForm.issueType,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Unable to submit support ticket.');
      }
      setSupportOpen(false);
      Alert.alert(
        'Ticket submitted',
        data.message || `Your ticket has been submitted successfully. Your ticket number is ${data.data?.ticketNumber}. Please wait for admin confirmation through your email.`,
      );
    } catch (error) {
      Alert.alert('Support ticket failed', error.message || 'Please try again.');
    } finally {
      setSupportLoading(false);
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

        <Pressable style={styles.supportButton} onPress={() => openSupport('LOGIN_PROBLEM', 'I need help with my Premier card or login.')}>
          <MaterialCommunityIcons name="chat-question-outline" size={20} color={colors.maroon} />
          <Text style={styles.supportButtonText}>Need help? Chat with support</Text>
        </Pressable>

        <View style={styles.secureRow}>
          <View style={styles.secureIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={21} color="#9A6514" />
          </View>
          <Text style={styles.secureText}>Your data is encrypted and secure.</Text>
        </View>

        <View style={styles.footer}>
          <Feather name="lock" size={18} color="#68717E" />
          <Text style={styles.copyright}>(C) 2026 Premier Transport Corp. - Encrypted Portal</Text>
        </View>
      </SafeAreaView>

      <Modal visible={supportOpen} transparent animationType="slide" onRequestClose={() => setSupportOpen(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <View style={styles.supportSheet}>
              <View style={styles.supportHeader}>
                <View>
                  <Text style={styles.supportTitle}>Premier Support</Text>
                  <Text style={styles.supportSubtitle}>Admin will review your ticket and reply by email.</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={() => setSupportOpen(false)}>
                  <Feather name="x" size={20} color={colors.maroon} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.supportContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.botBubble}>This request needs admin review. Fill out this support form using your card number, email address, and reason.</Text>

                <Text style={styles.supportLabel}>Card Number</Text>
                <TextInput
                  value={supportForm.cardNumber}
                  onChangeText={(value) => setSupportForm((current) => ({ ...current, cardNumber: value }))}
                  placeholder="Enter your Premier card number"
                  placeholderTextColor="#8A94A3"
                  keyboardType="number-pad"
                  style={styles.supportInput}
                />

                <Text style={styles.supportLabel}>Email Address</Text>
                <TextInput
                  value={supportForm.email}
                  onChangeText={(value) => setSupportForm((current) => ({ ...current, email: value }))}
                  placeholder="email@example.com"
                  placeholderTextColor="#8A94A3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.supportInput}
                />

                <Text style={styles.supportLabel}>Issue Type</Text>
                <View style={styles.issueGrid}>
                  {issueTypes.map(([value, label]) => {
                    const selected = supportForm.issueType === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setSupportForm((current) => ({ ...current, issueType: value }))}
                        style={[styles.issueChip, selected && styles.issueChipActive]}
                      >
                        <Text style={[styles.issueChipText, selected && styles.issueChipTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.supportLabel}>Reason / Description</Text>
                <TextInput
                  value={supportForm.reason}
                  onChangeText={(value) => setSupportForm((current) => ({ ...current, reason: value }))}
                  placeholder="Example: I lost my RFID card yesterday."
                  placeholderTextColor="#8A94A3"
                  multiline
                  style={[styles.supportInput, styles.supportTextarea]}
                />

                <Button loading={supportLoading} onPress={submitSupportTicket} style={styles.submitSupportButton}>
                  Submit Ticket
                </Button>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  supportButton: {
    minHeight: 54,
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0BDC4',
    backgroundColor: '#FFF9FA',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  supportButtonText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: '900',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 18, 24, 0.48)',
    justifyContent: 'flex-end',
  },
  modalKeyboard: {
    width: '100%',
  },
  supportSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFCFD',
    overflow: 'hidden',
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F2D0D5',
  },
  supportTitle: {
    color: colors.maroon,
    fontSize: 18,
    fontWeight: '900',
  },
  supportSubtitle: {
    marginTop: 3,
    color: '#68717E',
    fontSize: 12,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F1',
  },
  supportContent: {
    padding: 22,
    paddingBottom: 30,
  },
  botBubble: {
    color: '#4F5966',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2D0D5',
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  supportLabel: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  supportInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#F0BDC4',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    color: '#1C2A44',
    fontSize: 14,
    marginBottom: 16,
  },
  supportTextarea: {
    minHeight: 110,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  issueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  issueChip: {
    borderWidth: 1,
    borderColor: '#F0BDC4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  issueChipActive: {
    borderColor: colors.maroon,
    backgroundColor: colors.maroon,
  },
  issueChipText: {
    color: '#626C77',
    fontSize: 11,
    fontWeight: '800',
  },
  issueChipTextActive: {
    color: '#FFFFFF',
  },
  submitSupportButton: {
    marginTop: 4,
    borderRadius: 16,
    minHeight: 58,
  },
});
