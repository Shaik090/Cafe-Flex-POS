import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppShell } from '../src/components/AppShell';
import { MoreScreen } from '../src/screens/MoreScreen';
import { allowedStaffDeviceScreens, resolveStaffDeviceScreen } from '../src/components/navigationItems';

const shell = (role: 'waiter' | 'kitchen' | 'cashier', staffRole: any, width: number) => render(
  <AppShell screen={role === 'kitchen' ? 'Kitchen' : 'Quick Sale'} onNavigate={jest.fn()} shopName="Cafe" tablesEnabled kitchenEnabled staffEnabled onLock={jest.fn()} staffRole={staffRole} staffDeviceRole={role} connectionStatus="pending-sync" testWidth={width}><Text>Operational content</Text></AppShell>,
);

describe('staff-device role navigation', () => {
  it('keeps a waiter device operational on phone and excludes owner modules', () => {
    const screen = shell('waiter', 'owner', 390);
    expect(screen.getByText('Sale')).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
    expect(screen.getByTestId('staff-connection-status').props.children).toBe('Pending Sync');
    ['Home', 'Menu', 'Sales', 'Expenses', 'Reports', 'Settings'].forEach(label => expect(screen.queryByText(label)).toBeNull());
    screen.unmount();
    const more = render(<MoreScreen onNavigate={jest.fn()} tablesEnabled kitchenEnabled staffRole="owner" staffDeviceRole="waiter" />);
    expect(more.getByText('Tables')).toBeTruthy();
    expect(more.getByText('Kitchen')).toBeTruthy();
    ['Expenses', 'Purchases', 'Suppliers', 'Reports', 'Settings'].forEach(label => expect(more.queryByText(label)).toBeNull());
  });

  it('uses the same waiter restriction in the tablet sidebar', () => {
    const screen = shell('waiter', 'owner', 1024);
    expect(screen.getByText('Sale')).toBeTruthy();
    expect(screen.getByText('Tables')).toBeTruthy();
    expect(screen.getByText('Kitchen')).toBeTruthy();
    ['Expenses', 'Stock', 'Purchases', 'Reports', 'Settings'].forEach(label => expect(screen.queryByText(label)).toBeNull());
  });

  it('makes kitchen devices Kitchen-only regardless of a manager PIN', () => {
    const phone = shell('kitchen', 'manager', 390);
    expect(phone.getByText('Kitchen')).toBeTruthy();
    expect(phone.queryByText('More')).toBeNull();
    ['Sale', 'Tables', 'Reports', 'Settings'].forEach(label => expect(phone.queryByText(label)).toBeNull());
    phone.unmount();
    const tablet = shell('kitchen', 'manager', 1024);
    expect(tablet.getByText('Kitchen')).toBeTruthy();
    ['Sale', 'Expenses', 'Stock', 'Purchases', 'Settings'].forEach(label => expect(tablet.queryByText(label)).toBeNull());
  });

  it('keeps cashier devices operational while excluding owner administration', () => {
    const screen = shell('cashier', 'cashier', 390);
    expect(screen.getByText('Sale')).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
    ['Home', 'Menu', 'Sales', 'Reports', 'Settings', 'Expenses'].forEach(label => expect(screen.queryByText(label)).toBeNull());
  });

  it('redirects direct admin routes to the permitted operational surface', () => {
    const waiter = { tablesEnabled: true, kitchenEnabled: true, deviceRole: 'waiter' as const, staffRole: 'owner' as const };
    ['Reports', 'Purchases', 'Suppliers', 'Staff', 'Settings'].forEach(route => expect(resolveStaffDeviceScreen(route as any, waiter)).toBe('Quick Sale'));
    expect(resolveStaffDeviceScreen('More', { tablesEnabled: true, kitchenEnabled: true, deviceRole: 'kitchen', staffRole: 'manager' })).toBe('Kitchen');
  });

  it('applies the device capability ceiling before staff permissions', () => {
    expect(allowedStaffDeviceScreens({ tablesEnabled: true, kitchenEnabled: true, deviceRole: 'waiter', staffRole: 'owner' })).toEqual(['Quick Sale', 'Tables', 'Kitchen']);
    expect(allowedStaffDeviceScreens({ tablesEnabled: true, kitchenEnabled: true, deviceRole: 'kitchen', staffRole: 'manager' })).toEqual(['Kitchen']);
    expect(allowedStaffDeviceScreens({ tablesEnabled: true, kitchenEnabled: true, deviceRole: 'cashier', staffRole: 'cashier' })).toEqual(['Quick Sale', 'Tables']);
  });
});
