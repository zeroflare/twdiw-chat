import { DomainEvent } from './DomainEvent';

/**
 * SessionTerminated Domain Event
 *
 * Published when a PrivateChatSession is manually terminated.
 * This event signals that the session was ended by user action or
 * system intervention, rather than natural expiration.
 *
 * Event consumers might:
 * - Send notifications to session participants
 * - Clean up chat resources (tlk.io channels)
 * - Update analytics and usage statistics
 * - Archive chat history
 */
export class SessionTerminated extends DomainEvent {
  constructor(
    aggregateId: string,
    occurredOn: Date
  ) {
    super('SessionTerminated', aggregateId, occurredOn);
  }
}
