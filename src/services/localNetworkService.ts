import { ConnectionStatus, MainPosAssociation, OperationalSnapshot, PairedDevice, PendingSyncCommand, StaffDeviceRole, SyncMessage } from '../types';
import { clearStaffCredential, loadMainCredentials, loadNetworkMeta, loadStaffCredential, saveMainCredentials, saveNetworkMeta, saveStaffCredential } from '../storage/networkStorage';
import { DEFAULT_LAN_PORT, frameMessage, JsonLineFramer, MainPosPairingAuthority } from '../utils/lanProtocol';
import { createSyncMessage } from '../utils/syncProtocol';
import { loadPendingSyncCommands, savePendingSyncCommands } from '../storage/operationalSyncStorage';
import { OperationalCommandResult } from '../utils/operationalSync';

type Socket = { write: (value: string) => void; destroy: () => void; on: (event: string, handler: (...args: any[]) => void) => void };
type Server = { listen: (options: { port: number; host: string }, callback?: () => void) => void; close: (callback?: () => void) => void; on: (event: string, handler: (...args: any[]) => void) => void; address?: () => { address: string; port: number } | null };
type TcpModule = { createServer: (listener: (socket: Socket) => void) => Server; createConnection: (options: { host: string; port: number; connectTimeout: number }, callback?: () => void) => Socket };
type MainConfig = { shopId: string; deviceId: string; deviceName: string; port?: number };
export type LocalNetworkSnapshot = { running: boolean; port: number; address?: string; pairingCode?: string; pairingExpiresAt?: number; pairedDevices: PairedDevice[]; staffAssociation?: MainPosAssociation; lastTestMessage?: string; error?: string };
type StaffConnectionInput = { shopId: string; deviceId: string; deviceName: string; deviceRole: StaffDeviceRole; address: string; port: number };
type StaffCommandIdentity = Pick<StaffConnectionInput, 'shopId' | 'deviceId' | 'deviceName' | 'deviceRole'>;
export type OperationalBridge = { onMainCommand?: (message: SyncMessage, role: StaffDeviceRole) => OperationalCommandResult; getMainSnapshot?: () => OperationalSnapshot; onStaffEvent?: (event: SyncMessage) => void };

const HEARTBEAT_MS = 20_000;
const MAX_RECONNECTS = 5;
function tcp(): TcpModule { const module = require('react-native-tcp-socket'); return (module.default ?? module) as TcpModule; }
function usableAddress(address?: string) { return !!address && address !== '0.0.0.0' && address !== '127.0.0.1' && address !== '::' && address !== '::1'; }
function validationError(address: string, port: number, code?: string) {
  const octets = address.trim().split('.');
  if (octets.length !== 4 || octets.some(value => !/^\d+$/.test(value) || Number(value) > 255)) return 'Enter the Main POS local IPv4 address.';
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Enter a valid Main POS port.';
  if (code !== undefined && !/^\d{6}$/.test(code)) return 'Enter the six-digit pairing code.';
  return undefined;
}

export class LocalNetworkService {
  private server?: Server;
  private authority = new MainPosPairingAuthority();
  private mainConfig?: MainConfig;
  private staffSocket?: Socket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private operational?: OperationalBridge;
  private mainSockets = new Map<string, Socket>();
  private pendingCommands: PendingSyncCommand[] = [];
  private processedOperationalEvents = new Map<string, { type: SyncMessage['type']; payload: unknown }>();
  private snapshot: LocalNetworkSnapshot = { running: false, port: DEFAULT_LAN_PORT, pairedDevices: [] };
  private listeners = new Set<(snapshot: LocalNetworkSnapshot) => void>();

