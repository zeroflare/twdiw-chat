import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '../events/DomainEvent';
import { SessionTerminated } from '../events/SessionTerminated';
import { SessionExpired } from '../events/SessionExpired';

/**
 * Enumeration of possible session types.
 */
export enum SessionType {
  DAILY_MATCH = 'DAILY_MATCH',           // Daily random match session
  GROUP_INITIATED = 'GROUP_INITIATED'    // Group-initiated private chat
}

/**
 * Enumeration of possible session statuses.
 */
export enum SessionStatus {
  ACTIVE = 'ACTIVE',           // Session is active
  EXPIRED = 'EXPIRED',         // Session has expired (reached expiresAt)
  TERMINATED = 'TERMINATED'    // Session was manually terminated
}

/**
 * Properties required to create a new PrivateChatSession.
 */
export interface CreatePrivateChatSessionProps {
  memberAId: string;
  memberBId: string;
  tlkChannelId: string;
  type: SessionType;
  expiresAt: number;
}

/**
 * Properties for reconstituting a PrivateChatSession from persistence.
 */
export interface ReconstitutePrivateChatSessionProps {
  id: string;
  memberAId: string;
  memberBId: string;
  tlkChannelId: string;
  type: SessionType;
  status: SessionStatus;
  expiresAt: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * PrivateChatSession - Rich Aggregate Root
 *
 * Represents a private chat session between two members in the 三人行必有我師論壇 platform.
 * This is the aggregate root for the PrivateChatSession bounded context, responsible for:
 * - Managing session lifecycle (active/expired/terminated)
 * - Enforcing session expiration rules
 * - Tracking session participants
 * - Managing session types (daily match vs group-initiated)
 * - Emitting domain events for significant state changes
 * - Optimistic locking for concurrency control
 *
 * Following Domain-Driven Design (DDD) patterns:
 * - Rich domain model with encapsulated business logic
 * - Factory methods for creation and reconstitution
 * - Domain events for async communication
 * - Version field for optimistic locking
 * - Invariant enforcement through private setters
 */
export class PrivateChatSession {
  // Aggregate identity
  private readonly id: string;

  // Core attributes
  private readonly memberAId: string;
  private readonly memberBId: string;
  private readonly tlkChannelId: string;
  private readonly type: SessionType;
  private readonly expiresAt: number;

  // Mutable state
  private status: SessionStatus;

  // Optimistic locking
  private version: number;

  // Timestamps
  private readonly createdAt: number;
  private updatedAt: number;

  // Domain events
  private domainEvents: DomainEvent[] = [];

