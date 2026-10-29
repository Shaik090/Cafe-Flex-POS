import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { MenuManagementScreen } from '../src/screens/MenuManagementScreen';

const dimensions = jest.spyOn(RN, 'useWindowDimensions');

describe('Menu image picker', () => {
  beforeEach(() => dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 }));

  it('lets an owner select an included product image or restore automatic matching', () => {
    const updateMenuItem = jest.fn();
    const pos = {
      menuItems: [{ id: 'water', name: 'Water', price: 20, category: 'Other', available: true }],
      stockItems: [], updateMenuItem, saveRecipe: jest.fn(), addMenuItem: jest.fn(), deleteMenuItem: jest.fn(),
    } as any;
    const screen = render(<MenuManagementScreen pos={pos} />);
    fireEvent.press(screen.getByText('Water'));
    expect(screen.getByText('Product image')).toBeTruthy();
    fireEvent.press(screen.getByTestId('menu-image-milk'));
    expect(updateMenuItem).toHaveBeenCalledWith('water', { imageKey: 'milk' });
    fireEvent.press(screen.getByTestId('menu-image-auto'));
    expect(updateMenuItem).toHaveBeenCalledWith('water', { imageKey: undefined });
  });
});
