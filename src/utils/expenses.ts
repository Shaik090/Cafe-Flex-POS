import { Expense, ExpenseCategory, ExpensePaymentMethod } from '../types';
export type ExpensePeriod = 'Today' | 'Yesterday' | 'This Week' | 'This Month';
export const paymentLabels: Record<ExpensePaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };
export function starterExpenseCategories(): ExpenseCategory[] {
  return ['Milk/Ingredients', 'Supplies', 'Electricity', 'Rent', 'Staff', 'Transport', 'Maintenance', 'Packaging', 'Other'].map((name, i) => ({ id: `expense-category-${i}`, name, isActive: true, createdAt: new Date().toISOString() }));
}
export function inPeriod(value: string, period: ExpensePeriod, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start); end.setDate(end.getDate() + 1);
  if (period === 'Yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
  if (period === 'This Week') { start.setDate(start.getDate() - (start.getDay() + 6) % 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 7); }
  if (period === 'This Month') { start.setDate(1); end.setMonth(end.getMonth() + 1, 1); }
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}
export function expenseTotal(expenses: Expense[], period: ExpensePeriod, now = new Date()) {
  return expenses.filter(e => e.status === 'active' && inPeriod(e.expenseDate, period, now)).reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100;
}
export function localDateTime(value = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
export function parseLocalDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD HH:mm.');
  const date = new Date(value.replace(' ', 'T') + ':00');
  if (!Number.isFinite(date.getTime()) || localDateTime(date) !== value) throw new Error('Enter a valid date and time.');
  return date.toISOString();
}
