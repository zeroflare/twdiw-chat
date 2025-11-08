/**
 * SessionExpiryService - Domain Service Interface
 *
 * Purpose:
 * Manages the lifecycle and expiration of PrivateChatSession aggregates.
 * This is a domain service because session expiry logic involves:
 * - Cross-aggregate lifecycle management
 * - Policy-based expiry rules
 * - Batch cleanup operations
 *
 * Following DDD patterns:
 * - Domain Service: Lifecycle management across aggregates
 * - Policy Pattern: ExpiryPolicy defines rules per session type
 * - Separation of Concerns: Check vs cleanup operations
 * - Interface Segregation: Clear contract for expiry management
 *
 * Business Rules:
 * - Spec 2.5: Sessions auto-terminate after expiresAt timestamp
 * - Data Model: PrivateChatSession has expiresAt field
 * - Different session types may have different expiry durations
 */

/**
 * Result of checking if a session is expired.
 *
 * @property sessionId - The session being checked
 * @property isExpired - Whether the session is expired
 * @property expiresAt - Unix timestamp when session expires
 * @property currentTime - Unix timestamp of check time
 * @property gracePeriodRemaining - Optional milliseconds remaining in grace period
 */
export interface ExpiryCheckResult {
  sessionId: string;
  isExpired: boolean;
  expiresAt: number;
  currentTime: number;
  gracePeriodRemaining?: number;
}

/**
 * Error detail for failed cleanup operation.
 *
 * @property sessionId - The session that failed to clean up
 * @property error - Error message
 */
export interface CleanupError {
  sessionId: string;
  error: string;
}

/**
 * Result of a cleanup operation.
 *
 * @property cleanedSessionIds - Array of successfully cleaned session IDs
 * @property totalCleaned - Count of successfully cleaned sessions
 * @property errors - Array of errors for failed cleanups
 */
export interface SessionCleanupResult {
  cleanedSessionIds: string[];
  totalCleaned: number;
  errors: CleanupError[];
}

/**
 * Policy defining expiry rules for a session type.
 *
 * @property sessionType - Type of session (DAILY_MATCH or GROUP_INITIATED)
 * @property durationMs - Duration in milliseconds before expiry
 * @property gracePeriodMs - Optional grace period after expiry before hard cleanup
 * @property autoCleanup - Whether to automatically cleanup expired sessions
 */
export interface ExpiryPolicy {
  sessionType: 'DAILY_MATCH' | 'GROUP_INITIATED';
  durationMs: number;
  gracePeriodMs?: number;
  autoCleanup?: boolean;
}

/**
 * SessionExpiryService interface.
 *
 * Responsibilities:
 * - Check if sessions are expired
 * - Find all expired sessions
 * - Cleanup expired sessions
 * - Calculate expiry times based on policies
 *
 * This is an interface, not a concrete implementation.
 * Implementations will be provided in the infrastructure layer.
 */
export interface SessionExpiryService {
  /**
   * Check if a specific session is expired.
   *
   * Compares session's expiresAt timestamp with current time.
   * Optionally considers grace period.
   *
   * @param sessionId - The session ID to check
   * @returns Promise<ExpiryCheckResult> - Detailed expiry status
   */
  isSessionExpired(sessionId: string): Promise<ExpiryCheckResult>;

  /**
   * Find all expired sessions.
   *
   * Queries for sessions where:
   * - expiresAt < currentTime
   * - Optionally excludes sessions still in grace period
   *
   * Used by background jobs to identify sessions for cleanup.
   *
   * @param includeGracePeriod - Whether to include sessions in grace period (default: false)
   * @returns Promise<string[]> - Array of expired session IDs
   */
  findExpiredSessions(includeGracePeriod?: boolean): Promise<string[]>;

  /**
   * Cleanup expired sessions.
   *
   * Performs the following operations:
   * 1. Find all expired sessions
   * 2. Delete session data from database
   * 3. Optionally notify participants (if integration exists)
   * 4. Return results with success/failure details
   *
   * This operation should be idempotent - safe to retry.
   *
   * @returns Promise<SessionCleanupResult> - Cleanup operation results
   */
  cleanupExpiredSessions(): Promise<SessionCleanupResult>;

  /**
   * Calculate expiry time for a new session.
   *
   * Uses the appropriate policy for the session type to determine
   * when the session should expire.
   *
   * Formula: expiresAt = createdAt + policy.durationMs
   *
   * @param createdAt - Unix timestamp when session was created
   * @param policy - Expiry policy for this session type
   * @returns number - Unix timestamp when session expires
   */
  calculateExpiryTime(createdAt: number, policy: ExpiryPolicy): number;
}
