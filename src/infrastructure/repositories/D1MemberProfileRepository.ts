import { MemberProfile, MemberStatus, Rank } from '../../domain/entities/MemberProfile';
import { IMemberProfileRepository } from '../../domain/repositories/IMemberProfileRepository';
import { EncryptionService } from '../security/EncryptionService';
import {
  RepositoryException,
  OptimisticLockException,
  UniqueConstraintViolationException,
} from './exceptions';

/**
 * D1MemberProfileRepository - Cloudflare D1 Implementation
 *
 * Implements IMemberProfileRepository using Cloudflare D1 database.
 *
 * Security features:
 * - AES-256-GCM encryption for sensitive fields (gender, interests)
 * - Parameterized queries to prevent SQL injection
 * - Optimistic locking via version field
 * - No PII in error messages or logs
 *
 * Implementation notes:
 * - Uses MemberProfile.reconstitute() when loading from database
 * - Clears domain events after successful save (without publishing)
 * - Enforces unique constraints on oidcSubjectId and linkedVcDid
 * - Encrypts/decrypts sensitive fields transparently
 */
export class D1MemberProfileRepository implements IMemberProfileRepository {
  constructor(
    private readonly db: D1Database,
    private readonly encryptionService: EncryptionService
  ) {}

  async save(profile: MemberProfile): Promise<void> {
    try {
      const data = profile.toPersistence();

      // Encrypt sensitive fields
      const encryptedGender = data.gender ? await this.encryptionService.encrypt(data.gender) : null;
      const encryptedInterests = data.interests
        ? await this.encryptionService.encrypt(data.interests)
        : null;

      // Check if profile exists
      const existing = await this.db
        .prepare('SELECT version FROM member_profiles WHERE id = ?')
        .bind(data.id)
        .first<{ version: number }>();

      if (existing) {
        // Update existing profile with optimistic locking
        if (existing.version !== data.version - 1) {
          throw new OptimisticLockException(
            'MemberProfile',
            data.id,
            data.version - 1,
            existing.version
          );
        }

        const result = await this.db
          .prepare(
            `UPDATE member_profiles
             SET oidc_subject_id = ?,
                 status = ?,
                 nickname = ?,
                 gender = ?,
                 interests = ?,
                 linked_vc_did = ?,
                 derived_rank = ?,
                 version = ?,
                 updated_at = ?
             WHERE id = ? AND version = ?`
          )
          .bind(
            data.oidcSubjectId,
            data.status,
            data.nickname,
            encryptedGender,
            encryptedInterests,
            data.linkedVcDid ?? null,
            data.derivedRank ?? null,
            data.version,
            data.updatedAt,
            data.id,
            data.version - 1
          )
          .run();

        if (!result.success) {
          throw new RepositoryException(`Failed to update member profile: ${result.error}`);
        }

        // Check if any rows were updated (optimistic lock check)
        if (result.meta.changes === 0) {
          // Re-check version to provide better error message
          const current = await this.db
            .prepare('SELECT version FROM member_profiles WHERE id = ?')
            .bind(data.id)
            .first<{ version: number }>();

          throw new OptimisticLockException(
            'MemberProfile',
            data.id,
            data.version - 1,
            current?.version ?? -1
          );
        }
      } else {
        // Insert new profile
        try {
          const result = await this.db
            .prepare(
              `INSERT INTO member_profiles (
                id, oidc_subject_id, status, nickname, gender, interests,
                linked_vc_did, derived_rank, version, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              data.id,
              data.oidcSubjectId,
              data.status,
              data.nickname,
              encryptedGender,
              encryptedInterests,
              data.linkedVcDid ?? null,
              data.derivedRank ?? null,
              data.version,
              data.createdAt,
              data.updatedAt
            )
            .run();

          if (!result.success) {
            throw new RepositoryException(`Failed to insert member profile: ${result.error}`);
          }
        } catch (error: any) {
          // Check for unique constraint violations
          if (error.message && error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('oidc_subject_id')) {
              throw new UniqueConstraintViolationException(
                'MemberProfile',
                'oidcSubjectId',
                data.oidcSubjectId,
                error
              );
            } else if (error.message.includes('linked_vc_did')) {
              throw new UniqueConstraintViolationException(
                'MemberProfile',
                'linkedVcDid',
                data.linkedVcDid ?? 'null',
                error
              );
            }
          }
          throw error;
        }
      }

      // Clear domain events after successful save (do not publish)
      profile.clearDomainEvents();
    } catch (error) {
      if (
        error instanceof OptimisticLockException ||
        error instanceof UniqueConstraintViolationException ||
        error instanceof RepositoryException
      ) {
        throw error;
      }
      throw new RepositoryException(
        'Failed to save member profile',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findById(id: string): Promise<MemberProfile | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, oidc_subject_id, status, nickname, gender, interests,
                  linked_vc_did, derived_rank, version, created_at, updated_at
           FROM member_profiles
           WHERE id = ?`
        )
        .bind(id)
        .first<{
          id: string;
          oidc_subject_id: string;
          status: string;
          nickname: string;
          gender: string | null;
          interests: string | null;
          linked_vc_did: string | null;
          derived_rank: string | null;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      if (!row) {
        return null;
      }

      return await this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find member profile by ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByOidcSubjectId(oidcSubjectId: string): Promise<MemberProfile | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, oidc_subject_id, status, nickname, gender, interests,
                  linked_vc_did, derived_rank, version, created_at, updated_at
           FROM member_profiles
           WHERE oidc_subject_id = ?`
        )
        .bind(oidcSubjectId)
        .first<{
          id: string;
          oidc_subject_id: string;
          status: string;
          nickname: string;
          gender: string | null;
          interests: string | null;
          linked_vc_did: string | null;
          derived_rank: string | null;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      if (!row) {
        return null;
      }

      return await this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find member profile by OIDC subject ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByLinkedVcDid(linkedVcDid: string): Promise<MemberProfile | null> {
    try {
      const row = await this.db
        .prepare(
          `SELECT id, oidc_subject_id, status, nickname, gender, interests,
                  linked_vc_did, derived_rank, version, created_at, updated_at
           FROM member_profiles
           WHERE linked_vc_did = ?`
        )
        .bind(linkedVcDid)
        .first<{
          id: string;
          oidc_subject_id: string;
          status: string;
          nickname: string;
          gender: string | null;
          interests: string | null;
          linked_vc_did: string | null;
          derived_rank: string | null;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      if (!row) {
        return null;
      }

      return await this.reconstitute(row);
    } catch (error) {
      throw new RepositoryException(
        'Failed to find member profile by linked VC DID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByStatus(status: MemberStatus): Promise<MemberProfile[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, oidc_subject_id, status, nickname, gender, interests,
                  linked_vc_did, derived_rank, version, created_at, updated_at
           FROM member_profiles
           WHERE status = ?
           ORDER BY created_at DESC`
        )
        .bind(status)
        .all<{
          id: string;
          oidc_subject_id: string;
          status: string;
          nickname: string;
          gender: string | null;
          interests: string | null;
          linked_vc_did: string | null;
          derived_rank: string | null;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      return await Promise.all(results.map((row) => this.reconstitute(row)));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find member profiles by status',
        error instanceof Error ? error : undefined
      );
    }
  }

  async findByRank(rank: Rank): Promise<MemberProfile[]> {
    try {
      const { results } = await this.db
        .prepare(
          `SELECT id, oidc_subject_id, status, nickname, gender, interests,
                  linked_vc_did, derived_rank, version, created_at, updated_at
           FROM member_profiles
           WHERE status = ? AND derived_rank = ?
           ORDER BY created_at DESC`
        )
        .bind(MemberStatus.VERIFIED, rank)
        .all<{
          id: string;
          oidc_subject_id: string;
          status: string;
          nickname: string;
          gender: string | null;
          interests: string | null;
          linked_vc_did: string | null;
          derived_rank: string | null;
          version: number;
          created_at: number;
          updated_at: number;
        }>();

      return await Promise.all(results.map((row) => this.reconstitute(row)));
    } catch (error) {
      throw new RepositoryException(
        'Failed to find member profiles by rank',
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM member_profiles WHERE id = ?').bind(id).run();
    } catch (error) {
      throw new RepositoryException(
        'Failed to delete member profile',
        error instanceof Error ? error : undefined
      );
    }
  }

  async existsByOidcSubjectId(oidcSubjectId: string): Promise<boolean> {
    try {
      const row = await this.db
        .prepare('SELECT 1 FROM member_profiles WHERE oidc_subject_id = ?')
        .bind(oidcSubjectId)
        .first();

      return row !== null;
    } catch (error) {
      throw new RepositoryException(
        'Failed to check if member exists by OIDC subject ID',
        error instanceof Error ? error : undefined
      );
    }
  }

  async existsByLinkedVcDid(linkedVcDid: string): Promise<boolean> {
    try {
      const row = await this.db
        .prepare('SELECT 1 FROM member_profiles WHERE linked_vc_did = ?')
        .bind(linkedVcDid)
        .first();

      return row !== null;
    } catch (error) {
      throw new RepositoryException(
        'Failed to check if member exists by linked VC DID',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Reconstitute a MemberProfile from database row.
   * Decrypts sensitive fields and uses MemberProfile.reconstitute().
   */
  private async reconstitute(row: {
    id: string;
    oidc_subject_id: string;
    status: string;
    nickname: string;
    gender: string | null;
    interests: string | null;
    linked_vc_did: string | null;
    derived_rank: string | null;
    version: number;
    created_at: number;
    updated_at: number;
  }): Promise<MemberProfile> {
    // Decrypt sensitive fields
    const gender = row.gender ? await this.encryptionService.decrypt(row.gender) : undefined;
    const interests = row.interests
      ? await this.encryptionService.decrypt(row.interests)
      : undefined;

    return MemberProfile.reconstitute({
      id: row.id,
      oidcSubjectId: row.oidc_subject_id,
      status: row.status as MemberStatus,
      nickname: row.nickname,
      gender,
      interests,
      linkedVcDid: row.linked_vc_did ?? undefined,
      derivedRank: row.derived_rank ?? undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
