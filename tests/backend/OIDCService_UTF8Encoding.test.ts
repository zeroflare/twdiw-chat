/**
 * TDD Test for UTF-8 Character Encoding in JWT Payload Parsing
 * This test verifies that Chinese characters (and other UTF-8 multi-byte characters)
 * are properly decoded from JWT payloads.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OIDCService } from '../../src/infrastructure/auth/OIDCService';

describe('OIDCService - UTF-8 Character Encoding', () => {
  let oidcService: OIDCService;

  beforeEach(() => {
    // Mock environment with test configuration
    const mockEnv = {
      OIDC_ISSUER_URL: 'https://test.example.com',
      OIDC_CLIENT_ID: 'test-client-id',
      OIDC_CLIENT_SECRET: 'test-client-secret',
      OIDC_REDIRECT_URI: 'https://app.example.com/callback',
      JWT_SECRET: 'test-jwt-secret'
    };

    oidcService = new OIDCService(mockEnv);
  });

  it('should properly decode UTF-8 Chinese characters in JWT payload name field', async () => {
    // RED PHASE: This test should FAIL initially

    // Create a JWT token with Chinese characters in the name field
    // The name '吳勝繙' should be properly encoded and decoded
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: 'test-user-123',
      aud: 'test-client-id',
      iss: 'https://test.example.com',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
      email: 'test@example.com',
      name: '吳勝繙' // Chinese characters that previously showed as 'å\x90³å\x8b\x9Dç¹\x99'
    };

    // Manually create a JWT token with proper UTF-8 encoding
    const base64UrlEncode = (str: string): string => {
      // Properly encode UTF-8 to base64
      const utf8Bytes = new TextEncoder().encode(str);
      const base64 = btoa(String.fromCharCode(...utf8Bytes));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signature = 'fake-signature'; // We're not validating signature in this test

    const idToken = `${headerB64}.${payloadB64}.${signature}`;

    // Verify the token
    const claims = await oidcService.verifyIDToken(idToken);

    // Assert that the name field contains properly decoded Chinese characters
    expect(claims.name).toBe('吳勝繙');
    expect(claims.name).not.toBe('å\x90³å\x8b\x9Dç¹\x99'); // Should not be the garbled version
    expect(claims.sub).toBe('test-user-123');
    expect(claims.email).toBe('test@example.com');
  });

  it('should handle various UTF-8 characters in JWT payload', async () => {
    // Test with multiple UTF-8 character sets
    const testCases = [
      { name: '吳勝繙', description: 'Chinese characters' },
      { name: '日本語テスト', description: 'Japanese characters' },
      { name: '한글테스트', description: 'Korean characters' },
      { name: 'Émoji🎉Test', description: 'Emoji and accented characters' },
      { name: 'Привет', description: 'Cyrillic characters' }
    ];

    for (const testCase of testCases) {
      const payload = {
        sub: 'test-user',
        aud: 'test-client-id',
        iss: 'https://test.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        name: testCase.name
      };

      const base64UrlEncode = (str: string): string => {
        const utf8Bytes = new TextEncoder().encode(str);
        const base64 = btoa(String.fromCharCode(...utf8Bytes));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const idToken = `${headerB64}.${payloadB64}.fake-signature`;

      const claims = await oidcService.verifyIDToken(idToken);

      expect(claims.name).toBe(testCase.name);
    }
  });
});
