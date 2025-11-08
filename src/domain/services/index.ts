/**
 * Domain Services Index
 *
 * Exports all domain service interfaces and their related types.
 * Domain services encapsulate business logic that spans multiple aggregates
 * or coordinates with external systems.
 */

// MatchingService - Member matching logic
export {
  MatchingService,
  MatchingCriteria,
  MatchResult,
  MatchType,
} from './MatchingService';

// RankVerificationService - VC verification with twdiw API
export {
  RankVerificationService,
  VerificationRequest,
  VerificationResult,
  VerificationStatus,
  RankCardClaim,
} from './RankVerificationService';

// SessionExpiryService - Session lifecycle management
export {
  SessionExpiryService,
  ExpiryCheckResult,
  SessionCleanupResult,
  CleanupError,
  ExpiryPolicy,
} from './SessionExpiryService';
