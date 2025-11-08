/**
 * Base class for all domain events in the system.
 * Domain events represent significant state changes in domain aggregates.
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventType: string;

  constructor(eventType: string) {
    this.occurredAt = new Date();
    this.eventType = eventType;
  }
}
