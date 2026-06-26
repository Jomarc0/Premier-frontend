import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const colors = {
  brand: '#8b1a1a',
  bg: '#f2f1ef',
  card: '#ffffff',
  border: '#e8e6e3',
  smBlue: '#3b82f6',
  smBlueBg: '#eff6ff',
  grandGreen: '#22c55e',
  grandGreenBg: '#f0fdf4',
  amber: '#f59e0b',
  textPrimary: '#1a1a1a',
  textMuted: '#aaaaaa',
  textFaint: '#cccccc',
};

const buses = {
  sm: [
    { id: 1, plate: 'BTE-7739', from: 'Grand Terminal', to: 'SM Terminal', distance: '4.7 km', eta: 9 },
  ],
  grand: [
    { id: 1, plate: 'DAR-5315', from: 'SM Terminal', to: 'Grand Terminal', distance: '18.1 km', eta: 36 },
  ],
};

const terminalConfig = {
  sm: {
    title: 'Incoming SM',
    panelTitle: 'Incoming to SM Terminal',
    terminalName: 'SM Terminal',
    color: colors.smBlue,
    bg: colors.smBlueBg,
  },
  grand: {
    title: 'Incoming Grand',
    panelTitle: 'Incoming to Grand Terminal',
    terminalName: 'Grand Terminal',
    color: colors.grandGreen,
    bg: colors.grandGreenBg,
  },
};

