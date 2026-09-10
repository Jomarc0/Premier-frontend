import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

import { useFocusEffect } from '@react-navigation/native';
import Button from '../components/Button';
import api from '../api/api';
import { beginHceSession, clearHceToken, getHceStatus, isHceReady, saveHceToken } from '../api/hceTokenStore';
import { captureMobileEvent } from '../analytics/posthog';
import { colors, shadow } from '../theme';

export default function MobileNfcPaymentScreen({ navigation }) {
  const posthog = usePostHog();
  const [checking, setChecking] = useState(true);
  const [nfcSupported, setNfcSupported] = useState(null);
  const [nfcEnabled, setNfcEnabled] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [mobileToken, setMobileToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  const checkNfc = useCallback(async () => {
    setChecking(true);

    try {
      if (Platform.OS !== 'android') {
        setNfcSupported(false);
        setNfcEnabled(false);
        return;
      }

      const { supported, enabled } = await getHceStatus();

      setNfcSupported(supported);
      setNfcEnabled(enabled);
      captureMobileEvent(posthog, 'mobile_nfc_status_checked', {
        supported,
        enabled,
      });
    } catch {
      setNfcSupported(false);
      setNfcEnabled(false);
      captureMobileEvent(posthog, 'mobile_nfc_status_failed');
    } finally {
      setChecking(false);
    }
  }, [posthog]);

  const active = useRef(false);
  const requestVersion = useRef(0);
  const invalidate = useCallback(() => {
    requestVersion.current += 1;
    void clearHceToken();
    setMobileToken(null);
    setTokenExpiresAt(null);
    setTokenLoading(false);
  }, []);

  const prepareMobileToken = useCallback(async () => {
    const version = ++requestVersion.current;
    const current = () => active.current && AppState.currentState === 'active' && version === requestVersion.current;
    if (!current()) return;
    setTokenLoading(true);
    setMobileToken(null);
    setTokenError(null);
    try {
      const generation = await beginHceSession();
      if (!current()) return;
      if (generation < 0) throw new Error('Native NFC is unavailable. Keep this screen open and your phone unlocked.');
      const startedAt = Date.now();
      const response = await api.post('/fare/nfc/token');
      if (!current()) return;
      const data = response.data?.data || {};
      const token = data.payload || data.token;
      // Use a monotonic native lifetime; subtract the complete HTTP duration conservatively.
      const ttl = Math.min(120000, Number(data.expiresInSeconds) * 1000) - (Date.now() - startedAt);
      if (!token || !Number.isFinite(ttl) || ttl <= 0) throw new Error('Payment token expired. Refresh NFC Pay.');
      const saved = await saveHceToken(token, ttl, generation);
      if (!current()) return;
      if (!saved) throw new Error('Native NFC did not accept the token. Refresh while the phone is unlocked.');
      setMobileToken(true);
      setTokenExpiresAt(Date.now() + ttl);
      captureMobileEvent(posthog, 'mobile_nfc_token_ready');
    } catch (error) {
      if (!current()) return;
      await clearHceToken();
      if (!current()) return;
      setMobileToken(null);
      setTokenExpiresAt(null);
      setTokenError(error.response?.data?.message || error.message || 'Unable to prepare NFC payment.');
    } finally {
      if (current()) setTokenLoading(false);
    }
  }, [posthog]);

  const refreshNfcPayment = useCallback(async () => {
    if (!active.current || AppState.currentState !== 'active') return;
    await checkNfc();
    if (active.current && AppState.currentState === 'active') await prepareMobileToken();
  }, [checkNfc, prepareMobileToken]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void refreshNfcPayment();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') invalidate();
    });
    return () => {
      active.current = false;
      requestVersion.current += 1;
      subscription.remove();
      void clearHceToken();
    };
  }, [refreshNfcPayment, invalidate]));

  useEffect(() => {
    if (!mobileToken || !tokenExpiresAt) return undefined;
    const version = requestVersion.current;
    const check = async () => {
      const ready = Date.now() < tokenExpiresAt && await isHceReady();
      if (active.current && version === requestVersion.current && !ready) {
        invalidate();
        setTokenError('Tap ended or token expired. Check payment history before preparing another tap.');
      }
    };
    const timer = setInterval(check, 500);
    return () => clearInterval(timer);
  }, [mobileToken, tokenExpiresAt, invalidate]);

  const status = useMemo(() => {
    if (checking) {
      return {
        icon: null,
        color: colors.teal,
        label: 'Checking NFC status',
        detail: 'Keep the phone unlocked while preparing to tap.',
      };
    }

    if (tokenLoading) {
      return {
        icon: null,
        color: colors.teal,
        label: 'Preparing payment token',
        detail: 'Keep this screen open while the payment is prepared for this screen.',
      };
    }

    if (tokenError) {
      return {
        icon: 'alert-circle',
        color: colors.warning,
        label: 'Token is not ready',
        detail: tokenError,
      };
    }

    if (nfcSupported === false) {
      return {
        icon: 'alert-triangle',
        color: colors.warning,
        label: 'NFC is not available',
        detail: 'Use an Android phone that supports NFC card emulation.',
      };
    }

    if (nfcEnabled === false) {
      return {
        icon: 'alert-circle',
        color: colors.warning,
        label: 'NFC is turned off',
        detail: 'Turn on NFC in phone settings, then check again.',
      };
    }

    if (!mobileToken) return { icon: 'info', color: colors.teal, label: 'NFC payment is paused', detail: 'Refresh NFC Pay when you are ready to tap.' };

    return {
      icon: 'check-circle',
      color: colors.success,
      label: 'Ready to tap',
      detail: 'Hold the back of the phone near the Premier fare reader.',
    };
  }, [checking, nfcEnabled, nfcSupported, tokenError, tokenLoading, mobileToken]);

  return (
    <SafeAreaView style={styles.outer}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Button
            variant="ghost"
            style={styles.backButton}
            textStyle={styles.backText}
            onPress={() => navigation.goBack()}
            icon={<Feather name="arrow-left" size={20} color={colors.maroon} />}
          >
            Back
          </Button>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="shield-check" size={15} color={colors.green} />
            <Text style={styles.headerBadgeText}>Secure HCE</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>Premier Mobile Fare</Text>
              <Text style={styles.title}>Mobile NFC Payment</Text>
            </View>
            <View style={styles.nfcMark}>
              <MaterialCommunityIcons name="nfc" size={30} color="#fff" />
            </View>
          </View>

          <View style={styles.phoneStage}>
            <View style={styles.waveOuter}>
              <View style={styles.waveMiddle}>
                <View style={styles.phone}>
                  <View style={styles.phoneSpeaker} />
                  <MaterialCommunityIcons name="cellphone-nfc" size={54} color="#fff" />
                  <Text style={styles.phoneText}>{mobileToken ? 'Tap Ready' : 'Not Ready'}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.instructions}>Tap the back of your phone on the Premier fare reader.</Text>
        </View>

        <View style={[styles.statusCard, { borderColor: `${status.color}44` }]}>
          <View style={[styles.statusIcon, { backgroundColor: `${status.color}18` }]}>
            {checking || tokenLoading ? (
              <ActivityIndicator color={status.color} />
            ) : (
              <Feather name={status.icon} size={20} color={status.color} />
            )}
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusLabel}>{status.label}</Text>
            <Text style={styles.statusDetail}>{status.detail}</Text>
          </View>
        </View>



        <View style={styles.steps}>
          <Step icon="unlock" title="Unlock" text="Keep your phone awake." />
          <Step icon="smartphone" title="Position" text="Use the back center of the phone." />
          <Step icon="radio" title="Hold" text="Wait for the reader confirmation." />
        </View>

        <Button
          variant="secondary"
          style={styles.refreshButton}
          loading={checking || tokenLoading}
          onPress={refreshNfcPayment}
          icon={<Feather name="refresh-cw" size={17} color="#fff" />}
        >
          Refresh NFC Pay
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}



