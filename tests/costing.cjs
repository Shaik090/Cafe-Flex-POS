const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

let disk = null;
let runtime;
const storage = {
  getItem: async () => disk,
  setItem: async (_, value) => { disk = value; },
  removeItem: async () => { disk = null; },
};
const react = {
  useState(initial) {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    return [runtime.slots[index], value => { runtime.slots[index] = typeof value === 'function' ? value(runtime.slots[index]) : value; }];
  },
  useRef(initial) { const index = runtime.index++; if (!(index in runtime.slots)) runtime.slots[index] = { current: initial }; return runtime.slots[index]; },
  useMemo: fn => fn(),
  useEffect(fn, deps) {
    const index = runtime.index++; const previous = runtime.slots[index];
    if (!previous || deps.some((value, position) => value !== previous[position])) { runtime.slots[index] = deps; runtime.effects.push(fn); }
  },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(name => name === 'react' ? react : name === '@react-native-async-storage/async-storage' ? { default: storage } : load(path.resolve(path.dirname(file), name + '.ts')), module, module.exports);
  return module.exports;
}

const { usePosState } = load('src/store/usePosState.ts');
const { convertRecipeQuantity, recipeRequirements } = load('src/utils/recipes.ts');
const { getCogsSummary, getExpensesForRange, getNet, getSalesForRange } = load('src/utils/reports.ts');

function render() { runtime.index = 0; runtime.effects = []; const pos = usePosState(); runtime.effects.forEach(effect => effect()); return pos; }
async function restart() { runtime = { slots: [], index: 0, effects: [] }; render(); await new Promise(resolve => setImmediate(resolve)); return render(); }
async function fresh(menuItems = []) {
  disk = JSON.stringify({ version: 1, shop: { name: 'Cost Lab', setupComplete: true, enableTables: true, enableKitchen: true, enableTokens: true, modules: { tables: true, kitchen: true } }, menuItems, cart: [], heldOrders: [], sales: [] });
  return restart();
}
function stock(pos, id) { return pos.stockItems.find(item => item.id === id); }
function close(actual, expected, message) { assert.ok(Math.abs(actual - expected) < 0.000001, `${message ?? 'value'}: expected ${expected}, got ${actual}`); }
function menu(pos, name) { return pos.menuItems.find(item => item.name === name); }
const now = () => new Date().toISOString();

