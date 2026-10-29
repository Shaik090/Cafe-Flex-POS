jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { MenuManagementScreen } from '../src/screens/MenuManagementScreen';
import { SettingsScreen } from '../src/screens/SettingsScreen';

const taxRates: any[] = [
  { id: 'gst-5', name: 'GST 5%', rate: 5, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'gst-12', name: 'GST 12%', rate: 12, isActive: false, createdAt: '2026-01-01T00:00:00.000Z' },
];

function makePos(overrides: any = {}) {
  return {
    shop: {
      name: 'Cafe',
      enableTax: true,
      taxSettings: { pricingMode: 'exclusive' },
      modules: { stock: true, expenses: true, customers: false, tables: false, kitchen: false, receiptPrinting: false },
    },
    taxRates,
    currentStaff: { id: 'owner', role: 'owner' },
    updateShop: jest.fn(),
    saveTaxRate: jest.fn(() => 'gst-18'),
    toggleTaxRate: jest.fn(),
    menuItems: [{ id: 'tea', name: 'Tea', price: 10, category: 'Tea', available: true }],
    stockItems: [],
    addMenuItem: jest.fn(() => 'new'),
    updateMenuItem: jest.fn(),
    deleteMenuItem: jest.fn(),
    saveRecipe: jest.fn(),
    ...overrides,
  } as any;
}

function openTeaEditor(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getAllByText('Tea')[1]);
}

describe('Tax rate management and menu assignment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lets an owner manage rates, set the default, and renders the settings controls on phone and tablet', () => {
    const state = makePos();
    const phone = render(<SettingsScreen pos={state} />);

    fireEvent(phone.getByTestId('tax-enable-toggle'), 'valueChange', false);
    expect(state.updateShop).toHaveBeenCalledWith({ enableTax: false });
    fireEvent.press(phone.getByTestId('default-tax-gst-5'));
    expect(state.updateShop).toHaveBeenCalledWith({ taxSettings: { pricingMode: 'exclusive', defaultTaxRateId: 'gst-5' } });

    fireEvent.changeText(phone.getByTestId('tax-rate-name'), 'GST 18%');
    fireEvent.changeText(phone.getByTestId('tax-rate-percent'), '18');
    fireEvent.press(phone.getByTestId('save-tax-rate'));
    expect(state.saveTaxRate).toHaveBeenCalledWith({ name: 'GST 18%', rate: 18 }, undefined);
    fireEvent.press(phone.getAllByText('Disable')[0]);
    expect(state.toggleTaxRate).toHaveBeenCalledWith('gst-5');
    phone.unmount();

    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<SettingsScreen pos={makePos()} />);
    expect(tablet.getByText('Default Tax Rate')).toBeTruthy();
    expect(tablet.getByText('Disabled')).toBeTruthy();
  });

  it('hides tax configuration from cashier users', () => {
    const settings = render(<SettingsScreen pos={makePos({ currentStaff: { id: 'cashier', role: 'cashier' } })} />);
    expect(settings.getByText('You do not have permission to change tax configuration.')).toBeTruthy();
    expect(settings.queryByTestId('tax-enable-toggle')).toBeNull();

    const menu = render(<MenuManagementScreen pos={makePos({ currentStaff: { id: 'cashier', role: 'cashier' } })} />);
    openTeaEditor(menu);
    expect(menu.queryByText('Specific Tax Rate')).toBeNull();
  });

  it('hides menu tax controls when tax is disabled and writes No Tax, Default Tax, and Specific Tax assignments', () => {
    const disabled = render(<MenuManagementScreen pos={makePos({ shop: { ...makePos().shop, enableTax: false } })} />);
    openTeaEditor(disabled);
    expect(disabled.queryByText('Specific Tax Rate')).toBeNull();
    disabled.unmount();

    const noTaxState = makePos();
    const noTax = render(<MenuManagementScreen pos={noTaxState} />);
    openTeaEditor(noTax);
    fireEvent.press(noTax.getByTestId('menu-tax-none'));
    expect(noTaxState.updateMenuItem).toHaveBeenCalledWith('tea', { taxRateId: undefined, taxRateName: 'No Tax', taxRatePercent: -1 });
    noTax.unmount();

    const defaultState = makePos();
    const defaultTax = render(<MenuManagementScreen pos={defaultState} />);
    openTeaEditor(defaultTax);
    fireEvent.press(defaultTax.getByTestId('menu-tax-default'));
    expect(defaultState.updateMenuItem).toHaveBeenCalledWith('tea', { taxRateId: undefined, taxRateName: undefined, taxRatePercent: undefined });
    defaultTax.unmount();

    const specificState = makePos({ menuItems: [{ id: 'tea', name: 'Tea', price: 10, category: 'Tea', available: true, taxRateId: 'gst-5', taxRateName: 'GST 5%', taxRatePercent: 5 }] });
    const specificTax = render(<MenuManagementScreen pos={specificState} />);
    openTeaEditor(specificTax);
    expect(specificTax.getByTestId('menu-tax-rate-gst-5')).toBeTruthy();
    expect(specificTax.queryByTestId('menu-tax-rate-gst-12')).toBeNull();
    fireEvent.press(specificTax.getByTestId('menu-tax-rate-gst-5'));
    expect(specificState.updateMenuItem).toHaveBeenCalledWith('tea', { taxRateId: 'gst-5', taxRateName: 'GST 5%', taxRatePercent: 5 });
  });

  it('renders the retained label for a disabled historical rate without offering it for new selection', () => {
    const state = makePos({ menuItems: [{ id: 'tea', name: 'Tea', price: 10, category: 'Tea', available: true, taxRateId: 'gst-12', taxRateName: 'GST 12%', taxRatePercent: 12 }] });
    const screen = render(<MenuManagementScreen pos={state} />);
    openTeaEditor(screen);
    expect(screen.getByText('Configured rate: GST 12%. Choose an active rate to change it.')).toBeTruthy();
    expect(screen.getByTestId('menu-tax-rate-gst-5')).toBeTruthy();
    expect(screen.queryByTestId('menu-tax-rate-gst-12')).toBeNull();
  });
});
