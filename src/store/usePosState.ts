import { useEffect, useMemo, useRef, useState } from 'react';
import { starterExpenseCategories } from '../utils/expenses';
import { calculateSaleTax } from '../utils/tax';
import { recipeRequirements, validateRecipe } from '../utils/recipes';
import { menuItems as starterMenu } from '../data/menu';
import { loadPosState, replacePosState, savePosState } from '../storage/posStorage';
import { normalizePersistedPosState } from '../utils/backup';
import { Expense, ExpenseCategory, ExpenseInput, Purchase, PurchaseInput, PurchaseItem, RecipeItem, SaleCostLine, StockItem, StockItemInput, StockMovement, StockMovementType, CartLine, HeldOrder, KitchenTicket, MenuItem, Modifier, OpenOrder, PaymentMethod, PersistedPosState, SaleRecord, ServiceMode, ShopProfile, Supplier, SupplierPayment, TableRecord, TaxRate, Staff, StaffRole, Shift } from '../types';
import { can, hashPin, normalizeUsername, shiftCashExpected, staffUsername, validPin, verifyPin } from '../utils/staff';
import { ensureShopIdentity, installationIdentity } from '../utils/deviceIdentity';
import { applyOperationalCommand, OperationalAuthorityState, OperationalCommandResult } from '../utils/operationalSync';

function buildKey(item: MenuItem, modifiers: Modifier[]) {
  const suffix = modifiers.map((modifier) => modifier.id).sort().join('-');
  return suffix ? `${item.id}:${suffix}` : item.id;
}

