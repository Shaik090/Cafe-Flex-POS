import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistedPosState } from '../types';
import { normalizePersistedPosState } from '../utils/backup';

const STORAGE_KEY = '@cafe-flex-pos/state-v1';
const BACKUP_INFO_KEY = '@cafe-flex-pos/last-backup-at';

/** Persisted state schema v1. New optional domains are normalized by backup.ts. */
export const CURRENT_PERSISTED_SCHEMA_VERSION = 1;
export type PosLoadResult = { state: PersistedPosState | null; recoveryError?: string };

export async function loadPosState(): Promise<PosLoadResult> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: null };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('The saved data is not a valid POS state.');
    if ('shop' in parsed && parsed.shop !== null && (typeof parsed.shop !== 'object' || Array.isArray(parsed.shop))) throw new Error('The saved shop profile is invalid.');
    return { state: normalizePersistedPosState(parsed) };
  } catch (error) {
    if (__DEV__) {
      console.warn('Could not load Cafe Flex POS local data.', error);
    }
    return { state: null, recoveryError: 'Local business data could not be read safely. It has not been deleted. Restore a backup or retry after checking device storage.' };
  }
}

export async function replacePosState(state: PersistedPosState): Promise<void> { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export async function loadLastBackupAt(): Promise<string | null> { return AsyncStorage.getItem(BACKUP_INFO_KEY); }
export async function saveLastBackupAt(value: string): Promise<void> { await AsyncStorage.setItem(BACKUP_INFO_KEY, value); }

/** Reject write failures so callers can keep the user informed. */
export async function savePosState(state: PersistedPosState): Promise<void> { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export async function clearPosState(): Promise<void> { await AsyncStorage.removeItem(STORAGE_KEY); }
