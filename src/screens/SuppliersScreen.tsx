import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { PosState } from '../store/usePosState';
import { ExpensePaymentMethod, Supplier } from '../types';
import { localDateTime, parseLocalDateTime } from '../utils/expenses';
import { supplierCreditPurchases, supplierOutstanding } from '../utils/suppliers';
import { colors } from '../theme';

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export function SuppliersScreen({ pos }: { pos: PosState }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Supplier | 'new' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payment, setPayment] = useState(false);
  const rows = pos.suppliers.filter((supplier) => `${supplier.name} ${supplier.phone ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = pos.suppliers.find((supplier) => supplier.id === selectedId);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ScreenHeader title="Suppliers" subtitle="Manage supplier details and credit due." />
    <TextInput accessibilityLabel="Search suppliers" placeholder="Search suppliers..." value={search} onChangeText={setSearch} style={styles.input} />
    <Button label="+ Add Supplier" onPress={() => setForm('new')} primary />
    {rows.length ? rows.map((supplier) => <Pressable key={supplier.id} style={styles.card} onPress={() => setSelectedId(supplier.id)}><Text style={styles.name}>{supplier.name}</Text>{supplier.phone && <Text>{supplier.phone}</Text>}<Text>Due {money(supplierOutstanding(pos.purchases, pos.supplierPayments, supplier.id))}</Text><Text style={supplier.isActive ? styles.active : styles.inactive}>{supplier.isActive ? 'Active' : 'Inactive'}</Text></Pressable>) : <Text style={styles.empty}>No suppliers found.</Text>}
    <Sheet visible={!!form} title={form === 'new' ? 'Add Supplier' : 'Edit Supplier'} onClose={() => setForm(null)}>{form && <SupplierForm pos={pos} supplier={form === 'new' ? undefined : form} done={() => setForm(null)} />}</Sheet>
    <Sheet visible={!!selected && !payment} title="Supplier Details" onClose={() => setSelectedId(null)}>{selected && <Details pos={pos} supplier={selected} edit={() => { setForm(selected); setSelectedId(null); }} record={() => setPayment(true)} />}</Sheet>
    <Sheet visible={!!selected && payment} title="Record Supplier Payment" onClose={() => setPayment(false)}>{selected && <PaymentForm pos={pos} supplier={selected} done={() => setPayment(false)} />}</Sheet>
  </ScrollView>;
}

function SupplierForm({ pos, supplier, done }: { pos: PosState; supplier?: Supplier; done: () => void }) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [note, setNote] = useState(supplier?.note ?? '');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const save = () => { if (lock.current) return; lock.current = true; try { pos.saveSupplier({ name, phone, address, note }, supplier?.id); done(); } catch (cause) { setError((cause as Error).message); lock.current = false; } };
  return <View style={styles.form}><TextInput accessibilityLabel="Supplier name" placeholder="Name *" value={name} onChangeText={setName} style={styles.input} /><TextInput accessibilityLabel="Supplier phone" placeholder="Phone" value={phone} onChangeText={setPhone} style={styles.input} /><TextInput accessibilityLabel="Supplier address" placeholder="Address" value={address} onChangeText={setAddress} style={styles.input} /><TextInput accessibilityLabel="Supplier note" placeholder="Note" value={note} onChangeText={setNote} multiline style={styles.input} />{!!error && <Text style={styles.error}>{error}</Text>}<Button label="Save Supplier" onPress={save} primary /></View>;
}

function PaymentForm({ pos, supplier, done }: { pos: PosState; supplier: Supplier; done: () => void }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [date, setDate] = useState(localDateTime());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const outstanding = supplierOutstanding(pos.purchases, pos.supplierPayments, supplier.id);
  const save = () => {
    if (lock.current) return;
    lock.current = true;
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) throw new Error('Enter an amount greater than ₹0.');
      if (Number(amount) > outstanding) throw new Error('Payment cannot exceed the outstanding balance.');
      pos.recordSupplierPayment({ supplierId: supplier.id, amount: Number(amount), paymentMethod, paymentDate: parseLocalDateTime(date), note });
      done();
    } catch (cause) { setError((cause as Error).message); lock.current = false; }
  };
  return <View style={styles.form}><Text style={styles.title}>{supplier.name}</Text><Text>Outstanding: {money(outstanding)}</Text><TextInput accessibilityLabel="Supplier payment amount" placeholder="Amount *" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} style={styles.input} /><Text style={styles.label}>Payment method</Text><Choices values={['Cash', 'UPI', 'Card', 'Other']} value={paymentMethod} onChange={(value) => setPaymentMethod(value as ExpensePaymentMethod)} /><Text style={styles.label}>Payment date/time</Text><TextInput accessibilityLabel="Supplier payment date" value={date} onChangeText={setDate} style={styles.input} /><Text style={styles.label}>Note (optional)</Text><TextInput accessibilityLabel="Supplier payment note" value={note} onChangeText={setNote} multiline style={styles.input} />{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button label="Save Payment" onPress={save} primary /></View>;
}

function Details({ pos, supplier, edit, record }: { pos: PosState; supplier: Supplier; edit: () => void; record: () => void }) {
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const purchases = supplierCreditPurchases(pos.purchases, supplier.id);
  const payments = pos.supplierPayments.filter((payment) => payment.supplierId === supplier.id).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const credits = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const totalPayments = payments.filter((payment) => payment.status === 'active').reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = supplierOutstanding(pos.purchases, pos.supplierPayments, supplier.id);
  const voidPayment = (id: string) => { if (!reason.trim()) { setError('Void reason is required.'); return; } try { pos.voidSupplierPayment(id, reason); setVoidingId(null); setReason(''); setError(''); } catch (cause) { setError((cause as Error).message); } };
  return <View style={styles.form}><Text style={styles.name}>{supplier.name}</Text>{supplier.phone && <Text>{supplier.phone}</Text>}{supplier.address && <Text>{supplier.address}</Text>}{supplier.note && <Text>Notes: {supplier.note}</Text>}<Text>Outstanding Balance: {money(outstanding)}</Text><Text>Credit Purchases: {money(credits)}</Text><Text>Total Payments: {money(totalPayments)}</Text>{outstanding > 0 ? <Button label="Record Payment" onPress={record} primary /> : <Text style={styles.empty}>No outstanding balance to pay.</Text>}<Button label="Edit Supplier" onPress={edit} />
    <Text style={styles.section}>Credit Purchase History</Text>{purchases.length ? purchases.map((purchase) => <View key={purchase.id} style={styles.history}><Text>{money(purchase.total)} · {new Date(purchase.purchaseDate).toLocaleDateString()}</Text><Text style={styles.muted}>#{purchase.purchaseNumber}</Text></View>) : <Text style={styles.empty}>No credit purchases recorded.</Text>}
    <Text style={styles.section}>Payment History</Text>{payments.length ? payments.map((payment) => <View key={payment.id} style={styles.history}><Text>{money(payment.amount)} · {payment.paymentMethod.toUpperCase()}</Text><Text>{new Date(payment.paymentDate).toLocaleString()}</Text><Text style={payment.status === 'active' ? styles.active : styles.inactive}>{payment.status === 'active' ? 'Active' : 'Voided'}</Text>{payment.status === 'voided' && <Text>Void reason: {payment.voidReason}</Text>}{payment.status === 'active' && (voidingId === payment.id ? <><TextInput accessibilityLabel="Supplier payment void reason" placeholder="Void reason (required)" value={reason} onChangeText={setReason} style={styles.input} /><Button label="Confirm Void Payment" onPress={() => voidPayment(payment.id)} /><Button label="Cancel" onPress={() => { setVoidingId(null); setReason(''); setError(''); }} /></> : <Button label="Void Payment" onPress={() => setVoidingId(payment.id)} />)}</View>) : <Text style={styles.empty}>No supplier payments recorded.</Text>}{!!error && <Text style={styles.error}>{error}</Text>}
    {supplier.isActive && (!confirmDisable ? <Button label="Disable Supplier" onPress={() => setConfirmDisable(true)} /> : <><Text style={styles.error}>Disable this supplier? Historical records will remain.</Text><Button label="Confirm Disable" onPress={() => { pos.toggleSupplier(supplier.id); setConfirmDisable(false); }} /><Button label="Cancel" onPress={() => setConfirmDisable(false)} /></>)}
  </View>;
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled"><View style={styles.head}><Text style={styles.name}>{title}</Text><Button label="Close" onPress={onClose} /></View>{children}</ScrollView></SafeAreaView></Modal>; }
function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, primary && styles.primary]}><Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text></Pressable>; }
function Choices({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) { return <View style={styles.chips}>{values.map((valueItem) => <Button key={valueItem} label={valueItem} primary={valueItem.toLowerCase() === value} onPress={() => onChange(valueItem.toLowerCase())} />)}</View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 88, gap: 12 }, input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, borderRadius: 11, color: colors.text }, card: { backgroundColor: colors.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 5 }, history: { backgroundColor: colors.surfaceSoft, padding: 11, borderRadius: 10, gap: 4 }, name: { color: colors.text, fontWeight: '900', fontSize: 17 }, title: { color: colors.text, fontWeight: '900', fontSize: 16 }, section: { color: colors.text, fontWeight: '900', marginTop: 8 }, active: { color: colors.primaryDark, fontWeight: '800' }, inactive: { color: colors.danger, fontWeight: '800' }, muted: { color: colors.textMuted }, empty: { color: colors.textMuted, paddingVertical: 4 }, form: { gap: 11 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: colors.surfaceSoft }, primary: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark }, buttonText: { color: colors.primaryDark, fontWeight: '800' }, primaryText: { color: '#fff' }, error: { color: colors.danger, fontWeight: '700' }, sheet: { padding: 18, paddingBottom: 40, gap: 12 }, head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { color: colors.text, fontWeight: '800', fontSize: 12 } });
