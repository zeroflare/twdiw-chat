import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '../events/DomainEvent';
import { MemberVerified } from '../events/MemberVerified';

/**
 * Enumeration of possible member verification statuses.
 */
export enum MemberStatus {
  GENERAL = 'GENERAL',     // Unverified member
  VERIFIED = 'VERIFIED'    // Verified with Rank Card VC
}

/**
 * Valid rank values that can be derived from a Rank Card VC.
 */
export enum Rank {
  GOLD = 'Gold',
  SILVER = 'Silver',
  BRONZE = 'Bronze'
}

/**
 * Rank hierarchy for access control.
 * Higher index = higher rank.
 */
const RANK_HIERARCHY: Rank[] = [Rank.BRONZE, Rank.SILVER, Rank.GOLD];

/**
 * Properties required to create a new MemberProfile.
 */
export interface CreateMemberProfileProps {
  oidcSubjectId: string;
  nickname: string;
  gender?: string;
  interests?: string;
}

/**
 * Properties for reconstituting a MemberProfile from persistence.
 */
export interface ReconstituteMemberProfileProps {
  id: string;
  oidcSubjectId: string;
  status: MemberStatus;
  nickname: string;
  gender?: string;
  interests?: string;
  linkedVcDid?: string;
  derivedRank?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * MemberProfile - Rich Aggregate Root
 *
 * Represents a member in the 三人行必有我師論壇 platform.
 * This is the aggregate root for the Member bounded context, responsible for:
 * - Enforcing invariants around member verification
 * - Managing verification state transitions (GENERAL -> VERIFIED)
 * - Access control logic for forum entry based on rank
 * - Emitting domain events for significant state changes
 * - Optimistic locking for concurrency control
 *
 * Following Domain-Driven Design (DDD) patterns:
 * - Rich domain model with encapsulated business logic
 * - Factory methods for creation and reconstitution
 * - Domain events for async communication
 * - Version field for optimistic locking
 */
export class MemberProfile {
  // Aggregate identity
  private readonly id: string;

  // Core attributes
  private readonly oidcSubjectId: string;
  private status: MemberStatus;
  private nickname: string;

  // Encrypted personal information (at-rest encryption handled by infrastructure)
  private gender?: string;
  private interests?: string;

