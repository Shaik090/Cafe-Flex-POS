import React from 'react';
import { render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { DashboardScreen } from '../src/screens/DashboardScreen';
const now = new Date().toISOString();
const dimensions = jest.spyOn(RN, 'useWindowDimensions');
function pos(sales: any[] = []) { return { shop: { name: 'Cafe', modules: {} }, sales, expenses: [], purchases: [], suppliers: [], supplierPayments: [], openOrders: [], stockItems: [] } as any; }
describe('Dashboard gross profit', () => {
  it('uses persisted complete sale snapshots and preserves dashboard metrics', () => {
    const screen = render(<DashboardScreen pos={pos([{ id: '1', status: 'Paid', amount: 100, createdAt: now, costingStatus: 'complete', costOfGoods: 40, items: [], method: 'Cash', time: '10:00' }])} onNavigate={jest.fn()} />);
    expect(screen.getByText('Gross Profit Today')).toBeTruthy(); expect(screen.getByText('₹60')).toBeTruthy(); expect(screen.getByText('Margin 60.0%')).toBeTruthy();
    expect(screen.getByText('Net Today')).toBeTruthy(); expect(screen.getAllByText('Supplier Due').length).toBeGreaterThan(0); expect(screen.getByText('Quick Actions')).toBeTruthy();
  });
  it('shows incomplete costing, zero state, and excludes voided sales on phone and tablet', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const incomplete = render(<DashboardScreen pos={pos([{ id: '1', status: 'Paid', amount: 100, createdAt: now, costingStatus: 'incomplete', costOfGoods: 0, items: [], method: 'Cash', time: '10:00' }])} onNavigate={jest.fn()} />);
    expect(incomplete.getByText('Cost data incomplete')).toBeTruthy(); incomplete.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const zero = render(<DashboardScreen pos={pos([{ id: 'void', status: 'Voided', amount: 100, createdAt: now, costingStatus: 'complete', costOfGoods: 40, items: [], method: 'Cash', time: '10:00' }])} onNavigate={jest.fn()} />);
    expect(zero.getByText('Gross Profit Today')).toBeTruthy(); expect(zero.getAllByText('₹0').length).toBeGreaterThan(0); expect(zero.queryByText('Cost data incomplete')).toBeNull();
  });
  it('uses the stored sale COGS snapshot instead of the current stock cost', () => {
    const state = pos([{ id: 'snapshot', status: 'Paid', amount: 100, createdAt: now, costingStatus: 'complete', costOfGoods: 40, items: [{ itemId: 'milk', quantity: 1 }], method: 'Cash', time: '10:00' }]);
    state.stockItems = [{ id: 'milk', name: 'Milk', quantity: 10, unit: 'litre', averageUnitCost: 999, inventoryValue: 9990, lowStockThreshold: 1, isActive: true, trackingMode: 'manual' }];
    const screen = render(<DashboardScreen pos={state} onNavigate={jest.fn()} />);
    expect(screen.getAllByText('₹60').length).toBeGreaterThan(0);
    expect(screen.queryByText(/-899/)).toBeNull();
  });
});
