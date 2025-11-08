import { MemberProfile, MemberStatus, Rank } from '../entities/MemberProfile';

/**
 * IMemberProfileRepository - Repository Interface for MemberProfile Aggregate
 *
 * Following Domain-Driven Design (DDD) Repository pattern, this interface defines
 * the contract for persisting and retrieving MemberProfile aggregates.
 *
 * Key responsibilities:
 * - Abstract persistence implementation details from the domain layer
 * - Provide collection-like interface for aggregate root (MemberProfile)
 * - Enforce aggregate boundaries (only MemberProfile, not nested entities)
 * - Support optimistic locking via version field
 * - Handle domain event publication after successful saves
 * - Encrypt/decrypt sensitive fields (gender, interests) at rest
 *
 * Design principles:
 * - Interface Segregation: Focused contract for MemberProfile only
 * - Dependency Inversion: Domain depends on abstraction, not implementation
 * - Ubiquitous Language: Method names match domain terminology
 * - Security by Default: Encryption handled transparently
 *
 * Implementation notes for concrete repositories:
 * - Use MemberProfile.reconstitute() when loading from database
 * - Clear and publish domain events after successful save
 * - Implement optimistic locking check on save (compare version)
 * - Use AES-256-GCM for encrypting gender and interests fields
 * - Use database indexes for efficient lookups (oidcSubjectId, linkedVcDid, status, rank)
 * - Never log PII in error messages (comply with GF1: No PII in Logs)
 * - Use parameterized queries to prevent SQL injection
 */
export interface IMemberProfileRepository {
  /**
   * Persist a MemberProfile aggregate to the database.
   *
   * Implementation requirements:
   * - Check version field for optimistic locking (throw OptimisticLockException if mismatch)
   * - Encrypt sensitive fields (gender, interests) before persisting
   * - Save aggregate to database
   * - Clear and publish domain events after successful save
   * - Increment version in database
   *
   * @param profile - The MemberProfile aggregate to save
   * @throws OptimisticLockException if version mismatch detected
   * @throws RepositoryException if database operation fails
   */
  save(profile: MemberProfile): Promise<void>;

  /**
   * Find a MemberProfile by its unique identifier.
   *
   * Implementation requirements:
   * - Return null if not found
   * - Decrypt sensitive fields (gender, interests) after loading
   * - Use MemberProfile.reconstitute() to rebuild aggregate
   * - Do not emit domain events during reconstitution
   *
   * @param id - The unique identifier of the member
   * @returns The MemberProfile aggregate, or null if not found
   */
  findById(id: string): Promise<MemberProfile | null>;

  /**
   * Find a MemberProfile by its OIDC subject identifier.
   *
   * This is the primary external identifier from the OIDC provider.
   * oidcSubjectId is unique per member (enforced by database constraint).
   *
   * Implementation requirements:
   * - Use database index on oidcSubjectId for efficient lookup
   * - Return null if not found
   * - Decrypt sensitive fields after loading
   * - Use MemberProfile.reconstitute() to rebuild aggregate
   *
   * @param oidcSubjectId - The OIDC subject ID (sub claim)
   * @returns The MemberProfile aggregate, or null if not found
   */
  findByOidcSubjectId(oidcSubjectId: string): Promise<MemberProfile | null>;

  /**
   * Find a MemberProfile by its linked Verifiable Credential DID.
   *
   * linkedVcDid is unique per member (enforced by database constraint).
   * Only VERIFIED members have a linkedVcDid.
   *
   * Implementation requirements:
   * - Use database index on linkedVcDid for efficient lookup
   * - Return null if not found
   * - Decrypt sensitive fields after loading
   * - Use MemberProfile.reconstitute() to rebuild aggregate
   *
   * @param linkedVcDid - The DID from the verified Rank Card VC
   * @returns The MemberProfile aggregate, or null if not found
   */
  findByLinkedVcDid(linkedVcDid: string): Promise<MemberProfile | null>;

  /**
   * Find all MemberProfiles with a specific verification status.
   *
   * Implementation requirements:
   * - Use database index on status for efficient lookup
   * - Return empty array if no members found
   * - Decrypt sensitive fields for all returned aggregates
   * - Consider pagination for large result sets (future enhancement)
   *
   * @param status - The member status (GENERAL or VERIFIED)
   * @returns Array of MemberProfile aggregates
   */
  findByStatus(status: MemberStatus): Promise<MemberProfile[]>;

  /**
   * Find all MemberProfiles with a specific derived rank.
   *
   * This returns only VERIFIED members with the specified rank.
   * GENERAL members have no rank and are not included.
   *
   * Implementation requirements:
   * - Use database index on derivedRank for efficient lookup
   * - Return empty array if no members found
   * - Only return VERIFIED members (status = VERIFIED)
   * - Decrypt sensitive fields for all returned aggregates
   * - Consider pagination for large result sets (future enhancement)
   *
   * @param rank - The rank to filter by (財富稱號階層)
   * @returns Array of VERIFIED MemberProfile aggregates with the specified rank
   */
  findByRank(rank: Rank): Promise<MemberProfile[]>;

  /**
   * Delete a MemberProfile by its unique identifier.
   *
   * Implementation requirements:
   * - Idempotent: No error if member does not exist
   * - Hard delete (not soft delete)
   * - Consider cascading deletes for related data (sessions, etc.)
   * - Publish domain event for audit trail (optional)
   *
   * @param id - The unique identifier of the member to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a member exists with the given OIDC subject identifier.
   *
   * Useful for preventing duplicate registrations during OIDC login.
   *
   * Implementation requirements:
   * - Use database index on oidcSubjectId for efficient lookup
   * - Return boolean (true if exists, false otherwise)
   * - More efficient than findByOidcSubjectId (no aggregate reconstitution)
   *
   * @param oidcSubjectId - The OIDC subject ID to check
   * @returns true if member exists, false otherwise
   */
  existsByOidcSubjectId(oidcSubjectId: string): Promise<boolean>;

  /**
   * Check if a member exists with the given linked VC DID.
   *
   * Useful for preventing duplicate VC verifications.
   *
   * Implementation requirements:
   * - Use database index on linkedVcDid for efficient lookup
   * - Return boolean (true if exists, false otherwise)
   * - More efficient than findByLinkedVcDid (no aggregate reconstitution)
   *
   * @param linkedVcDid - The DID to check
   * @returns true if member exists with this DID, false otherwise
   */
  existsByLinkedVcDid(linkedVcDid: string): Promise<boolean>;
}
