import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { StockScreen } from '../src/screens/StockScreen';

const dimensions = jest.spyOn(RN, 'useWindowDimensions');
const known = { id: 'milk', name: 'Milk', quantity: 12.5, unit: 'litre', averageUnitCost: 55, inventoryValue: 687.5, lowStockThreshold: 2, trackingMode: 'manual', isActive: true, createdAt: '2026-09-16' };
const low = { id: 'tea', name: 'Tea Powder', quantity: 1.2, unit: 'kg', averageUnitCost: 320, inventoryValue: 384, lowStockThreshold: 2, trackingMode: 'manual', isActive: true, createdAt: '2026-09-16' };
const out = { id: 'cups', name: 'Cups', quantity: 0, unit: 'pcs', lowStockThreshold: 5, trackingMode: 'manual', isActive: true, createdAt: '2026-09-16' };
function pos(stockItems: any[]) { return { stockItems, stockMovements: [], menuItems: [], saveStockItem: jest.fn(), adjustStock: jest.fn(), deactivateStockItem: jest.fn() } as any; }

describe('Stock valuation UI', () => {
  it('shows known valuation, inventory total, incomplete-cost warning, and statuses', () => {
    const screen = render(<StockScreen pos={pos([known, low, out])} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Inventory Value')).toBeTruthy();
    expect(screen.getAllByText(/₹1,071.5/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cost not configured').length).toBeGreaterThan(0);
    expect(screen.getByText('In Stock')).toBeTruthy();
    expect(screen.getAllByText('Low Stock').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Out of Stock').length).toBeGreaterThan(0);
  });

  it('shows the zero inventory value and no-stock state', () => {
    const screen = render(<StockScreen pos={pos([])} />);
    expect(screen.getByText('Inventory Value')).toBeTruthy();
    expect(screen.getByText('₹0')).toBeTruthy();
    expect(screen.getByText('No stock items')).toBeTruthy();
  });

  it('shows valuation and existing movement history in stock details', () => {
    const screen = render(<StockScreen pos={pos([known])} />);
    fireEvent.press(screen.getByText('Milk'));
    expect(screen.getAllByText('Current Quantity: 12.5 litre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unit: litre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Average Cost: ₹55 / litre').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inventory Value: ₹687.5').length).toBeGreaterThan(0);
    expect(screen.getByText('Low-stock threshold: 2 litre')).toBeTruthy();
    expect(screen.getByText('Tracking mode: Manual')).toBeTruthy();
    expect(screen.getByText('Movement History')).toBeTruthy();
  });

  it('renders valuation information on phone and tablet widths', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const phone = render(<StockScreen pos={pos([known])} />);
    expect(phone.getAllByText('Inventory Value').length).toBeGreaterThan(0);
    phone.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<StockScreen pos={pos([known])} />);
    expect(tablet.getAllByText('Inventory Value').length).toBeGreaterThan(0);
  });
});
