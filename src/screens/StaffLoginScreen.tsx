import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PosState } from '../store/usePosState';
import { colors } from '../theme';

export function StaffLoginScreen({ pos }: { pos: PosState }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const login = async () => {
    if (!(await pos.loginStaff(username, pin))) { setPin(''); setError('Check your username and PIN, then try again.'); }
  };
  const disabled = username.trim().length < 3 || pin.length < 4;
  return <View style={styles.screen}><View style={styles.card}>
    <Text style={styles.eyebrow}>CAFE FLEX POS</Text><Text style={styles.title}>Staff sign in</Text><Text style={styles.note}>Enter the username and PIN provided by your owner or manager.</Text>
    <Text style={styles.label}>Username</Text><TextInput testID="staff-username" accessibilityLabel="Staff username" value={username} onChangeText={value => { setUsername(value); setError(''); }} autoCapitalize="none" autoCorrect={false} placeholder="e.g. priya.cashier" style={styles.input} />
    <Text style={styles.label}>PIN</Text><TextInput testID="staff-pin" accessibilityLabel="Staff PIN" value={pin} onChangeText={value => { setPin(value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="4-6 digit PIN" keyboardType="number-pad" secureTextEntry style={styles.input} />
    <Pressable testID="staff-login-submit" onPress={login} disabled={disabled} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>Sign in</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', padding: 22, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  eyebrow: { color: colors.primaryDark, fontSize: 11, letterSpacing: 1.2, fontWeight: '900' }, title: { marginTop: 7, fontSize: 25, fontWeight: '900', color: colors.text }, note: { marginTop: 6, color: colors.textMuted, lineHeight: 20 },
  label: { marginTop: 18, marginBottom: 6, color: colors.text, fontSize: 12, fontWeight: '800' }, input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text, backgroundColor: colors.surfaceSoft },
  button: { marginTop: 18, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.actionBlue }, disabled: { opacity: .45 }, buttonText: { color: '#fff', fontWeight: '900' }, error: { marginTop: 12, color: colors.danger, fontWeight: '700' },
});