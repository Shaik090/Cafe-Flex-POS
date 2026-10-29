import { PersistedPosState } from '../types';

export const BACKUP_FORMAT = 'cafe-flex-pos-backup';
export const BACKUP_VERSION = 1;

export type PosBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  appVersion: string;
  shopName: string;
  data: PersistedPosState;
};

const arrays = ['menuItems', 'cart', 'heldOrders', 'sales', 'expenses', 'expenseCategories', 'stockItems', 'stockMovements', 'purchases', 'suppliers', 'supplierPayments', 'tables', 'openOrders', 'kitchenTickets', 'staff', 'shifts', 'taxRates'] as const;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizePersistedPosState(value: unknown, strict = false): PersistedPosState {
  if (!isObject(value)) throw new Error('Backup data must be an object.');
  if (value.version !== 1) throw new Error('Unsupported POS data version.');
  for (const key of arrays.slice(0, 4)) if (strict && !Array.isArray(value[key])) throw new Error(`Backup is missing ${key}.`);
  if (strict && value.shop !== null && !isObject(value.shop)) throw new Error('Backup has an invalid shop profile.');
  const state: Record<string, unknown> = { version: 1, shop: isObject(value.shop) ? value.shop : null };
  arrays.slice(0, 4).forEach((key) => { state[key] = Array.isArray(value[key]) ? value[key] : []; });
  arrays.slice(4).forEach((key) => { state[key] = Array.isArray(value[key]) ? value[key] : []; });
  state.activeOpenOrderId = typeof value.activeOpenOrderId === 'string' ? value.activeOpenOrderId : null;
  state.activeServiceMode = value.activeServiceMode === 'dine-in' || value.activeServiceMode === 'takeaway' ? value.activeServiceMode : 'quick';
  state.nextTokenNumber = typeof value.nextTokenNumber === 'number' && value.nextTokenNumber > 0 ? value.nextTokenNumber : 1;
  state.kitchenDraftOrderId = typeof value.kitchenDraftOrderId === 'string' ? value.kitchenDraftOrderId : undefined;
  return state as PersistedPosState;
}

export function createBackup(data: PersistedPosState, appVersion = '0.3.0', createdAt = new Date().toISOString()): PosBackup {
  const normalized = normalizePersistedPosState(data, true);
  const { deviceId: _deviceId, deviceName: _deviceName, deviceMode: _deviceMode, staffDeviceRole: _staffDeviceRole, ...businessShop } = normalized.shop ?? {};
  const backupData: PersistedPosState = { ...normalized, shop: normalized.shop ? businessShop as PersistedPosState['shop'] : null };
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, appVersion, shopName: normalized.shop?.name ?? 'Cafe Flex POS', data: backupData };
}

export function parseBackup(raw: string): PosBackup {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('This backup file is not valid JSON.'); }
  if (!isObject(value) || value.format !== BACKUP_FORMAT) throw new Error('This is not a Cafe Flex POS backup file.');
  if (value.version !== BACKUP_VERSION) throw new Error('This backup version is not supported.');
  if (typeof value.createdAt !== 'string' || !Number.isFinite(new Date(value.createdAt).getTime())) throw new Error('Backup date is invalid.');
  const data = normalizePersistedPosState(value.data, true);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: value.createdAt, appVersion: typeof value.appVersion === 'string' ? value.appVersion : 'Unknown', shopName: typeof value.shopName === 'string' ? value.shopName : data.shop?.name ?? 'Cafe Flex POS', data };
}

export function backupPreview(backup: PosBackup) {
  return { shopName: backup.shopName, createdAt: backup.createdAt, sales: backup.data.sales.length, expenses: backup.data.expenses?.length ?? 0, stockItems: backup.data.stockItems?.length ?? 0, purchases: backup.data.purchases?.length ?? 0 };
}

export function backupFilename(shopName: string, createdAt = new Date()): string {
  const safe = (shopName || 'CafeFlexPOS').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'CafeFlexPOS';
  const date = createdAt.toISOString().slice(0, 10);
  return `CafeFlexPOS-${safe}-${date}.json`;
}

