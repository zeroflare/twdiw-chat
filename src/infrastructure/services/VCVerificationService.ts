/**
 * VC Verification Service
 * Handles Taiwan Wallet VC verification with optimized caching
 */

import { RankVerificationService, VerificationRequest, VerificationResult } from '../../domain/services/RankVerificationService';
import { createLogSanitizer, LogLevel } from '../security/LogSanitizer';
import { Rank } from '../../domain/value-objects/Rank';

export interface TwdiwQRCodeResponse {
  transactionId: string;
  qrcodeImage: string;
  authUri: string;
}

export interface TwdiwCredentialData {
  credentialType: string;
  claims?: Array<{
    ename?: string;
    cname?: string;
    value?: any;
  }>;
}

export interface TwdiwStatusResponse {
  status?: 'pending' | 'completed' | 'failed' | 'expired';
  verifiablePresentation?: any;
  error?: string;
  verifyResult?: boolean;
  resultDescription?: string;
  transactionId?: string;
  data?: TwdiwCredentialData[];
  claimSnapshot?: Array<{
    credentialType: string;
    claims: any[];
  }>;
  errorCode?: string;
  message?: string;
}

export class VCVerificationService implements RankVerificationService {
  private apiEndpoint: string;
  private apiToken: string;
  private ref: string;

  // Cache for verification results to avoid repeated API calls
  private static verificationCache = new Map<string, {
    result: VerificationResult;
    timestamp: number;
    apiCallCount: number;
  }>();

  private static readonly CACHE_TTL = 10000; // Reduced to 10 seconds for faster detection
  private static readonly MAX_API_CALLS = 30; // Increased max calls
  private static readonly API_CALL_INTERVAL = 3000; // Reduced to 3 seconds between API calls

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
    
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async initiateVerification(request: VerificationRequest): Promise<VerificationResult> {
    console.log("[VCVerificationService] Starting verification initiation", { apiEndpoint: this.apiEndpoint, ref: this.ref, hasToken: !!this.apiToken });
    try {
      const transactionId = this.generateTransactionId();
      console.log("[VCVerificationService] Generated transactionId:", transactionId);
      
      // Clear any existing cache for this transaction
      VCVerificationService.verificationCache.delete(transactionId);
      
      const url = `${this.apiEndpoint}/api/oidvp/qrcode?ref=${encodeURIComponent(this.ref)}&transactionId=${encodeURIComponent(transactionId)}`;
      console.log("[VCVerificationService] Making fetch request to:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Access-Token': this.apiToken,
          'Accept': 'application/json'
        }
      });
      
      console.log("[VCVerificationService] Fetch response received:", { status: response.status, statusText: response.statusText });

      if (!response.ok) {
        const error = await response.text();
        console.error("[VCVerificationService] API error response:", error);
        throw new Error(`QR code generation failed: ${response.status} ${error}`);
      }

      console.log("[VCVerificationService] Parsing JSON response...");
      const data: TwdiwQRCodeResponse = await response.json();
      console.log("[VCVerificationService] JSON parsed successfully:", { 
        hasTransactionId: !!data.transactionId, 
        hasQrcodeImage: !!data.qrcodeImage, 
        hasAuthUri: !!data.authUri 
      });

      const result = {
        transactionId: data.transactionId,
        qrCodeUrl: data.qrcodeImage,
        authUri: data.authUri,
        status: 'pending' as const,
        pollInterval: 3000
      };

