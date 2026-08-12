import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';

import api from '../api/api';
import Button from '../components/Button';
import { captureMobileEvent } from '../analytics/posthog';
import { colors, shadow } from '../theme';

export default function ReportLostCardScreen({ navigation }) {
  const posthog = usePostHog();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Email required', 'Enter a valid email address for support updates.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.post('/card/report-lost', { email: email.trim() });
      setTicketNumber(response.data?.data?.ticketNumber || 'Created');
      captureMobileEvent(posthog, 'mobile_lost_card_reported');
    } catch (error) {
      Alert.alert('Unable to freeze card', error.response?.data?.message || 'Please call Premier support immediately.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}><Feather name="arrow-left" size={21} color="#fff" /></Pressable>
        <MaterialCommunityIcons name="shield-alert-outline" size={40} color="#fff" />
        <Text style={styles.title}>Report lost card</Text>
      </View>
      <View style={styles.content}>
        {ticketNumber ? (
          <View style={styles.success}>
            <MaterialCommunityIcons name="shield-check" size={38} color="#166534" />
            <Text style={styles.successTitle}>Your card is frozen</Text>
            <Text style={styles.copy}>Ticket reference: {ticketNumber}</Text>
            <Text style={styles.copy}>We will email you when the issue is resolved or your replacement is ready. Visit the office with a valid ID for replacement.</Text>
            <Button onPress={() => navigation.navigate('Dashboard')} style={styles.primary}>Back to dashboard</Button>
          </View>
        ) : (
          <>
            <View style={styles.warning}>
              <MaterialCommunityIcons name="alert" size={22} color="#92400E" />
              <Text style={styles.warningText}>This immediately stops your RFID card from being used for fares. It cannot be reversed here.</Text>
            </View>
            <Text style={styles.copy}>You already verified your identity with Google Authenticator. Enter the email where you want support updates.</Text>
            <Text style={styles.label}>Email for support updates</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#7B8794" style={styles.input} />
            <Button loading={submitting} disabled={!email.trim()} onPress={submit} style={styles.danger}>Confirm and freeze my card</Button>
            <Pressable onPress={() => navigation.goBack()}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { alignItems: 'center', backgroundColor: '#9F1239', paddingHorizontal: 24, paddingVertical: 30 },
  back: { position: 'absolute', left: 20, top: 25, padding: 8 },
  title: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 10 },
  content: { flex: 1, padding: 22, justifyContent: 'center', gap: 16 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14 },
  warningText: { flex: 1, color: '#78350F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  copy: { color: '#475569', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  label: { color: '#334155', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 13, backgroundColor: '#fff', color: '#0F172A', fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 },
  danger: { backgroundColor: '#B91C1C', borderRadius: 14, minHeight: 54, ...shadow, shadowColor: '#B91C1C', shadowOpacity: 0.2 },
  cancel: { color: colors.maroon, textAlign: 'center', fontWeight: '900', padding: 10 },
  success: { alignItems: 'center', gap: 16, backgroundColor: '#fff', borderRadius: 18, padding: 24, ...shadow, shadowOpacity: 0.08 },
  successTitle: { color: '#166534', fontSize: 24, fontWeight: '900' },
  primary: { width: '100%', borderRadius: 14, minHeight: 54 },
});
