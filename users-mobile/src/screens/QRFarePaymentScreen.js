import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { getQrFareStatus, requestQrFareToken } from '../api/qrPaymentService';
import { colors, shadow } from '../theme';

const REFRESH_BUFFER_SECONDS = 8;
const SUCCESS_RETURN_MS = 4000;

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function QRFarePaymentScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const modalQrSize = Math.min(330, Math.max(260, width - 72));
  const [qrData, setQrData] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [screenState, setScreenState] = useState('loading');
  const [payment, setPayment] = useState(null);
  const [failureMessage, setFailureMessage] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);

  const loadQrToken = useCallback(async (refreshing = false) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setFailureMessage(null);
    setScreenState(refreshing ? 'refreshing' : 'loading');

    try {
      const data = await requestQrFareToken();
      if (!data?.payload) {
        throw new Error('Unable to prepare secure QR code.');
      }

      if (!mountedRef.current) return;
      setQrData(data);
      setRemainingSeconds(Number(data.expiresInSeconds || 45));
      setScreenState('ready');
    } catch (error) {
      if (!mountedRef.current) return;
      setQrData(null);
      setRemainingSeconds(0);
      setFailureMessage(error.response?.data?.message || error.message || 'Unable to refresh secure QR.');
      setScreenState('failed');
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  const checkPaymentStatus = useCallback(async () => {
    if (!qrData?.payload || screenState !== 'ready') return;

    try {
      const status = await getQrFareStatus(qrData.payload);
      if (!mountedRef.current) return;

      if (status?.status === 'USED' && status.payment) {
        setPayment(status.payment);
        setScreenState('success');
        return;
      }

      if (status?.status === 'EXPIRED') {
        await loadQrToken(true);
        return;
      }

      if (typeof status?.expiresInSeconds === 'number') {
        setRemainingSeconds(status.expiresInSeconds);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setFailureMessage(error.response?.data?.message || 'Reader connection issue. Please try again.');
      setScreenState('failed');
    }
  }, [loadQrToken, qrData?.payload, screenState]);

  useEffect(() => {
    mountedRef.current = true;
    loadQrToken(false);

    return () => {
      mountedRef.current = false;
    };
  }, [loadQrToken]);

  useEffect(() => {
    if (screenState !== 'ready') return undefined;

    const timer = setInterval(() => {
      setRemainingSeconds((current) => {
        const next = Math.max(0, current - 1);
        if (next <= REFRESH_BUFFER_SECONDS) {
          loadQrToken(true);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loadQrToken, screenState]);

  useEffect(() => {
    if (screenState !== 'ready') return undefined;
    const poller = setInterval(checkPaymentStatus, 2500);
    return () => clearInterval(poller);
  }, [checkPaymentStatus, screenState]);

  useEffect(() => {
    if (screenState !== 'success') return undefined;
    const timer = setTimeout(() => navigation.navigate('Dashboard'), SUCCESS_RETURN_MS);
    return () => clearTimeout(timer);
  }, [navigation, screenState]);

  const heroContent = useMemo(() => {
    if (screenState === 'success') {
      return <PaymentSuccess payment={payment} onDone={() => navigation.navigate('Dashboard')} />;
    }

    if (screenState === 'failed') {
      return (
        <PaymentFailed
          message={failureMessage}
          onTryAgain={() => loadQrToken(false)}
          onUseNfc={() => navigation.replace('MobileNfcPayment')}
        />
      );
    }

    const isRefreshing = screenState === 'refreshing';
    const isLoading = screenState === 'loading' || isRefreshing;

    return (
      <>
        <View style={styles.qrStage}>
          <View style={styles.scanPrompt}>
            <View style={styles.scanPromptIcon}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <MaterialCommunityIcons name="qrcode-scan" size={46} color="#fff" />
              )}
            </View>
            <Text style={styles.scanPromptTitle}>{isLoading ? 'Preparing secure QR' : 'QR ready for reader'}</Text>
            <Text style={styles.scanPromptText}>Tap the button below to show a large QR code for the fare reader.</Text>
          </View>
        </View>

        <View style={styles.scanStatusChip}>
          <View style={styles.liveDot} />
          <Text style={styles.scanStatusText}>{isRefreshing ? 'REFRESHING SECURE QR' : 'READY TO SCAN'}</Text>
        </View>
        <Button disabled={isLoading || !qrData?.payload} onPress={() => setQrModalOpen(true)} style={styles.showQrButton} icon={<MaterialCommunityIcons name="qrcode-scan" size={20} color="#fff" />}>
          Show QR Code
        </Button>
        <Text style={styles.countdown}>Refreshes in {formatCountdown(remainingSeconds)}</Text>
        <Text style={styles.securityNote}>Your QR code refreshes automatically for security.</Text>
      </>
    );
  }, [failureMessage, loadQrToken, navigation, payment, qrData?.payload, remainingSeconds, screenState]);

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
            <Text style={styles.headerBadgeText}>Secure QR</Text>
          </View>
          <Pressable style={styles.helpButton} onPress={() => setHelpOpen(true)}>
            <Feather name="help-circle" size={20} color={colors.maroon} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.eyebrow}>Premier Mobile Fare</Text>
              <Text style={styles.title}>QR Code Payment</Text>
            </View>
            <View style={styles.qrMark}>
              <MaterialCommunityIcons name="qrcode" size={30} color="#fff" />
            </View>
          </View>
          {heroContent}
        </View>

        <View style={styles.guideList}>
          <PaymentGuideCard icon="check-circle" iconColor={colors.success} title="Ready to scan" text="Keep this QR code visible while boarding." />
          <PaymentGuideCard icon="qrcode-scan" iconColor={colors.maroon} title="Show to reader" text="Place your phone screen in front of the Premier fare reader." />
          <PaymentGuideCard icon="cellphone" iconColor={colors.maroon} title="Hold steady" text="Keep your phone still until the reader confirms payment." />
          <PaymentGuideCard icon="check-decagram" iconColor={colors.success} title="Wait for confirmation" text="Wait for the beep or success message before entering." />
        </View>

        <View style={styles.helpCard}>
          <View style={styles.helpIcon}>
            <Feather name="sun" size={18} color={colors.warning} />
          </View>
          <View style={styles.helpCopy}>
            <Text style={styles.helpTitle}>Having trouble scanning?</Text>
            <Text style={styles.helpText}>Increase your screen brightness and make sure the QR code is fully visible.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={qrModalOpen} transparent animationType="fade" onRequestClose={() => setQrModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Premier Mobile Fare</Text>
                <Text style={styles.modalTitle}>Scan QR Code</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setQrModalOpen(false)}>
                <Feather name="x" size={22} color={colors.maroon} />
              </Pressable>
            </View>

            <View style={styles.modalQrFrame}>
              {qrData?.payload ? (
                <QRCode value={qrData.payload} size={modalQrSize} backgroundColor="#FFFFFF" color="#000000" quietZone={18} />
              ) : (
                <ActivityIndicator color={colors.maroon} />
              )}
            </View>

            <View style={styles.modalStatus}>
              <View style={styles.liveDot} />
              <Text style={styles.modalStatusText}>Ready to scan</Text>
            </View>
            <Text style={styles.modalCountdown}>Refreshes in {formatCountdown(remainingSeconds)}</Text>
            <Text style={styles.modalHint}>Keep brightness high and hold the phone steady until the reader confirms payment.</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Passenger Guide</Text>
                <Text style={styles.helpModalTitle}>How QR payment works</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setHelpOpen(false)}>
                <Feather name="x" size={22} color={colors.maroon} />
              </Pressable>
            </View>
            <Text style={styles.helpModalText}>
              Tap Show QR Code, face the QR toward the fare reader, keep your screen brightness high, and hold the phone steady until the reader confirms payment.
            </Text>
            <Button style={styles.helpModalButton} onPress={() => setHelpOpen(false)}>Got it</Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PaymentSuccess({ payment, onDone }) {
  return (
    <View style={styles.resultCard}>
      <View style={[styles.resultIcon, styles.resultIconSuccess]}>
        <Feather name="check" size={42} color="#fff" />
      </View>
      <Text style={styles.resultTitle}>Payment Successful</Text>
      <Text style={styles.resultLine}>Fare deducted: PHP {formatCurrency(payment?.deductedFare)}</Text>
      <Text style={styles.resultLine}>Remaining balance: PHP {formatCurrency(payment?.remainingBalance)}</Text>
      <Text style={styles.resultReference}>Transaction ID: {payment?.referenceNumber || '-'}</Text>
      <Text style={styles.boardingText}>You may now board.</Text>
      <Button variant="secondary" style={styles.resultButton} onPress={onDone}>Done</Button>
    </View>
  );
}

function PaymentFailed({ message, onTryAgain, onUseNfc }) {
  return (
    <View style={styles.resultCard}>
      <View style={[styles.resultIcon, styles.resultIconFailed]}>
        <Feather name="alert-triangle" size={36} color="#fff" />
      </View>
      <Text style={styles.resultTitle}>Payment Unsuccessful</Text>
      <Text style={styles.failedMessage}>{message || 'Payment could not be completed.'}</Text>
      <View style={styles.failedActions}>
        <Button style={styles.failedButton} onPress={onTryAgain}>Try Again</Button>
        <Button variant="secondary" style={styles.failedButton} onPress={onUseNfc}>Use NFC Instead</Button>
      </View>
    </View>
  );
}

function PaymentGuideCard({ icon, iconColor, title, text }) {
  return (
    <View style={styles.guideCard}>
      <View style={[styles.guideIcon, { backgroundColor: `${iconColor}14` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.guideCopy}>
        <Text style={styles.guideTitle}>{title}</Text>
        <Text style={styles.guideText}>{text}</Text>
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
  helpButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.06 },
  hero: { backgroundColor: colors.maroon, borderRadius: 22, padding: 22, overflow: 'hidden', ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  heroTitleWrap: { flex: 1 },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 7 },
  qrMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center' },
  qrStage: { alignItems: 'center', justifyContent: 'center', minHeight: 210, marginTop: 16 },
  scanPrompt: { width: '100%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(250,204,21,0.28)', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  scanPromptIcon: { width: 86, height: 86, borderRadius: 28, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  scanPromptTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  scanPromptText: { color: '#F8D7DA', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  scanStatusChip: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(232,255,246,0.96)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginTop: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  scanStatusText: { color: colors.green, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  showQrButton: { marginTop: 16, minHeight: 54, borderRadius: 16 },
  countdown: { color: '#fff', fontSize: 13, textAlign: 'center', fontWeight: '900', marginTop: 8 },
  securityNote: { color: '#F8D7DA', fontSize: 11, textAlign: 'center', marginTop: 6 },
  guideList: { gap: 10, marginTop: 16 },
  guideCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E4EBF4', ...shadow, shadowOpacity: 0.04 },
  guideIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  guideCopy: { flex: 1 },
  guideTitle: { color: '#1C2A44', fontSize: 13, fontWeight: '900' },
  guideText: { color: '#536987', fontSize: 12, lineHeight: 18, marginTop: 3 },
  helpCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E4EBF4', marginTop: 14 },
  helpIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFF7DB', alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1 },
  helpTitle: { color: '#1C2A44', fontSize: 13, fontWeight: '900' },
  helpText: { color: '#536987', fontSize: 12, lineHeight: 18, marginTop: 3 },
  resultCard: { alignItems: 'center', justifyContent: 'center', minHeight: 318, paddingTop: 20 },
  resultIcon: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  resultIconSuccess: { backgroundColor: colors.success },
  resultIconFailed: { backgroundColor: '#B4232D' },
  resultTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  resultLine: { color: '#F8D7DA', fontSize: 13, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  resultReference: { color: colors.yellow, fontSize: 12, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  boardingText: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  resultButton: { minWidth: 150, marginTop: 18 },
  failedMessage: { color: '#F8D7DA', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  failedActions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  failedButton: { flex: 1, minHeight: 48 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 16, 28, 0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 430, backgroundColor: '#fff', borderRadius: 26, padding: 18, ...shadow, shadowOpacity: 0.18, shadowRadius: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalEyebrow: { color: colors.maroon, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  modalTitle: { color: '#101828', fontSize: 24, fontWeight: '900', marginTop: 3 },
  modalClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF2F3', alignItems: 'center', justifyContent: 'center' },
  modalQrFrame: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E8C58A', padding: 10 },
  modalStatus: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8FFF6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 16 },
  modalStatusText: { color: colors.green, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  modalCountdown: { color: colors.maroon, fontSize: 15, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  modalHint: { color: '#536987', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  helpModalCard: { width: '100%', maxWidth: 430, backgroundColor: '#fff', borderRadius: 26, padding: 18, ...shadow, shadowOpacity: 0.18, shadowRadius: 24 },
  helpModalTitle: { color: '#101828', fontSize: 22, fontWeight: '900', marginTop: 3 },
  helpModalText: { color: '#536987', fontSize: 14, lineHeight: 21, marginTop: 4 },
  helpModalButton: { marginTop: 16, minHeight: 48 },
});
