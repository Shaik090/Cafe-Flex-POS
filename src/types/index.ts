export type Category = 'All' | 'Favourites' | 'Tea' | 'Coffee' | 'Snacks' | 'Other';
export type ItemCategory = Exclude<Category, 'All' | 'Favourites'>;
export type MenuImageKey =
  | 'plainChai'
  | 'strongChai'
  | 'gingerTea'
  | 'specialChai'
  | 'filterCoffee'
  | 'coldCoffee'
  | 'strongCoffee'
  | 'juice'
  | 'water'
  | 'milk'
  | 'sandwich'
  | 'burger'
  | 'samosa'
  | 'bun'
  | 'biscuits'
  | 'cake';

export type Modifier = {
  id: string;
  name: string;
  priceDelta?: number;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: ItemCategory;
  favourite?: boolean;
  imageKey?: MenuImageKey;
  available?: boolean;
  modifiers?: Modifier[];
  sendToKitchen?: boolean;
  recipe?: RecipeItem[];
  taxRateId?: string;
  taxRateName?: string;
  taxRatePercent?: number;
};
export type RecipeItem = { stockItemId: string; stockItemName: string; quantity: number; unit: string };
export type RecipeConsumption = RecipeItem & { menuItemId: string; menuItemName: string };

export type CartLine = {
  key: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifierNames: string[];
};

export type HeldOrder = {
  id: string;
  createdAt: string;
  items: CartLine[];
};
export type ServiceMode = 'quick' | 'dine-in' | 'takeaway';
export type DeviceMode = 'single' | 'main-pos' | 'staff-device';
export type StaffDeviceRole = 'waiter' | 'kitchen' | 'cashier';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'pending-sync' | 'sync-error';
export type SyncMessageType = 'HELLO' | 'PAIR_REQUEST' | 'PAIR_ACCEPTED' | 'PAIR_REJECTED' | 'HEARTBEAT' | 'HEARTBEAT_ACK' | 'DISCONNECT' | 'TEST_MESSAGE' | 'TEST_MESSAGE_ACK' | 'OPERATIONAL_SNAPSHOT_REQUEST' | 'OPERATIONAL_SNAPSHOT' | 'ORDER_CREATE_REQUEST' | 'ORDER_UPDATE_REQUEST' | 'ORDER_CANCEL_REQUEST' | 'ORDER_SEND_TO_KITCHEN_REQUEST' | 'KITCHEN_STATUS_UPDATE_REQUEST' | 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED' | 'ORDER_PAID' | 'ORDER_CONFLICT' | 'COMMAND_REJECTED' | 'KITCHEN_TICKET_CREATED' | 'KITCHEN_TICKET_UPDATED' | 'TABLE_UPDATED' | 'MENU_UPDATED' | 'STAFF_SESSION_CHANGED';
export type SyncMessage<TPayload = unknown> = { protocolVersion: number; messageId: string; shopId: string; sourceDeviceId: string; sentAt: string; type: SyncMessageType; payload: TPayload };
export type PairedDevice = { deviceId: string; deviceName: string; deviceRole: StaffDeviceRole; connectionStatus: ConnectionStatus; pairedAt: string; lastSeenAt?: string };
export type MainPosAssociation = { shopId: string; mainDeviceId: string; mainDeviceName: string; address: string; port: number; deviceRole: StaffDeviceRole; pairedAt: string; connectionStatus: ConnectionStatus };
export type TableRecord = { id: string; name: string; capacity?: number; isActive: boolean; sortOrder: number; createdAt: string; updatedAt?: string };
export type OpenOrder = { id: string; serviceMode: Exclude<ServiceMode, 'quick'>; tableId?: string; tableName?: string; items: CartLine[]; tokenNumber?: number; createdAt: string; updatedAt: string; revision?: number; originDeviceId?: string; createdByStaffId?: string; createdByStaffName?: string };
export type KitchenTicket = { id: string; orderId: string; saleId?: string; serviceMode: ServiceMode; tableName?: string; tokenNumber?: number; items: Array<{ itemId: string; name: string; quantity: number; modifierNames: string[] }>; status: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled'; revision?: number; createdAt: string; startedAt?: string; readyAt?: string; completedAt?: string; cancelledAt?: string; saleVoidedAt?: string };
export type PendingSyncStatus = 'pending' | 'sending' | 'failed' | 'conflict';
export type PendingSyncCommand = { message: SyncMessage; status: PendingSyncStatus; createdAt: string; error?: string };
export type OperationalSnapshot = { shop: Pick<ShopProfile, 'name' | 'serviceModes' | 'enableTables' | 'enableTokens' | 'enableKitchen' | 'enableTax' | 'taxSettings'>; menuItems: MenuItem[]; tables: TableRecord[]; openOrders: OpenOrder[]; kitchenTickets: KitchenTicket[] };

export type PaymentMethod = 'Cash' | 'UPI';
export type SaleStatus = 'Paid' | 'Cancelled' | 'Refunded' | 'Voided';

export type SaleRecord = {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; modifierNames?: string[] }>;
  amount: number;
  method: PaymentMethod;
  status: SaleStatus;
  voidReason?: string;
  voidedAt?: string;
  serviceMode?: ServiceMode;
  tableId?: string;
  tableName?: string;
  tokenNumber?: number;
  recipeConsumptions?: RecipeConsumption[];
  costLines?: SaleCostLine[];
  costOfGoods?: number;
  costingStatus?: 'complete' | 'incomplete';
  originDeviceId?: string;
  openOrderId?: string;
  staffId?: string;
  staffName?: string;
  taxLines?: SaleTaxLine[];
  taxableSubtotal?: number;
  taxTotal?: number;
  taxPricingMode?: 'inclusive' | 'exclusive';
};
export type SaleCostLine = { stockItemId: string; stockItemName: string; quantity: number; unit: string; unitCost: number; totalCost: number; source: 'recipe' | 'direct-sale'; menuItemId?: string };

