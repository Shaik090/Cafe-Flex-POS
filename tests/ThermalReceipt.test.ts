import { buildReceipt } from '../src/utils/receipts';
import { formatThermalReceipt, formatThermalTestPrint } from '../src/utils/thermalReceipt';
const sale: any = { id:'sale-1', date:'20 Sep 2026', time:'10:00 AM', createdAt:'2026-09-20T04:30:00Z', status:'Paid', method:'Cash', amount:100, items:[{ name:'Very Long Sandwich Name That Must Wrap Safely', quantity:1, unitPrice:100, modifierNames:['No onion'] }] };
const shop: any = { name:'Cafe Flex', receiptSettings:{ showItemModifiers:true, paperWidth:'80mm' } };
describe('thermal receipt formatting', () => {
 it('formats 58mm and 80mm receipts from the real receipt model', () => { const receipt=buildReceipt(shop,sale); const narrow=formatThermalReceipt(receipt,{paperWidth:'58mm'}); const wide=formatThermalReceipt(receipt,{paperWidth:'80mm'}); expect(narrow).toContain('Cafe Flex'); expect(narrow).toContain('No onion'); expect(narrow).toContain('TOTAL'); expect(wide).toContain('-'.repeat(48)); expect(narrow).toContain('-'.repeat(32)); });
 it('marks voided receipts and makes a non-financial test print', () => { const receipt=buildReceipt(shop,{...sale,status:'Voided',voidReason:'Wrong order'}); expect(formatThermalReceipt(receipt,{paperWidth:'58mm'})).toContain('*** VOIDED ***'); expect(formatThermalReceipt(receipt,{paperWidth:'58mm'})).toContain('Wrong order'); expect(formatThermalTestPrint('Printer A','80mm')).toContain('Bluetooth Printer Test'); });
});