  subscribe(listener: (snapshot: LocalNetworkSnapshot) => void) { this.listeners.add(listener); listener(this.snapshot); return () => { this.listeners.delete(listener); }; }
  getSnapshot() { return this.snapshot; }
  configureOperationalBridge(bridge?: OperationalBridge) { this.operational = bridge; }
  private publish(patch: Partial<LocalNetworkSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener(this.snapshot)); }
  private async saveMeta(patch: Partial<Awaited<ReturnType<typeof loadNetworkMeta>>>) { const meta = await loadNetworkMeta(); await saveNetworkMeta({ ...meta, ...patch }); }
  private async updatePairedDevice(deviceId: string, patch: Partial<PairedDevice>) {
    const meta = await loadNetworkMeta(); const pairedDevices = meta.pairedDevices.map(device => device.deviceId === deviceId ? { ...device, ...patch } : device);
    await saveNetworkMeta({ ...meta, pairedDevices }); this.publish({ pairedDevices });
  }

  async startMain(config: MainConfig) {
    if (this.server) return this.snapshot;
    const meta = await loadNetworkMeta(); this.authority = new MainPosPairingAuthority(); this.authority.loadCredentials(await loadMainCredentials()); this.mainConfig = config;
    this.publish({ pairedDevices: meta.pairedDevices, port: config.port ?? DEFAULT_LAN_PORT, error: undefined });
    const server = tcp().createServer(socket => this.attachMainSocket(socket, config)); this.server = server;
    try {
      await new Promise<void>((resolve, reject) => { server.on('error', reject); server.listen({ port: config.port ?? DEFAULT_LAN_PORT, host: '0.0.0.0' }, resolve); });
      const bound = server.address?.()?.address;
      // A wildcard bind is intentionally not displayed as a client address. Android does not expose a reliable LAN-interface API in this app.
      this.publish({ running: true, address: usableAddress(bound) ? bound : undefined });
      return this.snapshot;
    } catch (error) { this.server = undefined; this.publish({ running: false, error: 'Could not start the local network server. Check that the port is available.' }); throw error; }
  }
  async stopMain() {
    if (!this.server) return;
    const server = this.server; this.server = undefined; this.mainConfig = undefined;
    await new Promise<void>(resolve => server.close(resolve));
    this.publish({ running: false, pairingCode: undefined, pairingExpiresAt: undefined });
  }
  generatePairingCode() {
    if (!this.server) throw new Error('Start Local Network before generating a pairing code.');
    const code = this.authority.generateCode(); this.publish({ pairingCode: code.value, pairingExpiresAt: code.expiresAt }); return code;
  }
  async forgetDevice(deviceId: string) {
    this.authority.forget(deviceId); await saveMainCredentials(this.authority.credentialsSnapshot());
    const meta = await loadNetworkMeta(); const pairedDevices = meta.pairedDevices.filter(device => device.deviceId !== deviceId);
    await saveNetworkMeta({ ...meta, pairedDevices }); this.publish({ pairedDevices });
  }

  private attachMainSocket(socket: Socket, config: MainConfig) {
    const framer = new JsonLineFramer(); let authenticatedDeviceId: string | undefined;
    socket.on('data', async (data: { toString: () => string }) => {
      for (const result of framer.push(data.toString())) {
        if (!result.message) { socket.destroy(); return; }
        const message = result.message;
        if (message.shopId !== config.shopId) { this.send(socket, config, 'PAIR_REJECTED', { reason: 'This device belongs to a different shop.' }); continue; }
        const response = this.authority.handle(message);
        if (response.accepted && (message.type === 'HELLO' || message.type === 'PAIR_REQUEST')) { authenticatedDeviceId = message.sourceDeviceId; this.mainSockets.set(authenticatedDeviceId, socket); }
        if (message.type === 'PAIR_REQUEST' && response.accepted && response.credential && response.deviceName && response.deviceRole) {
          const now = new Date().toISOString(); const device: PairedDevice = { deviceId: message.sourceDeviceId, deviceName: response.deviceName, deviceRole: response.deviceRole, connectionStatus: 'connected', pairedAt: now, lastSeenAt: now };
          const meta = await loadNetworkMeta(); const pairedDevices = [...meta.pairedDevices.filter(entry => entry.deviceId !== device.deviceId), device];
          await saveNetworkMeta({ ...meta, pairedDevices }); await saveMainCredentials(this.authority.credentialsSnapshot());
          this.publish({ pairedDevices, pairingCode: undefined, pairingExpiresAt: undefined });
        }
        if (response.accepted && (message.type === 'HELLO' || message.type === 'HEARTBEAT')) await this.updatePairedDevice(message.sourceDeviceId, { connectionStatus: 'connected', lastSeenAt: new Date().toISOString() });
        if (response.accepted && message.type === 'HELLO') { const snapshot = this.operational?.getMainSnapshot?.(); if (snapshot) this.send(socket, config, 'OPERATIONAL_SNAPSHOT', { snapshot }); }
        if (message.type === 'TEST_MESSAGE' && response.accepted && this.authority.processed.remember(message.messageId)) this.publish({ lastTestMessage: `Connection test received from ${(message.payload as { deviceName?: string })?.deviceName ?? 'paired device'}` });
        if (response.accepted && message.type === 'OPERATIONAL_SNAPSHOT_REQUEST') { const snapshot = this.operational?.getMainSnapshot?.(); if (snapshot) this.send(socket, config, 'OPERATIONAL_SNAPSHOT', { snapshot }); continue; }
        if (response.accepted && ['ORDER_CREATE_REQUEST', 'ORDER_UPDATE_REQUEST', 'ORDER_CANCEL_REQUEST', 'ORDER_SEND_TO_KITCHEN_REQUEST', 'KITCHEN_STATUS_UPDATE_REQUEST'].includes(message.type)) {
          const known = this.processedOperationalEvents.get(message.messageId);
          if (known) { this.send(socket, config, known.type, known.payload); continue; }
          const role = this.snapshot.pairedDevices.find(device => device.deviceId === message.sourceDeviceId)?.deviceRole;
          if (!role || !this.operational?.onMainCommand) { this.send(socket, config, 'COMMAND_REJECTED', { reason: 'This device is not authorized for operational commands.', clientMessageId: message.messageId }); continue; }
          try { const event = this.operational.onMainCommand(message, role); this.processedOperationalEvents.set(message.messageId, { type: event.eventType, payload: event.payload }); this.broadcast(config, event.eventType, event.payload); }
          catch (error) { this.send(socket, config, 'COMMAND_REJECTED', { reason: error instanceof Error ? error.message : 'The Main POS could not process this request.', clientMessageId: message.messageId }); }
          continue;
        }
        const type = response.accepted ? message.type === 'PAIR_REQUEST' ? 'PAIR_ACCEPTED' : message.type === 'TEST_MESSAGE' ? 'TEST_MESSAGE_ACK' : 'HEARTBEAT_ACK' : 'PAIR_REJECTED';
        this.send(socket, config, type, response.accepted ? { credential: response.credential, mainDeviceId: config.deviceId, mainDeviceName: config.deviceName } : { reason: response.reason });
      }
    });
    const markDisconnected = () => {
      if (!authenticatedDeviceId || this.mainSockets.get(authenticatedDeviceId) !== socket) return;
      this.mainSockets.delete(authenticatedDeviceId);
      const deviceId = authenticatedDeviceId;
      // A replacement HELLO can arrive while the previous pairing socket closes.
      // Do not let that stale close overwrite the newer connected state.
      void Promise.resolve().then(() => { if (!this.mainSockets.has(deviceId)) return this.updatePairedDevice(deviceId, { connectionStatus: 'disconnected' }); });
    };
    socket.on('close', markDisconnected); socket.on('error', markDisconnected);
  }
  private send(socket: Socket, config: MainConfig, type: SyncMessage['type'], payload: unknown) { socket.write(frameMessage(createSyncMessage({ shopId: config.shopId, sourceDeviceId: config.deviceId, type, payload }))); }
  private broadcast(config: MainConfig, type: SyncMessage['type'], payload: unknown) { this.mainSockets.forEach(socket => this.send(socket, config, type, payload)); }
  broadcastOperationalEvent(type: Extract<SyncMessage['type'], 'ORDER_PAID' | 'TABLE_UPDATED' | 'MENU_UPDATED'>, payload: Record<string, unknown>) { if (this.mainConfig && this.server) this.broadcast(this.mainConfig, type, payload); }

  async pairStaff(input: StaffConnectionInput & { pairingCode: string }) {
    const error = validationError(input.address, input.port, input.pairingCode); if (error) throw new Error(error);
    const response = await this.openStaffSocket(input, 'PAIR_REQUEST', { deviceName: input.deviceName, requestedDeviceRole: input.deviceRole, pairingCode: input.pairingCode });
    const payload = response.payload as { credential?: string; reason?: string; mainDeviceId?: string; mainDeviceName?: string };
    if (response.type !== 'PAIR_ACCEPTED' || !payload.credential) throw new Error(payload.reason || 'Pairing was rejected.');
    await saveStaffCredential(payload.credential);
    const association: MainPosAssociation = { shopId: input.shopId, mainDeviceId: payload.mainDeviceId ?? 'main-pos', mainDeviceName: payload.mainDeviceName ?? 'Main POS', address: input.address.trim(), port: input.port, deviceRole: input.deviceRole, pairedAt: new Date().toISOString(), connectionStatus: 'connected' };
    await this.saveMeta({ mainAssociation: association }); this.publish({ staffAssociation: association, error: undefined });
    // The successful pairing socket is already authenticated. Keep it as the first
    // operational connection rather than racing a second HELLO against its close.
    this.requestOperationalSnapshot(input, payload.credential); void this.flushPending(input); return association;
  }
  async reconnectStaff(input: StaffConnectionInput) {
    const credential = await loadStaffCredential(); if (!credential) throw new Error('Pair this device with Main POS first.');
    const meta = await loadNetworkMeta(); const association = meta.mainAssociation;
    if (!association) throw new Error('Pair this device with Main POS first.');
    await this.connectStaff({ ...input, address: association.address, port: association.port }, credential, { ...association, connectionStatus: 'reconnecting' });
  }
  private async connectStaff(input: StaffConnectionInput, credential: string, association: MainPosAssociation) {
    // Keep a just-paired socket alive until the authenticated replacement is ready.
    // Destroying it first can race the new socket on Android/mock TCP transports.
    if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = undefined;
    const previousSocket = this.staffSocket; this.staffSocket = undefined;
    this.publish({ staffAssociation: { ...association, connectionStatus: 'reconnecting' }, error: undefined });
    try {
      const response = await this.openStaffSocket(input, 'HELLO', { credential, deviceName: input.deviceName });
      const payload = response.payload as { reason?: string };
      if (response.type === 'PAIR_REJECTED') throw new Error(payload.reason || 'Main POS rejected this device.');
      const connected = { ...association, connectionStatus: 'connected' as const }; await this.saveMeta({ mainAssociation: connected }); this.publish({ staffAssociation: connected }); this.reconnectAttempts = 0; this.requestOperationalSnapshot(input, credential); void this.flushPending(input); try { previousSocket?.destroy(); } catch {}
      // Start heartbeats after the authenticated socket has settled; this avoids a
      // close-event race during pairing/reconnect while preserving normal liveness.
      setTimeout(() => { if (this.staffSocket) this.startHeartbeat(input, credential); }, 0);
      return connected;
    } catch (error) { const disconnected = { ...association, connectionStatus: 'disconnected' as const }; await this.saveMeta({ mainAssociation: disconnected }); this.publish({ staffAssociation: disconnected, error: error instanceof Error ? error.message : 'Main POS unavailable.' }); this.scheduleReconnect(input); throw error; }
  }
  private openStaffSocket(input: StaffConnectionInput, type: 'PAIR_REQUEST' | 'HELLO', payload: unknown): Promise<SyncMessage> {
    const framer = new JsonLineFramer();
    return new Promise((resolve, reject) => {
      let settled = false; const finish = (callback: () => void) => { if (!settled) { settled = true; callback(); } };
      const socket = tcp().createConnection({ host: input.address.trim(), port: input.port, connectTimeout: 7000 });
      socket.on('connect', () => {
        this.staffSocket = socket;
        socket.write(frameMessage(createSyncMessage({ shopId: input.shopId, sourceDeviceId: input.deviceId, type, payload })));
      });
      socket.on('error', () => finish(() => reject(new Error('Main POS not reachable.'))));
      socket.on('data', (data: { toString: () => string }) => { for (const result of framer.push(data.toString())) { const message = result.message; if (message) { if (!settled) finish(() => resolve(message)); else void this.receiveStaffEvent(message); } else finish(() => reject(new Error('Main POS sent an invalid response.'))); } });
      socket.on('close', () => { if (!settled) finish(() => reject(new Error('Main POS disconnected before pairing completed.'))); });
    });
  }
  private startHeartbeat(input: StaffConnectionInput, credential: string) {
    const activeSocket = this.staffSocket;
    const reconnectAfterDrop = () => {
      if (this.staffSocket !== activeSocket) return;
      this.staffSocket = undefined; if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = undefined;
      const association = this.snapshot.staffAssociation;
      if (association) { const reconnecting = { ...association, connectionStatus: 'reconnecting' as const }; void this.saveMeta({ mainAssociation: reconnecting }); this.publish({ staffAssociation: reconnecting }); }
      this.scheduleReconnect(input);
    };
    activeSocket?.on('close', reconnectAfterDrop); activeSocket?.on('error', reconnectAfterDrop);
    this.heartbeat = setInterval(() => {
      try { this.staffSocket?.write(frameMessage(createSyncMessage({ shopId: input.shopId, sourceDeviceId: input.deviceId, type: 'HEARTBEAT', payload: { credential } }))); }
      catch { this.scheduleReconnect(input); }
    }, HEARTBEAT_MS);
  }
  private scheduleReconnect(input: StaffConnectionInput) {
    if (this.reconnectTimer || this.reconnectAttempts >= MAX_RECONNECTS) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 16_000); this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(async () => { this.reconnectTimer = undefined; const credential = await loadStaffCredential(); if (!credential) return; const meta = await loadNetworkMeta(); if (!meta.mainAssociation) return; try { await this.connectStaff({ ...input, address: meta.mainAssociation.address, port: meta.mainAssociation.port }, credential, meta.mainAssociation); } catch {} }, delay);
  }
  private clearStaffConnection() { if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = undefined; const socket = this.staffSocket; this.staffSocket = undefined; if (socket) { try { socket.destroy(); } catch {} } }
  private requestOperationalSnapshot(input: StaffConnectionInput, credential: string) { this.staffSocket?.write(frameMessage(createSyncMessage({ shopId: input.shopId, sourceDeviceId: input.deviceId, type: 'OPERATIONAL_SNAPSHOT_REQUEST', payload: { credential } }))); }
  private async receiveStaffEvent(message: SyncMessage) {
    const payload = message.payload as { clientMessageId?: string; reason?: string };
    if (payload?.clientMessageId) {
      const index = this.pendingCommands.findIndex(command => command.message.messageId === payload.clientMessageId);
      if (index >= 0) {
        if (message.type === 'COMMAND_REJECTED' || message.type === 'ORDER_CONFLICT') {
          this.pendingCommands[index] = { ...this.pendingCommands[index]!, status: message.type === 'ORDER_CONFLICT' ? 'conflict' : 'failed', error: payload.reason ?? 'Main POS rejected this request.' };
        } else this.pendingCommands = this.pendingCommands.filter(command => command.message.messageId !== payload.clientMessageId);
        await savePendingSyncCommands(this.pendingCommands);
      }
    }
    this.operational?.onStaffEvent?.(message);
  }
  async hydratePendingCommands() { this.pendingCommands = await loadPendingSyncCommands(); return this.pendingCommands; }
  getPendingCommands() { return this.pendingCommands; }
  async sendOperationalCommand(input: StaffCommandIdentity, type: Extract<SyncMessage['type'], 'ORDER_CREATE_REQUEST' | 'ORDER_UPDATE_REQUEST' | 'ORDER_CANCEL_REQUEST' | 'ORDER_SEND_TO_KITCHEN_REQUEST' | 'KITCHEN_STATUS_UPDATE_REQUEST'>, payload: Record<string, unknown>) {
    if (!await loadStaffCredential()) throw new Error('Pair this device with Main POS first.');
    // Credentials remain exclusively in SecureStore. The durable queue contains only the operational intent.
    const message = createSyncMessage({ shopId: input.shopId, sourceDeviceId: input.deviceId, type, payload });
    this.pendingCommands = [...this.pendingCommands, { message, status: 'pending', createdAt: new Date().toISOString() }]; await savePendingSyncCommands(this.pendingCommands);
    await this.flushPending(input); return message.messageId;
  }
  async flushPending(input: StaffCommandIdentity) {
    if (!this.staffSocket) return;
    const credential = await loadStaffCredential(); if (!credential) return;
    const pending = [...this.pendingCommands];
    for (const command of pending) {
      const index = this.pendingCommands.findIndex(entry => entry.message.messageId === command.message.messageId); if (index < 0) continue;
      this.pendingCommands[index] = { ...this.pendingCommands[index]!, status: 'sending', error: undefined }; await savePendingSyncCommands(this.pendingCommands);
      try { this.staffSocket.write(frameMessage({ ...command.message, payload: { ...(command.message.payload as Record<string, unknown>), credential } })); }
      catch { this.pendingCommands[index] = { ...this.pendingCommands[index]!, status: 'pending' }; await savePendingSyncCommands(this.pendingCommands); break; }
    }
  }
  async sendTestMessage(input: StaffConnectionInput) {
    const credential = await loadStaffCredential(); if (!credential) throw new Error('Reconnect to Main POS before sending a test message.');
    if (!this.staffSocket) await this.reconnectStaff(input);
    if (!this.staffSocket) throw new Error('Reconnect to Main POS before sending a test message.');
    this.staffSocket.write(frameMessage(createSyncMessage({ shopId: input.shopId, sourceDeviceId: input.deviceId, type: 'TEST_MESSAGE', payload: { credential, deviceName: input.deviceName, text: 'Connection test' } })));
  }
  async disconnectStaff() { this.clearStaffConnection(); const meta = await loadNetworkMeta(); if (meta.mainAssociation) { const association = { ...meta.mainAssociation, connectionStatus: 'disconnected' as const }; await saveNetworkMeta({ ...meta, mainAssociation: association }); this.publish({ staffAssociation: association }); } }
  async dispose() { await this.disconnectStaff(); if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; await this.stopMain(); }
  async forgetMainPos() { this.clearStaffConnection(); if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; await clearStaffCredential(); const meta = await loadNetworkMeta(); await saveNetworkMeta({ ...meta, mainAssociation: undefined }); this.publish({ staffAssociation: undefined }); }
  async loadStoredAssociation() { const meta = await loadNetworkMeta(); this.snapshot = { ...this.snapshot, pairedDevices: meta.pairedDevices, staffAssociation: meta.mainAssociation }; return meta.mainAssociation; }
  addressLabel() { return usableAddress(this.snapshot.address) ? this.snapshot.address : undefined; }
}
export const localNetworkService = new LocalNetworkService();
