const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

let disk = null, failWrites = false, runtime;
const storage = { getItem: async key => key === '@cafe-flex-pos/last-backup-at' ? null : disk, setItem: async (_, value) => { if (failWrites) throw new Error('storage unavailable'); disk = value; }, removeItem: async () => { disk = null; } };
const react = {
  useState(initial) { const index = runtime.index++; if (!(index in runtime.slots)) runtime.slots[index] = initial; return [runtime.slots[index], value => { runtime.slots[index] = typeof value === 'function' ? value(runtime.slots[index]) : value; }]; },
  useRef(initial) { const index = runtime.index++; if (!(index in runtime.slots)) runtime.slots[index] = { current: initial }; return runtime.slots[index]; }, useMemo: fn => fn(),
  useEffect(fn, deps) { const index = runtime.index++; const previous = runtime.slots[index]; if (!previous || deps.some((value, position) => value !== previous[position])) { runtime.slots[index] = deps; runtime.effects.push(fn); } },
};
const cache = new Map();
function load(file) { file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports; const module = { exports: {} }; cache.set(file, module); const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText; vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(name => name === 'react' ? react : name === '@react-native-async-storage/async-storage' ? { default: storage } : load(path.resolve(path.dirname(file), name + '.ts')), module, module.exports); return module.exports; }
const { createBackup, parseBackup, backupFilename, backupPreview } = load('src/utils/backup.ts');
const { usePosState } = load('src/store/usePosState.ts');
function render() { runtime.index = 0; runtime.effects = []; const pos = usePosState(); runtime.effects.forEach(effect => effect()); return pos; }
async function restart() { runtime = { slots: [], index: 0, effects: [] }; render(); await new Promise(resolve => setImmediate(resolve)); return render(); }

