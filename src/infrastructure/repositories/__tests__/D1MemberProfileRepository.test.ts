import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unstable_dev, UnstableDevWorker } from 'wrangler';
import { MemberProfile, MemberStatus, Rank } from '../../../domain/entities/MemberProfile';
import { D1MemberProfileRepository } from '../D1MemberProfileRepository';
import { EncryptionService } from '../../security/EncryptionService';
import { OptimisticLockException, UniqueConstraintViolationException } from '../exceptions';

describe('D1MemberProfileRepository', () => {
  let worker: UnstableDevWorker;
  let db: D1Database;
  let encryptionService: EncryptionService;
  let repository: D1MemberProfileRepository;

  const TEST_ENCRYPTION_KEY = 'dGVzdC1lbmNyeXB0aW9uLWtleS0yNTYtYml0cw=='; // base64 encoded

  beforeEach(async () => {
    // Start Miniflare worker for testing
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
    });

    // Get D1 database binding
    db = (await worker.fetch('/').then(r => r.json())) as any;

    // Setup encryption service
    encryptionService = new EncryptionService(TEST_ENCRYPTION_KEY);

    // Initialize repository
    repository = new D1MemberProfileRepository(db, encryptionService);

    // Run migrations
    await setupTestDatabase(db);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
    await worker.stop();
  });

  describe('save', () => {
    it('should save a new member profile', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
        gender: 'Male',
        interests: 'TypeScript, DDD, Security',
      });

      await repository.save(profile);

      const found = await repository.findById(profile.getId());
      expect(found).not.toBeNull();
      expect(found!.getOidcSubjectId()).toBe('auth0|12345');
      expect(found!.getNickname()).toBe('TestUser');
      expect(found!.getGender()).toBe('Male');
      expect(found!.getInterests()).toBe('TypeScript, DDD, Security');
      expect(found!.getStatus()).toBe(MemberStatus.GENERAL);
    });

    it('should encrypt sensitive fields (gender and interests)', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
        gender: 'Female',
        interests: 'React, Node.js',
      });

      await repository.save(profile);

      // Directly query database to verify encryption
      const row = await db
        .prepare('SELECT gender, interests FROM member_profiles WHERE id = ?')
        .bind(profile.getId())
        .first<{ gender: string; interests: string }>();

      expect(row).not.toBeNull();
      expect(row!.gender).not.toBe('Female'); // Should be encrypted
      expect(row!.interests).not.toBe('React, Node.js'); // Should be encrypted
      expect(row!.gender).toContain(':'); // Should have IV:ciphertext format
      expect(row!.interests).toContain(':'); // Should have IV:ciphertext format
    });

    it('should update an existing member profile', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });

      await repository.save(profile);

      // Verify with Rank Card
      profile.verifyWithRankCard('did:example:abc123', Rank.GOLD);
      await repository.save(profile);

      const found = await repository.findById(profile.getId());
      expect(found).not.toBeNull();
      expect(found!.getStatus()).toBe(MemberStatus.VERIFIED);
      expect(found!.getLinkedVcDid()).toBe('did:example:abc123');
      expect(found!.getDerivedRank()).toBe(Rank.GOLD);
    });

    it('should throw OptimisticLockException on version conflict', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });

      await repository.save(profile);

      // Load same profile twice
      const profile1 = await repository.findById(profile.getId());
      const profile2 = await repository.findById(profile.getId());

      // Modify and save first instance
      profile1!.verifyWithRankCard('did:example:123', Rank.GOLD);
      await repository.save(profile1!);

      // Try to save second instance (should fail due to version mismatch)
      profile2!.verifyWithRankCard('did:example:456', Rank.SILVER);
      await expect(repository.save(profile2!)).rejects.toThrow(OptimisticLockException);
    });

    it('should throw UniqueConstraintViolationException for duplicate oidcSubjectId', async () => {
      const profile1 = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'User1',
      });

      const profile2 = MemberProfile.create({
        oidcSubjectId: 'auth0|12345', // Same OIDC subject ID
        nickname: 'User2',
      });

      await repository.save(profile1);
      await expect(repository.save(profile2)).rejects.toThrow(UniqueConstraintViolationException);
    });

    it('should throw UniqueConstraintViolationException for duplicate linkedVcDid', async () => {
      const profile1 = MemberProfile.create({
        oidcSubjectId: 'auth0|user1',
        nickname: 'User1',
      });
      profile1.verifyWithRankCard('did:example:duplicate', Rank.GOLD);

      const profile2 = MemberProfile.create({
        oidcSubjectId: 'auth0|user2',
        nickname: 'User2',
      });
      profile2.verifyWithRankCard('did:example:duplicate', Rank.SILVER); // Same DID

      await repository.save(profile1);
      await expect(repository.save(profile2)).rejects.toThrow(UniqueConstraintViolationException);
    });

    it('should clear and not publish domain events after save', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });
      profile.verifyWithRankCard('did:example:123', Rank.GOLD);

      expect(profile.getDomainEvents().length).toBe(1);

      await repository.save(profile);

      // Events should be cleared after save
      expect(profile.getDomainEvents().length).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return null if member does not exist', async () => {
      const found = await repository.findById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should return member profile by ID', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
        gender: 'Male',
        interests: 'Coding',
      });

      await repository.save(profile);

      const found = await repository.findById(profile.getId());
      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(profile.getId());
      expect(found!.getOidcSubjectId()).toBe('auth0|12345');
      expect(found!.getNickname()).toBe('TestUser');
      expect(found!.getGender()).toBe('Male');
      expect(found!.getInterests()).toBe('Coding');
    });

    it('should decrypt sensitive fields when loading', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
        gender: 'NonBinary',
        interests: 'Art, Music, Tech',
      });

      await repository.save(profile);

      const found = await repository.findById(profile.getId());
      expect(found!.getGender()).toBe('NonBinary');
      expect(found!.getInterests()).toBe('Art, Music, Tech');
    });

    it('should not emit domain events during reconstitution', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });
      profile.verifyWithRankCard('did:example:123', Rank.GOLD);

      await repository.save(profile);

      const found = await repository.findById(profile.getId());
      expect(found!.getDomainEvents().length).toBe(0);
    });
  });

  describe('findByOidcSubjectId', () => {
    it('should return null if member does not exist', async () => {
      const found = await repository.findByOidcSubjectId('non-existent');
      expect(found).toBeNull();
    });

    it('should return member profile by OIDC subject ID', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|unique-subject',
        nickname: 'TestUser',
      });

      await repository.save(profile);

      const found = await repository.findByOidcSubjectId('auth0|unique-subject');
      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(profile.getId());
      expect(found!.getOidcSubjectId()).toBe('auth0|unique-subject');
    });
  });

  describe('findByLinkedVcDid', () => {
    it('should return null if member does not exist', async () => {
      const found = await repository.findByLinkedVcDid('did:example:nonexistent');
      expect(found).toBeNull();
    });

    it('should return member profile by linked VC DID', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });
      profile.verifyWithRankCard('did:example:unique-did', Rank.GOLD);

      await repository.save(profile);

      const found = await repository.findByLinkedVcDid('did:example:unique-did');
      expect(found).not.toBeNull();
      expect(found!.getId()).toBe(profile.getId());
      expect(found!.getLinkedVcDid()).toBe('did:example:unique-did');
    });

    it('should return null for GENERAL members without linkedVcDid', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });

      await repository.save(profile);

      const found = await repository.findByLinkedVcDid('did:example:any');
      expect(found).toBeNull();
    });
  });

  describe('findByStatus', () => {
    it('should return empty array if no members with status exist', async () => {
      const found = await repository.findByStatus(MemberStatus.VERIFIED);
      expect(found).toEqual([]);
    });

    it('should return all GENERAL members', async () => {
      const profile1 = MemberProfile.create({
        oidcSubjectId: 'auth0|user1',
        nickname: 'User1',
      });
      const profile2 = MemberProfile.create({
        oidcSubjectId: 'auth0|user2',
        nickname: 'User2',
      });

      await repository.save(profile1);
      await repository.save(profile2);

      const found = await repository.findByStatus(MemberStatus.GENERAL);
      expect(found.length).toBe(2);
      expect(found.map(p => p.getOidcSubjectId())).toContain('auth0|user1');
      expect(found.map(p => p.getOidcSubjectId())).toContain('auth0|user2');
    });

    it('should return all VERIFIED members', async () => {
      const general = MemberProfile.create({
        oidcSubjectId: 'auth0|general',
        nickname: 'General',
      });
      const verified1 = MemberProfile.create({
        oidcSubjectId: 'auth0|verified1',
        nickname: 'Verified1',
      });
      verified1.verifyWithRankCard('did:example:1', Rank.GOLD);

      const verified2 = MemberProfile.create({
        oidcSubjectId: 'auth0|verified2',
        nickname: 'Verified2',
      });
      verified2.verifyWithRankCard('did:example:2', Rank.SILVER);

      await repository.save(general);
      await repository.save(verified1);
      await repository.save(verified2);

      const found = await repository.findByStatus(MemberStatus.VERIFIED);
      expect(found.length).toBe(2);
      expect(found.every(p => p.getStatus() === MemberStatus.VERIFIED)).toBe(true);
    });
  });

  describe('findByRank', () => {
    it('should return empty array if no members with rank exist', async () => {
      const found = await repository.findByRank(Rank.GOLD);
      expect(found).toEqual([]);
    });

    it('should return only VERIFIED members with specified rank', async () => {
      const general = MemberProfile.create({
        oidcSubjectId: 'auth0|general',
        nickname: 'General',
      });
      const gold1 = MemberProfile.create({
        oidcSubjectId: 'auth0|gold1',
        nickname: 'Gold1',
      });
      gold1.verifyWithRankCard('did:example:gold1', Rank.GOLD);

      const gold2 = MemberProfile.create({
        oidcSubjectId: 'auth0|gold2',
        nickname: 'Gold2',
      });
      gold2.verifyWithRankCard('did:example:gold2', Rank.GOLD);

      const silver = MemberProfile.create({
        oidcSubjectId: 'auth0|silver',
        nickname: 'Silver',
      });
      silver.verifyWithRankCard('did:example:silver', Rank.SILVER);

      await repository.save(general);
      await repository.save(gold1);
      await repository.save(gold2);
      await repository.save(silver);

      const found = await repository.findByRank(Rank.GOLD);
      expect(found.length).toBe(2);
      expect(found.every(p => p.getDerivedRank() === Rank.GOLD)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should be idempotent (no error if member does not exist)', async () => {
      await expect(repository.delete('non-existent-id')).resolves.not.toThrow();
    });

    it('should delete a member profile', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });

      await repository.save(profile);
      expect(await repository.findById(profile.getId())).not.toBeNull();

      await repository.delete(profile.getId());
      expect(await repository.findById(profile.getId())).toBeNull();
    });
  });

  describe('existsByOidcSubjectId', () => {
    it('should return false if member does not exist', async () => {
      const exists = await repository.existsByOidcSubjectId('non-existent');
      expect(exists).toBe(false);
    });

    it('should return true if member exists', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|exists',
        nickname: 'TestUser',
      });

      await repository.save(profile);

      const exists = await repository.existsByOidcSubjectId('auth0|exists');
      expect(exists).toBe(true);
    });
  });

  describe('existsByLinkedVcDid', () => {
    it('should return false if member does not exist', async () => {
      const exists = await repository.existsByLinkedVcDid('did:example:nonexistent');
      expect(exists).toBe(false);
    });

    it('should return true if VERIFIED member exists with DID', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });
      profile.verifyWithRankCard('did:example:exists', Rank.GOLD);

      await repository.save(profile);

      const exists = await repository.existsByLinkedVcDid('did:example:exists');
      expect(exists).toBe(true);
    });

    it('should return false for GENERAL members', async () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'auth0|12345',
        nickname: 'TestUser',
      });

      await repository.save(profile);

      const exists = await repository.existsByLinkedVcDid('any-did');
      expect(exists).toBe(false);
    });
  });
});