(async () => {
  // Opening cost and successive purchases use the production weighted-value update.
  let pos = await fresh();
  const milkId = pos.saveStockItem({ name: 'Milk', unit: 'litre', quantity: 10, lowStockThreshold: 1, trackingMode: 'manual', unitCost: 20 }); pos = render();
  close(stock(pos, milkId).inventoryValue, 200, 'opening inventory value'); close(stock(pos, milkId).averageUnitCost, 20, 'opening average cost');
  pos.createPurchase({ vendorName: 'Cash Dairy', purchaseDate: now(), paymentMethod: 'cash', additionalCost: 0, items: [{ stockItemId: milkId, quantity: 10, unitCost: 30 }] }); pos = render();
  close(stock(pos, milkId).quantity, 20); close(stock(pos, milkId).inventoryValue, 500); close(stock(pos, milkId).averageUnitCost, 25);
  const supplierId = pos.saveSupplier({ name: 'Credit Dairy' }); pos = render();
  pos.createPurchase({ supplierId, purchaseDate: now(), paymentMethod: 'credit', additionalCost: 0, items: [{ stockItemId: milkId, quantity: 10, unitCost: 40 }] }); pos = render();
  close(stock(pos, milkId).quantity, 30); close(stock(pos, milkId).inventoryValue, 900); close(stock(pos, milkId).averageUnitCost, 30);
  assert.equal(pos.expenses.length, 1, 'only the paid purchase creates an expense');

  // Conversion helpers and recipe requirements reject incompatible dimensions.
  assert.equal(convertRecipeQuantity(1, 'kg', 'g'), 1000); assert.equal(convertRecipeQuantity(200, 'ml', 'litre'), 0.2); assert.equal(convertRecipeQuantity(1, 'kg', 'litre'), null);
  assert.throws(() => recipeRequirements([{ key: 'x', itemId: 'recipe', name: 'Recipe', quantity: 1, unitPrice: 10, modifierNames: [] }], [{ id: 'recipe', name: 'Recipe', price: 10, category: 'Tea', available: true, favourite: false, modifiers: [], recipe: [{ stockItemId: milkId, stockItemName: 'Milk', quantity: 1, unit: 'kg' }] }], [stock(pos, milkId)]));

  // Recipe COGS uses converted quantities and sale-time cost snapshots.
  pos = await fresh([{ id: 'tea', name: 'Tea', price: 30, category: 'Tea', available: true, favourite: false, modifiers: [] }]);
  const recipeMilk = pos.saveStockItem({ name: 'Milk', unit: 'litre', quantity: 10, lowStockThreshold: 1, trackingMode: 'manual', unitCost: 50 }); pos = render();
  const teaPowder = pos.saveStockItem({ name: 'Tea Powder', unit: 'kg', quantity: 2, lowStockThreshold: 0.1, trackingMode: 'manual', unitCost: 400 }); pos = render();
  const sugar = pos.saveStockItem({ name: 'Sugar', unit: 'kg', quantity: 2, lowStockThreshold: 0.1, trackingMode: 'manual', unitCost: 100 }); pos = render();
  pos.saveRecipe('tea', [{ stockItemId: recipeMilk, stockItemName: 'Milk', quantity: 200, unit: 'ml' }, { stockItemId: teaPowder, stockItemName: 'Tea Powder', quantity: 10, unit: 'g' }, { stockItemId: sugar, stockItemName: 'Sugar', quantity: 20, unit: 'g' }]); pos = render();
  pos.addItem(menu(pos, 'Tea')); pos = render(); pos.addItem(menu(pos, 'Tea')); pos = render(); pos.completePayment('Cash'); pos = render();
  const recipeSale = pos.sales[0];
  close(recipeSale.costOfGoods, 32, 'two tea recipe COGS'); assert.equal(recipeSale.costingStatus, 'complete');
  close(recipeSale.costLines.find(line => line.stockItemId === recipeMilk).quantity, 0.4); close(recipeSale.costLines.find(line => line.stockItemId === teaPowder).totalCost, 8); close(recipeSale.costLines.find(line => line.stockItemId === sugar).totalCost, 4);
  close(stock(pos, recipeMilk).inventoryValue, 480); close(stock(pos, teaPowder).inventoryValue, 792); close(stock(pos, sugar).inventoryValue, 196);

  // Direct-sale and mixed carts deduct each source once and retain value at the historical unit cost.
  pos = await fresh([{ id: 'tea', name: 'Tea', price: 30, category: 'Tea', available: true, favourite: false, modifiers: [], sendToKitchen: true }, { id: 'water', name: 'Water Bottle', price: 20, category: 'Drinks', available: true, favourite: false, modifiers: [] }]);
  const mixedMilk = pos.saveStockItem({ name: 'Milk', unit: 'litre', quantity: 10, lowStockThreshold: 1, trackingMode: 'manual', unitCost: 50 }); pos = render();
  const water = pos.saveStockItem({ name: 'Water Bottle Stock', unit: 'pcs', quantity: 10, lowStockThreshold: 1, trackingMode: 'direct-sale', linkedMenuItemId: 'water', unitCost: 12 }); pos = render();
  pos.saveRecipe('tea', [{ stockItemId: mixedMilk, stockItemName: 'Milk', quantity: 200, unit: 'ml' }]); pos = render();
  pos.addItem(menu(pos, 'Tea')); pos = render(); pos.addItem(menu(pos, 'Water Bottle')); pos = render(); pos.changeQuantity(pos.cart.find(line => line.itemId === 'water').key, 2); pos = render(); pos.completePayment('UPI'); pos = render();
  const mixedSale = pos.sales[0]; close(mixedSale.costOfGoods, 46); assert.deepEqual(mixedSale.costLines.map(line => line.source).sort(), ['direct-sale', 'recipe']); close(stock(pos, mixedMilk).quantity, 9.8); close(stock(pos, water).quantity, 7); close(stock(pos, water).inventoryValue, 84); close(stock(pos, water).averageUnitCost, 12);

  // Held, unpaid table, and Kitchen state never deduct stock or inventory value.
  const beforeHeldQuantity = stock(pos, mixedMilk).quantity; const beforeHeldValue = stock(pos, mixedMilk).inventoryValue;
  pos.addItem(menu(pos, 'Tea')); pos = render(); pos.holdCurrentSale(); pos = render(); close(stock(pos, mixedMilk).quantity, beforeHeldQuantity); close(stock(pos, mixedMilk).inventoryValue, beforeHeldValue);
  pos.resumeHeldOrder(pos.heldOrders[0].id); pos = render(); pos.clearCart(); pos = render(); const tableId = pos.saveTable({ name: 'Cost Table' }); pos = render(); const orderId = pos.openTableOrder(tableId); pos = render(); pos.addItem(menu(pos, 'Tea')); pos = render(); pos.sendToKitchen(); pos = render(); pos.updateKitchenTicket(pos.kitchenTickets[0].id, 'preparing'); pos = render();
  close(stock(pos, mixedMilk).quantity, beforeHeldQuantity); close(stock(pos, mixedMilk).inventoryValue, beforeHeldValue); pos.cancelOpenOrder(orderId); pos = render(); assert.equal(pos.sales.length, 1); assert.equal(pos.kitchenTickets[0].status, 'cancelled');

  // Sale void restores original snapshots exactly once, even after later purchase costs change.
  pos = await fresh([{ id: 'water', name: 'Water', price: 80, category: 'Drinks', available: true, favourite: false, modifiers: [] }]);
  const historicalWater = pos.saveStockItem({ name: 'Water Stock', unit: 'pcs', quantity: 10, lowStockThreshold: 1, trackingMode: 'direct-sale', linkedMenuItemId: 'water', unitCost: 50 }); pos = render();
  pos.addItem(menu(pos, 'Water')); pos = render(); pos.completePayment('Cash'); pos = render(); const historicalSale = pos.sales[0]; close(historicalSale.costOfGoods, 50); close(stock(pos, historicalWater).inventoryValue, 450);
  pos.createPurchase({ vendorName: 'Later price', purchaseDate: now(), paymentMethod: 'cash', additionalCost: 0, items: [{ stockItemId: historicalWater, quantity: 10, unitCost: 70 }] }); pos = render(); close(stock(pos, historicalWater).inventoryValue, 1150); close(getCogsSummary([historicalSale]).cogs, 50, 'report COGS uses the historical snapshot');
  pos.voidSale(historicalSale.id, 'Customer cancelled'); pos = render(); close(stock(pos, historicalWater).quantity, 20); close(stock(pos, historicalWater).inventoryValue, 1200); pos.voidSale(historicalSale.id, 'repeat'); pos = render(); close(stock(pos, historicalWater).inventoryValue, 1200); const historicalReversals = pos.stockMovements.filter(movement => movement.saleId === historicalSale.id && movement.type === 'sale_reversal').length; assert.equal(historicalReversals, 1); pos = await restart(); close(stock(pos, historicalWater).inventoryValue, 1200); assert.equal(pos.stockMovements.filter(movement => movement.saleId === historicalSale.id && movement.type === 'sale_reversal').length, historicalReversals);

  // Recipe edits after payment cannot change stored COGS or the void restoration amount.
  pos = await fresh([{ id: 'coffee', name: 'Coffee', price: 40, category: 'Coffee', available: true, favourite: false, modifiers: [] }]);
  const coffeeMilk = pos.saveStockItem({ name: 'Coffee Milk', unit: 'litre', quantity: 5, lowStockThreshold: 1, trackingMode: 'manual', unitCost: 50 }); pos = render();
  pos.saveRecipe('coffee', [{ stockItemId: coffeeMilk, stockItemName: 'Coffee Milk', quantity: 200, unit: 'ml' }]); pos = render(); pos.addItem(menu(pos, 'Coffee')); pos = render(); pos.completePayment('Cash'); pos = render(); const coffeeSale = pos.sales[0]; close(coffeeSale.costOfGoods, 10); pos.saveRecipe('coffee', [{ stockItemId: coffeeMilk, stockItemName: 'Coffee Milk', quantity: 500, unit: 'ml' }]); pos = render(); pos.voidSale(coffeeSale.id, 'recipe changed'); pos = render(); close(stock(pos, coffeeMilk).quantity, 5); close(stock(pos, coffeeMilk).inventoryValue, 250);

  // Missing cost basis is explicit and reports use persisted snapshots, not current stock.
  pos = await fresh([{ id: 'unknown', name: 'Unknown Cost Item', price: 25, category: 'Other', available: true, favourite: false, modifiers: [] }]);
  const unknown = pos.saveStockItem({ name: 'Unknown Cost Stock', unit: 'pcs', quantity: 2, lowStockThreshold: 0, trackingMode: 'direct-sale', linkedMenuItemId: 'unknown' }); pos = render(); pos.addItem(menu(pos, 'Unknown Cost Item')); pos = render(); pos.completePayment('Cash'); pos = render();
  const incompleteSale = pos.sales[0]; assert.equal(incompleteSale.costingStatus, 'incomplete'); assert.equal(getCogsSummary([incompleteSale]).complete, false);
  const completeSummary = getCogsSummary([{ ...incompleteSale, status: 'Paid', amount: 100, costingStatus: 'complete', costOfGoods: 40 }, { ...incompleteSale, id: 'voided', status: 'Voided', amount: 999, costingStatus: 'complete', costOfGoods: 999 }].filter(sale => sale.status === 'Paid'));
  close(completeSummary.revenue, 100); close(completeSummary.cogs, 40); close(completeSummary.grossProfit, 60); close(completeSummary.grossMargin, 60); close(getCogsSummary([]).grossMargin, 0);

  // Net remains sales minus active expenses. COGS and paid purchases are not a second Net deduction.
  const range = { start: '2020-01-01', end: '2030-01-01' };
  const netSales = getSalesForRange([{ ...incompleteSale, id: 'net', status: 'Paid', amount: 100, costOfGoods: 40 }], range);
  const netExpenses = getExpensesForRange([{ id: 'expense', status: 'active', amount: 30, expenseDate: now() }], range);
  close(getNet(netSales, netExpenses), 70);

  // Decimal quantities retain sensible precision through recipe conversion and COGS snapshots.
  pos = await fresh([{ id: 'decimal', name: 'Decimal Drink', price: 30, category: 'Drinks', available: true, favourite: false, modifiers: [] }]);
  const decimalMilk = pos.saveStockItem({ name: 'Decimal Milk', unit: 'litre', quantity: 1, lowStockThreshold: 0, trackingMode: 'manual', unitCost: 80 }); pos = render();
  const decimalTea = pos.saveStockItem({ name: 'Decimal Tea', unit: 'kg', quantity: 1, lowStockThreshold: 0, trackingMode: 'manual', unitCost: 500 }); pos = render();
  pos.saveRecipe('decimal', [{ stockItemId: decimalMilk, stockItemName: 'Decimal Milk', quantity: 0.125, unit: 'litre' }, { stockItemId: decimalTea, stockItemName: 'Decimal Tea', quantity: 0.008, unit: 'kg' }]); pos = render(); pos.addItem(menu(pos, 'Decimal Drink')); pos = render(); pos.completePayment('Cash'); pos = render(); close(pos.sales[0].costOfGoods, 14); close(stock(pos, decimalMilk).inventoryValue, 70); close(stock(pos, decimalTea).inventoryValue, 496);

  // Persisted cost fields and movements rehydrate without duplicate effects.
  const persistedSaleId = pos.sales[0].id; const movementCount = pos.stockMovements.length; pos = await restart();
  assert.equal(pos.sales.find(sale => sale.id === persistedSaleId).costOfGoods, 14); close(stock(pos, decimalMilk).averageUnitCost, 80); close(stock(pos, decimalMilk).inventoryValue, 70); assert.equal(pos.stockMovements.length, movementCount);

  console.log('PASS: focused costing engine workflow covers weighted costs, purchases, conversions, COGS snapshots, voids, reports, net, and persistence.');
})().catch(error => { console.error(error); process.exitCode = 1; });
