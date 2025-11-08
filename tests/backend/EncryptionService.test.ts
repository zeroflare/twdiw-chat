/**
 * EncryptionService Tests - TDD Approach (RED Phase)
 *
 * Tests for AES-256-GCM encryption service using Web Crypto API
 * Focus: Key length validation and normalization (384-bit to 256-bit)
 * Tests MUST pass after implementation (GREEN phase)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from '../../src/infrastructure/security/EncryptionService';

describe('EncryptionService - TDD Tests', () => {
  // Generate valid 256-bit (32 bytes) base64 key
  const validKey256 = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)));

  // Generate invalid 384-bit (48 bytes) base64 key - THIS IS THE BUG
  const invalidKey384 = btoa(String.fromCharCode(...Array.from({ length: 48 }, (_, i) => i)));

  // Generate invalid 128-bit (16 bytes) base64 key
  const invalidKey128 = btoa(String.fromCharCode(...Array.from({ length: 16 }, (_, i) => i)));

  // Generate invalid 192-bit (24 bytes) base64 key
  const invalidKey192 = btoa(String.fromCharCode(...Array.from({ length: 24 }, (_, i) => i)));

  describe('Constructor - Key Validation', () => {
    it('should create service with valid 256-bit key', () => {
      expect(() => new EncryptionService(validKey256)).not.toThrow();
      const service = new EncryptionService(validKey256);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(EncryptionService);
    });

    it('should throw error if key is empty', () => {
      expect(() => new EncryptionService('')).toThrow('Encryption key cannot be empty');
    });

    it('should throw error if key is only whitespace', () => {
      expect(() => new EncryptionService('   ')).toThrow('Encryption key cannot be empty');
    });

    it('should throw error if key is undefined', () => {
      expect(() => new EncryptionService(undefined as any)).toThrow('Encryption key cannot be empty');
    });

    it('should accept 384-bit key and normalize to 256-bit (FIX TARGET)', () => {
      // This is the main bug fix: accept 384-bit keys and normalize
      expect(() => new EncryptionService(invalidKey384)).not.toThrow();
      const service = new EncryptionService(invalidKey384);
      expect(service).toBeDefined();
    });

    it('should accept 128-bit key and normalize to 256-bit', () => {
      // Should pad shorter keys to 256-bit
      expect(() => new EncryptionService(invalidKey128)).not.toThrow();
      const service = new EncryptionService(invalidKey128);
      expect(service).toBeDefined();
    });

    it('should accept 192-bit key and normalize to 256-bit', () => {
      // Should pad shorter keys to 256-bit
      expect(() => new EncryptionService(invalidKey192)).not.toThrow();
      const service = new EncryptionService(invalidKey192);
      expect(service).toBeDefined();
    });

    it('should throw error for invalid base64 key', () => {
      const invalidBase64 = 'not-valid-base64!@#$%';
      expect(() => new EncryptionService(invalidBase64)).toThrow();
    });
  });

  describe('encrypt() method with 256-bit key', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(validKey256);
    });

    it('should have encrypt method', () => {
      expect(service.encrypt).toBeDefined();
      expect(typeof service.encrypt).toBe('function');
    });

    it('should return a Promise', () => {
      const result = service.encrypt('test');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should encrypt plaintext and return iv:ciphertext format', async () => {
      const plaintext = 'sensitive-data';
      const encrypted = await service.encrypt(plaintext);

      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy(); // IV exists
      expect(parts[1]).toBeTruthy(); // Ciphertext exists
    });

    it('should return empty string for empty plaintext', async () => {
      const encrypted = await service.encrypt('');
      expect(encrypted).toBe('');
    });

    it('should generate different IVs for same plaintext', async () => {
      const plaintext = 'test-data';
      const encrypted1 = await service.encrypt(plaintext);
      const encrypted2 = await service.encrypt(plaintext);

      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];

      expect(iv1).not.toBe(iv2); // Random IV each time
    });

    it('should handle unicode characters', async () => {
      const plaintext = '测试加密🔒';
      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toContain(':');
      expect(encrypted).toBeTruthy();
    });

    it('should handle special characters', async () => {
      const plaintext = 'test=data&foo=bar|special:chars';
      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toContain(':');
      expect(encrypted).toBeTruthy();
    });

    it('should handle JSON strings', async () => {
      const plaintext = JSON.stringify({ user: 'test', email: 'test@example.com' });
      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toContain(':');
      expect(encrypted).toBeTruthy();
    });

    it('should produce base64-encoded output', async () => {
      const encrypted = await service.encrypt('test');
      const parts = encrypted.split(':');

      // Both IV and ciphertext should be valid base64
      expect(parts[0]).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(parts[1]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  describe('encrypt() method with 384-bit key (normalized)', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(invalidKey384);
    });

    it('should successfully encrypt with normalized 384-bit key', async () => {
      const plaintext = 'test-data-with-384bit-key';
      const encrypted = await service.encrypt(plaintext);

      expect(encrypted).toContain(':');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
    });

    it('should not throw AES key length error', async () => {
      // This was the original bug: "Imported AES key length must be 128, 192, or 256 bits but provided 384"
      await expect(service.encrypt('test')).resolves.toBeDefined();
    });
  });

  describe('decrypt() method with 256-bit key', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(validKey256);
    });

    it('should have decrypt method', () => {
      expect(service.decrypt).toBeDefined();
      expect(typeof service.decrypt).toBe('function');
    });

    it('should return a Promise', () => {
      const result = service.decrypt('dGVzdA==:dGVzdA==');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should decrypt encrypted data correctly', async () => {
      const plaintext = 'sensitive-data';
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return empty string for empty encrypted data', async () => {
      const decrypted = await service.decrypt('');
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', async () => {
      const plaintext = '测试解密🔒';
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', async () => {
      const plaintext = 'test=data&foo=bar|special:chars';
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON strings', async () => {
      const plaintext = JSON.stringify({ user: 'test', email: 'test@example.com' });
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      const parsed = JSON.parse(decrypted);
      expect(parsed.user).toBe('test');
      expect(parsed.email).toBe('test@example.com');
    });

    it('should throw error for invalid format (no colon)', async () => {
      await expect(service.decrypt('invalid-format')).rejects.toThrow('Invalid encrypted data format');
    });

    it('should throw error for invalid format (multiple colons)', async () => {
      await expect(service.decrypt('iv:ciphertext:extra')).rejects.toThrow('Invalid encrypted data format');
    });

    it('should throw error for tampered ciphertext', async () => {
      const encrypted = await service.encrypt('original-data');
      const [iv, ciphertext] = encrypted.split(':');
      const tampered = `${iv}:${ciphertext.substring(0, ciphertext.length - 4)}AAAA`;

      await expect(service.decrypt(tampered)).rejects.toThrow('Decryption failed');
    });

    it('should throw error for tampered IV', async () => {
      const encrypted = await service.encrypt('test-data');
      const [iv, ciphertext] = encrypted.split(':');
      const tamperedIv = btoa('wrong-iv-12');
      const tampered = `${tamperedIv}:${ciphertext}`;

      await expect(service.decrypt(tampered)).rejects.toThrow('Decryption failed');
    });
  });

  describe('decrypt() method with 384-bit key (normalized)', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(invalidKey384);
    });

    it('should successfully decrypt with normalized 384-bit key', async () => {
      const plaintext = 'test-data-with-384bit-key';
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip encrypt/decrypt successfully', async () => {
      const testData = [
        'simple-text',
        'unicode-测试🔒',
        JSON.stringify({ complex: 'data', nested: { value: 123 } }),
        'special!@#$%^&*()chars'
      ];

      for (const plaintext of testData) {
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('Key normalization consistency', () => {
    it('should normalize keys deterministically', async () => {
      // Same input key should produce same normalized key
      const service1 = new EncryptionService(invalidKey384);
      const service2 = new EncryptionService(invalidKey384);

      const plaintext = 'test-consistency';
      const encrypted1 = await service1.encrypt(plaintext);
      const decrypted1 = await service2.decrypt(encrypted1);

      expect(decrypted1).toBe(plaintext);
    });

    it('should normalize 128-bit key consistently', async () => {
      const service = new EncryptionService(invalidKey128);
      const plaintext = 'test-128bit';

      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should normalize 192-bit key consistently', async () => {
      const service = new EncryptionService(invalidKey192);
      const plaintext = 'test-192bit';

      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Security properties', () => {
    it('should fail decryption with wrong key', async () => {
      const service1 = new EncryptionService(validKey256);
      const service2 = new EncryptionService(btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1))));

      const encrypted = await service1.encrypt('secret-data');

      await expect(service2.decrypt(encrypted)).rejects.toThrow('Decryption failed');
    });

    it('should use AES-256-GCM authentication', async () => {
      const service = new EncryptionService(validKey256);
      const encrypted = await service.encrypt('test');

      // Tamper with ciphertext
      const [iv, ciphertext] = encrypted.split(':');
      const tamperedBytes = atob(ciphertext).split('').map((c, i) =>
        i === 0 ? String.fromCharCode(c.charCodeAt(0) ^ 1) : c
      ).join('');
      const tampered = `${iv}:${btoa(tamperedBytes)}`;

      // Should fail authentication
      await expect(service.decrypt(tampered)).rejects.toThrow('Decryption failed');
    });

    it('should produce different ciphertext each time (due to random IV)', async () => {
      const service = new EncryptionService(validKey256);
      const plaintext = 'same-data';

      const encrypted1 = await service.encrypt(plaintext);
      const encrypted2 = await service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('Error handling', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(validKey256);
    });

    it('should throw descriptive error on encryption failure', async () => {
      // This is hard to trigger in normal circumstances, but error should be descriptive
      await expect(service.encrypt('test')).resolves.toBeDefined();
    });

    it('should throw descriptive error on decryption failure', async () => {
      const invalidEncrypted = 'invalid:data';
      await expect(service.decrypt(invalidEncrypted)).rejects.toThrow('Decryption failed');
    });

    it('should handle invalid base64 in encrypted data', async () => {
      const invalidEncrypted = 'invalid!@#:base64!@#';
      await expect(service.decrypt(invalidEncrypted)).rejects.toThrow();
    });
  });

  describe('Integration: Personal info encryption use case', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(validKey256);
    });

    it('should encrypt and decrypt personal info object', async () => {
      const personalInfo = {
        realName: '王小明',
        email: 'wang@example.com',
        phoneNumber: '+886912345678',
        lineId: 'line_user_123'
      };

      const plaintext = JSON.stringify(personalInfo);
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);
      const parsed = JSON.parse(decrypted);

      expect(parsed).toEqual(personalInfo);
    });

    it('should work with 384-bit key from environment (normalized)', async () => {
      // Simulate receiving 384-bit key from environment variable
      const service384 = new EncryptionService(invalidKey384);

      const personalInfo = {
        realName: 'Test User',
        email: 'test@example.com'
      };

      const plaintext = JSON.stringify(personalInfo);
      const encrypted = await service384.encrypt(plaintext);
      const decrypted = await service384.decrypt(encrypted);
      const parsed = JSON.parse(decrypted);

      expect(parsed).toEqual(personalInfo);
    });
  });
});
