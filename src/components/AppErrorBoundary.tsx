import React, { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.root}><Text style={styles.title}>Cafe Flex POS encountered an error.</Text><Text style={styles.message}>Your local data has not been changed. Try opening the app again.</Text><Pressable onPress={() => this.setState({ failed: false })} style={styles.button}><Text style={styles.buttonText}>Retry</Text></Pressable></View>;
  }
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 28, backgroundColor: colors.background }, title: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' }, message: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 }, button: { minHeight: 46, minWidth: 120, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary }, buttonText: { color: '#fff', fontWeight: '900' } });