  // Verification data
  private linkedVcDid?: string;
  private derivedRank?: Rank;

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
    oidcSubjectId: string;
    status: MemberStatus;
    nickname: string;
    gender?: string;
    interests?: string;
    linkedVcDid?: string;
    derivedRank?: Rank;
    version: number;
    createdAt: number;
    updatedAt: number;
  }) {
    this.id = props.id;
    this.oidcSubjectId = props.oidcSubjectId;
    this.status = props.status;
    this.nickname = props.nickname;
    this.gender = props.gender;
    this.interests = props.interests;
    this.linkedVcDid = props.linkedVcDid;
    this.derivedRank = props.derivedRank;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new GENERAL (unverified) member.
   *
   * @param props - Creation properties
   * @returns A new MemberProfile instance
   * @throws Error if invariants are violated
   */
  public static create(props: CreateMemberProfileProps): MemberProfile {
    // Invariant enforcement
    if (!props.oidcSubjectId || props.oidcSubjectId.trim() === '') {
      throw new Error('oidcSubjectId cannot be empty');
    }
    if (!props.nickname || props.nickname.trim() === '') {
      throw new Error('nickname cannot be empty');
    }

    const now = Date.now();

    return new MemberProfile({
      id: uuidv4(),
      oidcSubjectId: props.oidcSubjectId,
      status: MemberStatus.GENERAL,
      nickname: props.nickname,
      gender: props.gender,
      interests: props.interests,
      linkedVcDid: undefined,
      derivedRank: undefined,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Factory method to reconstitute a MemberProfile from persistence.
   * Used by repositories when loading from database.
   *
   * @param props - Persistence data
   * @returns Reconstituted MemberProfile instance
   */
  public static reconstitute(props: ReconstituteMemberProfileProps): MemberProfile {
    return new MemberProfile({
      id: props.id,
      oidcSubjectId: props.oidcSubjectId,
      status: props.status,
      nickname: props.nickname,
      gender: props.gender,
      interests: props.interests,
      linkedVcDid: props.linkedVcDid,
      derivedRank: props.derivedRank as Rank | undefined,
      version: props.version,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * Business logic: Verify member with Rank Card Verifiable Credential.
   *
   * Enforces the following invariants:
   * - Member must be in GENERAL status (not already verified)
   * - DID and rank must be valid and non-empty
   * - Rank must be one of the allowed values
   *
   * Side effects:
   * - Transitions status from GENERAL to VERIFIED
   * - Stores linkedVcDid and derivedRank
   * - Increments version (optimistic locking)
   * - Emits MemberVerified domain event
   *
   * @param did - DID from the Rank Card VC
   * @param rank - Rank derived from the VC
   * @throws Error if member is already verified or parameters are invalid
   */
  public verifyWithRankCard(did: string, rank: string): void {
    // Invariant: Member must be in GENERAL status
    if (this.status !== MemberStatus.GENERAL) {
      throw new Error('Member is already verified');
    }

    // Invariant: DID cannot be empty
    if (!did || did.trim() === '') {
      throw new Error('DID cannot be empty');
    }

    // Invariant: Rank cannot be empty
    if (!rank || rank.trim() === '') {
      throw new Error('Rank cannot be empty');
    }

    // Invariant: Rank must be valid
    if (!Object.values(Rank).includes(rank as Rank)) {
      throw new Error('Invalid rank value');
    }

    // State transition
    this.status = MemberStatus.VERIFIED;
    this.linkedVcDid = did;
    this.derivedRank = rank as Rank;
    this.updatedAt = Date.now();
    this.version += 1;

    // Emit domain event
    this.addDomainEvent(new MemberVerified(
      this.id,
      did,
      rank,
      new Date()
    ));
  }

  /**
   * Business logic: Check if member can access a forum with given rank requirement.
   *
   * Access control rules:
   * - GENERAL (unverified) members cannot access any ranked forum
   * - VERIFIED members can access forums at their rank or below
   * - Rank hierarchy: Gold > Silver > Bronze
   *
   * @param forumRank - Required rank for the forum
   * @returns true if member can access, false otherwise
   * @throws Error if forumRank is invalid
   */
  public canAccessForum(forumRank: string): boolean {
    // Validate forum rank
    if (!Object.values(Rank).includes(forumRank as Rank)) {
      throw new Error('Invalid forum rank');
    }

    // GENERAL members cannot access any ranked forum
    if (this.status !== MemberStatus.VERIFIED || !this.derivedRank) {
      return false;
    }

    // Check rank hierarchy
    const memberRankLevel = RANK_HIERARCHY.indexOf(this.derivedRank);
    const forumRankLevel = RANK_HIERARCHY.indexOf(forumRank as Rank);

    // Member can access if their rank is >= forum's required rank
    return memberRankLevel >= forumRankLevel;
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

  public getOidcSubjectId(): string {
    return this.oidcSubjectId;
  }

  public getStatus(): MemberStatus {
    return this.status;
  }

  public getNickname(): string {
    return this.nickname;
  }

  public getGender(): string | undefined {
    return this.gender;
  }

  public getInterests(): string | undefined {
    return this.interests;
  }

  public getLinkedVcDid(): string | undefined {
    return this.linkedVcDid;
  }

  public getDerivedRank(): string | undefined {
    return this.derivedRank;
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

  /**
   * Convert aggregate to persistence format.
   * Used by repositories when saving to database.
   */
  public toPersistence(): ReconstituteMemberProfileProps {
    return {
      id: this.id,
      oidcSubjectId: this.oidcSubjectId,
      status: this.status,
      nickname: this.nickname,
      gender: this.gender,
      interests: this.interests,
      linkedVcDid: this.linkedVcDid,
      derivedRank: this.derivedRank,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