(async () => {
  const populated = {
    version: 1,
    shop: { name: 'Backup Cafe', type: 'Tea Shop', phone: '1', address: 'A', currency: 'INR', setupComplete: true, modules: { stock: true, expenses: true, customers: false, tables: true, kitchen: true, receiptPrinting: false }, enableTables: true, enableTokens: true, enableKitchen: true, enableTax: true, taxSettings: { legalBusinessName: 'Backup Cafe', gstin: '29ABCDE1234F1Z5', pricingMode: 'exclusive', defaultTaxRateId: 'gst-5' } },
    menuItems: [{ id: 'tea', name: 'Tea', price: 20, category: 'Tea', taxRateId: 'gst-5', taxRateName: 'GST 5%', taxRatePercent: 5, recipe: [{ stockItemId: 'milk', stockItemName: 'Milk', quantity: 0.2, unit: 'litre' }] }], cart: [], heldOrders: [{ id: 'hold', createdAt: '2026-01-01T00:00:00.000Z', items: [] }],
    sales: [{ id: 'sale', date: '01 Jan 2026', time: '10:00 AM', createdAt: '2026-01-01T00:00:00.000Z', items: [{ name: 'Tea', quantity: 1, unitPrice: 20 }], amount: 21, method: 'Cash', status: 'Paid', taxableSubtotal: 20, taxTotal: 1, taxPricingMode: 'exclusive', taxLines: [{ menuItemId: 'tea', itemName: 'Tea', taxableAmount: 20, taxRate: 5, taxAmount: 1, lineTotal: 21 }], costOfGoods: 10, costingStatus: 'complete', costLines: [{ stockItemId: 'milk', stockItemName: 'Milk', quantity: 0.2, unit: 'litre', unitCost: 50, totalCost: 10, source: 'recipe' }] }],
    expenses: [{ id: 'expense', categoryId: 'supplier', categoryName: 'Supplier Payment', amount: 30, paymentMethod: 'cash', expenseDate: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', status: 'active', linkedSupplierPaymentId: 'payment' }], expenseCategories: [],
    stockItems: [{ id: 'milk', name: 'Milk', unit: 'litre', quantity: 4.8, lowStockThreshold: 1, trackingMode: 'manual', isActive: true, createdAt: '2026-01-01T00:00:00.000Z', averageUnitCost: 50, inventoryValue: 240 }], stockMovements: [{ id: 'movement', stockItemId: 'milk', type: 'recipe_usage', quantity: -0.2, saleId: 'sale', createdAt: '2026-01-01T00:00:00.000Z' }],
    purchases: [{ id: 'purchase', purchaseNumber: 'P0001', supplierId: 'supplier', vendorName: 'Milk Co', items: [], paymentMethod: 'credit', subtotal: 100, additionalCost: 0, total: 100, purchaseDate: '2026-01-01T00:00:00.000Z', status: 'completed', createdAt: '2026-01-01T00:00:00.000Z' }], suppliers: [{ id: 'supplier', name: 'Milk Co', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }], supplierPayments: [{ id: 'payment', supplierId: 'supplier', amount: 30, paymentMethod: 'cash', paymentDate: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', status: 'active', linkedExpenseId: 'expense' }],
    tables: [{ id: 'table', name: 'Table 1', isActive: true, sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z' }], openOrders: [{ id: 'order', serviceMode: 'dine-in', tableId: 'table', tableName: 'Table 1', items: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], activeOpenOrderId: 'order', activeServiceMode: 'dine-in', nextTokenNumber: 24, kitchenDraftOrderId: 'draft', kitchenTickets: [{ id: 'ticket', orderId: 'order', serviceMode: 'dine-in', tableName: 'Table 1', items: [], status: 'new', createdAt: '2026-01-01T00:00:00.000Z' }], taxRates: [{ id: 'gst-5', name: 'GST 5%', rate: 5, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }],
  };
  const backup = createBackup(populated, '0.3.0', '2026-09-16T10:30:00.000Z');
  assert.equal(backup.format, 'cafe-flex-pos-backup'); assert.equal(backup.version, 1); assert.equal(backup.shopName, 'Backup Cafe'); assert.equal(backup.data.kitchenTickets.length, 1); assert.equal(backup.data.sales[0].costOfGoods, 10); assert.equal(backup.data.shop.enableTax, true); assert.equal(backup.data.shop.taxSettings.defaultTaxRateId, 'gst-5'); assert.equal(backup.data.taxRates[0].rate, 5); assert.equal(backup.data.menuItems[0].taxRateId, 'gst-5'); assert.equal(backup.data.sales[0].taxLines[0].taxAmount, 1);
  const decoded = parseBackup(JSON.stringify(backup)); assert.deepEqual(decoded.data, backup.data); assert.deepEqual(backupPreview(decoded), { shopName: 'Backup Cafe', createdAt: backup.createdAt, sales: 1, expenses: 1, stockItems: 1, purchases: 1 }); assert.equal(backupFilename('My Tea / Shop', new Date('2026-09-16')).endsWith('CafeFlexPOS-My-Tea-Shop-2026-09-16.json'), true);
  const freshBackup = createBackup({ version: 1, shop: null, menuItems: [], cart: [], heldOrders: [], sales: [] }); assert.equal(freshBackup.data.sales.length, 0);
  const legacyShape = parseBackup(JSON.stringify({ ...backup, data: { version: 1, shop: populated.shop, menuItems: [], cart: [], heldOrders: [], sales: [] } })); assert.deepEqual(legacyShape.data.stockItems, []); assert.deepEqual(legacyShape.data.kitchenTickets, []);
  assert.throws(() => parseBackup('{bad json')); assert.throws(() => parseBackup(JSON.stringify({ ...backup, format: 'other' }))); assert.throws(() => parseBackup(JSON.stringify({ ...backup, version: 2 }))); assert.throws(() => parseBackup(JSON.stringify({ ...backup, data: { version: 1 } })));

  // Restore replaces state as one persisted snapshot and rehydration does not replay historical work.
  disk = JSON.stringify({ version: 1, shop: { ...populated.shop, name: 'Current Cafe' }, menuItems: [], cart: [], heldOrders: [], sales: [], stockItems: [], expenses: [] });
  let pos = await restart(); await pos.restorePersistedState(decoded.data); pos = render();
  assert.equal(pos.shop.name, 'Backup Cafe'); assert.equal(pos.sales.length, 1); assert.equal(pos.stockMovements.length, 1); assert.equal(pos.expenses.length, 1); assert.equal(pos.expenses[0].linkedSupplierPaymentId, 'payment'); assert.equal(pos.supplierPayments[0].linkedExpenseId, 'expense'); assert.equal(pos.openOrders[0].tableId, 'table'); assert.equal(pos.kitchenTickets[0].orderId, 'order'); assert.equal(pos.sales[0].costLines[0].totalCost, 10); assert.equal(pos.shop.taxSettings.defaultTaxRateId, 'gst-5'); assert.equal(pos.taxRates[0].rate, 5); assert.equal(pos.menuItems[0].taxRatePercent, 5); assert.equal(pos.sales[0].taxLines[0].taxAmount, 1);
  pos = await restart(); assert.equal(pos.sales.length, 1); assert.equal(pos.stockMovements.length, 1); assert.equal(pos.expenses.length, 1); assert.equal(pos.kitchenTickets.length, 1); assert.equal(pos.stockItems[0].inventoryValue, 240); assert.equal(pos.sales[0].taxLines[0].taxRate, 5); assert.equal(pos.sales[0].taxTotal, 1);

  // A failed storage replacement never applies the pending restore to the running app.
  const beforeFailure = pos.shop.name; failWrites = true; await assert.rejects(() => pos.restorePersistedState({ ...decoded.data, shop: { ...decoded.data.shop, name: 'Broken Restore' } })); failWrites = false; pos = render(); assert.equal(pos.shop.name, beforeFailure);
  console.log('PASS: backup creation, validation, atomic restore, migration normalization, relationship integrity, and rehydration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
