import { DomainEvent } from './DomainEvent';

/**
 * Domain Event: ForumArchived
 *
 * Emitted when a forum is archived (soft deleted).
 * This event signals that the forum is no longer accepting new members
 * and should be excluded from active forum listings.
 *
 * Following DDD patterns:
 * - Captures business-significant state change
 * - Immutable event for event sourcing/CQRS
 * - Uses past tense naming convention
 */
export class ForumArchived extends DomainEvent {
  /**
   * Creates a new ForumArchived event.
   *
   * @param forumId - ID of the forum that was archived
   * @param archivedAt - Timestamp when the forum was archived
   */
  constructor(
    public readonly forumId: string,
    public readonly archivedAt: Date
  ) {
    super('ForumArchived', forumId, archivedAt);
  }
}
