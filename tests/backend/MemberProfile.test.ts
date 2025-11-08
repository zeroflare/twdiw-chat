import { describe, it, expect, beforeEach } from 'vitest';
import { MemberProfile, MemberStatus } from '../../src/domain/entities/MemberProfile';
import { MemberVerified } from '../../src/domain/events/MemberVerified';

describe('MemberProfile - Rich Aggregate Root', () => {
  describe('Factory Method - create()', () => {
    it('should create a new GENERAL member profile with required fields', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });

      expect(profile.getId()).toBeDefined();
      expect(profile.getOidcSubjectId()).toBe('sub_12345');
      expect(profile.getStatus()).toBe(MemberStatus.GENERAL);
      expect(profile.getNickname()).toBe('TestUser');
      expect(profile.getLinkedVcDid()).toBeUndefined();
      expect(profile.getDerivedRank()).toBeUndefined();
      expect(profile.getVersion()).toBe(1);
    });

    it('should throw error when oidcSubjectId is empty', () => {
      expect(() => {
        MemberProfile.create({
          oidcSubjectId: '',
          nickname: 'TestUser',
        });
      }).toThrow('oidcSubjectId cannot be empty');
    });

    it('should throw error when nickname is empty', () => {
      expect(() => {
        MemberProfile.create({
          oidcSubjectId: 'sub_12345',
          nickname: '',
        });
      }).toThrow('nickname cannot be empty');
    });

    it('should accept optional encrypted gender and interests', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
        gender: 'Male',
        interests: JSON.stringify(['Tech', 'Gaming']),
      });

      expect(profile.getGender()).toBe('Male');
      expect(profile.getInterests()).toBe(JSON.stringify(['Tech', 'Gaming']));
    });
  });

  describe('verifyWithRankCard() - Business Logic', () => {
    let profile: MemberProfile;

    beforeEach(() => {
      profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });
    });

    it('should verify a GENERAL member with valid VC credentials', () => {
      const did = 'did:example:abc123';
      const rank = 'Gold';

      profile.verifyWithRankCard(did, rank);

      expect(profile.getStatus()).toBe(MemberStatus.VERIFIED);
      expect(profile.getLinkedVcDid()).toBe(did);
      expect(profile.getDerivedRank()).toBe(rank);
    });

    it('should increment version after verification (optimistic locking)', () => {
      const initialVersion = profile.getVersion();

      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      expect(profile.getVersion()).toBe(initialVersion + 1);
    });

    it('should emit MemberVerified domain event after successful verification', () => {
      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      const events = profile.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(MemberVerified);
      expect((events[0] as MemberVerified).memberId).toBe(profile.getId());
      expect((events[0] as MemberVerified).rank).toBe('Gold');
    });

    it('should throw error when trying to verify already VERIFIED member', () => {
      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      expect(() => {
        profile.verifyWithRankCard('did:example:xyz789', 'Silver');
      }).toThrow('Member is already verified');
    });

    it('should throw error when DID is empty', () => {
      expect(() => {
        profile.verifyWithRankCard('', 'Gold');
      }).toThrow('DID cannot be empty');
    });

    it('should throw error when rank is empty', () => {
      expect(() => {
        profile.verifyWithRankCard('did:example:abc123', '');
      }).toThrow('Rank cannot be empty');
    });

    it('should validate rank is one of allowed values', () => {
      expect(() => {
        profile.verifyWithRankCard('did:example:abc123', 'InvalidRank');
      }).toThrow('Invalid rank value');
    });

    it('should accept valid rank values: Gold, Silver, Bronze', () => {
      const validRanks = ['Gold', 'Silver', 'Bronze'];

      validRanks.forEach((rank, index) => {
        const testProfile = MemberProfile.create({
          oidcSubjectId: `sub_${index}`,
          nickname: `User${index}`,
        });

        expect(() => {
          testProfile.verifyWithRankCard(`did:example:${index}`, rank);
        }).not.toThrow();
        expect(testProfile.getDerivedRank()).toBe(rank);
      });
    });
  });

  describe('canAccessForum() - Access Control Logic', () => {
    it('should allow VERIFIED member with Gold rank to access Gold forum', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'GoldUser',
      });
      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      expect(profile.canAccessForum('Gold')).toBe(true);
    });

    it('should allow Gold member to access Silver and Bronze forums (higher rank)', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'GoldUser',
      });
      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      expect(profile.canAccessForum('Silver')).toBe(true);
      expect(profile.canAccessForum('Bronze')).toBe(true);
    });

    it('should deny Silver member access to Gold forum (lower rank)', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'SilverUser',
      });
      profile.verifyWithRankCard('did:example:abc123', 'Silver');

      expect(profile.canAccessForum('Gold')).toBe(false);
    });

    it('should allow Silver member to access Bronze forum', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'SilverUser',
      });
      profile.verifyWithRankCard('did:example:abc123', 'Silver');

      expect(profile.canAccessForum('Bronze')).toBe(true);
    });

    it('should deny GENERAL (unverified) member access to any ranked forum', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'GeneralUser',
      });

      expect(profile.canAccessForum('Gold')).toBe(false);
      expect(profile.canAccessForum('Silver')).toBe(false);
      expect(profile.canAccessForum('Bronze')).toBe(false);
    });

    it('should throw error when forum rank is invalid', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });
      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      expect(() => {
        profile.canAccessForum('InvalidRank');
      }).toThrow('Invalid forum rank');
    });
  });

  describe('Domain Events Management', () => {
    it('should start with empty domain events', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });

      expect(profile.getDomainEvents()).toHaveLength(0);
    });

    it('should clear domain events after retrieval', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });
      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      const events = profile.clearDomainEvents();
      expect(events).toHaveLength(1);
      expect(profile.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Optimistic Locking', () => {
    it('should increment version on state changes', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });
      const initialVersion = profile.getVersion();

      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      expect(profile.getVersion()).toBe(initialVersion + 1);
    });

    it('should expose version for concurrency control', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });

      expect(profile.getVersion()).toBeGreaterThan(0);
    });
  });

  describe('Reconstitution from Database', () => {
    it('should reconstitute existing member from persistence data', () => {
      const data = {
        id: 'uuid-12345',
        oidcSubjectId: 'sub_12345',
        status: MemberStatus.VERIFIED,
        nickname: 'TestUser',
        gender: 'Male',
        interests: JSON.stringify(['Tech']),
        linkedVcDid: 'did:example:abc123',
        derivedRank: 'Gold',
        version: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const profile = MemberProfile.reconstitute(data);

      expect(profile.getId()).toBe('uuid-12345');
      expect(profile.getOidcSubjectId()).toBe('sub_12345');
      expect(profile.getStatus()).toBe(MemberStatus.VERIFIED);
      expect(profile.getNickname()).toBe('TestUser');
      expect(profile.getLinkedVcDid()).toBe('did:example:abc123');
      expect(profile.getDerivedRank()).toBe('Gold');
      expect(profile.getVersion()).toBe(3);
    });

    it('should not emit events when reconstituting from database', () => {
      const data = {
        id: 'uuid-12345',
        oidcSubjectId: 'sub_12345',
        status: MemberStatus.VERIFIED,
        nickname: 'TestUser',
        linkedVcDid: 'did:example:abc123',
        derivedRank: 'Gold',
        version: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const profile = MemberProfile.reconstitute(data);

      expect(profile.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Invariant Enforcement', () => {
    it('should enforce status transitions are valid', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });

      // Valid transition: GENERAL -> VERIFIED
      expect(() => {
        profile.verifyWithRankCard('did:example:abc123', 'Gold');
      }).not.toThrow();

      // Invalid transition: VERIFIED -> VERIFIED again
      expect(() => {
        profile.verifyWithRankCard('did:example:xyz789', 'Silver');
      }).toThrow('Member is already verified');
    });

    it('should maintain data consistency between status and verification fields', () => {
      const profile = MemberProfile.create({
        oidcSubjectId: 'sub_12345',
        nickname: 'TestUser',
      });

      // GENERAL members should not have linkedVcDid or derivedRank
      expect(profile.getLinkedVcDid()).toBeUndefined();
      expect(profile.getDerivedRank()).toBeUndefined();

      profile.verifyWithRankCard('did:example:abc123', 'Gold');

      // VERIFIED members must have both
      expect(profile.getLinkedVcDid()).toBeDefined();
      expect(profile.getDerivedRank()).toBeDefined();
    });
  });
});
