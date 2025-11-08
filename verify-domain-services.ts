/**
 * Verification script for domain service interfaces.
 * This script verifies that all domain service interfaces compile correctly.
 */

import {
  MatchingService,
  MatchingCriteria,
  MatchResult,
  MatchType,
} from './src/domain/services/MatchingService';

import {
  RankVerificationService,
  VerificationRequest,
  VerificationResult,
  VerificationStatus,
  RankCardClaim,
} from './src/domain/services/RankVerificationService';

import {
  SessionExpiryService,
  ExpiryCheckResult,
  SessionCleanupResult,
  ExpiryPolicy,
} from './src/domain/services/SessionExpiryService';

// Type checks
const matchingCriteria: MatchingCriteria = {
  memberId: 'test',
  rank: 'Gold',
};

const matchResult: MatchResult = {
  success: true,
  matchedMemberId: 'test',
  matchType: MatchType.DAILY_MATCH,
};

const verificationRequest: VerificationRequest = {
  memberId: 'test',
  callbackUrl: 'https://test.com',
};

const verificationResult: VerificationResult = {
  transactionId: 'txn-123',
  status: VerificationStatus.PENDING,
  authUri: 'https://wallet.test.com',
};

const expiryCheck: ExpiryCheckResult = {
  sessionId: 'session-123',
  isExpired: false,
  expiresAt: Date.now() + 1000,
  currentTime: Date.now(),
};

const expiryPolicy: ExpiryPolicy = {
  sessionType: 'DAILY_MATCH',
  durationMs: 24 * 60 * 60 * 1000,
};

console.log('✅ All domain service interfaces compile successfully!');
console.log('✅ MatchingService interface verified');
console.log('✅ RankVerificationService interface verified');
console.log('✅ SessionExpiryService interface verified');
