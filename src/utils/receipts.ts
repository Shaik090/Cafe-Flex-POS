import { ReceiptSettings, SaleRecord, ShopProfile } from '../types';

export type ReceiptData = {
  receiptNumber: string; shopName: string; address?: string; phone?: string; gstin?: string; footerMessage?: string;
  dateTime: string; status: SaleRecord['status']; voidReason?: string; serviceMode?: string; tableName?: string; tokenNumber?: number;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number; modifiers: string[] }>;
  subtotal: number; total: number; taxableSubtotal?: number; taxTotal?: number; taxLines?: SaleRecord['taxLines']; taxPricingMode?: SaleRecord['taxPricingMode']; paymentMethod: string; settings: Required<Pick<ReceiptSettings, 'showOrderNumber' | 'showDateTime' | 'showPaymentMethod' | 'showServiceMode' | 'showTableToken' | 'showItemModifiers' | 'showDiscount' | 'paperWidth'>>;
};

export const defaultReceiptSettings: ReceiptData['settings'] = { showOrderNumber: true, showDateTime: true, showPaymentMethod: true, showServiceMode: true, showTableToken: true, showItemModifiers: true, showDiscount: false, paperWidth: '80mm' };
export const receiptMoney = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function buildReceipt(shop: ShopProfile | null | undefined, sale: SaleRecord): ReceiptData {
  const configured = shop?.receiptSettings ?? {}; const settings = { ...defaultReceiptSettings, ...configured };
  return {
    receiptNumber: sale.id, shopName: configured.shopName?.trim() || shop?.name || 'Cafe Flex POS', address: configured.address?.trim() || shop?.address?.trim() || undefined, phone: configured.phone?.trim() || shop?.phone?.trim() || undefined, gstin: configured.gstin?.trim() || undefined, footerMessage: configured.footerMessage?.trim() || 'Thank you!',
    dateTime: `${sale.date} · ${sale.time}`, status: sale.status, voidReason: sale.voidReason, serviceMode: sale.serviceMode, tableName: sale.tableName, tokenNumber: sale.tokenNumber,
    items: sale.items.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.quantity * item.unitPrice, modifiers: item.modifierNames ?? [] })), subtotal: sale.amount, total: sale.amount, paymentMethod: sale.method, taxableSubtotal: sale.taxableSubtotal, taxTotal: sale.taxTotal, taxLines: sale.taxLines, taxPricingMode: sale.taxPricingMode, settings,
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
export function receiptFilename(receipt: ReceiptData) { return `CafeFlex-Receipt-${receipt.receiptNumber.replace(/[^a-z0-9_-]/gi, '') || 'Sale'}.pdf`; }
export function receiptHtml(receipt: ReceiptData): string {
  const width = receipt.settings.paperWidth === '58mm' ? '58mm' : '80mm';
  const service = receipt.settings.showServiceMode && receipt.serviceMode ? `<div>${escapeHtml(receipt.serviceMode === 'dine-in' ? 'Dine-in' : receipt.serviceMode === 'takeaway' ? 'Takeaway' : 'Quick Sale')}${receipt.settings.showTableToken && receipt.tableName ? ` · ${escapeHtml(receipt.tableName)}` : ''}${receipt.settings.showTableToken && receipt.tokenNumber ? ` · Token ${receipt.tokenNumber}` : ''}</div>` : '';
  const rows = receipt.items.map(item => `<div class="item"><div><b>${escapeHtml(item.name)}</b>${receipt.settings.showItemModifiers && item.modifiers.length ? `<small>${escapeHtml(item.modifiers.join(', '))}</small>` : ''}<small>${item.quantity} × ${receiptMoney(item.unitPrice)}</small></div><b>${receiptMoney(item.lineTotal)}</b></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${width} auto;margin:4mm}body{font-family:Arial,sans-serif;width:${width};font-size:11px;color:#222}.center{text-align:center}.rule{border-top:1px dashed #444;margin:8px 0}.item{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.item small{display:block;color:#555;margin-top:2px}.total{display:flex;justify-content:space-between;font-size:15px;font-weight:bold}.void{border:2px solid #a22;color:#a22;text-align:center;font-size:18px;font-weight:bold;padding:4px;margin:8px 0}</style></head><body><div class="center"><b>${escapeHtml(receipt.shopName)}</b>${receipt.address ? `<div>${escapeHtml(receipt.address)}</div>` : ''}${receipt.phone ? `<div>Ph: ${escapeHtml(receipt.phone)}</div>` : ''}${receipt.gstin ? `<div>GSTIN: ${escapeHtml(receipt.gstin)}</div>` : ''}</div>${receipt.status !== 'Paid' ? `<div class="void">VOIDED</div>` : ''}<div class="rule"></div>${receipt.settings.showOrderNumber ? `<div>Receipt #${escapeHtml(receipt.receiptNumber)}</div>` : ''}${receipt.settings.showDateTime ? `<div>${escapeHtml(receipt.dateTime)}</div>` : ''}${service}<div class="rule"></div>${rows}<div class="rule"></div>${receipt.taxTotal !== undefined ? `<div>Taxable: ${receiptMoney(receipt.taxableSubtotal ?? 0)}</div><div>Tax: ${receiptMoney(receipt.taxTotal)}</div>` : ''}<div class="total"><span>TOTAL</span><span>${receiptMoney(receipt.total)}</span></div>${receipt.settings.showPaymentMethod ? `<div>Payment: ${escapeHtml(receipt.paymentMethod)}</div>` : ''}${receipt.voidReason ? `<div>Void reason: ${escapeHtml(receipt.voidReason)}</div>` : ''}<div class="rule"></div><div class="center">${escapeHtml(receipt.footerMessage ?? '')}</div></body></html>`;
}
