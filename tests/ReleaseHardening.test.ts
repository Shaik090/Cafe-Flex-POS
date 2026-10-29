import { createBackup, normalizePersistedPosState } from '../src/utils/backup';
import { getDailyReport, getExpensesForRange, getPurchasesForRange, getSalesForRange, getTaxReportBreakdown, getTopSellingItems } from '../src/utils/reports';

describe('release hardening selector stability', () => {
  it('normalizes and queries a mature local dataset without throwing', () => {
    const createdAt = '2026-09-20T10:00:00.000Z';
    const menuItems: any[] = Array.from({ length: 200 }, (_, index) => ({ id: `item-${index}`, name: `Item ${index}`, price: index + 1, category: 'Tea', available: true }));
    const sales: any[] = Array.from({ length: 5000 }, (_, index) => ({ id: `sale-${index}`, status: 'Paid', method: index % 2 ? 'Cash' : 'UPI', amount: 105, createdAt, date: '20 Sep 2026', time: '10:00 AM', items: [{ name: `Item ${index % 200}`, quantity: 1, unitPrice: 100 }], taxableSubtotal: 100, taxTotal: 5, taxLines: [{ itemName: `Item ${index % 200}`, taxableAmount: 100, taxRate: 5, taxAmount: 5, lineTotal: 105 }] }));
    const expenses: any[] = Array.from({ length: 1000 }, (_, index) => ({ id: `expense-${index}`, status: 'active', amount: 10, expenseDate: createdAt, categoryName: 'Supplies', paymentMethod: 'cash', createdAt }));
    const purchases: any[] = Array.from({ length: 1000 }, (_, index) => ({ id: `purchase-${index}`, status: 'completed', total: 25, purchaseDate: createdAt, items: [] }));
    const state: any = normalizePersistedPosState({ version: 1, shop: { name: 'Mature Cafe', setupComplete: true, modules: {} }, menuItems, cart: [], heldOrders: [], sales, expenses, purchases, stockItems: [], stockMovements: [], suppliers: [{ id: 'supplier', name: 'Supplier', isActive: true, createdAt }], supplierPayments: [], tables: [], openOrders: [], kitchenTickets: [] });
    const range = { start: '2026-09-20', end: '2026-09-20' };
    expect(getSalesForRange(state.sales, range)).toHaveLength(5000);
    expect(getExpensesForRange(state.expenses, range)).toHaveLength(1000);
    expect(getPurchasesForRange(state.purchases, range)).toHaveLength(1000);
    expect(getTopSellingItems(state.sales)).toHaveLength(200);
    expect(getTaxReportBreakdown(state.sales)).toEqual([{ rate: 5, label: 'GST 5%', taxableSales: 500000, taxCollected: 25000, sales: 525000 }]);
    expect(getDailyReport(range, state.sales, state.expenses)[0]).toMatchObject({ sales: 525000, expenses: 10000, net: 515000 });
    expect(createBackup(state).data.sales).toHaveLength(5000);
  });
});
