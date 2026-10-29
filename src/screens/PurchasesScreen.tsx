import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { PosState } from '../store/usePosState';
import { Purchase, PurchasePaymentMethod } from '../types';
import { localDateTime, parseLocalDateTime } from '../utils/expenses';
import { formatPurchaseMoney, PurchasePeriod, purchaseInPeriod, purchasePaymentLabels } from '../utils/purchases';
import { formatQuantity } from '../utils/stock';
import { colors } from '../theme';
import { AppButton, AppSheet, FilterChip, FilterChipGroup, PrimaryButton, SearchInput } from '../components/ui';

type DraftItem = { key: string; stockItemId: string; quantity: string; unitCost: string };

export function PurchasesScreen({ pos }: { pos: PosState }) {
  const [period, setPeriod] = useState<PurchasePeriod>('Today');
  const [payment, setPayment] = useState<'All' | PurchasePaymentMethod>('All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = pos.purchases.filter((purchase) => purchaseInPeriod(purchase.purchaseDate, period) && (payment === 'All' || purchase.paymentMethod === payment) && `${purchase.vendorName ?? ''} ${purchase.items.map((item) => item.stockItemName).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  const completed = pos.purchases.filter((purchase) => purchase.status === 'completed');
  const selected = pos.purchases.find((purchase) => purchase.id === selectedId);
  const total = (range: PurchasePeriod) => completed.filter((purchase) => purchaseInPeriod(purchase.purchaseDate, range)).reduce((sum, purchase) => sum + purchase.total, 0);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ScreenHeader title="Purchases" subtitle="Record stock purchases and their paid cash outflow." />
    <View style={styles.summary}><Stat label="Today's Purchases" value={formatPurchaseMoney(total('Today'))} /><Stat label="This Month" value={formatPurchaseMoney(total('This Month'))} /><Stat label="Purchase count" value={String(rows.length)} /></View>
    <PrimaryButton label="+ New Purchase" onPress={() => setShowForm(true)} />
    <SearchInput value={search} onChangeText={setSearch} placeholder="Search vendor or item" />
    <Text style={styles.filterLabel}>Period</Text><Choices values={['Today', 'This Week', 'This Month']} value={period} onChange={(value) => setPeriod(value as PurchasePeriod)} />
    <Text style={styles.filterLabel}>Payment</Text><Choices values={['All', 'Cash', 'UPI', 'Card', 'Credit', 'Other']} value={payment === 'All' ? 'All' : purchasePaymentLabels[payment]} onChange={(value) => setPayment(value === 'All' ? 'All' : value.toLowerCase() as PurchasePaymentMethod)} />
    {!rows.length && <View style={styles.card}><Text style={styles.title}>No purchases recorded.</Text><Button label="New Purchase" onPress={() => setShowForm(true)} /></View>}
    {rows.map((purchase) => <Pressable key={purchase.id} style={styles.card} onPress={() => setSelectedId(purchase.id)}><View style={styles.row}><Text style={styles.title}>#{purchase.purchaseNumber}</Text><Text style={styles.title}>{formatPurchaseMoney(purchase.total)}</Text></View><Text>{purchase.vendorName || 'No vendor'} · {purchasePaymentLabels[purchase.paymentMethod]} · {purchase.status}</Text><Text style={styles.muted}>{new Date(purchase.purchaseDate).toLocaleString()}</Text></Pressable>)}
    <Sheet visible={showForm} title="New Purchase" onClose={() => setShowForm(false)}><PurchaseForm pos={pos} onDone={() => setShowForm(false)} /></Sheet>
    <Sheet visible={!!selected && !showForm} title="Purchase Details" onClose={() => setSelectedId(null)}>{selected && <PurchaseDetails purchase={selected} pos={pos} />}</Sheet>
  </ScrollView>;
}

function PurchaseForm({ pos, onDone }: { pos: PosState; onDone: () => void }) {
  const [vendorName, setVendorName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(localDateTime());
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [additionalCost, setAdditionalCost] = useState('0');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [selectorKey, setSelectorKey] = useState<string | null>(null);
  const [stockSearch, setStockSearch] = useState('');
  const [newStockOpen, setNewStockOpen] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [newStockUnit, setNewStockUnit] = useState('pcs');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const suppliers = pos.suppliers.filter((supplier) => supplier.isActive);
  const activeStock = pos.stockItems.filter(stock => stock.isActive);
  const matchingStock = activeStock.filter(stock => stock.name.toLowerCase().includes(stockSearch.trim().toLowerCase()));
  const update = (key: string, patch: Partial<DraftItem>) => setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  const addLine = () => setItems(current => [...current, { key: `${Date.now()}-${current.length}`, stockItemId: '', quantity: '', unitCost: '' }]);
  const selectedStock = (id: string) => activeStock.find(stock => stock.id === id);
  const chooseStock = (stockItemId: string) => {
    if (!selectorKey) return;
    if (items.some(item => item.key !== selectorKey && item.stockItemId === stockItemId)) { setError('This stock item is already in the purchase.'); return; }
    update(selectorKey, { stockItemId }); setSelectorKey(null); setStockSearch(''); setError('');
  };
  const addNewStock = () => {
    try {
      const id = pos.saveStockItem({ name: newStockName, unit: newStockUnit, quantity: 0, lowStockThreshold: 0, trackingMode: 'manual' });
      if (selectorKey) update(selectorKey, { stockItemId: id });
      setNewStockName(''); setNewStockUnit('pcs'); setNewStockOpen(false); setSelectorKey(null); setStockSearch(''); setError('');
    } catch (cause) { setError((cause as Error).message); }
  };
  const save = () => {
    if (lock.current) return;
    lock.current = true;
    try {
      if (paymentMethod === 'credit' && !supplierId) throw new Error('Choose an active supplier for a credit purchase.');
      if (!items.length) throw new Error('Add at least one stock item.');
      if (!/^\d+(\.\d{1,2})?$/.test(additionalCost.trim())) throw new Error('Enter a valid additional cost.');
      const parsed = items.map((item) => {
        if (!item.stockItemId) throw new Error('Choose a stock item for every purchase line.');
        if (!/^\d+(\.\d{1,3})?$/.test(item.quantity.trim()) || !/^\d+(\.\d{1,2})?$/.test(item.unitCost.trim())) throw new Error('Enter valid quantities and unit costs.');
        return { stockItemId: item.stockItemId, quantity: Number(item.quantity), unitCost: Number(item.unitCost) };
      });
      pos.createPurchase({ vendorName, supplierId: supplierId || undefined, purchaseDate: parseLocalDateTime(date), paymentMethod, note, additionalCost: Number(additionalCost), items: parsed });
      onDone();
    } catch (cause) { setError((cause as Error).message); lock.current = false; }
  };
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
  return <View style={styles.form}>
    <Label text={paymentMethod === 'credit' ? 'Supplier (required for credit)' : 'Supplier (optional)'} />
    {suppliers.length ? <View style={styles.chips}>{suppliers.map((supplier) => <Button key={supplier.id} label={supplier.name} active={supplierId === supplier.id} onPress={() => setSupplierId(supplier.id)} />)}</View> : <Text style={styles.muted}>No active suppliers available.</Text>}
    {paymentMethod === 'credit' && !supplierId && <Text style={styles.error}>Choose an active supplier before saving a credit purchase.</Text>}
    <Label text="Vendor name (optional)" /><TextInput accessibilityLabel="Vendor name" value={vendorName} onChangeText={setVendorName} placeholder="Vendor name for non-credit purchases" style={styles.input} />
    <Label text="Purchase date/time" /><TextInput accessibilityLabel="Purchase date" value={date} onChangeText={setDate} style={styles.input} />
    <Label text="Payment method" /><Choices values={['Cash', 'UPI', 'Card', 'Credit', 'Other']} value={purchasePaymentLabels[paymentMethod]} onChange={(value) => setPaymentMethod(value.toLowerCase() as PurchasePaymentMethod)} />
    <View style={styles.row}><Label text="Purchase items" /><Button label="+ Add Item" onPress={addLine} /></View>
    {!items.length && <View style={styles.itemCard}><Text style={styles.muted}>Add the stock items in this purchase.</Text><Button label="+ Add Item" onPress={addLine} /></View>}
    {items.map((item, index) => { const stock = selectedStock(item.stockItemId); const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0); return <View key={item.key} style={styles.itemCard} testID={`purchase-line-${index + 1}`}>
      <View style={styles.row}><Text style={styles.title}>{stock?.name ?? 'Choose stock item'}</Text><Button label="Remove" onPress={() => setItems(current => current.filter(entry => entry.key !== item.key))} /></View>
      <Label text="Item *" /><Button label={stock ? `${stock.name} ? ${stock.unit}` : 'Select stock item'} onPress={() => { setSelectorKey(item.key); setStockSearch(''); }} />
      <View style={styles.lineFields}><View style={styles.lineField}><Label text="Quantity *" /><TextInput accessibilityLabel={`Purchase quantity ${index + 1}`} placeholder="0" keyboardType="decimal-pad" value={item.quantity} onChangeText={(quantity) => update(item.key, { quantity })} style={styles.input} /></View><View style={styles.lineField}><Label text="Unit" /><Text style={styles.unitValue}>{stock?.unit ?? '?'}</Text></View></View>
      <Label text={stock ? `Cost / ${stock.unit} *` : 'Cost per unit *'} /><TextInput accessibilityLabel={`Unit cost ${index + 1}`} placeholder="0" keyboardType="decimal-pad" value={item.unitCost} onChangeText={(unitCost) => update(item.key, { unitCost })} style={styles.input} />
      <Text style={styles.lineTotal}>Line Total: {formatPurchaseMoney(lineTotal)}</Text>
    </View>; })}
    <Label text="Additional Cost" /><TextInput accessibilityLabel="Additional cost" keyboardType="decimal-pad" value={additionalCost} onChangeText={setAdditionalCost} style={styles.input} />
    <Text style={styles.purchaseTotal}>Purchase Total {formatPurchaseMoney(subtotal + (Number(additionalCost) || 0))}</Text>
    <Label text="Note (optional)" /><TextInput accessibilityLabel="Purchase note" value={note} onChangeText={setNote} multiline style={styles.input} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button label="Save Purchase" primary onPress={save} />
    <Modal visible={!!selectorKey} animationType="slide" onRequestClose={() => setSelectorKey(null)}><SafeAreaView style={styles.screen}><View style={styles.selector}><View style={styles.row}><Text style={styles.title}>Select stock item</Text><Button label="Close" onPress={() => setSelectorKey(null)} /></View><TextInput accessibilityLabel="Search stock item" value={stockSearch} onChangeText={setStockSearch} placeholder="Search stock items..." style={styles.input} /><Button label="+ Add New Stock Item" primary onPress={() => setNewStockOpen(true)} />{!activeStock.length ? <View style={styles.itemCard}><Text style={styles.muted}>No stock items yet.</Text><Button label="+ Add New Stock Item" onPress={() => setNewStockOpen(true)} /></View> : <ScrollView keyboardShouldPersistTaps="handled">{matchingStock.map(stock => <Pressable key={stock.id} testID={`stock-choice-${stock.id}`} onPress={() => chooseStock(stock.id)} style={styles.stockChoice}><Text style={styles.title}>{stock.name}</Text><Text style={styles.muted}>{stock.unit} · Current stock {formatQuantity(stock.quantity, stock.unit)}</Text></Pressable>)}{!matchingStock.length && <Text style={styles.muted}>No matching stock items.</Text>}</ScrollView>}</View></SafeAreaView></Modal>
    <Modal visible={newStockOpen} transparent animationType="fade" onRequestClose={() => setNewStockOpen(false)}><View style={styles.backdrop}><View style={styles.newStockCard}><Text style={styles.title}>Add New Stock Item</Text><Label text="Name *" /><TextInput accessibilityLabel="New stock item name" value={newStockName} onChangeText={setNewStockName} style={styles.input} /><Label text="Unit *" /><TextInput accessibilityLabel="New stock item unit" value={newStockUnit} onChangeText={setNewStockUnit} style={styles.input} /><Button label="Save Stock Item" primary onPress={addNewStock} /><Button label="Cancel" onPress={() => setNewStockOpen(false)} /></View></View></Modal>
  </View>;
}
function PurchaseDetails({ purchase, pos }: { purchase: Purchase; pos: PosState }) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const [error, setError] = useState('');
  const supplier = purchase.supplierId ? pos.suppliers.find((entry) => entry.id === purchase.supplierId) : undefined;
  const insufficient = purchase.items.filter((item) => (pos.stockItems.find((stock) => stock.id === item.stockItemId)?.quantity ?? 0) < item.quantity);
  const doVoid = () => { if (!reason.trim()) { setError('Void reason is required.'); return; } try { pos.voidPurchase(purchase.id, reason, confirmCorrection); setVoiding(false); } catch (cause) { setError((cause as Error).message); } };
  return <View style={styles.form}><Text style={styles.title}>#{purchase.purchaseNumber}</Text><Text>Vendor: {purchase.vendorName || '—'}</Text>{purchase.supplierId && <Text>Supplier: {supplier?.name || purchase.vendorName || 'Unknown supplier'}</Text>}<Text>Date/time: {new Date(purchase.purchaseDate).toLocaleString()}</Text><Text>Payment: {purchasePaymentLabels[purchase.paymentMethod]}</Text><Text>Status: {purchase.status}</Text>{purchase.items.map((item) => <View key={item.id} style={styles.itemLine}><Text style={{ flex: 1 }}>{item.stockItemName}</Text><Text>{formatQuantity(item.quantity, item.unit)} × {formatPurchaseMoney(item.unitCost)}</Text><Text>{formatPurchaseMoney(item.totalCost)}</Text></View>)}<Text>Subtotal: {formatPurchaseMoney(purchase.subtotal)}</Text><Text>Additional Cost: {formatPurchaseMoney(purchase.additionalCost)}</Text><Text style={styles.title}>Total: {formatPurchaseMoney(purchase.total)}</Text>{purchase.note && <Text>Note: {purchase.note}</Text>}{purchase.linkedExpenseId ? <Text>Linked expense: {purchase.status === 'voided' ? 'Voided' : 'Active'}</Text> : <Text>Credit purchase — no paid expense created.</Text>}{purchase.status === 'voided' ? <><Text>Void reason: {purchase.voidReason}</Text><Text>This purchase is read-only.</Text></> : <><Button label="Void Purchase" onPress={() => setVoiding(true)} />{voiding && <><TextInput accessibilityLabel="Purchase void reason" placeholder="Void reason (required)" value={reason} onChangeText={setReason} style={styles.input} />{insufficient.length > 0 && <><Text style={styles.error}>Current stock is lower than this purchase for {insufficient.map((item) => item.stockItemName).join(', ')}.</Text><Button label={confirmCorrection ? 'Corrective reversal confirmed' : 'Confirm corrective reversal'} active={confirmCorrection} onPress={() => setConfirmCorrection((current) => !current)} /></>}<Button label="Confirm Void Purchase" primary onPress={doVoid} />{!!error && <Text style={styles.error}>{error}</Text>}</>}</>}</View>;
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { return <AppSheet visible={visible} title={title} onClose={onClose}>{children}</AppSheet>; }
function Button({ label, onPress, primary, active, disabled }: { label: string; onPress: () => void; primary?: boolean; active?: boolean; disabled?: boolean }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active, disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.button, (primary || active) && styles.buttonActive, disabled && { opacity: 0.45 }]}><Text style={[styles.buttonText, (primary || active) && styles.buttonTextActive]}>{label}</Text></Pressable>; }
function Choices({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) { return <FilterChipGroup>{values.map((item) => <FilterChip key={item} label={item} selected={item === value} onPress={() => onChange(item)} />)}</FilterChipGroup>; }
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.muted}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, paddingBottom: 40, gap: 12 }, sheet: { padding: 18, paddingBottom: 40, maxWidth: 850, width: '100%', alignSelf: 'center', gap: 12 }, summary: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }, statValue: { marginTop: 4, fontWeight: '900', fontSize: 20, color: colors.text }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, card: { padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, gap: 7 }, itemCard: { padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSoft, gap: 9 }, itemLine: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }, title: { color: colors.text, fontWeight: '900', fontSize: 16 }, muted: { color: colors.textMuted }, input: { padding: 12, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: -8 }, button: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft }, buttonActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }, buttonText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 }, buttonTextActive: { color: '#fff' }, form: { gap: 11 }, label: { color: colors.text, fontWeight: '800', fontSize: 12 }, error: { color: colors.danger }, lineFields: { flexDirection: 'row', gap: 10 }, lineField: { flex: 1, gap: 5 }, unitValue: { minHeight: 44, padding: 12, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text }, lineTotal: { color: colors.primaryDark, fontWeight: '900' }, purchaseTotal: { padding: 13, borderRadius: 12, backgroundColor: colors.primarySoft, color: colors.primaryDark, fontWeight: '900', fontSize: 16 }, selector: { flex: 1, padding: 18, gap: 12, maxWidth: 850, width: '100%', alignSelf: 'center' }, stockChoice: { paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border }, backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0006' }, newStockCard: { backgroundColor: colors.surface, padding: 18, borderRadius: 16, gap: 10 } });
