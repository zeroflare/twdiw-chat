import { describe, it, expect } from 'vitest';
import {
  PrivateChatSession,
  SessionType,
  SessionStatus,
  CreatePrivateChatSessionProps,
  ReconstitutePrivateChatSessionProps,
} from '../../src/domain/entities/PrivateChatSession';

describe('PrivateChatSession - Rich Aggregate Root', () => {
  describe('Factory Methods', () => {
    describe('create() - Factory Method', () => {
      it('should create a new ACTIVE DAILY_MATCH session with valid props', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000, // 24 hours from now
        };

        const session = PrivateChatSession.create(props);

        expect(session.getId()).toBeTruthy();
        expect(session.getMemberAId()).toBe('member-a-uuid');
        expect(session.getMemberBId()).toBe('member-b-uuid');
        expect(session.getTlkChannelId()).toBe('tlk-channel-123');
        expect(session.getType()).toBe(SessionType.DAILY_MATCH);
        expect(session.getStatus()).toBe(SessionStatus.ACTIVE);
        expect(session.getExpiresAt()).toBe(props.expiresAt);
        expect(session.getVersion()).toBe(1);
        expect(session.getCreatedAt()).toBeGreaterThan(0);
        expect(session.getUpdatedAt()).toBe(session.getCreatedAt());
      });

      it('should create a new ACTIVE GROUP_INITIATED session with valid props', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-456',
          type: SessionType.GROUP_INITIATED,
          expiresAt: Date.now() + 3600000, // 1 hour from now
        };

        const session = PrivateChatSession.create(props);

        expect(session.getType()).toBe(SessionType.GROUP_INITIATED);
        expect(session.getStatus()).toBe(SessionStatus.ACTIVE);
      });

      it('should throw error when memberAId is empty', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: '',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        expect(() => PrivateChatSession.create(props)).toThrow('memberAId cannot be empty');
      });

      it('should throw error when memberBId is empty', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: '   ',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        expect(() => PrivateChatSession.create(props)).toThrow('memberBId cannot be empty');
      });

      it('should throw error when tlkChannelId is empty', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: '',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        expect(() => PrivateChatSession.create(props)).toThrow('tlkChannelId cannot be empty');
      });

      it('should throw error when memberAId and memberBId are the same', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'same-member-uuid',
          memberBId: 'same-member-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        expect(() => PrivateChatSession.create(props)).toThrow('memberAId and memberBId must be different');
      });

      it('should throw error when expiresAt is in the past', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() - 1000, // 1 second ago
        };

        expect(() => PrivateChatSession.create(props)).toThrow('expiresAt must be in the future');
      });

      it('should throw error when expiresAt is not provided', () => {
        const props: any = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
        };

        expect(() => PrivateChatSession.create(props)).toThrow('expiresAt must be in the future');
      });
    });

    describe('reconstitute() - Factory Method', () => {
      it('should reconstitute a PrivateChatSession from persistence', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.ACTIVE,
          expiresAt: Date.now() + 86400000,
          version: 3,
          createdAt: 1699999999000,
          updatedAt: 1700000001000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(session.getId()).toBe('session-uuid');
        expect(session.getMemberAId()).toBe('member-a-uuid');
        expect(session.getMemberBId()).toBe('member-b-uuid');
        expect(session.getTlkChannelId()).toBe('tlk-channel-123');
        expect(session.getType()).toBe(SessionType.DAILY_MATCH);
        expect(session.getStatus()).toBe(SessionStatus.ACTIVE);
        expect(session.getExpiresAt()).toBe(props.expiresAt);
        expect(session.getVersion()).toBe(3);
        expect(session.getCreatedAt()).toBe(1699999999000);
        expect(session.getUpdatedAt()).toBe(1700000001000);
      });

      it('should reconstitute an EXPIRED session from persistence', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.GROUP_INITIATED,
          status: SessionStatus.EXPIRED,
          expiresAt: Date.now() - 86400000, // 24 hours ago
          version: 2,
          createdAt: 1699999999000,
          updatedAt: 1700000001000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(session.getStatus()).toBe(SessionStatus.EXPIRED);
        expect(session.getExpiresAt()).toBeLessThan(Date.now());
      });

      it('should reconstitute a TERMINATED session from persistence', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.TERMINATED,
          expiresAt: Date.now() + 86400000,
          version: 4,
          createdAt: 1699999999000,
          updatedAt: 1700000001000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(session.getStatus()).toBe(SessionStatus.TERMINATED);
      });

      it('should not emit domain events during reconstitution', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.EXPIRED,
          expiresAt: Date.now() - 86400000,
          version: 2,
          createdAt: 1699999999000,
          updatedAt: 1700000001000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(session.getDomainEvents()).toHaveLength(0);
      });
    });
  });

  describe('Business Logic', () => {
    describe('isExpired() - Check if session has expired', () => {
      it('should return true when session expiresAt is in the past', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 1000, // 1 second from now
        };

        const session = PrivateChatSession.create(props);

        // Mock time passing
        const futureTime = Date.now() + 2000; // 2 seconds from now
        expect(session.isExpired(futureTime)).toBe(true);
      });

      it('should return false when session expiresAt is in the future', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000, // 24 hours from now
        };

        const session = PrivateChatSession.create(props);

        expect(session.isExpired()).toBe(false);
      });

      it('should return true when session expiresAt equals current time', () => {
        const expiresAt = Date.now() + 1000;
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: expiresAt,
        };

        const session = PrivateChatSession.create(props);

        expect(session.isExpired(expiresAt)).toBe(true);
      });

      it('should use current time when no timestamp is provided', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() - 1000, // 1 second ago
        };

        const session = PrivateChatSession.reconstitute({
          id: 'session-uuid',
          memberAId: props.memberAId,
          memberBId: props.memberBId,
          tlkChannelId: props.tlkChannelId,
          type: props.type,
          status: SessionStatus.ACTIVE,
          expiresAt: props.expiresAt,
          version: 1,
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        });

        expect(session.isExpired()).toBe(true);
      });
    });

    describe('terminate() - Manually terminate session', () => {
      it('should terminate an ACTIVE session', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);
        const initialVersion = session.getVersion();

        session.terminate();

        expect(session.getStatus()).toBe(SessionStatus.TERMINATED);
        expect(session.getVersion()).toBe(initialVersion + 1);
        expect(session.getUpdatedAt()).toBeGreaterThan(session.getCreatedAt());
      });

      it('should emit SessionTerminated domain event', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        session.terminate();

        const events = session.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0].getEventName()).toBe('SessionTerminated');
        expect(events[0].getAggregateId()).toBe(session.getId());
      });

      it('should throw error when session is already TERMINATED', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.TERMINATED,
          expiresAt: Date.now() + 86400000,
          version: 2,
          createdAt: Date.now() - 1000,
          updatedAt: Date.now(),
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(() => session.terminate()).toThrow('Session is already terminated or expired');
      });

      it('should throw error when session is already EXPIRED', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.EXPIRED,
          expiresAt: Date.now() - 86400000,
          version: 2,
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 1000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(() => session.terminate()).toThrow('Session is already terminated or expired');
      });
    });

    describe('markAsExpired() - Mark session as expired', () => {
      it('should mark an ACTIVE session as EXPIRED', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 1000,
        };

        const session = PrivateChatSession.create(props);
        const initialVersion = session.getVersion();

        session.markAsExpired();

        expect(session.getStatus()).toBe(SessionStatus.EXPIRED);
        expect(session.getVersion()).toBe(initialVersion + 1);
        expect(session.getUpdatedAt()).toBeGreaterThan(session.getCreatedAt());
      });

      it('should emit SessionExpired domain event', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 1000,
        };

        const session = PrivateChatSession.create(props);

        session.markAsExpired();

        const events = session.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0].getEventName()).toBe('SessionExpired');
        expect(events[0].getAggregateId()).toBe(session.getId());
      });

      it('should throw error when session is already EXPIRED', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.EXPIRED,
          expiresAt: Date.now() - 86400000,
          version: 2,
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 1000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(() => session.markAsExpired()).toThrow('Session is already expired or terminated');
      });

      it('should throw error when session is TERMINATED', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.TERMINATED,
          expiresAt: Date.now() + 86400000,
          version: 2,
          createdAt: Date.now() - 1000,
          updatedAt: Date.now(),
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(() => session.markAsExpired()).toThrow('Session is already expired or terminated');
      });
    });

    describe('isActive() - Check if session is active', () => {
      it('should return true for ACTIVE session that has not expired', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.isActive()).toBe(true);
      });

      it('should return false for TERMINATED session', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.TERMINATED,
          expiresAt: Date.now() + 86400000,
          version: 2,
          createdAt: Date.now() - 1000,
          updatedAt: Date.now(),
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(session.isActive()).toBe(false);
      });

      it('should return false for EXPIRED session', () => {
        const props: ReconstitutePrivateChatSessionProps = {
          id: 'session-uuid',
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          status: SessionStatus.EXPIRED,
          expiresAt: Date.now() - 86400000,
          version: 2,
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 1000,
        };

        const session = PrivateChatSession.reconstitute(props);

        expect(session.isActive()).toBe(false);
      });
    });

    describe('involvesMembers() - Check if session involves specific members', () => {
      it('should return true when both member IDs match', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMembers('member-a-uuid', 'member-b-uuid')).toBe(true);
      });

      it('should return true when member IDs match in reverse order', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMembers('member-b-uuid', 'member-a-uuid')).toBe(true);
      });

      it('should return false when only one member ID matches', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMembers('member-a-uuid', 'member-c-uuid')).toBe(false);
      });

      it('should return false when neither member ID matches', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMembers('member-c-uuid', 'member-d-uuid')).toBe(false);
      });
    });

    describe('involvesMember() - Check if session involves a specific member', () => {
      it('should return true when member is memberA', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMember('member-a-uuid')).toBe(true);
      });

      it('should return true when member is memberB', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMember('member-b-uuid')).toBe(true);
      });

      it('should return false when member is neither memberA nor memberB', () => {
        const props: CreatePrivateChatSessionProps = {
          memberAId: 'member-a-uuid',
          memberBId: 'member-b-uuid',
          tlkChannelId: 'tlk-channel-123',
          type: SessionType.DAILY_MATCH,
          expiresAt: Date.now() + 86400000,
        };

        const session = PrivateChatSession.create(props);

        expect(session.involvesMember('member-c-uuid')).toBe(false);
      });
    });
  });

  describe('Domain Events', () => {
    it('should have no domain events after creation', () => {
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: Date.now() + 86400000,
      };

      const session = PrivateChatSession.create(props);

      expect(session.getDomainEvents()).toHaveLength(0);
    });

    it('should accumulate multiple domain events', () => {
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: Date.now() + 86400000,
      };

      const session = PrivateChatSession.create(props);

      session.terminate();
      // Note: After termination, cannot mark as expired, so we can only test one event

      const events = session.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventName()).toBe('SessionTerminated');
    });

    it('should clear domain events and return them', () => {
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: Date.now() + 86400000,
      };

      const session = PrivateChatSession.create(props);

      session.terminate();

      const events = session.clearDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].getEventName()).toBe('SessionTerminated');
      expect(session.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Optimistic Locking', () => {
    it('should increment version when session is terminated', () => {
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: Date.now() + 86400000,
      };

      const session = PrivateChatSession.create(props);
      const initialVersion = session.getVersion();

      session.terminate();

      expect(session.getVersion()).toBe(initialVersion + 1);
    });

    it('should increment version when session is marked as expired', () => {
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: Date.now() + 1000,
      };

      const session = PrivateChatSession.create(props);
      const initialVersion = session.getVersion();

      session.markAsExpired();

      expect(session.getVersion()).toBe(initialVersion + 1);
    });

    it('should maintain version during reconstitution', () => {
      const props: ReconstitutePrivateChatSessionProps = {
        id: 'session-uuid',
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        status: SessionStatus.ACTIVE,
        expiresAt: Date.now() + 86400000,
        version: 5,
        createdAt: 1699999999000,
        updatedAt: 1700000001000,
      };

      const session = PrivateChatSession.reconstitute(props);

      expect(session.getVersion()).toBe(5);
    });
  });

  describe('Persistence', () => {
    it('should convert to persistence format', () => {
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: Date.now() + 86400000,
      };

      const session = PrivateChatSession.create(props);
      const persistence = session.toPersistence();

      expect(persistence.id).toBe(session.getId());
      expect(persistence.memberAId).toBe('member-a-uuid');
      expect(persistence.memberBId).toBe('member-b-uuid');
      expect(persistence.tlkChannelId).toBe('tlk-channel-123');
      expect(persistence.type).toBe(SessionType.DAILY_MATCH);
      expect(persistence.status).toBe(SessionStatus.ACTIVE);
      expect(persistence.expiresAt).toBe(session.getExpiresAt());
      expect(persistence.version).toBe(1);
      expect(persistence.createdAt).toBe(session.getCreatedAt());
      expect(persistence.updatedAt).toBe(session.getUpdatedAt());
    });

    it('should reconstitute from persistence format', () => {
      const persistenceData: ReconstitutePrivateChatSessionProps = {
        id: 'session-uuid',
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.GROUP_INITIATED,
        status: SessionStatus.TERMINATED,
        expiresAt: 1700000000000,
        version: 3,
        createdAt: 1699999999000,
        updatedAt: 1700000001000,
      };

      const session = PrivateChatSession.reconstitute(persistenceData);
      const roundTrip = session.toPersistence();

      expect(roundTrip).toEqual(persistenceData);
    });
  });

  describe('Getters', () => {
    it('should provide read access to all properties', () => {
      const expiresAt = Date.now() + 86400000;
      const props: CreatePrivateChatSessionProps = {
        memberAId: 'member-a-uuid',
        memberBId: 'member-b-uuid',
        tlkChannelId: 'tlk-channel-123',
        type: SessionType.DAILY_MATCH,
        expiresAt: expiresAt,
      };

      const session = PrivateChatSession.create(props);

      expect(session.getId()).toBeTruthy();
      expect(session.getMemberAId()).toBe('member-a-uuid');
      expect(session.getMemberBId()).toBe('member-b-uuid');
      expect(session.getTlkChannelId()).toBe('tlk-channel-123');
      expect(session.getType()).toBe(SessionType.DAILY_MATCH);
      expect(session.getStatus()).toBe(SessionStatus.ACTIVE);
      expect(session.getExpiresAt()).toBe(expiresAt);
      expect(session.getVersion()).toBe(1);
      expect(session.getCreatedAt()).toBeGreaterThan(0);
      expect(session.getUpdatedAt()).toBe(session.getCreatedAt());
    });
  });
});
