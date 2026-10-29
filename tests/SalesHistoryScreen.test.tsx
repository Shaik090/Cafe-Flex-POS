import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { SalesHistoryScreen } from '../src/screens/SalesHistoryScreen';

const dimensions = jest.spyOn(RN, 'useWindowDimensions');
const sales: any[] = [
  { id: 'S-101', date: '24 Sep 2026', time: '10:32 AM', createdAt: '2026-09-24T05:02:00.000Z', items: [{ name: 'Tea', quantity: 2, unitPrice: 10 }], amount: 20, method: 'Cash', status: 'Paid', staffName: 'Asha' },
  { id: 'S-102', date: '24 Sep 2026', time: '10:45 AM', createdAt: '2026-09-24T05:15:00.000Z', items: [{ name: 'Coffee', quantity: 1, unitPrice: 30 }], amount: 30, method: 'UPI', status: 'Paid' },
  { id: 'S-103', date: '24 Sep 2026', time: '11:00 AM', createdAt: '2026-09-24T05:30:00.000Z', items: [{ name: 'Bun', quantity: 1, unitPrice: 15 }], amount: 15, method: 'Cash', status: 'Voided', voidReason: 'Test' },
];
const pos = { sales, shop: { name: 'Cafe', receiptSettings: {} }, voidSale: jest.fn() } as any;

describe('Sales History visual transaction list', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders receipt-style rows with real payment, status, time, and staff information on phone', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const screen = render(<SalesHistoryScreen pos={pos} />);
    expect(screen.getByText('Sales History')).toBeTruthy();
    expect(screen.getByLabelText('Receipt S-101')).toBeTruthy();
    expect(screen.getByText('Tea ×2')).toBeTruthy();
    expect(screen.getByText('By Asha')).toBeTruthy();
    expect(screen.getAllByText('UPI').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Voided').length).toBeGreaterThan(1);
  });

  it('keeps compact payment and status filters functional', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const screen = render(<SalesHistoryScreen pos={pos} />);
    fireEvent.press(screen.getAllByText('UPI')[0]);
    expect(screen.getByLabelText('Receipt S-102')).toBeTruthy();
    expect(screen.queryByLabelText('Receipt S-101')).toBeNull();
    fireEvent.press(screen.getAllByText('All')[0]);
    fireEvent.press(screen.getAllByText('Voided')[0]);
    expect(screen.getByLabelText('Receipt S-103')).toBeTruthy();
    expect(screen.queryByLabelText('Receipt S-101')).toBeNull();
  });

  it('retains the same receipt information at tablet width', () => {
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const screen = render(<SalesHistoryScreen pos={pos} />);
    expect(screen.getByLabelText('Receipt S-101')).toBeTruthy();
    expect(screen.getByText('Tea ×2')).toBeTruthy();
    expect(screen.getByText('By Asha')).toBeTruthy();
  });

  it('shows a compact no-sales state instead of an empty transaction area', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const screen = render(<SalesHistoryScreen pos={{ ...pos, sales: [] }} />);
    expect(screen.getByText('No sales recorded yet')).toBeTruthy();
    expect(screen.getByText('Completed sales will appear here.')).toBeTruthy();
  });
});
