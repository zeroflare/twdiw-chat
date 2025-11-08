/**
 * Taiwan Wallet Verifier Service
 * Adapter for Taiwan government wallet verifier API integration
 * Implements RankVerificationService interface for https://verifier-sandbox.wallet.gov.tw/
 */

import {
  RankVerificationService,
  VerificationRequest,
  VerificationResult,
  VerificationStatus,
  RankCardClaim
} from '../../domain/services/RankVerificationService';

export interface TaiwanWalletQRCodeResponse {
  transactionId: string;
  authUri: string;
  qrCodeUrl: string;
  pollInterval?: number;
  expiresAt?: number;
}

export interface TaiwanWalletStatusResponse {
  status: 'pending' | 'verified' | 'failed' | 'expired';
  verifiablePresentation?: any;
  claims?: RankCardClaim;
  error?: string;
}

/**
 * TaiwanWalletVerifierService
 *
 * Secure API communication with Taiwan government wallet verifier
 * Following existing service patterns from VCVerificationService
 */
export class TaiwanWalletVerifierService implements RankVerificationService {
  private apiEndpoint: string;
  private apiToken: string;
  private ref: string;

  constructor(env: any) {
    // Default to Taiwan government sandbox endpoint
    this.apiEndpoint = env.TAIWAN_WALLET_API_ENDPOINT || 'https://verifier-sandbox.wallet.gov.tw';
    this.apiToken = env.TAIWAN_WALLET_API_TOKEN;
    this.ref = env.TAIWAN_WALLET_REF || 'twdiw-chat';

    if (!this.apiToken) {
      throw new Error('TAIWAN_WALLET_API_TOKEN is required for Taiwan wallet verifier service');
    }
  }

  /**
   * Initiate VC verification with Taiwan government wallet
   * Generates QR code for wallet presentation
   */
  async initiateVerification(request: VerificationRequest): Promise<VerificationResult> {
    try {
      // Generate unique transaction ID
      const transactionId = `tw-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Call Taiwan wallet API to generate QR code
      const response = await fetch(
        `${this.apiEndpoint}/api/oidvp/qrcode?ref=${encodeURIComponent(this.ref)}&transactionId=${encodeURIComponent(transactionId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Taiwan wallet QR code generation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`QR code generation failed: ${response.status} - ${errorText}`);
      }

      const data: TaiwanWalletQRCodeResponse = await response.json();

      // Return verification result with PENDING status
      return {
        transactionId: data.transactionId || transactionId,
        status: VerificationStatus.PENDING,
        authUri: data.authUri,
        qrCodeUrl: data.qrCodeUrl,
        pollInterval: data.pollInterval || 5000,
        expiresAt: data.expiresAt || Date.now() + 10 * 60 * 1000 // 10 minutes default
      };
    } catch (error) {
      console.error('Taiwan wallet verification initiation failed:', error);

      // Provide specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to initiate Taiwan wallet verification: ${errorMessage}`);
    }
  }

  /**
   * Check verification status from Taiwan wallet API
   * Polls the status endpoint for verification completion
   */
  async checkVerificationStatus(transactionId: string): Promise<VerificationResult> {
    try {
      // Input validation
      if (!transactionId || transactionId.trim() === '') {
        throw new Error('Transaction ID is required');
      }

      // Call Taiwan wallet status endpoint
      const response = await fetch(
        `${this.apiEndpoint}/api/oidvp/status/${encodeURIComponent(transactionId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Taiwan wallet status check failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          transactionId
        });
        throw new Error(`Status check failed: ${response.status} - ${errorText}`);
      }

      const data: TaiwanWalletStatusResponse = await response.json();

      // Map Taiwan wallet status to domain VerificationStatus
      switch (data.status) {
        case 'pending':
          return {
            transactionId,
            status: VerificationStatus.PENDING,
            pollInterval: 5000
          };

        case 'verified':
          // Verification completed successfully
          if (!data.verifiablePresentation && !data.claims) {
            throw new Error('Missing verifiable presentation or claims in verified response');
          }

          // Extract claims from response
          const claims = data.claims || this.extractRankFromVerifiablePresentation(data.verifiablePresentation);

          return {
            transactionId,
            status: VerificationStatus.VERIFIED,
            claims
          };

        case 'failed':
          return {
            transactionId,
            status: VerificationStatus.FAILED,
            errorMessage: data.error || 'Verification failed without specific error message'
          };

        case 'expired':
          return {
            transactionId,
            status: VerificationStatus.EXPIRED,
            errorMessage: data.error || 'Verification session expired - please try again'
          };

        default:
          throw new Error(`Unknown verification status received: ${data.status}`);
      }
    } catch (error) {
      console.error('Taiwan wallet verification status check failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to check Taiwan wallet verification status: ${errorMessage}`);
    }
  }