function makeSaleId(sales: SaleRecord[]) {
  const maxId = sales.reduce((max, sale) => Math.max(max, Number(sale.id) || 0), 0);
  return String(maxId + 1).padStart(4, '0');
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function defaultPersistedState(): PersistedPosState {
  return { version: 1, shop: null, menuItems: [], cart: [], heldOrders: [], sales: [] };
}

function stockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function roundedQuantity(quantity: number) {
  return Math.round(quantity * 1000) / 1000;
}

const stockPurchaseCategoryId = 'expense-category-stock-purchases';
const supplierPaymentCategoryId = 'expense-category-supplier-payment';

function makePurchaseNumber(purchases: Purchase[]) {
  const highest = purchases.reduce((max, purchase) => Math.max(max, Number(purchase.purchaseNumber.replace(/\D/g, '')) || 0), 0);
  return `P${String(highest + 1).padStart(4, '0')}`;
}

export function usePosState() {
  const [hydrated, setHydrated] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [activeOpenOrderId, setActiveOpenOrderId] = useState<string | null>(null);
  const [activeServiceMode, setActiveServiceMode] = useState<ServiceMode>('quick');
  const [nextTokenNumber, setNextTokenNumber] = useState(1);
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);
  const [kitchenDraftOrderId, setKitchenDraftOrderId] = useState(() => stockId('kitchen-draft'));
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<{ amount: number; method: PaymentMethod; saleId: string } | null>(null);
  const [operationalSyncStatus, setOperationalSyncStatus] = useState<'synced' | 'pending' | 'failed' | 'conflict'>('synced');
  const [operationalSyncMessage, setOperationalSyncMessage] = useState<string | null>(null);
  const paymentInFlight = useRef(false);
  const reversingSaleIds = useRef(new Set<string>());
  const purchaseInFlight = useRef(false);
  const voidingPurchaseIds = useRef(new Set<string>());
  const operationalRef = useRef<OperationalAuthorityState>({ shop: { name: '', serviceModes: undefined, enableTables: false, enableTokens: false, enableKitchen: false, enableTax: false, taxSettings: undefined }, menuItems: [], tables: [], openOrders: [], kitchenTickets: [], staff: [] });
  operationalRef.current = { shop: shop ? { name: shop.name, serviceModes: shop.serviceModes, enableTables: shop.enableTables, enableTokens: shop.enableTokens, enableKitchen: shop.enableKitchen, enableTax: shop.enableTax, taxSettings: shop.taxSettings } : operationalRef.current.shop, menuItems, tables, openOrders, kitchenTickets, staff };
  const normalizedCategories = (categories?: ExpenseCategory[]) => [...(categories?.length ? categories : starterExpenseCategories()), { id: stockPurchaseCategoryId, name: 'Stock Purchase / Purchases', isActive: true, createdAt: new Date().toISOString() }, { id: supplierPaymentCategoryId, name: 'Supplier Payment', isActive: true, createdAt: new Date().toISOString() }].filter((category, index, all) => all.findIndex(entry => entry.id === category.id) === index);
  const persistedSnapshot = (): PersistedPosState => ({ version: 1, shop, menuItems, cart, heldOrders, sales, expenses, expenseCategories, stockItems, stockMovements, purchases, suppliers, supplierPayments, tables, openOrders, activeOpenOrderId, activeServiceMode, nextTokenNumber, kitchenTickets, kitchenDraftOrderId, staff, shifts, taxRates });
  const applyPersistedState = (state: PersistedPosState, currentInstallation?: ReturnType<typeof installationIdentity>) => {
    const identifiedShop = ensureShopIdentity(state.shop, currentInstallation);
    setShop(identifiedShop); setMenuItems(state.menuItems ?? []); setCart(state.cart ?? []); setHeldOrders(state.heldOrders ?? []); setSales(state.sales ?? []);
    setExpenses(state.expenses ?? []); setExpenseCategories(normalizedCategories(state.expenseCategories)); setStockItems(state.stockItems ?? []); setStockMovements(state.stockMovements ?? []);
    setPurchases(state.purchases ?? []); setSuppliers(state.suppliers ?? []); setSupplierPayments(state.supplierPayments ?? []); setTables(state.tables ?? []); setOpenOrders(state.openOrders ?? []);
    setActiveOpenOrderId(state.activeOpenOrderId ?? null); setActiveServiceMode(state.activeServiceMode ?? 'quick'); setNextTokenNumber(state.nextTokenNumber ?? 1); setKitchenTickets(state.kitchenTickets ?? []); setKitchenDraftOrderId(state.kitchenDraftOrderId ?? stockId('kitchen-draft'));
    setStaff(state.staff ?? []); setTaxRates(state.taxRates ?? []); setShifts(state.shifts ?? []); setCurrentStaffId(null);
    paymentInFlight.current = false; purchaseInFlight.current = false; reversingSaleIds.current.clear(); voidingPurchaseIds.current.clear(); setHydrated(true);
  };
  const restorePersistedState = async (backup: PersistedPosState) => {
    const rollback = persistedSnapshot(); const currentInstallation = installationIdentity(shop); const normalized = normalizePersistedPosState(backup, true);
    const restored: PersistedPosState = { ...normalized, shop: ensureShopIdentity(normalized.shop, currentInstallation) };
    try { await replacePosState(restored); applyPersistedState(restored); }
    catch (error) { try { await replacePosState(rollback); } catch { /* Retain the in-memory rollback state even if storage is unavailable. */ } throw error; }
  };

  const hydrateFromStorage = () => {
    setHydrated(false); setStartupError(null);
    return loadPosState().then((result) => {
      if (result.recoveryError) { setStartupError(result.recoveryError); setHydrated(true); return; }
      applyPersistedState(result.state ?? defaultPersistedState());
    }).catch(() => { setStartupError('Local business data could not be read safely. It has not been deleted.'); setHydrated(true); });
  };

  useEffect(() => {
    let active = true;
    loadPosState().then((result) => {
      if (!active) return;
      if (result.recoveryError) { setStartupError(result.recoveryError); setHydrated(true); return; }
      applyPersistedState(result.state ?? defaultPersistedState());
    }).catch(() => {
      if (!active) return;
      setStartupError('Local business data could not be read safely. It has not been deleted.'); setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void savePosState({ version: 1, shop, menuItems, cart, heldOrders, sales, expenses, expenseCategories, stockItems, stockMovements, purchases, suppliers, supplierPayments, tables, openOrders, activeOpenOrderId, activeServiceMode, nextTokenNumber, kitchenTickets, kitchenDraftOrderId, staff, shifts, taxRates }).then(() => setPersistenceError(null)).catch(() => setPersistenceError('Changes could not be saved to this device. Check available storage before continuing.'));
  }, [hydrated, shop, menuItems, cart, heldOrders, sales, expenses, expenseCategories, stockItems, stockMovements, purchases, suppliers, supplierPayments, tables, openOrders, activeOpenOrderId, activeServiceMode, nextTokenNumber, kitchenTickets, kitchenDraftOrderId, staff, shifts, taxRates]);

  useEffect(() => {
    if (!cart.length) paymentInFlight.current = false;
  }, [cart.length]);

  useEffect(() => {
    if (purchases.length || hydrated) purchaseInFlight.current = false;
  }, [purchases.length, hydrated]);

  const completeShopSetup = (profile: ShopProfile, useStarterMenu: boolean) => {
    setShop(ensureShopIdentity({ ...profile, setupComplete: true }));
    setMenuItems((current) => current.length ? current : (useStarterMenu ? starterMenu : []));
  };

  const updateShop = (patch: Partial<ShopProfile>) => setShop((current) => current ? { ...current, ...patch } : current);
  const saveTable = (input: Pick<TableRecord, 'name' | 'capacity'>, id?: string) => {
    const name = input.name.trim(); if (!name) throw new Error('Table name is required.');
    const previous = id ? tables.find((table) => table.id === id) : undefined; const now = new Date().toISOString();
    const table: TableRecord = { id: previous?.id ?? stockId('table'), name, capacity: input.capacity && input.capacity > 0 ? input.capacity : undefined, isActive: previous?.isActive ?? true, sortOrder: previous?.sortOrder ?? tables.length, createdAt: previous?.createdAt ?? now, ...(previous ? { updatedAt: now } : {}) };
    setTables((current) => previous ? current.map((entry) => entry.id === table.id ? table : entry) : [...current, table]);
    return table.id;
  };
  const toggleTable = (id: string) => setTables((current) => current.map((table) => table.id === id ? { ...table, isActive: !table.isActive, updatedAt: new Date().toISOString() } : table));
  const updateOpenCart = (items: CartLine[]) => {
    setCart(items);
    if (activeOpenOrderId) setOpenOrders((current) => current.map((order) => order.id === activeOpenOrderId ? { ...order, items, updatedAt: new Date().toISOString() } : order));
  };
  const selectServiceMode = (mode: ServiceMode) => {
    if (activeOpenOrderId && mode !== 'dine-in') return;
    if (mode === 'takeaway' && activeServiceMode !== 'takeaway') setKitchenDraftOrderId(stockId('kitchen-draft'));
    setActiveServiceMode(mode);
  };
  const openTableOrder = (tableId: string) => {
    const table = tables.find((entry) => entry.id === tableId && entry.isActive); if (!table) throw new Error('Choose an active table.');
    const existing = openOrders.find((order) => order.tableId === tableId);
    if (existing) { setActiveOpenOrderId(existing.id); setActiveServiceMode('dine-in'); setCart(existing.items); return existing.id; }
    if (cart.length) throw new Error('Finish or hold the current sale before opening a table.');
    const now = new Date().toISOString(); const order: OpenOrder = { id: stockId('open-order'), serviceMode: 'dine-in', tableId, tableName: table.name, items: [], createdAt: now, updatedAt: now, ...(shop?.deviceId ? { originDeviceId: shop.deviceId } : {}), ...(currentStaff ? { createdByStaffId: currentStaff.id, createdByStaffName: currentStaff.name } : {}) };
    setOpenOrders((current) => [order, ...current]); setActiveOpenOrderId(order.id); setActiveServiceMode('dine-in'); setCart([]); return order.id;
  };
  const cancelKitchenTicketsForOrder = (orderId: string, now = new Date().toISOString()) => {
    setKitchenTickets((current) => current.map((ticket) => ticket.orderId === orderId && (ticket.status === 'new' || ticket.status === 'preparing' || ticket.status === 'ready') ? { ...ticket, status: 'cancelled', cancelledAt: ticket.cancelledAt ?? now } : ticket));
  };
  const cancelOpenOrder = (id: string) => {
    const order = openOrders.find((entry) => entry.id === id);
    const takeawayDraft = id === kitchenDraftOrderId && activeServiceMode === 'takeaway';
    if (!order && !takeawayDraft) return;
    const now = new Date().toISOString();
    cancelKitchenTicketsForOrder(id, now);
    if (order) setOpenOrders((current) => current.filter((entry) => entry.id !== id));
    if (activeOpenOrderId === id || takeawayDraft) {
      setActiveOpenOrderId(null);
      setActiveServiceMode('quick');
      setCart([]);
      if (takeawayDraft) setKitchenDraftOrderId(stockId('kitchen-draft'));
    }
  };

  const addMenuItem = (seed?: Partial<MenuItem>) => {
    const id = `item-${Date.now()}`;
    const item: MenuItem = {
      id,
      name: seed?.name ?? 'New Item',
      price: seed?.price ?? 10,
      category: seed?.category ?? 'Tea',
      available: seed?.available ?? true,
      favourite: seed?.favourite ?? false,
      modifiers: seed?.modifiers ?? [],
    };
    setMenuItems((current) => [item, ...current]);
    return id;
  };

  const updateMenuItem = (itemId: string, patch: Partial<MenuItem>) => setMenuItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  const saveRecipe = (itemId: string, recipe: RecipeItem[]) => {
    if (!menuItems.some((item) => item.id === itemId)) throw new Error('Menu item is unavailable.');
    const valid = validateRecipe(recipe, stockItems, itemId);
    setMenuItems((current) => current.map((item) => item.id === itemId ? { ...item, recipe: valid } : item));
  };
  const deleteMenuItem = (itemId: string) => setMenuItems((current) => current.filter((item) => item.id !== itemId));

  const addItem = (item: MenuItem, modifiers: Modifier[] = []) => {
    const modifierTotal = modifiers.reduce((sum, modifier) => sum + (modifier.priceDelta ?? 0), 0);
    const key = buildKey(item, modifiers);
    const current = cart;
    const next = (() => {
      const existing = current.find((line) => line.key === key);
      return existing ? current.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { key, itemId: item.id, name: item.name, quantity: 1, unitPrice: item.price + modifierTotal, modifierNames: modifiers.map((modifier) => modifier.name) }];
    })();
    updateOpenCart(next);
  };

  const changeQuantity = (key: string, delta: number) => updateOpenCart(cart.map((line) => line.key === key ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  const clearCart = () => updateOpenCart([]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const taxCalculation = useMemo(() => shop?.enableTax ? calculateSaleTax(cart, menuItems, taxRates, shop.taxSettings ?? { pricingMode: 'exclusive' }) : { lines: [], taxableSubtotal: subtotal, taxTotal: 0, total: subtotal, pricingMode: 'exclusive' as const }, [cart, menuItems, taxRates, shop, subtotal]);
  const total = taxCalculation.total;
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const holdCurrentSale = () => {
    if (!cart.length) return;
    setHeldOrders((orders) => [{ id: `hold-${Date.now()}`, createdAt: new Date().toISOString(), items: cart }, ...orders]);
    setCart([]);
  };

  const resumeHeldOrder = (heldOrderId: string) => {
    const held = heldOrders.find((order) => order.id === heldOrderId);
    if (!held) return;
    if (cart.length) {
      setHeldOrders((orders) => [{ id: `hold-${Date.now()}`, createdAt: new Date().toISOString(), items: cart }, ...orders.filter((order) => order.id !== heldOrderId)]);
    } else {
      setHeldOrders((orders) => orders.filter((order) => order.id !== heldOrderId));
    }
    setCart(held.items);
  };

  const deleteHeldOrder = (heldOrderId: string) => setHeldOrders((orders) => orders.filter((order) => order.id !== heldOrderId));

  const completePayment = (method: PaymentMethod) => {
    if (!cart.length || paymentInFlight.current) return;
    const recipeConsumptions = recipeRequirements(cart, menuItems, stockItems);
    const insufficient = recipeConsumptions.find((ingredient) => (stockItems.find((item) => item.id === ingredient.stockItemId)?.quantity ?? 0) < ingredient.quantity);
    if (insufficient) {
      const available = stockItems.find((item) => item.id === insufficient.stockItemId)?.quantity ?? 0;
      throw new Error('Insufficient stock: ' + insufficient.stockItemName + '. Required: ' + insufficient.quantity + ' ' + insufficient.unit + '. Available: ' + available + ' ' + insufficient.unit + '.');
    }
    const directCostLines: SaleCostLine[] = stockItems.filter((item) => item.trackingMode === 'direct-sale' && item.linkedMenuItemId).flatMap((stock) => {
      const quantity = cart.filter((line) => line.itemId === stock.linkedMenuItemId).reduce((sum, line) => sum + line.quantity, 0);
      return quantity ? [{ stockItemId: stock.id, stockItemName: stock.name, quantity, unit: stock.unit, unitCost: stock.averageUnitCost ?? 0, totalCost: quantity * (stock.averageUnitCost ?? 0), source: 'direct-sale' as const, menuItemId: stock.linkedMenuItemId }] : [];
    });
    const recipeCostLines: SaleCostLine[] = recipeConsumptions.map((ingredient) => { const stock = stockItems.find((item) => item.id === ingredient.stockItemId); const unitCost = stock?.averageUnitCost ?? 0; return { stockItemId: ingredient.stockItemId, stockItemName: ingredient.stockItemName, quantity: ingredient.quantity, unit: ingredient.unit, unitCost, totalCost: ingredient.quantity * unitCost, source: 'recipe' as const, menuItemId: ingredient.menuItemId }; });
    const costLines = [...directCostLines, ...recipeCostLines];
    paymentInFlight.current = true;
    const saleId = makeSaleId(sales);
    const now = new Date();
    const activeOrder = activeOpenOrderId ? openOrders.find((entry) => entry.id === activeOpenOrderId) : undefined;
    const sale: SaleRecord = {
      id: saleId,
      date: formatDate(now),
      time: now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
      createdAt: now.toISOString(),
      items: cart.map((line) => ({ name: line.name, quantity: line.quantity, unitPrice: line.unitPrice, modifierNames: line.modifierNames })),
      amount: total,
      method,
      status: 'Paid',
      serviceMode: activeServiceMode,
      ...(activeOrder ? { openOrderId: activeOrder.id, tableId: activeOrder.tableId, tableName: activeOrder.tableName } : {}),
      ...(activeServiceMode === 'takeaway' && shop?.enableTokens ? { tokenNumber: nextTokenNumber } : {}),
      ...(recipeConsumptions.length ? { recipeConsumptions } : {}),
      ...(shop?.enableTax ? { taxLines: taxCalculation.lines, taxableSubtotal: taxCalculation.taxableSubtotal, taxTotal: taxCalculation.taxTotal, taxPricingMode: taxCalculation.pricingMode } : {}),
      costLines, costOfGoods: Math.round(costLines.reduce((sum, line) => sum + line.totalCost, 0) * 100) / 100, costingStatus: costLines.every((line) => line.unitCost > 0) ? 'complete' : 'incomplete', ...(activeOrder?.originDeviceId || shop?.deviceId ? { originDeviceId: activeOrder?.originDeviceId ?? shop?.deviceId } : {}), ...(currentStaff ? { staffId: currentStaff.id, staffName: currentStaff.name } : activeOrder?.createdByStaffId ? { staffId: activeOrder.createdByStaffId, staffName: activeOrder.createdByStaffName } : {}),
    };
    setSales((current) => [sale, ...current]);
    const directSaleQuantities = cart.reduce<Record<string, number>>((quantities, line) => {
      quantities[line.itemId] = (quantities[line.itemId] ?? 0) + line.quantity;
      return quantities;
    }, {});
    const deductions = stockItems.filter((item) => item.isActive && item.trackingMode === 'direct-sale' && item.linkedMenuItemId && directSaleQuantities[item.linkedMenuItemId]).map((item) => ({ item, quantity: directSaleQuantities[item.linkedMenuItemId!] ?? 0 }));
    if (deductions.length) {
      setStockItems((current) => current.map((item) => {
        const deduction = deductions.find((entry) => entry.item.id === item.id);
        return deduction ? { ...item, quantity: roundedQuantity(item.quantity - deduction.quantity), updatedAt: now.toISOString() } : item;
      }));
      setStockMovements((current) => current.some((movement) => movement.type === 'sale' && movement.saleId === saleId) ? current : [
        ...deductions.map(({ item, quantity }) => ({ id: stockId('stock-movement'), stockItemId: item.id, type: 'sale' as const, quantity: -quantity, saleId, createdAt: now.toISOString() })),
        ...current,
      ]);
    }
    if (recipeConsumptions.length) {
      setStockItems((current) => current.map((item) => {
        const ingredient = recipeConsumptions.find((entry) => entry.stockItemId === item.id);
        return ingredient ? { ...item, quantity: roundedQuantity(item.quantity - ingredient.quantity), updatedAt: now.toISOString() } : item;
      }));
      setStockMovements((current) => current.some((movement) => movement.type === 'recipe_usage' && movement.saleId === saleId) ? current : [
        ...recipeConsumptions.map((ingredient) => ({ id: stockId('stock-movement'), stockItemId: ingredient.stockItemId, type: 'recipe_usage' as const, quantity: -ingredient.quantity, saleId, menuItemId: ingredient.menuItemId, note: ingredient.menuItemName + ' × ' + (cart.find((line) => line.itemId === ingredient.menuItemId)?.quantity ?? 1), createdAt: now.toISOString() })),
        ...current,
      ]);
    }
    if (costLines.length) setStockItems((current) => current.map((item) => {
      const cost = costLines.filter((line) => line.stockItemId === item.id).reduce((sum, line) => sum + line.totalCost, 0);
      return cost ? { ...item, inventoryValue: Math.max(0, Math.round(((item.inventoryValue ?? 0) - cost) * 100) / 100) } : item;
    }));
    setLastPayment({ amount: total, method, saleId });
    const ticketOrderId = activeOpenOrderId ?? kitchenDraftOrderId;
    setKitchenTickets((current) => current.map((ticket) => ticket.orderId === ticketOrderId && !ticket.saleId ? { ...ticket, saleId } : ticket));
    setCart([]);
    if (activeOpenOrderId) { setOpenOrders((current) => current.filter((order) => order.id !== activeOpenOrderId)); setActiveOpenOrderId(null); setActiveServiceMode('quick'); }
    else setKitchenDraftOrderId(stockId('kitchen-draft'));
    if (activeServiceMode === 'takeaway' && shop?.enableTokens) setNextTokenNumber((current) => current + 1);
  };

  const voidSale = (saleId: string, reason: string) => {
    if (!can(currentStaff?.role, 'void')) throw new Error('You do not have permission to void sales.');
    if (!reason.trim() || reversingSaleIds.current.has(saleId)) return;
    const sale = sales.find((current) => current.id === saleId && current.status === 'Paid');
    const saleDeductions = stockMovements.filter((movement) => movement.type === 'sale' && movement.saleId === saleId);
    const alreadyReversed = stockMovements.some((movement) => movement.type === 'sale_reversal' && movement.saleId === saleId);
    const now = new Date().toISOString();
    setSales((current) => current.map((sale) => sale.id === saleId && sale.status === 'Paid' ? { ...sale, status: 'Voided', voidReason: reason.trim(), voidedAt: new Date().toISOString() } : sale));
    setKitchenTickets((current) => current.map((ticket) => {
      if (ticket.saleId !== saleId) return ticket;
      if (ticket.status === 'new' || ticket.status === 'preparing' || ticket.status === 'ready') return { ...ticket, status: 'cancelled', cancelledAt: ticket.cancelledAt ?? now, saleVoidedAt: now };
      return { ...ticket, saleVoidedAt: ticket.saleVoidedAt ?? now };
    }));
    if (sale && saleDeductions.length && !alreadyReversed) {
      reversingSaleIds.current.add(saleId);
      setStockItems((current) => current.map((item) => {
        const deduction = saleDeductions.find((movement) => movement.stockItemId === item.id);
        return deduction ? { ...item, quantity: roundedQuantity(item.quantity - deduction.quantity), updatedAt: now } : item;
      }));
      setStockMovements((current) => current.some((movement) => movement.type === 'sale_reversal' && movement.saleId === saleId) ? current : [
        ...saleDeductions.map((movement) => ({ id: stockId('stock-movement'), stockItemId: movement.stockItemId, type: 'sale_reversal' as const, quantity: -movement.quantity, saleId, createdAt: now })),
        ...current,
      ]);
    }
    const recipeDeductions = stockMovements.filter((movement) => movement.type === 'recipe_usage' && movement.saleId === saleId);
    const recipeAlreadyReversed = stockMovements.some((movement) => movement.type === 'recipe_reversal' && movement.saleId === saleId);
    if (sale && sale.recipeConsumptions?.length && !recipeAlreadyReversed) {
      setStockItems((current) => current.map((item) => {
        const ingredient = sale.recipeConsumptions!.find((entry) => entry.stockItemId === item.id);
        return ingredient ? { ...item, quantity: roundedQuantity(item.quantity + ingredient.quantity), updatedAt: now } : item;
      }));
      setStockMovements((current) => current.some((movement) => movement.type === 'recipe_reversal' && movement.saleId === saleId) ? current : [
        ...sale.recipeConsumptions!.map((ingredient) => ({ id: stockId('stock-movement'), stockItemId: ingredient.stockItemId, type: 'recipe_reversal' as const, quantity: ingredient.quantity, saleId, menuItemId: ingredient.menuItemId, note: 'Sale void reversal: ' + ingredient.menuItemName, createdAt: now })),
        ...current,
      ]);
    } else if (recipeDeductions.length && !recipeAlreadyReversed) {
      setStockItems((current) => current.map((item) => {
        const deduction = recipeDeductions.find((movement) => movement.stockItemId === item.id);
        return deduction ? { ...item, quantity: roundedQuantity(item.quantity - deduction.quantity), updatedAt: now } : item;
      }));
      setStockMovements((current) => [...recipeDeductions.map((movement) => ({ ...movement, id: stockId('stock-movement'), type: 'recipe_reversal' as const, quantity: -movement.quantity, note: 'Sale void reversal', createdAt: now })), ...current]);
    }
    if (sale?.costLines?.length) setStockItems((current) => current.map((item) => {
      const cost = sale.costLines!.filter((line) => line.stockItemId === item.id).reduce((sum, line) => sum + line.totalCost, 0);
      return cost ? { ...item, inventoryValue: Math.round(((item.inventoryValue ?? 0) + cost) * 100) / 100 } : item;
    }));
  };
  const clearLastPayment = () => setLastPayment(null);

  const saveExpense = (input: ExpenseInput, id?: string) => {
    const previous = id ? expenses.find(e => e.id === id) : undefined;
    if (id && (!previous || previous.status === 'voided')) throw new Error('This expense cannot be edited.');
    const category = expenseCategories.find(c => c.id === input.categoryId);
    if (!category || (!category.isActive && previous?.categoryId !== category.id)) throw new Error('Choose an active category.');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Amount must be greater than zero.');
    if (!['cash', 'upi', 'card', 'other'].includes(input.paymentMethod)) throw new Error('Choose a payment method.');
    if (!Number.isFinite(new Date(input.expenseDate).getTime())) throw new Error('Enter a valid date and time.');
    const now = new Date().toISOString();
    const expense: Expense = { ...input, amount: Math.round(input.amount * 100) / 100, note: input.note?.trim() || undefined,
      id: previous?.id ?? `expense-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      categoryName: previous?.categoryId === category.id ? previous.categoryName : category.name,
      createdAt: previous?.createdAt ?? now, ...(previous ? { updatedAt: now } : {}), status: 'active', ...(currentStaff ? { staffId: currentStaff.id, staffName: currentStaff.name } : {}) };
    if (expense.amount <= 0) throw new Error('Amount must be at least ₹0.01.');
    setExpenses(current => previous ? current.map(e => e.id === previous.id && e.status === 'active' ? expense : e) : [expense, ...current]);
    return expense.id;
  };
  const voidExpense = (id: string, reason: string) => {
    if (!reason.trim()) throw new Error('Void reason is required.');
    const now = new Date().toISOString();
    setExpenses(current => current.map(e => e.id === id && e.status === 'active' ? { ...e, status: 'voided', voidReason: reason.trim(), voidedAt: now, updatedAt: now } : e));
  };
  const saveExpenseCategory = (name: string, id?: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required.');
    if (expenseCategories.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) throw new Error('Category already exists.');
    setExpenseCategories(current => id ? current.map(c => c.id === id ? { ...c, name: trimmed } : c) : [...current, { id: `category-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: trimmed, isActive: true, createdAt: new Date().toISOString() }]);
  };
  const toggleExpenseCategory = (id: string) => setExpenseCategories(current => current.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));

  const saveSupplier = (input: Omit<Supplier, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const name = input.name.trim(); if (!name) throw new Error('Supplier name is required.'); const previous = id ? suppliers.find(supplier => supplier.id === id) : undefined; const now = new Date().toISOString(); const supplier: Supplier = { id: previous?.id ?? stockId('supplier'), name, phone: input.phone?.trim() || undefined, address: input.address?.trim() || undefined, note: input.note?.trim() || undefined, isActive: previous?.isActive ?? true, createdAt: previous?.createdAt ?? now, ...(previous ? { updatedAt: now } : {}) }; setSuppliers(current => previous ? current.map(entry => entry.id === id ? supplier : entry) : [supplier, ...current]); return supplier.id;
  };
  const toggleSupplier = (id: string) => setSuppliers(current => current.map(supplier => supplier.id === id ? { ...supplier, isActive: !supplier.isActive, updatedAt: new Date().toISOString() } : supplier));
  const recordSupplierPayment = (input: Omit<SupplierPayment, 'id' | 'createdAt' | 'status' | 'linkedExpenseId'>) => {
    const supplier = suppliers.find(entry => entry.id === input.supplierId); if (!supplier) throw new Error('Choose a supplier.'); if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Amount must be greater than zero.'); const credit = purchases.filter(purchase => purchase.status === 'completed' && purchase.paymentMethod === 'credit' && purchase.supplierId === input.supplierId).reduce((sum, purchase) => sum + purchase.total, 0); const paid = supplierPayments.filter(payment => payment.status === 'active' && payment.supplierId === input.supplierId).reduce((sum, payment) => sum + payment.amount, 0); if (input.amount > credit - paid) throw new Error('Payment cannot exceed outstanding balance.'); const now = new Date().toISOString(); const id = stockId('supplier-payment'); const expenseId = stockId('expense-supplier-payment'); const payment: SupplierPayment = { ...input, amount: Math.round(input.amount * 100) / 100, note: input.note?.trim() || undefined, id, createdAt: now, status: 'active', linkedExpenseId: expenseId, ...(currentStaff ? { staffId: currentStaff.id, staffName: currentStaff.name } : {}) }; const category = expenseCategories.find(entry => entry.id === supplierPaymentCategoryId)!; const expense: Expense = { id: expenseId, categoryId: category.id, categoryName: category.name, amount: payment.amount, paymentMethod: payment.paymentMethod, note: `Supplier payment · ${supplier.name}`, expenseDate: payment.paymentDate, createdAt: now, status: 'active', linkedSupplierPaymentId: id }; setSupplierPayments(current => [payment, ...current]); setExpenses(current => [expense, ...current]); return id;
  };
  const voidSupplierPayment = (id: string, reason: string) => { if (!can(currentStaff?.role, 'void')) throw new Error('You do not have permission to void supplier payments.'); if (!reason.trim()) throw new Error('Void reason is required.'); const now = new Date().toISOString(); const payment = supplierPayments.find(entry => entry.id === id && entry.status === 'active'); if (!payment) return; setSupplierPayments(current => current.map(entry => entry.id === id ? { ...entry, status: 'voided', voidReason: reason.trim(), voidedAt: now } : entry)); setExpenses(current => current.map(expense => expense.id === payment.linkedExpenseId && expense.status === 'active' ? { ...expense, status: 'voided', voidReason: reason.trim(), voidedAt: now, updatedAt: now } : expense)); };

  const saveStockItem = (input: StockItemInput, id?: string, correctionNote?: string) => {
    const name = input.name.trim();
    const unit = input.unit.trim();
    const quantity = roundedQuantity(input.quantity);
    const lowStockThreshold = roundedQuantity(input.lowStockThreshold);
    const previous = id ? stockItems.find((item) => item.id === id) : undefined;
    if (!name || !unit) throw new Error('Name and unit are required.');
    if (!Number.isFinite(quantity) || !Number.isFinite(lowStockThreshold) || quantity < 0 || lowStockThreshold < 0) throw new Error('Quantity and low-stock alert must be zero or more.');
    if (input.trackingMode === 'direct-sale' && !input.linkedMenuItemId) throw new Error('Link a menu item for Direct Sale stock.');
    if (input.trackingMode === 'direct-sale' && !menuItems.some((menuItem) => menuItem.id === input.linkedMenuItemId)) throw new Error('Choose an existing menu item.');
    if (input.trackingMode === 'direct-sale' && stockItems.some((item) => item.id !== id && item.isActive && item.trackingMode === 'direct-sale' && item.linkedMenuItemId === input.linkedMenuItemId)) throw new Error('That menu item is already linked to active stock.');
    if (previous && previous.quantity !== quantity && !correctionNote?.trim()) throw new Error('A correction reason is required when changing current quantity.');
    const now = new Date().toISOString();
    if (input.unitCost !== undefined && (!Number.isFinite(input.unitCost) || input.unitCost < 0)) throw new Error('Unit cost must be zero or more.');
    const inventoryValue = input.unitCost !== undefined ? Math.round(quantity * input.unitCost * 100) / 100 : previous?.inventoryValue;
    const item: StockItem = { id: previous?.id ?? stockId('stock'), name, unit, quantity, lowStockThreshold, trackingMode: input.trackingMode, linkedMenuItemId: input.trackingMode === 'direct-sale' ? input.linkedMenuItemId : undefined, isActive: previous?.isActive ?? true, createdAt: previous?.createdAt ?? now, averageUnitCost: input.unitCost ?? previous?.averageUnitCost, inventoryValue, ...(previous ? { updatedAt: now } : {}) };
    setStockItems((current) => previous ? current.map((existing) => existing.id === previous.id ? item : existing) : [item, ...current]);
    if (!previous || previous.quantity !== quantity) {
      const movement: StockMovement = { id: stockId('stock-movement'), stockItemId: item.id, type: previous ? 'correction' : 'opening', quantity: previous ? roundedQuantity(quantity - previous.quantity) : quantity, note: previous ? correctionNote?.trim() : 'Opening quantity', createdAt: now };
      setStockMovements((current) => [movement, ...current]);
    }
    return item.id;
  };

  const adjustStock = (stockItemId: string, type: Exclude<StockMovementType, 'opening' | 'sale' | 'sale_reversal'>, quantity: number, note?: string) => {
    const item = stockItems.find((current) => current.id === stockItemId && current.isActive);
    const rounded = roundedQuantity(quantity);
    if (!item) throw new Error('Stock item is unavailable.');
    if (!Number.isFinite(rounded) || rounded === 0) throw new Error('Enter a non-zero quantity.');
    if ((type === 'restock' && rounded <= 0) || ((type === 'usage' || type === 'wastage') && rounded >= 0)) throw new Error('Use the expected quantity direction.');
    if (type === 'correction' && !can(currentStaff?.role, 'stockCorrection')) throw new Error('You do not have permission for stock corrections.');
    if (type === 'correction' && !note?.trim()) throw new Error('A correction reason is required.');
    const now = new Date().toISOString();
    const movement: StockMovement = { id: stockId('stock-movement'), stockItemId, type, quantity: rounded, note: note?.trim() || undefined, createdAt: now };
    setStockItems((current) => current.map((existing) => existing.id === stockItemId ? { ...existing, quantity: roundedQuantity(existing.quantity + rounded), updatedAt: now } : existing));
    setStockMovements((current) => [movement, ...current]);
  };

  const deactivateStockItem = (stockItemId: string) => setStockItems((current) => current.map((item) => item.id === stockItemId ? { ...item, isActive: false, updatedAt: new Date().toISOString() } : item));

  const createPurchase = (input: PurchaseInput) => {
    if (purchaseInFlight.current) return;
    if (!Number.isFinite(new Date(input.purchaseDate).getTime())) throw new Error('Enter a valid purchase date and time.');
    if (!Number.isFinite(input.additionalCost) || input.additionalCost < 0) throw new Error('Additional cost must be zero or more.');
    if (!input.items.length) throw new Error('Add at least one stock item.');
    const supplier = input.supplierId ? suppliers.find(entry => entry.id === input.supplierId) : undefined;
    if (input.paymentMethod === 'credit' && (!supplier || !supplier.isActive)) throw new Error('Choose an active supplier for a credit purchase.');
    if (new Set(input.items.map((item) => item.stockItemId)).size !== input.items.length) throw new Error('Each stock item can appear only once in a purchase.');
    const purchaseItems: PurchaseItem[] = input.items.map((inputItem) => {
      const stockItem = stockItems.find((item) => item.id === inputItem.stockItemId && item.isActive);
      const quantity = roundedQuantity(inputItem.quantity);
      const unitCost = Math.round(inputItem.unitCost * 100) / 100;
      if (!stockItem) throw new Error('Choose active stock items.');
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) throw new Error('Enter valid item quantities and costs.');
      return { id: stockId('purchase-item'), stockItemId: stockItem.id, stockItemName: stockItem.name, quantity, unit: stockItem.unit, unitCost, totalCost: Math.round(quantity * unitCost * 100) / 100 };
    });
    const now = new Date().toISOString();
    const subtotal = Math.round(purchaseItems.reduce((sum, item) => sum + item.totalCost, 0) * 100) / 100;
    const total = Math.round((subtotal + input.additionalCost) * 100) / 100;
    const purchaseId = stockId('purchase');
    const paid = input.paymentMethod !== 'credit';
    const linkedExpenseId = paid ? stockId('expense-purchase') : undefined;
    const purchase: Purchase = { id: purchaseId, purchaseNumber: makePurchaseNumber(purchases), vendorName: supplier?.name ?? (input.vendorName?.trim() || undefined), supplierId: supplier?.id, items: purchaseItems, paymentMethod: input.paymentMethod, subtotal, additionalCost: input.additionalCost, total, note: input.note?.trim() || undefined, purchaseDate: input.purchaseDate, status: 'completed', createdAt: now, linkedExpenseId, ...(currentStaff ? { staffId: currentStaff.id, staffName: currentStaff.name } : {}) };
    purchaseInFlight.current = true;
    setPurchases((current) => current.some((existing) => existing.id === purchaseId) ? current : [purchase, ...current]);
    setStockItems((current) => current.map((item) => {
      const purchased = purchaseItems.find((entry) => entry.stockItemId === item.id);
      if (!purchased) return item;
      const quantity = roundedQuantity(item.quantity + purchased.quantity); const inventoryValue = Math.round(((item.inventoryValue ?? 0) + purchased.totalCost) * 100) / 100;
      return { ...item, quantity, inventoryValue, averageUnitCost: quantity ? Math.round(inventoryValue / quantity * 10000) / 10000 : undefined, updatedAt: now };
    }));
    setStockMovements((current) => current.some((movement) => movement.purchaseId === purchaseId && movement.type === 'restock') ? current : [
      ...purchaseItems.map((item) => ({ id: stockId('stock-movement'), stockItemId: item.stockItemId, type: 'restock' as const, quantity: item.quantity, note: `Purchase #${purchase.purchaseNumber}`, purchaseId, createdAt: now })),
      ...current,
    ]);
    if (paid && linkedExpenseId) {
      const category = expenseCategories.find((entry) => entry.id === stockPurchaseCategoryId) ?? { id: stockPurchaseCategoryId, name: 'Stock Purchase / Purchases' };
      const paymentMethod = input.paymentMethod as Exclude<typeof input.paymentMethod, 'credit'>;
      const expense: Expense = { id: linkedExpenseId, categoryId: category.id, categoryName: category.name, amount: total, paymentMethod, note: `Purchase #${purchase.purchaseNumber}${purchase.vendorName ? ` · ${purchase.vendorName}` : ''}`, expenseDate: input.purchaseDate, createdAt: now, status: 'active', linkedPurchaseId: purchaseId };
      setExpenses((current) => current.some((entry) => entry.linkedPurchaseId === purchaseId) ? current : [expense, ...current]);
    }
    return purchaseId;
  };

  const voidPurchase = (purchaseId: string, reason: string, allowNegativeStock = false) => {
    if (!can(currentStaff?.role, 'void')) throw new Error('You do not have permission to void purchases.');
    if (!reason.trim()) throw new Error('Void reason is required.');
    if (voidingPurchaseIds.current.has(purchaseId)) return;
    const purchase = purchases.find((current) => current.id === purchaseId && current.status === 'completed');
    if (!purchase) return;
    const alreadyReversed = stockMovements.some((movement) => movement.purchaseId === purchaseId && movement.type === 'correction');
    const insufficient = purchase.items.filter((item) => (stockItems.find((stockItem) => stockItem.id === item.stockItemId)?.quantity ?? 0) < item.quantity);
    if (insufficient.length && !allowNegativeStock) throw new Error(`Stock is lower than this purchase for ${insufficient.map((item) => item.stockItemName).join(', ')}. Confirm the corrective reversal to continue.`);
    const now = new Date().toISOString();
    voidingPurchaseIds.current.add(purchaseId);
    setPurchases((current) => current.map((entry) => entry.id === purchaseId && entry.status === 'completed' ? { ...entry, status: 'voided', voidReason: reason.trim(), voidedAt: now, updatedAt: now } : entry));
    if (!alreadyReversed) {
      setStockItems((current) => current.map((item) => {
        const purchased = purchase.items.find((entry) => entry.stockItemId === item.id);
        if (!purchased) return item;
        const quantity = roundedQuantity(item.quantity - purchased.quantity); const inventoryValue = Math.max(0, Math.round(((item.inventoryValue ?? 0) - purchased.totalCost) * 100) / 100);
        return { ...item, quantity, inventoryValue, averageUnitCost: quantity ? Math.round(inventoryValue / quantity * 10000) / 10000 : undefined, updatedAt: now };
      }));
      setStockMovements((current) => current.some((movement) => movement.purchaseId === purchaseId && movement.type === 'correction') ? current : [
        ...purchase.items.map((item) => ({ id: stockId('stock-movement'), stockItemId: item.stockItemId, type: 'correction' as const, quantity: -item.quantity, note: `Void purchase #${purchase.purchaseNumber}: ${reason.trim()}`, purchaseId, createdAt: now })),
        ...current,
      ]);
    }
    if (purchase.linkedExpenseId) setExpenses((current) => current.map((expense) => expense.id === purchase.linkedExpenseId && expense.status === 'active' ? { ...expense, status: 'voided', voidReason: `Void purchase #${purchase.purchaseNumber}: ${reason.trim()}`, voidedAt: now, updatedAt: now } : expense));
  };

  const sendToKitchen = () => {
    if (!shop?.enableKitchen) return;
    const orderId = activeOpenOrderId ?? kitchenDraftOrderId;
    const sent = kitchenTickets.filter(ticket => ticket.orderId === orderId && ticket.status !== 'cancelled').flatMap(ticket => ticket.items).reduce<Record<string, number>>((all, item) => ({ ...all, [item.itemId]: (all[item.itemId] ?? 0) + item.quantity }), {});
    const items = cart.flatMap(line => { const menu = menuItems.find(item => item.id === line.itemId); const quantity = line.quantity - (sent[line.itemId] ?? 0); return menu?.sendToKitchen && quantity > 0 ? [{ itemId: line.itemId, name: line.name, quantity, modifierNames: line.modifierNames }] : []; });
    if (!items.length) return;
    const order = openOrders.find(entry => entry.id === activeOpenOrderId); const now = new Date().toISOString();
    setKitchenTickets(current => [...current, { id: stockId('kitchen-ticket'), orderId, serviceMode: activeServiceMode, tableName: order?.tableName, tokenNumber: activeServiceMode === 'takeaway' && shop.enableTokens ? nextTokenNumber : undefined, items, status: 'new', createdAt: now }]);
  };
  const updateKitchenTicket = (id: string, status: KitchenTicket['status']) => setKitchenTickets(current => current.map(ticket => { if (ticket.id !== id || ticket.status === 'cancelled') return ticket; const now = new Date().toISOString(); if ((status === 'preparing' && ticket.status !== 'new') || (status === 'ready' && ticket.status !== 'preparing') || (status === 'completed' && ticket.status !== 'ready')) return ticket; return { ...ticket, status, ...(status === 'preparing' ? { startedAt: now } : {}), ...(status === 'ready' ? { readyAt: now } : {}), ...(status === 'completed' ? { completedAt: now } : {}) }; }));
  const currentStaff = staff.find(entry => entry.id === currentStaffId && entry.isActive) ?? null;
  const saveTaxRate = (input: Pick<TaxRate, 'name' | 'rate'>, id?: string) => { const name=input.name.trim(); if (!name || !Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100) throw new Error('Enter a tax rate from 0 to 100.'); if (taxRates.some(rate => rate.id !== id && rate.name.toLowerCase() === name.toLowerCase())) throw new Error('A tax rate with this name already exists.'); const previous=id ? taxRates.find(rate => rate.id===id) : undefined; const now=new Date().toISOString(); const rate: TaxRate={ id: previous?.id ?? stockId('tax-rate'), name, rate: Math.round(input.rate*100)/100, isActive: previous?.isActive ?? true, createdAt: previous?.createdAt ?? now, ...(previous ? {updatedAt:now}:{}) }; setTaxRates(current => previous ? current.map(entry => entry.id===id ? rate:entry) : [...current,rate]); return rate.id; };
  const toggleTaxRate = (id: string) => setTaxRates(current => current.map(rate => rate.id===id ? {...rate,isActive:!rate.isActive,updatedAt:new Date().toISOString()}:rate));
  const saveStaff = async (input: { name: string; username: string; role: StaffRole; pin: string }, id?: string) => {
    const name = input.name.trim(); const username = normalizeUsername(input.username); if (!name) throw new Error('Staff name is required.'); if (!username || username.length < 3) throw new Error('Username must have at least 3 letters or numbers.'); if (staff.some(entry => entry.id !== id && staffUsername(entry) === username)) throw new Error('That username is already in use.'); if (!validPin(input.pin)) throw new Error('PIN must be 4 to 6 digits.');
    const existing = id ? staff.find(entry => entry.id === id) : undefined; const now = new Date().toISOString(); const pinHash = await hashPin(input.pin);
    const member: Staff = { id: existing?.id ?? stockId('staff'), name, username, role: input.role, pinHash, isActive: existing?.isActive ?? true, createdAt: existing?.createdAt ?? now, ...(existing ? { updatedAt: now } : {}) };
    setStaff(current => existing ? current.map(entry => entry.id === member.id ? member : entry) : [...current, member]); return member.id;
  };
  const toggleStaff = (id: string) => setStaff(current => current.map(entry => entry.id === id ? { ...entry, isActive: !entry.isActive, updatedAt: new Date().toISOString() } : entry));
  const loginStaff = async (usernameOrId: string, pin: string) => { const identifier = normalizeUsername(usernameOrId); const member = staff.find(entry => entry.isActive && (entry.id === usernameOrId || staffUsername(entry) === identifier)); if (!member || !(await verifyPin(pin, member.pinHash))) return false; setCurrentStaffId(member.id); return true; };
  const lockStaff = () => setCurrentStaffId(null);
  const startShift = (openingCash: number, note?: string) => { if (!currentStaff) throw new Error('Select staff first.'); if (shifts.some(shift => shift.status === 'open' && shift.staffId === currentStaff.id)) throw new Error('This staff member already has an open shift.'); if (!Number.isFinite(openingCash) || openingCash < 0) throw new Error('Opening cash must be zero or more.'); const shift: Shift = { id: stockId('shift'), staffId: currentStaff.id, staffName: currentStaff.name, openedAt: new Date().toISOString(), openingCash, note: note?.trim() || undefined, status: 'open' }; setShifts(current => [shift, ...current]); return shift.id; };
  const closeShift = (id: string, closingCash: number) => { const shift = shifts.find(entry => entry.id === id && entry.status === 'open'); if (!shift || !Number.isFinite(closingCash) || closingCash < 0) throw new Error('Enter a valid closing cash amount.'); const now = new Date().toISOString(); const expected = shiftCashExpected({ ...shift, closedAt: now }, sales, expenses, supplierPayments); setShifts(current => current.map(entry => entry.id === id ? { ...entry, closedAt: now, closingCash, expectedCash: expected, cashVariance: Math.round((closingCash - expected) * 100) / 100, status: 'closed' } : entry)); };
  const applyOperationalEvent = (event: { type: string; payload: Record<string, unknown> }) => {
    const payload = event.payload;
    if (event.type === 'OPERATIONAL_SNAPSHOT') {
      const snapshot = payload.snapshot as { shop?: Partial<ShopProfile>; menuItems?: MenuItem[]; tables?: TableRecord[]; openOrders?: OpenOrder[]; kitchenTickets?: KitchenTicket[] } | undefined;
      if (!snapshot) return;
      operationalRef.current = { ...operationalRef.current, shop: { ...operationalRef.current.shop, ...snapshot.shop }, menuItems: snapshot.menuItems ?? operationalRef.current.menuItems, tables: snapshot.tables ?? operationalRef.current.tables, openOrders: snapshot.openOrders ?? operationalRef.current.openOrders, kitchenTickets: snapshot.kitchenTickets ?? operationalRef.current.kitchenTickets };
      if (snapshot.shop) setShop(current => current ? { ...current, ...snapshot.shop } : current); if (snapshot.menuItems) setMenuItems(snapshot.menuItems); if (snapshot.tables) setTables(snapshot.tables); if (snapshot.openOrders) setOpenOrders(snapshot.openOrders); if (snapshot.kitchenTickets) setKitchenTickets(snapshot.kitchenTickets); setOperationalSyncStatus('synced'); setOperationalSyncMessage(null); return;
    }
    if (event.type === 'ORDER_CREATED' || event.type === 'ORDER_UPDATED') {
      const order = payload.order as OpenOrder | undefined; if (!order) return;
      operationalRef.current = { ...operationalRef.current, openOrders: event.type === 'ORDER_CREATED' ? (operationalRef.current.openOrders.some(entry => entry.id === order.id) ? operationalRef.current.openOrders : [order, ...operationalRef.current.openOrders]) : operationalRef.current.openOrders.map(entry => entry.id === order.id ? order : entry) };
      setOpenOrders(current => event.type === 'ORDER_CREATED' ? (current.some(entry => entry.id === order.id) ? current : [order, ...current]) : current.map(entry => entry.id === order.id ? order : entry));
      if (event.type === 'ORDER_CREATED' && shop?.deviceMode === 'staff-device' && order.createdByStaffId === currentStaff?.id) { setActiveOpenOrderId(order.id); setActiveServiceMode(order.serviceMode); setCart(order.items); }
      setOperationalSyncStatus('synced'); setOperationalSyncMessage(null); return;
    }
    if (event.type === 'ORDER_CANCELLED' || event.type === 'ORDER_PAID') {
      const orderId = typeof payload.orderId === 'string' ? payload.orderId : ''; if (!orderId) return;
      operationalRef.current = { ...operationalRef.current, openOrders: operationalRef.current.openOrders.filter(order => order.id !== orderId), kitchenTickets: event.type === 'ORDER_CANCELLED' ? operationalRef.current.kitchenTickets.map(ticket => ticket.orderId === orderId && ticket.status !== 'completed' ? { ...ticket, status: 'cancelled', cancelledAt: ticket.cancelledAt ?? new Date().toISOString() } : ticket) : operationalRef.current.kitchenTickets };
      setOpenOrders(current => current.filter(order => order.id !== orderId)); setKitchenTickets(current => event.type === 'ORDER_CANCELLED' ? current.map(ticket => ticket.orderId === orderId && ticket.status !== 'completed' ? { ...ticket, status: 'cancelled', cancelledAt: ticket.cancelledAt ?? new Date().toISOString() } : ticket) : current);
      if (activeOpenOrderId === orderId) { setActiveOpenOrderId(null); setActiveServiceMode('quick'); setCart([]); } setOperationalSyncStatus('synced'); setOperationalSyncMessage(null); return;
    }
    if (event.type === 'KITCHEN_TICKET_CREATED') { const ticket = payload.ticket as KitchenTicket | undefined; if (ticket) { operationalRef.current = { ...operationalRef.current, kitchenTickets: operationalRef.current.kitchenTickets.some(entry => entry.id === ticket.id) ? operationalRef.current.kitchenTickets : [...operationalRef.current.kitchenTickets, ticket] }; setKitchenTickets(current => current.some(entry => entry.id === ticket.id) ? current : [...current, ticket]); } setOperationalSyncStatus('synced'); return; }
    if (event.type === 'KITCHEN_TICKET_UPDATED') { const ticket = payload.ticket as KitchenTicket | undefined; if (ticket) { operationalRef.current = { ...operationalRef.current, kitchenTickets: operationalRef.current.kitchenTickets.map(entry => entry.id === ticket.id ? ticket : entry) }; setKitchenTickets(current => current.map(entry => entry.id === ticket.id ? ticket : entry)); } setOperationalSyncStatus('synced'); return; }
    if (event.type === 'ORDER_CONFLICT') { setOperationalSyncStatus('conflict'); setOperationalSyncMessage(typeof payload.reason === 'string' ? payload.reason : 'This order was changed on the Main POS.'); return; }
    if (event.type === 'COMMAND_REJECTED') { setOperationalSyncStatus('failed'); setOperationalSyncMessage(typeof payload.reason === 'string' ? payload.reason : 'The Main POS rejected this request.'); }
  };
  const handleOperationalCommand = (message: import('../types').SyncMessage, deviceRole: import('../types').StaffDeviceRole): OperationalCommandResult => {
    const result = applyOperationalCommand(operationalRef.current, message, deviceRole);
    applyOperationalEvent({ type: result.eventType, payload: result.payload });
    return result;
  };
  const isOperationalStaffDevice = shop?.deviceMode === 'staff-device';
  const staffConnectionInput = () => {
    if (!shop?.shopId || !shop.deviceId || !shop.deviceName || !shop.staffDeviceRole || !currentStaff) throw new Error('Sign in and pair this staff device before taking orders.');
    return { shopId: shop.shopId, deviceId: shop.deviceId, deviceName: shop.deviceName, deviceRole: shop.staffDeviceRole };
  };
  const requestOperational = async (type: Extract<import('../types').SyncMessage['type'], 'ORDER_CREATE_REQUEST' | 'ORDER_UPDATE_REQUEST' | 'ORDER_CANCEL_REQUEST' | 'ORDER_SEND_TO_KITCHEN_REQUEST' | 'KITCHEN_STATUS_UPDATE_REQUEST'>, payload: Record<string, unknown>) => {
    setOperationalSyncStatus('pending'); setOperationalSyncMessage('Pending Sync');
    // Load the optional LAN transport only for a paired Staff Device. This keeps the
    // normal local-first store independent of native socket modules.
    const transport = require('../services/localNetworkService').localNetworkService as typeof import('../services/localNetworkService').localNetworkService;
    return transport.sendOperationalCommand(staffConnectionInput(), type, { ...payload, staffId: currentStaff!.id });
  };
  const requestRemoteTableOrder = (tableId: string) => requestOperational('ORDER_CREATE_REQUEST', { serviceMode: 'dine-in', tableId, items: [] });
  const requestRemoteTakeawayOrder = (items: CartLine[]) => requestOperational('ORDER_CREATE_REQUEST', { serviceMode: 'takeaway', items: items.map(item => ({ menuItemId: item.itemId, quantity: item.quantity, modifierNames: item.modifierNames })) });
  const requestRemoteOrderUpdate = (orderId: string, expectedRevision: number, add: CartLine[] = [], remove: Array<{ key: string; quantity: number }> = []) => requestOperational('ORDER_UPDATE_REQUEST', { orderId, expectedRevision, add: add.map(item => ({ menuItemId: item.itemId, quantity: item.quantity, modifierNames: item.modifierNames })), remove });
  const requestRemoteOrderCancel = (orderId: string, expectedRevision: number) => requestOperational('ORDER_CANCEL_REQUEST', { orderId, expectedRevision });
  const requestRemoteSendToKitchen = (orderId: string, expectedRevision: number) => requestOperational('ORDER_SEND_TO_KITCHEN_REQUEST', { orderId, expectedRevision });
  const requestRemoteKitchenStatus = (ticket: KitchenTicket, status: KitchenTicket['status']) => requestOperational('KITCHEN_STATUS_UPDATE_REQUEST', { ticketId: ticket.id, expectedRevision: ticket.revision ?? 1, status });

  return {
    expenses, expenseCategories, saveExpense, voidExpense, saveExpenseCategory, toggleExpenseCategory,
    stockItems, stockMovements, saveStockItem, adjustStock, deactivateStockItem,
    purchases, createPurchase, voidPurchase, suppliers, supplierPayments, saveSupplier, toggleSupplier, recordSupplierPayment, voidSupplierPayment,
    tables, openOrders, activeOpenOrderId, activeServiceMode, nextTokenNumber, kitchenDraftOrderId, saveTable, toggleTable, openTableOrder, cancelOpenOrder, selectServiceMode,
    kitchenTickets, sendToKitchen, updateKitchenTicket, exportPersistedState: persistedSnapshot, restorePersistedState,
    taxCalculation, taxRates, saveTaxRate, toggleTaxRate, staff, shifts, currentStaff, saveStaff, toggleStaff, loginStaff, lockStaff, startShift, closeShift,
    hydrated, startupError, persistenceError, retryHydration: hydrateFromStorage, shop, menuItems, cart, total, itemCount, heldOrders, sales, lastPayment,
    completeShopSetup, updateShop, addMenuItem, updateMenuItem, saveRecipe, deleteMenuItem,
    addItem, changeQuantity, clearCart, holdCurrentSale, resumeHeldOrder, deleteHeldOrder,
    completePayment, voidSale, clearLastPayment, applyOperationalEvent, handleOperationalCommand, operationalSyncStatus, operationalSyncMessage, isOperationalStaffDevice, requestRemoteTableOrder, requestRemoteTakeawayOrder, requestRemoteOrderUpdate, requestRemoteOrderCancel, requestRemoteSendToKitchen, requestRemoteKitchenStatus,
  };
}

export type PosState = ReturnType<typeof usePosState>;
