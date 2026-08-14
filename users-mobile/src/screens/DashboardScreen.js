import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
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
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

import api from '../api/api';
import { captureMobileEvent } from '../analytics/posthog';
import AppGuideOverlay from '../components/AppGuideOverlay';
import Button from '../components/Button';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { formatPhtDateTime, phtDateKey } from '../utils/time';
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
const CHAT_HISTORY_PREFIX = 'premier_mobile_chat_history_';
const CHAT_SESSION_PREFIX = 'premier_mobile_chat_session_';
const SUPPORT_TICKET_TYPES = [
  ['DAMAGED_CARD', 'Damaged card'], ['TOP_UP_ISSUE', 'Top-up issue'],
  ['BALANCE_CONCERN', 'Balance concern'], ['LOGIN_PROBLEM', 'Login problem'],
  ['RFID_NOT_WORKING', 'RFID not working'], ['OTHER', 'Other'],
];
const LEGACY_APP_GUIDE_STORAGE_KEY = 'premierPassengerAppGuideCompleted';
const APP_GUIDE_STORAGE_KEY = 'premier_dashboard_guide_completed';
const APP_GUIDE_REPLAYED_KEY = 'premier_app_guide_replayed';
const FINGERPRINT_PROMPT_SHOWN_KEY = 'premier_fingerprint_prompt_shown';
const FINGERPRINT_ENABLED_KEY = 'premier_fingerprint_enabled';
const DASHBOARD_FIRST_VISIT_DONE_KEY = 'premier_dashboard_first_visit_done';
const WALLET_GUIDE_STORAGE_KEY = 'premierPassengerWalletGuideCompleted';
const TOPUP_GUIDE_STORAGE_KEY = 'premierPassengerTopUpGuideCompleted';
const QR_REFRESH_BUFFER_SECONDS = 8;

const initialChatMessage = () => ({
  from: 'bot',
  text: "Hi! I'm Premier Bot, your passenger support assistant. I can help with general assistance, top-ups, lost-card procedures, and support tickets. How can I help?",
  timestamp: new Date().toISOString(),
  quickReplies: null,
});

const newChatSessionId = () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const isLostCardRequest = (text = '') => /\b(lost|stolen|missing)\b/.test(text.toLowerCase()) && /\b(card|rfid)\b/.test(text.toLowerCase());
const isTicketConfirmation = (text = '') => /^(yes|yes please|open ticket|create( a)? ticket|submit( a)? ticket)$/i.test(text.trim());
const ticketTypeFor = (text = '') => {
  const value = text.toLowerCase();
  if (value.includes('damage') || value.includes('replace')) return 'DAMAGED_CARD';
  if (value.includes('top-up') || value.includes('topup')) return 'TOP_UP_ISSUE';
  if (value.includes('balance')) return 'BALANCE_CONCERN';
  if (value.includes('login')) return 'LOGIN_PROBLEM';
  if (value.includes('rfid') || value.includes('tap')) return 'RFID_NOT_WORKING';
  return 'OTHER';
};

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

const TRANSACTION_FILTERS = ['All', 'RFID', 'QR', 'NFC', 'Top Up', 'Failed'];
const NOTIFICATION_FILTERS = ['All', 'Top-Ups', 'Fares', 'Alerts'];
const READ_NOTIFICATIONS_STORAGE_KEY = 'premier_read_notification_ids';

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
  return formatPhtDateTime(dateStr);
}

function formatFullDate(dateStr) {
  if (!dateStr) return '-';

  return formatPhtDateTime(dateStr);
}

function groupDateLabel(dateStr) {
  if (!dateStr) return 'Unknown Date';

  const today = phtDateKey();
  const yesterday = phtDateKey(Date.now() - 24 * 60 * 60 * 1000);
  const key = phtDateKey(dateStr);
  if (!key) return 'Unknown Date';
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return formatPhtDateTime(dateStr).split(',')[0] || 'Unknown Date';
}

function txStatus(tx) {
  const raw = String(tx?.status || 'SUCCESS').toUpperCase();
  if (raw.includes('FAIL')) return 'FAILED';
  if (raw === 'SUCCESS') return 'COMPLETED';
  return raw.replace(/_/g, ' ');
}

function txMethod(tx) {
  const rawType = String(tx?.type || '').toUpperCase();
  const ref = String(transactionId(tx) || '').toUpperCase();
  const description = String(tx?.description || '').toUpperCase();

  if (txStatus(tx) === 'FAILED') return 'FAILED';
  if (rawType.includes('TOPUP') || rawType.includes('TOP_UP')) return 'TOP_UP';
  if (rawType.includes('REFUND')) return 'REFUND';
  if (rawType.includes('QR') || ref.startsWith('QR-') || description.includes('QR')) return 'QR';
  if (rawType.includes('NFC') || ref.startsWith('NFC-') || description.includes('NFC')) return 'NFC';
  if (rawType.includes('RFID') || ref.startsWith('RFID-') || description.includes('RFID')) return 'RFID';
  return 'FARE';
}

function txTitle(tx) {
  const method = txMethod(tx);

  if (method === 'FAILED') return 'Failed Transaction';
  if (method === 'TOP_UP') return 'Wallet Top Up';
  if (method === 'REFUND') return 'Refund';
  if (method === 'QR') return 'QR Fare Payment';
  if (method === 'NFC') return 'NFC Fare Payment';
  if (method === 'RFID') return 'RFID Fare Payment';
  return 'Fare Payment';
}

function txMethodLabel(tx) {
  const method = txMethod(tx);

  if (method === 'TOP_UP') return 'Top Up';
  if (method === 'FARE') return 'Fare';
  return method.replace('_', ' ');
}

function txVisual(tx) {
  const method = txMethod(tx);

  if (method === 'TOP_UP') {
    return { icon: 'cellphone-arrow-down', color: colors.green, bg: '#EAF7EE' };
  }
  if (method === 'QR') {
    return { icon: 'qrcode-scan', color: colors.green, bg: '#EAF7EE' };
  }
  if (method === 'NFC') {
    return { icon: 'contactless-payment', color: colors.teal, bg: '#E8F5F3' };
  }
  if (method === 'RFID') {
    return { icon: 'card-account-details-outline', color: colors.navy, bg: '#EEF3FA' };
  }
  if (method === 'REFUND') {
    return { icon: 'cash-refund', color: colors.green, bg: '#EAF7EE' };
  }
  if (method === 'FAILED') {
    return { icon: 'alert-circle-outline', color: '#B4232D', bg: '#FDECEC' };
  }
  return { icon: 'map-marker-outline', color: colors.maroon, bg: '#FFF1F3' };
}

function isMoneyIn(tx) {
  const method = txMethod(tx);
  return method === 'TOP_UP' || method === 'REFUND';
}

function notificationFromTransaction(tx) {
  const method = txMethod(tx);
  const failed = txStatus(tx) === 'FAILED';
  const amount = `PHP ${formatCurrency(tx?.amount)}`;
  const base = {
    id: `transaction-${transactionId(tx)}`,
    createdAt: tx?.createdAt,
    category: failed ? 'Alerts' : method === 'TOP_UP' ? 'Top-Ups' : 'Fares',
  };

  if (failed) {
    return {
      ...base,
      title: 'Payment Failed',
      message: 'This transaction was not completed. Please try again.',
      icon: 'alert-circle-outline',
      color: '#B4232D',
      backgroundColor: '#FDECEC',
    };
  }
  if (method === 'TOP_UP') {
    return {
      ...base,
      title: 'Top-Up Successful',
      message: `${amount} was added to your RFID card.`,
      icon: 'wallet-plus-outline',
      color: colors.green,
      backgroundColor: '#EAF7EE',
    };
  }
  if (method === 'QR') {
    return {
      ...base,
      title: 'QR Payment Successful',
      message: `${amount} QR fare payment was completed.`,
      icon: 'qrcode-scan',
      color: colors.green,
      backgroundColor: '#EAF7EE',
    };
  }
  if (method === 'NFC') {
    return {
      ...base,
      title: 'NFC Payment Successful',
      message: `${amount} NFC fare payment was completed.`,
      icon: 'nfc',
      color: colors.teal,
      backgroundColor: '#E8F5F3',
    };
  }

  return {
    ...base,
    title: 'Fare Payment Successful',
    message: `${amount} fare was deducted successfully.`,
    icon: method === 'RFID' ? 'card-account-details-outline' : 'bus',
    color: colors.maroon,
    backgroundColor: '#FFF1F3',
  };
}