export type ShopType = 'Tea Shop' | 'Small Café' | 'Bakery Café' | 'Juice & Snacks' | 'Full Café' | 'Custom';

export type ShopModules = {
  stock: boolean;
  expenses: boolean;
  customers: boolean;
  tables: boolean;
  kitchen: boolean;
  receiptPrinting: boolean;
};

export type ShopProfile = {
  name: string;
  type: ShopType;
  phone: string;
  address: string;
  currency: 'INR';
  modules: ShopModules;
  setupComplete: boolean;
  serviceModes?: { quick: boolean; dineIn: boolean; takeaway: boolean };
  enableTables?: boolean;
  enableTokens?: boolean;
  enableKitchen?: boolean;
  enableStaffMode?: boolean;
  enableShiftTracking?: boolean;
  enableTax?: boolean;
  shopId?: string;
  deviceId?: string;
  deviceMode?: DeviceMode;
  deviceName?: string;
  staffDeviceRole?: StaffDeviceRole;
  taxSettings?: TaxSettings;
  receiptSettings?: ReceiptSettings;
};

export type ReceiptSettings = {
  shopName?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  footerMessage?: string;
  showOrderNumber?: boolean;
  showDateTime?: boolean;
  showPaymentMethod?: boolean;
  showServiceMode?: boolean;
  showTableToken?: boolean;
  showItemModifiers?: boolean;
  showDiscount?: boolean;
  paperWidth?: '58mm' | '80mm';
  printerMode?: 'system' | 'bluetooth';
  selectedPrinterId?: string;
  selectedPrinterName?: string;
  autoCut?: boolean;
};

export type PersistedPosState = {
  version: 1;
  shop: ShopProfile | null;
  menuItems: MenuItem[];
  cart: CartLine[];
  heldOrders: HeldOrder[];
  sales: SaleRecord[];
  expenses?: Expense[];
  expenseCategories?: ExpenseCategory[];
  stockItems?: StockItem[];
  stockMovements?: StockMovement[];
  purchases?: Purchase[];
  suppliers?: Supplier[];
  supplierPayments?: SupplierPayment[];
  tables?: TableRecord[];
  openOrders?: OpenOrder[];
  activeOpenOrderId?: string | null;
  activeServiceMode?: ServiceMode;
  nextTokenNumber?: number;
  kitchenTickets?: KitchenTicket[];
  kitchenDraftOrderId?: string;
  staff?: Staff[];
  shifts?: Shift[];
  taxRates?: TaxRate[];
};

export type AppScreen = 'Dashboard' | 'Quick Sale' | 'Menu' | 'Sales History' | 'More' | 'Expenses' | 'Purchases' | 'Stock' | 'Reports' | 'Suppliers' | 'Tables' | 'Kitchen' | 'Staff' | 'Settings';