      console.log("[VCVerificationService] Verification initiated successfully:", result);
      return result;
    } catch (error) {
      console.error('VC verification initiation failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        apiEndpoint: this.apiEndpoint,
        ref: this.ref,
        hasToken: !!this.apiToken
      });
      throw new Error('Failed to initiate VC verification');
    }
  }

  // Debug method to clear cache
  static clearCache(transactionId?: string) {
    if (transactionId) {
      VCVerificationService.verificationCache.delete(transactionId);
      console.log(`[VCVerificationService] Cleared cache for transaction: ${transactionId}`);
    } else {
      VCVerificationService.verificationCache.clear();
      console.log(`[VCVerificationService] Cleared all cache`);
    }
  }

  async checkVerificationStatus(transactionId: string): Promise<VerificationResult> {
    console.log("[VCVerificationService] Checking verification status", { transactionId, apiEndpoint: this.apiEndpoint, ref: this.ref });
    
    const now = Date.now();
    const cacheKey = `${transactionId}`;
    const cached = VCVerificationService.verificationCache.get(cacheKey);

    // Check if we have a recent cached result
    if (cached) {
      const age = now - cached.timestamp;
      
      // If result is completed or failed, return cached result (no need to check again)
      if (cached.result.status === 'completed' || cached.result.status === 'failed') {
        console.log("[VCVerificationService] Returning cached final result", { status: cached.result.status, age });
        return cached.result;
      }
      
      // If result is pending, check if we should make another API call
      if (cached.result.status === 'pending') {
        // If cache is still fresh, return cached pending result
        if (age < VCVerificationService.CACHE_TTL) {
          console.log("[VCVerificationService] Returning cached pending result", { age, ttl: VCVerificationService.CACHE_TTL });
          return cached.result;
        }
        
        // If we've made too many API calls, return cached result with extended message
        if (cached.apiCallCount >= VCVerificationService.MAX_API_CALLS) {
          console.log("[VCVerificationService] Max API calls reached, returning cached result", { apiCallCount: cached.apiCallCount });
          return {
            ...cached.result,
            message: 'Verification timeout - please regenerate QR code if needed'
          };
        }
        
        // Check if enough time has passed since last API call
        if (age < VCVerificationService.API_CALL_INTERVAL) {
          console.log("[VCVerificationService] API call interval not reached", { age, interval: VCVerificationService.API_CALL_INTERVAL });
          return cached.result;
        }
      }
    }

    try {
      // Make API call to Taiwan Wallet
      console.log("[VCVerificationService] Making API call to Taiwan Wallet", { 
        apiCallCount: cached ? cached.apiCallCount + 1 : 1 
      });
      
      const response = await fetch(`${this.apiEndpoint}/api/oidvp/result`, {
        method: 'POST',
        headers: {
          'Access-Token': this.apiToken,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactionId })
      });

      console.log("[VCVerificationService] Taiwan Wallet API response", { status: response.status, statusText: response.statusText });

      let result: VerificationResult;

      if (response.status === 400) {
        const errorText = await response.text();
        console.log("[VCVerificationService] 400 error details:", errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          const params = JSON.parse(errorData.params || '{}');
          
          if (params.code === 4002) {
            result = {
              status: 'pending',
              transactionId,
              message: 'Verification pending - please complete the process in Taiwan Wallet'
            };
          } else {
            result = {
              status: 'pending',
              transactionId,
              message: 'Verification still pending'
            };
          }
        } catch (parseError) {
          console.log("[VCVerificationService] Could not parse error details:", parseError);
          result = {
            status: 'pending',
            transactionId,
            message: 'Verification still pending'
          };
        }
      } else if (!response.ok) {
        const error = await response.text();
        result = {
          status: 'failed',
          transactionId,
          error: `API error: ${response.status} ${error}`
        };
      } else {
        // Parse successful response
        const data: TwdiwStatusResponse = await response.json();
        console.log("[VCVerificationService] Raw API response:", JSON.stringify(data, null, 2));
        console.log("[VCVerificationService] Response analysis:", {
          hasVerifyResult: 'verifyResult' in data,
          verifyResultValue: data.verifyResult,
          verifyResultType: typeof data.verifyResult,
          hasData: !!data.data,
          dataIsArray: Array.isArray(data.data),
          dataLength: Array.isArray(data.data) ? data.data.length : 0,
          hasClaimSnapshot: !!data.claimSnapshot,
          claimSnapshotLength: Array.isArray(data.claimSnapshot) ? data.claimSnapshot.length : 0,
          resultDescription: data.resultDescription,
          status: data.status
        });

        if (data.verifyResult === true) {
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const claims = this.extractRankFromCredentialData(data.data, transactionId);
            if (claims) {
              result = {
                status: 'completed',
                transactionId,
                extractedClaims: {
                  rank: claims.rank,
                  email: claims.email,
                  name: claims.name
                }
              };
            } else {
              result = {
                status: 'completed',
                transactionId,
                message: 'Verification completed but no rank information found'
              };
            }
          } else {
            result = {
              status: 'completed',
              transactionId,
              message: 'Verification completed but no data received'
            };
          }
        } else if (data.verifyResult === false) {
          result = {
            status: 'failed',
            transactionId,
            error: data.resultDescription || 'Verification failed'
          };
        } else {
          result = {
            status: 'pending',
            transactionId,
            message: 'Verification still in progress'
          };
        }
      }

      // Update cache
      VCVerificationService.verificationCache.set(cacheKey, {
        result,
        timestamp: now,
        apiCallCount: cached ? cached.apiCallCount + 1 : 1
      });

      // Clean up old cache entries (older than 10 minutes)
      const cutoff = now - 600000;
      for (const [key, value] of VCVerificationService.verificationCache.entries()) {
        if (value.timestamp < cutoff) {
          VCVerificationService.verificationCache.delete(key);
        }
      }

      return result;

    } catch (error) {
      console.error('VC verification status check failed:', error);
      
      // Return cached result if available, otherwise throw error
      if (cached) {
        console.log("[VCVerificationService] API call failed, returning cached result");
        return cached.result;
      }
      
      throw new Error('Failed to check verification status');
    }
  }

  private extractRankFromCredentialData(data: TwdiwCredentialData[], transactionId: string): { rank: string; email: string; name: string } | null {
    console.log('[DEBUG] extractRankFromCredentialData input:', {
      credentialsCount: data.length,
      credentials: data.map(c => ({
        credentialType: c.credentialType,
        claimsCount: c.claims?.length || 0
      }))
    });

    // Collect all claims from all credentials
    let rankClaim: any = null;
    let emailClaim: any = null;
    let nameClaim: any = null;

    for (const credential of data) {
      if (!credential.claims?.length) continue;

      const claims = credential.claims;
      console.log('[DEBUG] Processing credential:', {
        type: credential.credentialType,
        claimsCount: claims.length,
        claimNames: claims.map(c => ({ ename: c.ename, cname: c.cname }))
      });

      // Find rank claim
      if (!rankClaim) {
        rankClaim = claims.find((claim) => {
          const name = claim.ename?.toLowerCase() || "";
          const cname = claim.cname || "";
          return name.includes("rank") ||
            name.includes("level") ||
            name.includes("class") ||
            cname.includes("等級") ||
            cname.includes("階級") ||
            cname.includes("卡別");
        });
      }

      // Find email claim
      if (!emailClaim) {
        emailClaim = claims.find((claim) => {
          const name = claim.ename?.toLowerCase() || "";
          const cname = claim.cname || "";
          return name.includes("email") ||
                 name.includes("mail") ||
                 cname.includes("電子信箱") ||
                 cname.includes("信箱");
        });
      }

      // Find name claim
      if (!nameClaim) {
        nameClaim = claims.find((claim) => {
          const name = claim.ename?.toLowerCase() || "";
          const cname = claim.cname || "";
          return name.includes("name") ||
                 cname.includes("姓名") ||
                 cname.includes("名稱");
        });
      }
    }

    console.log('[DEBUG] Claims found:', {
      hasRank: !!rankClaim?.value,
      hasEmail: !!emailClaim?.value,
      hasName: !!nameClaim?.value,
      rankValue: rankClaim?.value,
      emailValue: emailClaim?.value,
      nameValue: nameClaim?.value
    });

    // Check if we have all required claims
    if (rankClaim?.value && emailClaim?.value && nameClaim?.value) {
      const result = {
        rank: this.normalizeRank(rankClaim.value),
        email: emailClaim.value,
        name: nameClaim.value
      };
      
      console.log('[DEBUG] Successfully extracted claims:', result);
      return result;
    }

    console.log('[DEBUG] Missing required claims - unable to extract');
    return null;
  }

  private normalizeRank(rank: string): string {
    const rankMap: Record<string, string> = {
      '地球OL財富畢業證書持有者': 'EARTH_OL_GRADUATE',
      '人生勝利組S級玩家': 'LIFE_WINNER_S',
      '準富豪VIP登錄證': 'QUASI_WEALTHY_VIP',
      '尊爵不凡．小資族認證': 'DISTINGUISHED_PETTY',
      '新手村榮譽村民證': 'NEWBIE_VILLAGE'
    };
    
    return rankMap[rank] || rank;
  }
}
