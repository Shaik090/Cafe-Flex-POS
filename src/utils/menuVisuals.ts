import { ImageSourcePropType } from 'react-native';
import { MenuImageKey, MenuItem } from '../types';

export type MenuVisual = { column: number; row: number };
type MenuVisualKey = MenuImageKey;

const visuals: Record<MenuVisualKey, MenuVisual> = {
  plainChai: { column: 0, row: 0 },
  strongChai: { column: 1, row: 0 },
  gingerTea: { column: 1, row: 0 },
  specialChai: { column: 0, row: 1 },
  filterCoffee: { column: 2, row: 0 },
  coldCoffee: { column: 3, row: 0 },
  strongCoffee: { column: 1, row: 1 },
  juice: { column: 0, row: 1 },
  water: { column: 1, row: 1 },
  milk: { column: 2, row: 1 },
  bun: { column: 3, row: 1 },
  biscuits: { column: 0, row: 2 },
  sandwich: { column: 1, row: 2 },
  samosa: { column: 2, row: 2 },
  cake: { column: 3, row: 2 },
  burger: { column: 1, row: 2 },
};

const images: Record<MenuVisualKey, ImageSourcePropType> = {
  plainChai: require('../../assets/menu-defaults/plain-chai.png'),
  strongChai: require('../../assets/menu-defaults/strong-chai.png'),
  gingerTea: require('../../assets/menu-defaults/ginger-tea.png'),
  specialChai: require('../../assets/menu-defaults/special-chai.png'),
  filterCoffee: require('../../assets/menu-defaults/filter-coffee.png'),
  coldCoffee: require('../../assets/menu-defaults/cold-coffee.png'),
  strongCoffee: require('../../assets/menu-defaults/strong-coffee.png'),
  juice: require('../../assets/menu-defaults/orange-juice.png'),
  water: require('../../assets/menu-defaults/water-bottle.png'),
  milk: require('../../assets/menu-defaults/milk-bottle.png'),
  sandwich: require('../../assets/menu-defaults/veg-sandwich.png'),
  burger: require('../../assets/menu-defaults/burger.png'),
  samosa: require('../../assets/menu-defaults/samosa.png'),
  bun: require('../../assets/menu-defaults/butter-bun.png'),
  biscuits: require('../../assets/menu-defaults/biscuits.png'),
  cake: require('../../assets/menu-defaults/chocolate-cake.png'),
};

const imageLabels: Record<MenuVisualKey, string> = {
  plainChai: 'Tea', strongChai: 'Strong tea', gingerTea: 'Ginger tea', specialChai: 'Special tea',
  filterCoffee: 'Coffee', coldCoffee: 'Cold coffee', strongCoffee: 'Strong coffee', juice: 'Juice',
  water: 'Water', milk: 'Milk', sandwich: 'Sandwich', burger: 'Burger', samosa: 'Samosa',
  bun: 'Bun', biscuits: 'Biscuits', cake: 'Cake',
};

export const menuImageOptions = (Object.keys(images) as MenuVisualKey[]).map((key) => ({
  key,
  label: imageLabels[key],
  source: images[key],
}));

export function menuImageKeyFor(item: Pick<MenuItem, 'name' | 'category' | 'imageKey'>): MenuVisualKey {
  if (item.imageKey && images[item.imageKey]) return item.imageKey;
  const name = item.name.toLowerCase();
  if (/water|mineral|bottle/.test(name)) return 'water';
  if (/milk/.test(name)) return 'milk';
  if (/ginger/.test(name)) return 'gingerTea';
  if (/strong tea/.test(name)) return 'strongChai';
  if (/special|masala|cardamom/.test(name)) return 'specialChai';
  if (/cold|iced|frapp|shake/.test(name)) return 'coldCoffee';
  if (/strong coffee/.test(name)) return 'strongCoffee';
  if (/tea|chai|lemon tea/.test(name)) return 'plainChai';
  if (/coffee|cappuccino|latte|espresso|americano|mocha/.test(name)) return 'filterCoffee';
  if (/juice|smoothie|lassi/.test(name)) return 'juice';
  if (/sandwich|toast|club/.test(name)) return 'sandwich';
  if (/burger|wrap|roll/.test(name)) return 'burger';
  if (/samosa|kachori|cutlet|puff|pakora/.test(name)) return 'samosa';
  if (/biscuit|cookie/.test(name)) return 'biscuits';
  if (/bun|bread/.test(name)) return 'bun';
  if (/cake|pastry|brownie|muffin|dessert/.test(name)) return 'cake';
  return item.category === 'Tea'
    ? 'plainChai'
    : item.category === 'Coffee'
      ? 'filterCoffee'
      : item.category === 'Snacks'
        ? 'samosa'
        : 'juice';
}

export function menuVisualFor(item: Pick<MenuItem, 'name' | 'category' | 'imageKey'>): MenuVisual {
  return visuals[menuImageKeyFor(item)];
}

export function menuImageFor(item: Pick<MenuItem, 'name' | 'category' | 'imageKey'>): ImageSourcePropType {
  return images[menuImageKeyFor(item)];
}
