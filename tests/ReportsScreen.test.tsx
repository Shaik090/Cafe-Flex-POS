import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { ReportsScreen } from '../src/screens/ReportsScreen';

const now = new Date().toISOString();
const dimensions = jest.spyOn(RN, 'useWindowDimensions');
function pos(overrides: Record<string, unknown> = {}) {
  return { sales: [], expenses: [], purchases: [], stockItems: [], suppliers: [], supplierPayments: [], ...overrides } as any;
}

describe('ReportsScreen', () => {
  it('shows real zero sales, expenses, purchases and gross-profit values for a fresh shop', () => {
    const screen = render(<ReportsScreen pos={pos()} />);
    expect(screen.getAllByText('₹0').length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Total expenses')).toBeTruthy();
    expect(screen.getByText('Purchases')).toBeTruthy();
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COGS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gross Profit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gross Margin').length).toBeGreaterThan(0);
    expect(screen.getByText('No sales in this period.')).toBeTruthy();
  });

  it('renders complete historical COGS, gross profit, margin and item profitability', () => {
    const screen = render(<ReportsScreen pos={pos({
      sales: [
        { id: 'cash', status: 'Paid', method: 'Cash', amount: 10, createdAt: now, costingStatus: 'complete', costOfGoods: 4, costLines: [{ stockItemId: 'tea', stockItemName: 'Tea', quantity: 1, unit: 'pcs', unitCost: 4, totalCost: 4, source: 'direct-sale' }], items: [{ name: 'Tea', quantity: 1, unitPrice: 10 }] },
        { id: 'upi', status: 'Paid', method: 'UPI', amount: 12, createdAt: now, costingStatus: 'complete', costOfGoods: 5, costLines: [{ stockItemId: 'tea', stockItemName: 'Tea', quantity: 1, unit: 'pcs', unitCost: 5, totalCost: 5, source: 'direct-sale' }], items: [{ name: 'Tea', quantity: 1, unitPrice: 12 }] },
      ],
      expenses: [{ id: 'expense', status: 'active', amount: 5, expenseDate: now, categoryName: 'Supplies', paymentMethod: 'cash' }],
      purchases: [{ id: 'paid', status: 'completed', total: 50, purchaseDate: now, paymentMethod: 'cash', items: [] }],
    })} />);
    expect(screen.getAllByText('₹22').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹9').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹13').length).toBeGreaterThan(0);
    expect(screen.getByText('Gross Margin')).toBeTruthy();
    expect(screen.getByText('Item Profitability')).toBeTruthy();
    expect(screen.getByText('Tea · 2 sold')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy(); expect(screen.getByText('UPI')).toBeTruthy();
    expect(screen.getByText('Net (Sales - Expenses)')).toBeTruthy();
  });

  it('warns instead of presenting incomplete item costs as exact profit', () => {
    const screen = render(<ReportsScreen pos={pos({ sales: [{ id: 'sale', status: 'Paid', method: 'Cash', amount: 10, createdAt: now, costingStatus: 'incomplete', costOfGoods: 0, items: [{ name: 'Tea', quantity: 1, unitPrice: 10 }] }] })} />);
    expect(screen.getByText('Cost data incomplete', { exact: false })).toBeTruthy();
    expect(screen.getByText('Cost incomplete')).toBeTruthy();
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0);
  });

  it('uses Today, This Week and This Month filters on phone and tablet widths', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const screen = render(<ReportsScreen pos={pos({ sales: [{ id: 'today', status: 'Paid', method: 'Cash', amount: 10, createdAt: now, costingStatus: 'complete', costOfGoods: 4, items: [] }] })} />);
    fireEvent.press(screen.getByLabelText('report-filter-this-week'));
    expect(screen.getAllByText('₹10').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText('report-filter-this-month'));
    expect(screen.getAllByText('₹10').length).toBeGreaterThan(0);
    screen.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<ReportsScreen pos={pos()} />);
    expect(tablet.getAllByText('Gross Profit').length).toBeGreaterThan(0);
  });

  it('shows a historical mixed-rate tax breakdown and excludes voided tax snapshots', () => {
    const taxed = { id: 'taxed', status: 'Paid', method: 'Cash', amount: 237, taxableSubtotal: 220, taxTotal: 17, createdAt: now, costingStatus: 'complete', costOfGoods: 0, items: [], taxLines: [{ itemName: 'Tea', taxableAmount: 100, taxRate: 5, taxAmount: 5, lineTotal: 105 }, { itemName: 'Coffee', taxableAmount: 100, taxRate: 12, taxAmount: 12, lineTotal: 112 }, { itemName: 'Water', taxableAmount: 20, taxRate: 0, taxAmount: 0, lineTotal: 20 }] };
    const voided = { ...taxed, id: 'voided', status: 'Voided', amount: 105, taxableSubtotal: 100, taxTotal: 5, taxLines: [taxed.taxLines[0]] };
    const enabled = render(<ReportsScreen pos={pos({ shop: { enableTax: true }, sales: [taxed, voided] })} />);
    expect(enabled.getByText('Taxable Sales')).toBeTruthy();
    expect(enabled.getByText('Tax Collected')).toBeTruthy();
    expect(enabled.getByText('GST 5%')).toBeTruthy();
    expect(enabled.getByText('GST 12%')).toBeTruthy();
    expect(enabled.getByText('No Tax')).toBeTruthy();
    expect(enabled.getAllByText('₹17').length).toBeGreaterThan(0);
    enabled.unmount();
    const disabled = render(<ReportsScreen pos={pos({ shop: { enableTax: false }, sales: [taxed] })} />);
    expect(disabled.queryByText('Taxable Sales')).toBeNull();
  });
});