// Helper functions

async function setupTestDatabase(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS member_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      oidc_subject_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('GENERAL', 'VERIFIED')) DEFAULT 'GENERAL',
      nickname TEXT NOT NULL,
      gender TEXT,
      interests TEXT,
      linked_vc_did TEXT UNIQUE,
      derived_rank TEXT CHECK (derived_rank IS NULL OR derived_rank IN ('Gold', 'Silver', 'Bronze')),
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (length(id) > 0),
      CHECK (length(oidc_subject_id) > 0),
      CHECK (length(nickname) > 0 AND length(nickname) <= 100),
      CHECK (version > 0),
      CHECK (created_at > 0),
      CHECK (updated_at > 0),
      CHECK (updated_at >= created_at)
    );
    CREATE INDEX IF NOT EXISTS idx_member_profiles_oidc_subject_id ON member_profiles(oidc_subject_id);
    CREATE INDEX IF NOT EXISTS idx_member_profiles_status ON member_profiles(status);
    CREATE INDEX IF NOT EXISTS idx_member_profiles_linked_vc_did ON member_profiles(linked_vc_did) WHERE linked_vc_did IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_member_profiles_derived_rank ON member_profiles(derived_rank) WHERE derived_rank IS NOT NULL;
  `);
}

async function cleanupTestDatabase(db: D1Database): Promise<void> {
  await db.exec('DROP TABLE IF EXISTS member_profiles;');
}
