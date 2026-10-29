import { Expense, SaleRecord, Shift, Staff, StaffRole, SupplierPayment } from '../types';

const salt = 'cafe-flex-pos-local-pin-v1';
export async function hashPin(pin: string) { const Crypto = await import('expo-crypto'); return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`); }
export async function verifyPin(pin: string, hash: string) { return (await hashPin(pin)) === hash; }
export function validPin(pin: string) { return /^\d{4,6}$/.test(pin); }
export function normalizeUsername(value: string) { return value.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').slice(0, 32); }
export function staffUsername(staff: Pick<Staff, 'name' | 'username'>) { return normalizeUsername(staff.username || staff.name); }
export function can(role: StaffRole | undefined, permission: 'void' | 'settings' | 'stockCorrection' | 'kitchen' | 'sales' | 'reports') {
  if (!role) return true;
  if (role === 'owner') return true;
  if (role === 'manager') return permission !== 'settings' || true;
  if (role === 'cashier') return permission === 'sales';
  if (role === 'waiter') return permission === 'sales' || permission === 'kitchen';
  return role === 'kitchen' && permission === 'kitchen';
}
export function shiftCashExpected(shift: Shift, sales: SaleRecord[], expenses: Expense[], payments: SupplierPayment[]) {
  const from = new Date(shift.openedAt).getTime(); const to = shift.closedAt ? new Date(shift.closedAt).getTime() : Infinity;
  const during = (date: string) => { const value = new Date(date).getTime(); return value >= from && value <= to; };
  const cashSales = sales.filter(s => s.status === 'Paid' && s.method === 'Cash' && during(s.createdAt)).reduce((sum, s) => sum + s.amount, 0);
  const cashExpenses = expenses.filter(e => e.status === 'active' && e.paymentMethod === 'cash' && during(e.expenseDate)).reduce((sum, e) => sum + e.amount, 0);
  const cashSupplierPayments = payments.filter(p => p.status === 'active' && p.paymentMethod === 'cash' && during(p.paymentDate)).reduce((sum, p) => sum + p.amount, 0);
  return Math.round((shift.openingCash + cashSales - cashExpenses - cashSupplierPayments) * 100) / 100;
}
