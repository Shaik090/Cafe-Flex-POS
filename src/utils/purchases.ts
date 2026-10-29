import { PurchasePaymentMethod } from '../types';
import { inPeriod } from './expenses';

export type PurchasePeriod = 'Today' | 'This Week' | 'This Month';

export const purchasePaymentLabels: Record<PurchasePaymentMethod, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit', other: 'Other',
};

export function purchaseInPeriod(value: string, period: PurchasePeriod) {
  return inPeriod(value, period);
}

export function formatPurchaseMoney(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
