import { Purchase, SupplierPayment } from '../types';
export function supplierCreditPurchases(purchases: Purchase[], supplierId: string) { return purchases.filter(p => p.status === 'completed' && p.paymentMethod === 'credit' && p.supplierId === supplierId); }
export function supplierPayments(payments: SupplierPayment[], supplierId: string) { return payments.filter(p => p.supplierId === supplierId && p.status === 'active'); }
export function supplierOutstanding(purchases: Purchase[], payments: SupplierPayment[], supplierId: string) { return supplierCreditPurchases(purchases, supplierId).reduce((sum, p) => sum + p.total, 0) - supplierPayments(payments, supplierId).reduce((sum, p) => sum + p.amount, 0); }
export function totalSupplierDue(purchases: Purchase[], payments: SupplierPayment[]) { const ids = new Set(purchases.filter(p => p.supplierId).map(p => p.supplierId!)); return [...ids].reduce((sum, id) => sum + supplierOutstanding(purchases, payments, id), 0); }
export const getSupplierOutstanding = supplierOutstanding;
export const getTotalSupplierOutstanding = totalSupplierDue;
