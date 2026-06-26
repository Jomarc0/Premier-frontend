import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors, shadow } from '../theme';

export default function BiometricUnlockScreen() {
  const { unlockWithBiometrics, logout } = useAuth();

  const handleUnlock = async () => {
    try {
      await unlockWithBiometrics();
    } catch (error) {
      Alert.alert('Unlock failed', error.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/image/premier-logo.png')} style={styles.logo} />
        </View>
        <Text style={styles.title}>Premier Transport Corporation</Text>
        <Text style={styles.subtitle}>Secure mobile session</Text>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="fingerprint" size={48} color={colors.maroon} />
        </View>
        <Text style={styles.copy}>Use your fingerprint or Face ID to unlock your saved passenger session.</Text>
        <Button onPress={handleUnlock} icon={<MaterialCommunityIcons name="lock-open-outline" size={18} color="#fff" />}>
          Unlock App
        </Button>
        <Button variant="ghost" onPress={logout}>
          Use Card Login Instead
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'stretch',
    ...shadow,
  },
  logoWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logo: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  title: {
    color: colors.maroon,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.yellow,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 3,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FAE7E9',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 24,
  },
  copy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
});
