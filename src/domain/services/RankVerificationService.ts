/**
 * RankVerificationService - Domain Service Interface
 *
 * Purpose:
 * Orchestrates the Verifiable Credential (VC) verification process with the external twdiw API.
 * Acts as an Anti-Corruption Layer (ACL) to isolate the domain from external API changes.
 *
 * Following DDD patterns:
 * - Domain Service: Orchestrates external integration logic
 * - Anti-Corruption Layer: Translates external API to domain language
 * - Interface Segregation: Clear contract for VC verification
 * - Value Objects: VerificationRequest, VerificationResult, RankCardClaim
 *
 * Business Rules:
 * - FR3: Enable users to submit Rank Card VC for verification
 * - FR4: Use twdiw API for VC verification (qrcode + result endpoints)
 * - FR5: Differentiate GENERAL vs VERIFIED members based on VC
 * - Spec 2.2: Handle verification failures and timeouts with explicit errors
 */

/**
 * Verification status enumeration.
 */
export enum VerificationStatus {
  PENDING = 'PENDING',       // Verification initiated, waiting for user action
  VERIFIED = 'VERIFIED',     // VC successfully verified
  FAILED = 'FAILED',         // Verification failed (invalid VC, signature error, etc.)
  EXPIRED = 'EXPIRED',       // Verification request expired (timeout)
}

/**
 * Request to initiate VC verification.
 *
 * @property memberId - The member requesting verification
 * @property callbackUrl - Optional callback URL after verification
 * @property metadata - Optional metadata for tracking
 */
export interface VerificationRequest {
  memberId: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Claims extracted from a verified Rank Card VC.
 *
 * @property did - Decentralized Identifier from the VC
 * @property rank - Rank value (Gold, Silver, Bronze)
 * @property issuedAt - Unix timestamp when VC was issued
 * @property expiresAt - Optional Unix timestamp when VC expires
 * @property issuer - Optional DID of the VC issuer
 */
export interface RankCardClaim {
  did: string;
  rank: string;
  issuedAt: number;
  expiresAt?: number;
  issuer?: string;
}

/**
 * Result of a verification operation.
 *
 * @property transactionId - Unique ID for this verification transaction
 * @property status - Current status of verification
 * @property authUri - URI for user to present VC (QR code or deep link)
 * @property claims - Verified claims (only present when status is VERIFIED)
 * @property errorMessage - Error message (only present when status is FAILED or EXPIRED)
 */
export interface VerificationResult {
  transactionId: string;
  status: VerificationStatus;
  authUri?: string;
  claims?: RankCardClaim;
  errorMessage?: string;
}

/**
 * RankVerificationService interface.
 *
 * Responsibilities:
 * - Initiate VC verification with twdiw API
 * - Poll verification status
 * - Extract and validate rank claims
 * - Translate external API responses to domain objects
 *
 * This is an interface, not a concrete implementation.
 * Implementations will be provided in the infrastructure layer,
 * isolating the domain from external API dependencies.
 */
export interface RankVerificationService {
  /**
   * Initiate a new VC verification request.
   *
   * Calls the twdiw API to:
   * 1. Create a verification transaction
   * 2. Generate authUri (QR code or deep link) for wallet presentation
   * 3. Return transaction ID for status polling
   *
   * Business flow (Spec 2.2):
   * 1. Backend calls this method
   * 2. Frontend displays authUri as QR code or opens in wallet app
   * 3. User presents VC in wallet app
   * 4. Frontend polls checkVerificationStatus() for result
   *
   * @param request - Verification request
   * @returns Promise<VerificationResult> - Initial verification result with PENDING status
   * @throws Error if API call fails
   */
  initiateVerification(request: VerificationRequest): Promise<VerificationResult>;

  /**
   * Check the status of an ongoing verification transaction.
   *
   * Polls the twdiw API to check if user has completed VC presentation.
   *
   * Returns:
   * - PENDING: Still waiting for user action
   * - VERIFIED: VC successfully verified, claims populated
   * - FAILED: Verification failed, errorMessage populated
   * - EXPIRED: Verification timed out (typically 5 minutes)
   *
   * @param transactionId - The transaction ID from initiateVerification
   * @returns Promise<VerificationResult> - Current verification status
   * @throws Error if API call fails
   */
  checkVerificationStatus(transactionId: string): Promise<VerificationResult>;

  /**
   * Extract rank from verified VC claims.
   *
   * Validates that:
   * - Rank exists in claims
   * - Rank is one of the allowed values (Gold, Silver, Bronze)
   *
   * @param claims - The claims from a verified VC
   * @returns string | null - The rank value, or null if invalid/missing
   */
  extractRankFromClaims(claims: RankCardClaim): string | null;
}
