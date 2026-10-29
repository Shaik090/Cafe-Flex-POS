import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenHeader } from '../components/ScreenHeader';
import { getSecondaryNavigation } from '../components/navigationItems';
import { AppScreen, StaffDeviceRole, StaffRole } from '../types';
import { colors } from '../theme';

type Props = {
  onNavigate: (screen: AppScreen) => void;
  tablesEnabled?: boolean;
  kitchenEnabled?: boolean;
  staffRole?: StaffRole;
  staffDeviceRole?: StaffDeviceRole;
};

export function MoreScreen({ onNavigate, tablesEnabled = false, kitchenEnabled = false, staffRole, staffDeviceRole }: Props) {
  const items = getSecondaryNavigation({ tablesEnabled, kitchenEnabled, staffRole, deviceRole: staffDeviceRole });
  return <View testID="more-screen" style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="More" subtitle="More ways to run your shop" />
      <View style={styles.list}>
        {items.map((item) => <Pressable key={item.screen} testID={`more-row-${item.screen}`} accessibilityLabel={item.label} onPress={() => onNavigate(item.screen)} style={styles.row}>
          <View style={styles.iconWrap}><MaterialCommunityIcons name={item.icon as never} size={22} color={colors.primaryDark} /></View>
          <View style={styles.copy}><Text style={styles.title}>{item.label}</Text>{item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}</View>
          <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
        </Pressable>)}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 84, gap: 12 },
  list: { gap: 7 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  icon: { color: colors.primaryDark, fontSize: 17, fontWeight: '900' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 14 },
  chevron: { color: colors.primaryDark, fontSize: 24, fontWeight: '400' },
});
