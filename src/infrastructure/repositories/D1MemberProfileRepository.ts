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

      // Enhanced diagnostics: Log data being saved (without PII in production)
      console.log('[D1MemberProfileRepository] Attempting to save member profile', {
        id: data.id,
        status: data.status,
        hasGender: !!data.gender,
        hasInterests: !!data.interests,
        version: data.version,
      });

      // Encrypt sensitive fields with error handling
      let encryptedGender: string | null = null;
      let encryptedInterests: string | null = null;

      try {
        encryptedGender = data.gender ? await this.encryptionService.encrypt(data.gender) : null;
        encryptedInterests = data.interests
          ? await this.encryptionService.encrypt(data.interests)
          : null;
      } catch (encryptError) {
        console.error('[D1MemberProfileRepository] Encryption failed:', encryptError);
        throw new RepositoryException(
          'Failed to encrypt sensitive fields',
          encryptError instanceof Error ? encryptError : undefined
        );
      }

      // Check if profile exists
      const existing = await this.db
        .prepare('SELECT version FROM member_profiles WHERE id = ?')
        .bind(data.id)
        .first<{ version: number }>();

      console.log('[D1MemberProfileRepository] Profile existence check:', {
        id: data.id,
        exists: !!existing,
        existingVersion: existing?.version,
      });

      if (existing) {
        // Update existing profile with optimistic locking
        if (existing.version !== data.version - 1) {
          console.error('[D1MemberProfileRepository] Optimistic lock failure on update', {
            id: data.id,
            expectedVersion: data.version - 1,
            actualVersion: existing.version,
          });
          throw new OptimisticLockException(
            'MemberProfile',
            data.id,
            data.version - 1,
            existing.version
          );
        }

        console.log('[D1MemberProfileRepository] Updating existing profile', {
          id: data.id,
          version: data.version,
        });

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
          console.error('[D1MemberProfileRepository] UPDATE failed', {
            id: data.id,
            error: result.error,
            meta: result.meta,
          });
          throw new RepositoryException(`Failed to update member profile: ${result.error}`);
        }

        console.log('[D1MemberProfileRepository] UPDATE successful', {
          id: data.id,
          changedRows: result.meta.changes,
        });

        // Check if any rows were updated (optimistic lock check)
        if (result.meta.changes === 0) {
          // Re-check version to provide better error message
          const current = await this.db
            .prepare('SELECT version FROM member_profiles WHERE id = ?')
            .bind(data.id)
            .first<{ version: number }>();

          console.error('[D1MemberProfileRepository] No rows updated - version mismatch', {
            id: data.id,
            expectedVersion: data.version - 1,
            currentVersion: current?.version,
          });

          throw new OptimisticLockException(
            'MemberProfile',
            data.id,
            data.version - 1,
            current?.version ?? -1
          );
        }
      } else {
        // Insert new profile
        console.log('[D1MemberProfileRepository] Inserting new profile', {
          id: data.id,
          oidcSubjectId: data.oidcSubjectId,
          nickname: data.nickname,
          status: data.status,
          version: data.version,
          hasGender: !!encryptedGender,
          hasInterests: !!encryptedInterests,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });

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
            console.error('[D1MemberProfileRepository] INSERT failed', {
              id: data.id,
              error: result.error,
              meta: result.meta,
            });
            throw new RepositoryException(`Failed to insert member profile: ${result.error}`);
          }

          console.log('[D1MemberProfileRepository] INSERT successful', {
            id: data.id,
            changedRows: result.meta.changes,
          });
        } catch (error: any) {
          console.error('[D1MemberProfileRepository] INSERT exception caught', {
            errorMessage: error.message,
            errorName: error.name,
            oidcSubjectId: data.oidcSubjectId,
          });

          // Check for unique constraint violations
          if (error.message && error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('oidc_subject_id')) {
              console.error('[D1MemberProfileRepository] UNIQUE constraint violation on oidc_subject_id', {
                oidcSubjectId: data.oidcSubjectId,
              });
              throw new UniqueConstraintViolationException(
                'MemberProfile',
                'oidcSubjectId',
                data.oidcSubjectId,
                error
              );
            } else if (error.message.includes('linked_vc_did')) {
              console.error('[D1MemberProfileRepository] UNIQUE constraint violation on linked_vc_did', {
                linkedVcDid: data.linkedVcDid,
              });
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

      console.log('[D1MemberProfileRepository] Save operation completed successfully', {
        id: data.id,
      });

      // Clear domain events after successful save (do not publish)
      profile.clearDomainEvents();
    } catch (error) {
      // Log the full error context before re-throwing
      console.error('[D1MemberProfileRepository] Save operation failed', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        isOptimisticLock: error instanceof OptimisticLockException,
        isUniqueConstraint: error instanceof UniqueConstraintViolationException,
        isRepositoryException: error instanceof RepositoryException,
      });

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
      // Enhanced diagnostics: Log method entry
      console.log('[D1MemberProfileRepository] findByOidcSubjectId called', {
        oidcSubjectId: oidcSubjectId,
      });

      // Enhanced diagnostics: Log SQL query execution
      console.log('[D1MemberProfileRepository] Executing SQL query', {
        operation: 'SELECT',
        table: 'member_profiles',
        whereClause: 'oidc_subject_id = ?',
      });

      // Enhanced diagnostics: Log parameter binding
      console.log('[D1MemberProfileRepository] Parameter binding', {
        parameterCount: 1,
        oidcSubjectId: oidcSubjectId,
      });

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

      // Enhanced diagnostics: Log query result
      if (!row) {
        console.log('[D1MemberProfileRepository] Query result', {
          found: false,
          oidcSubjectId: oidcSubjectId,
        });
        return null;
      }

      console.log('[D1MemberProfileRepository] Query result', {
        found: true,
        id: row.id,
        status: row.status,
        hasGender: !!row.gender,
        hasInterests: !!row.interests,
        hasLinkedVcDid: !!row.linked_vc_did,
        hasDerivedRank: !!row.derived_rank,
        version: row.version,
      });

      // Enhanced diagnostics: Log decryption operation
      console.log('[D1MemberProfileRepository] Decrypting sensitive fields', {
        hasGender: !!row.gender,
        hasInterests: !!row.interests,
      });

      try {
        const profile = await this.reconstitute(row);

        console.log('[D1MemberProfileRepository] Decryption completed successfully', {
          id: row.id,
        });

        // Enhanced diagnostics: Log successful completion
        console.log('[D1MemberProfileRepository] findByOidcSubjectId completed successfully', {
          id: row.id,
          status: row.status,
          version: row.version,
        });

        return profile;
      } catch (decryptError) {
        // Enhanced diagnostics: Log decryption failure
        console.error('[D1MemberProfileRepository] Decryption failed', {
          id: row.id,
          errorMessage: decryptError instanceof Error ? decryptError.message : String(decryptError),
          hasGender: !!row.gender,
          hasInterests: !!row.interests,
        });
        throw decryptError;
      }
    } catch (error) {
      // Enhanced diagnostics: Log full error context before re-throwing
      console.error('[D1MemberProfileRepository] findByOidcSubjectId operation failed', {
        operation: 'findByOidcSubjectId',
        oidcSubjectId: oidcSubjectId,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        isRepositoryException: error instanceof RepositoryException,
      });

      if (error instanceof RepositoryException) {
        throw error;
      }
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
    const gender = row.gender && row.gender !== 'null' ? await this.encryptionService.decrypt(row.gender) : undefined;
    const interests = row.interests && row.interests !== 'null'
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
