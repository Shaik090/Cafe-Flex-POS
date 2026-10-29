import { StockItem, StockMovement, StockMovementType } from '../types';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export function stockStatus(item: Pick<StockItem, 'quantity' | 'lowStockThreshold'>): StockStatus {
  if (item.quantity <= 0) return 'Out of Stock';
  if (item.quantity <= item.lowStockThreshold) return 'Low Stock';
  return 'In Stock';
}

export function formatQuantity(quantity: number, unit: string): string {
  return `${Number.isInteger(quantity) ? quantity : quantity.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} ${unit}`;
}

export function activeStockItems(items: StockItem[]): StockItem[] {
  return items.filter((item) => item.isActive);
}

export function stockCounts(items: StockItem[]) {
  return activeStockItems(items).reduce((counts, item) => {
    const status = stockStatus(item);
    if (status === 'Low Stock') counts.lowStock += 1;
    if (status === 'Out of Stock') counts.outOfStock += 1;
    return counts;
  }, { totalItems: activeStockItems(items).length, lowStock: 0, outOfStock: 0 });
}

export function movementLabel(type: StockMovementType): string {
  return ({ opening: 'Opening', restock: 'Restock', usage: 'Usage', wastage: 'Wastage', correction: 'Correction', sale: 'Sale', sale_reversal: 'Sale reversal', recipe_usage: 'Recipe usage', recipe_reversal: 'Recipe reversal' })[type];
}

export function movementsForItem(movements: StockMovement[], stockItemId: string): StockMovement[] {
  return movements.filter((movement) => movement.stockItemId === stockItemId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
