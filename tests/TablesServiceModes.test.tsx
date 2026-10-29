import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { AppShell } from '../src/components/AppShell';
import { MoreScreen } from '../src/screens/MoreScreen';
import { TablesScreen } from '../src/screens/TablesScreen';
import { QuickSaleScreen } from '../src/screens/QuickSaleScreen';

const dimension = jest.spyOn(RN, 'useWindowDimensions');
const phone = () => dimension.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
const tablet = () => dimension.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
const table = { id: 't1', name: 'Table 1', isActive: true, sortOrder: 1, createdAt: '2026-09-15T10:00:00.000Z' };
const item = { key: 'tea', itemId: 'tea', name: 'Tea', quantity: 2, unitPrice: 10, modifierNames: [] };
function quickPos(overrides: Record<string, unknown> = {}) {
  return { shop: { serviceModes: { quick: true, dineIn: true, takeaway: true }, enableTokens: true }, menuItems: [], heldOrders: [], cart: [], total: 0, itemCount: 0, tables: [table], openOrders: [], activeOpenOrderId: null, activeServiceMode: 'quick', lastPayment: null, addItem: jest.fn(), changeQuantity: jest.fn(), holdCurrentSale: jest.fn(), completePayment: jest.fn(), clearLastPayment: jest.fn(), resumeHeldOrder: jest.fn(), deleteHeldOrder: jest.fn(), selectServiceMode: jest.fn(), openTableOrder: jest.fn(), cancelOpenOrder: jest.fn(), ...overrides } as any;
}

describe('Tables and service modes screen branches', () => {
  afterEach(() => jest.clearAllMocks());
  it('hides Tables from the phone More page when disabled and shows it when enabled', () => {
    phone();
    const screen = render(<MoreScreen onNavigate={jest.fn()} tablesEnabled={false} />);
    expect(screen.queryByText('Tables')).toBeNull();
    screen.unmount();
    const enabled = render(<MoreScreen onNavigate={jest.fn()} tablesEnabled />);
    expect(enabled.getByText('Tables')).toBeTruthy();
    expect(enabled.queryAllByText('Tables').length).toBe(1);
  });
  it('uses a tablet sidebar and conditionally renders Tables', () => {
    tablet();
    const hidden = render(<AppShell screen="Dashboard" onNavigate={jest.fn()} shopName="Cafe" tablesEnabled={false} testWidth={1024}><></></AppShell>);
    expect(hidden.queryByText('Tables')).toBeNull(); expect(hidden.getByText('Home')).toBeTruthy(); hidden.unmount();
    const shown = render(<AppShell screen="Dashboard" onNavigate={jest.fn()} shopName="Cafe" tablesEnabled testWidth={1024}><></></AppShell>);
    expect(shown.getByText('Tables')).toBeTruthy(); expect(shown.queryByText('More')).toBeNull();
  });
  it('shows available and occupied tables with accessible actions', () => {
    phone(); const pos = { tables: [table], openOrders: [{ id: 'o1', tableId: 't1', items: [item] }], openTableOrder: jest.fn(), toggleTable: jest.fn(), saveTable: jest.fn() } as any;
    const screen = render(<TablesScreen pos={pos} onOpen={jest.fn()} />);
    expect(screen.getByText('Table 1')).toBeTruthy(); expect(screen.getAllByText('Occupied').length).toBeGreaterThan(0); expect(screen.getByText('Edit')).toBeTruthy(); expect(screen.getByText('Disable')).toBeTruthy();
    fireEvent.press(screen.getByText('Disable')); expect(screen.getByText('Table has an open order')).toBeTruthy();
  });
  it('keeps the same table information usable in the tablet grid', () => {
    tablet(); const pos = { tables: [{ ...table, capacity: 4 }], openOrders: [{ id: 'o1', tableId: 't1', items: [item] }], openTableOrder: jest.fn(), toggleTable: jest.fn(), saveTable: jest.fn() } as any;
    const screen = render(<TablesScreen pos={pos} onOpen={jest.fn()} />);
    expect(screen.getByText('Table 1')).toBeTruthy(); expect(screen.getByText('4 seats')).toBeTruthy(); expect(screen.getByText('₹20')).toBeTruthy(); expect(screen.getByText('2 items in open order')).toBeTruthy();
  });
  it('gates dine-in cancellation behind Keep Order and Cancel Order', () => {
    phone(); const cancelOpenOrder = jest.fn(); const pos = quickPos({ openOrders: [{ id: 'o1', tableId: 't1', items: [item] }], activeOpenOrderId: 'o1', activeServiceMode: 'dine-in', cart: [item], total: 20, itemCount: 2, cancelOpenOrder });
    const screen = render(<QuickSaleScreen pos={pos} />);
    fireEvent.press(screen.getByText('Cancel order')); expect(screen.getByText('Cancel open order?')).toBeTruthy(); expect(cancelOpenOrder).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Keep Order')); expect(screen.queryByText('Cancel open order?')).toBeNull(); expect(cancelOpenOrder).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Cancel order')); fireEvent.press(screen.getByText('Cancel Order')); expect(cancelOpenOrder).toHaveBeenCalledWith('o1');
  });
  it('renders takeaway mode and token-enabled controls on phone and tablet', () => {
    phone(); const mobile = render(<QuickSaleScreen pos={quickPos()} />); expect(mobile.getByText('Quick')).toBeTruthy(); expect(mobile.getByText('Dine-in')).toBeTruthy(); expect(mobile.getByText('Takeaway')).toBeTruthy(); mobile.unmount();
    tablet(); const wide = render(<QuickSaleScreen pos={quickPos()} />); expect(wide.getByText('Takeaway')).toBeTruthy();
  });
});
