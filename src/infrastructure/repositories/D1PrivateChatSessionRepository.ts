import {
  PrivateChatSession,
  SessionType,
  SessionStatus,
} from '../../domain/entities/PrivateChatSession';
import { IPrivateChatSessionRepository } from '../../domain/repositories/IPrivateChatSessionRepository';
import {
  RepositoryException,
  OptimisticLockException,
  UniqueConstraintViolationException,
} from './exceptions';

/**
 * D1PrivateChatSessionRepository - Cloudflare D1 Implementation
 *
 * Implements IPrivateChatSessionRepository using Cloudflare D1 database.
 *
 * Security features:
 * - Parameterized queries to prevent SQL injection
 * - Optimistic locking via version field
 * - Foreign key validation at application level
 * - Expiry-based queries for session lifecycle management
 *
 * Implementation notes:
 * - Uses PrivateChatSession.reconstitute() when loading from database
 * - Clears domain events after successful save (without publishing)
 * - Enforces unique constraint on tlkChannelId
 * - Supports efficient member-based and expiry-based queries
 */
export class D1PrivateChatSessionRepository implements IPrivateChatSessionRepository {
  constructor(private readonly db: D1Database) {}

  async save(session: PrivateChatSession): Promise<void> {
    try {
      const data = session.toPersistence();

      // Check if session exists
      const existing = await this.db
        .prepare('SELECT version FROM private_chat_sessions WHERE id = ?')
        .bind(data.id)
        .first<{ version: number }>();

      if (existing) {
        // Update existing session with optimistic locking
        if (existing.version !== data.version - 1) {
          throw new OptimisticLockException(
            'PrivateChatSession',
            data.id,
            data.version - 1,
            existing.version
          );
        }

        const result = await this.db
          .prepare(
            `UPDATE private_chat_sessions
             SET member_a_id = ?,
                 member_b_id = ?,
                 tlk_channel_id = ?,
                 type = ?,
                 status = ?,
                 version = ?,
                 updated_at = ?,
                 expires_at = ?
             WHERE id = ? AND version = ?`
          )
          .bind(
            data.memberAId,
            data.memberBId,
            data.tlkChannelId,
            data.type,
            data.status,
            data.version,
            data.updatedAt,
            data.expiresAt,
            data.id,
            data.version - 1
          )
          .run();

        if (!result.success) {
          throw new RepositoryException(`Failed to update private chat session: ${result.error}`);
        }

        if (result.meta.changes === 0) {
          const current = await this.db
            .prepare('SELECT version FROM private_chat_sessions WHERE id = ?')
            .bind(data.id)
            .first<{ version: number }>();

          throw new OptimisticLockException(
            'PrivateChatSession',
            data.id,
            data.version - 1,
            current?.version ?? -1
          );
        }
      } else {
        // Insert new session
        try {
          const result = await this.db
            .prepare(
              `INSERT INTO private_chat_sessions (
                id, member_a_id, member_b_id, tlk_channel_id, type,
                status, version, created_at, updated_at, expires_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              data.id,
              data.memberAId,
              data.memberBId,
              data.tlkChannelId,
              data.type,
              data.status,
              data.version,
              data.createdAt,
              data.updatedAt,
              data.expiresAt
            )
            .run();

          if (!result.success) {
            throw new RepositoryException(`Failed to insert private chat session: ${result.error}`);
          }
        } catch (error: any) {
          if (error.message && error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('tlk_channel_id')) {
              throw new UniqueConstraintViolationException(
                'PrivateChatSession',
                'tlkChannelId',
                data.tlkChannelId,
                error
              );
            }
          }
          throw error;
        }
      }

      // Clear domain events after successful save
      session.clearDomainEvents();
    } catch (error) {
      if (
        error instanceof OptimisticLockException ||
        error instanceof UniqueConstraintViolationException ||
        error instanceof RepositoryException
      ) {
        throw error;
      }
      throw new RepositoryException(
        'Failed to save private chat session',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findById(id: string): Promise<PrivateChatSession | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE id = ?`
        )
        .bind(id)
        .first<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      if (!row) {
        return null;
      }

      return this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find private chat session by ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByTlkChannelId(tlkChannelId: string): Promise<PrivateChatSession | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE tlk_channel_id = ?`
        )
        .bind(tlkChannelId)
        .first<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      if (!row) {
        return null;
      }

      return this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find private chat session by tlk channel ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findActiveSessionsForMember(memberId: string): Promise<PrivateChatSession[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE status = ? AND (member_a_id = ? OR member_b_id = ?)
           ORDER BY created_at DESC`
        )
        .bind(SessionStatus.ACTIVE, memberId, memberId)
        .all<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find active sessions for member',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findActiveSessionByMemberId(memberId: string): Promise<PrivateChatSession | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE (member_a_id = ? OR member_b_id = ?) 
           AND status = 'ACTIVE' 
           AND expires_at > ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .bind(memberId, memberId, Date.now())
        .first<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      if (!row) {
        return null;
      }

      return this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException('Failed to find active session by member ID', error);
    }
  }

  async findActiveSessionBetweenMembers(
    memberIdA: string,
    memberIdB: string
  ): Promise<PrivateChatSession | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE status = ?
             AND ((member_a_id = ? AND member_b_id = ?) OR (member_a_id = ? AND member_b_id = ?))
           LIMIT 1`
        )
        .bind(SessionStatus.ACTIVE, memberIdA, memberIdB, memberIdB, memberIdA)
        .first<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      if (!row) {
        return null;
      }

      return this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find active session between members',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findExpiredSessions(currentTime: number = Date.now()): Promise<PrivateChatSession[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE status = ? AND expires_at <= ?
           ORDER BY expires_at ASC`
        )
        .bind(SessionStatus.ACTIVE, currentTime)
        .all<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find expired sessions',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByStatus(status: SessionStatus | string): Promise<PrivateChatSession[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE status = ?
           ORDER BY created_at DESC`
        )
        .bind(status)
        .all<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find sessions by status',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByType(type: SessionType): Promise<PrivateChatSession[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, member_a_id, member_b_id, tlk_channel_id, type,
                  status, version, created_at, updated_at, expires_at
           FROM private_chat_sessions
           WHERE type = ?
           ORDER BY created_at DESC`
        )
        .bind(type)
        .all<{
          id: string;
          member_a_id: string;
          member_b_id: string;
          tlk_channel_id: string;
          type: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
          expires_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find sessions by type',
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM private_chat_sessions WHERE id = ?').bind(id).run();
    } catch (error) {
      throw new RepositoryException(
        'Failed to delete private chat session',
        error instanceof Error ? error : undefined
      );
    }
  }

  async existsByTlkChannelId(tlkChannelId: string): Promise<boolean> {
    try {
      const row = await this.db
        .prepare('SELECT 1 FROM private_chat_sessions WHERE tlk_channel_id = ?')
        .bind(tlkChannelId)
        .first();

      return row !== null;
    } catch (error) {
      throw new RepositoryException(
        'Failed to check if session exists by tlk channel ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  private reconstitute(row: {
    id: string;
    member_a_id: string;
    member_b_id: string;
    tlk_channel_id: string;
    type: string;
    status: string;
    version: number;
    created_at: number;
    updated_at: number;
    expires_at: number;
  }): PrivateChatSession {
    return PrivateChatSession.reconstitute({
      id: row.id,
      memberAId: row.member_a_id,
      memberBId: row.member_b_id,
      tlkChannelId: row.tlk_channel_id,
      type: row.type as SessionType,
      status: row.status as SessionStatus,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    });
  }
}
