import { ConnectionStatus, StaffDeviceRole, SyncMessage } from '../types';
import { createSyncMessage, isValidSyncMessage, ProcessedMessageRegistry, SYNC_PROTOCOL_VERSION } from './syncProtocol';

export const DEFAULT_LAN_PORT = 8765;
export const MAX_FRAME_BYTES = 64 * 1024;
export type PairingCode = { value: string; expiresAt: number };
export type PairRequest = { deviceName: string; requestedDeviceRole: StaffDeviceRole; pairingCode: string };
export type PairResult = { accepted: boolean; reason?: string; credential?: string; deviceName?: string; deviceRole?: StaffDeviceRole };

const roles: StaffDeviceRole[] = ['waiter', 'kitchen', 'cashier'];
const secret = () => `pair-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export function createPairingCode(now = Date.now(), lifetimeMs = 10 * 60_000): PairingCode {
  return { value: String(Math.floor(100000 + Math.random() * 900000)), expiresAt: now + lifetimeMs };
}

/** JSON-lines framing: a buffered delimiter protocol, safe for partial or coalesced TCP packets. */
export class JsonLineFramer {
  private pending = '';
  push(chunk: string): Array<{ message?: SyncMessage; error?: string }> {
    this.pending += chunk;
    if (this.pending.length > MAX_FRAME_BYTES) { this.pending = ''; return [{ error: 'Message exceeds the local network size limit.' }]; }
    const output: Array<{ message?: SyncMessage; error?: string }> = [];
    let boundary: number;
    while ((boundary = this.pending.indexOf('\n')) >= 0) {
      const line = this.pending.slice(0, boundary); this.pending = this.pending.slice(boundary + 1);
      if (!line) continue;
      if (line.length > MAX_FRAME_BYTES) { output.push({ error: 'Message exceeds the local network size limit.' }); continue; }
      try { const value = JSON.parse(line); output.push(isValidSyncMessage(value) ? { message: value } : { error: 'Unsupported or malformed local network message.' }); }
      catch { output.push({ error: 'Malformed local network message.' }); }
    }
    return output;
  }
}
export const frameMessage = (message: SyncMessage) => `${JSON.stringify(message)}\n`;

export class MainPosPairingAuthority {
  private code?: PairingCode;
  private readonly credentials = new Map<string, string>();
  readonly processed = new ProcessedMessageRegistry();
  generateCode(now = Date.now()) { this.code = createPairingCode(now); return this.code; }
  loadCredentials(credentials: Record<string, string>) { Object.entries(credentials).forEach(([deviceId, credential]) => this.credentials.set(deviceId, credential)); }
  credentialsSnapshot() { return Object.fromEntries(this.credentials); }
  forget(deviceId: string) { this.credentials.delete(deviceId); }
  isAuthenticated(message: SyncMessage) {
    const credential = (message.payload as { credential?: unknown } | undefined)?.credential;
    return typeof credential === 'string' && credential === this.credentials.get(message.sourceDeviceId);
  }
  connectionStatus(): ConnectionStatus { return 'disconnected'; }
  handle(message: SyncMessage, now = Date.now()): PairResult {
    if (message.protocolVersion !== SYNC_PROTOCOL_VERSION) return { accepted: false, reason: 'Unsupported protocol version.' };
    if (message.type === 'PAIR_REQUEST') {
      const payload = message.payload as Partial<PairRequest>;
      if (!payload || typeof payload.deviceName !== 'string' || !roles.includes(payload.requestedDeviceRole as StaffDeviceRole)) return { accepted: false, reason: 'Invalid pairing request.' };
      if (!this.code || now > this.code.expiresAt) return { accepted: false, reason: 'Pairing code expired.' };
      if (payload.pairingCode !== this.code.value) return { accepted: false, reason: 'Incorrect pairing code.' };
      this.code = undefined;
      const credential = secret(); this.credentials.set(message.sourceDeviceId, credential);
      return { accepted: true, credential, deviceName: payload.deviceName.trim(), deviceRole: payload.requestedDeviceRole as StaffDeviceRole };
    }
    if (message.type === 'HELLO' || message.type === 'HEARTBEAT' || message.type === 'TEST_MESSAGE' || message.type === 'OPERATIONAL_SNAPSHOT_REQUEST' || message.type === 'ORDER_CREATE_REQUEST' || message.type === 'ORDER_UPDATE_REQUEST' || message.type === 'ORDER_CANCEL_REQUEST' || message.type === 'ORDER_SEND_TO_KITCHEN_REQUEST' || message.type === 'KITCHEN_STATUS_UPDATE_REQUEST') {
      return this.isAuthenticated(message) ? { accepted: true } : { accepted: false, reason: 'Device is not paired.' };
    }
    return { accepted: false, reason: 'Unsupported local network command.' };
  }
}
