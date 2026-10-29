import { DeviceMode, ShopProfile, StaffDeviceRole } from '../types';

type InstallationIdentity = Pick<ShopProfile, 'deviceId' | 'deviceMode' | 'deviceName' | 'staffDeviceRole'>;

function randomPart() {
  return Math.random().toString(36).slice(2, 12);
}

/** App-owned IDs intentionally use no hardware, account, or Bluetooth identifiers. */
export function createLocalId(prefix: 'shop' | 'device') {
  return `${prefix}-${Date.now().toString(36)}-${randomPart()}${randomPart()}`;
}

export function normalizeDeviceMode(value: unknown): DeviceMode {
  return value === 'main-pos' || value === 'staff-device' ? value : 'single';
}

export function normalizeStaffDeviceRole(value: unknown): StaffDeviceRole | undefined {
  return value === 'waiter' || value === 'kitchen' || value === 'cashier' ? value : undefined;
}

export function ensureShopIdentity(shop: ShopProfile | null, currentInstallation?: InstallationIdentity): ShopProfile | null {
  if (!shop) return null;
  const deviceId = currentInstallation?.deviceId || shop.deviceId || createLocalId('device');
  const deviceMode = normalizeDeviceMode(currentInstallation?.deviceMode ?? shop.deviceMode);
  const deviceName = currentInstallation?.deviceName?.trim() || shop.deviceName?.trim() || 'POS Device';
  const staffDeviceRole = normalizeStaffDeviceRole(currentInstallation?.staffDeviceRole ?? shop.staffDeviceRole);
  return { ...shop, shopId: shop.shopId || createLocalId('shop'), deviceId, deviceMode, deviceName, ...(staffDeviceRole ? { staffDeviceRole } : {}) };
}

export function installationIdentity(shop: ShopProfile | null): InstallationIdentity | undefined {
  if (!shop?.deviceId) return undefined;
  return { deviceId: shop.deviceId, deviceMode: normalizeDeviceMode(shop.deviceMode), deviceName: shop.deviceName || 'POS Device', staffDeviceRole: normalizeStaffDeviceRole(shop.staffDeviceRole) };
}
