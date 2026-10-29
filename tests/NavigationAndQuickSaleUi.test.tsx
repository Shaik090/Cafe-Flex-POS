import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { AppShell } from '../src/components/AppShell';
import { CategoryTabs } from '../src/components/CategoryTabs';
import { MoreScreen } from '../src/screens/MoreScreen';
import { AppScreen } from '../src/types';
import { colors } from '../src/theme';

function PhoneNavigationHarness({ tablesEnabled = false, kitchenEnabled = false }: { tablesEnabled?: boolean; kitchenEnabled?: boolean }) {
  const [screen, setScreen] = useState<AppScreen>('Dashboard');
  const content = screen === 'More'
    ? <MoreScreen onNavigate={setScreen} tablesEnabled={tablesEnabled} kitchenEnabled={kitchenEnabled} />
    : <Text>{`Destination: ${screen}`}</Text>;
  return <AppShell screen={screen} onNavigate={setScreen} shopName="Cafe" tablesEnabled={tablesEnabled} kitchenEnabled={kitchenEnabled} testWidth={390}>{content}</AppShell>;
}

describe('Quick Sale filters and mobile More navigation', () => {
  it('renders compact horizontal category chips with saffron selection', () => {
    const onChange = jest.fn();
    const screen = render(<CategoryTabs value="All" onChange={onChange} />);
    const scroll = screen.getByTestId('quick-sale-category-scroll');
    expect(scroll.props.horizontal).toBe(true);
    const scrollStyle = StyleSheet.flatten(scroll.props.style);
    expect(scrollStyle.height).toBe(46);
    expect(scrollStyle.flexGrow).toBe(0);
    const chipRow = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(chipRow.paddingHorizontal).toBe(0);
    expect(chipRow.gap).toBe(8);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Favourites')).toBeTruthy();
    const all = StyleSheet.flatten(screen.getByTestId('category-chip-All').props.style);
    const tea = StyleSheet.flatten(screen.getByTestId('category-chip-Tea').props.style);
    expect(all.height).toBe(32);
    expect(all.minWidth).toBe(54);
    expect(all.maxWidth).toBe(112);
    expect(all.flexGrow).toBe(0);
    expect(tea.flexGrow).toBe(0);
    expect(all.backgroundColor).toBe('#FF9933');
    fireEvent.press(screen.getByTestId('category-chip-Coffee'));
    expect(onChange).toHaveBeenCalledWith('Coffee');
    expect(colors.primary).toBe('#FF9933');
  });

  it('uses a dedicated full More page and keeps More selected', () => {
    const screen = render(<PhoneNavigationHarness />);
    fireEvent.press(screen.getByTestId('bottom-more-navigation'));
    expect(screen.getByTestId('more-screen')).toBeTruthy();
    expect(screen.queryByTestId('more-bottom-sheet')).toBeNull();
    expect(screen.getByLabelText('More').props.accessibilityState.selected).toBe(true);
  });

  it('navigates from More to every core secondary module', () => {
    const screen = render(<PhoneNavigationHarness />);
    fireEvent.press(screen.getByText('More'));
    for (const [label, destination] of [['Expenses', 'Expenses'], ['Stock', 'Stock'], ['Purchases', 'Purchases'], ['Suppliers', 'Suppliers'], ['Reports', 'Reports'], ['Settings', 'Settings']] as const) {
      fireEvent.press(screen.getByText(label));
      expect(screen.getByText(`Destination: ${destination}`)).toBeTruthy();
      fireEvent.press(screen.getByText('More'));
    }
  });

  it('shows Tables and Kitchen only when their existing settings enable them', () => {
    const disabled = render(<MoreScreen onNavigate={jest.fn()} tablesEnabled={false} kitchenEnabled={false} />);
    expect(disabled.queryByText('Tables')).toBeNull();
    expect(disabled.queryByText('Kitchen')).toBeNull();
    disabled.unmount();
    const enabled = render(<MoreScreen onNavigate={jest.fn()} tablesEnabled kitchenEnabled />);
    expect(enabled.getByText('Tables')).toBeTruthy();
    expect(enabled.getByText('Kitchen')).toBeTruthy();
  });

  it('preserves direct secondary navigation in the tablet sidebar', () => {
    const screen = render(<AppShell screen="Dashboard" onNavigate={jest.fn()} shopName="Cafe" tablesEnabled kitchenEnabled testWidth={1024}><Text>Dashboard</Text></AppShell>);
    expect(screen.queryByText('More')).toBeNull();
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('Tables')).toBeTruthy();
    expect(screen.getByText('Kitchen')).toBeTruthy();
  });
});
