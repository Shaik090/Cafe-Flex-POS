import { applyOperationalCommand, operationalSnapshot, OperationalAuthorityState } from '../src/utils/operationalSync';
import { SyncMessage } from '../src/types';

const shop = { name: 'Cafe', serviceModes: { quick: true, dineIn: true, takeaway: true }, enableTables: true, enableTokens: false, enableKitchen: true, enableTax: false, taxSettings: { pricingMode: 'exclusive' as const } };
const state = (): OperationalAuthorityState => ({
  shop,
  menuItems: [
    { id: 'tea', name: 'Tea', price: 10, category: 'Tea', available: true, sendToKitchen: false, modifiers: [] },
    { id: 'sandwich', name: 'Sandwich', price: 40, category: 'Snacks', available: true, sendToKitchen: true, modifiers: [] },
  ],
  tables: [{ id: 't4', name: 'Table 4', isActive: true, sortOrder: 1, createdAt: '2026-09-22T10:00:00.000Z' }],
  openOrders: [], kitchenTickets: [],
  staff: [{ id: 'rahim', name: 'Rahim', role: 'waiter', pinHash: 'hash', isActive: true, createdAt: '2026-09-01T00:00:00.000Z' }, { id: 'chef', name: 'Chef', role: 'kitchen', pinHash: 'hash', isActive: true, createdAt: '2026-09-01T00:00:00.000Z' }],
});
const command = (type: SyncMessage['type'], payload: Record<string, unknown>, messageId = 'cmd-1'): SyncMessage => ({ protocolVersion: 1, messageId, shopId: 'shop', sourceDeviceId: 'waiter-phone', sentAt: '2026-09-22T10:00:00.000Z', type, payload });

describe('authoritative operational order sync', () => {
  it('creates one attributed table order without a sale, stock, COGS, or tax side effect', () => {
    const source = state();
    const result = applyOperationalCommand(source, command('ORDER_CREATE_REQUEST', { staffId: 'rahim', serviceMode: 'dine-in', tableId: 't4', items: [] }), 'waiter');
    const order = result.payload.order as any;
    expect(result.eventType).toBe('ORDER_CREATED');
    expect(order).toEqual(expect.objectContaining({ id: 'open-order-cmd-1', tableName: 'Table 4', createdByStaffName: 'Rahim', revision: 1, items: [] }));
    expect(source.openOrders).toEqual([]);
  });

  it('uses Main POS menu prices, applies deltas, and rejects a stale table conflict', () => {
    const source = state();
    const created = applyOperationalCommand(source, command('ORDER_CREATE_REQUEST', { staffId: 'rahim', serviceMode: 'dine-in', tableId: 't4', items: [] }), 'waiter').payload.order as any;
    source.openOrders = [created];
    const updated = applyOperationalCommand(source, command('ORDER_UPDATE_REQUEST', { staffId: 'rahim', orderId: created.id, expectedRevision: 1, add: [{ menuItemId: 'tea', quantity: 2 }] }, 'cmd-2'), 'waiter').payload.order as any;
    expect(updated.items).toEqual([expect.objectContaining({ itemId: 'tea', quantity: 2, unitPrice: 10 })]);
    source.openOrders = [updated];
    const conflict = applyOperationalCommand(source, command('ORDER_UPDATE_REQUEST', { staffId: 'rahim', orderId: created.id, expectedRevision: 1, add: [{ menuItemId: 'tea', quantity: 1 }] }, 'cmd-3'), 'waiter');
    expect(conflict.eventType).toBe('ORDER_CONFLICT');
    expect(() => applyOperationalCommand(source, command('ORDER_CREATE_REQUEST', { staffId: 'rahim', serviceMode: 'dine-in', tableId: 't4', items: [] }, 'cmd-4'), 'waiter')).toThrow('already occupied');
  });

  it('creates only kitchen-enabled deltas and applies kitchen revisions', () => {
    const source = state();
    source.openOrders = [{ id: 'order-1', serviceMode: 'dine-in', tableId: 't4', tableName: 'Table 4', items: [{ key: 'tea:', itemId: 'tea', name: 'Tea', quantity: 1, unitPrice: 10, modifierNames: [] }, { key: 'sandwich:', itemId: 'sandwich', name: 'Sandwich', quantity: 2, unitPrice: 40, modifierNames: [] }], createdAt: 'x', updatedAt: 'x', revision: 2 }];
    const sent = applyOperationalCommand(source, command('ORDER_SEND_TO_KITCHEN_REQUEST', { staffId: 'rahim', orderId: 'order-1', expectedRevision: 2 }, 'cmd-5'), 'waiter');
    const ticket = sent.payload.ticket as any;
    expect(ticket.items).toEqual([expect.objectContaining({ itemId: 'sandwich', quantity: 2 })]);
    source.kitchenTickets = [ticket];
    const again = applyOperationalCommand(source, command('ORDER_SEND_TO_KITCHEN_REQUEST', { staffId: 'rahim', orderId: 'order-1', expectedRevision: 2 }, 'cmd-6'), 'waiter');
    expect(again.payload.alreadySent).toBe(true);
    const preparing = applyOperationalCommand(source, command('KITCHEN_STATUS_UPDATE_REQUEST', { staffId: 'chef', ticketId: ticket.id, expectedRevision: 1, status: 'preparing' }, 'cmd-7'), 'kitchen');
    expect((preparing.payload.ticket as any).status).toBe('preparing');
  });

  it('exposes a compact operational snapshot with no staff PIN data', () => {
    const snapshot = operationalSnapshot(state());
    expect(snapshot).toEqual(expect.objectContaining({ menuItems: expect.any(Array), tables: expect.any(Array), openOrders: expect.any(Array), kitchenTickets: expect.any(Array) }));
    expect(JSON.stringify(snapshot)).not.toContain('pinHash');
  });
});
