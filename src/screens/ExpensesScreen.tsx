import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { PosState } from '../store/usePosState';
import { Expense, ExpensePaymentMethod } from '../types';
import { expenseTotal, ExpensePeriod, inPeriod, localDateTime, parseLocalDateTime, paymentLabels } from '../utils/expenses';
import { colors } from '../theme';
import { AppButton, AppSheet, FilterChip, FilterChipGroup, PrimaryButton, SearchInput, StatCard } from '../components/ui';

const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function ExpensesScreen({ pos }: { pos: PosState }) {
  const [period, setPeriod] = useState<ExpensePeriod>('Today');
  const [payment, setPayment] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Expense | 'new' | null>(null);
  const [categories, setCategories] = useState(false);
  const rows = pos.expenses.filter(e => inPeriod(e.expenseDate, period) && (payment === 'All' || paymentLabels[e.paymentMethod] === payment) && `${e.categoryName} ${e.note ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const expense = pos.expenses.find(e => e.id === selected);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ScreenHeader title="Expenses" subtitle="Track day-to-day shop expenses" />
    <View style={styles.row}><StatCard label="Today Expenses" value={money(expenseTotal(pos.expenses, 'Today'))} style={styles.stat} /><StatCard label="This Month" value={money(expenseTotal(pos.expenses, 'This Month'))} style={styles.stat} /><StatCard label="Entries" value={String(rows.length)} style={styles.stat} /></View>
    <View style={styles.row}><PrimaryButton label="+ Add Expense" onPress={() => setForm('new')} style={styles.actionButton} /><AppButton label="Categories" onPress={() => setCategories(true)} style={styles.actionButton} /></View>
    <Text style={styles.filterLabel}>Period</Text>
    <Choices values={['Today', 'Yesterday', 'This Week', 'This Month']} value={period} onChange={v => setPeriod(v as ExpensePeriod)} />
    <Text style={styles.filterLabel}>Payment</Text><Choices values={['All', 'Cash', 'UPI', 'Card', 'Other']} value={payment} onChange={setPayment} />
    <SearchInput value={search} onChangeText={setSearch} placeholder="Search category or note" />
    <Text>Filtered active total: {money(rows.filter(e => e.status === 'active').reduce((sum, e) => sum + e.amount, 0))} - Count includes voided history</Text>
    {rows.map(e => <Pressable key={e.id} style={styles.card} onPress={() => setSelected(e.id)}><View style={styles.row}><Text style={styles.title}>{e.categoryName}</Text><Text style={styles.title}>{money(e.amount)}</Text></View><Text>{new Date(e.expenseDate).toLocaleString()} · {paymentLabels[e.paymentMethod]} · {e.status}</Text>{e.note ? <Text>{e.note}</Text> : null}</Pressable>)}
    {!rows.length && <View style={styles.card}><Text style={styles.title}>No expenses found</Text><Text>{pos.expenses.length ? 'Try another period, payment method or search.' : 'Add your first shop expense to get started.'}</Text></View>}
    <Sheet visible={!!expense && !form} title="Expense Details" onClose={() => setSelected(null)}>{expense && <ExpenseDetails key={expense.id} expense={expense} onEdit={() => setForm(expense)} onVoid={reason => pos.voidExpense(expense.id, reason)} />}</Sheet>
    <Sheet visible={!!form} title={form === 'new' ? 'Add Expense' : 'Edit Expense'} onClose={() => setForm(null)}>{form && <ExpenseForm key={form === 'new' ? 'new' : form.id} pos={pos} expense={form === 'new' ? undefined : form} onDone={() => setForm(null)} />}</Sheet>
    <Sheet visible={categories} title="Expense Categories" onClose={() => setCategories(false)}><Categories pos={pos} /></Sheet>
  </ScrollView>;
}
function ExpenseForm({ pos, expense, onDone }: { pos: PosState; expense?: Expense; onDone: () => void }) {
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? pos.expenseCategories.find(c => c.isActive)?.id ?? '');
  const [payment, setPayment] = useState<ExpensePaymentMethod>(expense?.paymentMethod ?? 'cash');
  const [date, setDate] = useState(localDateTime(expense ? new Date(expense.expenseDate) : undefined));
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const save = () => {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) throw new Error('Enter an amount with up to two decimal places.');
      pos.saveExpense({ amount: Number(amount), categoryId, paymentMethod: payment, note, expenseDate: parseLocalDateTime(date) }, expense?.id);
      onDone();
    } catch (e) { setError((e as Error).message); lock.current = false; setSaving(false); }
  };
  return <View style={styles.content}>
    <Text>Amount (₹)</Text><TextInput accessibilityLabel="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
    <Text>Category</Text><View style={styles.row}>{pos.expenseCategories.filter(c => c.isActive || c.id === expense?.categoryId).map(c => <Button key={c.id} label={c.name + (!c.isActive ? ' (disabled)' : '')} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}</View>
    {!pos.expenseCategories.some(c => c.isActive) && <Text>Add or enable a category in Categories.</Text>}
    <Text>Payment Method</Text><Choices values={Object.values(paymentLabels)} value={paymentLabels[payment]} onChange={v => setPayment(v.toLowerCase() as ExpensePaymentMethod)} />
    <Text>Date/time (local, YYYY-MM-DD HH:mm)</Text><TextInput accessibilityLabel="Expense date and time" value={date} onChangeText={setDate} style={styles.input} />
    <Text>Note (optional)</Text><TextInput accessibilityLabel="Note" value={note} onChangeText={setNote} multiline style={styles.input} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button label={saving ? 'Saving...' : 'Save Expense'} disabled={saving} onPress={save} />
  </View>;
}
function ExpenseDetails({ expense: e, onEdit, onVoid }: { expense: Expense; onEdit: () => void; onVoid: (reason: string) => void }) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  return <View style={styles.content}><Text style={styles.title}>{money(e.amount)}</Text><Text>Category: {e.categoryName}</Text><Text>Payment: {paymentLabels[e.paymentMethod]}</Text><Text>Date/time: {new Date(e.expenseDate).toLocaleString()}</Text><Text>Note: {e.note || '-'}</Text><Text>Status: {e.status}</Text>{e.status === 'voided' ? <><Text>Void reason: {e.voidReason}</Text><Text>Voided: {e.voidedAt && new Date(e.voidedAt).toLocaleString()}</Text><Text>This expense is read-only.</Text></> : <><View style={styles.row}><Button label="Edit" onPress={onEdit} /><Button label="Void" onPress={() => setVoiding(true)} /></View>{voiding && <><TextInput accessibilityLabel="Expense void reason" placeholder="Void reason (required)" value={reason} onChangeText={setReason} style={styles.input} /><Button label="Confirm void" disabled={!reason.trim()} onPress={() => { onVoid(reason); setVoiding(false); }} /><Button label="Cancel" onPress={() => setVoiding(false)} /></>}</>}</View>;
}
function Categories({ pos }: { pos: PosState }) {
  const [name, setName] = useState('');
  const [id, setId] = useState<string | undefined>();
  const [error, setError] = useState('');
  return <View style={styles.content}><Text>Renaming preserves names on historical expenses. Disable categories to stop using them for new expenses.</Text><TextInput accessibilityLabel="Category name" placeholder="Category name" value={name} onChangeText={setName} style={styles.input} /><Button label={id ? 'Save Category' : 'Add Category'} onPress={() => { try { pos.saveExpenseCategory(name, id); setName(''); setId(undefined); setError(''); } catch (e) { setError((e as Error).message); } }} />{id && <Button label="Cancel rename" onPress={() => { setId(undefined); setName(''); }} />}{!!error && <Text style={styles.error}>{error}</Text>}{pos.expenseCategories.map(c => <View key={c.id} style={styles.card}><Text style={styles.title}>{c.name} · {c.isActive ? 'Active' : 'Disabled'}</Text><View style={styles.row}><Button label="Rename" onPress={() => { setId(c.id); setName(c.name); }} /><Button label={c.isActive ? 'Disable' : 'Enable'} onPress={() => pos.toggleExpenseCategory(c.id)} /></View></View>)}</View>;
}
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { return <AppSheet visible={visible} title={title} onClose={onClose}>{children}</AppSheet>; }
function Button({ label, onPress, active, disabled }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) { return active !== undefined ? <FilterChip label={label} selected={active} onPress={onPress} /> : <AppButton label={label} onPress={onPress} disabled={disabled} />; }
function Choices({ values, value, onChange }: { values: string[]; value: string; onChange: (v: string) => void }) { return <FilterChipGroup>{values.map(v => <FilterChip key={v} label={v} selected={v === value} onPress={() => onChange(v)} />)}</FilterChipGroup>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 16, paddingBottom: 40 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, stat: { flex: 1, minWidth: 104 }, actionButton: { flexGrow: 1 }, filterLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 4 }, card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 }, title: { fontSize: 18, fontWeight: '800', color: colors.text }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, borderRadius: 12, color: colors.text }, error: { color: colors.danger } });