function timeAgo(date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function Navbar({ menuOpen, onToggleMenu, onLogout }) {
  return (
    <View style={styles.navbar}>
      <View style={styles.brandRow}>
        <View style={styles.busMark}>
          <Text style={styles.busMarkText}>Bus</Text>
        </View>
        <View>
          <Text style={styles.brandName}>Premier Transit</Text>
          <Text style={styles.brandSubtitle}>Staff portal</Text>
        </View>
      </View>

      <TouchableOpacity
        accessibilityLabel="Open staff menu"
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={onToggleMenu}
        style={styles.menuButton}
      >
        <Text style={styles.menuButtonText}>...</Text>
      </TouchableOpacity>

      {menuOpen ? (
        <View style={styles.menuDropdown}>
          <Text style={styles.menuText}>Logged in as staff</Text>
          <TouchableOpacity
            accessibilityLabel="Logout staff account"
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={onLogout}
            style={styles.logoutItem}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function LiveDot({ pulseAnim, color = colors.grandGreen }) {
  return (
    <Animated.View style={[styles.liveDot, { backgroundColor: color, opacity: pulseAnim }]} />
  );
}

function HeaderCard({ lastUpdate, pulseAnim, spinAnim, onRefresh }) {
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.headerCard}>
      <Text style={styles.eyebrow}>STAFF DASHBOARD</Text>
      <Text style={styles.pageTitle}>Bus queue monitor</Text>
      <View style={styles.liveRow}>
        <View style={styles.liveInfo}>
          <LiveDot pulseAnim={pulseAnim} />
          <Text style={styles.liveText}>Live - updated {timeAgo(lastUpdate)}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Refresh bus queue"
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={onRefresh}
          style={styles.refreshButton}
        >
          <Animated.Text style={[styles.refreshIcon, { transform: [{ rotate: spin }] }]}>R</Animated.Text>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatCard({ label, value, subtitle, color, bg }) {
  return (
    <TouchableOpacity
      accessibilityLabel={`${label}, ${value}, ${subtitle}`}
      accessibilityRole="button"
      activeOpacity={0.85}
      style={styles.statCard}
    >
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Text style={[styles.statIconText, { color }]}>Bus</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function TerminalTab({ active, count, config, onPress }) {
  return (
    <TouchableOpacity
      accessibilityLabel={`Show ${config.terminalName} queue`}
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.terminalTab,
        active && { borderColor: config.color, borderWidth: 2, backgroundColor: config.bg },
      ]}
    >
      <View style={styles.terminalTitleRow}>
        <View style={[styles.terminalDot, { backgroundColor: config.color }]} />
        <Text style={styles.terminalName}>{config.terminalName}</Text>
      </View>
      <View style={styles.countPill}>
        <Text style={styles.countPillText}>{count} bus</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatusBadge({ pulseAnim }) {
  return (
    <View style={styles.statusBadge}>
      <LiveDot pulseAnim={pulseAnim} color={colors.amber} />
      <Text style={styles.statusBadgeText}>On route</Text>
    </View>
  );
}

function BusCard({ bus, queueColor, pulseAnim }) {
  return (
    <View style={styles.busCard}>
      <View style={styles.busTopRow}>
        <View>
          <Text style={styles.queueNumber}>QUEUE #{bus.id}</Text>
          <Text style={styles.busPlate}>{bus.plate}</Text>
        </View>
        <StatusBadge pulseAnim={pulseAnim} />
      </View>

      <View style={styles.routeRow}>
        <Text style={[styles.routeText, { color: colors.brand }]}>{bus.from}</Text>
        <Text style={styles.routeArrow}>to</Text>
        <Text style={[styles.routeText, { color: queueColor }]}>{bus.to}</Text>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{bus.distance}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>ETA</Text>
          <Text style={[styles.etaValue, { color: queueColor }]}>{bus.eta}</Text>
          <Text style={styles.metricUnit}>minutes</Text>
        </View>
      </View>
    </View>
  );
}

function TerminalPanel({ activeTab, data, pulseAnim }) {
  const config = terminalConfig[activeTab];

  return (
    <View style={styles.panel}>
      <View style={styles.panelLabelRow}>
        <View style={[styles.terminalDot, { backgroundColor: config.color }]} />
        <Text style={styles.panelLabel}>{config.panelTitle}</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <BusCard bus={item} queueColor={config.color} pulseAnim={pulseAnim} />
        )}
      />
    </View>
  );
}

export default function StaffBusQueueScreen() {
  const [activeTab, setActiveTab] = useState('sm');
  const [menuOpen, setMenuOpen] = useState(false);
  const [smEta, setSmEta] = useState(buses.sm[0].eta);
  const [grandEta, setGrandEta] = useState(buses.grand[0].eta);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setSmEta((prev) => Math.max(0, prev - 1));
      setGrandEta((prev) => Math.max(0, prev - 1));
      setLastUpdate(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const displayBuses = useMemo(() => ({
    sm: [{ ...buses.sm[0], eta: smEta }],
    grand: [{ ...buses.grand[0], eta: grandEta }],
  }), [smEta, grandEta]);

  const handleRefresh = () => {
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(() => spinAnim.setValue(0));
    setLastUpdate(new Date());
  };

  const totalBuses = displayBuses.sm.length + displayBuses.grand.length;

  return (
    <View style={styles.screen}>
      <Navbar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onLogout={() => setMenuOpen(false)}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HeaderCard
          lastUpdate={lastUpdate}
          pulseAnim={pulseAnim}
          spinAnim={spinAnim}
          onRefresh={handleRefresh}
        />

        <View style={styles.statsRow}>
          <StatCard label="Total buses" value={totalBuses} subtitle="On route" color={colors.brand} bg="#f9e8e8" />
          <StatCard label="Incoming SM" value={displayBuses.sm.length} subtitle={`${smEta} min ETA`} color={colors.smBlue} bg={colors.smBlueBg} />
          <StatCard label="Incoming Grand" value={displayBuses.grand.length} subtitle={`${grandEta} min ETA`} color={colors.grandGreen} bg={colors.grandGreenBg} />
        </View>

        <View style={styles.tabsRow}>
          <TerminalTab
            active={activeTab === 'sm'}
            count={displayBuses.sm.length}
            config={terminalConfig.sm}
            onPress={() => setActiveTab('sm')}
          />
          <TerminalTab
            active={activeTab === 'grand'}
            count={displayBuses.grand.length}
            config={terminalConfig.grand}
            onPress={() => setActiveTab('grand')}
          />
        </View>

        <TerminalPanel activeTab={activeTab} data={displayBuses[activeTab]} pulseAnim={pulseAnim} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navbar: {
    minHeight: 86,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  busMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busMarkText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '800',
  },
  brandName: {
    color: colors.card,
    fontSize: 18,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#f5d8d8',
    fontSize: 14,
    marginTop: 2,
  },
  menuButton: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#741313',
  },
  menuButtonText: {
    color: colors.card,
    fontSize: 22,
    fontWeight: '800',
    marginTop: -8,
  },
  menuDropdown: {
    position: 'absolute',
    top: 68,
    right: 16,
    width: 190,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
    padding: 12,
  },
  menuText: {
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 8,
  },
  logoutItem: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#fff1f1',
    paddingHorizontal: 12,
  },
  logoutText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  liveRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  liveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  liveText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  refreshButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.brand,
    paddingHorizontal: 14,
  },
  refreshIcon: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 6,
  },
  refreshText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '800',
  },
  statsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minHeight: 116,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    elevation: 1,
  },
  statIcon: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  statSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  terminalTab: {
    flex: 1,
    minHeight: 90,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
  },
  terminalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  terminalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  terminalName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  countPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countPillText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  panel: {
    marginTop: 16,
  },
  panelLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  busCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },
  busTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  queueNumber: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  busPlate: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 4,
  },
  statusBadge: {
    minHeight: 32,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeText: {
    color: '#9a5a00',
    fontSize: 14,
    fontWeight: '800',
  },
  routeRow: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fafafa',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  routeArrow: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fafafa',
    padding: 12,
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  etaValue: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: 2,
  },
  metricUnit: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: -2,
  },
});