function getNotificationTime(item) {
  if (!item?.createdAt) return 'Now';

  return new Date(item.createdAt).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupNotificationsByDate(items) {
  return items.reduce((groups, item) => {
    const label = groupDateLabel(item.createdAt);
    const existing = groups.find((group) => group.label === label);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }

    return groups;
  }, []);
}

function txSearchText(tx) {
  return [
    tx?.id,
    tx?.referenceNumber,
    transactionId(tx),
    tx?.type,
    tx?.status,
    tx?.description,
    txMethodLabel(tx),
    txTitle(tx),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function TransactionRow({ tx, onPress }) {
  const visual = txVisual(tx);
  const isCredit = isMoneyIn(tx);
  const status = txStatus(tx);
  const failed = status === 'FAILED';

  return (
    <Pressable onPress={() => onPress?.(tx)} style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: visual.bg }]}>
        <MaterialCommunityIcons
          name={visual.icon}
          size={17}
          color={visual.color}
        />
      </View>

      <View style={styles.txMeta}>
        <Text style={styles.txTitle}>{txTitle(tx)}</Text>
        <Text style={styles.txId}>ID: {transactionId(tx)}</Text>
        <Text style={styles.txDate}>
          {formatDate(tx.createdAt)} • {txMethodLabel(tx)}
        </Text>
      </View>

      <View style={styles.txRight}>
        <Text
          style={[
            styles.txAmount,
            isCredit && styles.txAmountCredit,
            failed && styles.txAmountFailed,
          ]}
        >
          {isCredit ? '+' : '-'}PHP {formatCurrency(tx.amount)}
        </Text>
        <Text style={[styles.txStatus, failed && styles.txStatusFailed]}>
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen({ navigation }) {
  const { lastEvent } = useRealtime();
  const {
    passenger,
    logout,
    biometricEnabled,
    enableBiometrics,
    disableBiometrics,
    syncPushNotifications,
  } = useAuth();
  const posthog = usePostHog();

  const screen = useWindowDimensions();

  const [activeTab, setActiveTab] = useState('Home');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionRefreshing, setTransactionRefreshing] = useState(false);
  const [transactionError, setTransactionError] = useState(null);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionFilter, setTransactionFilter] = useState('All');
  const [notificationFilter, setNotificationFilter] = useState('All');
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [exportingTransactions, setExportingTransactions] = useState(false);
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
  const [qrSeconds, setQrSeconds] = useState(0);
  const [qrPayment, setQrPayment] = useState(null);
  const [qrError, setQrError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [guideVisible, setGuideVisible] = useState(false);
  const [guideIndex, setGuideIndex] = useState(0);
  const [guideMode, setGuideMode] = useState('home');
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [isCheckingStartupFlow, setIsCheckingStartupFlow] = useState(true);
  const [showChatbotIntro, setShowChatbotIntro] = useState(false);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(false);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync('postLoginAction').then(async (action) => {
      if (!active || action !== 'REPORT_LOST_CARD') return;
      await SecureStore.deleteItemAsync('postLoginAction');
      if (active) navigation.navigate('ReportLostCard');
    });
    return () => { active = false; };
  }, [navigation]);

  const [helpContent, setHelpContent] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [ticketContext, setTicketContext] = useState('');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketIssueType, setTicketIssueType] = useState('OTHER');
  const [ticketReason, setTicketReason] = useState('');

  const [messages, setMessages] = useState(() => [initialChatMessage()]);

  const chatSessionId = useRef(newChatSessionId());
  const chatScope = passenger?.id ? `passenger-${passenger.id}` : 'guest';

  useEffect(() => {
    let active = true;
    setChatLoaded(false);
    Promise.all([
      AsyncStorage.getItem(`${CHAT_HISTORY_PREFIX}${chatScope}`),
      AsyncStorage.getItem(`${CHAT_SESSION_PREFIX}${chatScope}`),
    ]).then(([storedMessages, storedSession]) => {
      if (!active) return;
      try {
        const parsed = storedMessages ? JSON.parse(storedMessages) : null;
        setMessages(Array.isArray(parsed) && parsed.length ? parsed : [initialChatMessage()]);
      } catch {
        setMessages([initialChatMessage()]);
      }
      chatSessionId.current = storedSession || newChatSessionId();
      if (!storedSession) AsyncStorage.setItem(`${CHAT_SESSION_PREFIX}${chatScope}`, chatSessionId.current).catch(() => {});
      setChatLoaded(true);
    });
    return () => { active = false; };
  }, [chatScope]);

  useEffect(() => {
    if (!chatLoaded) return;
    AsyncStorage.setItem(`${CHAT_HISTORY_PREFIX}${chatScope}`, JSON.stringify(messages.slice(-50))).catch(() => {});
  }, [chatLoaded, chatScope, messages]);

  const balanceGuideRef = useRef(null);
  const walletGuideRef = useRef(null);
  const myCardGuideRef = useRef(null);
  const topUpGuideRef = useRef(null);
  const qrGuideRef = useRef(null);
  const nfcGuideRef = useRef(null);
  const transactionGuideRef = useRef(null);
  const chatGuideRef = useRef(null);
  const notificationGuideRef = useRef(null);
  const bottomNavGuideRef = useRef(null);
  const homeNavGuideRef = useRef(null);
  const activityNavGuideRef = useRef(null);
  const profileNavGuideRef = useRef(null);
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
  const qrRefreshingRef = useRef(false);
  const hasStartedStartupFlowRef = useRef(false);
  const guideReplayRef = useRef(false);
  const recentActivityRef = useRef(null);

  const currentBalance = useMemo(
    () => Number(balance?.balance || 0),
    [balance],
  );

  const automaticModalBlocked =
    isGuideActive ||
    isCheckingStartupFlow ||
    showChatbotIntro ||
    showOtherModal;

  const rawPassengerName =
    passenger?.name ||
    balance?.fullName ||
    balance?.name ||
    'Passenger';

  const passengerName =
    String(rawPassengerName).replace(/\s*#\d+$/, '').trim() || 'Passenger';

  const profileCardStatus = String(
    balance?.cardStatus || balance?.status || 'Active',
  ).replace(/_/g, ' ');
  const profileCardActive = profileCardStatus.toUpperCase() === 'ACTIVE';

  const spent = transactions
    .filter((tx) => tx.type !== 'TOPUP')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const loaded = transactions
    .filter((tx) => tx.type === 'TOPUP')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const notificationCount =
    transactions.length +
    (currentBalance > 0 && currentBalance < 100 ? 1 : 0);

  const transactionSource = allTransactions.length ? allTransactions : transactions;

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();

    return transactionSource.filter((tx) => {
      const method = txMethod(tx);
      const status = txStatus(tx);
      const matchesSearch = !query || txSearchText(tx).includes(query);
      const matchesFilter =
        transactionFilter === 'All' ||
        (transactionFilter === 'Top Up' && method === 'TOP_UP') ||
        (transactionFilter === 'Failed' && status === 'FAILED') ||
        method === transactionFilter.toUpperCase();

      return matchesSearch && matchesFilter;
    });
  }, [transactionFilter, transactionSearch, transactionSource]);

  const groupedTransactions = useMemo(() => {
    const groups = [];

    filteredTransactions.forEach((tx) => {
      const label = groupDateLabel(tx.createdAt);
      const existing = groups.find((group) => group.label === label);

      if (existing) {
        existing.items.push(tx);
      } else {
        groups.push({ label, items: [tx] });
      }
    });

    return groups;
  }, [filteredTransactions]);

  const notificationItems = useMemo(() => {
    const transactionNotifications = transactionSource.map(notificationFromTransaction);
    const balanceNotifications =
      currentBalance > 0 && currentBalance < 100
        ? [
            {
              id: 'low-balance',
              createdAt: new Date().toISOString(),
              category: 'Alerts',
              title: 'Low Balance Alert',
              message: 'Your RFID card balance is low. Please top up before travelling.',
              icon: 'alert-outline',
              color: colors.gold,
              backgroundColor: '#FFF6E5',
            },
          ]
        : [];

    return [...balanceNotifications, ...transactionNotifications];
  }, [currentBalance, transactionSource]);

  const filteredNotifications = useMemo(
    () =>
      notificationItems.filter(
        (item) => notificationFilter === 'All' || item.category === notificationFilter,
      ),
    [notificationFilter, notificationItems],
  );

  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(filteredNotifications),
    [filteredNotifications],
  );

  const unreadNotificationCount = useMemo(
    () => notificationItems.filter((item) => !readNotificationIds.includes(item.id)).length,
    [notificationItems, readNotificationIds],
  );

  useEffect(() => {
    AsyncStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY)
      .then((value) => {
        const storedIds = JSON.parse(value || '[]');
        if (Array.isArray(storedIds)) setReadNotificationIds(storedIds);
      })
      .catch(() => setReadNotificationIds([]));
  }, []);

  const saveReadNotificationIds = useCallback((ids) => {
    setReadNotificationIds(ids);
    // TODO: Replace local persistence when a backend notification read/unread API is available.
    AsyncStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
  }, []);

  const markNotificationAsRead = useCallback(
    (id) => {
      if (readNotificationIds.includes(id)) return;
      saveReadNotificationIds([...readNotificationIds, id]);
    },
    [readNotificationIds, saveReadNotificationIds],
  );

  const markAllNotificationsAsRead = useCallback(() => {
    saveReadNotificationIds([
      ...new Set([...readNotificationIds, ...notificationItems.map((item) => item.id)]),
    ]);
  }, [notificationItems, readNotificationIds, saveReadNotificationIds]);

  const transactionTotals = useMemo(
    () =>
      transactionSource.reduce(
        (totals, tx) => {
          const amount = Number(tx.amount || 0);

          if (isMoneyIn(tx)) {
            totals.in += amount;
          } else if (txStatus(tx) !== 'FAILED') {
            totals.out += amount;
          }

          return totals;
        },
        { in: 0, out: 0 },
      ),
    [transactionSource],
  );

  const focusRecentActivity = useCallback(() => {
    setActiveTab('Home');

    requestAnimationFrame(() => {
      recentActivityRef.current?.measureLayout(
        homeScrollRef.current,
        (_x, y) => {
          homeScrollRef.current?.scrollTo({
            y: Math.max(0, y - 18),
            animated: true,
          });
        },
        () => {
          homeScrollRef.current?.scrollTo({
            y: 520,
            animated: true,
          });
        },
      );
    });
  }, []);

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

  const guideSteps = useMemo(() => [
    {
      id: 'balance', targetRef: balanceGuideRef, scrollRef: homeScrollRef,
      scrollOffsetRef: homeScrollOffsetRef, title: 'Available Balance',
      description: 'View your current RFID card balance, card status, and masked card number before making a fare payment.',
      targetType: 'card', pointerType: 'arrow', preferredCardPlacement: 'below', spotlightPadding: 10, spotlightRadius: 24,
    },
    {
      id: 'topup', targetRef: topUpGuideRef, scrollRef: homeScrollRef,
      scrollOffsetRef: homeScrollOffsetRef, title: 'Top Up',
      description: 'Add money to your RFID card using the available online top-up options.',
      targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 18,
    },
    {
      id: 'qr', targetRef: qrGuideRef, title: 'Pay with QR',
      description: 'Generate or scan a QR code to make a quick and secure fare payment.',
      targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 18,
    },
    {
      id: 'nfc', targetRef: nfcGuideRef, scrollRef: homeScrollRef,
      scrollOffsetRef: homeScrollOffsetRef, title: 'NFC Pay',
      description: 'Use your supported Android phone or registered card for contactless fare payment.',
      targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 18,
    },
    {
      id: 'recent-activity', targetRef: recentActivityRef, scrollRef: homeScrollRef,
      scrollOffsetRef: homeScrollOffsetRef, title: 'Recent Activity',
      description: 'Review your recent fare payments, top-ups, transaction status, and payment history.',
      targetType: 'section', pointerType: 'arrow', preferredCardPlacement: 'above', spotlightRadius: 16,
    },
    {
      id: 'notifications', targetRef: notificationGuideRef, title: 'Notifications',
      description: 'Stay updated with payment confirmations, account alerts, announcements, and important system messages.',
      targetType: 'headerButton', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 18,
    },
    {
      id: 'chat', targetRef: chatGuideRef, title: 'Need Help?',
      description: 'Get support for card balance, top-ups, QR payments, lost cards, and account concerns.',
      targetType: 'floatingButton', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 24,
    },
    {
      id: 'bottom-navigation', targetRef: bottomNavGuideRef, title: 'Bottom Navigation',
      description: 'Use the bottom menu to move between the main sections of the app.',
      targetType: 'fullBottomNavigation', pointerType: 'arrow', preferredCardPlacement: 'above', spotlightPadding: 6, spotlightRadius: 22,
    },
    {
      id: 'nav-home', targetRef: homeNavGuideRef, title: 'Home',
      description: 'Return to your dashboard to view your balance, quick actions, and recent activity.',
      targetType: 'bottomNavigationItem', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 18,
    },
    {
      id: 'nav-wallet', targetRef: walletGuideRef, title: 'Wallet',
      description: 'Manage your card balance, card details, top-up options, and wallet information.',
      targetType: 'bottomNavigationItem', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 18,
    },
    {
      id: 'nav-activity', targetRef: activityNavGuideRef, title: 'Activity',
      description: 'View your complete transaction history, fare payments, and top-up records.',
      targetType: 'bottomNavigationItem', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 18,
    },
    {
      id: 'nav-profile', targetRef: profileNavGuideRef, title: 'Profile',
      description: 'Manage your account information, security settings, preferences, and saved session options.',
      targetType: 'bottomNavigationItem', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 18,
    },
  ], []);

  const walletGuideSteps = useMemo(
    () => [
      {
        id: 'wallet-card',
        targetRef: walletCardGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'RFID Card',
        description: 'View your active transit card, masked card number, status, and balance.',
        targetType: 'card', pointerType: 'arrow', preferredCardPlacement: 'below', spotlightPadding: 10, spotlightRadius: 24,
      },
      {
        id: 'wallet-topup',
        targetRef: walletTopUpGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'Top Up',
        description: 'Add balance to your RFID card using the available online payment options.',
        targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 18,
      },
      {
        id: 'wallet-pay',
        targetRef: walletPayGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'QR Payment',
        description: 'Open your QR code when you need to pay through the fare scanner.',
        targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 18,
      },
      {
        id: 'wallet-stats',
        targetRef: walletStatsGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'Monthly Summary',
        description: 'Review your fare spending and top-up amount for this month.',
        targetType: 'section', pointerType: 'arrow', preferredCardPlacement: 'above', spotlightRadius: 20,
      },
      {
        id: 'wallet-ledger',
        targetRef: walletLedgerGuideRef,
        scrollRef: walletScrollRef,
        scrollOffsetRef: walletScrollOffsetRef,
        title: 'Card Details',
        description: 'View your assigned RFID card number and current ledger balance.',
        targetType: 'section', pointerType: 'arrow', preferredCardPlacement: 'above', spotlightRadius: 20,
      },
    ],
    [],
  );

  const topUpGuideSteps = useMemo(
    () => [
      {
        id: 'topup-card',
        targetRef: topUpCardGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Card Balance',
        description: 'Check your RFID card and current balance here before adding load.',
        targetType: 'card', pointerType: 'arrow', preferredCardPlacement: 'below', spotlightPadding: 10, spotlightRadius: 24,
      },
      {
        id: 'topup-presets',
        targetRef: topUpPresetGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Choose Amount',
        description: 'Pick a preset load amount for a faster top-up.',
        targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 16,
      },
      {
        id: 'topup-custom',
        targetRef: topUpCustomGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Custom Amount',
        description: 'Enter your own amount here if the preset options do not match what you need.',
        targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'below', spotlightRadius: 16,
      },
      {
        id: 'topup-payment',
        targetRef: topUpPaymentGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Payment Method',
        description: 'Choose where you want to pay from, such as GCash or Maya.',
        targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 18,
      },
      {
        id: 'topup-load',
        targetRef: topUpLoadGuideRef,
        scrollRef: topUpScrollRef,
        scrollOffsetRef: topUpScrollOffsetRef,
        title: 'Load Amount',
        description: 'Tap this button to start checkout. After payment, the app verifies and updates your RFID balance.',
        targetType: 'button', pointerType: 'hand', preferredCardPlacement: 'above', spotlightRadius: 16,
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
    if (['TRANSACTION', 'TOPUP', 'PASSENGER', 'SUPPORT_TICKET'].includes(lastEvent?.entity)) {
      fetchData({ silent: true });
    }
  }, [fetchData, lastEvent]);

  const closeAllAutomaticModals = useCallback(() => {
    setShowChatbotIntro(false);
    setShowOtherModal(false);
    setHelpContent(null);
  }, []);

  const startGuide = useCallback((mode = 'home') => {
    setGuideMode(mode);
    setGuideIndex(0);
    setIsGuideActive(true);

    if (mode === 'home') {
      setActiveTab('Home');
    }

    setTimeout(() => {
      setGuideVisible(true);
    }, 450);
  }, []);

  const checkPostGuidePrompts = useCallback(async () => {
    try {
      const [promptShown, storedEnabled] = await Promise.all([
        AsyncStorage.getItem(FINGERPRINT_PROMPT_SHOWN_KEY),
        AsyncStorage.getItem(FINGERPRINT_ENABLED_KEY),
      ]);
      const fingerprintEnabled =
        biometricEnabled || storedEnabled === 'true';

      if (fingerprintEnabled) {
        await AsyncStorage.setItem(FINGERPRINT_ENABLED_KEY, 'true');
        syncPushNotifications?.();
        return;
      }

      if (promptShown === 'true') {
        syncPushNotifications?.();
        return;
      }

      Alert.alert(
        'Enable biometric login?',
        'Use fingerprint or Face ID next time instead of entering OTP on this device.',
        [
          {
            text: 'NOT NOW',
            style: 'cancel',
            onPress: async () => {
              await AsyncStorage.setItem(FINGERPRINT_PROMPT_SHOWN_KEY, 'true');
              syncPushNotifications?.();
            },
          },
          {
            text: 'ENABLE',
            onPress: async () => {
              try {
                await AsyncStorage.setItem(FINGERPRINT_PROMPT_SHOWN_KEY, 'true');
                await enableBiometrics();
                await AsyncStorage.setItem(FINGERPRINT_ENABLED_KEY, 'true');
              } catch (error) {
                Alert.alert(
                  'Biometrics unavailable',
                  error.message || 'You can enable it later in Settings.',
                );
              } finally {
                syncPushNotifications?.();
              }
            },
          },
        ],
        { cancelable: false },
      );
    } catch {
      syncPushNotifications?.();
    }
  }, [biometricEnabled, enableBiometrics, syncPushNotifications]);

  const runDashboardStartupFlow = useCallback(async () => {
    setIsCheckingStartupFlow(true);
    closeAllAutomaticModals();

    try {
      const [completed, legacyCompleted] = await Promise.all([
        AsyncStorage.getItem(APP_GUIDE_STORAGE_KEY),
        AsyncStorage.getItem(LEGACY_APP_GUIDE_STORAGE_KEY),
      ]);
      const guideCompleted =
        completed === 'true' || legacyCompleted === 'true';

      await AsyncStorage.setItem(DASHBOARD_FIRST_VISIT_DONE_KEY, 'true');

      if (legacyCompleted === 'true' && completed !== 'true') {
        await AsyncStorage.setItem(APP_GUIDE_STORAGE_KEY, 'true');
      }

      if (!guideCompleted) {
        startGuide('home');
        return;
      }

      await checkPostGuidePrompts();
    } catch {
      await checkPostGuidePrompts();
    } finally {
      setIsCheckingStartupFlow(false);
    }
  }, [checkPostGuidePrompts, closeAllAutomaticModals, startGuide]);
  useEffect(() => {
    if (loading || activeTab !== 'Home' || hasStartedStartupFlowRef.current) {
      return;
    }

    hasStartedStartupFlowRef.current = true;
    runDashboardStartupFlow();
  }, [activeTab, loading, runDashboardStartupFlow]);

  useEffect(() => {
    let active = true;

    const maybeStartWalletGuide = async () => {
      if (loading || guideVisible || automaticModalBlocked || activeTab !== 'Wallet') return;

      try {
        const completed = await AsyncStorage.getItem(
          WALLET_GUIDE_STORAGE_KEY,
        );

        if (!active || completed === 'true') return;

        setTimeout(() => {
          if (!active || activeTab !== 'Wallet') return;

          setGuideMode('wallet');
          setGuideIndex(0);
          setIsGuideActive(true);
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
  }, [activeTab, automaticModalBlocked, guideVisible, loading]);

  useEffect(() => {
    let active = true;

    const maybeStartTopUpGuide = async () => {
      if (loading || guideVisible || automaticModalBlocked || activeTab !== 'TopUp') return;

      try {
        const completed = await AsyncStorage.getItem(
          TOPUP_GUIDE_STORAGE_KEY,
        );

        if (!active || completed === 'true') return;

        setTimeout(() => {
          if (!active || activeTab !== 'TopUp') return;

          setGuideMode('topup');
          setGuideIndex(0);
          setIsGuideActive(true);
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
  }, [activeTab, automaticModalBlocked, guideVisible, loading]);

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

  const fetchAllTransactions = async ({ refreshing = false } = {}) => {
    if (transactionLoading || transactionRefreshing) return;

    if (refreshing) {
      setTransactionRefreshing(true);
    } else {
      setTransactionLoading(true);
    }
    setTransactionError(null);

    try {
      const response = await api.get('/transactions?page=0&size=50');

      setAllTransactions(response.data.data?.content || []);
      setActiveTab('Transactions');
    } catch (error) {
      setTransactionError(
        error.response?.data?.message ||
          'Unable to load transactions. Please try again.',
      );
    } finally {
      if (refreshing) {
        setTransactionRefreshing(false);
      } else {
        setTransactionLoading(false);
      }
    }
  };

  const downloadTransactions = async () => {
    if (exportingTransactions) return;

    setExportingTransactions(true);

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

      const fileName = `premier-transaction-report-${new Date()
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
            'Report downloaded',
            `${fileName} was saved to the folder you selected.`,
          );
          return;
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download Premier transaction report',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Report exported', `Saved to ${fileUri}`);
      }
    } catch (error) {
      Alert.alert(
        'Download failed',
        error.message || 'Please try again.',
      );
    } finally {
      setExportingTransactions(false);
    }
  };

  const downloadReceipt = async (tx) => {
    if (!tx) return;

    try {
      const amountSign = isMoneyIn(tx) ? '+' : '-';
      const receipt = [
        'PREMIER TRANSPORT',
        'Transaction Receipt',
        '',
        `Type: ${txTitle(tx)}`,
        `Status: ${txStatus(tx)}`,
        `Transaction ID: ${tx.id || '-'}`,
        `Reference Number: ${tx.referenceNumber || transactionId(tx)}`,
        `Payment Method: ${txMethodLabel(tx)}`,
        `Card Number: ${maskCardNumber(balance?.cardNumber || passenger?.cardNumber)}`,
        `Date & Time: ${formatFullDate(tx.createdAt) || '-'}`,
        `Amount: ${amountSign}PHP ${formatCurrency(tx.amount)}`,
        tx.balanceBefore !== undefined && tx.balanceBefore !== null
          ? `Balance Before: PHP ${formatCurrency(tx.balanceBefore)}`
          : null,
        tx.balanceAfter !== undefined && tx.balanceAfter !== null
          ? `Balance After: PHP ${formatCurrency(tx.balanceAfter)}`
          : null,
        tx.busNumber ? `Bus Number: ${tx.busNumber}` : null,
        tx.terminalName || tx.terminal ? `Terminal: ${tx.terminalName || tx.terminal}` : null,
        tx.description ? `Description: ${tx.description}` : null,
        tx.notes || tx.reason ? `Notes: ${tx.notes || tx.reason}` : null,
        '',
        'Thank you for using Premier Transport.',
      ]
        .filter(Boolean)
        .join('\n');

      const safeId = transactionId(tx).replace(/[^a-zA-Z0-9_-]/g, '-');
      const fileName = `premier-receipt-${safeId}.txt`;
      const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, receipt, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Download Premier receipt',
          UTI: 'public.plain-text',
        });
      } else {
        Alert.alert('Receipt exported', `Saved to ${fileUri}`);
      }
    } catch (error) {
      Alert.alert(
        'Receipt download failed',
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

  const generateFareQr = useCallback(async (refreshing = false) => {
    if (qrRefreshingRef.current) return;
    qrRefreshingRef.current = true;
    setQrLoading(true);
    setQrError(null);
    setQrPayment(null);
    if (!refreshing) {
      setQrData(null);
    }
    setQrOpen(true);

    try {
      const response = await api.post('/fare/qr');
      const data = response.data.data;
      if (!data?.payload) {
        throw new Error('Unable to prepare secure fare QR.');
      }
      setQrData(data);
      setQrSeconds(Number(data.expiresInSeconds || 45));
      captureMobileEvent(posthog, 'mobile_qr_generated', {
        refreshed: refreshing,
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Please try again.';
      setQrError(message);
      if (!refreshing) {
        setQrData(null);
      }
      Alert.alert(
        'QR unavailable',
        message,
      );
    } finally {
      qrRefreshingRef.current = false;
      setQrLoading(false);
    }
  }, [posthog]);

  const checkFareQrStatus = useCallback(async () => {
    if (!qrOpen || !qrData?.payload || qrLoading || qrPayment) return;

    try {
      const response = await api.post('/fare/qr/status', {
        payload: qrData.payload,
      });
      const status = response.data.data;

      if (status?.status === 'USED' && status.payment) {
        setQrPayment(status.payment);
        setQrSeconds(0);
        captureMobileEvent(posthog, 'mobile_qr_completed');
        fetchData({ silent: true });
        return;
      }

      if (status?.status === 'EXPIRED') {
        generateFareQr(true);
        return;
      }

      if (typeof status?.expiresInSeconds === 'number') {
        setQrSeconds(status.expiresInSeconds);
      }
    } catch (error) {
      setQrError(
        error.response?.data?.message ||
          'Reader connection issue. Please try again.',
      );
    }
  }, [fetchData, generateFareQr, posthog, qrData?.payload, qrLoading, qrOpen, qrPayment]);

  useEffect(() => {
    if (!qrOpen || !qrData?.payload || qrLoading || qrPayment) return undefined;

    const timer = setInterval(() => {
      setQrSeconds((current) => {
        const next = Math.max(0, Number(current || 0) - 1);
        if (next <= QR_REFRESH_BUFFER_SECONDS) {
          generateFareQr(true);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [generateFareQr, qrData?.payload, qrLoading, qrOpen, qrPayment]);

  useEffect(() => {
    if (!qrOpen || !qrData?.payload || qrLoading || qrPayment) return undefined;

    const poller = setInterval(checkFareQrStatus, 2500);
    return () => clearInterval(poller);
  }, [checkFareQrStatus, qrData?.payload, qrLoading, qrOpen, qrPayment]);

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
      captureMobileEvent(posthog, 'mobile_nfc_opened');
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
    const completedMode = guideMode;
    const wasReplay = guideReplayRef.current;

    guideReplayRef.current = false;
    setGuideVisible(false);
    setIsGuideActive(false);
    setGuideIndex(0);

    const storageKey =
      completedMode === 'wallet'
        ? WALLET_GUIDE_STORAGE_KEY
        : completedMode === 'topup'
          ? TOPUP_GUIDE_STORAGE_KEY
          : APP_GUIDE_STORAGE_KEY;

    await AsyncStorage.setItem(storageKey, 'true');

    if (completedMode === 'home') {
      await AsyncStorage.setItem(LEGACY_APP_GUIDE_STORAGE_KEY, 'true');
    }

    if (completedMode === 'home' && !wasReplay) {
      captureMobileEvent(posthog, 'mobile_onboarding_completed', {
        guide_mode: completedMode,
      });
      setTimeout(() => {
        checkPostGuidePrompts();
      }, 350);
    }
  };

  const replayGuide = async (mode = 'home') => {
    guideReplayRef.current = true;
    if (mode === 'home') {
      await AsyncStorage.setItem(APP_GUIDE_REPLAYED_KEY, 'true');
    }
    closeAllAutomaticModals();
    setActiveTab(mode === 'wallet' ? 'Wallet' : mode === 'topup' ? 'TopUp' : 'Home');
    startGuide(mode);
  };

  const showReplayGuideMenu = () => {
    Alert.alert('Replay App Guide', 'Choose the guide you want to review.', [
      { text: 'Main App Guide', onPress: () => replayGuide('home') },
      { text: 'Wallet Guide', onPress: () => replayGuide('wallet') },
      { text: 'Top Up Guide', onPress: () => replayGuide('topup') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const showHelp = (title, message) => {
    if (automaticModalBlocked) return;

    setHelpContent({
      title,
      message,
    });
  };

  const sendChat = async (text = chatInput) => {
    const trimmed = text.trim();

    if (!trimmed || chatLoading) return;
    captureMobileEvent(posthog, 'mobile_chatbot_message_sent');

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
          quickReplies: payload.quickReplies ||
            (payload.recommendedAction === 'REPORT_LOST_CARD' ? ['Report lost card', 'Cancel'] : null),
        },
      ]);

      if (payload.recommendedAction === 'OPEN_SUPPORT_TICKET_FORM') {
        if (isTicketConfirmation(trimmed)) {
          setTicketIssueType(ticketTypeFor(ticketContext || trimmed));
          setTicketReason(ticketContext || '');
          setTicketOpen(true);
        } else {
          setTicketContext(trimmed);
        }
      }
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

  const submitSupportTicket = async () => {
    const email = ticketEmail.trim();
    const reason = ticketReason.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email required', 'Enter a valid email address for support updates.');
      return;
    }
    if (!reason) {
      Alert.alert('Description required', 'Describe the issue so the support team can review it.');
      return;
    }

    setTicketSubmitting(true);
    try {
      const response = await api.post('/support-tickets', {
        email,
        issueType: ticketIssueType,
        reason,
      });
      const ticket = response.data?.data || response.data || {};
      captureMobileEvent(posthog, 'mobile_support_ticket_submitted', { request_type: ticketIssueType });
      setTicketOpen(false);
      setTicketEmail('');
      setTicketReason('');
      setTicketContext('');
      Alert.alert('Ticket submitted', ticket.message || `Your support ticket${ticket.ticketNumber ? ` ${ticket.ticketNumber}` : ''} was submitted. We will email you with updates.`);
    } catch (error) {
      captureMobileEvent(posthog, 'mobile_support_ticket_failed', { request_type: ticketIssueType });
      Alert.alert('Ticket not submitted', error.response?.data?.message || 'Please try again.');
    } finally {
      setTicketSubmitting(false);
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
            ref={notificationGuideRef}
            collapsable={false}
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
        <Feather name="shield" size={14} color={colors.maroon} />
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

          <Feather name="credit-card" size={20} color={colors.navy} />

          <Text style={styles.activeBadge}>Active</Text>
        </View>
      </View>

      <View style={styles.quickPanel}>
        <ActionButton
          targetRef={topUpGuideRef}
          color={colors.gold}
          icon="wallet-plus-outline"
          label="Top Up"
          onPress={() => setActiveTab('TopUp')}
        />

        <ActionButton
          targetRef={transactionGuideRef}
          color={colors.maroon}
          icon="clipboard-text-clock-outline"
          label="Recent"
          onPress={focusRecentActivity}
        />

        <ActionButton
          targetRef={myCardGuideRef}
          color={colors.navy}
          icon="credit-card-outline"
          label="My Card"
          onPress={() => setActiveTab('Wallet')}
        />

        <ActionButton
          targetRef={qrGuideRef}
          color={colors.green}
          icon="qrcode"
          label="Pay QR"
          onPress={() => navigation.navigate('QRFarePayment')}
        />

        <ActionButton
          targetRef={nfcGuideRef}
          color={colors.teal}
          icon="nfc"
          label="NFC Pay"
          onPress={handleNfcPayment}
        />
      </View>

      <View
        ref={recentActivityRef}
        collapsable={false}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>Recent Activity</Text>

        <Pressable onPress={fetchAllTransactions}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>

      {(transactions.length ? transactions.slice(0, 3) : []).map((tx) => (
        <TransactionRow key={tx.id} tx={tx} onPress={setSelectedReceipt} />
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
                color="#D9E2F1"
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
            textStyle={styles.walletActionTextLight}
            onPress={() => setActiveTab('TopUp')}
            icon={
              <MaterialCommunityIcons
                name="wallet-plus-outline"
                size={17}
                color="#fff"
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
            style={styles.walletButtonQr}
            textStyle={styles.walletActionTextLight}
            onPress={() => navigation.navigate('QRFarePayment')}
            icon={
              <MaterialCommunityIcons
                name="qrcode"
                size={17}
                color="#fff"
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
            style={styles.walletButtonNfc}
            textStyle={styles.walletActionTextLight}
            onPress={handleNfcPayment}
            icon={
              <MaterialCommunityIcons
                name="nfc"
                size={17}
                color="#fff"
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
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={transactionRefreshing}
            onRefresh={() => fetchAllTransactions({ refreshing: true })}
            tintColor={colors.maroon}
            colors={[colors.maroon]}
          />
        }
      >
        <BackTitle
          title="Transactions"
          subtitle="Complete transaction history"
          onBack={() => setActiveTab('Home')}
          rightText={exportingTransactions ? 'Exporting...' : 'Download Report'}
          onRightPress={downloadTransactions}
        />

        <View style={styles.totalGrid}>
          <View style={[styles.totalCard, styles.totalIn]}>
            <MaterialCommunityIcons
              name="cellphone"
              size={20}
              color="#DCFCE7"
            />
            <Text style={styles.totalLabel}>Total In</Text>
            <Text style={styles.totalValue}>
              +PHP {formatCurrency(transactionTotals.in)}
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
              -PHP {formatCurrency(transactionTotals.out)}
            </Text>
          </View>
        </View>

        <View style={styles.transactionSearchBox}>
          <Feather name="search" size={17} color="#8AA0BF" />
          <TextInput
            value={transactionSearch}
            onChangeText={setTransactionSearch}
            placeholder="Search transaction ID or reference number"
            placeholderTextColor="#94A3B8"
            style={styles.transactionSearchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          {TRANSACTION_FILTERS.map((filter) => {
            const active = transactionFilter === filter;

            return (
              <Pressable
                key={filter}
                onPress={() => setTransactionFilter(filter)}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {transactionLoading && (
          <View>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.transactionSkeleton}>
                <View style={styles.transactionSkeletonIcon} />
                <View style={styles.transactionSkeletonBody}>
                  <View style={styles.transactionSkeletonLineWide} />
                  <View style={styles.transactionSkeletonLine} />
                </View>
              </View>
            ))}
          </View>
        )}

        {!transactionLoading && !!transactionError && (
          <View style={styles.transactionStateCard}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={28}
              color={colors.maroon}
            />
            <Text style={styles.transactionStateTitle}>
              Unable to load transactions
            </Text>
            <Text style={styles.transactionStateText}>
              {transactionError}
            </Text>
            <Pressable
              style={styles.transactionRetryButton}
              onPress={() => fetchAllTransactions()}
            >
              <Text style={styles.transactionRetryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!transactionLoading &&
          !transactionError &&
          groupedTransactions.map((group) => (
            <View key={group.label} style={styles.transactionDateGroup}>
              <Text style={styles.transactionDateTitle}>{group.label}</Text>
              {group.items.map((tx) => (
                <TransactionRow
                  key={tx.id || transactionId(tx)}
                  tx={tx}
                  onPress={setSelectedReceipt}
                />
              ))}
            </View>
          ))}

        {!transactionLoading && !transactionError && !filteredTransactions.length && (
          <View style={styles.transactionStateCard}>
            <MaterialCommunityIcons
              name="receipt-text-outline"
              size={30}
              color={colors.navy}
            />
            <Text style={styles.transactionStateTitle}>
              No transactions yet.
            </Text>
            <Text style={styles.transactionStateText}>
              Your fare payments and top-ups will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderNotifications = () => {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.notificationContent}
      >
        <BackTitle
          title="Notifications"
          subtitle={`${notificationItems.length} ${notificationItems.length === 1 ? 'alert' : 'alerts'}`}
          onBack={() => setActiveTab('Home')}
          rightText={unreadNotificationCount ? 'Mark all as read' : undefined}
          onRightPress={markAllNotificationsAsRead}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.notificationFilterRow}
        >
          {NOTIFICATION_FILTERS.map((filter) => {
            const active = notificationFilter === filter;

            return (
              <Pressable
                key={filter}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setNotificationFilter(filter)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {groupedNotifications.map((group) => (
          <View key={group.label} style={styles.notificationDateGroup}>
            <Text style={styles.transactionDateTitle}>{group.label}</Text>
            {group.items.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                unread={!readNotificationIds.includes(item.id)}
                onPress={() => markNotificationAsRead(item.id)}
              />
            ))}
          </View>
        ))}

        {!filteredNotifications.length && (
          <View style={styles.notificationEmptyState}>
            <MaterialCommunityIcons name="bell-outline" size={32} color={colors.navy} />
            <Text style={styles.notificationEmptyTitle}>
              {notificationItems.length ? 'No notifications in this category yet' : 'No notifications yet'}
            </Text>
            <Text style={styles.notificationEmptyText}>
              {notificationItems.length
                ? 'Try another filter to view other alerts.'
                : 'Your fare payments, top-ups, and account alerts will appear here.'}
            </Text>
          </View>
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
            <View key={`${message.timestamp}-${index}`}>
              <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
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

              {!isUser && index === messages.length - 1 && message.quickReplies?.length > 0 && (
                <View style={styles.messageQuickReplies}>
                  {message.quickReplies.map((reply) => (
                    <Pressable
                      key={reply}
                      onPress={() => reply === 'Report lost card' ? navigation.navigate('ReportLostCard') : sendChat(reply)}
                      style={styles.quickReply}
                    >
                      <Text style={styles.quickReplyText}>{reply}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {chatLoading && (
          <Text style={styles.typing}>Premier Bot is typing...</Text>
        )}

        {!messages[messages.length - 1]?.quickReplies?.length && !chatLoading && (
          <View style={styles.quickReplies}>
            {QUICK_REPLIES.map((reply) => (
              <Pressable key={reply} onPress={() => sendChat(reply)} style={styles.quickReply}>
                <Text style={styles.quickReplyText}>{reply}</Text>
              </Pressable>
            ))}
          </View>
        )}
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.profileContent}
    >
      <Text style={styles.pageTitle}>Profile</Text>
      <Text style={styles.pageSub}>Passenger account settings</Text>

      <View style={styles.profileSummaryCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {passengerName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join('')
              .toUpperCase() || 'P'}
          </Text>
        </View>

        <View style={styles.profileSummaryText}>
          <Text numberOfLines={1} style={styles.profileName}>{passengerName}</Text>
          <Text style={styles.profileCardNumber}>
            {maskCardNumber(balance?.cardNumber || passenger?.cardNumber)}
          </Text>
        </View>

        <View style={[styles.profileActiveBadge, !profileCardActive && styles.profileInactiveBadge]}>
          <View style={[styles.profileActiveDot, !profileCardActive && styles.profileInactiveDot]} />
          <Text style={[styles.profileActiveText, !profileCardActive && styles.profileInactiveText]}>
            {profileCardStatus}
          </Text>
        </View>
      </View>

      <ProfileSection title="Account">
        <ProfileSettingRow
          icon="card-account-details-outline"
          title="Card Information"
          subtitle={`${maskCardNumber(balance?.cardNumber || passenger?.cardNumber)} • ${profileCardStatus}${balance?.cardType ? ` • ${balance.cardType}` : ''}`}
          onPress={() => setActiveTab('Wallet')}
        />
      </ProfileSection>

      <ProfileSection title="Security">
        <ProfileSettingRow
          icon="fingerprint"
          title="Fingerprint / Phone Unlock"
          subtitle="Use device security for faster login"
          onPress={toggleBiometrics}
          right={(
            <View style={[styles.profileStatePill, biometricEnabled && styles.profileStatePillEnabled]}>
              <Text style={[styles.profileStateText, biometricEnabled && styles.profileStateTextEnabled]}>
                {biometricEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          )}
        />
      </ProfileSection>

      <ProfileSection title="Support & Privacy">
        <ProfileSettingRow
          icon="map-marker-path"
          title="Replay App Guide"
          subtitle="Review how to use Premier features"
          onPress={showReplayGuideMenu}
        />
        <View style={styles.profileRowDivider} />
        <ProfileSettingRow
          icon="shield-lock-outline"
          title="Privacy Notice"
          subtitle="See how your account information is used"
          onPress={() => setPrivacyNoticeOpen(true)}
        />
        <View style={styles.profileRowDivider} />
        <ProfileSettingRow
          icon="lifebuoy"
          title="Help and Support"
          subtitle="Get help with fares, cards, and top-ups"
          onPress={() => setActiveTab('Chat')}
        />
      </ProfileSection>

      <Pressable
        accessibilityRole="button"
        onPress={confirmLogout}
        style={({ pressed }) => [styles.profileLogoutRow, pressed && styles.profileRowPressed]}
      >
        <View style={styles.profileLogoutIcon}>
          <MaterialCommunityIcons name="logout" size={20} color="#B4232D" />
        </View>
        <View style={styles.profileRowText}>
          <Text style={styles.profileLogoutTitle}>Log Out</Text>
          <Text style={styles.profileRowSubtitle}>Sign out from this device</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#B4232D" />
      </Pressable>

      <View style={styles.profileFooter}>
        <Text style={styles.profileFooterText}>Premier Transport Corporation</Text>
        <Text style={styles.profileFooterVersion}>App version 1.0.0</Text>
      </View>
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

      {activeTab !== 'Chat' && (
        <>
          <Pressable
            ref={chatGuideRef}
            collapsable={false}
            style={[styles.chatFloat, activeTab === 'Profile' && styles.profileChatFloat]}
            onPress={() => setActiveTab('Chat')}
          >
            <MaterialCommunityIcons
              name="robot-outline"
              size={21}
              color="#fff"
            />
          </Pressable>

          <View ref={bottomNavGuideRef} collapsable={false} style={styles.bottomNav}>
            <NavItem
              ref={homeNavGuideRef}
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
              ref={activityNavGuideRef}
              icon="history"
              label="Activity"
              active={activeTab === 'Transactions'}
              onPress={fetchAllTransactions}
            />

            <NavItem
              ref={profileNavGuideRef}
              icon="account-outline"
              label="Profile"
              active={activeTab === 'Profile'}
              onPress={() => setActiveTab('Profile')}
            />
          </View>
        </>
      )}

      <PrivacyNoticeModal
        visible={privacyNoticeOpen}
        onClose={() => setPrivacyNoticeOpen(false)}
      />

      <Modal
        visible={ticketOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTicketOpen(false)}
      >
        <View style={styles.centerModalBackdrop}>
          <View style={[styles.helpModalCard, { gap: 10 }]}> 
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>Submit support ticket</Text>
              <Pressable onPress={() => setTicketOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.maroon} />
              </Pressable>
            </View>
            <Text style={styles.helpModalText}>Your signed-in account is linked automatically. We will send status updates to this email address.</Text>
            <TextInput
              value={ticketEmail}
              onChangeText={setTicketEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Email for support updates"
              placeholderTextColor="#7B8794"
              style={styles.supportTicketInput}
            />
            <View style={styles.quickReplies}>
              {SUPPORT_TICKET_TYPES.map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setTicketIssueType(value)}
                  style={[styles.quickReply, ticketIssueType === value && { backgroundColor: colors.maroon, borderColor: colors.maroon }]}
                >
                  <Text style={[styles.quickReplyText, ticketIssueType === value && { color: '#fff' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={ticketReason}
              onChangeText={setTicketReason}
              multiline
              placeholder="Describe the issue and include a transaction reference if available."
              placeholderTextColor="#7B8794"
              style={[styles.supportTicketInput, { minHeight: 112, textAlignVertical: 'top' }]}
            />
            <Pressable
              disabled={ticketSubmitting}
              onPress={submitSupportTicket}
              style={[styles.supportTicketSubmit, ticketSubmitting && { opacity: 0.6 }]}
            >
              <Text style={styles.supportTicketSubmitText}>{ticketSubmitting ? 'Submitting...' : 'Submit for admin review'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedReceipt}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.centerModalBackdrop}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View>
                <Text style={styles.receiptBrand}>Premier Transport</Text>
                <Text style={styles.receiptTitle}>Receipt</Text>
              </View>

              <Pressable
                style={styles.receiptClose}
                onPress={() => setSelectedReceipt(null)}
              >
                <Feather name="x" size={18} color="#536987" />
              </Pressable>
            </View>

            {!!selectedReceipt && (
              <View style={styles.receiptBody}>
                <View style={styles.receiptSummary}>
                  <View>
                    <Text style={styles.receiptType}>
                      {txTitle(selectedReceipt)}
                    </Text>
                    <Text
                      style={[
                        styles.receiptAmount,
                        isMoneyIn(selectedReceipt) && styles.receiptAmountCredit,
                        txStatus(selectedReceipt) === 'FAILED' && styles.receiptAmountFailed,
                      ]}
                    >
                      {isMoneyIn(selectedReceipt) ? '+' : '-'}PHP {formatCurrency(selectedReceipt.amount)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.receiptStatus,
                      txStatus(selectedReceipt) === 'FAILED' && styles.receiptStatusFailed,
                    ]}
                  >
                    {txStatus(selectedReceipt)}
                  </Text>
                </View>

                <View style={styles.receiptDetails}>
                  <InfoRow label="Transaction ID" value={String(selectedReceipt.id || '-')} />
                  <InfoRow label="Reference No." value={selectedReceipt.referenceNumber || transactionId(selectedReceipt)} />
                  <InfoRow label="Payment Method" value={txMethodLabel(selectedReceipt)} />
                  <InfoRow label="Date & Time" value={formatFullDate(selectedReceipt.createdAt) || '-'} />
                  <InfoRow
                    label="Card Number"
                    value={maskCardNumber(balance?.cardNumber || passenger?.cardNumber)}
                  />

                  {!!(selectedReceipt.busNumber || selectedReceipt.busCode) && (
                    <InfoRow
                      label="Bus Number"
                      value={selectedReceipt.busNumber || selectedReceipt.busCode}
                    />
                  )}

                  {!!(selectedReceipt.terminalName || selectedReceipt.terminal) && (
                    <InfoRow
                      label="Terminal"
                      value={selectedReceipt.terminalName || selectedReceipt.terminal}
                    />
                  )}

                  {selectedReceipt.balanceBefore !== undefined &&
                    selectedReceipt.balanceBefore !== null && (
                      <InfoRow
                        label="Balance Before"
                        value={`PHP ${formatCurrency(selectedReceipt.balanceBefore)}`}
                      />
                    )}

                  {selectedReceipt.balanceAfter !== undefined &&
                    selectedReceipt.balanceAfter !== null && (
                      <InfoRow
                        label="Balance After"
                        value={`PHP ${formatCurrency(selectedReceipt.balanceAfter)}`}
                      />
                    )}

                  {!!selectedReceipt.description && (
                    <View style={styles.receiptDescription}>
                      <Text style={styles.infoLabel}>Description</Text>
                      <Text style={styles.receiptDescriptionText}>
                        {selectedReceipt.description}
                      </Text>
                    </View>
                  )}

                  {!!(selectedReceipt.notes || selectedReceipt.reason) && (
                    <View style={styles.receiptDescription}>
                      <Text style={styles.infoLabel}>Notes</Text>
                      <Text style={styles.receiptDescriptionText}>
                        {selectedReceipt.notes || selectedReceipt.reason}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.receiptActions}>
                  <Pressable
                    style={styles.receiptDownloadButton}
                    onPress={() => downloadReceipt(selectedReceipt)}
                  >
                    <Text style={styles.receiptDownloadText}>Download</Text>
                  </Pressable>

                  <Pressable
                    style={styles.receiptDoneButton}
                    onPress={() => setSelectedReceipt(null)}
                  >
                    <Text style={styles.receiptDoneText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

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
                    Refreshes in {formatCountdown(qrSeconds)}
                  </Text>

                  {qrPayment && (
                    <View style={styles.qrSuccessBox}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={26}
                        color={colors.green}
                      />
                      <Text style={styles.qrSuccessTitle}>
                        Payment successful
                      </Text>
                      <Text style={styles.qrSuccessText}>
                        Fare deducted: PHP {formatCurrency(qrPayment.deductedFare)}
                      </Text>
                      <Text style={styles.qrSuccessText}>
                        Remaining balance: PHP {formatCurrency(qrPayment.remainingBalance)}
                      </Text>
                    </View>
                  )}

                  {!!qrError && !qrPayment && (
                    <Text style={styles.qrErrorText}>{qrError}</Text>
                  )}

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
        visible={!!helpContent && !isGuideActive}
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
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={styles.markAll}
          >
            {rightText}
          </Text>
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

function ProfileSection({ title, children }) {
  return (
    <View style={styles.profileSection}>
      <Text style={styles.profileSectionTitle}>{title}</Text>
      <View style={styles.profileSectionCard}>{children}</View>
    </View>
  );
}

function ProfileSettingRow({ icon, title, subtitle, onPress, right }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileSettingRow, pressed && styles.profileRowPressed]}
    >
      <View style={styles.profileSettingIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.maroon} />
      </View>
      <View style={styles.profileRowText}>
        <Text style={styles.profileRowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.profileRowSubtitle}>{subtitle}</Text>}
      </View>
      {right || <Feather name="chevron-right" size={20} color="#94A3B8" />}
    </Pressable>
  );
}

function NotificationCard({ item, unread, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${unread ? 'Unread notification.' : 'Read notification.'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.notificationCard,
        unread && styles.notificationUnread,
        pressed && styles.notificationCardPressed,
      ]}
    >
      <View
        style={[
          styles.notificationIcon,
          { backgroundColor: item.backgroundColor },
        ]}
      >
        <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
      </View>

      <View style={styles.notificationDetails}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.message}</Text>
        <Text style={styles.notificationTime}>{getNotificationTime(item)}</Text>
      </View>

      <View style={styles.notificationRight}>
        {unread && <View style={styles.unreadDot} />}
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </Pressable>
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
    backgroundColor: colors.gold,
  },

  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8E7',
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
    color: colors.gold,
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
    backgroundColor: 'rgba(212,147,18,0.55)',
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
    color: '#DCFCE7',
    backgroundColor: 'rgba(22,163,74,0.72)',
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

  txMeta: {
    flex: 1,
    minWidth: 0,
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
    maxWidth: 112,
  },

  txAmount: {
    color: '#101827',
    fontSize: 14,
    fontWeight: '900',
  },

  txAmountCredit: {
    color: colors.green,
  },

  txAmountFailed: {
    color: '#B4232D',
  },

  txStatus: {
    color: colors.green,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 7,
    textTransform: 'uppercase',
  },

  txStatusFailed: {
    color: '#B4232D',
    backgroundColor: '#FDECEC',
  },

  receiptCard: {
    width: '90%',
    maxWidth: 380,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    ...shadow,
    shadowOpacity: 0.22,
    shadowRadius: 22,
  },

  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },

  receiptBrand: {
    color: colors.maroon,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  receiptTitle: {
    color: '#101827',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },

  receiptClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  receiptBody: {
    padding: 18,
  },

  receiptSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1F6',
    padding: 15,
  },

  receiptType: {
    color: '#8AA0BF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  receiptAmount: {
    color: '#101827',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 4,
  },

  receiptAmountCredit: {
    color: colors.green,
  },

  receiptAmountFailed: {
    color: '#B4232D',
  },

  receiptStatus: {
    color: colors.greenDark,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  receiptStatusFailed: {
    color: '#B4232D',
    backgroundColor: '#FDECEC',
  },

  receiptDetails: {
    marginTop: 14,
    gap: 2,
  },

  receiptDescription: {
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#EDF1F6',
  },

  receiptDescriptionText: {
    color: '#536987',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    fontWeight: '700',
  },

  receiptActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  receiptDownloadButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7CCD1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  receiptDownloadText: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  receiptDoneButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.maroon,
  },

  receiptDoneText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  empty: {
    color: '#8AA0BF',
    textAlign: 'center',
    padding: 20,
    fontWeight: '800',
  },

  pageTitle: {
    color: colors.navy,
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
    color: '#D9E2F1',
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
    color: '#D9E2F1',
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
    color: '#DCFCE7',
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
    backgroundColor: colors.gold,
  },

  walletButton: {
    minHeight: 48,
  },

  walletButtonQr: {
    minHeight: 48,
    backgroundColor: colors.green,
  },

  walletButtonNfc: {
    minHeight: 48,
    backgroundColor: colors.teal,
  },

  walletActionTextLight: {
    color: '#fff',
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
    color: colors.green,
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
    color: colors.green,
  },

  profileContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 176,
  },

  profileSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 22,
    ...shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },

  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.maroon,
  },

  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  profileSummaryText: {
    flex: 1,
    minWidth: 0,
  },

  profileName: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '900',
  },

  profileCardNumber: {
    color: '#7186A5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },

  profileActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  profileActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },

  profileActiveText: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  profileInactiveBadge: {
    backgroundColor: '#F1F5F9',
  },

  profileInactiveDot: {
    backgroundColor: '#64748B',
  },

  profileInactiveText: {
    color: '#475569',
  },

  profileSection: {
    marginBottom: 20,
  },

  profileSectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },

  profileSectionCard: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    backgroundColor: '#FFFFFF',
    ...shadow,
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },

  profileSettingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },

  profileRowPressed: {
    backgroundColor: '#F8FAFC',
  },

  profileSettingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F3',
  },

  profileRowText: {
    flex: 1,
    minWidth: 0,
  },

  profileRowTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '900',
  },

  profileRowSubtitle: {
    color: '#7186A5',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 4,
  },

  profileRowDivider: {
    height: 1,
    marginLeft: 67,
    backgroundColor: '#EDF1F6',
  },

  profileStatePill: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  profileStatePillEnabled: {
    backgroundColor: '#DCFCE7',
  },

  profileStateText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  profileStateTextEnabled: {
    color: colors.greenDark,
  },

  profileLogoutRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1BFC5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  profileLogoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },

  profileLogoutTitle: {
    color: '#B4232D',
    fontSize: 13,
    fontWeight: '900',
  },

  profileFooter: {
    alignItems: 'center',
    marginTop: 24,
  },

  profileFooterText: {
    color: '#7186A5',
    fontSize: 10,
    fontWeight: '800',
  },

  profileFooterVersion: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
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
    backgroundColor: colors.green,
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

  transactionSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    ...shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },

  transactionSearchInput: {
    flex: 1,
    minHeight: 46,
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },

  filterChipRow: {
    gap: 9,
    paddingBottom: 16,
  },

  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  filterChipActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },

  filterChipText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },

  filterChipTextActive: {
    color: '#fff',
  },

  transactionDateGroup: {
    marginTop: 6,
  },

  transactionDateTitle: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 2,
  },

  transactionStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EDF1F6',
    ...shadow,
    shadowOpacity: 0.05,
  },

  transactionStateTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },

  transactionStateText: {
    color: '#7186A5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },

  transactionRetryButton: {
    marginTop: 14,
    borderRadius: 13,
    backgroundColor: colors.maroon,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },

  transactionRetryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  transactionSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 17,
    padding: 13,
    marginBottom: 12,
    minHeight: 78,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },

  transactionSkeletonIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#EEF2F7',
  },

  transactionSkeletonBody: {
    flex: 1,
    gap: 9,
  },

  transactionSkeletonLineWide: {
    width: '62%',
    height: 11,
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
  },

  transactionSkeletonLine: {
    width: '42%',
    height: 9,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
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

  notificationContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 165,
  },

  notificationFilterRow: {
    gap: 9,
    paddingBottom: 18,
  },

  notificationDateGroup: {
    marginTop: 6,
  },

  notificationCardPressed: {
    opacity: 0.82,
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

  notificationDetails: {
    flex: 1,
  },

  notificationRight: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
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

  notificationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF1F6',
    padding: 24,
    marginTop: 8,
    ...shadow,
    shadowOpacity: 0.05,
  },

  notificationEmptyTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 11,
  },

  notificationEmptyText: {
    color: '#7186A5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
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

  messageQuickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginLeft: 34,
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

  profileChatFloat: {
    right: 22,
    bottom: 106,
    width: 50,
    height: 50,
    borderRadius: 16,
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
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
    ...shadow,
    shadowColor: colors.green,
    shadowOpacity: 0.25,
  },

  scanNavLabel: {
    position: 'absolute',
    bottom: 7,
    left: '50%',
    marginLeft: -15,
    color: colors.green,
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
    backgroundColor: colors.green,
  },

  qrReadyText: {
    color: colors.greenDark,
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

  qrSuccessBox: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8FFF6',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BDEFD8',
  },

  qrSuccessTitle: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  qrSuccessText: {
    color: '#1C2A44',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  qrErrorText: {
    color: colors.maroon,
    backgroundColor: '#FFF1F3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
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

  supportTicketInput: {
    borderWidth: 1,
    borderColor: '#DDE5EF',
    borderRadius: 12,
    backgroundColor: '#fff',
    color: '#1C2A44',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  supportTicketSubmit: {
    alignItems: 'center',
    backgroundColor: colors.maroon,
    borderRadius: 12,
    paddingVertical: 13,
  },

  supportTicketSubmitText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
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

  privacyNoticeRow: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7CCD1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  privacyNoticeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  privacyNoticeText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: '900',
  },
});
