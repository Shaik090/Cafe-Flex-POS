import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={styles.row}><View style={styles.textWrap}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{action}</View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, textWrap: { flex: 1 }, title: { ...type.screenTitle, color: colors.text, letterSpacing: -0.25 }, subtitle: { marginTop: spacing.xs, color: colors.textMuted, ...type.caption, lineHeight: 17 } });
