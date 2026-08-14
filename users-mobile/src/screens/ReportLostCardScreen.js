import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ACCOUNT PROTECTION</Text>
          <Text style={styles.title}>Report lost card</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="shield-alert-outline" size={24} color="#FFD44A" />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {ticketNumber ? (
          <View style={styles.success}>
            <View style={styles.successIcon}><MaterialCommunityIcons name="shield-check" size={31} color="#087A55" /></View>
            <Text style={styles.successTitle}>Your card is frozen</Text>
            <Text style={styles.ticketReference}>Ticket reference: {ticketNumber}</Text>
            <Text style={styles.copy}>We will email you when the issue is resolved or your replacement is ready. Visit the office with a valid ID for replacement.</Text>
            <Button onPress={() => navigation.navigate('Dashboard')} style={styles.primary}>Back to dashboard</Button>
          </View>
        ) : (
          <View style={styles.formCard}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardIcon}><MaterialCommunityIcons name="shield-lock-outline" size={20} color={colors.maroon} /></View>
              <View><Text style={styles.cardEyebrow}>SECURE CARD ACTION</Text><Text style={styles.cardTitle}>Freeze lost RFID card</Text></View>
            </View>
            <View style={styles.warning}>
              <MaterialCommunityIcons name="alert" size={22} color="#92400E" />
              <Text style={styles.warningText}>This immediately stops your RFID card from being used for fares. It cannot be reversed here.</Text>
            </View>
            <Text style={styles.copy}>You already verified your identity with Google Authenticator. Enter the email where you want support updates.</Text>
            <Text style={styles.label}>Email for support updates</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#7B8794" style={styles.input} />
            <Button loading={submitting} disabled={!email.trim()} onPress={submit} style={styles.danger}>Confirm and freeze my card</Button>
            <Pressable onPress={() => navigation.goBack()} style={styles.cancelButton}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F7FC' },
  header: { minHeight: 104, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.maroon, paddingHorizontal: 20, paddingBottom: 18, paddingTop: 12 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.13)' },
  headerCopy: { flex: 1, marginLeft: 13 },
  eyebrow: { color: '#FFD44A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 3 },
  headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  content: { flexGrow: 1, padding: 18, paddingTop: 22, justifyContent: 'center' },
  formCard: { gap: 16, backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#E4EAF2', ...shadow, shadowOpacity: 0.07 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBECEF' },
  cardEyebrow: { color: '#9F1239', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  cardTitle: { color: '#1C2A44', fontSize: 17, fontWeight: '900', marginTop: 2 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#F5CF66', backgroundColor: '#FFF9E9', borderRadius: 15, padding: 14 },
  warningText: { flex: 1, color: '#78350F', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  copy: { color: '#536987', fontSize: 14, lineHeight: 21 },
  label: { color: '#334155', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 13, backgroundColor: '#fff', color: '#0F172A', fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 },
  danger: { backgroundColor: colors.maroon, borderRadius: 14, minHeight: 54, ...shadow, shadowColor: colors.maroon, shadowOpacity: 0.2 },
  cancelButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  cancel: { color: colors.maroon, textAlign: 'center', fontWeight: '900' },
  success: { alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#D9F2E8', ...shadow, shadowOpacity: 0.08 },
  successIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: '#EAFBF3' },
  successTitle: { color: '#087A55', fontSize: 23, fontWeight: '900' },
  ticketReference: { color: colors.maroon, fontSize: 13, fontWeight: '900' },
  primary: { width: '100%', borderRadius: 14, minHeight: 54 },
});
