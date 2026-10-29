import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppShell } from './src/components/AppShell';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { PurchasesScreen } from './src/screens/PurchasesScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { StockScreen } from './src/screens/StockScreen';
import { SuppliersScreen } from './src/screens/SuppliersScreen';
import { TablesScreen } from './src/screens/TablesScreen';
import { KitchenScreen } from './src/screens/KitchenScreen';
import { StaffScreen } from './src/screens/StaffScreen';
import { StaffLoginScreen } from './src/screens/StaffLoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { MenuManagementScreen } from './src/screens/MenuManagementScreen';
import { QuickSaleScreen } from './src/screens/QuickSaleScreen';
import { SalesHistoryScreen } from './src/screens/SalesHistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ShopSetupScreen } from './src/screens/ShopSetupScreen';
import { usePosState } from './src/store/usePosState';
import { AppScreen, ConnectionStatus } from './src/types';
import { colors } from './src/theme';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { localNetworkService } from './src/services/localNetworkService';
import { operationalSnapshot } from './src/utils/operationalSync';
import { resolveStaffDeviceScreen } from './src/components/navigationItems';

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>('Dashboard');
  const pos = usePosState();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const announcedSales = useRef(new Set<string>());
  useEffect(() => {
    if (!pos.shop) return;
    localNetworkService.configureOperationalBridge({
      getMainSnapshot: () => operationalSnapshot({ shop: { name: pos.shop!.name, serviceModes: pos.shop!.serviceModes, enableTables: pos.shop!.enableTables, enableTokens: pos.shop!.enableTokens, enableKitchen: pos.shop!.enableKitchen, enableTax: pos.shop!.enableTax, taxSettings: pos.shop!.taxSettings }, menuItems: pos.menuItems, tables: pos.tables, openOrders: pos.openOrders, kitchenTickets: pos.kitchenTickets, staff: pos.staff }),
      onMainCommand: pos.handleOperationalCommand,
      onStaffEvent: (event) => pos.applyOperationalEvent({ type: event.type, payload: event.payload as Record<string, unknown> }),
    });
    if (pos.shop.deviceMode === 'staff-device') void localNetworkService.hydratePendingCommands();
    return () => localNetworkService.configureOperationalBridge(undefined);
  }, [pos.shop, pos.menuItems, pos.tables, pos.openOrders, pos.kitchenTickets, pos.staff, pos.handleOperationalCommand, pos.applyOperationalEvent]);
  useEffect(() => {
    if (pos.shop?.deviceMode !== 'main-pos') return;
    pos.sales.filter(sale => sale.status === 'Paid' && sale.openOrderId).forEach(sale => { if (announcedSales.current.has(sale.id)) return; announcedSales.current.add(sale.id); localNetworkService.broadcastOperationalEvent('ORDER_PAID', { orderId: sale.openOrderId, paidAt: sale.createdAt, tableId: sale.tableId }); });
  }, [pos.sales, pos.shop?.deviceMode]);
  useEffect(() => localNetworkService.subscribe(snapshot => setConnectionStatus(snapshot.staffAssociation?.connectionStatus ?? 'disconnected')), []);
  useEffect(() => { if (screen === 'Tables' && !(pos.shop?.enableTables ?? pos.shop?.modules.tables)) setScreen('Dashboard'); if (screen === 'Kitchen' && !(pos.shop?.enableKitchen ?? pos.shop?.modules.kitchen)) setScreen('Dashboard'); }, [screen, pos.shop?.enableTables, pos.shop?.modules.tables, pos.shop?.enableKitchen, pos.shop?.modules.kitchen]);
  if (!pos.hydrated) return <SafeAreaProvider><View style={styles.loading}><StatusBar style="dark" /><ActivityIndicator size="large" color={colors.primary} /></View></SafeAreaProvider>;
  if (pos.startupError) return <SafeAreaProvider><View style={styles.recovery}><StatusBar style="dark" /><Text style={styles.recoveryTitle}>Local data needs recovery</Text><Text style={styles.recoveryMessage}>{pos.startupError}</Text><Pressable onPress={pos.retryHydration} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View></SafeAreaProvider>;
  if (!pos.shop?.setupComplete) return <SafeAreaProvider><StatusBar style="dark" /><ShopSetupScreen onComplete={pos.completeShopSetup} /></SafeAreaProvider>;
  if ((pos.shop.enableStaffMode || pos.shop.deviceMode === 'staff-device') && pos.staff.length > 0 && !pos.currentStaff) return <SafeAreaProvider><StatusBar style="dark" /><StaffLoginScreen pos={pos} /></SafeAreaProvider>;
  const staffDeviceRole = pos.shop.deviceMode === 'staff-device' ? pos.shop.staffDeviceRole : undefined;
  const visibleScreen = staffDeviceRole ? resolveStaffDeviceScreen(screen, { tablesEnabled: pos.shop.enableTables ?? pos.shop.modules.tables, kitchenEnabled: pos.shop.enableKitchen ?? pos.shop.modules.kitchen, staffRole: pos.currentStaff?.role, deviceRole: staffDeviceRole }) : screen;
  const content = visibleScreen === 'Dashboard' ? <DashboardScreen pos={pos} onNavigate={setScreen} /> : visibleScreen === 'Quick Sale' ? <QuickSaleScreen pos={pos} /> : visibleScreen === 'Menu' ? <MenuManagementScreen pos={pos} /> : visibleScreen === 'Sales History' ? <SalesHistoryScreen pos={pos} /> : visibleScreen === 'More' ? <MoreScreen onNavigate={setScreen} tablesEnabled={pos.shop.enableTables ?? pos.shop.modules.tables} kitchenEnabled={pos.shop.enableKitchen ?? pos.shop.modules.kitchen} staffRole={pos.currentStaff?.role} staffDeviceRole={staffDeviceRole} /> : visibleScreen === 'Expenses' ? <ExpensesScreen pos={pos} /> : visibleScreen === 'Purchases' ? <PurchasesScreen pos={pos} /> : visibleScreen === 'Stock' ? <StockScreen pos={pos} /> : visibleScreen === 'Reports' ? <ReportsScreen pos={pos} /> : visibleScreen === 'Suppliers' ? <SuppliersScreen pos={pos} /> : visibleScreen === 'Tables' ? <TablesScreen pos={pos} onOpen={() => setScreen('Quick Sale')} /> : visibleScreen === 'Kitchen' ? <KitchenScreen pos={pos} /> : visibleScreen === 'Staff' ? <StaffScreen pos={pos} /> : <SettingsScreen pos={pos} />;
  return <SafeAreaProvider><StatusBar style="dark" /><AppShell screen={visibleScreen} onNavigate={setScreen} shopName={pos.shop.name} tablesEnabled={pos.shop.enableTables ?? pos.shop.modules.tables} kitchenEnabled={pos.shop.enableKitchen ?? pos.shop.modules.kitchen} staffEnabled={pos.shop.enableStaffMode ?? false} onLock={pos.lockStaff} staffRole={pos.currentStaff?.role} staffDeviceRole={staffDeviceRole} connectionStatus={staffDeviceRole ? connectionStatus : undefined}>{pos.persistenceError ? <View style={styles.persistNotice}><Text style={styles.persistNoticeText}>{pos.persistenceError}</Text></View> : null}{content}</AppShell></SafeAreaProvider>;
}

export default function App() { return <AppErrorBoundary><AppContent /></AppErrorBoundary>; }
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, recovery: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: colors.background }, recoveryTitle: { color: colors.text, fontSize: 21, fontWeight: '900' }, recoveryMessage: { color: colors.textMuted, textAlign: 'center', lineHeight: 21 }, retry: { minHeight: 46, minWidth: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary }, retryText: { color: '#fff', fontWeight: '900' }, persistNotice: { margin: 12, padding: 10, borderRadius: 10, backgroundColor: colors.dangerSoft }, persistNoticeText: { color: colors.danger, fontWeight: '800', textAlign: 'center' } });
