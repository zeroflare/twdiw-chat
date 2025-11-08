import { DomainEvent } from './DomainEvent';

export class MemberProfileUpdatedEvent implements DomainEvent {
  public readonly eventName = 'MemberProfileUpdated';
  public readonly occurredOn: Date;

  constructor(
    public readonly memberId: string,
    public readonly oidcSubjectId: string
  ) {
    this.occurredOn = new Date();
  }
}
