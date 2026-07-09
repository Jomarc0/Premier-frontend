import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Image,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../api/api';
import AppGuideOverlay from '../components/AppGuideOverlay';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme';

const loadNfcManager = () => {
  try {
    return require('react-native-nfc-manager').default;
  } catch {
    return null;
  }
};

const QUICK_AMOUNTS = [20, 40, 50, 100, 200, 500];
const QUICK_REPLIES = ['Top-up issue', 'Fare deduction', 'Payment failed', 'Lost RFID card', 'Check balance'];
const APP_GUIDE_STORAGE_KEY = 'premierPassengerAppGuideCompleted';
const WALLET_GUIDE_STORAGE_KEY = 'premierPassengerWalletGuideCompleted';
const TOPUP_GUIDE_STORAGE_KEY = 'premierPassengerTopUpGuideCompleted';

const PAYMENT_OPTIONS = [
  {
    id: 'GCASH',
    name: 'GCash',
    detail: 'Pay securely with GCash',
    logo: require('../../assets/image/gcash.png'),
  },
  {
    id: 'MAYA',
    name: 'Maya',
    detail: 'Pay securely with Maya',
    logo: require('../../assets/image/maya.png'),
  },
];

const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return 'No card assigned';
  return `Card **** ${String(cardNumber).slice(-4)}`;
};

