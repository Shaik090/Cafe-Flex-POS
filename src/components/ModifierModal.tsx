import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuItem, Modifier } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { colors } from '../theme';

type Props = { item: MenuItem | null; onClose: () => void; onAdd: (item: MenuItem, modifiers: Modifier[]) => void };

export function ModifierModal({ item, onClose, onAdd }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => setSelectedIds([]), [item?.id]);
  const selected = useMemo(() => item?.modifiers?.filter((modifier) => selectedIds.includes(modifier.id)) ?? [], [item, selectedIds]);
  if (!item) return null;
  const total = item.price + selected.reduce((sum, modifier) => sum + (modifier.priceDelta ?? 0), 0);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.title}>{item.name}</Text><Text style={styles.subtitle}>Choose optional preferences</Text><View style={styles.options}>{(item.modifiers ?? []).map((modifier) => { const active = selectedIds.includes(modifier.id); return <Pressable key={modifier.id} onPress={() => setSelectedIds((current) => active ? current.filter((id) => id !== modifier.id) : [...current, modifier.id])} style={[styles.option, active && styles.optionActive]}><Text style={[styles.optionText, active && styles.optionTextActive]}>{modifier.name}</Text><Text style={[styles.optionPrice, active && styles.optionTextActive]}>{modifier.priceDelta ? `+₹${modifier.priceDelta}` : 'No extra'}</Text></Pressable>; })}</View><View style={styles.footer}><Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => { onAdd(item, selected); onClose(); }} style={styles.add}><Text style={styles.addText}>Add ₹{total}</Text></Pressable></View></View></View></Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(24,34,48,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 }, sheet: { width: '100%', maxWidth: 440, borderRadius: 24, backgroundColor: colors.surface, padding: 20 }, title: { fontSize: 24, fontWeight: '900', color: colors.text }, subtitle: { marginTop: 4, color: colors.textMuted }, options: { gap: 10, marginTop: 18 }, option: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between' }, optionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, optionText: { fontWeight: '800', color: colors.text }, optionPrice: { color: colors.textMuted }, optionTextActive: { color: colors.primaryDark }, footer: { flexDirection: 'row', gap: 10, marginTop: 20 }, cancel: { flex: 1, backgroundColor: colors.surfaceSoft, padding: 14, borderRadius: 14, alignItems: 'center' }, cancelText: { fontWeight: '800', color: colors.text }, add: { flex: 1.5, backgroundColor: colors.primary, padding: 14, borderRadius: 14, alignItems: 'center' }, addText: { color: '#FFFFFF', fontWeight: '900' } });
