import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PurchasesScreen } from '../src/screens/PurchasesScreen';
import { MoreScreen } from '../src/screens/MoreScreen';
import { AppShell } from '../src/components/AppShell';

const stock = [
  { id: 'milk', name: 'Milk', unit: 'litre', quantity: 2, lowStockThreshold: 1, trackingMode: 'manual', isActive: true, createdAt: 'x' },
  { id: 'tea', name: 'Tea Powder', unit: 'kg', quantity: 1, lowStockThreshold: 1, trackingMode: 'manual', isActive: true, createdAt: 'x' },
];
const basePos: any = { purchases: [], suppliers: [], stockItems: stock, createPurchase: jest.fn(), saveStockItem: jest.fn(() => 'new-stock') };

describe('purchase item entry and navigation polish', () => {
  it('uses History for the Sales History navigation label and renders navigation glyphs', () => {
    const screen = render(<AppShell screen="Sales History" onNavigate={jest.fn()} shopName="Cafe" testWidth={390}><React.Fragment /></AppShell>);
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.queryByText('Sales')).toBeNull();
    expect(screen.getByLabelText('History')).toBeTruthy();
  });

  it('shows filtered More module icons without bypassing existing filtering', () => {
    const screen = render(<MoreScreen onNavigate={jest.fn()} tablesEnabled kitchenEnabled />);
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Tables')).toBeTruthy();
  });

  it('starts purchase lines empty and selects a real searchable stock item', () => {
    const screen = render(<PurchasesScreen pos={basePos} />);
    fireEvent.press(screen.getByText('+ New Purchase'));
    expect(screen.getByText('Add the stock items in this purchase.')).toBeTruthy();
    fireEvent.press(screen.getAllByText('+ Add Item')[0]);
    fireEvent.press(screen.getByText('Select stock item'));
    fireEvent.changeText(screen.getByLabelText('Search stock item'), 'Milk');
    expect(screen.getByText('Milk')).toBeTruthy();
    fireEvent.press(screen.getByTestId('stock-choice-milk'));
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('litre')).toBeTruthy();
  });

  it('prevents duplicate stock item selection and supports an in-context stock item', () => {
    const screen = render(<PurchasesScreen pos={basePos} />);
    fireEvent.press(screen.getByText('+ New Purchase'));
    fireEvent.press(screen.getAllByText('+ Add Item')[0]);
    fireEvent.press(screen.getByText('Select stock item'));
    fireEvent.press(screen.getByTestId('stock-choice-milk'));
    fireEvent.press(screen.getByText('+ Add Item'));
    fireEvent.press(screen.getByText('Select stock item'));
    fireEvent.press(screen.getByTestId('stock-choice-milk'));
    expect(screen.getByRole('alert').props.children).toContain('already');
    fireEvent.press(screen.getByText('+ Add New Stock Item'));
    fireEvent.changeText(screen.getByLabelText('New stock item name'), 'Paper Cups');
    fireEvent.changeText(screen.getByLabelText('New stock item unit'), 'pcs');
    fireEvent.press(screen.getByText('Save Stock Item'));
    expect(basePos.saveStockItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Paper Cups', unit: 'pcs', quantity: 0 }));
  });
});
