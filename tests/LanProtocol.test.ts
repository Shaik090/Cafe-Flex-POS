import { MainPosPairingAuthority, MAX_FRAME_BYTES, JsonLineFramer, createPairingCode, frameMessage } from '../src/utils/lanProtocol';
import { createSyncMessage, SYNC_PROTOCOL_VERSION } from '../src/utils/syncProtocol';

const base = (type: Parameters<typeof createSyncMessage>[0]['type'], payload: unknown, device = 'staff-1') => createSyncMessage({ shopId: 'shop-1', sourceDeviceId: device, type, payload });

describe('local LAN pairing protocol', () => {
  it('frames partial and coalesced JSON-line messages', () => {
    const framer = new JsonLineFramer(); const one = base('HELLO', { credential: 'secret' }); const two = base('HEARTBEAT', { credential: 'secret' });
    expect(framer.push(frameMessage(one).slice(0, 12))).toEqual([]);
    const result = framer.push(`${frameMessage(one).slice(12)}${frameMessage(two)}`);
    expect(result.map(entry => entry.message?.type)).toEqual(['HELLO', 'HEARTBEAT']);
  });

  it('rejects malformed and oversized frames without producing messages', () => {
    const framer = new JsonLineFramer(); expect(framer.push('{bad}\n')[0]?.error).toMatch(/Malformed/);
    expect(framer.push(`${'a'.repeat(MAX_FRAME_BYTES + 1)}\n`)[0]?.error).toMatch(/size limit/);
  });

  it('accepts one valid temporary code and stores a permanent credential', () => {
    const authority = new MainPosPairingAuthority(); const code = authority.generateCode(1000);
    const accepted = authority.handle(base('PAIR_REQUEST', { deviceName: 'Rahim Phone', requestedDeviceRole: 'waiter', pairingCode: code.value }), 1001);
    expect(accepted).toEqual(expect.objectContaining({ accepted: true, deviceName: 'Rahim Phone', deviceRole: 'waiter', credential: expect.stringMatching(/^pair-/) }));
    expect(authority.handle(base('PAIR_REQUEST', { deviceName: 'Another', requestedDeviceRole: 'waiter', pairingCode: code.value }, 'staff-2'), 1002)).toEqual(expect.objectContaining({ accepted: false }));
    expect(authority.handle(base('HELLO', { credential: accepted.credential }))).toEqual({ accepted: true });
  });

  it('rejects wrong, expired, and protocol-mismatched pairing requests', () => {
    const authority = new MainPosPairingAuthority(); const code = authority.generateCode(1000);
    expect(authority.handle(base('PAIR_REQUEST', { deviceName: 'Phone', requestedDeviceRole: 'waiter', pairingCode: '000000' }), 1001)).toEqual(expect.objectContaining({ accepted: false, reason: 'Incorrect pairing code.' }));
    expect(authority.handle(base('PAIR_REQUEST', { deviceName: 'Phone', requestedDeviceRole: 'waiter', pairingCode: code.value }), code.expiresAt + 1)).toEqual(expect.objectContaining({ accepted: false, reason: 'Pairing code expired.' }));
    const mismatch = { ...base('HELLO', { credential: 'x' }), protocolVersion: SYNC_PROTOCOL_VERSION + 1 };
    expect(authority.handle(mismatch)).toEqual(expect.objectContaining({ accepted: false, reason: 'Unsupported protocol version.' }));
  });

  it('authenticates heartbeat and test messages, rejects forgotten devices, and deduplicates test messages', () => {
    const authority = new MainPosPairingAuthority(); const code = authority.generateCode(); const paired = authority.handle(base('PAIR_REQUEST', { deviceName: 'Kitchen', requestedDeviceRole: 'kitchen', pairingCode: code.value }));
    expect(authority.handle(base('HEARTBEAT', { credential: paired.credential }))).toEqual({ accepted: true });
    const test = base('TEST_MESSAGE', { credential: paired.credential, text: 'Connection test' });
    expect(authority.handle(test)).toEqual({ accepted: true });
    expect(authority.processed.remember(test.messageId)).toBe(true); expect(authority.processed.remember(test.messageId)).toBe(false);
    authority.forget('staff-1'); expect(authority.handle(base('HELLO', { credential: paired.credential }))).toEqual(expect.objectContaining({ accepted: false }));
  });

  it('creates six digit codes with an expiry', () => {
    const code = createPairingCode(1000, 6000); expect(code.value).toMatch(/^\d{6}$/); expect(code.expiresAt).toBe(7000);
  });
});
