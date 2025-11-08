/**
 * JWT Service for session management
 * Uses Web Crypto API for signing/verification (Cloudflare Workers compatible)
 */

export interface JWTPayload {
  sub: string; // OIDC subject ID
  memberId: string;
  iat: number;
  exp: number;
}

export class JWTService {
  private secret: string;

  constructor(secret: string) {
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    this.secret = secret;
  }

  async sign(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresInSeconds = 3600): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    
    const encodedHeader = this.base64URLEncode(JSON.stringify(header));
    const encodedPayload = this.base64URLEncode(JSON.stringify(fullPayload));
    
    const signature = await this.createSignature(`${encodedHeader}.${encodedPayload}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async verify(token: string): Promise<JWTPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = await this.createSignature(`${encodedHeader}.${encodedPayload}`);
    if (signature !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }

    // Parse payload
    const payload = JSON.parse(this.base64URLDecode(encodedPayload)) as JWTPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('JWT token expired');
    }

    return payload;
  }

  private async createSignature(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return this.base64URLEncode(signature);
  }

  private base64URLEncode(data: string | ArrayBuffer): string {
    const bytes = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
    
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private base64URLDecode(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return atob(padded);
  }
}
