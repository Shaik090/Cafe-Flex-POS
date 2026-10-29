import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PosState } from '../store/usePosState';
import { colors } from '../theme';

const states = ['new', 'preparing', 'ready', 'completed', 'cancelled'] as const;

export function KitchenScreen({ pos }: { pos: PosState }) {
  const tablet = useWindowDimensions().width >= 760;
  return <ScrollView contentContainerStyle={[styles.content, tablet && styles.wide]}>
    <Text style={styles.title}>Kitchen</Text>
    {states.map((status) => {
      const tickets = pos.kitchenTickets.filter((ticket) => ticket.status === status);
      return <View key={status} style={styles.column}>
        <Text style={styles.heading}>{status}</Text>
        {tickets.map((ticket) => {
          const next = status === 'new' ? 'preparing' : status === 'preparing' ? 'ready' : 'completed';
          const label = status === 'new' ? 'Start Preparing' : status === 'preparing' ? 'Mark Ready' : 'Complete';
          const testID = status === 'new' ? 'kitchen-start-preparing' : status === 'preparing' ? 'kitchen-mark-ready' : 'kitchen-complete';
          return <View key={ticket.id} style={styles.card}>
            <Text style={styles.name}>{ticket.tableName || (ticket.tokenNumber ? 'Token ' + ticket.tokenNumber : ticket.serviceMode)}</Text>
            {status === 'cancelled' && <Text style={styles.cancelled}>Cancelled</Text>}
            {ticket.saleVoidedAt && <Text style={styles.cancelled}>Linked sale voided</Text>}
            {ticket.items.map((item) => <Text key={item.itemId} style={styles.item}>{item.quantity} × {item.name}{item.modifierNames.length ? ' · ' + item.modifierNames.join(', ') : ''}</Text>)}
            {status !== 'completed' && status !== 'cancelled' && <Pressable testID={testID} accessibilityLabel={testID} onPress={() => pos.isOperationalStaffDevice ? void pos.requestRemoteKitchenStatus(ticket, next) : pos.updateKitchenTicket(ticket.id, next)} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>}
          </View>;
        })}
        {!tickets.length && <Text style={styles.empty}>No {status} kitchen orders.</Text>}
      </View>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, backgroundColor: colors.background },
  wide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  title: { width: '100%', fontSize: 24, fontWeight: '900', color: colors.text },
  column: { minWidth: 220, flex: 1, gap: 9 },
  heading: { textTransform: 'capitalize', fontWeight: '900', fontSize: 17, color: colors.text },
  card: { padding: 13, gap: 5, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  name: { fontWeight: '900', color: colors.text },
  item: { color: colors.text },
  cancelled: { alignSelf: 'flex-start', color: colors.danger, fontSize: 11, fontWeight: '900' },
  button: { marginTop: 4, padding: 10, borderRadius: 9, backgroundColor: colors.primaryDark, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '900' },
  empty: { color: colors.textMuted, padding: 12 },
});
