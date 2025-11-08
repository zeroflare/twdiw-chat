/**
 * Taiwan Wallet Verifier Service
 * Simple adapter for Taiwan government wallet verifier API
 * Generates VP QR codes and extracts rank from submitted VCs
 */

export interface QRCodeResponse {
  qrCodeUrl: string;
  authUri: string;
}

export interface RankInfo {
  rank: string;
  did: string;
  issuedAt: number;
  expiresAt?: number;
}

/**
 * TaiwanWalletVerifierService
 * Simple VP QR code generation and rank extraction
 */
export class TaiwanWalletVerifierService {
  private apiEndpoint: string;
  private apiToken: string;
  private ref: string;

  constructor(env: any) {
    this.apiEndpoint = env.TAIWAN_WALLET_API_ENDPOINT || 'https://verifier-sandbox.wallet.gov.tw';
    this.apiToken = env.TAIWAN_WALLET_API_TOKEN;
    this.ref = env.TAIWAN_WALLET_REF || 'twdiw-chat';

    if (!this.apiToken) {
      throw new Error('TAIWAN_WALLET_API_TOKEN is required');
    }
  }

  /**
   * Generate VP QR code for user to scan
   */
  async generateQRCode(): Promise<QRCodeResponse> {
    const response = await fetch(
      `${this.apiEndpoint}/api/oidvp/qrcode?ref=${encodeURIComponent(this.ref)}`,
      {
        method: 'GET',
        headers: {
          'Access-Token': this.apiToken,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QR code generation failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      qrCodeUrl: data.qrCodeUrl,
      authUri: data.authUri
    };
  }

  /**
   * Extract rank from submitted VP
   */
  extractRankFromVP(verifiablePresentation: any): RankInfo | null {
    try {
      // Find rank card credential in VP
      const credentials = verifiablePresentation.verifiableCredential || [];
      
      for (let i = 0; i < credentials.length; i++) {
        const vc = credentials[i];
        const subject = vc.credentialSubject;
        
        if (subject && subject.rank) {
          return {
            rank: subject.rank,
            did: subject.id || subject.did,
            issuedAt: new Date(vc.issuanceDate).getTime(),
            expiresAt: vc.expirationDate ? new Date(vc.expirationDate).getTime() : undefined
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to extract rank from VP:', error);
      return null;
    }
  }
}