  /**
   * Extract rank from verified VC claims
   * Validates and returns rank value or null if invalid
   */
  extractRankFromClaims(claims: RankCardClaim): string | null {
    try {
      // Validate claims structure
      if (!claims || typeof claims !== 'object') {
        console.error('Invalid claims structure:', claims);
        return null;
      }

      // Validate required fields
      if (!claims.did || !claims.rank) {
        console.error('Missing required fields in claims:', { did: claims.did, rank: claims.rank });
        return null;
      }

      // Validate rank value is one of the allowed values
      const allowedRanks = [
        'EARTH_OL_GRADUATE',
        'LIFE_WINNER_S',
        'QUASI_WEALTHY_VIP',
        'DISTINGUISHED_PETTY',
        'NEWBIE_VILLAGE'
      ];

      if (!allowedRanks.includes(claims.rank)) {
        console.error('Invalid rank value:', claims.rank);
        return null;
      }

      return claims.rank;
    } catch (error) {
      console.error('Failed to extract rank from claims:', error);
      return null;
    }
  }

  /**
   * Private helper: Extract RankCardClaim from verifiable presentation
   * Parses the VP structure to find rank card credentials
   */
  private extractRankFromVerifiablePresentation(verifiablePresentation: any): RankCardClaim {
    try {
      // Validate VP structure
      if (!verifiablePresentation) {
        throw new Error('Verifiable presentation is missing');
      }

      // Check for verifiableCredential array
      const credentials = verifiablePresentation.verifiableCredential;
      if (!Array.isArray(credentials) || credentials.length === 0) {
        throw new Error('Invalid VP structure: missing or empty verifiableCredential array');
      }

      // Find rank card credential
      const rankVC = credentials.find((vc: any) =>
        vc.type?.includes('RankCard') ||
        vc.credentialSubject?.type === 'RankCard'
      );

      if (!rankVC) {
        throw new Error('Rank card credential not found in verifiable presentation');
      }

      // Extract credential subject
      const credentialSubject = rankVC.credentialSubject;
      if (!credentialSubject) {
        throw new Error('Missing credentialSubject in rank card credential');
      }

      // Extract required fields
      const did = credentialSubject.id || credentialSubject.did;
      const rank = credentialSubject.rank || credentialSubject.level;

      if (!did) {
        throw new Error('Missing DID in credential subject');
      }

      if (!rank) {
        throw new Error('Missing rank in credential subject');
      }

      // Extract optional fields
      const issuedAt = rankVC.issuanceDate ? new Date(rankVC.issuanceDate).getTime() : Date.now();
      const expiresAt = rankVC.expirationDate ? new Date(rankVC.expirationDate).getTime() : undefined;
      const issuer = rankVC.issuer?.id || rankVC.issuer;

      // Return structured claim
      return {
        did,
        rank,
        issuedAt,
        expiresAt,
        issuer
      };
    } catch (error) {
      console.error('Failed to extract rank from verifiable presentation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Invalid verifiable presentation structure: ${errorMessage}`);
    }
  }
}
