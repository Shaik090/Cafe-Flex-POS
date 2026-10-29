import React from 'react';
import { render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { ReceiptPreview } from '../src/components/ReceiptPreview';
import { buildReceipt, receiptHtml } from '../src/utils/receipts';

const shop: any = { name: 'Tea Point', address: 'Madanapalle', phone: '9876543210', receiptSettings: { paperWidth: '80mm', footerMessage: 'Thank you!', showItemModifiers: true } };
const sale: any = { id: '1042', date: '16 Sep 2026', time: '1:25 PM', createdAt: '2026-09-16T13:25:00.000Z', status: 'Paid', method: 'UPI', serviceMode: 'takeaway', tokenNumber: 24, amount: 62, items: [{ name: 'Strong Tea', quantity: 2, unitPrice: 10, modifierNames: ['Less sugar'] }, { name: 'Bun', quantity: 2, unitPrice: 21 }] };

describe('ReceiptPreview', () => {
  it('uses historical completed-sale values and renders phone/tablet print actions', () => {
    const dimensions = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const receipt = buildReceipt(shop, sale); const phone = render(<ReceiptPreview receipt={receipt} visible onClose={jest.fn()} onPrint={jest.fn()} onShare={jest.fn()} />);
    expect(phone.getByText('Tea Point')).toBeTruthy(); expect(phone.getByText('Takeaway · Token 24')).toBeTruthy(); expect(phone.getByText('Less sugar')).toBeTruthy(); expect(phone.getByTestId('receipt-print')).toBeTruthy(); expect(phone.getByTestId('receipt-share')).toBeTruthy(); expect(phone.queryByText('VOIDED')).toBeNull();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 }); phone.unmount(); const tablet = render(<ReceiptPreview receipt={{ ...receipt, settings: { ...receipt.settings, paperWidth: '58mm' } }} visible onClose={jest.fn()} onPrint={jest.fn()} onShare={jest.fn()} />); expect(tablet.getByTestId('receipt-preview')).toBeTruthy();
  });
  it('marks voided receipts and keeps their historical data intact', () => {
    const receipt = buildReceipt(shop, { ...sale, status: 'Voided', voidReason: 'Wrong amount' }); const screen = render(<ReceiptPreview receipt={receipt} visible onClose={jest.fn()} onPrint={jest.fn()} onShare={jest.fn()} />);
    expect(screen.getByText('VOIDED')).toBeTruthy(); expect(screen.getByText('Void reason: Wrong amount')).toBeTruthy(); expect(receiptHtml(receipt)).toContain('VOIDED'); expect(receipt.items[0]!.unitPrice).toBe(10);
  });
  it('shows saved mixed-rate tax totals only when the sale has a tax snapshot', () => {
    const taxed: any = { ...sale, amount: 217, taxableSubtotal: 200, taxTotal: 17, taxPricingMode: 'exclusive', taxLines: [{ itemName: 'Tea', taxableAmount: 100, taxRate: 5, taxAmount: 5, lineTotal: 105 }, { itemName: 'Sandwich', taxableAmount: 100, taxRate: 12, taxAmount: 12, lineTotal: 112 }, { itemName: 'Water', taxableAmount: 0, taxRate: 0, taxAmount: 0, lineTotal: 0 }] };
    const taxedReceipt = buildReceipt(shop, taxed); const taxedScreen = render(<ReceiptPreview receipt={taxedReceipt} visible onClose={jest.fn()} onPrint={jest.fn()} onShare={jest.fn()} />);
    expect(taxedScreen.getByText('Taxable Amount: ₹200')).toBeTruthy(); expect(taxedScreen.getByText('Tax: ₹17')).toBeTruthy();
    taxedScreen.unmount();
    const normalScreen = render(<ReceiptPreview receipt={buildReceipt(shop, sale)} visible onClose={jest.fn()} onPrint={jest.fn()} onShare={jest.fn()} />);
    expect(normalScreen.queryByText(/Taxable Amount:/)).toBeNull(); expect(normalScreen.queryByText(/^Tax:/)).toBeNull();
  });
});


