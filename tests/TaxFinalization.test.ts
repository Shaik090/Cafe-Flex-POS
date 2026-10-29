import { calculateSaleTax } from '../src/utils/tax';
import { getSalesForRange, getTaxReportBreakdown } from '../src/utils/reports';
import { buildReceipt, receiptHtml } from '../src/utils/receipts';

const rates: any[] = [{ id: 'gst-5', name: 'GST 5%', rate: 5, isActive: true, createdAt: '2026-01-01' }, { id: 'gst-12', name: 'GST 12%', rate: 12, isActive: true, createdAt: '2026-01-01' }];
const menu: any[] = [{ id: 'a', name: 'Item A', taxRatePercent: 5 }, { id: 'b', name: 'Item B', taxRatePercent: 12 }, { id: 'c', name: 'Item C', taxRatePercent: -1 }];
const cart: any[] = [{ itemId: 'a', name: 'Item A', quantity: 1, unitPrice: 100, modifierNames: [] }, { itemId: 'b', name: 'Item B', quantity: 1, unitPrice: 100, modifierNames: [] }, { itemId: 'c', name: 'Item C', quantity: 1, unitPrice: 100, modifierNames: [] }];

describe('tax finalization', () => {
  it('calculates mixed rates and rounding with explicit No Tax items', () => {
    const result = calculateSaleTax(cart, menu, rates, { pricingMode: 'exclusive' });
    expect(result.lines.map(line => line.taxAmount)).toEqual([5, 12, 0]);
    expect(result.taxTotal).toBe(17); expect(result.total).toBe(317);
    const rounded = calculateSaleTax([{ key: 'a', itemId: 'a', name: 'Item A', quantity: 3, unitPrice: 33.33, modifierNames: [] }], menu, rates, { pricingMode: 'exclusive' });
    expect(rounded.taxTotal).toBe(5); expect(rounded.total).toBe(104.99);
  });

  it('uses sale tax snapshots for reports and receipt after tax configuration changes, while excluding voided sales', () => {
    const paid: any = { id: 'paid', status: 'Paid', method: 'Cash', amount: 237, createdAt: '2026-09-20T10:00:00.000Z', date: '20 Sep 2026', time: '10:00 AM', items: [], taxableSubtotal: 220, taxTotal: 17, taxPricingMode: 'exclusive', taxLines: [{ itemName: 'Item A', taxableAmount: 100, taxRate: 5, taxAmount: 5, lineTotal: 105 }, { itemName: 'Item B', taxableAmount: 100, taxRate: 12, taxAmount: 12, lineTotal: 112 }, { itemName: 'Item C', taxableAmount: 20, taxRate: 0, taxAmount: 0, lineTotal: 20 }] };
    const voided: any = { ...paid, id: 'voided', status: 'Voided', voidReason: 'Wrong bill', taxTotal: 5, taxLines: [paid.taxLines[0]] };
    const currentRatesChanged = rates.map(rate => ({ ...rate, rate: 18 }));
    expect(currentRatesChanged[0].rate).toBe(18);
    const active = getSalesForRange([paid, voided], { start: '2026-09-20', end: '2026-09-20' });
    const rows = getTaxReportBreakdown(active);
    expect(rows).toEqual([{ rate: 0, label: 'No Tax', taxableSales: 20, taxCollected: 0, sales: 20 }, { rate: 5, label: 'GST 5%', taxableSales: 100, taxCollected: 5, sales: 105 }, { rate: 12, label: 'GST 12%', taxableSales: 100, taxCollected: 12, sales: 112 }]);
    const receipt = buildReceipt({ name: 'Cafe', receiptSettings: {} } as any, voided);
    expect(receipt.taxableSubtotal).toBe(220); expect(receipt.taxTotal).toBe(5); expect(receipt.taxLines?.[0]?.taxRate).toBe(5);
    expect(receiptHtml(receipt)).toContain('VOIDED'); expect(receiptHtml(receipt)).toContain('Tax: ₹5');
  });
});
