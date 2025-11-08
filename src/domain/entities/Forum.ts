import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '../events/DomainEvent';
import { ForumArchived } from '../events/ForumArchived';

/**
 * Enumeration of possible forum statuses.
 */
export enum ForumStatus {
  ACTIVE = 'ACTIVE',       // Forum is active and accepting members
  ARCHIVED = 'ARCHIVED'    // Forum is archived (soft deleted)
}

/**
 * Valid rank values required to access forums.
 * Based on 財富稱號 (Wealth Titles) system.
 */
export enum Rank {
  EARTH_OL_GRADUATE = 'EARTH_OL_GRADUATE',           // 地表頂級投資俱樂部
  LIFE_WINNER_S = 'LIFE_WINNER_S',                   // 人生勝利組研習社  
  QUASI_WEALTHY_VIP = 'QUASI_WEALTHY_VIP',           // 準富豪交流會
  DISTINGUISHED_PETTY = 'DISTINGUISHED_PETTY',       // 小資族奮鬥基地
  NEWBIE_VILLAGE = 'NEWBIE_VILLAGE'                  // 新手村薪水冒險團
}

/**
 * Rank hierarchy for access control.
 * Higher index = higher rank.
 */
const RANK_HIERARCHY: Rank[] = [
  Rank.NEWBIE_VILLAGE,        // 新手村薪水冒險團 🌱
  Rank.DISTINGUISHED_PETTY,   // 小資族奮鬥基地 ☕  
  Rank.QUASI_WEALTHY_VIP,     // 準富豪交流會 💼
  Rank.LIFE_WINNER_S,         // 人生勝利組研習社 🏆
  Rank.EARTH_OL_GRADUATE      // 地表頂級投資俱樂部 👑
];

/**
 * Forum name mapping based on rank requirements.
 */
export const FORUM_NAMES: Record<Rank, string> = {
  [Rank.EARTH_OL_GRADUATE]: '地表頂級投資俱樂部 👑',
  [Rank.LIFE_WINNER_S]: '人生勝利組研習社 🏆', 
  [Rank.QUASI_WEALTHY_VIP]: '準富豪交流會 💼',
  [Rank.DISTINGUISHED_PETTY]: '小資族奮鬥基地 ☕',
  [Rank.NEWBIE_VILLAGE]: '新手村薪水冒險團 🌱'
};

/**
 * Wealth title mapping for VC verification.
 */
export const WEALTH_TITLES: Record<Rank, string> = {
  [Rank.EARTH_OL_GRADUATE]: '地球OL財富畢業證書',
  [Rank.LIFE_WINNER_S]: '人生勝利組S級玩家卡',
  [Rank.QUASI_WEALTHY_VIP]: '準富豪VIP登錄證',
  [Rank.DISTINGUISHED_PETTY]: '尊爵不凡．小資族認證',
  [Rank.NEWBIE_VILLAGE]: '新手村榮譽村民證'
};

/**
 * Properties required to create a new Forum.
 */
export interface CreateForumProps {
  requiredRank: Rank;
  description?: string;
  tlkChannelId: string;
  capacity: number;
  creatorId: string;
}

/**
 * Properties for reconstituting a Forum from persistence.
 */
export interface ReconstituteForumProps {
  id: string;
  requiredRank: Rank;
  description?: string;
  tlkChannelId: string;
  capacity: number;
  memberCount: number;
  creatorId: string;
  status: ForumStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Forum - Rich Aggregate Root
 *
 * Represents a gated group forum in the 三人行必有我師論壇 platform.
 * This is the aggregate root for the Forum bounded context, responsible for:
 * - Enforcing rank-based access control (財富稱號階層: 地球OL財富畢業證書 > 人生勝利組S級玩家卡 > 準富豪VIP登錄證 > 尊爵不凡．小資族認證 > 新手村榮譽村民證)
 * - Managing forum capacity limits
 * - Managing forum lifecycle (active/archived)
 * - Tracking member count for capacity management
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
export class Forum {
  // Aggregate identity
  private readonly id: string;

  // Core attributes
  private readonly requiredRank: Rank;
  private readonly description?: string;
  private readonly tlkChannelId: string;
  private readonly capacity: number;
  private readonly creatorId: string;

