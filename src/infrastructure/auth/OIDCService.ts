/**
 * OIDC Service
 * Handles OIDC authentication flow with PKCE and state validation
 */

import { OIDCConfig, PKCEChallenge } from './OIDCConfig';
import { JWTService } from './JWTService';

export interface AuthorizationRequest {
  authUrl: string;
  state: string;
  codeVerifier: string;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

export interface IDTokenClaims {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  email?: string;
  name?: string;
}

export class OIDCService {
  private config: OIDCConfig;
  private jwtService: JWTService;

  constructor(env: any) {
    this.config = new OIDCConfig(env);
    this.jwtService = new JWTService(env.JWT_SECRET);
  }

  async createAuthorizationRequest(): Promise<AuthorizationRequest> {
    const oidcConfig = this.config.getConfig();
    const pkce = await this.config.generatePKCE();
    const state = this.config.generateState();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: oidcConfig.clientId,
      redirect_uri: oidcConfig.redirectUri,
      scope: oidcConfig.scopes.join(' '),
      state: state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod
    });

    const authUrl = `${oidcConfig.issuerUrl}/auth?${params.toString()}`;

    return {
      authUrl,
      state,
      codeVerifier: pkce.codeVerifier
    };
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    state: string,
    receivedState: string
  ): Promise<TokenResponse> {
    // Validate state parameter (CSRF protection)
    if (state !== receivedState) {
      throw new Error('Invalid state parameter');
    }

    const oidcConfig = this.config.getConfig();
    
    const tokenEndpoint = `${oidcConfig.issuerUrl}/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: oidcConfig.redirectUri,
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      code_verifier: codeVerifier
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return await response.json() as TokenResponse;
  }

  async verifyIDToken(idToken: string): Promise<IDTokenClaims> {
    // Simple JWT parsing - in production, should verify signature against OIDC provider's keys
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }

    const payload = JSON.parse(this.base64URLDecode(parts[1])) as IDTokenClaims;
    
    // Basic validation
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('ID token expired');
    }

    const oidcConfig = this.config.getConfig();
    if (payload.aud !== oidcConfig.clientId) {
      throw new Error('Invalid audience');
    }

    if (payload.iss !== oidcConfig.issuerUrl) {
      throw new Error('Invalid issuer');
    }

    return payload;
  }

  async createSessionToken(oidcSubjectId: string, memberId: string): Promise<string> {
    return await this.jwtService.sign({
      sub: oidcSubjectId,
      memberId
    }, 3600); // 1 hour expiration
  }

  private base64URLDecode(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return atob(padded);
  }
}
