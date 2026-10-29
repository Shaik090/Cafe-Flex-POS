import { AppScreen, StaffDeviceRole, StaffRole } from '../types';
import { can } from '../utils/staff';

export type NavItem = { screen: AppScreen; label: string; icon: string; subtitle?: string };

export const primaryNavigation: NavItem[] = [
  { screen: 'Dashboard', label: 'Home', icon: 'home-variant-outline' },
  { screen: 'Quick Sale', label: 'Sale', icon: 'cart-outline' },
  { screen: 'Menu', label: 'Menu', icon: 'silverware-fork-knife' },
  { screen: 'Sales History', label: 'History', icon: 'receipt-text-clock-outline' },
];

const secondaryNavigation: NavItem[] = [
  { screen: 'Expenses', label: 'Expenses', icon: 'wallet-outline', subtitle: 'Track shop expenses' },
  { screen: 'Stock', label: 'Stock', icon: 'package-variant-closed', subtitle: 'Inventory and movements' },
  { screen: 'Purchases', label: 'Purchases', icon: 'bag-personal-outline', subtitle: 'Record supplier purchases' },
  { screen: 'Reports', label: 'Reports', icon: 'chart-bar', subtitle: 'Sales and business reports' },
  { screen: 'Suppliers', label: 'Suppliers', icon: 'truck-fast-outline', subtitle: 'Suppliers and credit balances' },
  { screen: 'Tables', label: 'Tables', icon: 'table-furniture', subtitle: 'Dine-in table management' },
  { screen: 'Kitchen', label: 'Kitchen', icon: 'chef-hat', subtitle: 'Kitchen order tickets' },
  { screen: 'Settings', label: 'Settings', icon: 'cog-outline', subtitle: 'Shop and app settings' },
];

type NavigationOptions = { tablesEnabled: boolean; kitchenEnabled: boolean; staffRole?: StaffRole; deviceRole?: StaffDeviceRole };

export function getSecondaryNavigation({ tablesEnabled, kitchenEnabled, staffRole, deviceRole }: NavigationOptions) {
  const visible = secondaryNavigation.filter((item) => (item.screen !== 'Tables' || tablesEnabled) && (item.screen !== 'Kitchen' || kitchenEnabled));
  // A Staff Device is an operational terminal. Its paired device role is a
  // capability ceiling and is intentionally stricter than a staff PIN role.
  if (deviceRole === 'waiter') return visible.filter(item => (item.screen === 'Tables' && !!tablesEnabled) || (item.screen === 'Kitchen' && !!kitchenEnabled && can(staffRole, 'kitchen')));
  if (deviceRole === 'kitchen') return [];
  if (deviceRole === 'cashier') return visible.filter(item => (item.screen === 'Tables' && !!tablesEnabled) || (item.screen === 'Kitchen' && !!kitchenEnabled && can(staffRole, 'kitchen')));
  if (!staffRole) return visible;
  return visible.filter((item) => (item.screen === 'Kitchen' ? can(staffRole, 'kitchen') : item.screen === 'Settings' ? can(staffRole, 'settings') : staffRole !== 'kitchen'));
}

export function getPrimaryNavigation(staffRole?: StaffRole, deviceRole?: StaffDeviceRole) {
  if (deviceRole === 'kitchen') return can(staffRole, 'kitchen') ? kitchenEnabledPrimary : [];
  if (deviceRole === 'waiter' || deviceRole === 'cashier') return can(staffRole, 'sales') ? primaryNavigation.filter(item => item.screen === 'Quick Sale') : [];
  return staffRole ? primaryNavigation.filter((item) => item.screen === 'Quick Sale' ? can(staffRole, 'sales') : staffRole !== 'kitchen') : primaryNavigation;
}

const kitchenEnabledPrimary: NavItem[] = [{ screen: 'Kitchen', label: 'Kitchen', icon: 'chef-hat' }];

export function allowedStaffDeviceScreens(options: NavigationOptions): AppScreen[] {
  const primary = getPrimaryNavigation(options.staffRole, options.deviceRole);
  const secondary = getSecondaryNavigation(options);
  return [...primary, ...secondary].map(item => item.screen);
}

/** Guard restored/deep screen state on a paired Staff Device. */
export function resolveStaffDeviceScreen(requested: AppScreen, options: NavigationOptions): AppScreen {
  const allowed = allowedStaffDeviceScreens(options);
  const hasMore = getSecondaryNavigation(options).length > 0;
  if ((requested === 'More' && hasMore) || allowed.includes(requested)) return requested;
  return options.deviceRole === 'kitchen' ? 'Kitchen' : 'Quick Sale';
}
