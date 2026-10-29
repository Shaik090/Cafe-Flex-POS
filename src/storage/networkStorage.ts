import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { MainPosAssociation, PairedDevice } from '../types';

const META_KEY = '@cafe-flex-pos/network-meta-v1';
const MAIN_CREDENTIALS_KEY = '@cafe-flex-pos/main-pairing-credentials-v1';
const STAFF_CREDENTIAL_KEY = '@cafe-flex-pos/staff-pairing-credential-v1';

export type NetworkMeta = { pairedDevices: PairedDevice[]; mainAssociation?: MainPosAssociation };
export async function loadNetworkMeta(): Promise<NetworkMeta> { try { const raw = await AsyncStorage.getItem(META_KEY); const parsed = raw ? JSON.parse(raw) : null; return { pairedDevices: Array.isArray(parsed?.pairedDevices) ? parsed.pairedDevices : [], mainAssociation: parsed?.mainAssociation }; } catch { return { pairedDevices: [] }; } }
export async function saveNetworkMeta(meta: NetworkMeta) { await AsyncStorage.setItem(META_KEY, JSON.stringify(meta)); }
export async function loadMainCredentials(): Promise<Record<string, string>> { try { return JSON.parse((await SecureStore.getItemAsync(MAIN_CREDENTIALS_KEY)) || '{}'); } catch { return {}; } }
export async function saveMainCredentials(value: Record<string, string>) { await SecureStore.setItemAsync(MAIN_CREDENTIALS_KEY, JSON.stringify(value)); }
export async function loadStaffCredential() { return SecureStore.getItemAsync(STAFF_CREDENTIAL_KEY); }
export async function saveStaffCredential(value: string) { await SecureStore.setItemAsync(STAFF_CREDENTIAL_KEY, value); }
export async function clearStaffCredential() { await SecureStore.deleteItemAsync(STAFF_CREDENTIAL_KEY); }
