/**
 * MatchingService - Domain Service Interface
 *
 * Purpose:
 * Coordinates member matching logic across multiple aggregates (MemberProfile, PrivateChatSession).
 * This is a domain service because matching logic involves:
 * - Multiple aggregates (members, sessions)
 * - External state (online status)
 * - Complex business rules (similarity, priority, exclusions)
 *
 * Following DDD patterns:
 * - Domain Service: Logic that doesn't naturally fit in a single aggregate
 * - Interface Segregation: Clear, focused contract
 * - Dependency Inversion: Depends on abstractions, not implementations
 *
 * Business Rules:
 * - FR7: Support daily matching with random private chat
 * - FR9: Prioritize verified members when pool is limited
 * - FR13: Avoid repeat matches, prioritize new pairings
 * - FR13: Re-match if initially matched user is offline
 */

/**
 * Match type enumeration.
 * Corresponds to PrivateChatSession.type in the data model.
 */
export enum MatchType {
  DAILY_MATCH = 'DAILY_MATCH',
  GROUP_INITIATED = 'GROUP_INITIATED',
}

/**
 * Criteria for finding a match.
 *
 * @property memberId - The ID of the member seeking a match
 * @property rank - The member's rank (undefined for GENERAL members)
 * @property interests - Optional array of interests for similarity matching
 * @property excludeMemberIds - Optional list of member IDs to exclude (previously matched)
 */
export interface MatchingCriteria {
  memberId: string;
  rank?: string;
  interests?: string[];
  excludeMemberIds?: string[];
}

/**
 * Result of a matching operation.
 *
 * @property success - Whether a match was found
 * @property matchedMemberId - ID of the matched member (if successful)
 * @property matchType - Type of match (daily or group-initiated)
 * @property similarityScore - Optional similarity score (0.0 to 1.0)
 * @property reason - Reason for failure (if unsuccessful)
 */
export interface MatchResult {
  success: boolean;
  matchedMemberId?: string;
  matchType?: MatchType;
  similarityScore?: number;
  reason?: string;
}

/**
 * MatchingService interface.
 *
 * Responsibilities:
 * - Find suitable matches based on criteria
 * - Apply business rules (priority, similarity, exclusions)
 * - Check for existing matches to avoid duplicates
 *
 * This is an interface, not a concrete implementation.
 * Implementations will be provided in the infrastructure layer,
 * but the contract is defined here in the domain layer.
 */
export interface MatchingService {
  /**
   * Find a daily match for a member.
   *
   * Business rules:
   * - Prioritize online members (FR13)
   * - Avoid previously matched members (FR13)
   * - Calculate similarity based on rank and interests
   * - Return null if no suitable match is found
   *
   * @param criteria - Matching criteria
   * @returns Promise<MatchResult | null> - Match result or null if no match found
   */
  findDailyMatch(criteria: MatchingCriteria): Promise<MatchResult | null>;

  /**
   * Find similar online members for potential matching.
   *
   * Used to implement re-matching when initially matched user is offline (FR13).
   *
   * @param criteria - Matching criteria
   * @returns Promise<string[]> - Array of member IDs sorted by similarity
   */
  findSimilarOnlineMembers(criteria: MatchingCriteria): Promise<string[]>;

  /**
   * Check if a member already has an active match today.
   *
   * Prevents duplicate daily matches for the same member.
   *
   * @param memberId - The member ID to check
   * @returns Promise<boolean> - True if member has existing active match
   */
  hasExistingMatch(memberId: string): Promise<boolean>;
}
