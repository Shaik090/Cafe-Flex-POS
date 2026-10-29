import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuItem } from '../types';
import { colors } from '../theme';
import { menuImageFor } from '../utils/menuVisuals';

type Props = { items: MenuItem[]; columns: number; onPress: (item: MenuItem) => void; onLongPress: (item: MenuItem) => void };

export function MenuGrid({ items, columns, onPress, onLongPress }: Props) {
  return <View style={styles.grid}>{items.map((item) => <Pressable key={item.id} accessibilityLabel={`Add ${item.name}`} disabled={item.available === false} onPress={() => onPress(item)} onLongPress={() => onLongPress(item)} delayLongPress={350} style={({ pressed }) => [styles.card, { width: `${100 / columns - 2}%` }, pressed && styles.pressed, item.available === false && styles.disabled]}>
    <View style={styles.imageBox}><Image source={menuImageFor(item)} resizeMode="contain" style={styles.menuImage} /></View>
    <View style={styles.cardBottom}><View style={styles.nameRow}><Text numberOfLines={2} style={styles.name}>{item.name}</Text>{item.favourite ? <Text style={styles.star}>★</Text> : null}</View><Text style={styles.price}>₹{item.price}</Text></View>
  </Pressable>)}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { minHeight: 150, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, justifyContent: 'space-between' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.35 },
  imageBox: { width: 58, height: 58, overflow: 'hidden', borderRadius: 29, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuImage: { width: 56, height: 56 },
  cardBottom: { marginTop: 8 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  name: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text },
  price: { marginTop: 6, fontSize: 15, fontWeight: '900', color: colors.primaryDark },
  star: { color: colors.primary, fontSize: 16 },
});
