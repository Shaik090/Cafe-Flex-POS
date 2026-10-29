import { SyncMessage, SyncMessageType } from '../types';

export const SYNC_PROTOCOL_VERSION = 1;

export function createMessageId() {
  return `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createSyncMessage<TPayload>(input: Omit<SyncMessage<TPayload>, 'protocolVersion' | 'messageId' | 'sentAt'>): SyncMessage<TPayload> {
  return { protocolVersion: SYNC_PROTOCOL_VERSION, messageId: createMessageId(), sentAt: new Date().toISOString(), ...input };
}

const messageTypes: SyncMessageType[] = ['HELLO', 'PAIR_REQUEST', 'PAIR_ACCEPTED', 'PAIR_REJECTED', 'HEARTBEAT', 'HEARTBEAT_ACK', 'DISCONNECT', 'TEST_MESSAGE', 'TEST_MESSAGE_ACK', 'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_CANCELLED', 'ORDER_PAID', 'KITCHEN_TICKET_CREATED', 'KITCHEN_TICKET_UPDATED', 'TABLE_UPDATED', 'STAFF_SESSION_CHANGED'];

export function isValidSyncMessage(value: unknown): value is SyncMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<SyncMessage>;
  return message.protocolVersion === SYNC_PROTOCOL_VERSION && typeof message.messageId === 'string' && !!message.messageId && typeof message.shopId === 'string' && !!message.shopId && typeof message.sourceDeviceId === 'string' && !!message.sourceDeviceId && typeof message.sentAt === 'string' && Number.isFinite(new Date(message.sentAt).getTime()) && typeof message.type === 'string' && messageTypes.includes(message.type as SyncMessageType) && 'payload' in message;
}

/** In-memory command guard for a future Main POS transport. Persistence is intentionally deferred with networking. */
export class ProcessedMessageRegistry {
  private readonly ids = new Set<string>();
  constructor(private readonly maxEntries = 5000) {}
  has(messageId: string) { return this.ids.has(messageId); }
  remember(messageId: string) {
    if (this.ids.has(messageId)) return false;
    this.ids.add(messageId);
    if (this.ids.size > this.maxEntries) this.ids.delete(this.ids.values().next().value as string);
    return true;
  }
}
