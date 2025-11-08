import { PrivateChatSession, SessionType, SessionStatus } from '../entities/PrivateChatSession';

/**
 * IPrivateChatSessionRepository - Repository Interface for PrivateChatSession Aggregate
 *
 * Following Domain-Driven Design (DDD) Repository pattern, this interface defines
 * the contract for persisting and retrieving PrivateChatSession aggregates.
 *
 * Key responsibilities:
 * - Abstract persistence implementation details from the domain layer
 * - Provide collection-like interface for aggregate root (PrivateChatSession)
 * - Enforce aggregate boundaries (only PrivateChatSession, not nested entities)
 * - Support optimistic locking via version field
 * - Handle domain event publication after successful saves
 * - Support session lifecycle management (active/expired/terminated)
 * - Enable efficient member-based and expiry-based queries
 *
 * Design principles:
 * - Interface Segregation: Focused contract for PrivateChatSession only
 * - Dependency Inversion: Domain depends on abstraction, not implementation
 * - Ubiquitous Language: Method names match domain terminology
 * - Query Optimization: Efficient member-based and time-based filtering
 *
 * Implementation notes for concrete repositories:
 * - Use PrivateChatSession.reconstitute() when loading from database
 * - Clear and publish domain events after successful save
 * - Implement optimistic locking check on save (compare version)
 * - Use database indexes for efficient lookups (tlkChannelId, memberAId, memberBId, expiresAt, status)
 * - Consider hashing member IDs in logs to protect privacy
 * - Use parameterized queries to prevent SQL injection
 * - Enforce foreign key constraints on memberAId and memberBId
 */
export interface IPrivateChatSessionRepository {
  /**
   * Persist a PrivateChatSession aggregate to the database.
   *
   * Implementation requirements:
   * - Check version field for optimistic locking (throw OptimisticLockException if mismatch)
   * - Save aggregate to database
   * - Clear and publish domain events after successful save
   * - Increment version in database
   * - Enforce unique constraint on tlkChannelId
   * - Enforce foreign key constraints on memberAId and memberBId
   *
   * @param session - The PrivateChatSession aggregate to save
   * @throws OptimisticLockException if version mismatch detected
   * @throws UniqueConstraintViolationException if tlkChannelId already exists
   * @throws ForeignKeyViolationException if memberAId or memberBId does not exist
   * @throws RepositoryException if database operation fails
   */
  save(session: PrivateChatSession): Promise<void>;

  /**
   * Find a PrivateChatSession by its unique identifier.
   *
   * Implementation requirements:
   * - Return null if not found
   * - Use PrivateChatSession.reconstitute() to rebuild aggregate
   * - Do not emit domain events during reconstitution
   *
   * @param id - The unique identifier of the session
   * @returns The PrivateChatSession aggregate, or null if not found
   */
  findById(id: string): Promise<PrivateChatSession | null>;

  /**
   * Find a PrivateChatSession by its tlk.io channel identifier.
   *
   * tlkChannelId is unique per session (enforced by database constraint).
   *
   * Implementation requirements:
   * - Use database index on tlkChannelId for efficient lookup
   * - Return null if not found
   * - Use PrivateChatSession.reconstitute() to rebuild aggregate
   *
   * @param tlkChannelId - The tlk.io channel ID
   * @returns The PrivateChatSession aggregate, or null if not found
   */
  findByTlkChannelId(tlkChannelId: string): Promise<PrivateChatSession | null>;

  /**
   * Find all active sessions involving a specific member.
   *
   * Returns sessions where the member is either memberA or memberB
   * and the session status is ACTIVE.
   *
   * Implementation requirements:
   * - Use composite indexes (status, memberAId) and (status, memberBId) for efficient lookup
   * - Filter by status = ACTIVE
   * - Filter by (memberAId = ? OR memberBId = ?)
   * - Return empty array if no active sessions found
   * - Order by createdAt DESC (newest first)
   *
   * @param memberId - The unique identifier of the member
   * @returns Array of ACTIVE PrivateChatSession aggregates involving the member
   */
  findActiveSessionsForMember(memberId: string): Promise<PrivateChatSession[]>;

  /**
   * Find an active session between two specific members.
   *
   * Returns a single ACTIVE session if one exists between the two members
   * (in either order: A-B or B-A).
   *
   * Implementation requirements:
   * - Filter by status = ACTIVE
   * - Filter by ((memberAId = ? AND memberBId = ?) OR (memberAId = ? AND memberBId = ?))
   * - Return null if no active session found
   * - Use LIMIT 1 for efficiency (should be at most one active session per pair)
   *
   * @param memberIdA - The unique identifier of the first member
   * @param memberIdB - The unique identifier of the second member
   * @returns The ACTIVE PrivateChatSession aggregate, or null if not found
   */
  findActiveSessionBetweenMembers(memberIdA: string, memberIdB: string): Promise<PrivateChatSession | null>;

  /**
   * Find all sessions that have expired (expiresAt <= currentTime).
   *
   * Returns ACTIVE sessions that have reached their expiration time.
   * Used by SessionExpiryService for background cleanup.
   *
   * Implementation requirements:
   * - Use database index on expiresAt for efficient lookup
   * - Filter by status = ACTIVE
   * - Filter by expiresAt <= currentTime
   * - Order by expiresAt ASC (oldest expired first)
   * - Return empty array if no expired sessions found
   * - Consider pagination for large result sets (batch processing)
   *
   * @param currentTime - The current timestamp (defaults to Date.now())
   * @returns Array of expired ACTIVE PrivateChatSession aggregates
   */
  findExpiredSessions(currentTime?: number): Promise<PrivateChatSession[]>;

  /**
   * Find all sessions of a specific type.
   *
   * Returns sessions with the specified type (DAILY_MATCH or GROUP_INITIATED).
   * May include sessions in any status (ACTIVE, EXPIRED, TERMINATED).
   *
   * Implementation requirements:
   * - Use database index on type for efficient lookup
   * - Return empty array if no sessions found
   * - Order by createdAt DESC (newest first)
   * - Consider pagination for large result sets (future enhancement)
   *
   * @param type - The session type (DAILY_MATCH or GROUP_INITIATED)
   * @returns Array of PrivateChatSession aggregates with the specified type
   */
  findByType(type: SessionType): Promise<PrivateChatSession[]>;

  /**
   * Delete a PrivateChatSession by its unique identifier.
   *
   * Implementation requirements:
   * - Idempotent: No error if session does not exist
   * - Hard delete (not soft delete - use terminate() or markAsExpired() for soft delete)
   * - Consider cascading cleanup for related resources (tlk.io channels, etc.)
   * - Publish domain event for audit trail (optional)
   *
   * @param id - The unique identifier of the session to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a session exists with the given tlk.io channel identifier.
   *
   * Useful for preventing duplicate tlk.io channel assignments.
   *
   * Implementation requirements:
   * - Use database index on tlkChannelId for efficient lookup
   * - Return boolean (true if exists, false otherwise)
   * - More efficient than findByTlkChannelId (no aggregate reconstitution)
   *
   * @param tlkChannelId - The tlk.io channel ID to check
   * @returns true if session exists with this channel ID, false otherwise
   */
  existsByTlkChannelId(tlkChannelId: string): Promise<boolean>;
}
