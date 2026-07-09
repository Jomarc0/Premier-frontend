import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadow } from '../theme';

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.routeArcOne} />
      <View style={styles.routeArcTwo} />
      <View style={styles.cityLeft}>
        <View style={[styles.tower, styles.towerTiny]} />
        <View style={[styles.tower, styles.towerTall]} />
        <View style={[styles.tower, styles.towerMid]} />
        <View style={[styles.tower, styles.towerShort]} />
      </View>
      <MaterialCommunityIcons name="map-marker" size={34} color="#C99418" style={styles.pinLeft} />
      <MaterialCommunityIcons name="map-marker" size={38} color="#C99418" style={styles.pinRight} />

      <View style={styles.content}>
        <View style={styles.logoCard}>
          <Image source={require('../../assets/image/logo-premier.png')} style={styles.logo} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.titleMaroon}>Premier</Text>
          <Text style={styles.titleGold}>Transport</Text>
        </View>

        <View style={styles.ruleRow}>
          <View style={styles.rule} />
          <MaterialCommunityIcons name="shield-check-outline" size={24} color="#C99418" />
          <View style={styles.rule} />
        </View>

        <Text style={styles.tagline}>Safe Travel For Everyone</Text>

        <View style={styles.systemPill}>
          <MaterialCommunityIcons name="shield-check-outline" size={30} color={colors.maroon} />
          <Text style={styles.systemText}>RFID Smart Fare System</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]} onPress={() => navigation.navigate('Login')}>
          <Feather name="log-in" size={27} color="#D5A21A" />
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>

        <View style={styles.footerRuleRow}>
          <View style={styles.footerRule} />
          <MaterialCommunityIcons name="shield-check-outline" size={24} color="#C99418" />
          <View style={styles.footerRule} />
        </View>

        <Text style={styles.copyright}>© 2026 Premier Transport Corp.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  routeArcOne: {
    position: 'absolute',
    right: -170,
    bottom: 88,
    width: 560,
    height: 560,
    borderRadius: 280,
    borderWidth: 2,
    borderColor: 'rgba(201, 148, 24, 0.10)',
  },
  routeArcTwo: {
    position: 'absolute',
    right: -235,
    bottom: 32,
    width: 700,
    height: 700,
    borderRadius: 350,
    borderWidth: 2,
    borderColor: 'rgba(201, 148, 24, 0.08)',
  },
  cityLeft: {
    position: 'absolute',
    left: 0,
    bottom: 132,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    opacity: 0.12,
  },
  tower: {
    width: 32,
    backgroundColor: '#B58B28',
  },
  towerTiny: { height: 86 },
  towerTall: { height: 154 },
  towerMid: { height: 106 },
  towerShort: { height: 64 },
  pinLeft: {
    position: 'absolute',
    left: 45,
    bottom: 198,
  },
  pinRight: {
    position: 'absolute',
    right: 38,
    top: 224,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 70,
  },
  logoCard: {
    width: 176,
    height: 176,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 72,
    ...shadow,
    shadowColor: '#A0A7B2',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  logo: {
    width: 136,
    height: 136,
    resizeMode: 'contain',
    borderRadius: 68,
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleMaroon: {
    color: colors.maroon,
    fontSize: 39,
    lineHeight: 42,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  titleGold: {
    color: '#C99418',
    fontSize: 39,
    lineHeight: 42,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    width: '88%',
    marginTop: 18,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: '#C99418',
  },
  tagline: {
    color: colors.maroon,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginTop: 27,
    textAlign: 'center',
  },
  systemPill: {
    width: '86%',
    minHeight: 62,
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: colors.maroon,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginTop: 48,
  },
  systemText: {
    color: colors.maroon,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  signInButton: {
    width: '100%',
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    ...shadow,
    shadowColor: colors.maroon,
    shadowOpacity: 0.25,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  footerRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    width: '78%',
    marginTop: 28,
  },
  footerRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201, 148, 24, 0.28)',
  },
  copyright: {
    color: '#5F626A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 18,
    textAlign: 'center',
  },
});




