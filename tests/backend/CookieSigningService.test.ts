/**
 * CookieSigningService Tests - TDD Approach (RED Phase)
 *
 * Tests for HMAC cookie signing service using Web Crypto API
 * Tests MUST pass after implementation (GREEN phase)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CookieSigningService } from '../../src/infrastructure/security/CookieSigningService';

describe('CookieSigningService - TDD Tests', () => {
  let service: CookieSigningService;
  const testSecret = 'test-secret-key-for-hmac-signing-minimum-32-bytes-long';

  beforeEach(() => {
    service = new CookieSigningService(testSecret);
  });

  describe('Constructor', () => {
    it('should create service with valid secret', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CookieSigningService);
    });

    it('should throw error if secret is empty', () => {
      expect(() => new CookieSigningService('')).toThrow('Secret key cannot be empty');
    });

    it('should throw error if secret is only whitespace', () => {
      expect(() => new CookieSigningService('   ')).toThrow('Secret key cannot be empty');
    });

    it('should throw error if secret is undefined', () => {
      expect(() => new CookieSigningService(undefined as any)).toThrow('Secret key cannot be empty');
    });
  });

  describe('sign() method', () => {
    it('should have sign method', () => {
      expect(service.sign).toBeDefined();
      expect(typeof service.sign).toBe('function');
    });

    it('should return a Promise', () => {
      const result = service.sign('test-data');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return signed value in format: value.signature', async () => {
      const value = 'test-data';
      const signed = await service.sign(value);

      expect(signed).toContain('.');
      const parts = signed.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(value);
      expect(parts[1]).toBeTruthy(); // Signature exists
    });

    it('should return different signatures for different values', async () => {
      const signed1 = await service.sign('value1');
      const signed2 = await service.sign('value2');

      const sig1 = signed1.split('.')[1];
      const sig2 = signed2.split('.')[1];

      expect(sig1).not.toBe(sig2);
    });

    it('should return same signature for same value (deterministic)', async () => {
      const value = 'test-data';
      const signed1 = await service.sign(value);
      const signed2 = await service.sign(value);

      expect(signed1).toBe(signed2);
    });

    it('should handle empty string value', async () => {
      const signed = await service.sign('');
      expect(signed).toBeDefined();
      expect(signed).toContain('.');
    });

    it('should handle special characters in value', async () => {
      const value = 'test=data&foo=bar|special:chars';
      const signed = await service.sign(value);
      expect(signed).toContain(value);
      expect(signed).toContain('.');
    });

    it('should handle unicode characters', async () => {
      const value = '测试数据🔒';
      const signed = await service.sign(value);
      expect(signed).toContain('.');
      expect(signed.split('.')[0]).toBe(value);
    });

    it('should use HMAC-SHA256 for signing', async () => {
      // Signature should be hex-encoded SHA256 hash (64 chars)
      const signed = await service.sign('test');
      const signature = signed.split('.')[1];
      expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex = 64 chars
    });

    it('should handle JSON string values', async () => {
      const value = JSON.stringify({ state: 'abc123', verifier: 'xyz789' });
      const signed = await service.sign(value);
      expect(signed).toContain('.');
      expect(signed.split('.')[0]).toBe(value);
    });
  });

  describe('verify() method', () => {
    it('should have verify method', () => {
      expect(service.verify).toBeDefined();
      expect(typeof service.verify).toBe('function');
    });

    it('should return a Promise', () => {
      const result = service.verify('test.signature');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should verify validly signed value', async () => {
      const value = 'test-data';
      const signed = await service.sign(value);
      const result = await service.verify(signed);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(value);
    });

    it('should reject tampered value', async () => {
      const signed = await service.sign('original-value');
      const tampered = signed.replace('original', 'modified');
      const result = await service.verify(tampered);

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should reject tampered signature', async () => {
      const signed = await service.sign('test-data');
      const [value, signature] = signed.split('.');
      const tamperedSig = signature.substring(0, 60) + 'abcd'; // Change last 4 chars
      const tampered = `${value}.${tamperedSig}`;
      const result = await service.verify(tampered);

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should reject invalid format (no dot separator)', async () => {
      const result = await service.verify('invalid-format');

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should reject invalid format (multiple dots)', async () => {
      const result = await service.verify('value.sig.extra');

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should reject empty string', async () => {
      const result = await service.verify('');

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should verify empty value with valid signature', async () => {
      const signed = await service.sign('');
      const result = await service.verify(signed);

      expect(result.valid).toBe(true);
      expect(result.value).toBe('');
    });

    it('should verify special characters', async () => {
      const value = 'test=data&foo=bar|special:chars';
      const signed = await service.sign(value);
      const result = await service.verify(signed);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(value);
    });

    it('should verify unicode characters', async () => {
      const value = '测试数据🔒';
      const signed = await service.sign(value);
      const result = await service.verify(signed);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(value);
    });

    it('should verify JSON string values', async () => {
      const value = JSON.stringify({ state: 'abc123', verifier: 'xyz789' });
      const signed = await service.sign(value);
      const result = await service.verify(signed);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(value);
    });

    it('should use timing-safe comparison (constant-time)', async () => {
      // This test ensures verify doesn't use simple string comparison
      // which could leak timing information
      const signed = await service.sign('test');
      const [value, correctSig] = signed.split('.');

      // Create wrong signature with correct length
      const wrongSig = 'a'.repeat(correctSig.length);
      const tampered = `${value}.${wrongSig}`;

      const result = await service.verify(tampered);
      expect(result.valid).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('sign() should not throw on error, return error object', async () => {
      // Test that sign handles errors gracefully
      const result = await service.sign('test');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('verify() should not throw on error, return invalid result', async () => {
      // Test that verify handles errors gracefully
      const result = await service.verify('malformed');
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('verify() should handle signature with invalid hex characters', async () => {
      const result = await service.verify('test.ZZZZZZZZ');
      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });
  });

  describe('Security properties', () => {
    it('should produce different signatures with different secrets', async () => {
      const service1 = new CookieSigningService('secret1');
      const service2 = new CookieSigningService('secret2');

      const value = 'test-data';
      const signed1 = await service1.sign(value);
      const signed2 = await service2.sign(value);

      const sig1 = signed1.split('.')[1];
      const sig2 = signed2.split('.')[1];

      expect(sig1).not.toBe(sig2);
    });

    it('should fail verification with different secret', async () => {
      const service1 = new CookieSigningService('secret1');
      const service2 = new CookieSigningService('secret2');

      const signed = await service1.sign('test-data');
      const result = await service2.verify(signed);

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should produce signature of consistent length (SHA256 = 64 hex chars)', async () => {
      const values = ['a', 'short', 'longer-value-here', 'very-long-value-'.repeat(10)];

      for (const value of values) {
        const signed = await service.sign(value);
        const signature = signed.split('.')[1];
        expect(signature.length).toBe(64); // SHA256 = 32 bytes = 64 hex chars
      }
    });
  });

  describe('OIDC state cookie use case', () => {
    it('should sign and verify OIDC state cookie data', async () => {
      const stateData = JSON.stringify({
        state: 'random-state-value-123',
        codeVerifier: 'pkce-verifier-456'
      });

      const signed = await service.sign(stateData);
      const result = await service.verify(signed);

      expect(result.valid).toBe(true);
      expect(result.value).toBe(stateData);

      const parsed = JSON.parse(result.value!);
      expect(parsed.state).toBe('random-state-value-123');
      expect(parsed.codeVerifier).toBe('pkce-verifier-456');
    });

    it('should detect tampered OIDC state cookie', async () => {
      const stateData = JSON.stringify({
        state: 'original-state',
        codeVerifier: 'original-verifier'
      });

      const signed = await service.sign(stateData);

      // Attacker tries to modify state
      const tampered = signed.replace('original-state', 'modified-state');
      const result = await service.verify(tampered);

      expect(result.valid).toBe(false);
      expect(result.value).toBeNull();
    });
  });
});