function Step({ icon, title, text }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>
        <Feather name={icon} size={18} color={colors.teal} />
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F6F9FD' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { paddingHorizontal: 0 },
  backText: { fontSize: 11 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8FFF6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  headerBadgeText: { color: colors.green, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  hero: { backgroundColor: colors.maroon, borderRadius: 22, padding: 22, overflow: 'hidden', ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 7 },
  nfcMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  phoneStage: { alignItems: 'center', justifyContent: 'center', minHeight: 210 },
  waveOuter: { width: 192, height: 192, borderRadius: 96, borderWidth: 1, borderColor: 'rgba(250,204,21,0.34)', alignItems: 'center', justifyContent: 'center' },
  waveMiddle: { width: 148, height: 148, borderRadius: 74, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  phone: { width: 88, height: 138, borderRadius: 24, backgroundColor: colors.navy, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  phoneSpeaker: { position: 'absolute', top: 10, width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  phoneText: { color: colors.yellow, fontSize: 10, fontWeight: '900', marginTop: 10, textTransform: 'uppercase' },
  instructions: { color: '#F8D7DA', fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '800' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#fff', borderRadius: 17, padding: 16, marginTop: 16, borderWidth: 1, ...shadow, shadowOpacity: 0.05 },
  statusIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1 },
  statusLabel: { color: '#1C2A44', fontSize: 14, fontWeight: '900' },
  statusDetail: { color: '#536987', fontSize: 12, lineHeight: 18, marginTop: 4 },
  steps: { gap: 10, marginTop: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E4EBF4' },
  stepIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1 },
  stepTitle: { color: '#1C2A44', fontSize: 13, fontWeight: '900' },
  stepText: { color: '#536987', fontSize: 12, lineHeight: 18, marginTop: 3 },
  refreshButton: { marginTop: 16, backgroundColor: colors.teal },
});

