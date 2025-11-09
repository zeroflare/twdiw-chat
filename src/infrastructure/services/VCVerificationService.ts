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
import { createLogSanitizer, LogLevel } from '../security/LogSanitizer';

export interface TwdiwQRCodeResponse {
  transactionId: string;
  qrcodeImage: string;
  authUri: string;
}

export interface TwdiwCredentialClaim {
  ename?: string;
  cname?: string;
  value?: string;
}

export interface TwdiwCredentialData {
  credentialType?: string;
  claims?: TwdiwCredentialClaim[];
}

export interface TwdiwStatusResponse {
  status?: 'pending' | 'completed' | 'failed' | 'expired'; // legacy
  verifiablePresentation?: any; // legacy payload
  error?: string;
  verifyResult?: boolean;
  resultDescription?: string;
  transactionId?: string;
  data?: TwdiwCredentialData[];
  errorCode?: string;
  message?: string;
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

  private generateTransactionId(): string {
    const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
    if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
      return globalCrypto.randomUUID();
    }

    // Fallback UUIDv4 implementation (RFC4122 compliant enough for sandbox)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async initiateVerification(request: VerificationRequest): Promise<VerificationResult> {
    try {
      const transactionId = this.generateTransactionId();
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

      // Log sanitized response for security audit
      const sanitizer = createLogSanitizer();
      const logData = sanitizer.sanitize(LogLevel.INFO, '[VC verification] twdiw status response', {
        transactionId,
        status: data.status ?? (typeof data.verifyResult === 'boolean' ? (data.verifyResult ? 'completed' : 'failed') : 'unknown'),
        verifyResult: data.verifyResult,
        resultDescription: data.resultDescription,
        errorCode: data.errorCode,
        hasData: Array.isArray(data.data) && data.data.length > 0,
        claimSnapshot: Array.isArray(data.data)
          ? data.data.map(item => ({
              credentialType: item.credentialType,
              claims: item.claims?.map(claim => ({ ename: claim.ename, cname: claim.cname })) || []
            }))
          : null
      });
      if (logData.shouldLog) {
        console.log(logData.message, logData.data);
      }

      // Legacy status field support
      if (data.status) {
        switch (data.status) {
          case 'pending':
            return {
              transactionId,
              status: VerificationStatus.PENDING,
              pollInterval: 5000
            };

          case 'completed': {
            const claims = this.extractRankFromResponse(data, transactionId);
            return {
              transactionId,
              status: VerificationStatus.VERIFIED,
              verifiableCredential: data.verifiablePresentation ?? data,
              extractedClaims: claims
            };
          }

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
      }

      if (typeof data.verifyResult === 'boolean') {
        if (data.verifyResult) {
          const claims = this.extractRankFromResponse(data, transactionId);
          return {
            transactionId: data.transactionId || transactionId,
            status: VerificationStatus.VERIFIED,
            verifiableCredential: data.verifiablePresentation ?? data,
            extractedClaims: claims
          };
        }

        const description = (data.resultDescription || data.message || '').toLowerCase();
        const isExpired = description.includes('expired') || data.errorCode === 'expired';

        return {
          transactionId: data.transactionId || transactionId,
          status: isExpired ? VerificationStatus.EXPIRED : VerificationStatus.FAILED,
          error: data.resultDescription || data.message || (isExpired ? 'Verification session expired' : 'Verification failed')
        };
      }

      throw new Error(`Unknown verification status: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error('VC verification status check failed:', error);
      throw new Error('Failed to check verification status');
    }
  }

  private extractRankFromResponse(response: TwdiwStatusResponse, fallbackTransactionId: string): { did: string; rank: string } {
    const sanitizer = createLogSanitizer();

    // Prioritize data[] format (current API format)
    if (response.data) {
      const extractLog = sanitizer.sanitize(LogLevel.DEBUG, '[VC verification] extracting claims from data[]', {
        transactionId: fallbackTransactionId,
        dataCount: Array.isArray(response.data) ? response.data.length : 1
      });
      if (extractLog.shouldLog) {
        console.log(extractLog.message, extractLog.data);
      }

      const fromData = this.extractRankFromCredentialData(response.data, fallbackTransactionId);
      if (fromData) {
        const extractedLog = sanitizer.sanitize(LogLevel.INFO, '[VC verification] extracted claims from data[]', {
          did: fromData.did,
          rank: fromData.rank
        });
        if (extractedLog.shouldLog) {
          console.log(extractedLog.message, extractedLog.data);
        }
        return fromData;
      }
    }

    // Fallback to legacy verifiablePresentation format
    if (response.verifiablePresentation) {
      return this.extractRankFromPresentation(response.verifiablePresentation);
    }

    const errorLog = sanitizer.sanitize(LogLevel.ERROR, 'Unable to extract rank from twdiw response', {
      hasPresentation: Boolean(response.verifiablePresentation),
      hasData: Boolean(response.data),
      credentialTypes: this.describeCredentialTypes(response.data)
    });
    if (errorLog.shouldLog) {
      console.error(errorLog.message, errorLog.data);
    }
    throw new Error('Unable to extract rank from verification response');
  }

  private describeCredentialTypes(data?: TwdiwCredentialData[] | TwdiwCredentialData | null) {
    const list = this.normalizeCredentialData(data);
    return list.map(item => ({
      credentialType: item.credentialType,
      claimNames: item.claims?.map(claim => claim.ename || claim.cname) || []
    }));
  }

  private normalizeCredentialData(data?: TwdiwCredentialData[] | TwdiwCredentialData | null): TwdiwCredentialData[] {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      return [data];
    }
    return [];
  }

  private extractRankFromCredentialData(data?: TwdiwCredentialData[] | TwdiwCredentialData | null, fallbackTransactionId?: string): { did: string; rank: string } | null {
    const credentials = this.normalizeCredentialData(data);
    if (!credentials.length) {
      return null;
    }

    for (const credential of credentials) {
      if (!credential.claims?.length) continue;

      const claims = credential.claims;

      const didClaim = claims.find((claim) => (claim.value?.startsWith('did:')) ||
        claim.ename?.toLowerCase() === 'did' ||
        claim.ename?.toLowerCase() === 'holderdid' ||
        claim.cname?.includes('DID'));

      const rankClaim = claims.find((claim) => {
        const name = claim.ename?.toLowerCase() || '';
        const cname = claim.cname || '';
        return name.includes('rank') ||
          name.includes('level') ||
          name.includes('class') ||
          cname.includes('等級') ||
          cname.includes('階級') ||
          cname.includes('卡別');
      });

      if (rankClaim?.value) {
        const didValue = didClaim?.value || (fallbackTransactionId ? `did:twdiw:${fallbackTransactionId}` : undefined);
        if (!didValue) {
          continue;
        }
        return {
          did: didValue,
          rank: this.normalizeRank(rankClaim.value)
        };
      }
    }

    return null;
  }

  private extractRankFromPresentation(verifiablePresentation: any): { did: string; rank: string } {
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

    const aliasMap: Record<string, Rank> = {
      gold: Rank.EARTH_OL_GRADUATE,
      '地球ol財富畢業證書': Rank.EARTH_OL_GRADUATE,
      '地球ol財富畢業證書持有者': Rank.EARTH_OL_GRADUATE,
      'earth_ol_graduate': Rank.EARTH_OL_GRADUATE,
      '金卡': Rank.EARTH_OL_GRADUATE,
      '人生勝利組': Rank.LIFE_WINNER_S,
      '人生勝利組s級玩家卡': Rank.LIFE_WINNER_S,
      silver: Rank.LIFE_WINNER_S,
      '尊爵不凡．小資族認證': Rank.DISTINGUISHED_PETTY,
      '尊爵不凡': Rank.DISTINGUISHED_PETTY,
      '小資族認證': Rank.DISTINGUISHED_PETTY,
      '準富豪vip登錄證': Rank.QUASI_WEALTHY_VIP,
      '準富豪': Rank.QUASI_WEALTHY_VIP,
      'vip登錄證': Rank.QUASI_WEALTHY_VIP,
      '新手村榮譽村民證': Rank.NEWBIE_VILLAGE,
      '新手村榮譽村民證持有者': Rank.NEWBIE_VILLAGE,
      '新手村': Rank.NEWBIE_VILLAGE,
      bronze: Rank.NEWBIE_VILLAGE
    };

    for (const [alias, mappedRank] of Object.entries(aliasMap)) {
      if (rankStr.includes(alias)) {
        return mappedRank;
      }
    }

    switch (rankStr) {
      case '1':
        return Rank.EARTH_OL_GRADUATE;
      case '2':
        return Rank.LIFE_WINNER_S;
      case '3':
        return Rank.QUASI_WEALTHY_VIP;
      case '4':
        return Rank.DISTINGUISHED_PETTY;
      case '5':
        return Rank.NEWBIE_VILLAGE;
      default:
        console.error('Unknown rank value received from twdiw', { raw: rank });
        throw new Error(`Unknown rank value: ${rank}`);
    }
  }
}
