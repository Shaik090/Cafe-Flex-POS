import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { PosState } from '../store/usePosState';
import { TableRecord } from '../types';
import { colors } from '../theme';

export function TablesScreen({ pos, onOpen }: { pos: PosState; onOpen: () => void }) {
  const { width } = useWindowDimensions();
  const tablet = width >= 760;
  const [editing, setEditing] = useState<TableRecord | 'new' | null>(null);
  const [disableId, setDisableId] = useState<string | null>(null);
  const selected = pos.tables.find((table) => table.id === disableId);
  const occupied = !!selected && pos.openOrders.some((order) => order.tableId === selected.id);
  const activeTables = pos.tables.filter((table) => table.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, tablet && styles.contentTablet]} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <ScreenHeader title="Tables" subtitle="Start, resume and settle dine-in orders." />
        {!pos.isOperationalStaffDevice && <Button label="+ Add Table" primary onPress={() => setEditing('new')} />}
      </View>
      <View style={[styles.summary, tablet && styles.summaryTablet]}>
        <Stat label="All Tables" value={String(activeTables.length)} />
        <Stat label="Available" value={String(activeTables.filter((table) => !pos.openOrders.some((order) => order.tableId === table.id)).length)} tone="available" />
        <Stat label="Occupied" value={String(activeTables.filter((table) => pos.openOrders.some((order) => order.tableId === table.id)).length)} tone="occupied" />
      </View>
      {!activeTables.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No tables added yet</Text><Text style={styles.muted}>Add a table to start taking dine-in orders.</Text>{!pos.isOperationalStaffDevice && <Button label="+ Add Table" primary onPress={() => setEditing('new')} />}</View> : <View style={[styles.grid, tablet && styles.gridTablet]}>
        {activeTables.map((table) => {
          const order = pos.openOrders.find((entry) => entry.tableId === table.id);
          const itemCount = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
          const total = order?.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) ?? 0;
          return <View key={table.id} style={[styles.tableCard, order ? styles.occupiedCard : styles.availableCard]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${table.name} ${order ? 'Occupied' : 'Available'}`} onPress={() => { if (pos.isOperationalStaffDevice && !order) void pos.requestRemoteTableOrder(table.id); else pos.openTableOrder(table.id); onOpen(); }} style={styles.tableMain}>
              <View style={styles.tableHeading}><Text style={styles.tableName}>{table.name}</Text><View style={[styles.status, order ? styles.statusOccupied : styles.statusAvailable]}><Text style={[styles.statusText, order ? styles.statusOccupiedText : styles.statusAvailableText]}>{order ? 'Occupied' : 'Available'}</Text></View></View>
              <Text style={styles.capacity}>{table.capacity ? `${table.capacity} seats` : 'Dine-in table'}</Text>
              {order ? <View style={styles.orderSummary}><Text style={styles.orderValue}>₹{total.toLocaleString('en-IN')}</Text><Text style={styles.orderMeta}>{itemCount} {itemCount === 1 ? 'item' : 'items'} in open order</Text>{order.createdByStaffName ? <Text style={styles.orderMeta}>Taken by {order.createdByStaffName}</Text> : null}</View> : <Text style={styles.availableCopy}>Tap to start a new order</Text>}
            </Pressable>
            {!pos.isOperationalStaffDevice && <View style={styles.cardActions}><Pressable accessibilityRole="button" onPress={() => setEditing(table)} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setDisableId(table.id)} style={styles.dangerAction}><Text style={styles.dangerActionText}>Disable</Text></Pressable></View>}
          </View>;
        })}
      </View>}
    </ScrollView>
    <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}><SafeAreaView style={styles.modalScreen}><ScrollView contentContainerStyle={styles.formSheet} keyboardShouldPersistTaps="handled"><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing === 'new' ? 'Add Table' : 'Edit Table'}</Text><Button label="Close" onPress={() => setEditing(null)} /></View><TableForm pos={pos} table={editing === 'new' ? undefined : editing ?? undefined} done={() => setEditing(null)} /></ScrollView></SafeAreaView></Modal>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setDisableId(null)}><View style={styles.backdrop}><View style={styles.confirmCard}><Text style={styles.modalTitle}>{occupied ? 'Table has an open order' : 'Disable this table?'}</Text><Text style={styles.confirmCopy}>{occupied ? 'Settle or cancel the open order before disabling this table.' : 'The table will be unavailable for new dine-in orders. Historical sales will remain readable.'}</Text>{!occupied && <Button label="Confirm Disable" danger onPress={() => { if (selected) pos.toggleTable(selected.id); setDisableId(null); }} />}<Button label="Cancel" onPress={() => setDisableId(null)} /></View></View></Modal>
  </View>;
}

function TableForm({ pos, table, done }: { pos: PosState; table?: TableRecord; done: () => void }) {
  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(table?.capacity?.toString() ?? '');
  return <View style={styles.form}><Label text="Table name" /><TextInput accessibilityLabel="Table name" value={name} onChangeText={setName} placeholder="e.g. Table 1" placeholderTextColor={colors.textMuted} style={styles.input} /><Label text="Capacity (optional)" /><TextInput accessibilityLabel="Table capacity" value={capacity} onChangeText={setCapacity} placeholder="e.g. 4" placeholderTextColor={colors.textMuted} keyboardType="number-pad" style={styles.input} /><Button label="Save Table" primary onPress={() => { pos.saveTable({ name, capacity: capacity ? Number(capacity) : undefined }, table?.id); done(); }} /></View>;
}

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'available' | 'occupied' }) { return <View style={[styles.stat, tone === 'available' && styles.statAvailable, tone === 'occupied' && styles.statOccupied]}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function Button({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, primary && styles.primaryButton, danger && styles.dangerButton]}><Text style={[styles.buttonText, primary && styles.primaryButtonText, danger && styles.dangerButtonText]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 92, gap: 14 }, contentTablet: { paddingHorizontal: 24, maxWidth: 1180, width: '100%', alignSelf: 'center' }, headerRow: { gap: 12 }, summary: { flexDirection: 'row', gap: 9 }, summaryTablet: { maxWidth: 620 }, stat: { flex: 1, minHeight: 72, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, statAvailable: { backgroundColor: colors.successSoft }, statOccupied: { backgroundColor: colors.dangerSoft }, statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' }, statValue: { marginTop: 4, color: colors.text, fontSize: 21, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, gridTablet: { gap: 14 }, tableCard: { flexGrow: 1, flexBasis: '46%', maxWidth: 460, minHeight: 170, borderRadius: 16, borderWidth: 1, overflow: 'hidden' }, availableCard: { backgroundColor: '#F2FAF3', borderColor: '#CFE8D3' }, occupiedCard: { backgroundColor: '#FFF1ED', borderColor: '#F4D3C9' }, tableMain: { flex: 1, padding: 14, justifyContent: 'space-between', gap: 8 }, tableHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, tableName: { color: colors.text, fontSize: 18, fontWeight: '900', flex: 1 }, capacity: { color: colors.textMuted, fontSize: 12 }, status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }, statusAvailable: { backgroundColor: colors.successSoft }, statusOccupied: { backgroundColor: colors.dangerSoft }, statusText: { fontSize: 10, fontWeight: '900' }, statusAvailableText: { color: colors.success }, statusOccupiedText: { color: colors.danger }, orderSummary: { gap: 2 }, orderValue: { color: colors.text, fontSize: 20, fontWeight: '900' }, orderMeta: { color: colors.textMuted, fontSize: 11 }, availableCopy: { color: colors.success, fontSize: 12, fontWeight: '800' }, cardActions: { flexDirection: 'row', gap: 8, padding: 10, paddingTop: 0 }, secondaryAction: { flex: 1, minHeight: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, secondaryActionText: { color: colors.text, fontSize: 12, fontWeight: '800' }, dangerAction: { flex: 1, minHeight: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#F6B7B2' }, dangerActionText: { color: colors.danger, fontSize: 12, fontWeight: '800' }, emptyCard: { padding: 18, gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' }, muted: { color: colors.textMuted }, modalScreen: { flex: 1, backgroundColor: colors.background }, formSheet: { padding: 18, paddingBottom: 42, gap: 12, maxWidth: 620, width: '100%', alignSelf: 'center' }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, modalTitle: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '900' }, form: { gap: 8 }, label: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 4 }, input: { minHeight: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }, button: { minHeight: 42, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary }, dangerButton: { backgroundColor: colors.dangerSoft, borderColor: '#F6B7B2' }, buttonText: { color: colors.text, fontSize: 13, fontWeight: '800' }, primaryButtonText: { color: colors.text, fontWeight: '900' }, dangerButtonText: { color: colors.danger, fontWeight: '900' }, backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#2D2D2D66' }, confirmCard: { maxWidth: 440, width: '100%', alignSelf: 'center', padding: 20, gap: 13, borderRadius: 18, backgroundColor: colors.surface }, confirmCopy: { color: colors.textMuted, lineHeight: 20 },
});
