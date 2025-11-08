/**
 * OIDC Configuration Service
 * Handles OIDC provider configuration with security-by-default settings
 */

export interface OIDCConfiguration {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export class OIDCConfig {
  private config: OIDCConfiguration;

  constructor(env: any) {
    this.config = {
      issuerUrl: env.OIDC_ISSUER_URL || 'https://verifier-sandbox.wallet.gov.tw',
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      redirectUri: env.OIDC_REDIRECT_URI || `${env.BASE_URL}/auth/callback`,
      scopes: ['openid', 'profile']
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.clientId) {
      throw new Error('OIDC_CLIENT_ID is required');
    }
    if (!this.config.clientSecret) {
      throw new Error('OIDC_CLIENT_SECRET is required');
    }
  }

  getConfig(): OIDCConfiguration {
    return { ...this.config };
  }

  async generatePKCE(): Promise<PKCEChallenge> {
    // Generate code verifier (43-128 characters)
    const codeVerifier = this.generateRandomString(128);
    
    // Generate code challenge using SHA256
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = this.base64URLEncode(digest);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }

  generateState(): string {
    return this.generateRandomString(32);
  }

  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, (byte) => charset[byte % charset.length]).join('');
  }

  private base64URLEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