  // Mutable state
  private status: ForumStatus;
  private memberCount: number;

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
    requiredRank: Rank;
    description?: string;
    tlkChannelId: string;
    capacity: number;
    memberCount: number;
    creatorId: string;
    status: ForumStatus;
    version: number;
    createdAt: number;
    updatedAt: number;
  }) {
    this.id = props.id;
    this.requiredRank = props.requiredRank;
    this.description = props.description;
    this.tlkChannelId = props.tlkChannelId;
    this.capacity = props.capacity;
    this.memberCount = props.memberCount;
    this.creatorId = props.creatorId;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new ACTIVE forum.
   *
   * @param props - Creation properties
   * @returns A new Forum instance
   * @throws Error if invariants are violated
   */
  public static create(props: CreateForumProps): Forum {
    // Invariant enforcement
    if (!props.requiredRank || props.requiredRank.toString().trim() === '') {
      throw new Error('requiredRank cannot be empty');
    }

    if (!Object.values(Rank).includes(props.requiredRank)) {
      throw new Error('Invalid rank value');
    }

    if (!props.tlkChannelId || props.tlkChannelId.trim() === '') {
      throw new Error('tlkChannelId cannot be empty');
    }

    if (props.capacity <= 0) {
      throw new Error('capacity must be greater than 0');
    }

    if (!props.creatorId || props.creatorId.trim() === '') {
      throw new Error('creatorId cannot be empty');
    }

    const now = Date.now();

    return new Forum({
      id: uuidv4(),
      requiredRank: props.requiredRank,
      description: props.description,
      tlkChannelId: props.tlkChannelId,
      capacity: props.capacity,
      memberCount: 0,
      creatorId: props.creatorId,
      status: ForumStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Factory method to reconstitute a Forum from persistence.
   * Used by repositories when loading from database.
   *
   * @param props - Persistence data
   * @returns Reconstituted Forum instance
   */
  public static reconstitute(props: ReconstituteForumProps): Forum {
    return new Forum({
      id: props.id,
      requiredRank: props.requiredRank,
      description: props.description,
      tlkChannelId: props.tlkChannelId,
      capacity: props.capacity,
      memberCount: props.memberCount,
      creatorId: props.creatorId,
      status: props.status,
      version: props.version,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * Business logic: Check if a member with given rank can access this forum.
   *
   * Access control rules:
   * - Forum must be ACTIVE (not archived)
   * - Forum must have available capacity (not full)
   * - Member's rank must be >= forum's required rank
   * - Rank hierarchy: 地球OL財富畢業證書 > 人生勝利組S級玩家卡 > 準富豪VIP登錄證 > 尊爵不凡．小資族認證 > 新手村榮譽村民證
   *
   * @param memberRank - The rank of the member attempting to access
   * @returns true if member can access, false otherwise
   * @throws Error if memberRank is invalid
   */
  public canMemberAccess(memberRank: string): boolean {
    // Validate member rank
    if (!Object.values(Rank).includes(memberRank as Rank)) {
      throw new Error('Invalid member rank');
    }

    // Forum must be active
    if (this.status !== ForumStatus.ACTIVE) {
      return false;
    }

    // Forum must have available capacity
    if (this.isFull()) {
      return false;
    }

    // Check rank hierarchy
    const memberRankLevel = RANK_HIERARCHY.indexOf(memberRank as Rank);
    const forumRankLevel = RANK_HIERARCHY.indexOf(this.requiredRank);

    // Member can access if their rank is >= forum's required rank
    return memberRankLevel >= forumRankLevel;
  }

  /**
   * Business logic: Check if forum is at capacity.
   *
   * @returns true if forum is full, false otherwise
   */
  public isFull(): boolean {
    return this.memberCount >= this.capacity;
  }

  /**
   * Business logic: Increment member count when a member joins.
   *
   * Side effects:
   * - Increments memberCount
   * - Updates version (optimistic locking)
   * - Updates updatedAt timestamp
   *
   * @throws Error if forum is archived
   */
  public incrementMemberCount(): void {
    this.ensureNotArchived();

    this.memberCount += 1;
    this.updatedAt = Date.now();
    this.version += 1;
  }

  /**
   * Business logic: Decrement member count when a member leaves.
   *
   * Side effects:
   * - Decrements memberCount
   * - Updates version (optimistic locking)
   * - Updates updatedAt timestamp
   *
   * @throws Error if forum is archived or count would become negative
   */
  public decrementMemberCount(): void {
    this.ensureNotArchived();

    if (this.memberCount <= 0) {
      throw new Error('Member count cannot be negative');
    }

    this.memberCount -= 1;
    this.updatedAt = Date.now();
    this.version += 1;
  }

  /**
   * Business logic: Archive forum (soft delete).
   *
   * Archived forums:
   * - Cannot be accessed by members
   * - Cannot be modified (member count changes)
   * - Are excluded from active forum listings
   *
   * Side effects:
   * - Transitions status from ACTIVE to ARCHIVED
   * - Updates version (optimistic locking)
   * - Updates updatedAt timestamp
   * - Emits ForumArchived domain event
   *
   * @throws Error if forum is already archived
   */
  public archive(): void {
    if (this.status === ForumStatus.ARCHIVED) {
      throw new Error('Forum is already archived');
    }

    this.status = ForumStatus.ARCHIVED;
    this.updatedAt = Date.now();
    this.version += 1;

    // Emit domain event
    this.addDomainEvent(new ForumArchived(
      this.id,
      new Date()
    ));
  }

  /**
   * Invariant helper: Ensure forum is not archived.
   * @throws Error if forum is archived
   */
  private ensureNotArchived(): void {
    if (this.status === ForumStatus.ARCHIVED) {
      throw new Error('Cannot modify archived forum');
    }
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

  public getRequiredRank(): Rank {
    return this.requiredRank;
  }

  public getDescription(): string | undefined {
    return this.description;
  }

  public getTlkChannelId(): string {
    return this.tlkChannelId;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getMemberCount(): number {
    return this.memberCount;
  }

  public getCreatorId(): string {
    return this.creatorId;
  }

  public getStatus(): ForumStatus {
    return this.status;
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
  public toPersistence(): ReconstituteForumProps {
    return {
      id: this.id,
      requiredRank: this.requiredRank,
      description: this.description,
      tlkChannelId: this.tlkChannelId,
      capacity: this.capacity,
      memberCount: this.memberCount,
      creatorId: this.creatorId,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
