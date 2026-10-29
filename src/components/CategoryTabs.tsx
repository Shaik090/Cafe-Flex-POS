import { ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import { Category } from '../types';
import { colors } from '../theme';

const categories: Category[] = ['All', 'Favourites', 'Tea', 'Coffee', 'Snacks', 'Other'];

type Props = { value: Category; onChange: (category: Category) => void };

export function CategoryTabs({ value, onChange }: Props) {
  return <ScrollView testID="quick-sale-category-scroll" horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>{categories.map((category) => {
    const active = value === category;
    return <Pressable testID={`category-chip-${category}`} accessibilityLabel={`Category ${category}`} key={category} onPress={() => onChange(category)} style={[styles.tab, active && styles.activeTab]}><Text numberOfLines={1} ellipsizeMode="tail" style={[styles.label, active && styles.activeLabel]}>{category}</Text></Pressable>;
  })}</ScrollView>;
}

const styles = StyleSheet.create({
  // Horizontal ScrollView otherwise expands into unused catalogue height on Android.
  scroll: { flexGrow: 0, flexShrink: 0, height: 46 },
  // The catalogue owns the horizontal inset. Keeping this at zero lines the
  // first chip up with the search field and product cards on every phone.
  content: { alignItems: 'center', gap: 8, paddingHorizontal: 0, paddingTop: 6, paddingBottom: 8 },
  tab: { height: 32, minWidth: 54, maxWidth: 112, flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  activeTab: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontWeight: '800', fontSize: 12, flexShrink: 1 },
  activeLabel: { color: colors.text },
});
