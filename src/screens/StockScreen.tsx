import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { PosState } from '../store/usePosState';
import { StockItem, StockMovementType, StockTrackingMode } from '../types';
import { formatQuantity, movementLabel, movementsForItem, stockCounts, stockStatus } from '../utils/stock';
import { colors } from '../theme';
import { AppButton, AppSheet, FilterChip, FilterChipGroup, PrimaryButton, SearchInput } from '../components/ui';

type Filter = 'All' | 'Low Stock' | 'Out of Stock';
const units = ['pcs', 'packet', 'kg', 'g', 'litre', 'ml'];

export function StockScreen({ pos }: { pos: PosState }) {
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<StockItem | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const counts = stockCounts(pos.stockItems);
  const knownValue = pos.stockItems.filter((item) => item.isActive && item.inventoryValue !== undefined && item.averageUnitCost !== undefined).reduce((sum, item) => sum + (item.inventoryValue ?? 0), 0);
  const hasUnknownCost = pos.stockItems.some((item) => item.isActive && (item.inventoryValue === undefined || item.averageUnitCost === undefined));
  const rows = pos.stockItems.filter((item) => item.isActive && (filter === 'All' || stockStatus(item) === filter) && item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = pos.stockItems.find((item) => item.id === selectedId) ?? null;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ScreenHeader title="Stock" subtitle="Track ingredients, supplies and directly sold items." />
    <View style={styles.summary}><Stat label="Total Items" value={String(counts.totalItems)} /><Stat label="Low Stock" value={String(counts.lowStock)} tone="warning" /><Stat label="Out of Stock" value={String(counts.outOfStock)} tone="danger" /></View><View style={{ padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }}><Text style={styles.muted}>Inventory Value</Text><Text style={styles.statValue}>₹{knownValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>{hasUnknownCost && <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700', marginTop: 4 }}>Some stock items have no cost data</Text>}</View>
    <PrimaryButton label="+ Add Stock Item" onPress={() => setForm('new')} />
    <SearchInput value={search} onChangeText={setSearch} placeholder="Search stock" />
    <Text style={styles.filterLabel}>Stock status</Text>
    <Choices values={['All', 'Low Stock', 'Out of Stock']} value={filter} onChange={(value) => setFilter(value as Filter)} />
    {!rows.length && <View style={styles.card}><Text style={styles.title}>{pos.stockItems.length ? 'No stock items found' : 'No stock items'}</Text><Text style={styles.muted}>{pos.stockItems.length ? 'Try a different filter or search.' : 'Add Milk, Sugar, Cups, Water Bottles or other shop stock.'}</Text></View>}
    {rows.map((item) => <Pressable key={item.id} style={styles.card} onPress={() => setSelectedId(item.id)}><View style={styles.cardRow}><View style={{ flex: 1 }}><Text style={styles.title}>{item.name}</Text><Text style={styles.muted}>{formatQuantity(item.quantity, item.unit)} · Low at {formatQuantity(item.lowStockThreshold, item.unit)}</Text></View><Status item={item} /></View><Text style={styles.mode}>{item.trackingMode === 'direct-sale' ? 'Direct Sale Item' : 'Manual'}</Text><Valuation item={item} compact /></Pressable>)}
    <Sheet visible={!!selected && !form && !adjusting} title="Stock Details" onClose={() => setSelectedId(null)}>{selected && <><Valuation item={selected} /><Details item={selected} pos={pos} onEdit={() => setForm(selected)} onAdjust={() => setAdjusting(selected)} onDeactivate={() => { pos.deactivateStockItem(selected.id); setSelectedId(null); }} /></>}</Sheet>
    <Sheet visible={!!form} title={form === 'new' ? 'Add Stock Item' : 'Edit Stock Item'} onClose={() => setForm(null)}>{form && <StockForm key={form === 'new' ? 'new' : form.id} pos={pos} item={form === 'new' ? undefined : form} onDone={() => setForm(null)} />}</Sheet>
    <Sheet visible={!!adjusting} title={`Adjust ${adjusting?.name ?? 'Stock'}`} onClose={() => setAdjusting(null)}>{adjusting && <AdjustmentForm item={adjusting} pos={pos} onDone={() => setAdjusting(null)} />}</Sheet>
  </ScrollView>;
}

function StockForm({ pos, item, onDone }: { pos: PosState; item?: StockItem; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item?.unit ?? 'pcs');
  const [threshold, setThreshold] = useState(item ? String(item.lowStockThreshold) : '');
  const [unitCost, setUnitCost] = useState(item?.averageUnitCost !== undefined ? String(item.averageUnitCost) : '');
  const [mode, setMode] = useState<StockTrackingMode>(item?.trackingMode ?? 'manual');
  const [menuItemId, setMenuItemId] = useState(item?.linkedMenuItemId ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    try {
      if (!/^\d+(\.\d{1,3})?$/.test(quantity.trim()) || !/^\d+(\.\d{1,3})?$/.test(threshold.trim())) throw new Error('Enter valid quantities with up to three decimals.');
      pos.saveStockItem({ name, unit, quantity: Number(quantity), lowStockThreshold: Number(threshold), unitCost: unitCost.trim() ? Number(unitCost) : undefined, trackingMode: mode, linkedMenuItemId: mode === 'direct-sale' ? menuItemId : undefined }, item?.id, reason);
      onDone();
    } catch (cause) { setError((cause as Error).message); }
  };
  return <View style={styles.form}>
    <Label text="Name *" /><TextInput accessibilityLabel="Stock name" value={name} onChangeText={setName} style={styles.input} />
    <Label text="Current Quantity *" /><TextInput accessibilityLabel="Current quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} />
    <Label text="Unit *" /><View style={styles.chips}>{units.map((value) => <Action key={value} label={value} active={unit === value} onPress={() => setUnit(value)} />)}</View><TextInput accessibilityLabel="Custom unit" placeholder="Or type a custom unit" value={units.includes(unit) ? '' : unit} onChangeText={setUnit} style={styles.input} />
    <Label text="Low Stock Alert *" /><TextInput accessibilityLabel="Low stock alert" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" style={styles.input} />
    <Label text="Opening / Unit Cost (optional)" /><TextInput accessibilityLabel="Opening unit cost" value={unitCost} onChangeText={setUnitCost} keyboardType="decimal-pad" style={styles.input} />
    <Label text="Tracking Mode" /><Choices values={['Manual', 'Direct Sale Item']} value={mode === 'manual' ? 'Manual' : 'Direct Sale Item'} onChange={(value) => setMode(value === 'Manual' ? 'manual' : 'direct-sale')} />
    {mode === 'direct-sale' && <><Label text="Linked Menu Item *" /><View style={styles.chips}>{pos.menuItems.map((menuItem) => <Action key={menuItem.id} label={menuItem.name} active={menuItemId === menuItem.id} onPress={() => setMenuItemId(menuItem.id)} />)}</View>{!pos.menuItems.length && <Text style={styles.error}>Add a Menu item before linking direct-sale stock.</Text>}</>}
    {!!item && <><Label text="Correction reason" /><TextInput accessibilityLabel="Stock correction reason" placeholder="Required only if current quantity changed" value={reason} onChangeText={setReason} style={styles.input} /></>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Action label="Save Stock Item" onPress={save} primary />
  </View>;
}

function Valuation({ item, compact = false }: { item: StockItem; compact?: boolean }) {
  const hasCost = item.averageUnitCost !== undefined && item.inventoryValue !== undefined;
  const inventoryValue = item.inventoryValue ?? 0;
  if (compact) return <View style={styles.valuationCompact}>{hasCost ? <><Text style={styles.valuationLine}>Average Cost ₹{item.averageUnitCost} / {item.unit}</Text><Text style={styles.valuationLine}>Inventory Value ₹{inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text></> : <Text style={styles.costMissing}>Cost not configured</Text>}</View>;
  return <View style={styles.valuation}><Text style={styles.title}>Valuation</Text><Text>Current Quantity: {formatQuantity(item.quantity, item.unit)}</Text><Text>Unit: {item.unit}</Text>{hasCost ? <><Text>Average Cost: ₹{item.averageUnitCost} / {item.unit}</Text><Text>Inventory Value: ₹{inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text></> : <Text style={styles.costMissing}>Cost not configured</Text>}</View>;
}
function Details({ item, pos, onEdit, onAdjust, onDeactivate }: { item: StockItem; pos: PosState; onEdit: () => void; onAdjust: () => void; onDeactivate: () => void }) {
  const linked = pos.menuItems.find((menuItem) => menuItem.id === item.linkedMenuItemId);
  const history = movementsForItem(pos.stockMovements, item.id);
  return <View style={styles.form}><Text style={styles.title}>{item.name}</Text><Text>{formatQuantity(item.quantity, item.unit)}</Text><Text>Low-stock threshold: {formatQuantity(item.lowStockThreshold, item.unit)}</Text><Text>Tracking mode: {item.trackingMode === 'direct-sale' ? 'Direct Sale Item' : 'Manual'}</Text>{linked && <Text>Linked menu item: {linked.name}</Text>}<Status item={item} /><View style={styles.chips}><Action label="Edit Stock Item" onPress={onEdit} /><Action label="Adjust Stock" onPress={onAdjust} /><Action label="Deactivate" onPress={onDeactivate} /></View><Text style={styles.section}>Movement History</Text>{!history.length && <Text style={styles.muted}>No movements yet.</Text>}{history.map((movement) => <View key={movement.id} style={styles.movement}><Text style={[styles.movementQuantity, movement.quantity < 0 && styles.negative]}>{movement.quantity > 0 ? '+' : ''}{formatQuantity(movement.quantity, item.unit)}</Text><View style={{ flex: 1 }}><Text style={styles.title}>{movementLabel(movement.type)}{movement.saleId ? ` #${movement.saleId}` : ''}</Text>{movement.note && <Text style={styles.muted}>{movement.note}</Text>}<Text style={styles.muted}>{new Date(movement.createdAt).toLocaleString()}</Text></View></View>)}</View>;
}

function AdjustmentForm({ item, pos, onDone }: { item: StockItem; pos: PosState; onDone: () => void }) {
  const [type, setType] = useState<'restock' | 'usage' | 'wastage' | 'correction'>('restock');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    try {
      if (!/^-?\d+(\.\d{1,3})?$/.test(quantity.trim())) throw new Error('Enter a valid quantity with up to three decimals.');
      const input = Number(quantity);
      const signed = type === 'usage' || type === 'wastage' ? -Math.abs(input) : type === 'restock' ? Math.abs(input) : input;
      pos.adjustStock(item.id, type, signed, note);
      onDone();
    } catch (cause) { setError((cause as Error).message); }
  };
  return <View style={styles.form}><Text>Current: {formatQuantity(item.quantity, item.unit)}</Text><Choices values={['Restock', 'Record Usage', 'Record Wastage', 'Correction']} value={({ restock: 'Restock', usage: 'Record Usage', wastage: 'Record Wastage', correction: 'Correction' })[type]} onChange={(value) => setType(({ Restock: 'restock', 'Record Usage': 'usage', 'Record Wastage': 'wastage', Correction: 'correction' })[value] as typeof type)} /><Label text={type === 'correction' ? 'Adjustment (+ or -)' : 'Quantity'} /><TextInput accessibilityLabel="Adjustment quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} /><Label text={type === 'correction' ? 'Reason *' : 'Note (optional)'} /><TextInput accessibilityLabel="Adjustment note" value={note} onChangeText={setNote} multiline style={styles.input} />{!!error && <Text style={styles.error}>{error}</Text>}<Action label="Save Adjustment" onPress={save} primary /></View>;
}

function Status({ item }: { item: StockItem }) { const status = stockStatus(item); return <View style={[styles.status, status === 'Low Stock' && styles.low, status === 'Out of Stock' && styles.out]}><Text style={[styles.statusText, status === 'Low Stock' && styles.lowText, status === 'Out of Stock' && styles.outText]}>{status}</Text></View>; }
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { return <AppSheet visible={visible} title={title} onClose={onClose}>{children}</AppSheet>; }
function Choices({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) { return <FilterChipGroup>{values.map((current) => <FilterChip key={current} label={current} selected={current === value} onPress={() => onChange(current)} />)}</FilterChipGroup>; }
function Action({ label, onPress, active, primary }: { label: string; onPress: () => void; active?: boolean; primary?: boolean }) { return active !== undefined ? <FilterChip label={label} selected={active} onPress={onPress} /> : primary ? <PrimaryButton label={label} onPress={onPress} /> : <AppButton label={label} onPress={onPress} />; }
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) { return <View style={styles.stat}><Text style={styles.muted}>{label}</Text><Text style={[styles.statValue, tone === 'warning' && styles.lowText, tone === 'danger' && styles.outText]}>{value}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 40, gap: 16 }, summary: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }, statValue: { marginTop: 4, fontWeight: '900', fontSize: 22, color: colors.text }, card: { padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, gap: 7 }, cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { color: colors.text, fontWeight: '900', fontSize: 16 }, muted: { color: colors.textMuted }, mode: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' }, valuation: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSoft }, valuationCompact: { marginTop: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 3 }, valuationLine: { color: colors.textMuted, fontSize: 12, fontWeight: '700' }, costMissing: { color: colors.warning, fontWeight: '700' }, input: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: -8 }, action: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSoft }, actionActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }, actionText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 }, actionTextActive: { color: '#fff' }, status: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.successSoft }, statusText: { color: colors.success, fontWeight: '900', fontSize: 11 }, low: { backgroundColor: colors.warningSoft }, lowText: { color: colors.warning }, out: { backgroundColor: colors.dangerSoft }, outText: { color: colors.danger }, form: { gap: 11 }, label: { color: colors.text, fontWeight: '800', fontSize: 12 }, section: { marginTop: 12, color: colors.text, fontWeight: '900', fontSize: 17 }, movement: { flexDirection: 'row', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderColor: colors.border }, movementQuantity: { width: 90, color: colors.success, fontWeight: '900' }, negative: { color: colors.danger }, error: { color: colors.danger } });
