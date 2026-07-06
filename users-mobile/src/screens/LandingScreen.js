import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadow } from '../theme';

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topGlow} />
      <View style={styles.centerGlow} />
      <View style={styles.roadArcOne} />
      <View style={styles.roadArcTwo} />
      <View style={styles.cityLeft}>
        <View style={[styles.tower, styles.towerTall]} />
        <View style={[styles.tower, styles.towerShort]} />
        <View style={[styles.tower, styles.towerMid]} />
      </View>
      <View style={styles.routePinLeft}>
        <MaterialCommunityIcons name="map-marker" size={38} color="#F5B820" />
      </View>
      <View style={styles.routePinRight}>
        <MaterialCommunityIcons name="map-marker" size={34} color="rgba(245, 184, 32, 0.72)" />
      </View>

      <View style={styles.content}>
        <Image source={require('../../assets/image/logo-premier.png')} style={styles.logo} />

        <View style={styles.titleBlock}>
          <Text style={styles.titleWhite}>Premier</Text>
          <Text style={styles.titleGold}>Transport</Text>
        </View>

        <View style={styles.ruleRow}>
          <View style={styles.rule} />
          <MaterialCommunityIcons name="shield-check-outline" size={19} color="#F5B820" />
          <View style={styles.rule} />
        </View>

        <Text style={styles.tagline}>Safe Travel For Everyone</Text>

        <View style={styles.pill}>
          <MaterialCommunityIcons name="shield-check-outline" size={21} color="#F5B820" />
          <Text style={styles.pillText}>RFID Smart Fare System</Text>
        </View>

        <View style={styles.busScene}>
          <View style={styles.busShadow} />
          <MaterialCommunityIcons name="bus-side" size={154} color="#541018" style={styles.busBack} />
          <MaterialCommunityIcons name="bus-side" size={148} color="#8B1A25" style={styles.busFront} />
          <View style={styles.headLightLeft} />
          <View style={styles.headLightRight} />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.signInButton} onPress={() => navigation.navigate('Login')}>
          <Feather name="log-in" size={22} color="#741015" />
          <Text style={styles.signInText}>Sign In</Text>
        </Pressable>

        <View style={styles.footerRuleRow}>
          <View style={styles.footerRule} />
          <MaterialCommunityIcons name="shield-check-outline" size={19} color="rgba(255,255,255,0.45)" />
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
    backgroundColor: '#200207',
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -180,
    alignSelf: 'center',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(151, 17, 33, 0.58)',
  },
  centerGlow: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: 'rgba(247, 90, 33, 0.16)',
  },
  roadArcOne: {
    position: 'absolute',
    right: -150,
    bottom: 155,
    width: 370,
    height: 370,
    borderRadius: 185,
    borderWidth: 2,
    borderColor: 'rgba(244, 176, 31, 0.18)',
  },
  roadArcTwo: {
    position: 'absolute',
    right: -205,
    bottom: 105,
    width: 485,
    height: 485,
    borderRadius: 242,
    borderWidth: 2,
    borderColor: 'rgba(244, 176, 31, 0.13)',
  },
  cityLeft: {
    position: 'absolute',
    left: 18,
    bottom: 190,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    opacity: 0.5,
  },
  tower: {
    width: 26,
    backgroundColor: '#3A070D',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 87, 91, 0.45)',
  },
  towerTall: { height: 160 },
  towerShort: { height: 92 },
  towerMid: { height: 124 },
  routePinLeft: {
    position: 'absolute',
    left: 40,
    bottom: 238,
  },
  routePinRight: {
    position: 'absolute',
    right: 38,
    top: 265,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 92,
  },
  logo: {
    width: 118,
    height: 118,
    borderRadius: 28,
    resizeMode: 'contain',
    marginBottom: 30,
    ...shadow,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 22,
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleWhite: {
    color: '#fff',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  titleGold: {
    color: '#F5B820',
    fontSize: 35,
    lineHeight: 40,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    width: '86%',
    marginTop: 14,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245, 184, 32, 0.62)',
  },
  tagline: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginTop: 12,
    textAlign: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(166, 24, 43, 0.86)',
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 30,
    minWidth: 290,
    justifyContent: 'center',
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  busScene: {
    width: '100%',
    height: 122,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busShadow: {
    position: 'absolute',
    bottom: 10,
    width: 210,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
  },
  busBack: {
    position: 'absolute',
    transform: [{ translateX: 5 }, { translateY: 5 }],
    opacity: 0.6,
  },
  busFront: {
    position: 'absolute',
    textShadowColor: 'rgba(255, 115, 58, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  headLightLeft: {
    position: 'absolute',
    bottom: 34,
    left: 94,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFD46B',
  },
  headLightRight: {
    position: 'absolute',
    bottom: 34,
    right: 94,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFD46B',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    alignItems: 'center',
  },
  signInButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#F5B820',
    borderWidth: 2,
    borderColor: '#FFE27A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    ...shadow,
    shadowColor: '#F5B820',
    shadowOpacity: 0.3,
  },
  signInText: {
    color: '#741015',
    fontSize: 19,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    width: '72%',
    marginTop: 30,
  },
  footerRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  copyright: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 22,
    textAlign: 'center',
  },
});