export type ExpenseCategory = { id: string; name: string; isActive: boolean; createdAt: string };
export type ExpensePaymentMethod = 'cash' | 'upi' | 'card' | 'other';
export type Expense = {
  id: string; categoryId: string; categoryName: string; amount: number;
  paymentMethod: ExpensePaymentMethod; note?: string; expenseDate: string;
  createdAt: string; updatedAt?: string; status: 'active' | 'voided';
  voidReason?: string; voidedAt?: string;
  linkedPurchaseId?: string;
  linkedSupplierPaymentId?: string;
  staffId?: string;
  staffName?: string;
};
export type ExpenseInput = Pick<Expense, 'categoryId' | 'amount' | 'paymentMethod' | 'note' | 'expenseDate'>;

export type StockUnit = 'pcs' | 'packet' | 'kg' | 'g' | 'litre' | 'ml' | string;
export type StockTrackingMode = 'manual' | 'direct-sale';
export type StockMovementType = 'opening' | 'restock' | 'usage' | 'wastage' | 'correction' | 'sale' | 'sale_reversal' | 'recipe_usage' | 'recipe_reversal';

export type StockItem = {
  id: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  lowStockThreshold: number;
  linkedMenuItemId?: string;
  trackingMode: StockTrackingMode;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  averageUnitCost?: number;
  inventoryValue?: number;
};

export type StockMovement = {
  id: string;
  stockItemId: string;
  type: StockMovementType;
  quantity: number;
  note?: string;
  saleId?: string;
  purchaseId?: string;
  menuItemId?: string;
  createdAt: string;
};

export type StockItemInput = Pick<StockItem, 'name' | 'unit' | 'quantity' | 'lowStockThreshold' | 'linkedMenuItemId' | 'trackingMode'> & { unitCost?: number };

export type PurchasePaymentMethod = 'cash' | 'upi' | 'card' | 'credit' | 'other';
export type PurchaseStatus = 'completed' | 'voided';
export type PurchaseItem = {
  id: string;
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
};
export type Purchase = {
  id: string;
  purchaseNumber: string;
  vendorName?: string;
  items: PurchaseItem[];
  paymentMethod: PurchasePaymentMethod;
  subtotal: number;
  additionalCost: number;
  total: number;
  note?: string;
  purchaseDate: string;
  status: PurchaseStatus;
  createdAt: string;
  updatedAt?: string;
  voidReason?: string;
  voidedAt?: string;
  linkedExpenseId?: string;
  supplierId?: string;
  staffId?: string;
  staffName?: string;
};
export type PurchaseInput = Pick<Purchase, 'vendorName' | 'supplierId' | 'paymentMethod' | 'additionalCost' | 'note' | 'purchaseDate'> & { items: Array<Pick<PurchaseItem, 'stockItemId' | 'quantity' | 'unitCost'>> };

export type Supplier = { id: string; name: string; phone?: string; address?: string; note?: string; isActive: boolean; createdAt: string; updatedAt?: string };
export type SupplierPayment = { id: string; supplierId: string; amount: number; paymentMethod: ExpensePaymentMethod; note?: string; paymentDate: string; createdAt: string; status: 'active' | 'voided'; voidReason?: string; voidedAt?: string; linkedExpenseId?: string; staffId?: string; staffName?: string };
export type StaffRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
export type Staff = { id: string; name: string; username?: string; role: StaffRole; pinHash: string; isActive: boolean; createdAt: string; updatedAt?: string };
export type Shift = { id: string; staffId: string; staffName: string; openedAt: string; closedAt?: string; openingCash: number; closingCash?: number; expectedCash?: number; cashVariance?: number; status: 'open' | 'closed'; note?: string };
export type TaxRate = { id: string; name: string; rate: number; isActive: boolean; createdAt: string; updatedAt?: string };
export type TaxSettings = { legalBusinessName?: string; gstin?: string; businessAddress?: string; state?: string; stateCode?: string; pricingMode: 'inclusive' | 'exclusive'; defaultTaxRateId?: string };
export type SaleTaxLine = { menuItemId?: string; itemName: string; taxableAmount: number; taxRate: number; taxAmount: number; lineTotal: number };
