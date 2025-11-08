/**
 * CookieSigningService - HMAC Cookie Signing Utility
 *
 * Provides HMAC-based signing and verification for cookie integrity protection.
 * Designed for OIDC state cookie protection in Cloudflare Workers environment.
 *
 * Security features:
 * - HMAC-SHA256 for message authentication
 * - Timing-safe signature comparison
 * - No throwing errors (returns result objects)
 * - Web Crypto API for secure operations
 *
 * Key management:
 * - Secret key stored in Wrangler secrets (COOKIE_SIGNING_KEY)
 * - Key should be at least 32 bytes for security
 * - Generate with: `openssl rand -base64 32`
 *
 * Format: `value.signature` (signature is hex-encoded HMAC-SHA256)
 *
 * Usage:
 * ```typescript
 * const service = new CookieSigningService(secret);
 *
 * // Sign a cookie value
 * const signed = await service.sign('my-cookie-value');
 *
 * // Verify a signed cookie
 * const result = await service.verify(signed);
 * if (result.valid) {
 *   console.log('Original value:', result.value);
 * }
 * ```
 */

export interface VerifyResult {
  valid: boolean;
  value: string | null;
}

export class CookieSigningService {
  private secret: string;

  constructor(secret: string) {
    if (!secret || secret.trim() === '') {
      throw new Error('Secret key cannot be empty');
    }
    this.secret = secret;
  }

  /**
   * Sign a value using HMAC-SHA256.
   *
   * @param value - The value to sign
   * @returns Signed value in format `value.signature` (signature is hex-encoded)
   */
  async sign(value: string): Promise<string> {
    try {
      // Import secret key for HMAC
      const key = await this.importKey();

      // Encode value to bytes
      const encoder = new TextEncoder();
      const data = encoder.encode(value);

      // Generate HMAC signature
      const signature = await crypto.subtle.sign('HMAC', key, data);

      // Convert signature to hex string
      const signatureHex = this.arrayBufferToHex(signature);

      return `${value}.${signatureHex}`;
    } catch (error) {
      // Error handling without throwing - return value with empty signature
      // This maintains the contract of always returning a string
      console.error('Sign error:', error);
      return `${value}.`;
    }
  }

  /**
   * Verify a signed value using HMAC-SHA256.
   * Uses timing-safe comparison to prevent timing attacks.
   *
   * @param signedValue - Signed value in format `value.signature`
   * @returns VerifyResult with valid flag and original value (null if invalid)
   */
  async verify(signedValue: string): Promise<VerifyResult> {
    try {
      // Parse signed value
      const lastDotIndex = signedValue.lastIndexOf('.');
      if (lastDotIndex === -1) {
        return { valid: false, value: null };
      }

      const value = signedValue.substring(0, lastDotIndex);
      const providedSignature = signedValue.substring(lastDotIndex + 1);

      // Validate signature format (must be 64 hex chars for SHA256)
      if (!providedSignature || !/^[a-f0-9]{64}$/i.test(providedSignature)) {
        return { valid: false, value: null };
      }

      // Compute expected signature
      const key = await this.importKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const expectedSignature = await crypto.subtle.sign('HMAC', key, data);
      const expectedSignatureHex = this.arrayBufferToHex(expectedSignature);

      // Timing-safe comparison
      const isValid = this.timingSafeEqual(providedSignature, expectedSignatureHex);

      if (isValid) {
        return { valid: true, value };
      } else {
        return { valid: false, value: null };
      }
    } catch (error) {
      // Error handling without throwing
      console.error('Verify error:', error);
      return { valid: false, value: null };
    }
  }

  /**
   * Import secret key for HMAC operations.
   *
   * @returns CryptoKey for HMAC-SHA256 signing
   */
  private async importKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secret);

    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign', 'verify']
    );
  }

  /**
   * Convert ArrayBuffer to hex string.
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * Timing-safe string comparison to prevent timing attacks.
   * Compares two strings in constant time regardless of where they differ.
   *
   * @param a - First string
   * @param b - Second string
   * @returns true if strings are equal, false otherwise
   */
  private timingSafeEqual(a: string, b: string): boolean {
    // If lengths differ, still compare to maintain constant time
    const aLen = a.length;
    const bLen = b.length;
    const maxLen = Math.max(aLen, bLen);

    let result = aLen === bLen ? 0 : 1;

    for (let i = 0; i < maxLen; i++) {
      const aChar = i < aLen ? a.charCodeAt(i) : 0;
      const bChar = i < bLen ? b.charCodeAt(i) : 0;
      result |= aChar ^ bChar;
    }

    return result === 0;
  }
}
