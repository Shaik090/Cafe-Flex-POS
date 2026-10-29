import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingSyncCommand } from '../types';

const QUEUE_KEY = '@cafe-flex-pos/operational-sync-queue-v1';

export async function loadPendingSyncCommands(): Promise<PendingSyncCommand[]> {
  try { const raw = await AsyncStorage.getItem(QUEUE_KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
export async function savePendingSyncCommands(commands: PendingSyncCommand[]) { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(commands)); }
