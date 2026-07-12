import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Button from './Button';
import { colors, shadow } from '../theme';

export default function PrivacyNoticeModal({ visible, onClose, requireAcceptance = false, onAccept }) {
  const handleAccept = () => {
    if (onAccept) {
      onAccept();
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={requireAcceptance ? () => {} : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Privacy Notice</Text>
            {!requireAcceptance && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Privacy Notice"
                hitSlop={12}
                onPress={onClose}
                style={styles.closeButton}
              >
                <Feather name="x" size={22} color={colors.maroon} />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.paragraph}>
              Premier Transport uses your RFID card number to verify your passenger account and allow access to your card balance, fare payment, and transaction features.
            </Text>
            <Text style={styles.paragraph}>
              For account security, the app may ask for a 6-digit code from Google Authenticator. The app does not collect your Google Authenticator password or personal Google account. The code is used only to confirm that you are the authorized card user.
            </Text>
            <Text style={styles.paragraph}>
              Your card number and authentication activity are used only for login, account protection, fare services, and system security.
            </Text>
            <Text style={[styles.paragraph, styles.lastParagraph]}>
              By continuing, you acknowledge that your information will be processed for these purposes in accordance with the Data Privacy Act of 2012.
            </Text>
          </ScrollView>

          <Button onPress={handleAccept} style={styles.understandButton}>
            I Understand
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 18, 24, 0.52)',
  },
  card: {
    width: '100%',
    maxHeight: '82%',
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 22,
    ...shadow,
    shadowOpacity: 0.2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: colors.maroon,
    fontSize: 22,
    fontWeight: '900',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F1',
  },
  scrollView: {
    flexGrow: 0,
  },
  body: {
    paddingBottom: 4,
  },
  paragraph: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  lastParagraph: {
    marginBottom: 0,
  },
  understandButton: {
    minHeight: 54,
    marginTop: 20,
    borderRadius: 15,
  },
});
