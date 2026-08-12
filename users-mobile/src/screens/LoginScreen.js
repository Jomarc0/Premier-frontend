import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

import Button from '../components/Button';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';
import { useAuth } from '../context/AuthContext';
import { captureMobileEvent } from '../analytics/posthog';
import { API_BASE_URL, API_PASSENGER_BASE } from '../config';
import { colors, shadow } from '../theme';

const PRIVACY_NOTICE_ACCEPTED_KEY = 'premier_privacy_notice_accepted';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { biometricUnlockAvailable, unlockWithBiometrics } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportKeyboardKey, setSupportKeyboardKey] = useState(0);
  const [issueDropdownOpen, setIssueDropdownOpen] = useState(false);
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [privacyAcceptanceRequired, setPrivacyAcceptanceRequired] = useState(false);
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
    if (!biometricUnlockAvailable || biometricLoading || supportOpen || !privacyConsentChecked || privacyNoticeOpen) return;

    setBiometricLoading(true);
    captureMobileEvent(posthog, 'mobile_biometric_prompt_started');

    try {
      await unlockWithBiometrics();
      captureMobileEvent(posthog, 'mobile_biometric_unlock_success');
    } catch {
      captureMobileEvent(posthog, 'mobile_biometric_unlock_failed');
      // Stay on Login. Passenger must use card number after cancelling or failing biometrics.
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricLoading, biometricUnlockAvailable, privacyConsentChecked, privacyNoticeOpen, supportOpen, unlockWithBiometrics]);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(PRIVACY_NOTICE_ACCEPTED_KEY)
      .then((accepted) => {
        if (!mounted) return;
        const acceptanceRequired = accepted !== 'true';
        setPrivacyAcceptanceRequired(acceptanceRequired);
        setPrivacyNoticeOpen(acceptanceRequired);
      })
      .catch(() => {
        if (!mounted) return;
        setPrivacyAcceptanceRequired(true);
        setPrivacyNoticeOpen(true);
      })
      .finally(() => {
        if (mounted) setPrivacyConsentChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supportOpen || Platform.OS !== 'android') return undefined;

    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setSupportKeyboardKey((current) => current + 1);
    });

    return () => keyboardHideSubscription.remove();
  }, [supportOpen]);

  const acceptPrivacyNotice = async () => {
    await AsyncStorage.setItem(PRIVACY_NOTICE_ACCEPTED_KEY, 'true');
    setPrivacyAcceptanceRequired(false);
    setPrivacyNoticeOpen(false);
  };

  useEffect(() => {
    if (
      biometricPromptedRef.current ||
      !biometricUnlockAvailable ||
      supportOpen ||
      !privacyConsentChecked ||
      privacyNoticeOpen
    ) {
      return;
    }

    biometricPromptedRef.current = true;

    const timer = setTimeout(() => {
      openBiometricPrompt();
    }, 450);

    return () => clearTimeout(timer);
  }, [biometricUnlockAvailable, openBiometricPrompt, privacyConsentChecked, privacyNoticeOpen, supportOpen]);

  const handleLogin = async () => {
    const normalizedCardNumber = cardNumber.trim().replace(/\s/g, '');

    if (!normalizedCardNumber) {
      Alert.alert('Card number required', 'Enter your Premier card number to continue.');
      return;
    }

    setLoading(true);
    captureMobileEvent(posthog, 'mobile_login_started');

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
      captureMobileEvent(posthog, requireSetup ? 'mobile_login_totp_setup_required' : 'mobile_login_totp_required');
      navigation.navigate(requireSetup ? 'TotpSetup' : 'TotpVerify');
    } catch (error) {
      captureMobileEvent(posthog, 'mobile_login_failed');
      Alert.alert('Login failed', error.message || 'Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const openSupport = (issueType = 'LOST_CARD', reason = '') => {
    Alert.alert(
      'Login required',
      'Please log in first. Support tickets are securely attached to your account after authentication.',
    );
  };

  const submitSupportTicket = async () => {
    setSupportOpen(false);
    Alert.alert('Login required', 'Please log in first to create a support ticket securely.');
  };

  const beginLostCardReport = async () => {
    await SecureStore.setItemAsync('postLoginAction', 'REPORT_LOST_CARD');
    Alert.alert(
      'Secure verification required',
      'Log in with your card number and Google Authenticator code. You can then freeze the card and provide an email for support updates.',
    );
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

        <Text style={styles.privacyAcknowledgement}>
          By continuing, you acknowledge the{' '}
          <Text
            accessibilityRole="link"
            onPress={() => setPrivacyNoticeOpen(true)}
            style={styles.privacyLink}
          >
            Privacy Notice
          </Text>
          .
        </Text>

        <Pressable style={styles.supportButton} onPress={beginLostCardReport}>
          <MaterialCommunityIcons name="shield-alert-outline" size={20} color={colors.maroon} />
          <Text style={styles.supportButtonText}>Lost your card? Freeze it</Text>
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

      <Modal
        visible={supportOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSupportOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            key={supportKeyboardKey}
            behavior="padding"
            style={styles.modalKeyboard}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close support form"
              onPress={() => setSupportOpen(false)}
              style={styles.modalBackdrop}
            />

            <View style={styles.supportSheet}>
              <View style={styles.supportHeader}>
                <View style={styles.supportHandle} />
                <View style={styles.supportHeaderText}>
                  <Text style={styles.supportTitle}>Premier Support</Text>
                  <Text style={styles.supportSubtitle}>Submit a concern and receive updates by email.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close support form"
                  hitSlop={10}
                  style={styles.closeButton}
                  onPress={() => setSupportOpen(false)}
                >
                  <Feather name="x" size={24} color={colors.maroon} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.supportScroll}
                contentContainerStyle={styles.supportContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text style={styles.supportLabel}>Card Number</Text>
                <View style={styles.supportInputWrap}>
                  <Feather name="credit-card" size={20} color="#68717E" />
                  <TextInput
                    value={supportForm.cardNumber}
                    onChangeText={(value) => setSupportForm((current) => ({ ...current, cardNumber: value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="Enter your 10-digit card number"
                    placeholderTextColor="#8A94A3"
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.supportInput}
                  />
                  <Text style={styles.supportCounter}>{supportForm.cardNumber.length}/10</Text>
                </View>

                <Text style={styles.supportLabel}>Email Address</Text>
                <View style={styles.supportInputWrap}>
                  <Feather name="mail" size={20} color="#68717E" />
                  <TextInput
                    value={supportForm.email}
                    onChangeText={(value) => setSupportForm((current) => ({ ...current, email: value }))}
                    placeholder="name@example.com"
                    placeholderTextColor="#8A94A3"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.supportInput}
                  />
                </View>

                <Text style={styles.supportLabel}>Issue Type</Text>
                <View style={styles.issueDropdown}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Select issue type"
                    accessibilityState={{ expanded: issueDropdownOpen }}
                    onPress={() => setIssueDropdownOpen((open) => !open)}
                    style={[styles.issueDropdownTrigger, issueDropdownOpen && styles.issueDropdownTriggerOpen]}
                  >
                    <View style={styles.issueDropdownLeading}>
                      <MaterialCommunityIcons name="clipboard-alert-outline" size={20} color={colors.maroon} />
                      <Text style={styles.issueDropdownValue}>
                        {issueTypes.find(([value]) => value === supportForm.issueType)?.[1] || 'Select issue type'}
                      </Text>
                    </View>
                    <Feather name={issueDropdownOpen ? 'chevron-up' : 'chevron-down'} size={21} color={colors.maroon} />
                  </Pressable>

                  {issueDropdownOpen && (
                    <View style={styles.issueDropdownMenu}>
                      {issueTypes.map(([value, label], index) => {
                        const selected = supportForm.issueType === value;
                        return (
                          <Pressable
                            key={value}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              setSupportForm((current) => ({ ...current, issueType: value }));
                              setIssueDropdownOpen(false);
                            }}
                            style={[
                              styles.issueDropdownOption,
                              index < issueTypes.length - 1 && styles.issueDropdownOptionBorder,
                              selected && styles.issueDropdownOptionSelected,
                            ]}
                          >
                            <Text style={[styles.issueDropdownOptionText, selected && styles.issueDropdownOptionTextSelected]}>
                              {label}
                            </Text>
                            {selected && <Feather name="check" size={18} color={colors.maroon} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                <Text style={styles.supportLabel}>Reason / Description</Text>
                <View style={styles.supportTextAreaWrap}>
                  <TextInput
                    value={supportForm.reason}
                    onChangeText={(value) => setSupportForm((current) => ({ ...current, reason: value.slice(0, 500) }))}
                    placeholder="Describe what happened and what assistance you need."
                    placeholderTextColor="#8A94A3"
                    multiline
                    maxLength={500}
                    style={styles.supportTextarea}
                  />
                  <Text style={styles.reasonCounter}>{supportForm.reason.length}/500</Text>
                </View>

                <View style={styles.supportNotice}>
                  <View style={styles.noticeIcon}>
                    <Feather name="shield" size={25} color={colors.maroon} />
                  </View>
                  <Text style={styles.noticeText}>For your security, the card may be temporarily disabled after admin review.</Text>
                </View>
              </ScrollView>

              <View style={[styles.supportFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <Button
                  accessibilityLabel="Submit Ticket"
                  loading={supportLoading}
                  onPress={submitSupportTicket}
                  style={styles.submitSupportButton}
                  icon={<Feather name="send" size={22} color="#FFFFFF" />}
                >
                  Submit Ticket
                </Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <PrivacyNoticeModal
        visible={privacyNoticeOpen}
        onClose={() => setPrivacyNoticeOpen(false)}
        requireAcceptance={privacyAcceptanceRequired}
        onAccept={privacyAcceptanceRequired ? acceptPrivacyNotice : undefined}
      />
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
  privacyAcknowledgement: {
    color: '#646D78',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  privacyLink: {
    color: colors.maroon,
    fontWeight: '900',
    textDecorationLine: 'underline',
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
    backgroundColor: 'rgba(20, 18, 24, 0.52)',
  },
  modalKeyboard: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  supportSheet: {
    width: '100%',
    height: '88%',
    maxHeight: '88%',
    minHeight: 420,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFCFD',
    overflow: 'hidden',
  },
  supportHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF3',
  },
  supportHandle: {
    position: 'absolute',
    top: 14,
    left: '50%',
    width: 48,
    marginLeft: -24,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  supportHeaderText: {
    flex: 1,
    paddingRight: 16,
  },
  supportTitle: {
    color: colors.maroon,
    fontSize: 24,
    fontWeight: '900',
  },
  supportSubtitle: {
    marginTop: 6,
    color: '#4F5966',
    fontSize: 14,
    lineHeight: 19,
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F1',
  },
  supportScroll: {
    flex: 1,
  },
  supportContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 32,
  },
  supportLabel: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  supportInputWrap: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#CDD4DD',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  supportInput: {
    flex: 1,
    color: '#1C2A44',
    fontSize: 15,
    minHeight: 52,
  },
  supportCounter: {
    color: '#8A94A3',
    fontSize: 13,
  },
  supportTextAreaWrap: {
    minHeight: 126,
    borderWidth: 1,
    borderColor: '#CDD4DD',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 18,
  },
  supportTextarea: {
    flex: 1,
    color: '#1C2A44',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  reasonCounter: {
    alignSelf: 'flex-end',
    color: '#8A94A3',
    fontSize: 13,
    marginBottom: 10,
  },
  issueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 22,
  },
  issueChip: {
    width: '48.5%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D79AA4',
    borderRadius: 16,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  issueChipWide: {
    width: '100%',
  },
  issueChipActive: {
    borderColor: colors.maroon,
    backgroundColor: colors.maroon,
  },
  issueChipText: {
    color: '#2F3742',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
    lineHeight: 18,
    textAlign: 'center',
  },
  issueChipTextActive: {
    color: '#FFFFFF',
  },
  issueDropdown: {
    marginBottom: 22,
  },
  issueDropdownTrigger: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D79AA4',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  issueDropdownTriggerOpen: {
    borderColor: colors.maroon,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  issueDropdownLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  issueDropdownValue: {
    flex: 1,
    color: '#2F3742',
    fontSize: 14,
    fontWeight: '800',
  },
  issueDropdownMenu: {
    overflow: 'hidden',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.maroon,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  issueDropdownOption: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  issueDropdownOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1E1E3',
  },
  issueDropdownOptionSelected: {
    backgroundColor: '#FFF1F3',
  },
  issueDropdownOptionText: {
    color: '#2F3742',
    fontSize: 13,
    fontWeight: '700',
  },
  issueDropdownOptionTextSelected: {
    color: colors.maroon,
    fontWeight: '900',
  },
  supportNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    backgroundColor: '#FFF3F4',
    padding: 16,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9EF',
  },
  noticeText: {
    flex: 1,
    color: '#4F5966',
    fontSize: 14,
    lineHeight: 20,
  },
  supportFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF3',
    backgroundColor: '#FFFCFD',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  submitSupportButton: {
    borderRadius: 18,
    minHeight: 56,
  },
});