  /**
   * Private constructor - use factory methods to create instances.
   */
  private constructor(props: {
    id: string;
    memberAId: string;
    memberBId: string;
    tlkChannelId: string;
    type: SessionType;
    status: SessionStatus;
    expiresAt: number;
    version: number;
    createdAt: number;
    updatedAt: number;
  }) {
    this.id = props.id;
    this.memberAId = props.memberAId;
    this.memberBId = props.memberBId;
    this.tlkChannelId = props.tlkChannelId;
    this.type = props.type;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new ACTIVE session.
   *
   * @param props - Creation properties
   * @returns A new PrivateChatSession instance
   * @throws Error if invariants are violated
   */
  public static create(props: CreatePrivateChatSessionProps): PrivateChatSession {
    // Invariant enforcement
    if (!props.memberAId || props.memberAId.trim() === '') {
      throw new Error('memberAId cannot be empty');
    }

    if (!props.memberBId || props.memberBId.trim() === '') {
      throw new Error('memberBId cannot be empty');
    }

    if (!props.tlkChannelId || props.tlkChannelId.trim() === '') {
      throw new Error('tlkChannelId cannot be empty');
    }

    // Invariant: memberAId and memberBId must be different
    if (props.memberAId === props.memberBId) {
      throw new Error('memberAId and memberBId must be different');
    }

    // Invariant: expiresAt must be in the future
    if (!props.expiresAt || props.expiresAt <= Date.now()) {
      throw new Error('expiresAt must be in the future');
    }

    const now = Date.now();

    return new PrivateChatSession({
      id: uuidv4(),
      memberAId: props.memberAId,
      memberBId: props.memberBId,
      tlkChannelId: props.tlkChannelId,
      type: props.type,
      status: SessionStatus.ACTIVE,
      expiresAt: props.expiresAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Factory method to reconstitute a PrivateChatSession from persistence.
   * Used by repositories when loading from database.
   *
   * @param props - Persistence data
   * @returns Reconstituted PrivateChatSession instance
   */
  public static reconstitute(props: ReconstitutePrivateChatSessionProps): PrivateChatSession {
    return new PrivateChatSession({
      id: props.id,
      memberAId: props.memberAId,
      memberBId: props.memberBId,
      tlkChannelId: props.tlkChannelId,
      type: props.type,
      status: props.status,
      expiresAt: props.expiresAt,
      version: props.version,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * Business logic: Check if session has expired.
   *
   * @param currentTime - Optional current time for testing (defaults to Date.now())
   * @returns true if session has expired, false otherwise
   */
  public isExpired(currentTime: number = Date.now()): boolean {
    return currentTime >= this.expiresAt;
  }

  /**
   * Business logic: Check if session is active.
   *
   * @returns true if session is ACTIVE, false otherwise
   */
  public isActive(): boolean {
    return this.status === SessionStatus.ACTIVE;
  }

  /**
   * Business logic: Manually terminate the session.
   *
   * Side effects:
   * - Transitions status from ACTIVE to TERMINATED
   * - Increments version (optimistic locking)
   * - Updates updatedAt timestamp
   * - Emits SessionTerminated domain event
   *
   * @throws Error if session is already terminated or expired
   */
  public terminate(): void {
    // Invariant: Cannot terminate already terminated or expired session
    if (this.status === SessionStatus.TERMINATED || this.status === SessionStatus.EXPIRED) {
      throw new Error('Session is already terminated or expired');
    }

    // State transition
    this.status = SessionStatus.TERMINATED;
    this.updatedAt = Date.now();
    this.version += 1;

    // Emit domain event
    this.addDomainEvent(new SessionTerminated(
      this.id,
      new Date()
    ));
  }

  /**
   * Business logic: Mark session as expired.
   *
   * This method is typically called by the SessionExpiryService during
   * background cleanup or when a session is accessed after its expiration time.
   *
   * Side effects:
   * - Transitions status from ACTIVE to EXPIRED
   * - Increments version (optimistic locking)
   * - Updates updatedAt timestamp
   * - Emits SessionExpired domain event
   *
   * @throws Error if session is already expired or terminated
   */
  public markAsExpired(): void {
    // Invariant: Cannot expire already expired or terminated session
    if (this.status === SessionStatus.EXPIRED || this.status === SessionStatus.TERMINATED) {
      throw new Error('Session is already expired or terminated');
    }

    // State transition
    this.status = SessionStatus.EXPIRED;
    this.updatedAt = Date.now();
    this.version += 1;

    // Emit domain event
    this.addDomainEvent(new SessionExpired(
      this.id,
      new Date()
    ));
  }

  /**
   * Business logic: Check if session involves both specified members.
   *
   * @param memberIdA - First member ID
   * @param memberIdB - Second member ID
   * @returns true if session involves both members (in any order), false otherwise
   */
  public involvesMembers(memberIdA: string, memberIdB: string): boolean {
    return (
      (this.memberAId === memberIdA && this.memberBId === memberIdB) ||
      (this.memberAId === memberIdB && this.memberBId === memberIdA)
    );
  }

  /**
   * Business logic: Check if session involves a specific member.
   *
   * @param memberId - Member ID to check
   * @returns true if session involves the member, false otherwise
   */
  public involvesMember(memberId: string): boolean {
    return this.memberAId === memberId || this.memberBId === memberId;
  }

  /**
   * Add a domain event to the aggregate's event collection.
   */
  private addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  /**
   * Get all pending domain events.
   */
  public getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  /**
   * Clear all domain events and return them.
   * Used after events have been published.
   */
  public clearDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  // Getters for encapsulated state

  public getId(): string {
    return this.id;
  }

  public getMemberAId(): string {
    return this.memberAId;
  }

  public getMemberBId(): string {
    return this.memberBId;
  }

  public getTlkChannelId(): string {
    return this.tlkChannelId;
  }

  public getType(): SessionType {
    return this.type;
  }

  public getStatus(): SessionStatus {
    return this.status;
  }

  public getExpiresAt(): number {
    return this.expiresAt;
  }

  public getVersion(): number {
    return this.version;
  }

  public getCreatedAt(): number {
    return this.createdAt;
  }

  public getUpdatedAt(): number {
    return this.updatedAt;
  }

  public isMemberParticipant(memberId: string): boolean {
    return this.memberAId === memberId || this.memberBId === memberId;
  }

  public getOtherMemberId(memberId: string): string | null {
    if (this.memberAId === memberId) {
      return this.memberBId;
    } else if (this.memberBId === memberId) {
      return this.memberAId;
    }
    return null;
  }

  /**
   * Convert aggregate to persistence format.
   * Used by repositories when saving to database.
   */
  public toPersistence(): ReconstitutePrivateChatSessionProps {
    return {
      id: this.id,
      memberAId: this.memberAId,
      memberBId: this.memberBId,
      tlkChannelId: this.tlkChannelId,
      type: this.type,
      status: this.status,
      expiresAt: this.expiresAt,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
