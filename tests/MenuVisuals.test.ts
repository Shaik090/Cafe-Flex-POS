import { menuImageKeyFor, menuVisualFor } from '../src/utils/menuVisuals';

describe('default Café menu visuals', () => {
  it('chooses a useful image for common Indian café products', () => {
    expect(menuVisualFor({ name: 'Masala Chai', category: 'Tea' })).toEqual({ column: 0, row: 1 });
    expect(menuVisualFor({ name: 'Strong Tea', category: 'Tea' })).toEqual({ column: 1, row: 0 });
    expect(menuVisualFor({ name: 'Ginger Tea', category: 'Tea' })).toEqual({ column: 1, row: 0 });
    expect(menuVisualFor({ name: 'Filter Coffee', category: 'Coffee' })).toEqual({ column: 2, row: 0 });
    expect(menuVisualFor({ name: 'Cold Coffee', category: 'Coffee' })).toEqual({ column: 3, row: 0 });
    expect(menuVisualFor({ name: 'Water Bottle', category: 'Other' })).toEqual({ column: 1, row: 1 });
    expect(menuVisualFor({ name: 'Milk', category: 'Other' })).toEqual({ column: 2, row: 1 });
    expect(menuVisualFor({ name: 'Veg Sandwich', category: 'Snacks' })).toEqual({ column: 1, row: 2 });
    expect(menuVisualFor({ name: 'Samosa', category: 'Snacks' })).toEqual({ column: 2, row: 2 });
  });

  it('uses category defaults for custom menu items', () => {
    expect(menuVisualFor({ name: 'House Special', category: 'Tea' })).toEqual({ column: 0, row: 1 });
    expect(menuVisualFor({ name: 'Chef Snack', category: 'Snacks' })).toEqual({ column: 2, row: 2 });
  });

  it('keeps an owner-selected product image instead of replacing it with a name fallback', () => {
    expect(menuImageKeyFor({ name: 'House Blend', category: 'Coffee', imageKey: 'water' })).toBe('water');
    expect(menuImageKeyFor({ name: 'House Blend', category: 'Coffee' })).toBe('filterCoffee');
  });
});
