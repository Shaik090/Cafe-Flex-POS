import { MenuItem } from '../types';

export const menuItems: MenuItem[] = [
  {
    id: 'tea',
    name: 'Tea',
    price: 10,
    category: 'Tea',
    favourite: true,
    available: true,
    modifiers: [
      { id: 'strong', name: 'Strong', priceDelta: 2 },
      { id: 'extra-milk', name: 'Extra Milk', priceDelta: 3 },
      { id: 'less-sugar', name: 'Less Sugar' },
      { id: 'no-sugar', name: 'No Sugar' },
    ],
  },
  { id: 'strong-tea', name: 'Strong Tea', price: 12, category: 'Tea', favourite: true, available: true },
  { id: 'ginger-tea', name: 'Ginger Tea', price: 15, category: 'Tea', favourite: true, available: true },
  { id: 'special-tea', name: 'Special Tea', price: 20, category: 'Tea', available: true },
  { id: 'coffee', name: 'Coffee', price: 15, category: 'Coffee', favourite: true, available: true },
  { id: 'strong-coffee', name: 'Strong Coffee', price: 20, category: 'Coffee', available: true },
  { id: 'filter-coffee', name: 'Filter Coffee', price: 25, category: 'Coffee', available: true },
  { id: 'bun', name: 'Bun', price: 15, category: 'Snacks', favourite: true, available: true },
  { id: 'biscuit', name: 'Biscuit', price: 10, category: 'Snacks', favourite: true, available: true },
  { id: 'samosa', name: 'Samosa', price: 15, category: 'Snacks', favourite: true, available: true },
  { id: 'water', name: 'Water', price: 20, category: 'Other', available: true },
  { id: 'milk', name: 'Milk', price: 20, category: 'Other', available: true },
];
