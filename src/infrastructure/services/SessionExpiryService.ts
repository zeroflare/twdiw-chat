/**
 * Session Expiry Service
 * Implements SessionExpiryService interface for chat session lifecycle management
 */

import { 
  SessionExpiryService as ISessionExpiryService,
  ExpiryPolicy,
  SessionCleanupResult
} from '../../domain/services/SessionExpiryService';
import { D1PrivateChatSessionRepository } from '../repositories/D1PrivateChatSessionRepository';
import { D1MemberProfileRepository } from '../repositories/D1MemberProfileRepository';
import { VCVerificationSessionStore } from './VCVerificationSessionStore';

export class SessionExpiryService implements ISessionExpiryService {
  private sessionRepo: D1PrivateChatSessionRepository;
  private memberRepo: D1MemberProfileRepository;
  private vcSessionStore: VCVerificationSessionStore;

  constructor(
    db: D1Database,
    encryptionKey: string
  ) {
    this.sessionRepo = new D1PrivateChatSessionRepository(db);
    this.memberRepo = new D1MemberProfileRepository(db, encryptionKey);
    this.vcSessionStore = new VCVerificationSessionStore(db);
  }

  async isSessionExpired(sessionId: string): Promise<boolean> {
    try {
      const session = await this.sessionRepo.findById(sessionId);
      if (!session) {
        return true; // Non-existent sessions are considered expired
      }

      return session.isExpired();
    } catch (error) {
      console.error('Failed to check session expiry:', error);
      return true; // Assume expired on error for safety
    }
  }

  async findExpiredSessions(includeGracePeriod = false): Promise<string[]> {
    try {
      const gracePeriodMs = includeGracePeriod ? 5 * 60 * 1000 : 0; // 5 minutes grace
      const cutoffTime = Date.now() + gracePeriodMs;

      const expiredSessions = await this.sessionRepo.findExpiredSessions(cutoffTime);
      return expiredSessions.map(session => session.getId());
    } catch (error) {
      console.error('Failed to find expired sessions:', error);
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<SessionCleanupResult> {
    const result: SessionCleanupResult = {
      chatSessionsProcessed: 0,
      chatSessionsCleaned: 0,
      vcSessionsProcessed: 0,
      vcSessionsCleaned: 0,
      errors: []
    };

    try {
      // Cleanup expired chat sessions
      const expiredChatSessions = await this.sessionRepo.findExpiredSessions(Date.now());
      result.chatSessionsProcessed = expiredChatSessions.length;

      for (const session of expiredChatSessions) {
        try {
          if (!session.isExpired()) {
            session.markAsExpired();
            await this.sessionRepo.save(session);
          }
          result.chatSessionsCleaned++;
        } catch (error) {
          result.errors.push(`Failed to cleanup chat session ${session.getId()}: ${error.message}`);
        }
      }

      // Cleanup expired VC verification sessions
      const vcCleaned = await this.vcSessionStore.cleanupExpiredSessions();
      result.vcSessionsProcessed = vcCleaned;
      result.vcSessionsCleaned = vcCleaned;

    } catch (error) {
      result.errors.push(`Cleanup operation failed: ${error.message}`);
    }

    return result;
  }

  calculateExpiryTime(createdAt: number, policy: ExpiryPolicy): number {
    const baseExpiryMs = this.getExpiryDurationMs(policy);
    return createdAt + baseExpiryMs;
  }

  private getExpiryDurationMs(policy: ExpiryPolicy): number {
    switch (policy.type) {
      case 'DAILY_MATCH':
        return policy.durationHours * 60 * 60 * 1000; // Default: 24 hours
      case 'GROUP_INITIATED':
        return policy.durationHours * 60 * 60 * 1000; // Default: 12 hours
      case 'CUSTOM':
        return policy.durationHours * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // Default: 24 hours
    }
  }

  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    expiredSessions: number;
    expiringInHour: number;
  }> {
    try {
      const now = Date.now();
      const oneHourFromNow = now + 60 * 60 * 1000;

      // Get all active sessions
      const activeSessions = await this.sessionRepo.findByStatus('ACTIVE');
      const totalActiveSessions = activeSessions.length;

      // Count expired sessions
      const expiredSessions = activeSessions.filter(session => session.isExpired()).length;

      // Count sessions expiring within an hour
      const expiringInHour = activeSessions.filter(session => 
        !session.isExpired() && session.getExpiresAt() <= oneHourFromNow
      ).length;

      return {
        totalActiveSessions,
        expiredSessions,
        expiringInHour
      };
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return {
        totalActiveSessions: 0,
        expiredSessions: 0,
        expiringInHour: 0
      };
    }
  }
}
