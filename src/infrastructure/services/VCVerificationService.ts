/**
 * VC Verification Service
 * Implements RankVerificationService interface for twdiw API integration
 */

import { 
  RankVerificationService, 
  VerificationRequest, 
  VerificationResult, 
  VerificationStatus 
} from '../../domain/services/RankVerificationService';
import { Rank } from '../../domain/entities/MemberProfile';

export interface TwdiwQRCodeResponse {
  transactionId: string;
  qrcodeImage: string;
  authUri: string;
}

export interface TwdiwStatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'expired';
  verifiablePresentation?: any;
  error?: string;
}

export class VCVerificationService implements RankVerificationService {
  private apiEndpoint: string;
  private apiToken: string;
  private ref: string;

  constructor(env: any) {
    this.apiEndpoint = env.TWDIW_API_ENDPOINT || 'https://verifier-sandbox.wallet.gov.tw';
    this.apiToken = env.TWDIW_API_TOKEN;
    this.ref = env.TWDIW_REF || '0052696330_vc_asset_player_rank_certificate';

    if (!this.apiToken) {
      throw new Error('TWDIW_API_TOKEN is required');
    }
  }

  async initiateVerification(request: VerificationRequest): Promise<VerificationResult> {
    try {
      const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const response = await fetch(`${this.apiEndpoint}/api/oidvp/qrcode?ref=${encodeURIComponent(this.ref)}&transactionId=${encodeURIComponent(transactionId)}`, {
        method: 'GET',
        headers: {
          'Access-Token': this.apiToken,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`QR code generation failed: ${response.status} ${error}`);
      }

      const data: TwdiwQRCodeResponse = await response.json();

      return {
        transactionId: data.transactionId,
        status: VerificationStatus.PENDING,
        authUri: data.authUri,
        qrCodeUrl: data.qrcodeImage // Map qrcodeImage to qrCodeUrl
      };
    } catch (error) {
      console.error('VC verification initiation failed:', error);
      throw new Error('Failed to initiate VC verification');
    }
  }

  async checkVerificationStatus(transactionId: string): Promise<VerificationResult> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/oidvp/result`, {
        method: 'POST',
        headers: {
          'Access-Token': this.apiToken,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionId })
      });

      if (response.status === 400) {
        // 400 means user hasn't uploaded data yet (still pending)
        return {
          transactionId,
          status: VerificationStatus.PENDING
        };
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Status check failed: ${response.status} ${error}`);
      }

      const data: TwdiwStatusResponse = await response.json();

      switch (data.status) {
        case 'pending':
          return {
            transactionId,
            status: VerificationStatus.PENDING,
            pollInterval: 5000
          };

        case 'completed':
          if (!data.verifiablePresentation) {
            throw new Error('Missing verifiable presentation in completed response');
          }

          const claims = this.extractRankFromClaims(data.verifiablePresentation);
          return {
            transactionId,
            status: VerificationStatus.COMPLETED,
            verifiableCredential: data.verifiablePresentation,
            extractedClaims: claims
          };

        case 'failed':
          return {
            transactionId,
            status: VerificationStatus.FAILED,
            error: data.error || 'Verification failed'
          };

        case 'expired':
          return {
            transactionId,
            status: VerificationStatus.EXPIRED,
            error: 'Verification session expired'
          };

        default:
          throw new Error(`Unknown verification status: ${data.status}`);
      }
    } catch (error) {
      console.error('VC verification status check failed:', error);
      throw new Error('Failed to check verification status');
    }
  }

  extractRankFromClaims(verifiablePresentation: any): { did: string; rank: string } {
    try {
      // Navigate through VP structure to find VC
      const vp = verifiablePresentation;
      if (!vp.verifiableCredential || !Array.isArray(vp.verifiableCredential)) {
        throw new Error('Invalid VP structure: missing verifiableCredential array');
      }

      // Find rank card VC
      const rankVC = vp.verifiableCredential.find((vc: any) => 
        vc.type?.includes('RankCard') || 
        vc.credentialSubject?.type === 'RankCard'
      );

      if (!rankVC) {
        throw new Error('Rank card VC not found in presentation');
      }

      // Extract DID and rank
      const credentialSubject = rankVC.credentialSubject;
      if (!credentialSubject) {
        throw new Error('Missing credentialSubject in rank VC');
      }

      const did = credentialSubject.id;
      const rank = credentialSubject.rank || credentialSubject.level;

      if (!did) {
        throw new Error('Missing DID in credential subject');
      }

      if (!rank) {
        throw new Error('Missing rank in credential subject');
      }

      // Normalize rank values
      const normalizedRank = this.normalizeRank(rank);

      return { did, rank: normalizedRank };
    } catch (error) {
      console.error('Failed to extract rank from VC claims:', error);
      throw new Error(`Invalid VC structure: ${error.message}`);
    }
  }

  private normalizeRank(rank: string): string {
    const rankStr = rank.toString().toLowerCase();
    
    if (rankStr.includes('gold') || rankStr.includes('金') || rankStr === '1') {
      return Rank.EARTH_OL_GRADUATE;
    } else if (rankStr.includes('silver') || rankStr.includes('銀') || rankStr === '2') {
      return Rank.LIFE_WINNER_S;
    } else if (rankStr.includes('bronze') || rankStr.includes('銅') || rankStr === '3') {
      return Rank.NEWBIE_VILLAGE;
    } else {
      throw new Error(`Unknown rank value: ${rank}`);
    }
  }
}
