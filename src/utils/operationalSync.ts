import { CartLine, KitchenTicket, MenuItem, OpenOrder, OperationalSnapshot, Staff, StaffDeviceRole, SyncMessage } from '../types';
import { can } from './staff';

export type OperationalCommandResult = { eventType: SyncMessage['type']; payload: Record<string, unknown>; snapshot?: OperationalSnapshot };
export type OperationalAuthorityState = { shop: OperationalSnapshot['shop']; menuItems: MenuItem[]; tables: OperationalSnapshot['tables']; openOrders: OpenOrder[]; kitchenTickets: KitchenTicket[]; staff: Staff[] };
type ItemRequest = { menuItemId: string; quantity: number; modifierNames?: string[] };

const commandItems = (menu: MenuItem[], items: ItemRequest[], allowEmpty = false) => {
  if (!Array.isArray(items) || (!items.length && !allowEmpty)) throw new Error('Choose at least one valid menu item.');
  return items.map((item) => {
    if (!item || typeof item.menuItemId !== 'string' || !Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('Order quantities must be whole numbers greater than zero.');
    const menuItem = menu.find(entry => entry.id === item.menuItemId && entry.available !== false); if (!menuItem) throw new Error('A selected menu item is unavailable.');
    const modifiers = (item.modifierNames ?? []).filter(name => menuItem.modifiers?.some(modifier => modifier.name === name));
    const modifierTotal = modifiers.reduce((sum, name) => sum + (menuItem.modifiers?.find(modifier => modifier.name === name)?.priceDelta ?? 0), 0);
    const key = `${menuItem.id}:${modifiers.slice().sort().join('-')}`;
    return { key, itemId: menuItem.id, name: menuItem.name, quantity: item.quantity, unitPrice: menuItem.price + modifierTotal, modifierNames: modifiers };
  });
};
const kitchenItems = (menu: MenuItem[], order: OpenOrder, tickets: KitchenTicket[]) => {
  const sent = tickets.filter(ticket => ticket.orderId === order.id && ticket.status !== 'cancelled').flatMap(ticket => ticket.items).reduce<Record<string, number>>((all, item) => ({ ...all, [item.itemId]: (all[item.itemId] ?? 0) + item.quantity }), {});
  return order.items.flatMap(line => menu.find(item => item.id === line.itemId)?.sendToKitchen && line.quantity > (sent[line.itemId] ?? 0) ? [{ itemId: line.itemId, name: line.name, quantity: line.quantity - (sent[line.itemId] ?? 0), modifierNames: line.modifierNames }] : []);
};
export const operationalSnapshot = (state: OperationalAuthorityState): OperationalSnapshot => ({ shop: state.shop, menuItems: state.menuItems.filter(item => item.available !== false), tables: state.tables.filter(table => table.isActive), openOrders: state.openOrders, kitchenTickets: state.kitchenTickets });

/** Pure Main-POS validator. It creates no sale, stock movement, COGS, tax, or expense. */
export function applyOperationalCommand(state: OperationalAuthorityState, message: SyncMessage, role: StaffDeviceRole): OperationalCommandResult {
  const payload = message.payload as Record<string, unknown>; const staffId = typeof payload.staffId === 'string' ? payload.staffId : ''; const staff = state.staff.find(member => member.id === staffId && member.isActive);
  const requireStaff = (permission: 'sales' | 'kitchen') => { if (!staff || !can(staff.role, permission)) throw new Error('The logged-in staff session is not authorized for this action.'); };
  const now = new Date().toISOString();
  if (message.type === 'ORDER_CREATE_REQUEST') {
    if (role !== 'waiter' && role !== 'cashier') throw new Error('This device cannot create orders.'); requireStaff('sales');
    const serviceMode = payload.serviceMode; if (serviceMode !== 'dine-in' && serviceMode !== 'takeaway') throw new Error('Choose dine-in or takeaway.');
    const tableId = typeof payload.tableId === 'string' ? payload.tableId : undefined;
    if (serviceMode === 'dine-in') { if (!tableId) throw new Error('Choose a table.'); const table = state.tables.find(entry => entry.id === tableId && entry.isActive); if (!table) throw new Error('Choose an active table.'); if (state.openOrders.some(order => order.tableId === tableId)) throw new Error('Table is already occupied.'); }
    const lines = commandItems(state.menuItems, payload.items as ItemRequest[], serviceMode === 'dine-in'); const table = tableId ? state.tables.find(entry => entry.id === tableId) : undefined;
    const order: OpenOrder = { id: `open-order-${message.messageId}`, serviceMode, tableId, tableName: table?.name, items: lines, createdAt: now, updatedAt: now, revision: 1, originDeviceId: message.sourceDeviceId, createdByStaffId: staff!.id, createdByStaffName: staff!.name };
    return { eventType: 'ORDER_CREATED', payload: { order, clientMessageId: message.messageId } };
  }
  const ticketForStatus = message.type === 'KITCHEN_STATUS_UPDATE_REQUEST' && typeof payload.ticketId === 'string' ? state.kitchenTickets.find(entry => entry.id === payload.ticketId) : undefined;
  const orderId = typeof payload.orderId === 'string' ? payload.orderId : ticketForStatus?.orderId ?? ''; const order = state.openOrders.find(entry => entry.id === orderId);
  if (!order && message.type !== 'KITCHEN_STATUS_UPDATE_REQUEST') throw new Error('This open order is no longer available.');
  const openOrder = order as OpenOrder;
  const expectedRevision = payload.expectedRevision; if (message.type !== 'KITCHEN_STATUS_UPDATE_REQUEST' && (!Number.isInteger(expectedRevision) || expectedRevision !== (order!.revision ?? 1))) return { eventType: 'ORDER_CONFLICT', payload: { orderId, reason: 'This order was changed on the Main POS.', order, clientMessageId: message.messageId } };
  if (message.type === 'ORDER_UPDATE_REQUEST') {
    if (role !== 'waiter' && role !== 'cashier') throw new Error('This device cannot update orders.'); requireStaff('sales');
    const additions = Array.isArray(payload.add) ? commandItems(state.menuItems, payload.add as ItemRequest[], true) : [];
    const removals = Array.isArray(payload.remove) ? payload.remove as Array<{ key: string; quantity: number }> : [];
    let items: CartLine[] = openOrder.items.map(line => ({ ...line }));
    for (const remove of removals) { if (!remove || typeof remove.key !== 'string' || !Number.isInteger(remove.quantity) || remove.quantity <= 0) throw new Error('Invalid order update.'); items = items.map(line => line.key === remove.key ? { ...line, quantity: line.quantity - remove.quantity } : line).filter(line => line.quantity > 0); }
    additions.forEach(line => { const existing = items.find(entry => entry.key === line.key); items = existing ? items.map(entry => entry.key === line.key ? { ...entry, quantity: entry.quantity + line.quantity } : entry) : [...items, line]; });
    if (!items.length) throw new Error('An order must contain at least one item.'); const updated = { ...openOrder, items, revision: (openOrder.revision ?? 1) + 1, updatedAt: now };
    return { eventType: 'ORDER_UPDATED', payload: { order: updated, clientMessageId: message.messageId } };
  }
  if (message.type === 'ORDER_CANCEL_REQUEST') { if (role !== 'waiter' && role !== 'cashier') throw new Error('This device cannot cancel orders.'); requireStaff('sales'); return { eventType: 'ORDER_CANCELLED', payload: { orderId, tableId: openOrder.tableId, clientMessageId: message.messageId } }; }
  if (message.type === 'ORDER_SEND_TO_KITCHEN_REQUEST') { if (role !== 'waiter' && role !== 'cashier') throw new Error('This device cannot send kitchen work.'); requireStaff('sales'); const items = kitchenItems(state.menuItems, openOrder, state.kitchenTickets); if (!items.length) return { eventType: 'KITCHEN_TICKET_CREATED', payload: { orderId, alreadySent: true, clientMessageId: message.messageId } }; const ticket: KitchenTicket = { id: `kitchen-ticket-${message.messageId}`, orderId: openOrder.id, serviceMode: openOrder.serviceMode, tableName: openOrder.tableName, tokenNumber: openOrder.tokenNumber, items, status: 'new', revision: 1, createdAt: now }; return { eventType: 'KITCHEN_TICKET_CREATED', payload: { ticket, clientMessageId: message.messageId } }; }
  if (message.type === 'KITCHEN_STATUS_UPDATE_REQUEST') {
    if (role !== 'kitchen') throw new Error('Only a Kitchen device can update kitchen status.'); requireStaff('kitchen');
    const ticketId = typeof payload.ticketId === 'string' ? payload.ticketId : ''; const ticket = state.kitchenTickets.find(entry => entry.id === ticketId);
    if (!ticket || ticket.status === 'cancelled') throw new Error('Kitchen ticket is unavailable.');
    if (!Number.isInteger(payload.expectedRevision) || payload.expectedRevision !== (ticket.revision ?? 1)) return { eventType: 'ORDER_CONFLICT', payload: { orderId: ticket.orderId, reason: 'Kitchen status was changed on the Main POS.', ticket, clientMessageId: message.messageId } };
    const status = payload.status; const valid = (ticket.status === 'new' && status === 'preparing') || (ticket.status === 'preparing' && status === 'ready') || (ticket.status === 'ready' && status === 'completed');
    if (!valid) return { eventType: 'ORDER_CONFLICT', payload: { orderId: ticket.orderId, reason: 'Kitchen status was changed on the Main POS.', ticket, clientMessageId: message.messageId } };
    const updated: KitchenTicket = { ...ticket, status: status as KitchenTicket['status'], revision: (ticket.revision ?? 1) + 1, ...(status === 'preparing' ? { startedAt: now } : {}), ...(status === 'ready' ? { readyAt: now } : {}), ...(status === 'completed' ? { completedAt: now } : {}) };
    return { eventType: 'KITCHEN_TICKET_UPDATED', payload: { ticket: updated, clientMessageId: message.messageId } };
  }
  throw new Error('Unsupported operational command.');
}