const displayCardNumber = (cardNumber) => {
  if (!cardNumber) return '-';
  return String(cardNumber).replace(/(.{4})/g, '$1 ').trim();
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const transactionId = (tx) => tx?.referenceNumber || `TX-${tx?.id}`;

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

function formatDate(dateStr) {
  if (!dateStr) return '';

  return new Date(dateStr).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TransactionRow({ tx }) {
  const isCredit = tx.type === 'TOPUP';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, isCredit ? styles.txIconCredit : styles.txIconFare]}>
        <MaterialCommunityIcons
          name={isCredit ? 'cellphone' : 'map-marker-outline'}
          size={17}
          color={isCredit ? '#00A86B' : colors.maroon}
        />
      </View>

      <View style={styles.txMeta}>
        <Text style={styles.txTitle}>
          {isCredit ? 'Top-Up Load' : 'Fare Payment'}
        </Text>
        <Text style={styles.txId}>ID: {transactionId(tx)}</Text>
        <Text style={styles.txDate}>
          {formatDate(tx.createdAt)} {isCredit ? 'via Wallet' : ''}
        </Text>
      </View>

      <View style={styles.txRight}>
        <Text style={[styles.txAmount, isCredit && styles.txAmountCredit]}>
          {isCredit ? '+' : '-'}PHP {formatCurrency(tx.amount)}
        </Text>
        <Text style={styles.txStatus}>Completed</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const {
    passenger,
    logout,
    biometricEnabled,
    enableBiometrics,
    disableBiometrics,
  } = useAuth();

  const screen = useWindowDimensions();

  const [activeTab, setActiveTab] = useState('Home');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [pendingPayment, setPendingPayment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('GCASH');

  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [nfcSupported, setNfcSupported] = useState(null);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcCardActive, setNfcCardActive] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null);

  const [guideVisible, setGuideVisible] = useState(false);
  const [guideIndex, setGuideIndex] = useState(0);
  const [guideMode, setGuideMode] = useState('home');

  const [helpContent, setHelpContent] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "Hi! I'm Premier Bot, here to help you with top-up, fares, RFID cards, and payment concerns. How can I assist you today?",
      timestamp: new Date().toISOString(),
    },
  ]);

  const chatSessionId = useRef(`mobile-${Date.now()}`);

  const balanceGuideRef = useRef(null);
  const walletGuideRef = useRef(null);
  const topUpGuideRef = useRef(null);
  const qrGuideRef = useRef(null);
  const nfcGuideRef = useRef(null);
  const transactionGuideRef = useRef(null);
  const chatGuideRef = useRef(null);
  const scanGuideRef = useRef(null);

  const walletCardGuideRef = useRef(null);
  const walletTopUpGuideRef = useRef(null);
  const walletPayGuideRef = useRef(null);
  const walletNfcGuideRef = useRef(null);
  const walletStatsGuideRef = useRef(null);
  const walletLedgerGuideRef = useRef(null);

  const topUpCardGuideRef = useRef(null);
  const topUpPresetGuideRef = useRef(null);
  const topUpCustomGuideRef = useRef(null);
  const topUpPaymentGuideRef = useRef(null);
  const topUpLoadGuideRef = useRef(null);

  const homeScrollRef = useRef(null);
  const walletScrollRef = useRef(null);
  const topUpScrollRef = useRef(null);

  const homeScrollOffsetRef = useRef(0);
  const walletScrollOffsetRef = useRef(0);
  const topUpScrollOffsetRef = useRef(0);

  const hceSessionRef = useRef(null);
  const hceReadListenerRef = useRef(null);
  const hceExpiryTimerRef = useRef(null);

  const currentBalance = useMemo(
    () => Number(balance?.balance || 0),
    [balance],
  );

  const rawPassengerName =
    passenger?.name ||
    balance?.fullName ||
    balance?.name ||
    'Passenger';

  const passengerName =
    String(rawPassengerName).replace(/\s*#\d+$/, '').trim() || 'Passenger';

  const spent = transactions
    .filter((tx) => tx.type !== 'TOPUP')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const loaded = transactions
    .filter((tx) => tx.type === 'TOPUP')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const notificationCount =
    transactions.length +
    (currentBalance > 0 && currentBalance < 100 ? 1 : 0);

  const scrollGuideTargetIntoView = useCallback(
    (step) =>
      new Promise((resolve) => {
        const target = step?.targetRef?.current;
        const scrollRef = step?.scrollRef?.current;
        const scrollOffsetRef = step?.scrollOffsetRef;

        if (!target || !scrollRef || !scrollOffsetRef) {
          resolve();
          return;
        }

        target.measureInWindow((x, y, width, height) => {
          if (!width || !height) {
            resolve();
            return;
          }

          const viewportTop = screen.height * 0.08;
          const viewportBottom = screen.height * 0.74;
          const padding = step.padding ?? 10;

          let nextOffset = scrollOffsetRef.current;

          if (y < viewportTop + padding) {
            nextOffset += y - viewportTop - padding;
          } else if (y + height > viewportBottom - padding) {
            nextOffset += y + height - viewportBottom + padding;
          }

          nextOffset = Math.max(0, nextOffset);

          if (Math.abs(nextOffset - scrollOffsetRef.current) < 2) {
            resolve();
            return;
          }

          scrollRef.scrollTo({
            y: nextOffset,
            animated: true,
          });

          setTimeout(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve);
            });
          }, 650);
        });
      }),
    [screen.height],
  );

  const guideSteps = useMemo(
    () => [
      {
        key: 'balance',
        targetRef: balanceGuideRef,
        scrollRef: homeScrollRef,
        scrollOffsetRef: homeScrollOffsetRef,
        title: 'Available Balance',
        message: 'Check your available RFID card balance before travelling.',
      },
      {
        key: 'wallet',
        targetRef: walletGuideRef,
        title: 'Wallet',
        message: 'Open your wallet to view your RFID card, balance, and payment options.',
      },
      {
        key: 'topup',
        targetRef: topUpGuideRef,
        scrollRef: homeScrollRef,
        scrollOffsetRef: homeScrollOffsetRef,
        title: 'Add Balance',
        message: 'Add funds to your RFID card using supported payment methods.',
      },
      {
        key: 'qr',
        targetRef: scanGuideRef,
        title: 'QR Payment',
        message: 'Tap Scan to show your large payment QR code to the fare reader.',
      },
      {
        key: 'nfc',
        targetRef: nfcGuideRef,
        scrollRef: homeScrollRef,
        scrollOffsetRef: homeScrollOffsetRef,
        title: 'NFC Payment',
        message: 'Use this when you need to pay by tapping your phone on the fare reader.',
      },
      {
        key: 'transactions',
        targetRef: transactionGuideRef,
        scrollRef: homeScrollRef,
        scrollOffsetRef: homeScrollOffsetRef,
        title: 'Transaction History',
        message: 'Review fare payments, top-ups, and completed transactions.',
      },
      {
        key: 'chat',
        targetRef: chatGuideRef,
        title: 'Need Help?',
        message: 'Get support for card balance, top-ups, QR payments, lost cards, and account concerns.',
      },
    ],
    [],
  );

  const walletGuideSteps = useMemo(
    () => [
      {
        key: 'wallet-card',
        targetRef: walletCardGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'RFID Card',
        message: 'View your active transit card, masked card number, status, and balance.',
      },
      {
        key: 'wallet-topup',
        targetRef: walletTopUpGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'Top Up',
        message: 'Add balance to your RFID card.',
      },
      {
        key: 'wallet-pay',
        targetRef: walletPayGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'QR Payment',
        message: 'Open your QR code when you need to pay through the fare scanner.',
      },
      {
        key: 'wallet-stats',
        targetRef: walletStatsGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'Monthly Summary',
        message: 'Review your fare spending and top-up amount for this month.',
      },
      {
        key: 'wallet-ledger',
        targetRef: walletLedgerGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'Card Details',
        message: 'View your assigned RFID card number and current ledger balance.',
      },
    ],
    [],
  );

  const topUpGuideSteps = useMemo(
    () => [
      {
        key: 'topup-card',
        targetRef: topUpCardGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Card Balance',
        message: 'Check your RFID card and current balance here before adding load.',
      },
      {
        key: 'topup-presets',
        targetRef: topUpPresetGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Choose Amount',
        message: 'Pick a preset load amount for a faster top-up.',
      },
      {
        key: 'topup-custom',
        targetRef: topUpCustomGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Custom Amount',
        message: 'Enter your own amount here if the preset options do not match what you need.',
      },
      {
        key: 'topup-payment',
        targetRef: topUpPaymentGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Payment Method',
        message: 'Choose where you want to pay from, such as GCash or Maya.',
      },
      {
        key: 'topup-load',
        targetRef: topUpLoadGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Load Amount',
        message: 'Tap this button to start checkout. After payment, the app will verify and update your RFID balance.',
      },
    ],
    [],
  );

  const activeGuideSteps =
    guideMode === 'wallet'
      ? walletGuideSteps
      : guideMode === 'topup'
        ? topUpGuideSteps
        : guideSteps;

  const stopMobileNfcCard = async () => {
    if (hceExpiryTimerRef.current) {
      clearTimeout(hceExpiryTimerRef.current);
      hceExpiryTimerRef.current = null;
    }

    hceReadListenerRef.current?.();
    hceReadListenerRef.current = null;

    try {
      await hceSessionRef.current?.setEnabled(false);
    } catch {
      // Native HCE service may already be stopped.
    }

    setNfcCardActive(false);
  };

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    setDashboardError(null);

    try {
      const [balRes, txRes] = await Promise.all([
        api.get('/balance'),
        api.get('/transactions?page=0&size=8'),
      ]);

      setBalance(balRes.data.data);
      setTransactions(txRes.data.data?.content || []);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Check if the backend is running.';

      setDashboardError(message);

      if (!silent) {
        Alert.alert('Unable to load dashboard', message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let active = true;

    const maybeStartGuide = async () => {
      if (loading || activeTab !== 'Home') return;

      try {
        const completed = await AsyncStorage.getItem(
          APP_GUIDE_STORAGE_KEY,
        );

        if (!active || completed === 'true') return;

        setTimeout(() => {
          if (!active) return;

          setGuideMode('home');
          setGuideIndex(0);
          setGuideVisible(true);
        }, 450);
      } catch {
        // Do not block the dashboard if storage fails.
      }
    };

    maybeStartGuide();

    return () => {
      active = false;
    };
  }, [activeTab, loading]);

  useEffect(() => {
    let active = true;

    const maybeStartWalletGuide = async () => {
      if (loading || guideVisible || activeTab !== 'Wallet') return;

      try {
        const completed = await AsyncStorage.getItem(
          WALLET_GUIDE_STORAGE_KEY,
        );

        if (!active || completed === 'true') return;

        setTimeout(() => {
          if (!active || activeTab !== 'Wallet') return;

          setGuideMode('wallet');
          setGuideIndex(0);
          setGuideVisible(true);
        }, 450);
      } catch {
        // Do not block wallet if storage fails.
      }
    };

    maybeStartWalletGuide();

    return () => {
      active = false;
    };
  }, [activeTab, guideVisible, loading]);

  useEffect(() => {
    let active = true;

    const maybeStartTopUpGuide = async () => {
      if (loading || guideVisible || activeTab !== 'TopUp') return;

      try {
        const completed = await AsyncStorage.getItem(
          TOPUP_GUIDE_STORAGE_KEY,
        );

        if (!active || completed === 'true') return;

        setTimeout(() => {
          if (!active || activeTab !== 'TopUp') return;

          setGuideMode('topup');
          setGuideIndex(0);
          setGuideVisible(true);
        }, 450);
      } catch {
        // Do not block top-up if storage fails.
      }
    };

    maybeStartTopUpGuide();

    return () => {
      active = false;
    };
  }, [activeTab, guideVisible, loading]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        fetchData({ silent: true });
      }
    }, 10000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchData({ silent: true });
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [fetchData]);

  useEffect(() => {
    let active = true;

    const prepareNfc = async () => {
      try {
        const NfcManager = loadNfcManager();

        if (!NfcManager) {
          if (active) setNfcSupported(false);
          return;
        }

        const supported = await NfcManager.isSupported();

        if (!active) return;

        setNfcSupported(supported);

        if (supported) {
          await NfcManager.start();
        }
      } catch {
        if (active) {
          setNfcSupported(false);
        }
      }
    };

    prepareNfc();

    return () => {
      active = false;
      stopMobileNfcCard();
      loadNfcManager()?.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const fetchAllTransactions = async () => {
    if (transactionLoading) return;

    setTransactionLoading(true);

    try {
      const response = await api.get('/transactions?page=0&size=50');

      setAllTransactions(response.data.data?.content || []);
      setActiveTab('Transactions');
    } catch (error) {
      Alert.alert(
        'Failed to load transactions',
        error.response?.data?.message || 'Please try again.',
      );
    } finally {
      setTransactionLoading(false);
    }
  };

  const downloadTransactions = async () => {
    try {
      let rows = allTransactions.length ? allTransactions : [];

      if (!rows.length) {
        const response = await api.get('/transactions?page=0&size=100');

        rows = response.data.data?.content || [];
        setAllTransactions(rows);
      }

      if (!rows.length) {
        Alert.alert(
          'No transactions',
          'There are no transactions available to download.',
        );
        return;
      }

      const header = [
        'transaction_id',
        'reference_number',
        'type',
        'status',
        'amount',
        'balance_before',
        'balance_after',
        'created_at',
        'description',
      ];

      const csv = [
        header.join(','),
        ...rows.map((tx) =>
          [
            tx.id,
            tx.referenceNumber,
            tx.type,
            tx.status,
            tx.amount,
            tx.balanceBefore,
            tx.balanceAfter,
            tx.createdAt,
            tx.description,
          ]
            .map(csvEscape)
            .join(','),
        ),
      ].join('\n');

      const fileName = `premier-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (
        Platform.OS === 'android' &&
        FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync
      ) {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const destinationUri =
            await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              'text/csv',
            );

          await FileSystem.StorageAccessFramework.writeAsStringAsync(
            destinationUri,
            csv,
            {
              encoding: FileSystem.EncodingType.UTF8,
            },
          );

          Alert.alert(
            'Transactions downloaded',
            `${fileName} was saved to the folder you selected.`,
          );
          return;
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download Premier transactions',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Transactions exported', `Saved to ${fileUri}`);
      }
    } catch (error) {
      Alert.alert(
        'Download failed',
        error.message || 'Please try again.',
      );
    }
  };

  const handleTopUp = async () => {
    const amount = selectedAmount || Number(customAmount);

    if (!amount || amount < 20) {
      Alert.alert(
        'Invalid amount',
        'Please select or enter a valid amount. Minimum is PHP 20.',
      );
      return;
    }

    if (pendingPayment) {
      Alert.alert(
        'Pending payment',
        'Complete or cancel your current pending payment first.',
      );
      return;
    }

    setTopupLoading(true);

    try {
      const response = await api.post('/topup/initiate', {
        amount,
        paymentMethod: selectedPaymentMethod,
      });

      const { checkoutUrl, referenceNumber, topUpId } =
        response.data.data || {};

      setPendingPayment({
        referenceNumber,
        amount,
        topUpId,
        paymentMethod: selectedPaymentMethod,
      });

      if (checkoutUrl) {
        await WebBrowser.openBrowserAsync(checkoutUrl);
      }
    } catch (error) {
      Alert.alert(
        'Top-up failed',
        error.response?.data?.message || 'Please try again.',
      );
    } finally {
      setTopupLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!pendingPayment) return;

    setVerifying(true);

    try {
      const response = await api.post(
        `/topup/verify/${pendingPayment.referenceNumber}`,
      );

      const { newBalance, amount } = response.data.data || {};

      Alert.alert(
        'Payment verified',
        `PHP ${formatCurrency(amount)} added. New balance: PHP ${formatCurrency(newBalance)}`,
      );

      setPendingPayment(null);
      setSelectedAmount(100);
      setCustomAmount('');
      fetchData();
    } catch (error) {
      Alert.alert(
        'Payment not completed yet',
        error.response?.data?.message || 'Please try again after paying.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const generateFareQr = async () => {
    setQrLoading(true);
    setQrData(null);
    setQrOpen(true);

    try {
      const response = await api.post('/fare/qr');
      setQrData(response.data.data);
    } catch (error) {
      Alert.alert(
        'QR unavailable',
        error.response?.data?.message || 'Please try again.',
      );
      setQrOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleNfcPayment = async () => {
    if (nfcScanning) return;

    if (Platform.OS !== 'android') {
      Alert.alert(
        'Android required',
        'PN532 mobile NFC payment uses Android HCE. iPhone does not allow this card-emulation mode.',
      );
      return;
    }

    if (nfcSupported === false) {
      Alert.alert(
        'NFC unavailable',
        'This phone does not support NFC payments.',
      );
      return;
    }

    try {
      const NfcManager = loadNfcManager();

      if (!NfcManager) {
        Alert.alert(
          'NFC unavailable',
          'Install and open the Premier Android APK to use mobile NFC payment.',
        );
        return;
      }

      const enabled = await NfcManager.isEnabled();

      if (!enabled) {
        Alert.alert(
          'Turn on NFC',
          'Please enable NFC in your phone settings, then try again.',
        );
        return;
      }

      navigation.navigate('MobileNfcPayment');
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Please tap again.';

      Alert.alert('NFC payment failed', message);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Logout', 'Do you want to logout from this device?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const completeGuide = async () => {
    setGuideVisible(false);
    setGuideIndex(0);

    await AsyncStorage.setItem(
      guideMode === 'wallet'
        ? WALLET_GUIDE_STORAGE_KEY
        : guideMode === 'topup'
          ? TOPUP_GUIDE_STORAGE_KEY
          : APP_GUIDE_STORAGE_KEY,
      'true',
    );
  };

  const replayGuide = () => {
    setActiveTab('Home');
    setGuideMode('home');
    setGuideIndex(0);

    setTimeout(() => {
      setGuideVisible(true);
    }, 450);
  };

  const showHelp = (title, message) => {
    setHelpContent({
      title,
      message,
    });
  };

  const sendChat = async (text = chatInput) => {
    const trimmed = text.trim();

    if (!trimmed || chatLoading) return;

    setChatInput('');

    setMessages((current) => [
      ...current,
      {
        from: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
      },
    ]);

    setChatLoading(true);

    try {
      const response = await api.post('/chat/message', {
        message: trimmed,
        sessionId: chatSessionId.current,
      });

      const payload = response.data?.data || response.data;

      setMessages((current) => [
        ...current,
        {
          from: 'bot',
          text: payload.reply || 'I received your message.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          from: 'bot',
          text: 'Unable to connect to support. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleBiometrics = async () => {
    try {
      if (biometricEnabled) {
        await disableBiometrics();

        Alert.alert(
          'Biometrics disabled',
          'OTP will be required after logout or session expiry.',
        );
      } else {
        await enableBiometrics();

        Alert.alert(
          'Biometrics enabled',
          'You can unlock this device with fingerprint or Face ID.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Settings update failed',
        error.message || 'Please try again.',
      );
    }
  };

  const renderHome = () => (
    <ScrollView
      ref={homeScrollRef}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(event) => {
        homeScrollOffsetRef.current =
          event.nativeEvent.contentOffset.y;
      }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.homeHeader}>
        <Image
          source={require('../../assets/image/logo-premier.png')}
          style={styles.headerLogo}
        />

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Premier Transport</Text>
          <Text style={styles.headerSubtitle}>RFID Smart Fare System</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={() => setActiveTab('Notifications')}
          >
            <Feather name="bell" size={20} color={colors.maroon} />
            {notificationCount > 0 && <View style={styles.bellDot} />}
          </Pressable>

          <Pressable
            style={styles.headerButton}
            onPress={confirmLogout}
          >
            <Feather name="log-out" size={20} color={colors.maroon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.securePill}>
        <Feather name="shield" size={14} color="#D49312" />
        <Text style={styles.secureText}>Secure Session Active</Text>
      </View>

      {dashboardError && (
        <View style={styles.inlineError}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inlineErrorTitle}>
              Unable to refresh data
            </Text>
            <Text style={styles.inlineErrorText}>
              {dashboardError}
            </Text>
          </View>

          <Button
            variant="ghost"
            style={styles.retryButton}
            onPress={fetchData}
          >
            Retry
          </Button>
        </View>
      )}

      <View
        ref={balanceGuideRef}
        collapsable={false}
        style={styles.balancePanel}
      >
        <View style={styles.balanceBusMark}>
          <MaterialCommunityIcons
            name="bus-side"
            size={58}
            color="rgba(255,255,255,0.08)"
          />
        </View>

        <Text style={styles.balanceLabel}>Available Balance</Text>

        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.heroBalance}>
            PHP {formatCurrency(currentBalance)}
          </Text>
        )}

        <View style={styles.balanceDivider} />

        <View style={styles.cardMiniRow}>
          <View>
            <Text style={styles.cardMiniLabel}>RFID Card</Text>
            <Text style={styles.cardMini}>
              {maskCardNumber(balance?.cardNumber).replace('Card ', '')}
            </Text>
          </View>

          <Feather name="credit-card" size={20} color="#F4B8BE" />

          <Text style={styles.activeBadge}>Active</Text>
        </View>
      </View>

      <View style={styles.quickPanel}>
        <ActionButton
          targetRef={topUpGuideRef}
          color="#E2AA22"
          icon="wallet-plus-outline"
          label="Top Up"
          onPress={() => setActiveTab('TopUp')}
        />

        <ActionButton
          targetRef={transactionGuideRef}
          color={colors.maroon}
          icon="history"
          label="History"
          onPress={fetchAllTransactions}
        />

        <ActionButton
          color="#1C2A44"
          icon="credit-card-outline"
          label="My Card"
          onPress={() => setActiveTab('Wallet')}
        />

        <ActionButton
          targetRef={qrGuideRef}
          color="#246A21"
          icon="qrcode"
          label="Pay QR"
          onPress={() => navigation.navigate('QRFarePayment')}
        />

        <ActionButton
          targetRef={nfcGuideRef}
          color="#0F766E"
          icon="nfc"
          label="NFC Pay"
          onPress={handleNfcPayment}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>

        <Pressable onPress={fetchAllTransactions}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>

      {(transactions.length ? transactions.slice(0, 3) : []).map((tx) => (
        <TransactionRow key={tx.id} tx={tx} />
      ))}

      {!transactions.length && (
        <Text style={styles.empty}>No recent activity yet.</Text>
      )}
    </ScrollView>
  );

  const renderWallet = () => (
    <ScrollView
      ref={walletScrollRef}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(event) => {
        walletScrollOffsetRef.current =
          event.nativeEvent.contentOffset.y;
      }}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.pageTitle}>My Wallet</Text>
      <Text style={styles.pageSub}>
        Manage your Premier Transit balance
      </Text>

      <View
        ref={walletCardGuideRef}
        collapsable={false}
        style={styles.cardArt}
      >
        <View style={styles.cardArtTop}>
          <Text style={styles.cardArtSmall}>Premier Transit Card</Text>
          <MaterialCommunityIcons
            name="bus"
            size={28}
            color={colors.yellow}
          />
        </View>

        <Text style={styles.cardArtName}>{passengerName}</Text>
        <Text style={styles.cardArtNumber}>
          {displayCardNumber(balance?.cardNumber)}
        </Text>

        <Text style={styles.cardArtLabel}>Balance</Text>
        <Text style={styles.cardArtBalance}>
          PHP {formatCurrency(currentBalance)}
        </Text>
        <Text style={styles.cardArtActive}>Active</Text>
      </View>

      <View style={styles.walletActions}>
        <View
          ref={walletTopUpGuideRef}
          collapsable={false}
          style={styles.walletButtonTarget}
        >
          <Button
            variant="secondary"
            style={styles.walletButtonGold}
            onPress={() => setActiveTab('TopUp')}
            icon={
              <MaterialCommunityIcons
                name="wallet-plus-outline"
                size={17}
                color={colors.maroon}
              />
            }
          >
            Top Up
          </Button>
        </View>

        <View
          ref={walletPayGuideRef}
          collapsable={false}
          style={styles.walletButtonTarget}
        >
          <Button
            variant="ghost"
            style={styles.walletButton}
            onPress={() => navigation.navigate('QRFarePayment')}
            icon={
              <MaterialCommunityIcons
                name="qrcode"
                size={17}
                color={colors.maroon}
              />
            }
          >
            Pay
          </Button>
        </View>

        <View
          ref={walletNfcGuideRef}
          collapsable={false}
          style={styles.walletButtonTarget}
        >
          <Button
            variant="ghost"
            style={styles.walletButton}
            onPress={handleNfcPayment}
            icon={
              <MaterialCommunityIcons
                name="nfc"
                size={17}
                color={colors.maroon}
              />
            }
          >
            NFC
          </Button>
        </View>
      </View>

      <View
        ref={walletStatsGuideRef}
        collapsable={false}
        style={styles.statsGrid}
      >
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Spent This Month</Text>
          <Text style={styles.statRed}>
            PHP {formatCurrency(spent)}
          </Text>
          <Text style={styles.statSub}>fare taps</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Loaded This Month</Text>
          <Text style={styles.statGreen}>
            PHP {formatCurrency(loaded)}
          </Text>
          <Text style={styles.statSub}>top-ups</Text>
        </View>
      </View>

      <View
        ref={walletLedgerGuideRef}
        collapsable={false}
        style={styles.infoCard}
      >
        <InfoRow
          label="Assigned Card Number"
          value={balance?.cardNumber || '-'}
        />
        <InfoRow
          label="Current Ledger Reserve"
          value={`PHP ${formatCurrency(currentBalance)}`}
          green
        />
      </View>
    </ScrollView>
  );

  const renderTopUp = () => (
    <ScrollView
      ref={topUpScrollRef}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(event) => {
        topUpScrollOffsetRef.current =
          event.nativeEvent.contentOffset.y;
      }}
      contentContainerStyle={styles.content}
    >
      <BackTitle
        title="Top Up Card"
        subtitle="Recharge your RFID balance"
        onBack={() => setActiveTab('Wallet')}
        rightIcon="help-circle"
        onRightPress={() =>
          showHelp(
            'How top-up works',
            'Choose an amount and payment method, then complete the checkout. After payment, tap the verification option so the app can update your RFID balance.',
          )
        }
      />

      <View
        ref={topUpCardGuideRef}
        collapsable={false}
        style={styles.topupCard}
      >
        <Text style={styles.topupCardNo}>
          {maskCardNumber(balance?.cardNumber)}
        </Text>

        <View>
          <Text style={styles.topupBalanceLabel}>Balance</Text>
          <Text style={styles.topupBalance}>
            PHP {formatCurrency(currentBalance)}
          </Text>
        </View>
      </View>

      <Text style={styles.formLabel}>Select Preset Load Amount</Text>

      <View style={styles.amountGrid}>
        {QUICK_AMOUNTS.map((amount) => (
          <Pressable
            key={amount}
            ref={selectedAmount === amount ? topUpPresetGuideRef : null}
            collapsable={false}
            onPress={() => {
              setSelectedAmount(amount);
              setCustomAmount('');
            }}
            style={[
              styles.amountChip,
              selectedAmount === amount && styles.amountChipActive,
            ]}
          >
            <Text
              style={[
                styles.amountText,
                selectedAmount === amount && styles.amountTextActive,
              ]}
            >
              PHP
            </Text>

            <Text
              style={[
                styles.amountNumber,
                selectedAmount === amount && styles.amountTextActive,
              ]}
            >
              {amount}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.formLabel}>Or Custom Amount</Text>

      <View
        ref={topUpCustomGuideRef}
        collapsable={false}
        style={styles.customAmount}
      >
        <Text style={styles.customPeso}>PHP</Text>

        <TextInput
          value={customAmount}
          onChangeText={(value) => {
            setCustomAmount(value.replace(/[^0-9.]/g, ''));
            setSelectedAmount(null);
          }}
          keyboardType="decimal-pad"
          placeholder="100.00"
          style={styles.customInput}
        />

        <Text style={styles.minText}>min PHP 20.00</Text>
      </View>

      <Text style={styles.formLabel}>Payment Method</Text>

      <View style={styles.paymentGrid}>
        {PAYMENT_OPTIONS.map((option) => {
          const active = selectedPaymentMethod === option.id;

          return (
            <Pressable
              key={option.id}
              ref={active ? topUpPaymentGuideRef : null}
              collapsable={false}
              onPress={() => setSelectedPaymentMethod(option.id)}
              style={[
                styles.paymentOption,
                active && styles.paymentOptionActive,
              ]}
            >
              <Image source={option.logo} style={styles.paymentLogo} />

              <View style={styles.paymentTextBlock}>
                <Text style={styles.paymentName}>{option.name}</Text>
                <Text style={styles.paymentDetail}>{option.detail}</Text>
              </View>

              <View
                style={[
                  styles.paymentRadio,
                  active && styles.paymentRadioActive,
                ]}
              >
                {active && (
                  <Feather name="check" size={12} color="#fff" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        ref={topUpLoadGuideRef}
        collapsable={false}
        style={styles.stickyButton}
      >
        <Button loading={topupLoading} onPress={handleTopUp}>
          Load Amount
        </Button>
      </View>

      {pendingPayment && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>
            Pending {pendingPayment.paymentMethod || 'payment'} payment:{' '}
            {pendingPayment.referenceNumber}
          </Text>

          <Button
            variant="secondary"
            loading={verifying}
            onPress={handleCheckPayment}
          >
            I Already Paid
          </Button>

          <Button
            variant="ghost"
            onPress={() => setPendingPayment(null)}
          >
            Cancel Transaction
          </Button>
        </View>
      )}
    </ScrollView>
  );

  const renderTransactions = () => {
    const data = allTransactions.length
      ? allTransactions
      : transactions;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <BackTitle
          title="Transactions"
          subtitle="Full ledger history"
          onBack={() => setActiveTab('Home')}
          rightText="Download"
          onRightPress={downloadTransactions}
        />

        <View style={styles.totalGrid}>
          <View style={[styles.totalCard, styles.totalIn]}>
            <MaterialCommunityIcons
              name="cellphone"
              size={20}
              color="#D6FFF0"
            />
            <Text style={styles.totalLabel}>Total In</Text>
            <Text style={styles.totalValue}>
              +PHP {formatCurrency(loaded)}
            </Text>
          </View>

          <View style={[styles.totalCard, styles.totalOut]}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={20}
              color="#FFE5EA"
            />
            <Text style={styles.totalLabel}>Total Out</Text>
            <Text style={styles.totalValue}>
              -PHP {formatCurrency(spent)}
            </Text>
          </View>
        </View>

        {transactionLoading && (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={colors.maroon} />
            <Text style={styles.loadingInlineText}>
              Loading transactions...
            </Text>
          </View>
        )}

        {!transactionLoading &&
          data.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}

        {!transactionLoading && !data.length && (
          <Text style={styles.empty}>No transactions found.</Text>
        )}
      </ScrollView>
    );
  };

  const renderNotifications = () => {
    const transactionAlerts = transactions.slice(0, 6).map((tx) => ({
      id: tx.id,
      icon: tx.type === 'TOPUP' ? 'cellphone' : 'map-marker-outline',
      title: tx.type === 'TOPUP' ? 'Top-up completed' : 'Fare deducted',
      body: `Transaction ${transactionId(tx)} for PHP ${formatCurrency(tx.amount)} is ${String(tx.status || 'completed').toLowerCase()}.`,
      time: formatDate(tx.createdAt),
      green: tx.type === 'TOPUP',
    }));

    const balanceAlert =
      currentBalance > 0 && currentBalance < 100
        ? [
            {
              id: 'low-balance',
              icon: 'lightning-bolt',
              title: 'Low balance reminder',
              body: `Your current balance is PHP ${formatCurrency(currentBalance)}.`,
              time: 'Now',
              gold: true,
            },
          ]
        : [];

    const alerts = [...balanceAlert, ...transactionAlerts];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <BackTitle
          title="Notifications"
          subtitle={`${alerts.length} alerts`}
          onBack={() => setActiveTab('Home')}
        />

        {alerts.map((item) => (
          <NotificationCard
            key={item.id}
            icon={item.icon}
            title={item.title}
            body={item.body}
            time={item.time}
            green={item.green}
            gold={item.gold}
          />
        ))}

        {!alerts.length && (
          <Text style={styles.empty}>No notifications yet.</Text>
        )}
      </ScrollView>
    );
  };

  const renderChat = () => (
    <View style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable
          style={styles.chatBack}
          onPress={() => setActiveTab('Home')}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>

        <View style={styles.botAvatar}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={25}
            color={colors.maroon}
          />
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.chatHeadText}>
          <Text style={styles.chatName}>Premier Bot</Text>
          <Text style={styles.chatOnline}>
            Online - Always here to help
          </Text>
        </View>

        <Feather name="headphones" size={20} color="#F4B8BE" />
      </View>

      <ScrollView contentContainerStyle={styles.chatMessages}>
        <Text style={styles.today}>Today</Text>

        {messages.map((message, index) => {
          const isUser = message.from === 'user';

          return (
            <View
              key={`${message.timestamp}-${index}`}
              style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}
            >
              {!isUser && (
                <View style={styles.smallBot}>
                  <MaterialCommunityIcons
                    name="robot-outline"
                    size={14}
                    color="#fff"
                  />
                </View>
              )}

              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.botBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    isUser && styles.userBubbleText,
                  ]}
                >
                  {message.text}
                </Text>

                <Text
                  style={[
                    styles.bubbleTime,
                    isUser && styles.userBubbleText,
                  ]}
                >
                  {formatDate(message.timestamp)}
                </Text>
              </View>
            </View>
          );
        })}

        {chatLoading && (
          <Text style={styles.typing}>Premier Bot is typing...</Text>
        )}

        <View style={styles.quickReplies}>
          {QUICK_REPLIES.map((reply) => (
            <Pressable
              key={reply}
              onPress={() => sendChat(reply)}
              style={styles.quickReply}
            >
              <Text style={styles.quickReplyText}>{reply}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.chatInputRow}>
        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Message Premier Bot..."
          placeholderTextColor="#8AA0BF"
          style={styles.chatInput}
        />

        <Pressable
          onPress={() => sendChat()}
          disabled={!chatInput.trim() || chatLoading}
          style={styles.sendButton}
        >
          <Feather name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      <Text style={styles.secured}>Secured by Premier Transit</Text>
    </View>
  );

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Profile</Text>
      <Text style={styles.pageSub}>Passenger account settings</Text>

      <View style={styles.infoCard}>
        <InfoRow
          label="Card Number"
          value={balance?.cardNumber || '-'}
        />
        <InfoRow
          label="Biometric Login"
          value={biometricEnabled ? 'Enabled' : 'Disabled'}
          green={biometricEnabled}
        />
      </View>

      <Button onPress={toggleBiometrics}>
        {biometricEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}
      </Button>

      <Button variant="secondary" onPress={replayGuide}>
        Replay App Guide
      </Button>

      <Button variant="ghost" onPress={confirmLogout}>
        Logout
      </Button>
    </ScrollView>
  );

  const renderScreen = () => {
    if (activeTab === 'Wallet') return renderWallet();
    if (activeTab === 'TopUp') return renderTopUp();
    if (activeTab === 'Transactions') return renderTransactions();
    if (activeTab === 'Notifications') return renderNotifications();
    if (activeTab === 'Chat') return renderChat();
    if (activeTab === 'Profile') return renderProfile();

    return renderHome();
  };

  return (
    <SafeAreaView style={styles.outer}>
      {renderScreen()}

      {!['Chat', 'TopUp', 'Transactions', 'Notifications'].includes(
        activeTab,
      ) && (
        <>
          <Pressable
            ref={chatGuideRef}
            collapsable={false}
            style={styles.chatFloat}
            onPress={() => setActiveTab('Chat')}
          >
            <MaterialCommunityIcons
              name="robot-outline"
              size={21}
              color="#fff"
            />
          </Pressable>

          <View style={styles.bottomNav}>
            <NavItem
              icon="home-outline"
              label="Home"
              active={activeTab === 'Home'}
              onPress={() => setActiveTab('Home')}
            />

            <NavItem
              ref={walletGuideRef}
              icon="wallet-outline"
              label="Wallet"
              active={activeTab === 'Wallet'}
              onPress={() => setActiveTab('Wallet')}
            />

            <Pressable
              ref={scanGuideRef}
              collapsable={false}
              style={styles.plusButton}
              onPress={generateFareQr}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={21}
                color="#fff"
              />
            </Pressable>

            <Text style={styles.scanNavLabel}>Scan</Text>

            <NavItem
              icon="history"
              label="Activity"
              active={activeTab === 'Transactions'}
              onPress={fetchAllTransactions}
            />

            <NavItem
              icon="account-outline"
              label="Profile"
              active={activeTab === 'Profile'}
              onPress={() => setActiveTab('Profile')}
            />
          </View>
        </>
      )}

      <Modal
        visible={qrOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQrOpen(false)}
      >
        <View style={styles.centerModalBackdrop}>
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <View>
                <Text style={styles.qrEyebrow}>Premier Mobile Fare</Text>
                <Text style={styles.qrTitle}>Scan QR Code</Text>
              </View>

              <Pressable
                style={styles.qrClose}
                onPress={() => setQrOpen(false)}
              >
                <Feather name="x" size={24} color={colors.maroon} />
              </Pressable>
            </View>

            <View style={styles.qrBody}>
              {qrLoading ? (
                <>
                  <ActivityIndicator size="large" color={colors.maroon} />
                  <Text style={styles.qrHelp}>
                    Generating secure fare QR...
                  </Text>
                </>
              ) : qrData?.payload ? (
                <>
                  <View style={styles.qrBox}>
                    <QRCode
                      value={qrData.payload}
                      size={300}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                      quietZone={18}
                    />
                  </View>

                  <View style={styles.qrReadyChip}>
                    <View style={styles.qrLiveDot} />
                    <Text style={styles.qrReadyText}>Ready to scan</Text>
                  </View>

                  <Text style={styles.qrCardNumber}>
                    Card No. {qrData.cardNumber}
                  </Text>

                  <Text style={styles.qrCountdown}>
                    Refreshes in {formatCountdown(qrData.expiresInSeconds)}
                  </Text>

                  <Text style={styles.qrHelp}>
                    Keep brightness high and hold the phone steady until the
                    reader confirms payment.
                  </Text>

                  <Button
                    variant="secondary"
                    style={styles.qrRefreshButton}
                    onPress={generateFareQr}
                  >
                    Refresh QR
                  </Button>
                </>
              ) : (
                <Text style={styles.empty}>QR unavailable.</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!helpContent}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpContent(null)}
      >
        <View style={styles.centerModalBackdrop}>
          <View style={styles.helpModalCard}>
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>
                {helpContent?.title}
              </Text>

              <Pressable
                onPress={() => setHelpContent(null)}
                hitSlop={10}
              >
                <Feather name="x" size={22} color={colors.maroon} />
              </Pressable>
            </View>

            <Text style={styles.helpModalText}>
              {helpContent?.message}
            </Text>

            <Button
              style={styles.helpModalButton}
              onPress={() => setHelpContent(null)}
            >
              Got it
            </Button>
          </View>
        </View>
      </Modal>

      <AppGuideOverlay
        visible={guideVisible}
        steps={activeGuideSteps}
        currentIndex={guideIndex}
        onBeforeMeasure={scrollGuideTargetIntoView}
        onBack={() =>
          setGuideIndex((current) => Math.max(0, current - 1))
        }
        onNext={() =>
          setGuideIndex((current) =>
            Math.min(activeGuideSteps.length - 1, current + 1),
          )
        }
        onSkip={completeGuide}
        onFinish={completeGuide}
      />
    </SafeAreaView>
  );
}

function ActionButton({
  color,
  icon,
  label,
  onPress,
  disabled,
  targetRef,
}) {
  return (
    <Pressable
      ref={targetRef}
      collapsable={false}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionItem,
        disabled && styles.actionItemDisabled,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={19} color="#fff" />
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={styles.actionLabel}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const NavItem = forwardRef(function NavItem(
  { icon, label, active, onPress },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      collapsable={false}
      onPress={onPress}
      style={styles.navItem}
    >
      <View style={styles.navIconTarget}>
        <MaterialCommunityIcons
          name={icon}
          size={19}
          color={active ? colors.maroon : '#8AA0BF'}
        />
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[styles.navText, active && styles.navTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

function BackTitle({
  title,
  subtitle,
  onBack,
  rightIcon,
  rightText,
  onRightPress,
}) {
  return (
    <View style={styles.backTitle}>
      <Pressable onPress={onBack} style={styles.backCircle}>
        <Feather name="arrow-left" size={20} color="#536987" />
      </Pressable>

      <View style={styles.backTitleText}>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSub}>{subtitle}</Text>
      </View>

      {rightIcon && (
        <Pressable onPress={onRightPress} style={styles.backCircle}>
          <Feather name={rightIcon} size={18} color={colors.maroon} />
        </Pressable>
      )}

      {rightText && (
        <Pressable onPress={onRightPress}>
          <Text style={styles.markAll}>{rightText}</Text>
        </Pressable>
      )}
    </View>
  );
}

function InfoRow({ label, value, green }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, green && styles.infoGreen]}>
        {value}
      </Text>
    </View>
  );
}

function NotificationCard({ icon, title, body, time, unread, green, gold, blue }) {
  const color = green
    ? '#00A86B'
    : gold
      ? '#D49312'
      : blue
        ? '#2563EB'
        : colors.maroon;

  return (
    <View style={[styles.notificationCard, unread && styles.notificationUnread]}>
      <View
        style={[
          styles.notificationIcon,
          { backgroundColor: `${color}12` },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationBody}>{body}</Text>
        <Text style={styles.notificationTime}>{time}</Text>
      </View>

      {unread && <View style={styles.unreadDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#F6F9FD',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 120,
  },

  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },

  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 11,
    resizeMode: 'contain',
  },

  headerTitleBlock: {
    flex: 1,
  },

  headerTitle: {
    color: colors.maroon,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  headerSubtitle: {
    color: '#53616F',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 5,
  },

  headerActions: {
    flexDirection: 'row',
    gap: 9,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.yellow,
  },

  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#F8E9EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 20,
  },

  secureText: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  balancePanel: {
    backgroundColor: colors.maroon,
    borderRadius: 20,
    padding: 22,
    minHeight: 190,
    overflow: 'hidden',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.22,
  },

  balanceBusMark: {
    position: 'absolute',
    right: 16,
    top: 18,
  },

  balanceLabel: {
    color: colors.yellow,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  heroBalance: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 22,
  },

  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(250,204,21,0.55)',
    marginVertical: 20,
  },

  cardMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  cardMiniLabel: {
    color: '#C9A1A6',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 5,
  },

  cardMini: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },

  activeBadge: {
    color: '#4ADE80',
    backgroundColor: 'rgba(20,83,45,0.7)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    overflow: 'hidden',
  },

  quickPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 24,
    backgroundColor: '#fff',
    borderRadius: 22,
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    rowGap: 19,
    ...shadow,
    shadowOpacity: 0.08,
  },

  actionItem: {
    alignItems: 'center',
    gap: 8,
    width: 82,
  },

  actionItemDisabled: {
    opacity: 0.58,
  },

  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionLabel: {
    color: '#101827',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#101827',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  seeAll: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 17,
    padding: 13,
    marginBottom: 12,
    minHeight: 78,
    ...shadow,
    shadowOpacity: 0.06,
    shadowRadius: 9,
  },

  txIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  txIconCredit: {
    backgroundColor: '#E8FFF6',
  },

  txIconFare: {
    backgroundColor: '#FFF1F3',
  },

  txMeta: {
    flex: 1,
  },

  txTitle: {
    color: '#101827',
    fontSize: 15,
    fontWeight: '900',
  },

  txId: {
    color: colors.maroon,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
  },

  txDate: {
    color: '#7186A5',
    fontSize: 12,
    marginTop: 4,
  },

  txRight: {
    alignItems: 'flex-end',
  },

  txAmount: {
    color: '#101827',
    fontSize: 14,
    fontWeight: '900',
  },

  txAmountCredit: {
    color: '#00A86B',
  },

  txStatus: {
    color: '#00A86B',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 7,
    textTransform: 'uppercase',
  },

  empty: {
    color: '#8AA0BF',
    textAlign: 'center',
    padding: 20,
    fontWeight: '800',
  },

  pageTitle: {
    color: '#1C2A44',
    fontSize: 17,
    fontWeight: '900',
  },

  pageSub: {
    color: '#7186A5',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 16,
  },

  cardArt: {
    backgroundColor: colors.maroon,
    borderRadius: 24,
    padding: 20,
    minHeight: 200,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.23,
  },

  cardArtTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cardArtSmall: {
    color: '#F4B8BE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  cardArtName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
  },

  cardArtNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 12,
  },

  cardArtLabel: {
    color: '#F4B8BE',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 23,
  },

  cardArtBalance: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 4,
  },

  cardArtActive: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  walletActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  walletButtonTarget: {
    flex: 1,
  },

  walletButtonGold: {
    minHeight: 48,
  },

  walletButton: {
    minHeight: 48,
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 15,
    ...shadow,
    shadowOpacity: 0.06,
  },

  statLabel: {
    color: '#7186A5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  statRed: {
    color: colors.maroon,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 9,
  },

  statGreen: {
    color: '#00A86B',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 9,
  },

  statSub: {
    color: '#8AA0BF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    ...shadow,
    shadowOpacity: 0.06,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },

  infoLabel: {
    color: '#7186A5',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },

  infoValue: {
    color: '#1C2A44',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
  },

  infoGreen: {
    color: '#00A86B',
  },

  backTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },

  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.07,
  },

  backTitleText: {
    flex: 1,
  },

  markAll: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  topupCard: {
    backgroundColor: colors.maroon,
    borderRadius: 20,
    padding: 20,
    minHeight: 130,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.2,
  },

  topupCardNo: {
    color: '#F4B8BE',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  topupBalanceLabel: {
    color: '#F4B8BE',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
  },

  topupBalance: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
  },

  formLabel: {
    color: '#536987',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  amountChip: {
    width: '30%',
    minHeight: 60,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E3EAF3',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  amountChipActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },

  amountText: {
    color: '#7186A5',
    fontSize: 10,
    fontWeight: '900',
  },

  amountNumber: {
    color: '#1C2A44',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },

  amountTextActive: {
    color: '#fff',
  },

  customAmount: {
    backgroundColor: '#fff',
    minHeight: 58,
    borderRadius: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E3EAF3',
  },

  customPeso: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
  },

  customInput: {
    flex: 1,
    color: '#1C2A44',
    fontSize: 17,
    fontWeight: '900',
    paddingVertical: 0,
  },

  minText: {
    color: '#8AA0BF',
    fontSize: 10,
    fontWeight: '800',
  },

  paymentGrid: {
    gap: 10,
  },

  paymentOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E3EAF3',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  paymentOptionActive: {
    borderColor: colors.maroon,
    borderWidth: 2,
  },

  paymentLogo: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },

  paymentTextBlock: {
    flex: 1,
  },

  paymentName: {
    color: '#1C2A44',
    fontSize: 14,
    fontWeight: '900',
  },

  paymentDetail: {
    color: '#7186A5',
    fontSize: 11,
    marginTop: 3,
  },

  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C9D5E4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  paymentRadioActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },

  stickyButton: {
    marginTop: 24,
  },

  pendingBox: {
    backgroundColor: '#FFF8E7',
    borderRadius: 16,
    padding: 15,
    marginTop: 16,
    gap: 10,
  },

  pendingTitle: {
    color: '#8A5A00',
    fontSize: 12,
    fontWeight: '800',
  },

  totalGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  totalCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
  },

  totalIn: {
    backgroundColor: '#00A86B',
  },

  totalOut: {
    backgroundColor: colors.maroon,
  },

  totalLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 11,
  },

  totalValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 7,
  },

  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },

  loadingInlineText: {
    color: '#7186A5',
    fontSize: 12,
    fontWeight: '800',
  },

  notificationCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    ...shadow,
    shadowOpacity: 0.06,
  },

  notificationUnread: {
    borderWidth: 1,
    borderColor: '#F3D3D7',
  },

  notificationIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationTitle: {
    color: '#1C2A44',
    fontSize: 14,
    fontWeight: '900',
  },

  notificationBody: {
    color: '#7186A5',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  notificationTime: {
    color: '#8AA0BF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 7,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.maroon,
  },

  chatScreen: {
    flex: 1,
    backgroundColor: '#F6F9FD',
  },

  chatHeader: {
    backgroundColor: colors.maroon,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  chatBack: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botAvatar: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: colors.maroon,
  },

  chatHeadText: {
    flex: 1,
  },

  chatName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },

  chatOnline: {
    color: '#F4B8BE',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '800',
  },

  chatMessages: {
    padding: 18,
    paddingBottom: 30,
  },

  today: {
    alignSelf: 'center',
    color: '#8AA0BF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 17,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 13,
  },

  bubbleRowUser: {
    justifyContent: 'flex-end',
  },

  smallBot: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bubble: {
    maxWidth: '78%',
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  botBubble: {
    backgroundColor: '#fff',
  },

  userBubble: {
    backgroundColor: colors.maroon,
  },

  bubbleText: {
    color: '#1C2A44',
    fontSize: 13,
    lineHeight: 18,
  },

  userBubbleText: {
    color: '#fff',
  },

  bubbleTime: {
    color: '#8AA0BF',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 6,
  },

  typing: {
    color: '#7186A5',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },

  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },

  quickReply: {
    borderWidth: 1,
    borderColor: '#DDE5EF',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  quickReplyText: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8EEF5',
  },

  chatInput: {
    flex: 1,
    backgroundColor: '#F5F8FC',
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 14,
    color: '#1C2A44',
    fontSize: 13,
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secured: {
    textAlign: 'center',
    color: '#8AA0BF',
    fontSize: 10,
    fontWeight: '800',
    paddingBottom: 10,
    backgroundColor: '#fff',
  },

  chatFloat: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.28,
  },

  bottomNav: {
    minHeight: 72,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8EEF5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 7,
  },

  navItem: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  navIconTarget: {
    width: 28,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navText: {
    color: '#8AA0BF',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },

  navTextActive: {
    color: colors.maroon,
  },

  plusButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.25,
  },

  scanNavLabel: {
    position: 'absolute',
    bottom: 7,
    left: '50%',
    marginLeft: -15,
    color: colors.maroon,
    fontSize: 9,
    fontWeight: '900',
  },

  centerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,13,26,0.65)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },

  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
  },

  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },

  qrEyebrow: {
    color: '#7186A5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  qrTitle: {
    color: '#1C2A44',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },

  qrClose: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFF1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qrBody: {
    alignItems: 'center',
    padding: 22,
    gap: 13,
  },

  qrBox: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E3EAF3',
  },

  qrReadyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#E8FFF6',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  qrLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00A86B',
  },

  qrReadyText: {
    color: '#008554',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  qrCardNumber: {
    color: '#1C2A44',
    fontSize: 13,
    fontWeight: '900',
  },

  qrCountdown: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
  },

  qrHelp: {
    color: '#7186A5',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  qrRefreshButton: {
    width: '100%',
  },

  helpModalCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
  },

  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  helpModalTitle: {
    color: '#1C2A44',
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
    paddingRight: 12,
  },

  helpModalText: {
    color: '#536987',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 15,
  },

  helpModalButton: {
    marginTop: 20,
  },

  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 15,
    backgroundColor: '#FFF1F3',
    borderRadius: 16,
  },

  inlineErrorTitle: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
  },

  inlineErrorText: {
    color: '#A14755',
    fontSize: 11,
    marginTop: 4,
  },

  retryButton: {
    minWidth: 72,
  },
});