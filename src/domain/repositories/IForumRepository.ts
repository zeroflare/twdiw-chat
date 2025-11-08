import { Forum, Rank, ForumStatus } from '../entities/Forum';

/**
 * IForumRepository - Repository Interface for Forum Aggregate
 *
 * Following Domain-Driven Design (DDD) Repository pattern, this interface defines
 * the contract for persisting and retrieving Forum aggregates.
 *
 * Key responsibilities:
 * - Abstract persistence implementation details from the domain layer
 * - Provide collection-like interface for aggregate root (Forum)
 * - Enforce aggregate boundaries (only Forum, not nested entities)
 * - Support optimistic locking via version field
 * - Handle domain event publication after successful saves
 * - Support rank-based access control queries
 *
 * Design principles:
 * - Interface Segregation: Focused contract for Forum only
 * - Dependency Inversion: Domain depends on abstraction, not implementation
 * - Ubiquitous Language: Method names match domain terminology
 * - Query Optimization: Efficient rank-based and status-based filtering
 *
 * Implementation notes for concrete repositories:
 * - Use Forum.reconstitute() when loading from database
 * - Clear and publish domain events after successful save
 * - Implement optimistic locking check on save (compare version)
 * - Use database indexes for efficient lookups (tlkChannelId, requiredRank, status)
 * - Never log sensitive forum content (descriptions may contain sensitive topics)
 * - Use parameterized queries to prevent SQL injection
 */
export interface IForumRepository {
  /**
   * Persist a Forum aggregate to the database.
   *
   * Implementation requirements:
   * - Check version field for optimistic locking (throw OptimisticLockException if mismatch)
   * - Save aggregate to database
   * - Clear and publish domain events after successful save
   * - Increment version in database
   * - Enforce unique constraint on tlkChannelId
   *
   * @param forum - The Forum aggregate to save
   * @throws OptimisticLockException if version mismatch detected
   * @throws UniqueConstraintViolationException if tlkChannelId already exists
   * @throws RepositoryException if database operation fails
   */
  save(forum: Forum): Promise<void>;

  /**
   * Find a Forum by its unique identifier.
   *
   * Implementation requirements:
   * - Return null if not found
   * - Use Forum.reconstitute() to rebuild aggregate
   * - Do not emit domain events during reconstitution
   *
   * @param id - The unique identifier of the forum
   * @returns The Forum aggregate, or null if not found
   */
  findById(id: string): Promise<Forum | null>;

  /**
   * Find a Forum by its tlk.io channel identifier.
   *
   * tlkChannelId is unique per forum (enforced by database constraint).
   *
   * Implementation requirements:
   * - Use database index on tlkChannelId for efficient lookup
   * - Return null if not found
   * - Use Forum.reconstitute() to rebuild aggregate
   *
   * @param tlkChannelId - The tlk.io channel ID
   * @returns The Forum aggregate, or null if not found
   */
  findByTlkChannelId(tlkChannelId: string): Promise<Forum | null>;

  /**
   * Find all Forums with a specific required rank.
   *
   * Returns only ACTIVE forums (excludes ARCHIVED forums).
   *
   * Implementation requirements:
   * - Use database index on requiredRank for efficient lookup
   * - Filter by status = ACTIVE
   * - Return empty array if no forums found
   * - Use Forum.reconstitute() for all returned aggregates
   *
   * @param rank - The required rank to filter by (Gold, Silver, or Bronze)
   * @returns Array of ACTIVE Forum aggregates with the specified required rank
   */
  findByRequiredRank(rank: Rank): Promise<Forum[]>;

  /**
   * Find all active forums.
   *
   * Returns all forums with status = ACTIVE (excludes ARCHIVED forums).
   * Results are ordered by createdAt DESC (newest first).
   *
   * Implementation requirements:
   * - Use database index on status for efficient lookup
   * - Filter by status = ACTIVE
   * - Order by createdAt DESC
   * - Return empty array if no active forums
   * - Consider pagination for large result sets (future enhancement)
   *
   * @returns Array of ACTIVE Forum aggregates
   */
  findActiveForums(): Promise<Forum[]>;

  /**
   * Find all forums accessible to a member with the given rank.
   *
   * This query applies the rank hierarchy and capacity logic:
   * - Gold members can access Gold, Silver, and Bronze forums
   * - Silver members can access Silver and Bronze forums
   * - Bronze members can only access Bronze forums
   * - Excludes full forums (memberCount >= capacity)
   * - Excludes ARCHIVED forums
   *
   * Results are ordered by requiredRank DESC, createdAt DESC
   * (highest rank first, then newest first).
   *
   * Implementation requirements:
   * - Use composite index (status, requiredRank) for efficient lookup
   * - Filter by status = ACTIVE
   * - Filter by memberCount < capacity (not full)
   * - Apply rank hierarchy logic:
   *   - Gold members: requiredRank IN (Gold, Silver, Bronze)
   *   - Silver members: requiredRank IN (Silver, Bronze)
   *   - Bronze members: requiredRank = Bronze
   * - Order by requiredRank DESC, createdAt DESC
   * - Return empty array if no accessible forums
   * - Consider pagination for large result sets (future enhancement)
   *
   * @param memberRank - The rank of the member (Gold, Silver, or Bronze)
   * @returns Array of accessible ACTIVE Forum aggregates
   */
  findAccessibleForums(memberRank: Rank): Promise<Forum[]>;

  /**
   * Delete a Forum by its unique identifier.
   *
   * Implementation requirements:
   * - Idempotent: No error if forum does not exist
   * - Hard delete (not soft delete - use archive() method for soft delete)
   * - Consider cascading cleanup for related resources (tlk.io channels, etc.)
   * - Publish domain event for audit trail (optional)
   *
   * @param id - The unique identifier of the forum to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a forum exists with the given tlk.io channel identifier.
   *
   * Useful for preventing duplicate tlk.io channel assignments.
   *
   * Implementation requirements:
   * - Use database index on tlkChannelId for efficient lookup
   * - Return boolean (true if exists, false otherwise)
   * - More efficient than findByTlkChannelId (no aggregate reconstitution)
   *
   * @param tlkChannelId - The tlk.io channel ID to check
   * @returns true if forum exists with this channel ID, false otherwise
   */
  existsByTlkChannelId(tlkChannelId: string): Promise<boolean>;
}
