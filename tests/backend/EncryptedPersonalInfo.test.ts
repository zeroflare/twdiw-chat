import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptedPersonalInfo } from '../../src/domain/value-objects/EncryptedPersonalInfo';

describe('EncryptedPersonalInfo - Value Object with AES-256-GCM Encryption', () => {
  const MOCK_ENCRYPTION_KEY = 'test-encryption-key-32-characters!!'; // 32 bytes for AES-256

  describe('Factory Method - create()', () => {
    it('should create encrypted personal info with nickname', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
        },
        MOCK_ENCRYPTION_KEY
      );

      expect(info.getNickname()).toBe('TestUser');
      expect(info.getGender()).toBeUndefined();
      expect(info.getInterests()).toBeUndefined();
    });

    it('should create encrypted personal info with all fields', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
          interests: ['Tech', 'Gaming'],
        },
        MOCK_ENCRYPTION_KEY
      );

      expect(info.getNickname()).toBe('TestUser');
      expect(info.getGender()).toBe('Male');
      expect(info.getInterests()).toEqual(['Tech', 'Gaming']);
    });

    it('should throw error when nickname is empty', async () => {
      await expect(
        EncryptedPersonalInfo.create(
          {
            nickname: '',
          },
          MOCK_ENCRYPTION_KEY
        )
      ).rejects.toThrow('nickname cannot be empty');
    });

    it('should throw error when encryption key is empty', async () => {
      await expect(
        EncryptedPersonalInfo.create(
          {
            nickname: 'TestUser',
          },
          ''
        )
      ).rejects.toThrow('encryption key cannot be empty');
    });
  });

  describe('Encryption - Sensitive Fields', () => {
    it('should encrypt gender field when provided', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Female',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = info.toEncryptedPersistence();

      // Nickname should not be encrypted
      expect(encrypted.nickname).toBe('TestUser');

      // Gender should be encrypted (base64 string, not plain text)
      expect(encrypted.gender).toBeDefined();
      expect(encrypted.gender).not.toBe('Female');
      expect(typeof encrypted.gender).toBe('string');
      // Encrypted data should be base64 encoded
      expect(encrypted.gender).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should encrypt interests field when provided', async () => {
      const interests = ['Tech', 'Gaming', 'Music'];
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          interests,
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = info.toEncryptedPersistence();

      // Interests should be encrypted
      expect(encrypted.interests).toBeDefined();
      expect(encrypted.interests).not.toBe(JSON.stringify(interests));
      expect(typeof encrypted.interests).toBe('string');
      expect(encrypted.interests).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should not encrypt undefined fields', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = info.toEncryptedPersistence();

      expect(encrypted.gender).toBeUndefined();
      expect(encrypted.interests).toBeUndefined();
    });
  });

  describe('Decryption - Reconstitution from Database', () => {
    it('should decrypt gender field correctly', async () => {
      const original = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Non-binary',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = original.toEncryptedPersistence();

      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getNickname()).toBe('TestUser');
      expect(decrypted.getGender()).toBe('Non-binary');
    });

    it('should decrypt interests field correctly', async () => {
      const interests = ['Tech', 'Gaming', 'Music'];
      const original = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          interests,
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = original.toEncryptedPersistence();

      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getInterests()).toEqual(interests);
    });

    it('should decrypt all fields correctly in round-trip', async () => {
      const interests = ['Photography', 'Hiking'];
      const original = await EncryptedPersonalInfo.create(
        {
          nickname: 'FullUser',
          gender: 'Female',
          interests,
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = original.toEncryptedPersistence();
      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getNickname()).toBe('FullUser');
      expect(decrypted.getGender()).toBe('Female');
      expect(decrypted.getInterests()).toEqual(interests);
    });

    it('should handle undefined fields in decryption', async () => {
      const original = await EncryptedPersonalInfo.create(
        {
          nickname: 'MinimalUser',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = original.toEncryptedPersistence();
      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getNickname()).toBe('MinimalUser');
      expect(decrypted.getGender()).toBeUndefined();
      expect(decrypted.getInterests()).toBeUndefined();
    });

    it('should throw error when decrypting with wrong key', async () => {
      const original = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = original.toEncryptedPersistence();

      await expect(
        EncryptedPersonalInfo.fromEncryptedPersistence(
          encrypted,
          'wrong-key-32-characters-long!!!!'
        )
      ).rejects.toThrow();
    });
  });

  describe('Value Object Immutability', () => {
    it('should not allow modification after creation', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
          interests: ['Tech'],
        },
        MOCK_ENCRYPTION_KEY
      );

      // All getters should return copies, not references
      const interests = info.getInterests();
      if (interests) {
        interests.push('Hacking');
      }

      // Original should be unchanged
      expect(info.getInterests()).toEqual(['Tech']);
    });

    it('should be equal when values are the same', async () => {
      const info1 = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
          interests: ['Tech'],
        },
        MOCK_ENCRYPTION_KEY
      );

      const info2 = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
          interests: ['Tech'],
        },
        MOCK_ENCRYPTION_KEY
      );

      expect(info1.equals(info2)).toBe(true);
    });

    it('should not be equal when values differ', async () => {
      const info1 = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
        },
        MOCK_ENCRYPTION_KEY
      );

      const info2 = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Female',
        },
        MOCK_ENCRYPTION_KEY
      );

      expect(info1.equals(info2)).toBe(false);
    });
  });

  describe('Security - AES-256-GCM Validation', () => {
    it('should use unique IV for each encryption', async () => {
      const info1 = await EncryptedPersonalInfo.create(
        {
          nickname: 'User1',
          gender: 'Male',
        },
        MOCK_ENCRYPTION_KEY
      );

      const info2 = await EncryptedPersonalInfo.create(
        {
          nickname: 'User2',
          gender: 'Male',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted1 = info1.toEncryptedPersistence();
      const encrypted2 = info2.toEncryptedPersistence();

      // Same plaintext should produce different ciphertext due to unique IV
      expect(encrypted1.gender).not.toBe(encrypted2.gender);
    });

    it('should validate data integrity during decryption', async () => {
      const original = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = original.toEncryptedPersistence();

      // Tamper with encrypted data
      if (encrypted.gender) {
        const tamperedGender = encrypted.gender.slice(0, -4) + 'XXXX';

        await expect(
          EncryptedPersonalInfo.fromEncryptedPersistence(
            {
              ...encrypted,
              gender: tamperedGender,
            },
            MOCK_ENCRYPTION_KEY
          )
        ).rejects.toThrow();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty interests array', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          interests: [],
        },
        MOCK_ENCRYPTION_KEY
      );

      expect(info.getInterests()).toEqual([]);

      const encrypted = info.toEncryptedPersistence();
      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getInterests()).toEqual([]);
    });

    it('should handle special characters in fields', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'Test™User©',
          gender: 'Non-binary (they/them)',
          interests: ['Tech & Gaming', 'AI/ML', 'Web3.0'],
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = info.toEncryptedPersistence();
      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getNickname()).toBe('Test™User©');
      expect(decrypted.getGender()).toBe('Non-binary (they/them)');
      expect(decrypted.getInterests()).toEqual(['Tech & Gaming', 'AI/ML', 'Web3.0']);
    });

    it('should handle very long interest lists', async () => {
      const longInterests = Array.from({ length: 100 }, (_, i) => `Interest${i}`);

      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          interests: longInterests,
        },
        MOCK_ENCRYPTION_KEY
      );

      const encrypted = info.toEncryptedPersistence();
      const decrypted = await EncryptedPersonalInfo.fromEncryptedPersistence(
        encrypted,
        MOCK_ENCRYPTION_KEY
      );

      expect(decrypted.getInterests()).toEqual(longInterests);
    });
  });

  describe('Persistence Format', () => {
    it('should return correct persistence format for database storage', async () => {
      const info = await EncryptedPersonalInfo.create(
        {
          nickname: 'TestUser',
          gender: 'Male',
          interests: ['Tech'],
        },
        MOCK_ENCRYPTION_KEY
      );

      const persistence = info.toEncryptedPersistence();

      expect(persistence).toHaveProperty('nickname');
      expect(persistence.nickname).toBe('TestUser');
      expect(persistence).toHaveProperty('gender');
      expect(persistence).toHaveProperty('interests');
      expect(typeof persistence.gender).toBe('string');
      expect(typeof persistence.interests).toBe('string');
    });
  });
});
