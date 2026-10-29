import { createBackup, normalizePersistedPosState } from '../src/utils/backup';
import { ensureShopIdentity, installationIdentity } from '../src/utils/deviceIdentity';
import { createMessageId, createSyncMessage, isValidSyncMessage, ProcessedMessageRegistry, SYNC_PROTOCOL_VERSION } from '../src/utils/syncProtocol';
import { OpenOrder, SaleRecord, ShopProfile } from '../src/types';

const legacyShop: ShopProfile = { name: 'Local Cafe', type: 'Tea Shop', phone: '', address: '', currency: 'INR', setupComplete: true, modules: { stock: false, expenses: true, customers: false, tables: false, kitchen: false, receiptPrinting: false } };
const state = { version: 1 as const, shop: legacyShop, menuItems: [], cart: [], heldOrders: [], sales: [] };

describe('local multi-device foundation', () => {
  it('migrates old persisted shops to stable single-device identities', () => {
    const normalized = normalizePersistedPosState(state);
    const identified = ensureShopIdentity(normalized.shop)!;
    const restarted = ensureShopIdentity(identified)!;
    expect(identified.deviceMode).toBe('single');
    expect(identified.shopId).toMatch(/^shop-/);
    expect(identified.deviceId).toMatch(/^device-/);
    expect(restarted.shopId).toBe(identified.shopId);
    expect(restarted.deviceId).toBe(identified.deviceId);
  });

  it('preserves Main POS and Staff Device mode data locally', () => {
    const main = ensureShopIdentity({ ...legacyShop, deviceMode: 'main-pos', deviceName: 'Counter POS' })!;
    const staff = ensureShopIdentity({ ...main, deviceMode: 'staff-device', staffDeviceRole: 'waiter' })!;
    expect(main.deviceMode).toBe('main-pos');
    expect(staff.deviceMode).toBe('staff-device');
    expect(staff.staffDeviceRole).toBe('waiter');
  });

  it('keeps installation identity out of a business backup and restore', () => {
    const source = ensureShopIdentity({ ...legacyShop, deviceMode: 'main-pos', deviceName: 'Counter POS' })!;
    const backup = createBackup({ ...state, shop: source });
    expect(backup.data.shop?.shopId).toBe(source.shopId);
    expect(backup.data.shop?.deviceId).toBeUndefined();
    expect(backup.data.shop?.deviceMode).toBeUndefined();
    const receiving = ensureShopIdentity({ ...legacyShop, deviceName: 'Waiter Phone' })!;
    const restored = ensureShopIdentity(backup.data.shop, installationIdentity(receiving))!;
    expect(restored.shopId).toBe(source.shopId);
    expect(restored.deviceId).toBe(receiving.deviceId);
    expect(restored.deviceName).toBe('Waiter Phone');
  });

  it('serializes valid versioned sync messages and guards duplicate commands', () => {
    const message = createSyncMessage({ shopId: 'shop-1', sourceDeviceId: 'device-1', type: 'ORDER_CREATED', payload: { orderId: 'order-1' } });
    expect(message.protocolVersion).toBe(SYNC_PROTOCOL_VERSION);
    expect(isValidSyncMessage(JSON.parse(JSON.stringify(message)))).toBe(true);
    expect(isValidSyncMessage({ ...message, protocolVersion: 999 })).toBe(false);
    expect(createMessageId()).not.toBe(createMessageId());
    const registry = new ProcessedMessageRegistry();
    expect(registry.remember(message.messageId)).toBe(true);
    expect(registry.has(message.messageId)).toBe(true);
    expect(registry.remember(message.messageId)).toBe(false);
  });

  it('supports optional device and staff origin metadata without rewriting history', () => {
    const order: OpenOrder = { id: 'order-1', serviceMode: 'dine-in', items: [], createdAt: '2026-09-22T10:00:00.000Z', updatedAt: '2026-09-22T10:00:00.000Z', originDeviceId: 'device-1', createdByStaffId: 'staff-1', createdByStaffName: 'Rahim' };
    const sale: SaleRecord = { id: 'sale-1', date: '22 Sep 2026', time: '10:00 am', createdAt: '2026-09-22T10:00:00.000Z', items: [], amount: 0, method: 'Cash', status: 'Paid', originDeviceId: order.originDeviceId, staffId: order.createdByStaffId, staffName: order.createdByStaffName };
    expect(sale.originDeviceId).toBe('device-1');
    expect(sale.staffName).toBe('Rahim');
  });
});
