import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ShopModules, ShopProfile, ShopType } from '../types';
import { colors } from '../theme';

const shopTypes: ShopType[] = ['Tea Shop', 'Small Café', 'Bakery Café', 'Juice & Snacks', 'Full Café', 'Custom'];
const defaultModules: ShopModules = { stock: false, expenses: true, customers: false, tables: false, kitchen: false, receiptPrinting: false };

export function ShopSetupScreen({ onComplete }: { onComplete: (profile: ShopProfile, useStarterMenu: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ShopType>('Tea Shop');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [modules, setModules] = useState(defaultModules);
  const [useStarterMenu, setUseStarterMenu] = useState(true);

  const toggle = (key: keyof ShopModules) => setModules((current) => ({ ...current, [key]: !current[key] }));
  const finish = () => onComplete({ name: name.trim(), type, phone: phone.trim(), address: address.trim(), currency: 'INR', modules, setupComplete: true }, useStarterMenu);

  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.brand}><Text style={styles.cup}>☕</Text><Text style={styles.brandName}>Café Flex POS</Text><Text style={styles.brandSub}>Set up only what your shop actually needs.</Text></View>
    <View style={styles.progress}><View style={[styles.progressBar, { width: `${((step + 1) / 3) * 100}%` }]} /></View>

    {step === 0 && <View><Text style={styles.title}>What type of shop do you run?</Text><Text style={styles.subtitle}>This only helps us choose sensible defaults. You can change everything later.</Text><View style={styles.typeGrid}>{shopTypes.map((item) => <Pressable key={item} onPress={() => setType(item)} style={[styles.typeCard, type === item && styles.typeCardActive]}><Text style={styles.typeIcon}>{item === 'Tea Shop' ? '☕' : item === 'Juice & Snacks' ? '🥤' : item === 'Bakery Café' ? '🥐' : '🏪'}</Text><Text style={[styles.typeText, type === item && styles.typeTextActive]}>{item}</Text></Pressable>)}</View></View>}

    {step === 1 && <View><Text style={styles.title}>Shop details</Text><Text style={styles.subtitle}>Only the shop name is required.</Text><Label text="Shop name *" /><TextInput value={name} onChangeText={setName} placeholder="e.g. Sri Venkateswara Tea Stall" style={styles.input} /><Label text="Phone number" /><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Optional" style={styles.input} /><Label text="Address / Area" /><TextInput value={address} onChangeText={setAddress} placeholder="Optional" style={styles.input} /><View style={styles.currency}><Text style={styles.currencyLabel}>Currency</Text><Text style={styles.currencyValue}>₹ INR — Indian Rupee</Text></View></View>}

    {step === 2 && <View><Text style={styles.title}>Choose optional features</Text><Text style={styles.subtitle}>Quick Sale, Menu, Dashboard and Sales History are always available. Nothing here is tied to mobile or tablet.</Text>
      <ModuleRow title="Expenses" subtitle="Record daily shop expenses" value={modules.expenses} onPress={() => toggle('expenses')} />
      <ModuleRow title="Stock tracking" subtitle="Track quantities and low-stock alerts" value={modules.stock} onPress={() => toggle('stock')} />
      <ModuleRow title="Customers" subtitle="Customer records and future loyalty features" value={modules.customers} onPress={() => toggle('customers')} />
      <ModuleRow title="Tables" subtitle="Optional dine-in table workflow" value={modules.tables} onPress={() => toggle('tables')} />
      <ModuleRow title="Kitchen / KOT" subtitle="Keep this off for shops that do not need a kitchen" value={modules.kitchen} onPress={() => toggle('kitchen')} />
      <ModuleRow title="Receipt printing" subtitle="Enable when a printer is configured" value={modules.receiptPrinting} onPress={() => toggle('receiptPrinting')} />
      <View style={styles.starter}><View style={styles.starterText}><Text style={styles.moduleTitle}>Start with a sample Indian tea-shop menu</Text><Text style={styles.moduleSub}>Tea, coffee, bun, biscuit and a few editable examples. Turn this off to start completely blank.</Text></View><Switch value={useStarterMenu} onValueChange={setUseStarterMenu} trackColor={{ true: colors.primary, false: '#D0D5DD' }} /></View>
    </View>}

    <View style={styles.actions}>{step > 0 && <Pressable onPress={() => setStep((current) => current - 1)} style={styles.secondary}><Text style={styles.secondaryText}>Back</Text></Pressable>}<Pressable disabled={step === 1 && !name.trim()} onPress={() => step < 2 ? setStep((current) => current + 1) : finish()} style={[styles.primary, step === 1 && !name.trim() && styles.disabled]}><Text style={styles.primaryText}>{step === 2 ? 'Finish Setup' : 'Continue'}</Text></Pressable></View>
  </ScrollView></View>;
}

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function ModuleRow({ title, subtitle, value, onPress }: { title: string; subtitle: string; value: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.moduleRow}><View style={styles.starterText}><Text style={styles.moduleTitle}>{title}</Text><Text style={styles.moduleSub}>{subtitle}</Text></View><Switch value={value} onValueChange={onPress} trackColor={{ true: colors.primary, false: '#D0D5DD' }} /></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24, paddingBottom: 50 }, brand: { alignItems: 'center', marginTop: 20, marginBottom: 24 }, cup: { fontSize: 44 }, brandName: { marginTop: 8, fontSize: 25, fontWeight: '900', color: colors.text }, brandSub: { marginTop: 5, color: colors.textMuted, textAlign: 'center' }, progress: { height: 6, backgroundColor: colors.border, borderRadius: 10, overflow: 'hidden', marginBottom: 30 }, progressBar: { height: '100%', backgroundColor: colors.primary }, title: { fontSize: 25, fontWeight: '900', color: colors.text }, subtitle: { marginTop: 7, marginBottom: 20, color: colors.textMuted, lineHeight: 20 }, typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, typeCard: { width: '48%', minHeight: 100, padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, typeCardActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, typeIcon: { fontSize: 25 }, typeText: { marginTop: 10, color: colors.text, fontWeight: '800' }, typeTextActive: { color: colors.primaryDark }, label: { marginTop: 14, marginBottom: 6, color: colors.text, fontWeight: '800', fontSize: 12 }, input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, color: colors.text }, currency: { marginTop: 18, backgroundColor: colors.surfaceSoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }, currencyLabel: { color: colors.textMuted, fontSize: 11 }, currencyValue: { marginTop: 4, color: colors.text, fontWeight: '900' }, moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 14, marginBottom: 9 }, starter: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: '#F2D7C2', borderRadius: 15, padding: 14, marginTop: 10 }, starterText: { flex: 1 }, moduleTitle: { color: colors.text, fontWeight: '900' }, moduleSub: { marginTop: 4, color: colors.textMuted, fontSize: 11, lineHeight: 16 }, actions: { flexDirection: 'row', gap: 10, marginTop: 28 }, primary: { flex: 1, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, disabled: { opacity: 0.4 }, primaryText: { color: '#FFF', fontWeight: '900' }, secondary: { paddingHorizontal: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }, secondaryText: { color: colors.text, fontWeight: '900' },
});
