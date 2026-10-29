import { ReactNode, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BrandMark } from './BrandMark';
import { AppScreen, ConnectionStatus, StaffDeviceRole, StaffRole } from '../types';
import { cardShadow, colors } from '../theme';
import { getPrimaryNavigation, getSecondaryNavigation, NavItem } from './navigationItems';

type Props = {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  shopName: string;
  tablesEnabled?: boolean;
  kitchenEnabled?: boolean;
  staffEnabled?: boolean;
  onLock?: () => void;
  staffRole?: StaffRole;
  staffDeviceRole?: StaffDeviceRole;
  connectionStatus?: ConnectionStatus;
  testWidth?: number;
  children: ReactNode;
};

export function AppShell({ screen, onNavigate, shopName, tablesEnabled = false, kitchenEnabled = false, staffEnabled = false, onLock, staffRole, staffDeviceRole, connectionStatus, testWidth, children }: Props) {
  const dimensions = useWindowDimensions();
  const tablet = (testWidth ?? dimensions.width) >= 760;
  const allowedPrimary = useMemo(() => getPrimaryNavigation(staffRole, staffDeviceRole), [staffRole, staffDeviceRole]);
  const allowedSecondary = useMemo(() => getSecondaryNavigation({ tablesEnabled, kitchenEnabled, staffRole, deviceRole: staffDeviceRole }), [tablesEnabled, kitchenEnabled, staffRole, staffDeviceRole]);
  const isMore = screen === 'More' || allowedSecondary.some((item) => item.screen === screen);

  if (tablet) {
    return <SafeAreaView style={styles.tabletRoot} edges={['top', 'bottom']}>
      <View style={styles.sidebar}>
        <View style={styles.shellBrand}><BrandMark size={26} /><View><Text style={styles.shopName} numberOfLines={1}>{shopName}</Text><Text style={styles.shopCaption}>Café Flex POS</Text></View></View>{connectionStatus ? <Text testID="staff-connection-status" style={styles.connection}>{connectionLabel(connectionStatus)}</Text> : null}{staffEnabled && onLock ? <Pressable onPress={onLock}><Text style={styles.lock}>Lock App</Text></Pressable> : null}
        <ScrollView contentContainerStyle={styles.sidebarItems}>
          {[...allowedPrimary, ...allowedSecondary].map((item) => <NavButton key={item.screen} item={item} active={screen === item.screen} onPress={() => onNavigate(item.screen)} sidebar />)}
        </ScrollView>
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.phoneRoot} edges={['top', 'bottom']}>
    <View style={styles.content}>{children}</View>
    <View style={styles.bottomBar}>
      {allowedPrimary.map((item) => <NavButton key={item.screen} item={item} active={screen === item.screen} onPress={() => onNavigate(item.screen)} />)}
      {allowedSecondary.length > 0 && <NavButton item={{ screen: 'More', label: 'More', icon: 'view-grid-outline' }} active={isMore} onPress={() => onNavigate('More')} />}
      {connectionStatus ? <Text testID="staff-connection-status" style={styles.connectionPhone}>{connectionLabel(connectionStatus)}</Text> : null}
    </View>
  </SafeAreaView>;
}

function connectionLabel(status: ConnectionStatus) {
  return status === 'connected' ? 'Connected' : status === 'pending-sync' ? 'Pending Sync' : status === 'reconnecting' || status === 'connecting' ? 'Reconnecting' : 'Disconnected';
}

function NavButton({ item, active, onPress, sidebar }: { item: NavItem; active: boolean; onPress: () => void; sidebar?: boolean }) {
  const testID = item.screen === 'More' ? 'bottom-more-navigation' : item.screen === 'Kitchen' ? 'kitchen-navigation-item' : undefined;
  return <Pressable testID={testID} accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.navButton, sidebar && styles.sidebarButton, active && styles.activeButton]}>
    <MaterialCommunityIcons name={item.icon as never} size={sidebar ? 21 : item.screen === 'Sales History' ? 25 : 23} style={[styles.icon, sidebar && styles.sidebarIcon]} color={active ? colors.primaryDark : colors.textMuted} />
    <Text style={[styles.navLabel, sidebar && styles.sidebarLabel, active && styles.activeText]}>{item.label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  phoneRoot: { flex: 1, backgroundColor: colors.background },
  tabletRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  content: { flex: 1, minWidth: 0 },
  sidebar: { width: 216, paddingHorizontal: 12, paddingTop: 16, backgroundColor: colors.surface, borderRightWidth: 1, borderColor: colors.border },
  shellBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  shopName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  lock: { color: colors.primaryDark, fontWeight: '900', marginTop: 8, paddingHorizontal: 8 },
  connection: { marginTop: 8, marginHorizontal: 8, color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  connectionPhone: { position: 'absolute', right: 8, top: 2, color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  shopCaption: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  sidebarItems: { gap: 5, paddingTop: 24, paddingBottom: 20 },
  bottomBar: { flexDirection: 'row', minHeight: 68, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 5, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, ...cardShadow },
  navButton: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, borderRadius: 14 },
  sidebarButton: { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 12, minHeight: 44 },
  activeButton: { backgroundColor: colors.primarySoft },
  icon: { width: 26, textAlign: 'center' },
  sidebarIcon: { width: 24, textAlign: 'center', fontSize: 20 },
  navLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  sidebarLabel: { fontSize: 14 },
  activeText: { color: colors.primaryDark },
});
