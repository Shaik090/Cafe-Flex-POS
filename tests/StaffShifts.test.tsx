import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';
import { StaffLoginScreen } from '../src/screens/StaffLoginScreen';
import { StaffScreen } from '../src/screens/StaffScreen';
import { DashboardScreen } from '../src/screens/DashboardScreen';
import { AppShell } from '../src/components/AppShell';
import { shiftCashExpected } from '../src/utils/staff';

const owner = { id: 'owner', name: 'Owner', username: 'owner', role: 'owner' as const, pinHash: 'hash-owner', isActive: true, createdAt: '2026-09-20T09:00:00.000Z' };
const cashier = { id: 'cashier', name: 'Cashier 1', username: 'cashier.1', role: 'cashier' as const, pinHash: 'hash-cashier', isActive: true, createdAt: '2026-09-20T09:00:00.000Z' };
const kitchen = { id: 'kitchen', name: 'Kitchen 1', username: 'kitchen.1', role: 'kitchen' as const, pinHash: 'hash-kitchen', isActive: true, createdAt: '2026-09-20T09:00:00.000Z' };
const closed = { id: 'closed', staffId: 'cashier', staffName: 'Cashier 1', openedAt: '2026-09-20T09:00:00.000Z', closedAt: '2026-09-20T17:00:00.000Z', openingCash: 500, expectedCash: 650, closingCash: 640, cashVariance: -10, status: 'closed' as const };
function pos(overrides: any = {}) { return { shop: { name: 'Cafe Flex', setupComplete: true, enableStaffMode: true, enableShiftTracking: true, modules: { stock: true, expenses: true, customers: false, tables: false, kitchen: false, receiptPrinting: false, ...(overrides.shop?.modules ?? {}) }, ...overrides.shop }, staff: [owner, cashier, kitchen], shifts: [], currentStaff: cashier, sales: [], expenses: [], supplierPayments: [], stockItems: [], purchases: [], suppliers: [], openOrders: [], loginStaff: jest.fn().mockResolvedValue(true), lockStaff: jest.fn(), saveStaff: jest.fn().mockResolvedValue('new-staff'), toggleStaff: jest.fn(), startShift: jest.fn(), closeShift: jest.fn(), ...overrides } as any; }

describe('Staff/PIN/shift UI', () => {
  afterEach(() => jest.restoreAllMocks());
  it('requires a staff username and PIN, and never exposes credential hashes', async () => {
    const state = pos(); const screen = render(<StaffLoginScreen pos={state} />);
    expect(screen.getByText('Staff sign in')).toBeTruthy(); expect(screen.queryByText('hash-cashier')).toBeNull();
    fireEvent.changeText(screen.getByTestId('staff-username'), 'cashier.1'); fireEvent.changeText(screen.getByTestId('staff-pin'), '1234'); fireEvent.press(screen.getByTestId('staff-login-submit'));
    expect(state.loginStaff).toHaveBeenCalledWith('cashier.1', '1234');
    state.loginStaff.mockResolvedValueOnce(false); fireEvent.changeText(screen.getByTestId('staff-pin'), '9999'); fireEvent.press(screen.getByTestId('staff-login-submit'));
    await waitFor(() => expect(screen.getByText('Check your username and PIN, then try again.')).toBeTruthy()); expect(screen.queryByText('9999')).toBeNull();
  });
  it('provides staff management, start/end shift controls, and closed history', async () => {
    const state = pos({ shifts: [closed] }); const screen = render(<StaffScreen pos={state} />);
    expect(screen.getByText('Staff Management')).toBeTruthy(); expect(screen.getByText('Shift History')).toBeTruthy(); expect(screen.getByText(/Cashier 1 · closed/)).toBeTruthy(); expect(screen.getByText(/Expected ₹650/)).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Staff name'), 'Waiter 1'); fireEvent.changeText(screen.getByPlaceholderText('Username (e.g. priya.cashier)'), 'waiter.1'); fireEvent.changeText(screen.getByPlaceholderText('4-6 digit PIN'), '1234'); fireEvent.press(screen.getByText('Add Staff')); await Promise.resolve(); expect(state.saveStaff).toHaveBeenCalledWith({ name: 'Waiter 1', username: 'waiter.1', role: 'cashier', pin: '1234' });
    fireEvent.changeText(screen.getByPlaceholderText('Opening cash'), '500'); fireEvent.press(screen.getByText('Start Shift')); expect(state.startShift).toHaveBeenCalledWith(500);
  });
  it('uses the production cash reconciliation helper and excludes UPI', () => {
    const shift = { ...closed, status: 'open' as const, closedAt: undefined }; const expected = shiftCashExpected(shift, [{ status: 'Paid', method: 'Cash', amount: 300, createdAt: '2026-09-20T10:00:00.000Z' }, { status: 'Paid', method: 'UPI', amount: 200, createdAt: '2026-09-20T10:00:00.000Z' }] as any, [{ status: 'active', paymentMethod: 'cash', amount: 100, expenseDate: '2026-09-20T11:00:00.000Z' }] as any, [{ status: 'active', paymentMethod: 'cash', amount: 50, paymentDate: '2026-09-20T12:00:00.000Z' }] as any); expect(expected).toBe(650);
  });
  it('renders dashboard staff state only when Staff Mode is enabled', () => { const state = pos(); const enabled = render(<DashboardScreen pos={state} onNavigate={jest.fn()} />); expect(enabled.getByText('Current Staff')).toBeTruthy(); expect(enabled.getByText(/Cashier 1/)).toBeTruthy(); enabled.unmount(); const disabled = render(<DashboardScreen pos={pos({ shop: { enableStaffMode: false, modules: { stock: true, expenses: true, customers: false, tables: false, kitchen: false, receiptPrinting: false } } })} onNavigate={jest.fn()} />); expect(disabled.queryByText('Current Staff')).toBeNull(); });
  it('keeps phone and tablet staff navigation usable', () => { const dimensions = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 }); const phone = render(<AppShell screen="Dashboard" onNavigate={jest.fn()} shopName="Cafe Flex" staffEnabled staffRole="cashier"><RN.Text>Home</RN.Text></AppShell>); expect(phone.getByLabelText('More')).toBeTruthy(); phone.unmount(); dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 }); const tablet = render(<StaffScreen pos={pos()} />); expect(tablet.getByText('Staff & Shifts')).toBeTruthy(); });
});

