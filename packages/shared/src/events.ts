/** Domain events exchanged between modules via the outbox. */

export type TransportEventType = 'TransportPlanned' | 'TransportUpdated' | 'TransportDeleted';

export interface TransportEventPayload {
  transportId: string;
  tripId: string;
  /** Owning user; drives per-user scoping of the calendar projection (M0). */
  userId: string;
  tripType: 'PLAN' | 'MEMORY';
  /** Resolved display names for event title construction. */
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  syncKey: string;
}

export interface OutboxEnvelope<T = unknown> {
  id: string;
  type: TransportEventType;
  payload: T;
  occurredAt: string;
}
