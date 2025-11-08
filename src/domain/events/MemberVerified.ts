import { DomainEvent } from './DomainEvent';

/**
 * Domain event emitted when a member successfully verifies their identity
 * with a Rank Card Verifiable Credential.
 */
export class MemberVerified extends DomainEvent {
  constructor(
    public readonly memberId: string,
    public readonly did: string,
    public readonly rank: string,
    public readonly verifiedAt: Date = new Date()
  ) {
    super('MemberVerified');
  }
}
