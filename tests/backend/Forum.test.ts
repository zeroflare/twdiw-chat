import { describe, it, expect, beforeEach } from 'vitest';
import { Forum, ForumStatus, Rank } from '../../src/domain/entities/Forum';

describe('Forum Aggregate Root', () => {
  describe('Factory Method: create()', () => {
    it('should create a new active forum with valid properties', () => {
      const forum = Forum.create({
        requiredRank: Rank.GOLD,
        description: 'Gold Members Forum',
        tlkChannelId: 'gold-forum-channel',
        capacity: 100,
        creatorId: 'creator-123',
      });

      expect(forum.getId()).toBeDefined();
      expect(forum.getRequiredRank()).toBe(Rank.GOLD);
      expect(forum.getDescription()).toBe('Gold Members Forum');
      expect(forum.getTlkChannelId()).toBe('gold-forum-channel');
      expect(forum.getCapacity()).toBe(100);
      expect(forum.getCreatorId()).toBe('creator-123');
      expect(forum.getStatus()).toBe(ForumStatus.ACTIVE);
      expect(forum.getMemberCount()).toBe(0);
      expect(forum.getVersion()).toBe(1);
      expect(forum.getCreatedAt()).toBeDefined();
      expect(forum.getUpdatedAt()).toBeDefined();
      expect(forum.getCreatedAt()).toBe(forum.getUpdatedAt());
    });

    it('should throw error if requiredRank is empty', () => {
      expect(() => {
        Forum.create({
          requiredRank: '' as any,
          description: 'Test Forum',
          tlkChannelId: 'test-channel',
          capacity: 50,
          creatorId: 'creator-123',
        });
      }).toThrow('requiredRank cannot be empty');
    });

    it('should throw error if requiredRank is invalid', () => {
      expect(() => {
        Forum.create({
          requiredRank: 'Platinum' as any,
          description: 'Test Forum',
          tlkChannelId: 'test-channel',
          capacity: 50,
          creatorId: 'creator-123',
        });
      }).toThrow('Invalid rank value');
    });

    it('should throw error if tlkChannelId is empty', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.SILVER,
          description: 'Test Forum',
          tlkChannelId: '',
          capacity: 50,
          creatorId: 'creator-123',
        });
      }).toThrow('tlkChannelId cannot be empty');
    });

    it('should throw error if capacity is zero', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          description: 'Test Forum',
          tlkChannelId: 'test-channel',
          capacity: 0,
          creatorId: 'creator-123',
        });
      }).toThrow('capacity must be greater than 0');
    });

    it('should throw error if capacity is negative', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          description: 'Test Forum',
          tlkChannelId: 'test-channel',
          capacity: -10,
          creatorId: 'creator-123',
        });
      }).toThrow('capacity must be greater than 0');
    });

    it('should throw error if creatorId is empty', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.GOLD,
          description: 'Test Forum',
          tlkChannelId: 'test-channel',
          capacity: 50,
          creatorId: '',
        });
      }).toThrow('creatorId cannot be empty');
    });

    it('should allow undefined description', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.getDescription()).toBeUndefined();
    });

    it('should create forums with different rank requirements', () => {
      const goldForum = Forum.create({
        requiredRank: Rank.GOLD,
        tlkChannelId: 'gold-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });
      const silverForum = Forum.create({
        requiredRank: Rank.SILVER,
        tlkChannelId: 'silver-channel',
        capacity: 100,
        creatorId: 'creator-123',
      });
      const bronzeForum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'bronze-channel',
        capacity: 200,
        creatorId: 'creator-123',
      });

      expect(goldForum.getRequiredRank()).toBe(Rank.GOLD);
      expect(silverForum.getRequiredRank()).toBe(Rank.SILVER);
      expect(bronzeForum.getRequiredRank()).toBe(Rank.BRONZE);
    });
  });

  describe('Factory Method: reconstitute()', () => {
    it('should reconstitute forum from persistence', () => {
      const persistenceData = {
        id: 'forum-123',
        requiredRank: Rank.GOLD,
        description: 'Gold Forum',
        tlkChannelId: 'gold-channel',
        capacity: 100,
        memberCount: 25,
        creatorId: 'creator-123',
        status: ForumStatus.ACTIVE,
        version: 3,
        createdAt: 1699999999000,
        updatedAt: 1700000000000,
      };

      const forum = Forum.reconstitute(persistenceData);

      expect(forum.getId()).toBe('forum-123');
      expect(forum.getRequiredRank()).toBe(Rank.GOLD);
      expect(forum.getDescription()).toBe('Gold Forum');
      expect(forum.getTlkChannelId()).toBe('gold-channel');
      expect(forum.getCapacity()).toBe(100);
      expect(forum.getMemberCount()).toBe(25);
      expect(forum.getCreatorId()).toBe('creator-123');
      expect(forum.getStatus()).toBe(ForumStatus.ACTIVE);
      expect(forum.getVersion()).toBe(3);
      expect(forum.getCreatedAt()).toBe(1699999999000);
      expect(forum.getUpdatedAt()).toBe(1700000000000);
    });

    it('should not emit domain events during reconstitution', () => {
      const persistenceData = {
        id: 'forum-123',
        requiredRank: Rank.SILVER,
        tlkChannelId: 'silver-channel',
        capacity: 50,
        memberCount: 10,
        creatorId: 'creator-123',
        status: ForumStatus.ACTIVE,
        version: 2,
        createdAt: 1699999999000,
        updatedAt: 1700000000000,
      };

      const forum = Forum.reconstitute(persistenceData);
      expect(forum.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Business Logic: canMemberAccess()', () => {
    let goldForum: Forum;
    let silverForum: Forum;
    let bronzeForum: Forum;

    beforeEach(() => {
      goldForum = Forum.create({
        requiredRank: Rank.GOLD,
        tlkChannelId: 'gold-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      silverForum = Forum.create({
        requiredRank: Rank.SILVER,
        tlkChannelId: 'silver-channel',
        capacity: 100,
        creatorId: 'creator-123',
      });

      bronzeForum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'bronze-channel',
        capacity: 200,
        creatorId: 'creator-123',
      });
    });

    it('should allow Gold member to access Gold forum', () => {
      expect(goldForum.canMemberAccess(Rank.GOLD)).toBe(true);
    });

    it('should allow Gold member to access Silver forum', () => {
      expect(silverForum.canMemberAccess(Rank.GOLD)).toBe(true);
    });

    it('should allow Gold member to access Bronze forum', () => {
      expect(bronzeForum.canMemberAccess(Rank.GOLD)).toBe(true);
    });

    it('should deny Silver member access to Gold forum', () => {
      expect(goldForum.canMemberAccess(Rank.SILVER)).toBe(false);
    });

    it('should allow Silver member to access Silver forum', () => {
      expect(silverForum.canMemberAccess(Rank.SILVER)).toBe(true);
    });

    it('should allow Silver member to access Bronze forum', () => {
      expect(bronzeForum.canMemberAccess(Rank.SILVER)).toBe(true);
    });

    it('should deny Bronze member access to Gold forum', () => {
      expect(goldForum.canMemberAccess(Rank.BRONZE)).toBe(false);
    });

    it('should deny Bronze member access to Silver forum', () => {
      expect(silverForum.canMemberAccess(Rank.BRONZE)).toBe(false);
    });

    it('should allow Bronze member to access Bronze forum', () => {
      expect(bronzeForum.canMemberAccess(Rank.BRONZE)).toBe(true);
    });

    it('should throw error for invalid member rank', () => {
      expect(() => {
        goldForum.canMemberAccess('Platinum' as any);
      }).toThrow('Invalid member rank');
    });

    it('should deny access if forum is archived', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.archive();

      expect(forum.canMemberAccess(Rank.GOLD)).toBe(false);
      expect(forum.canMemberAccess(Rank.BRONZE)).toBe(false);
    });

    it('should deny access if forum is at capacity', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 2,
        creatorId: 'creator-123',
      });

      // Fill to capacity
      forum.incrementMemberCount();
      forum.incrementMemberCount();

      expect(forum.canMemberAccess(Rank.GOLD)).toBe(false);
      expect(forum.canMemberAccess(Rank.BRONZE)).toBe(false);
    });

    it('should allow access if forum has available capacity', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 3,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.incrementMemberCount();

      expect(forum.canMemberAccess(Rank.BRONZE)).toBe(true);
    });
  });

  describe('Business Logic: isFull()', () => {
    it('should return false for empty forum', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.isFull()).toBe(false);
    });

    it('should return false when not at capacity', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 10,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.incrementMemberCount();

      expect(forum.isFull()).toBe(false);
    });

    it('should return true when at capacity', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 2,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.incrementMemberCount();

      expect(forum.isFull()).toBe(true);
    });

    it('should return true when over capacity (edge case)', () => {
      const forum = Forum.reconstitute({
        id: 'forum-123',
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 10,
        memberCount: 15,
        creatorId: 'creator-123',
        status: ForumStatus.ACTIVE,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(forum.isFull()).toBe(true);
    });
  });

  describe('Business Logic: incrementMemberCount()', () => {
    it('should increment member count', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.getMemberCount()).toBe(0);
      forum.incrementMemberCount();
      expect(forum.getMemberCount()).toBe(1);
      forum.incrementMemberCount();
      expect(forum.getMemberCount()).toBe(2);
    });

    it('should update version on increment', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      const initialVersion = forum.getVersion();
      forum.incrementMemberCount();
      expect(forum.getVersion()).toBe(initialVersion + 1);
    });

    it('should update updatedAt timestamp', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      const initialUpdatedAt = forum.getUpdatedAt();

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        forum.incrementMemberCount();
        expect(forum.getUpdatedAt()).toBeGreaterThan(initialUpdatedAt);
      }, 10);
    });

    it('should throw error if forum is archived', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.archive();

      expect(() => {
        forum.incrementMemberCount();
      }).toThrow('Cannot modify archived forum');
    });

    it('should allow increment up to capacity', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 3,
        creatorId: 'creator-123',
      });

      expect(() => {
        forum.incrementMemberCount();
        forum.incrementMemberCount();
        forum.incrementMemberCount();
      }).not.toThrow();

      expect(forum.getMemberCount()).toBe(3);
    });

    it('should not prevent increment beyond capacity (concurrency edge case)', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 2,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.incrementMemberCount();

      // Should not throw - optimistic locking handles this at repository level
      expect(() => {
        forum.incrementMemberCount();
      }).not.toThrow();
    });
  });

  describe('Business Logic: decrementMemberCount()', () => {
    it('should decrement member count', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.incrementMemberCount();
      forum.incrementMemberCount();

      expect(forum.getMemberCount()).toBe(3);
      forum.decrementMemberCount();
      expect(forum.getMemberCount()).toBe(2);
      forum.decrementMemberCount();
      expect(forum.getMemberCount()).toBe(1);
    });

    it('should update version on decrement', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      const versionBeforeDecrement = forum.getVersion();

      forum.decrementMemberCount();
      expect(forum.getVersion()).toBe(versionBeforeDecrement + 1);
    });

    it('should throw error if count is already zero', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(() => {
        forum.decrementMemberCount();
      }).toThrow('Member count cannot be negative');
    });

    it('should throw error if forum is archived', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.archive();

      expect(() => {
        forum.decrementMemberCount();
      }).toThrow('Cannot modify archived forum');
    });
  });

  describe('Business Logic: archive()', () => {
    it('should archive active forum', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.getStatus()).toBe(ForumStatus.ACTIVE);
      forum.archive();
      expect(forum.getStatus()).toBe(ForumStatus.ARCHIVED);
    });

    it('should update version on archive', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      const initialVersion = forum.getVersion();
      forum.archive();
      expect(forum.getVersion()).toBe(initialVersion + 1);
    });

    it('should update updatedAt timestamp', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      const initialUpdatedAt = forum.getUpdatedAt();

      setTimeout(() => {
        forum.archive();
        expect(forum.getUpdatedAt()).toBeGreaterThan(initialUpdatedAt);
      }, 10);
    });

    it('should throw error if forum is already archived', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.archive();

      expect(() => {
        forum.archive();
      }).toThrow('Forum is already archived');
    });

    it('should emit ForumArchived domain event', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.archive();

      const events = forum.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('ForumArchived');
      expect(events[0].aggregateId).toBe(forum.getId());
    });
  });

  describe('Domain Events', () => {
    it('should have no events on creation', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.getDomainEvents()).toHaveLength(0);
    });

    it('should emit ForumArchived event when archived', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.archive();

      const events = forum.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('ForumArchived');
    });

    it('should clear domain events', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.archive();
      expect(forum.getDomainEvents()).toHaveLength(1);

      const clearedEvents = forum.clearDomainEvents();
      expect(clearedEvents).toHaveLength(1);
      expect(forum.getDomainEvents()).toHaveLength(0);
    });

    it('should not emit events during reconstitution', () => {
      const persistenceData = {
        id: 'forum-123',
        requiredRank: Rank.SILVER,
        tlkChannelId: 'silver-channel',
        capacity: 50,
        memberCount: 10,
        creatorId: 'creator-123',
        status: ForumStatus.ARCHIVED,
        version: 2,
        createdAt: 1699999999000,
        updatedAt: 1700000000000,
      };

      const forum = Forum.reconstitute(persistenceData);
      expect(forum.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Optimistic Locking', () => {
    it('should start with version 1', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.getVersion()).toBe(1);
    });

    it('should increment version on state changes', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(forum.getVersion()).toBe(1);

      forum.incrementMemberCount();
      expect(forum.getVersion()).toBe(2);

      forum.incrementMemberCount();
      expect(forum.getVersion()).toBe(3);

      forum.decrementMemberCount();
      expect(forum.getVersion()).toBe(4);

      forum.archive();
      expect(forum.getVersion()).toBe(5);
    });

    it('should maintain version during reconstitution', () => {
      const persistenceData = {
        id: 'forum-123',
        requiredRank: Rank.SILVER,
        tlkChannelId: 'silver-channel',
        capacity: 50,
        memberCount: 10,
        creatorId: 'creator-123',
        status: ForumStatus.ACTIVE,
        version: 42,
        createdAt: 1699999999000,
        updatedAt: 1700000000000,
      };

      const forum = Forum.reconstitute(persistenceData);
      expect(forum.getVersion()).toBe(42);
    });
  });

  describe('Persistence', () => {
    it('should convert to persistence format', () => {
      const forum = Forum.create({
        requiredRank: Rank.GOLD,
        description: 'Gold Forum',
        tlkChannelId: 'gold-channel',
        capacity: 100,
        creatorId: 'creator-123',
      });

      const persistence = forum.toPersistence();

      expect(persistence.id).toBe(forum.getId());
      expect(persistence.requiredRank).toBe(Rank.GOLD);
      expect(persistence.description).toBe('Gold Forum');
      expect(persistence.tlkChannelId).toBe('gold-channel');
      expect(persistence.capacity).toBe(100);
      expect(persistence.memberCount).toBe(0);
      expect(persistence.creatorId).toBe('creator-123');
      expect(persistence.status).toBe(ForumStatus.ACTIVE);
      expect(persistence.version).toBe(1);
      expect(persistence.createdAt).toBeDefined();
      expect(persistence.updatedAt).toBeDefined();
    });

    it('should round-trip through persistence', () => {
      const original = Forum.create({
        requiredRank: Rank.SILVER,
        description: 'Test Forum',
        tlkChannelId: 'test-channel',
        capacity: 75,
        creatorId: 'creator-456',
      });

      original.incrementMemberCount();
      original.incrementMemberCount();

      const persistence = original.toPersistence();
      const reconstituted = Forum.reconstitute(persistence);

      expect(reconstituted.getId()).toBe(original.getId());
      expect(reconstituted.getRequiredRank()).toBe(original.getRequiredRank());
      expect(reconstituted.getDescription()).toBe(original.getDescription());
      expect(reconstituted.getTlkChannelId()).toBe(original.getTlkChannelId());
      expect(reconstituted.getCapacity()).toBe(original.getCapacity());
      expect(reconstituted.getMemberCount()).toBe(original.getMemberCount());
      expect(reconstituted.getCreatorId()).toBe(original.getCreatorId());
      expect(reconstituted.getStatus()).toBe(original.getStatus());
      expect(reconstituted.getVersion()).toBe(original.getVersion());
      expect(reconstituted.getCreatedAt()).toBe(original.getCreatedAt());
      expect(reconstituted.getUpdatedAt()).toBe(original.getUpdatedAt());
    });
  });

  describe('Business Rules & Invariants', () => {
    it('should enforce rank-based access control (Gold > Silver > Bronze)', () => {
      const goldForum = Forum.create({
        requiredRank: Rank.GOLD,
        tlkChannelId: 'gold-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(goldForum.canMemberAccess(Rank.GOLD)).toBe(true);
      expect(goldForum.canMemberAccess(Rank.SILVER)).toBe(false);
      expect(goldForum.canMemberAccess(Rank.BRONZE)).toBe(false);
    });

    it('should enforce capacity limits', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 2,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      expect(forum.isFull()).toBe(false);
      expect(forum.canMemberAccess(Rank.BRONZE)).toBe(true);

      forum.incrementMemberCount();
      expect(forum.isFull()).toBe(true);
      expect(forum.canMemberAccess(Rank.BRONZE)).toBe(false);
    });

    it('should prevent modifications to archived forums', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      forum.incrementMemberCount();
      forum.archive();

      expect(() => forum.incrementMemberCount()).toThrow('Cannot modify archived forum');
      expect(() => forum.decrementMemberCount()).toThrow('Cannot modify archived forum');
      expect(() => forum.archive()).toThrow('Forum is already archived');
    });

    it('should prevent negative member count', () => {
      const forum = Forum.create({
        requiredRank: Rank.BRONZE,
        tlkChannelId: 'test-channel',
        capacity: 50,
        creatorId: 'creator-123',
      });

      expect(() => forum.decrementMemberCount()).toThrow('Member count cannot be negative');
    });

    it('should require valid rank values', () => {
      expect(() => {
        Forum.create({
          requiredRank: 'Diamond' as any,
          tlkChannelId: 'test-channel',
          capacity: 50,
          creatorId: 'creator-123',
        });
      }).toThrow('Invalid rank value');
    });

    it('should require positive capacity', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          tlkChannelId: 'test-channel',
          capacity: 0,
          creatorId: 'creator-123',
        });
      }).toThrow('capacity must be greater than 0');

      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          tlkChannelId: 'test-channel',
          capacity: -5,
          creatorId: 'creator-123',
        });
      }).toThrow('capacity must be greater than 0');
    });

    it('should require non-empty tlkChannelId', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          tlkChannelId: '',
          capacity: 50,
          creatorId: 'creator-123',
        });
      }).toThrow('tlkChannelId cannot be empty');

      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          tlkChannelId: '   ',
          capacity: 50,
          creatorId: 'creator-123',
        });
      }).toThrow('tlkChannelId cannot be empty');
    });

    it('should require non-empty creatorId', () => {
      expect(() => {
        Forum.create({
          requiredRank: Rank.BRONZE,
          tlkChannelId: 'test-channel',
          capacity: 50,
          creatorId: '',
        });
      }).toThrow('creatorId cannot be empty');
    });
  });
});
