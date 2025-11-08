import { DomainEvent } from './DomainEvent';

/**
 * SessionExpired Domain Event
 *
 * Published when a PrivateChatSession reaches its expiresAt timestamp
 * and is marked as expired by the system.
 *
 * This event is typically emitted by the SessionExpiryService during
 * background cleanup processes or when a session is accessed after
 * its expiration time.
 *
 * Event consumers might:
 * - Send expiration notifications to participants
 * - Clean up chat resources (tlk.io channels)
 * - Archive chat history
 * - Update session analytics
 * - Trigger re-matching for daily match sessions
 */
export class SessionExpired extends DomainEvent {
  constructor(
    aggregateId: string,
    occurredOn: Date
  ) {
    super('SessionExpired', aggregateId, occurredOn);
  }
}
