import { Expense, Purchase, SaleRecord, StockItem, Supplier, SupplierPayment } from '../types';
import { activeStockItems, stockCounts, stockStatus } from './stock';
import { supplierOutstanding } from './suppliers';

export type ReportPreset = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Custom Range';
export type DateRange = { start: string; end: string };
export type PaymentBreakdown = Record<'Cash' | 'UPI' | 'Card' | 'Other', number>;

const dayKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function reportRange(preset: ReportPreset, now = new Date()): DateRange {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === 'Yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
  if (preset === 'This Week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (preset === 'This Month') start.setDate(1);
  return { start: dayKey(start), end: dayKey(end) };
}

export function isValidRange(range: DateRange) { return /^\d{4}-\d{2}-\d{2}$/.test(range.start) && /^\d{4}-\d{2}-\d{2}$/.test(range.end) && range.start <= range.end; }
export function isInRange(value: string, range: DateRange) { const key = dayKey(value); return isValidRange(range) && key >= range.start && key <= range.end; }
export function getSalesForRange(sales: SaleRecord[], range: DateRange) { return sales.filter(sale => sale.status === 'Paid' && isInRange(sale.createdAt, range)); }
export function getExpensesForRange(expenses: Expense[], range: DateRange) { return expenses.filter(expense => expense.status === 'active' && isInRange(expense.expenseDate, range)); }
export function getPurchasesForRange(purchases: Purchase[], range: DateRange) { return purchases.filter(purchase => purchase.status === 'completed' && isInRange(purchase.purchaseDate, range)); }
export function getSupplierCreditPurchasesForRange(purchases: Purchase[], range: DateRange) { return purchases.filter(purchase => purchase.status === 'completed' && purchase.paymentMethod === 'credit' && isInRange(purchase.purchaseDate, range)); }
export function getSupplierPaymentsForRange(payments: SupplierPayment[], range: DateRange) { return payments.filter(payment => payment.status === 'active' && isInRange(payment.paymentDate, range)); }
export function getSupplierPaymentTotal(payments: SupplierPayment[]) { return payments.reduce((sum, payment) => sum + payment.amount, 0); }
export function getSupplierReportRows(suppliers: Supplier[], purchases: Purchase[], payments: SupplierPayment[], range: DateRange) {
  const credits = getSupplierCreditPurchasesForRange(purchases, range);
  const periodPayments = getSupplierPaymentsForRange(payments, range);
  return suppliers.map((supplier) => {
    const creditPurchases = credits.filter((purchase) => purchase.supplierId === supplier.id);
    const supplierPayments = periodPayments.filter((payment) => payment.supplierId === supplier.id);
    return { supplier, creditPurchases: moneyTotal(creditPurchases), payments: getSupplierPaymentTotal(supplierPayments), outstanding: supplierOutstanding(purchases, payments, supplier.id) };
  }).filter((row) => row.creditPurchases > 0 || row.payments > 0 || row.outstanding > 0);
}
export function moneyTotal(records: Array<{ amount?: number; total?: number }>) { return records.reduce((sum, item) => sum + (item.amount ?? item.total ?? 0), 0); }
export function getSalesTotal(sales: SaleRecord[]) { return moneyTotal(sales); }
export function getCogsSummary(sales: SaleRecord[]) { const incomplete = sales.some((sale) => sale.costingStatus === 'incomplete' || sale.costingStatus === undefined); const cogs = sales.reduce((sum, sale) => sum + (sale.costOfGoods ?? 0), 0); const revenue = getSalesTotal(sales); return { revenue, cogs, grossProfit: revenue - cogs, grossMargin: revenue ? (revenue - cogs) / revenue * 100 : 0, complete: !incomplete }; }
export function getItemProfitability(sales: SaleRecord[]) { const rows = new Map<string, { name: string; quantity: number; revenue: number; cogs: number; complete: boolean }>(); sales.forEach((sale) => { const revenue = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); sale.items.forEach((item) => { const row = rows.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0, cogs: 0, complete: true }; const itemRevenue = item.quantity * item.unitPrice; row.quantity += item.quantity; row.revenue += itemRevenue; row.cogs += revenue ? (sale.costOfGoods ?? 0) * itemRevenue / revenue : 0; row.complete = row.complete && sale.costingStatus === 'complete'; rows.set(item.name, row); }); }); return [...rows.values()].map((row) => ({ ...row, grossProfit: row.revenue - row.cogs, margin: row.revenue ? (row.revenue - row.cogs) / row.revenue * 100 : 0 })); }
export function getExpenseTotal(expenses: Expense[]) { return moneyTotal(expenses); }
export function getPurchaseTotal(purchases: Purchase[]) { return moneyTotal(purchases); }
export function getNet(sales: SaleRecord[], expenses: Expense[]) { return getSalesTotal(sales) - getExpenseTotal(expenses); }
export function getAverageOrderValue(sales: SaleRecord[]) { return sales.length ? getSalesTotal(sales) / sales.length : 0; }
export function getPaymentBreakdown(sales: SaleRecord[]): PaymentBreakdown {
  return sales.reduce<PaymentBreakdown>((totals, sale) => { const key = sale.method === 'Cash' ? 'Cash' : sale.method === 'UPI' ? 'UPI' : 'Other'; totals[key] += sale.amount; return totals; }, { Cash: 0, UPI: 0, Card: 0, Other: 0 });
}
export function getTaxReportBreakdown(sales: SaleRecord[]) {
  const rows = new Map<number, { taxableSales: number; taxCollected: number; sales: number }>();
  sales.forEach((sale) => sale.taxLines?.forEach((line) => {
    const current = rows.get(line.taxRate) ?? { taxableSales: 0, taxCollected: 0, sales: 0 };
    current.taxableSales += line.taxableAmount;
    current.taxCollected += line.taxAmount;
    current.sales += line.lineTotal;
    rows.set(line.taxRate, current);
  }));
  return [...rows.entries()].map(([rate, totals]) => ({ rate, label: rate === 0 ? 'No Tax' : `GST ${rate}%`, ...totals })).sort((a, b) => a.rate - b.rate);
}
export function getTopSellingItems(sales: SaleRecord[]) {
  const values = new Map<string, { quantity: number; revenue: number }>();
  sales.forEach(sale => sale.items.forEach(item => { const current = values.get(item.name) ?? { quantity: 0, revenue: 0 }; current.quantity += item.quantity; current.revenue += item.quantity * item.unitPrice; values.set(item.name, current); }));
  return [...values.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
}
export function getExpenseCategoryBreakdown(expenses: Expense[]) { return groupedTotal(expenses, expense => expense.categoryName); }
export function getExpensePaymentBreakdown(expenses: Expense[]) { return groupedTotal(expenses, expense => expense.paymentMethod.toUpperCase()); }
export function getPurchaseItemBreakdown(purchases: Purchase[]) {
  const values = new Map<string, { quantity: number; total: number }>();
  purchases.forEach(purchase => purchase.items.forEach(item => { const current = values.get(item.stockItemName) ?? { quantity: 0, total: 0 }; current.quantity += item.quantity; current.total += item.totalCost; values.set(item.stockItemName, current); }));
  return [...values.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.total - a.total);
}
export function getVendorTotals(purchases: Purchase[]) { return groupedTotal(purchases.filter(purchase => purchase.vendorName), purchase => purchase.vendorName!); }
export function getDailyReport(range: DateRange, sales: SaleRecord[], expenses: Expense[]) {
  if (!isValidRange(range)) return [];
  const rows: Array<{ date: string; sales: number; expenses: number; net: number }> = [];
  for (let day = new Date(`${range.start}T00:00:00`), end = new Date(`${range.end}T00:00:00`); day <= end; day.setDate(day.getDate() + 1)) { const date = dayKey(day); const daySales = sales.filter(sale => dayKey(sale.createdAt) === date); const dayExpenses = expenses.filter(expense => dayKey(expense.expenseDate) === date); const salesTotal = getSalesTotal(daySales); const expensesTotal = getExpenseTotal(dayExpenses); rows.push({ date, sales: salesTotal, expenses: expensesTotal, net: salesTotal - expensesTotal }); }
  return rows;
}
export function getStockReport(stockItems: StockItem[]) { const active = activeStockItems(stockItems); return { ...stockCounts(stockItems), items: active, lowStockItems: active.filter(item => stockStatus(item) !== 'In Stock') }; }

function groupedTotal<T>(items: T[], key: (item: T) => string) { const totals = new Map<string, number>(); items.forEach(item => totals.set(key(item), (totals.get(key(item)) ?? 0) + ((item as T & { amount?: number; total?: number }).amount ?? (item as T & { total?: number }).total ?? 0))); return [...totals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total); }
