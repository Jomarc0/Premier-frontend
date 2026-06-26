import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../api/api';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme';

const QUICK_AMOUNTS = [20, 40, 50, 100, 200, 500];
const QUICK_REPLIES = ['Top-up issue', 'Fare deduction', 'Payment failed', 'Lost RFID card', 'Check balance'];
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
        <MaterialCommunityIcons name={isCredit ? 'cellphone' : 'map-marker-outline'} size={17} color={isCredit ? '#00A86B' : colors.maroon} />
      </View>
      <View style={styles.txMeta}>
        <Text style={styles.txTitle}>{isCredit ? 'Top-Up Load' : 'Fare Payment'}</Text>
        <Text style={styles.txId}>ID: {transactionId(tx)}</Text>
        <Text style={styles.txDate}>{formatDate(tx.createdAt)} {isCredit ? 'via Wallet' : ''}</Text>
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

export default function DashboardScreen() {
  const { passenger, logout, biometricEnabled, enableBiometrics, disableBiometrics } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [pendingPayment, setPendingPayment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('GCASH');
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
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
  const currentBalance = useMemo(() => Number(balance?.balance || 0), [balance]);
  const rawPassengerName = passenger?.name || balance?.fullName || balance?.name || 'Passenger';
  const passengerName = String(rawPassengerName).replace(/\s*#\d+$/, '').trim() || 'Passenger';
  const spent = transactions.filter((tx) => tx.type !== 'TOPUP').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const loaded = transactions.filter((tx) => tx.type === 'TOPUP').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const notificationCount = transactions.length + (currentBalance > 0 && currentBalance < 100 ? 1 : 0);

  const fetchData = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        api.get('/balance'),
        api.get('/transactions?page=0&size=8'),
      ]);

      setBalance(balRes.data.data);
      setTransactions(txRes.data.data?.content || []);
    } catch (error) {
      Alert.alert('Unable to load dashboard', error.response?.data?.message || 'Check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAllTransactions = async () => {
    try {
      const response = await api.get('/transactions?page=0&size=50');
      setAllTransactions(response.data.data?.content || []);
      setActiveTab('Transactions');
    } catch (error) {
      Alert.alert('Failed to load transactions', error.response?.data?.message || 'Please try again.');
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
        Alert.alert('No transactions', 'There are no transactions available to download.');
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
        ...rows.map((tx) => [
          tx.id,
          tx.referenceNumber,
          tx.type,
          tx.status,
          tx.amount,
          tx.balanceBefore,
          tx.balanceAfter,
          tx.createdAt,
          tx.description,
        ].map(csvEscape).join(',')),
      ].join('\n');

      const fileName = `premier-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'text/csv',
          );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(destinationUri, csv, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          Alert.alert('Transactions downloaded', `${fileName} was saved to the folder you selected.`);
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
      Alert.alert('Download failed', error.message || 'Please try again.');
    }
  };

  const handleTopUp = async () => {
    const amount = selectedAmount || Number(customAmount);

    if (!amount || amount < 20) {
      Alert.alert('Invalid amount', 'Please select or enter a valid amount. Minimum is PHP 20.');
      return;
    }

    if (pendingPayment) {
      Alert.alert('Pending payment', 'Complete or cancel your current pending payment first.');
      return;
    }

    setTopupLoading(true);

    try {
      const response = await api.post('/topup/initiate', {
        amount,
        paymentMethod: selectedPaymentMethod,
      });
      const { checkoutUrl, referenceNumber, topUpId } = response.data.data || {};

      setPendingPayment({ referenceNumber, amount, topUpId, paymentMethod: selectedPaymentMethod });

      if (checkoutUrl) {
        await WebBrowser.openBrowserAsync(checkoutUrl);
      }
    } catch (error) {
      Alert.alert('Top-up failed', error.response?.data?.message || 'Please try again.');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!pendingPayment) return;

    setVerifying(true);

    try {
      const response = await api.post(`/topup/verify/${pendingPayment.referenceNumber}`);
      const { newBalance, amount } = response.data.data || {};

      Alert.alert('Payment verified', `PHP ${formatCurrency(amount)} added. New balance: PHP ${formatCurrency(newBalance)}`);
      setPendingPayment(null);
      setSelectedAmount(100);
      setCustomAmount('');
      fetchData();
    } catch (error) {
      Alert.alert('Payment not completed yet', error.response?.data?.message || 'Please try again after paying.');
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
      Alert.alert('QR unavailable', error.response?.data?.message || 'Please try again.');
      setQrOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleNfcPayment = async () => {
    Alert.alert(
      'Confirm NFC fare payment',
      'This will deduct the fixed fare from your passenger wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Fare',
          onPress: async () => {
            try {
              const response = await api.post('/fare/nfc', {});
              const data = response.data.data;
              Alert.alert('Fare paid', `PHP ${formatCurrency(data.deductedFare)} deducted. Remaining balance: PHP ${formatCurrency(data.remainingBalance)}`);
              fetchData();
            } catch (error) {
              Alert.alert('NFC payment failed', error.response?.data?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const confirmLogout = () => {
    Alert.alert('Logout', 'Do you want to logout from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const sendChat = async (text = chatInput) => {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    setChatInput('');
    setMessages((current) => [...current, { from: 'user', text: trimmed, timestamp: new Date().toISOString() }]);
    setChatLoading(true);

    try {
      const response = await api.post('/chat/message', {
        message: trimmed,
        sessionId: chatSessionId.current,
      });
      const payload = response.data?.data || response.data;
      setMessages((current) => [
        ...current,
        { from: 'bot', text: payload.reply || 'I received your message.', timestamp: new Date().toISOString() },
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
        Alert.alert('Biometrics disabled', 'OTP will be required after logout or session expiry.');
      } else {
        await enableBiometrics();
        Alert.alert('Biometrics enabled', 'You can unlock this device with fingerprint or Face ID.');
      }
    } catch (error) {
      Alert.alert('Settings update failed', error.message || 'Please try again.');
    }
  };

  const renderHome = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.homeHeader}>
        <Image source={require('../../assets/image/logo.png')} style={styles.headerLogo} />
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Premier Transport</Text>
          <Text style={styles.headerSubtitle}>RFID Smart Fare System</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={() => setActiveTab('Notifications')}>
            <Feather name="bell" size={20} color={colors.maroon} />
            {notificationCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
          <Pressable style={styles.headerButton} onPress={confirmLogout}>
            <Feather name="log-out" size={20} color={colors.maroon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.securePill}>
        <Feather name="shield" size={14} color="#D49312" />
        <Text style={styles.secureText}>Secure Session Active</Text>
      </View>

      <View style={styles.balancePanel}>
        <View style={styles.balanceBusMark}>
          <MaterialCommunityIcons name="bus-side" size={58} color="rgba(255,255,255,0.08)" />
        </View>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.heroBalance}>PHP {formatCurrency(currentBalance)}</Text>}
        <View style={styles.balanceDivider} />
        <View style={styles.cardMiniRow}>
          <View>
            <Text style={styles.cardMiniLabel}>RFID Card</Text>
            <Text style={styles.cardMini}>{maskCardNumber(balance?.cardNumber).replace('Card ', '')}</Text>
          </View>
          <Feather name="credit-card" size={20} color="#F4B8BE" />
          <Text style={styles.activeBadge}>Active</Text>
        </View>
      </View>

      <View style={styles.quickPanel}>
        <ActionButton color="#E2AA22" icon="wallet-plus-outline" label="Top Up" onPress={() => setActiveTab('TopUp')} />
        <ActionButton color={colors.maroon} icon="history" label="Transactions" onPress={fetchAllTransactions} />
        <ActionButton color="#1C2A44" icon="credit-card-outline" label="My Card" onPress={() => setActiveTab('Wallet')} />
        <ActionButton color="#246A21" icon="qrcode" label="Pay QR" onPress={generateFareQr} />
        <ActionButton color="#0F766E" icon="nfc" label="NFC Pay" onPress={handleNfcPayment} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <Pressable onPress={fetchAllTransactions}><Text style={styles.seeAll}>See All</Text></Pressable>
      </View>
      {(transactions.length ? transactions.slice(0, 3) : []).map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
      {!transactions.length && <Text style={styles.empty}>No recent activity yet.</Text>}
    </ScrollView>
  );

  const renderWallet = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>My Wallet</Text>
      <Text style={styles.pageSub}>Manage your Premier Transit balance</Text>
      <View style={styles.cardArt}>
        <View style={styles.cardArtTop}>
          <Text style={styles.cardArtSmall}>Premier Transit Card</Text>
          <MaterialCommunityIcons name="bus" size={28} color={colors.yellow} />
        </View>
        <Text style={styles.cardArtName}>{passengerName}</Text>
        <Text style={styles.cardArtNumber}>{displayCardNumber(balance?.cardNumber)}</Text>
        <Text style={styles.cardArtLabel}>Balance</Text>
        <Text style={styles.cardArtBalance}>PHP {formatCurrency(currentBalance)}</Text>
        <Text style={styles.cardArtActive}>Active</Text>
      </View>
      <View style={styles.walletActions}>
        <Button variant="secondary" style={styles.walletButtonGold} onPress={() => setActiveTab('TopUp')} icon={<MaterialCommunityIcons name="wallet-plus-outline" size={17} color={colors.maroon} />}>Top Up</Button>
        <Button variant="ghost" style={styles.walletButton} onPress={generateFareQr} icon={<MaterialCommunityIcons name="qrcode" size={17} color={colors.maroon} />}>Pay</Button>
        <Button variant="ghost" style={styles.walletButton} onPress={handleNfcPayment} icon={<MaterialCommunityIcons name="nfc" size={17} color={colors.maroon} />}>NFC</Button>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}><Text style={styles.statLabel}>Spent This Month</Text><Text style={styles.statRed}>PHP {formatCurrency(spent)}</Text><Text style={styles.statSub}>fare taps</Text></View>
        <View style={styles.statCard}><Text style={styles.statLabel}>Loaded This Month</Text><Text style={styles.statGreen}>PHP {formatCurrency(loaded)}</Text><Text style={styles.statSub}>top-ups</Text></View>
      </View>
      <View style={styles.infoCard}>
        <InfoRow label="Assigned Card Number" value={balance?.cardNumber || '-'} />
        <InfoRow label="Current Ledger Reserve" value={`PHP ${formatCurrency(currentBalance)}`} green />
      </View>
    </ScrollView>
  );

  const renderTopUp = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <BackTitle title="Top Up Card" subtitle="Recharge your RFID balance" onBack={() => setActiveTab('Wallet')} />
      <View style={styles.topupCard}>
        <Text style={styles.topupCardNo}>{maskCardNumber(balance?.cardNumber)}</Text>
        <View><Text style={styles.topupBalanceLabel}>Balance</Text><Text style={styles.topupBalance}>PHP {formatCurrency(currentBalance)}</Text></View>
      </View>
      <Text style={styles.formLabel}>Select Preset Load Amount</Text>
      <View style={styles.amountGrid}>
        {QUICK_AMOUNTS.map((amount) => (
          <Pressable key={amount} onPress={() => { setSelectedAmount(amount); setCustomAmount(''); }} style={[styles.amountChip, selectedAmount === amount && styles.amountChipActive]}>
            <Text style={[styles.amountText, selectedAmount === amount && styles.amountTextActive]}>PHP</Text>
            <Text style={[styles.amountNumber, selectedAmount === amount && styles.amountTextActive]}>{amount}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.formLabel}>Or Custom Amount</Text>
      <View style={styles.customAmount}>
        <Text style={styles.customPeso}>PHP</Text>
        <TextInput value={customAmount} onChangeText={(value) => { setCustomAmount(value.replace(/[^0-9.]/g, '')); setSelectedAmount(null); }} keyboardType="decimal-pad" placeholder="100.00" style={styles.customInput} />
        <Text style={styles.minText}>min PHP 20.00</Text>
      </View>
      <Text style={styles.formLabel}>Payment Method</Text>
      <View style={styles.paymentGrid}>
        {PAYMENT_OPTIONS.map((option) => {
          const active = selectedPaymentMethod === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSelectedPaymentMethod(option.id)}
              style={[styles.paymentOption, active && styles.paymentOptionActive]}
            >
              <Image source={option.logo} style={styles.paymentLogo} />
              <View style={styles.paymentTextBlock}>
                <Text style={styles.paymentName}>{option.name}</Text>
                <Text style={styles.paymentDetail}>{option.detail}</Text>
              </View>
              <View style={[styles.paymentRadio, active && styles.paymentRadioActive]}>
                {active && <Feather name="check" size={12} color="#fff" />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Button loading={topupLoading} onPress={handleTopUp} style={styles.stickyButton}>Load Amount</Button>
      {pendingPayment && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Pending {pendingPayment.paymentMethod || 'payment'} payment: {pendingPayment.referenceNumber}</Text>
          <Button variant="secondary" loading={verifying} onPress={handleCheckPayment}>I Already Paid</Button>
          <Button variant="ghost" onPress={() => setPendingPayment(null)}>Cancel Transaction</Button>
        </View>
      )}
    </ScrollView>
  );

  const renderTransactions = () => {
    const data = allTransactions.length ? allTransactions : transactions;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <BackTitle title="Transactions" subtitle="Full ledger history" onBack={() => setActiveTab('Home')} rightText="Download" onRightPress={downloadTransactions} />
        <View style={styles.totalGrid}>
          <View style={[styles.totalCard, styles.totalIn]}><MaterialCommunityIcons name="cellphone" size={20} color="#D6FFF0" /><Text style={styles.totalLabel}>Total In</Text><Text style={styles.totalValue}>+PHP {formatCurrency(loaded)}</Text></View>
          <View style={[styles.totalCard, styles.totalOut]}><MaterialCommunityIcons name="map-marker-outline" size={20} color="#FFE5EA" /><Text style={styles.totalLabel}>Total Out</Text><Text style={styles.totalValue}>-PHP {formatCurrency(spent)}</Text></View>
        </View>
        {data.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
        {!data.length && <Text style={styles.empty}>No transactions found.</Text>}
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
    const balanceAlert = currentBalance > 0 && currentBalance < 100
      ? [{
        id: 'low-balance',
        icon: 'lightning-bolt',
        title: 'Low balance reminder',
        body: `Your current balance is PHP ${formatCurrency(currentBalance)}.`,
        time: 'Now',
        gold: true,
      }]
      : [];
    const alerts = [...balanceAlert, ...transactionAlerts];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <BackTitle title="Notifications" subtitle={`${alerts.length} alerts`} onBack={() => setActiveTab('Home')} />
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
        {!alerts.length && <Text style={styles.empty}>No notifications yet.</Text>}
      </ScrollView>
    );
  };

  const renderChat = () => (
    <View style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable style={styles.chatBack} onPress={() => setActiveTab('Home')}><Feather name="arrow-left" size={22} color="#fff" /></Pressable>
        <View style={styles.botAvatar}><MaterialCommunityIcons name="robot-outline" size={25} color={colors.maroon} /><View style={styles.onlineDot} /></View>
        <View style={styles.chatHeadText}><Text style={styles.chatName}>Premier Bot</Text><Text style={styles.chatOnline}>Online - Always here to help</Text></View>
        <Feather name="headphones" size={20} color="#F4B8BE" />
      </View>
      <ScrollView contentContainerStyle={styles.chatMessages}>
        <Text style={styles.today}>Today</Text>
        {messages.map((message, index) => {
          const isUser = message.from === 'user';
          return (
            <View key={`${message.timestamp}-${index}`} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
              {!isUser && <View style={styles.smallBot}><MaterialCommunityIcons name="robot-outline" size={14} color="#fff" /></View>}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.text}</Text>
                <Text style={[styles.bubbleTime, isUser && styles.userBubbleText]}>{formatDate(message.timestamp)}</Text>
              </View>
            </View>
          );
        })}
        {chatLoading && <Text style={styles.typing}>Premier Bot is typing...</Text>}
        <View style={styles.quickReplies}>{QUICK_REPLIES.map((reply) => <Pressable key={reply} onPress={() => sendChat(reply)} style={styles.quickReply}><Text style={styles.quickReplyText}>{reply}</Text></Pressable>)}</View>
      </ScrollView>
      <View style={styles.chatInputRow}>
        <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Message Premier Bot..." placeholderTextColor="#8AA0BF" style={styles.chatInput} />
        <Pressable onPress={() => sendChat()} disabled={!chatInput.trim() || chatLoading} style={styles.sendButton}><Feather name="send" size={18} color="#fff" /></Pressable>
      </View>
      <Text style={styles.secured}>Secured by Premier Transit</Text>
    </View>
  );

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Profile</Text>
      <Text style={styles.pageSub}>Passenger account settings</Text>
      <View style={styles.infoCard}>
        <InfoRow label="Card Number" value={balance?.cardNumber || '-'} />
        <InfoRow label="Biometric Login" value={biometricEnabled ? 'Enabled' : 'Disabled'} green={biometricEnabled} />
      </View>
      <Button onPress={toggleBiometrics}>{biometricEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}</Button>
      <Button variant="ghost" onPress={confirmLogout}>Logout</Button>
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
      {!['Chat', 'TopUp', 'Transactions', 'Notifications'].includes(activeTab) && (
        <>
          <Pressable style={styles.chatFloat} onPress={() => setActiveTab('Chat')}>
            <MaterialCommunityIcons name="robot-outline" size={21} color="#fff" />
          </Pressable>
          <View style={styles.bottomNav}>
            <NavItem icon="home-outline" label="Home" active={activeTab === 'Home'} onPress={() => setActiveTab('Home')} />
            <NavItem icon="wallet-outline" label="Wallet" active={activeTab === 'Wallet'} onPress={() => setActiveTab('Wallet')} />
            <Pressable style={styles.plusButton} onPress={generateFareQr}>
              <MaterialCommunityIcons name="qrcode-scan" size={21} color="#fff" />
            </Pressable>
            <Text style={styles.scanNavLabel}>Scan</Text>
            <NavItem icon="history" label="Activity" active={activeTab === 'Transactions'} onPress={fetchAllTransactions} />
            <NavItem icon="account-outline" label="Profile" active={activeTab === 'Profile'} onPress={() => setActiveTab('Profile')} />
          </View>
        </>
      )}

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <View style={styles.centerModalBackdrop}>
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <MaterialCommunityIcons name="qrcode" size={22} color={colors.yellow} />
              <Text style={styles.qrTitle}>Pay Fare QR</Text>
              <Pressable onPress={() => setQrOpen(false)}><Feather name="x" size={22} color="#fff" /></Pressable>
            </View>
            <View style={styles.qrBody}>
              {qrLoading ? (
                <>
                  <ActivityIndicator size="large" color={colors.maroon} />
                  <Text style={styles.qrHelp}>Generating secure fare QR...</Text>
                </>
              ) : qrData?.payload ? (
                <>
                  <View style={styles.qrBox}><QRCode value={qrData.payload} size={220} /></View>
                  <Text style={styles.qrCardNumber}>Card No. {qrData.cardNumber}</Text>
                  <Text style={styles.qrHelp}>Show this to the conductor. It expires in {qrData.expiresInSeconds} seconds and can only be used once.</Text>
                  <Button variant="secondary" onPress={generateFareQr}>Refresh QR</Button>
                </>
              ) : <Text style={styles.empty}>QR unavailable.</Text>}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({ color, icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.actionItem}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}><MaterialCommunityIcons name={icon} size={19} color="#fff" /></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function NavItem({ icon, label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.navItem}>
      <MaterialCommunityIcons name={icon} size={19} color={active ? colors.maroon : '#8AA0BF'} />
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
}

function BackTitle({ title, subtitle, onBack, rightIcon, rightText, onRightPress }) {
  return (
    <View style={styles.backTitle}>
      <Pressable onPress={onBack} style={styles.backCircle}><Feather name="arrow-left" size={20} color="#536987" /></Pressable>
      <View style={styles.backTitleText}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSub}>{subtitle}</Text></View>
      {rightIcon && <View style={styles.backCircle}><Feather name={rightIcon} size={18} color={colors.maroon} /></View>}
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
      <Text style={[styles.infoValue, green && styles.infoGreen]}>{value}</Text>
    </View>
  );
}

function NotificationCard({ icon, title, body, time, unread, green, gold, blue }) {
  const color = green ? '#00A86B' : gold ? '#D49312' : blue ? '#2563EB' : colors.maroon;
  return (
    <View style={[styles.notificationCard, unread && styles.notificationUnread]}>
      <View style={[styles.notificationIcon, { backgroundColor: `${color}12` }]}><MaterialCommunityIcons name={icon} size={22} color={color} /></View>
      <View style={{ flex: 1 }}><Text style={styles.notificationTitle}>{title}</Text><Text style={styles.notificationBody}>{body}</Text><Text style={styles.notificationTime}>{time}</Text></View>
      {unread && <View style={styles.unreadDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F6F9FD' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  headerLogo: { width: 44, height: 44, borderRadius: 11, resizeMode: 'contain' },
  headerTitleBlock: { flex: 1 },
  headerTitle: { color: colors.maroon, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  headerSubtitle: { color: '#53616F', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 5 },
  headerActions: { flexDirection: 'row', gap: 9 },
  headerButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.08, shadowRadius: 10 },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.yellow },
  securePill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#F8E9EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginBottom: 20 },
  secureText: { color: colors.maroon, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  balancePanel: { backgroundColor: colors.maroon, borderRadius: 20, padding: 22, minHeight: 190, overflow: 'hidden', ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.22 },
  balanceBusMark: { position: 'absolute', right: 16, top: 18 },
  balanceLabel: { color: colors.yellow, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  heroBalance: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 22 },
  balanceDivider: { height: 1, backgroundColor: 'rgba(250,204,21,0.55)', marginVertical: 20 },
  cardMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardMiniLabel: { color: '#C9A1A6', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  cardMini: { color: '#fff', fontSize: 14, fontWeight: '900', flex: 1 },
  activeBadge: { color: '#4ADE80', backgroundColor: 'rgba(20,83,45,0.7)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', overflow: 'hidden' },
  quickPanel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 30, backgroundColor: '#fff', borderRadius: 22, marginTop: 16, paddingVertical: 18, paddingHorizontal: 12, rowGap: 19, ...shadow, shadowOpacity: 0.08 },
  actionItem: { alignItems: 'center', gap: 8, width: 78 },
  actionIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: '#101827', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: '#101827', fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  sectionTitleSmall: { color: '#7186A5', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  seeAll: { color: colors.maroon, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 17, padding: 13, marginBottom: 12, minHeight: 78, ...shadow, shadowOpacity: 0.06, shadowRadius: 9 },
  txIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txIconCredit: { backgroundColor: '#E8FFF6' },
  txIconFare: { backgroundColor: '#FFF1F3' },
  txMeta: { flex: 1 },
  txTitle: { color: '#101827', fontSize: 15, fontWeight: '900' },
  txId: { color: colors.maroon, fontSize: 10, fontWeight: '900', marginTop: 3 },
  txDate: { color: '#7186A5', fontSize: 12, marginTop: 4 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { color: '#101827', fontSize: 14, fontWeight: '900' },
  txAmountCredit: { color: '#00A86B' },
  txStatus: { color: '#00A86B', fontSize: 10, fontWeight: '900', marginTop: 7, textTransform: 'uppercase' },
  empty: { color: '#8AA0BF', textAlign: 'center', padding: 20, fontWeight: '800' },
  pageTitle: { color: '#1C2A44', fontSize: 17, fontWeight: '900' },
  pageSub: { color: '#7186A5', fontSize: 11, marginTop: 4, marginBottom: 16 },
  cardArt: { backgroundColor: colors.maroon, borderRadius: 24, padding: 20, minHeight: 200, ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.23 },
  cardArtTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardArtSmall: { color: '#F4B8BE', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  cardArtName: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 8 },
  cardArtNumber: { color: '#fff', fontSize: 15, letterSpacing: 4, marginTop: 34, fontWeight: '800' },
  cardArtLabel: { color: '#F4B8BE', fontSize: 10, fontWeight: '900', marginTop: 25, textTransform: 'uppercase' },
  cardArtBalance: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 5 },
  cardArtActive: { position: 'absolute', right: 20, bottom: 20, color: '#4ADE80', backgroundColor: 'rgba(20,83,45,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  walletActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  walletButtonGold: { flex: 1, backgroundColor: '#E6B129' },
  walletButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE5EF', ...shadow, shadowOpacity: 0.06 },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 18 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 17, padding: 16, ...shadow, shadowOpacity: 0.05 },
  statLabel: { color: '#8AA0BF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statRed: { color: colors.maroon, fontSize: 15, fontWeight: '900', marginTop: 9 },
  statGreen: { color: '#00A86B', fontSize: 15, fontWeight: '900', marginTop: 9 },
  statSub: { color: '#7186A5', fontSize: 11, marginTop: 5 },
  infoCard: { backgroundColor: '#fff', borderRadius: 17, paddingHorizontal: 16, marginTop: 18, ...shadow, shadowOpacity: 0.05 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingVertical: 15 },
  infoLabel: { color: '#7186A5', fontSize: 12, fontWeight: '800' },
  infoValue: { color: '#1C2A44', fontSize: 12, fontWeight: '900' },
  infoGreen: { color: '#00A86B', backgroundColor: '#E8FFF6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  backTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backCircle: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.05 },
  backTitleText: { flex: 1 },
  markAll: { color: colors.maroon, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  topupCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.maroon, borderRadius: 18, padding: 20, marginBottom: 24 },
  topupCardNo: { color: '#fff', fontSize: 13, fontWeight: '900' },
  topupBalanceLabel: { color: '#F4B8BE', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'right' },
  topupBalance: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 5 },
  formLabel: { color: '#536987', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginBottom: 20 },
  amountChip: { width: '30.5%', minHeight: 74, backgroundColor: '#fff', borderRadius: 17, alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.05 },
  amountChipActive: { backgroundColor: colors.maroon, borderWidth: 2, borderColor: colors.yellow },
  amountText: { color: '#8AA0BF', fontSize: 11, fontWeight: '900' },
  amountNumber: { color: '#1C2A44', fontSize: 14, fontWeight: '900', marginTop: 5 },
  amountTextActive: { color: '#fff' },
  customAmount: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#DDE5EF', paddingHorizontal: 16, minHeight: 58, marginBottom: 24, ...shadow, shadowOpacity: 0.05 },
  customPeso: { color: '#8AA0BF', fontSize: 14, fontWeight: '900' },
  customInput: { flex: 1, color: '#1C2A44', fontSize: 15, fontWeight: '900' },
  minText: { color: '#9BAAC0', fontSize: 11, fontStyle: 'italic' },
  paymentGrid: { gap: 10, marginBottom: 20 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E4EBF4', padding: 12, minHeight: 66, ...shadow, shadowOpacity: 0.04 },
  paymentOptionActive: { borderColor: colors.maroon, borderWidth: 1.5, backgroundColor: '#FFF8F9' },
  paymentLogo: { width: 42, height: 42, borderRadius: 12, resizeMode: 'contain', backgroundColor: '#fff' },
  paymentTextBlock: { flex: 1 },
  paymentName: { color: '#101827', fontSize: 13, fontWeight: '900' },
  paymentDetail: { color: '#7186A5', fontSize: 11, marginTop: 3 },
  paymentRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#C9D5E4', alignItems: 'center', justifyContent: 'center' },
  paymentRadioActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  stickyButton: { marginTop: 14 },
  pendingBox: { backgroundColor: '#FFF8E8', borderRadius: 16, padding: 14, marginTop: 16, gap: 8 },
  pendingTitle: { color: '#7A5200', fontWeight: '900', textAlign: 'center' },
  totalGrid: { flexDirection: 'row', gap: 12 },
  totalCard: { flex: 1, borderRadius: 14, padding: 16, minHeight: 104 },
  totalIn: { backgroundColor: '#08B878' },
  totalOut: { backgroundColor: colors.maroon },
  totalLabel: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 14 },
  totalValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 7 },
  notificationCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 17, padding: 15, marginBottom: 10, ...shadow, shadowOpacity: 0.05 },
  notificationUnread: { borderWidth: 1, borderColor: '#F4C7CE' },
  notificationIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  notificationTitle: { color: '#1C2A44', fontSize: 14, fontWeight: '900' },
  notificationBody: { color: '#536987', fontSize: 12, lineHeight: 18, marginTop: 5 },
  notificationTime: { color: '#8AA0BF', fontSize: 10, fontWeight: '800', marginTop: 7 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C22D43', marginTop: 4 },
  chatScreen: { flex: 1, backgroundColor: '#F6F9FD', paddingTop: 36 },
  chatHeader: { backgroundColor: colors.maroon, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatBack: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  botAvatar: { width: 43, height: 43, borderRadius: 22, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00D084' },
  chatHeadText: { flex: 1 },
  chatName: { color: '#fff', fontSize: 15, fontWeight: '900' },
  chatOnline: { color: '#FFE69A', fontSize: 11, marginTop: 2 },
  chatMessages: { padding: 18, gap: 14, paddingBottom: 20 },
  today: { color: '#8AA0BF', textAlign: 'center', fontSize: 10, textTransform: 'uppercase' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  smallBot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: 14, ...shadow, shadowOpacity: 0.05 },
  botBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 5 },
  userBubble: { backgroundColor: colors.maroon, borderBottomRightRadius: 5 },
  bubbleText: { color: '#354963', fontSize: 13, lineHeight: 22 },
  userBubbleText: { color: '#fff' },
  bubbleTime: { color: '#8AA0BF', fontSize: 10, marginTop: 8 },
  typing: { color: '#8AA0BF', fontSize: 11, fontWeight: '800' },
  quickReplies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickReply: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0B8BF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  quickReplyText: { color: colors.maroon, fontSize: 12, fontWeight: '800' },
  chatInputRow: { flexDirection: 'row', gap: 10, backgroundColor: '#EEF3F9', borderRadius: 24, marginHorizontal: 16, padding: 8, alignItems: 'center' },
  chatInput: { flex: 1, color: '#1C2A44', paddingHorizontal: 10, fontWeight: '700' },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  secured: { color: '#8AA0BF', textAlign: 'center', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginVertical: 12 },
  chatFloat: { position: 'absolute', right: 18, bottom: 108, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.28, zIndex: 20 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#EDF2F7', ...shadow, shadowOpacity: 0.08 },
  navItem: { alignItems: 'center', gap: 4, width: 76 },
  navText: { color: '#8AA0BF', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  navTextActive: { color: colors.maroon },
  plusButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#E6B129', alignItems: 'center', justifyContent: 'center', marginTop: -29, borderWidth: 5, borderColor: '#fff', ...shadow, shadowColor: '#B87900', shadowOpacity: 0.3 },
  scanNavLabel: { position: 'absolute', bottom: 9, alignSelf: 'center', color: '#334155', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  centerModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  qrCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', ...shadow },
  qrHeader: { backgroundColor: colors.maroon, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrTitle: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  qrBody: { padding: 20, alignItems: 'center', gap: 14 },
  qrBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE5EF', borderRadius: 18, padding: 16 },
  qrCardNumber: { color: colors.maroon, fontWeight: '900', fontSize: 13 },
  qrHelp: { color: '#536987', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
