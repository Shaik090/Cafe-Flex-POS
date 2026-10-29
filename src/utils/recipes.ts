import { CartLine, MenuItem, RecipeConsumption, RecipeItem, StockItem } from '../types';

const mass = new Set(['kg', 'g']);
const volume = new Set(['litre', 'ml']);
const normalize = (unit: string) => unit.trim().toLowerCase();

export function convertRecipeQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = normalize(fromUnit); const to = normalize(toUnit);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (from === to) return quantity;
  if (mass.has(from) && mass.has(to)) return from === 'kg' && to === 'g' ? quantity * 1000 : quantity / 1000;
  if (volume.has(from) && volume.has(to)) return from === 'litre' && to === 'ml' ? quantity * 1000 : quantity / 1000;
  return null;
}

export function recipeRequirements(cart: CartLine[], menuItems: MenuItem[], stockItems: StockItem[]): RecipeConsumption[] {
  const requirements = new Map<string, RecipeConsumption>();
  for (const line of cart) {
    const menuItem = menuItems.find((item) => item.id === line.itemId);
    if (!menuItem?.recipe?.length) continue;
    for (const ingredient of menuItem.recipe) {
      const stockItem = stockItems.find((item) => item.id === ingredient.stockItemId && item.isActive);
      if (!stockItem) throw new Error('Recipe ingredient ' + ingredient.stockItemName + ' is unavailable.');
      if (stockItem.trackingMode === 'direct-sale' && stockItem.linkedMenuItemId === menuItem.id) continue;
      const converted = convertRecipeQuantity(ingredient.quantity * line.quantity, ingredient.unit, stockItem.unit);
      if (converted === null) throw new Error('Recipe unit ' + ingredient.unit + ' is incompatible with ' + stockItem.name + ' (' + stockItem.unit + ').');
      const current = requirements.get(stockItem.id);
      requirements.set(stockItem.id, { stockItemId: stockItem.id, stockItemName: stockItem.name, quantity: Math.round(((current?.quantity ?? 0) + converted) * 1000) / 1000, unit: stockItem.unit, menuItemId: menuItem.id, menuItemName: menuItem.name });
    }
  }
  return [...requirements.values()];
}

export function validateRecipe(recipe: RecipeItem[], stockItems: StockItem[], menuItemId: string): RecipeItem[] {
  const ids = new Set<string>();
  return recipe.map((ingredient) => {
    const stockItem = stockItems.find((item) => item.id === ingredient.stockItemId && item.isActive);
    if (!stockItem) throw new Error('Choose an active stock item.');
    if (ids.has(stockItem.id)) throw new Error('Each ingredient can be included once.');
    ids.add(stockItem.id);
    if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) throw new Error('Recipe quantity must be greater than zero.');
    if (stockItem.trackingMode === 'direct-sale' && stockItem.linkedMenuItemId === menuItemId) throw new Error(stockItem.name + ' already uses direct-sale stock for this menu item.');
    if (convertRecipeQuantity(ingredient.quantity, ingredient.unit, stockItem.unit) === null) throw new Error('Recipe unit ' + ingredient.unit + ' is incompatible with ' + stockItem.name + ' (' + stockItem.unit + ').');
    return { stockItemId: stockItem.id, stockItemName: stockItem.name, quantity: Math.round(ingredient.quantity * 1000) / 1000, unit: ingredient.unit.trim() };
  });
}
