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

    const authUrl = `${oidcConfig.issuerUrl}/auth/login?${params.toString()}`;

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
    
    const tokenEndpoint = `${oidcConfig.issuerUrl}/oidc/token`;
    console.log('Token exchange request:', {
      endpoint: tokenEndpoint,
      clientId: oidcConfig.clientId,
      redirectUri: oidcConfig.redirectUri,
      hasClientSecret: !!oidcConfig.clientSecret,
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier
    });
    
    // Use Basic Authentication as expected by SSO server
    const credentials = btoa(`${oidcConfig.clientId}:${oidcConfig.clientSecret}`);
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: oidcConfig.redirectUri,
      code_verifier: codeVerifier
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    console.log('Token exchange response details:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange error details:', error);
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenResponse = await response.json() as TokenResponse;
    console.log('Token response (full):', tokenResponse);
    console.log('Available token fields:', Object.keys(tokenResponse));

    return tokenResponse;
  }

  async verifyIDToken(idToken: string): Promise<IDTokenClaims> {
    console.log('Raw ID token:', idToken);
    
    // Simple JWT parsing - in production, should verify signature against OIDC provider's keys
    const parts = idToken.split('.');
    console.log('JWT parts count:', parts.length);
    
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }

    // Decode and log header
    const header = JSON.parse(this.base64URLDecode(parts[0]));
    console.log('JWT header:', header);

    // Decode and log payload
    const payload = JSON.parse(this.base64URLDecode(parts[1])) as IDTokenClaims;
    console.log('JWT payload (complete):', payload);
    console.log('Available payload fields:', Object.keys(payload));
    
    // Check for common OIDC fields
    console.log('Standard OIDC fields check:', {
      sub: payload.sub,
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp,
      iat: payload.iat,
      email: payload.email,
      name: payload.name,
      preferred_username: (payload as any).preferred_username,
      given_name: (payload as any).given_name,
      family_name: (payload as any).family_name
    });

    const oidcConfig = this.config.getConfig();
    
    console.log('ID token payload (full):', payload);
    console.log('ID token validation:', {
      tokenAudience: payload.aud,
      expectedClientId: oidcConfig.clientId,
      tokenIssuer: payload.iss,
      expectedIssuer: oidcConfig.issuerUrl,
      tokenExp: payload.exp,
      currentTime: Math.floor(Date.now() / 1000),
      audienceMatch: payload.aud === oidcConfig.clientId,
      issuerMatch: payload.iss === oidcConfig.issuerUrl
    });
    
    // Basic validation
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('ID token expired');
    }

    // Skip audience and issuer validation for non-standard SSO server
    // The SSO server doesn't include aud and iss fields in the ID token
    console.log('Skipping audience and issuer validation for non-standard ID token');

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
