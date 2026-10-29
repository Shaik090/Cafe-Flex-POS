const mockNetworkMeta: { pairedDevices: any[]; mainAssociation?: any } = { pairedDevices: [] };
const mockCredentials: Record<string, string> = {};
let mockStaffCredential: string | null = null;
jest.mock('../src/storage/networkStorage', () => ({
  loadNetworkMeta: jest.fn(async () => ({ pairedDevices: [...mockNetworkMeta.pairedDevices], mainAssociation: mockNetworkMeta.mainAssociation })),
  saveNetworkMeta: jest.fn(async (value: any) => { mockNetworkMeta.pairedDevices = value.pairedDevices; mockNetworkMeta.mainAssociation = value.mainAssociation; }),
  loadMainCredentials: jest.fn(async () => ({ ...mockCredentials })),
  saveMainCredentials: jest.fn(async (value: Record<string, string>) => { Object.keys(mockCredentials).forEach(key => delete mockCredentials[key]); Object.assign(mockCredentials, value); }),
  loadStaffCredential: jest.fn(async () => mockStaffCredential),
  saveStaffCredential: jest.fn(async (value: string) => { mockStaffCredential = value; }),
  clearStaffCredential: jest.fn(async () => { mockStaffCredential = null; }),
}));

type Handler = (...args: any[]) => void;
class MockSocket {
  peer?: MockSocket; handlers = new Map<string, Handler[]>();
  on(event: string, handler: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]); return this; }
  emit(event: string, ...args: any[]) { for (const handler of this.handlers.get(event) ?? []) handler(...args); }
  write(value: string) { this.peer?.emit('data', { toString: () => value }); }
  destroy() { this.emit('close'); this.peer?.emit('close'); }
}
let mockConnectionListener: ((socket: MockSocket) => void) | undefined;
const mockServer = { on: jest.fn(), listen: jest.fn((_options, callback) => callback?.()), close: jest.fn(callback => callback?.()), address: () => ({ address: '0.0.0.0', port: 8765 }) };
jest.mock('react-native-tcp-socket', () => ({
  createServer: jest.fn((listener: (socket: MockSocket) => void) => { mockConnectionListener = listener; return mockServer; }),
  createConnection: jest.fn((_options: unknown, callback?: () => void) => { const client = new MockSocket(); const server = new MockSocket(); client.peer = server; server.peer = client; mockConnectionListener?.(server); queueMicrotask(() => { client.emit('connect'); callback?.(); }); return client; }),
}));

import { LocalNetworkService } from '../src/services/localNetworkService';

describe('local network transport lifecycle', () => {
  const services: LocalNetworkService[] = [];
  const service = () => { const instance = new LocalNetworkService(); services.push(instance); return instance; };
  beforeEach(() => { mockNetworkMeta.pairedDevices = []; mockNetworkMeta.mainAssociation = undefined; Object.keys(mockCredentials).forEach(key => delete mockCredentials[key]); mockStaffCredential = null; mockConnectionListener = undefined; jest.clearAllMocks(); });
  afterEach(async () => { await Promise.all(services.splice(0).map(instance => instance.dispose())); });
  const mainInput = { shopId: 'shop-1', deviceId: 'main-1', deviceName: 'Counter POS' };
  const staffInput = { shopId: 'shop-1', deviceId: 'staff-1', deviceName: 'Rahim Phone', deviceRole: 'waiter' as const, address: '192.168.1.20', port: 8765 };

  it('starts and stops only an explicitly requested Main POS server', async () => {
    const main = service(); expect(main.getSnapshot().running).toBe(false);
    await main.startMain(mainInput); expect(main.getSnapshot()).toEqual(expect.objectContaining({ running: true, port: 8765 }));
    await main.stopMain(); expect(main.getSnapshot().running).toBe(false);
  });

  it('pairs a staff device, stores a credential, authenticates reconnect, and supports a harmless test message', async () => {
    const main = service(); const staff = service(); await main.startMain(mainInput); const code = main.generatePairingCode();
    const association = await staff.pairStaff({ ...staffInput, pairingCode: code.value });
    expect(association.mainDeviceId).toBe('main-1'); expect(mockStaffCredential).toMatch(/^pair-/); expect(main.getSnapshot().pairedDevices).toEqual([expect.objectContaining({ deviceId: 'staff-1', connectionStatus: 'connected' })]);
    await staff.sendTestMessage(staffInput); await Promise.resolve(); expect(main.getSnapshot().lastTestMessage).toBe('Connection test received from Rahim Phone');
    await staff.disconnectStaff(); await staff.reconnectStaff(staffInput); expect(staff.getSnapshot().staffAssociation?.connectionStatus).toBe('connected');
  });

  it('forgets a paired device and rejects its saved credential on reconnect', async () => {
    const main = service(); const staff = service(); await main.startMain(mainInput); const code = main.generatePairingCode(); await staff.pairStaff({ ...staffInput, pairingCode: code.value });
    await main.forgetDevice('staff-1'); await staff.disconnectStaff(); await expect(staff.reconnectStaff(staffInput)).rejects.toThrow('Device is not paired.'); expect(main.getSnapshot().pairedDevices).toEqual([]);
  });

  it('rejects an invalid manual pairing address before opening a socket', async () => {
    const staff = service(); await expect(staff.pairStaff({ ...staffInput, address: 'localhost', pairingCode: '123456' })).rejects.toThrow('local IPv4');
  });
});
