import { Forum, Rank, ForumStatus } from '../../domain/entities/Forum';
import { IForumRepository } from '../../domain/repositories/IForumRepository';
import {
  RepositoryException,
  OptimisticLockException,
  UniqueConstraintViolationException,
} from './exceptions';

/**
 * D1ForumRepository - Cloudflare D1 Implementation
 *
 * Implements IForumRepository using Cloudflare D1 database.
 *
 * Security features:
 * - Parameterized queries to prevent SQL injection
 * - Optimistic locking via version field
 * - Rank-based access control queries
 *
 * Implementation notes:
 * - Uses Forum.reconstitute() when loading from database
 * - Clears domain events after successful save (without publishing)
 * - Enforces unique constraint on tlkChannelId
 * - Supports efficient rank hierarchy queries
 */
export class D1ForumRepository implements IForumRepository {
  constructor(private readonly db: D1Database) {}

  async save(forum: Forum): Promise<void> {
    try {
      const data = forum.toPersistence();

      // Check if forum exists
      const existing = await this.db
        .prepare('SELECT version FROM forums WHERE id = ?')
        .bind(data.id)
        .first<{ version: number }>();

      if (existing) {
        // Update existing forum with optimistic locking
        if (existing.version !== data.version - 1) {
          throw new OptimisticLockException('Forum', data.id, data.version - 1, existing.version);
        }

        const result = await this.db
          .prepare(
            `UPDATE forums
             SET required_rank = ?,
                 description = ?,
                 tlk_channel_id = ?,
                 capacity = ?,
                 member_count = ?,
                 creator_id = ?,
                 status = ?,
                 version = ?,
                 updated_at = ?
             WHERE id = ? AND version = ?`
          )
          .bind(
            data.requiredRank,
            data.description ?? null,
            data.tlkChannelId,
            data.capacity,
            data.memberCount,
            data.creatorId,
            data.status,
            data.version,
            data.updatedAt,
            data.id,
            data.version - 1
          )
          .run();

        if (!result.success) {
          throw new RepositoryException(`Failed to update forum: ${result.error}`);
        }

        if (result.meta.changes === 0) {
          const current = await this.db
            .prepare('SELECT version FROM forums WHERE id = ?')
            .bind(data.id)
            .first<{ version: number }>();

          throw new OptimisticLockException('Forum', data.id, data.version - 1, current?.version ?? -1);
        }
      } else {
        // Insert new forum
        try {
          const result = await this.db
            .prepare(
              `INSERT INTO forums (
                id, required_rank, description, tlk_channel_id, capacity,
                member_count, creator_id, status, version, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              data.id,
              data.requiredRank,
              data.description ?? null,
              data.tlkChannelId,
              data.capacity,
              data.memberCount,
              data.creatorId,
              data.status,
              data.version,
              data.createdAt,
              data.updatedAt
            )
            .run();

          if (!result.success) {
            throw new RepositoryException(`Failed to insert forum: ${result.error}`);
          }
        } catch (error: any) {
          if (error.message && error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('tlk_channel_id')) {
              throw new UniqueConstraintViolationException(
                'Forum',
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
      forum.clearDomainEvents();
    } catch (error) {
      if (
        error instanceof OptimisticLockException ||
        error instanceof UniqueConstraintViolationException ||
        error instanceof RepositoryException
      ) {
        throw error;
      }
      throw new RepositoryException('Failed to save forum', error instanceof Error ? error : undefined);
    }
  }

  async findById(id: string): Promise<Forum | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, required_rank, description, tlk_channel_id, capacity,
                  member_count, creator_id, status, version, created_at, updated_at
           FROM forums
           WHERE id = ?`
        )
        .bind(id)
        .first<{
          id: string;
          required_rank: string;
          description: string | null;
          tlk_channel_id: string;
          capacity: number;
          member_count: number;
          creator_id: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      if (!row) {
        return null;
      }

      return this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException('Failed to find forum by ID', error instanceof Error ? error : undefined);
    }
  }

  async findByTlkChannelId(tlkChannelId: string): Promise<Forum | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, required_rank, description, tlk_channel_id, capacity,
                  member_count, creator_id, status, version, created_at, updated_at
           FROM forums
           WHERE tlk_channel_id = ?`
        )
        .bind(tlkChannelId)
        .first<{
          id: string;
          required_rank: string;
          description: string | null;
          tlk_channel_id: string;
          capacity: number;
          member_count: number;
          creator_id: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      if (!row) {
        return null;
      }

      return this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find forum by tlk channel ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByRequiredRank(rank: Rank): Promise<Forum[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, required_rank, description, tlk_channel_id, capacity,
                  member_count, creator_id, status, version, created_at, updated_at
           FROM forums
           WHERE status = ? AND required_rank = ?
           ORDER BY created_at DESC`
        )
        .bind(ForumStatus.ACTIVE, rank)
        .all<{
          id: string;
          required_rank: string;
          description: string | null;
          tlk_channel_id: string;
          capacity: number;
          member_count: number;
          creator_id: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find forums by required rank',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findActiveForums(): Promise<Forum[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, required_rank, description, tlk_channel_id, capacity,
                  member_count, creator_id, status, version, created_at, updated_at
           FROM forums
           WHERE status = ?
           ORDER BY created_at DESC`
        )
        .bind(ForumStatus.ACTIVE)
        .all<{
          id: string;
          required_rank: string;
          description: string | null;
          tlk_channel_id: string;
          capacity: number;
          member_count: number;
          creator_id: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find active forums',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findAccessibleForums(memberRank: Rank): Promise<Forum[]> {
    try {
      // Build rank list based on hierarchy
      const accessibleRanks: Rank[] = this.getAccessibleRanks(memberRank);

      const { results } = await this.db
        .prepare(
          `SELECT id, required_rank, description, tlk_channel_id, capacity,
                  member_count, creator_id, status, version, created_at, updated_at
           FROM forums
           WHERE status = ?
             AND required_rank IN (${accessibleRanks.map(() => '?').join(',')})
             AND member_count < capacity
           ORDER BY required_rank DESC, created_at DESC`
        )
        .bind(ForumStatus.ACTIVE, ...accessibleRanks)
        .all<{
          id: string;
          required_rank: string;
          description: string | null;
          tlk_channel_id: string;
          capacity: number;
          member_count: number;
          creator_id: string;
          status: string;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      return results.map((row) => this.reconstitute(row));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find accessible forums',
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM forums WHERE id = ?').bind(id).run();
    } catch (error) {
      throw new RepositoryException('Failed to delete forum', error instanceof Error ? error : undefined);
    }
  }

  async existsByTlkChannelId(tlkChannelId: string): Promise<boolean> {
    try {
      const row = await this.db
        .prepare('SELECT 1 FROM forums WHERE tlk_channel_id = ?')
        .bind(tlkChannelId)
        .first();

      return row !== null;
    } catch (error) {
      throw new RepositoryException(
        'Failed to check if forum exists by tlk channel ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  private getAccessibleRanks(memberRank: Rank): Rank[] {
    switch (memberRank) {
      case Rank.GOLD:
        return [Rank.GOLD, Rank.SILVER, Rank.BRONZE];
      case Rank.SILVER:
        return [Rank.SILVER, Rank.BRONZE];
      case Rank.BRONZE:
        return [Rank.BRONZE];
      default:
        return [];
    }
  }

  private reconstitute(row: {
    id: string;
    required_rank: string;
    description: string | null;
    tlk_channel_id: string;
    capacity: number;
    member_count: number;
    creator_id: string;
    status: string;
    version: number;
    created_at: number;
    updated_at: number;
  }): Forum {
    return Forum.reconstitute({
      id: row.id,
      requiredRank: row.required_rank as Rank,
      description: row.description ?? undefined,
      tlkChannelId: row.tlk_channel_id,
      capacity: row.capacity,
      memberCount: row.member_count,
      creatorId: row.creator_id,
      status: row.status as ForumStatus,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
