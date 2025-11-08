/**
 * Test suite for D1MemberProfileRepository.findByOidcSubjectId() diagnostic logging
 *
 * This test suite validates comprehensive error diagnostics for the findByOidcSubjectId method,
 * following TDD RED-GREEN-REFACTOR methodology.
 *
 * Test-Driven Development Approach:
 * - RED phase: Write failing tests that define expected diagnostic behavior
 * - GREEN phase: Implement diagnostics to make tests pass
 * - REFACTOR phase: Ensure clean, secure code
 *
 * Expected Diagnostics:
 * 1. Method entry logging with oidcSubjectId (without PII exposure)
 * 2. SQL query execution logging
 * 3. Parameter binding logging
 * 4. Query result logging (found/not found)
 * 5. Decryption operation logging
 * 6. Error context logging before re-throw
 * 7. Success logging with basic profile info
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { D1MemberProfileRepository } from '../../src/infrastructure/repositories/D1MemberProfileRepository';
import { EncryptionService } from '../../src/infrastructure/security/EncryptionService';
import { MemberStatus } from '../../src/domain/entities/MemberProfile';
import { RepositoryException } from '../../src/infrastructure/repositories/exceptions';

describe('D1MemberProfileRepository - findByOidcSubjectId() Diagnostic Logging', () => {
  let repository: D1MemberProfileRepository;
  let mockDb: any;
  let mockEncryptionService: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Spy on console methods to verify diagnostic logging
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock encryption service
    mockEncryptionService = {
      decrypt: vi.fn().mockResolvedValue('decrypted-value'),
    };

    // Mock D1 database
    mockDb = {
      prepare: vi.fn(),
    };

    repository = new D1MemberProfileRepository(mockDb, mockEncryptionService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Method Entry Logging', () => {
    it('should log method entry with oidcSubjectId parameter', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[D1MemberProfileRepository]'),
        expect.objectContaining({
          oidcSubjectId: oidcSubjectId,
        })
      );
    });

    it('should log method name clearly in entry message', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('findByOidcSubjectId'),
        expect.anything()
      );
    });
  });

  describe('SQL Query Execution Logging', () => {
    it('should log SQL query structure being executed', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Executing SQL query'),
        expect.objectContaining({
          operation: 'SELECT',
        })
      );
    });

    it('should log parameter binding for SQL query', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Parameter binding'),
        expect.objectContaining({
          parameterCount: 1,
        })
      );
    });
  });

  describe('Query Result Logging', () => {
    it('should log when profile is found', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'encrypted-gender',
        interests: 'encrypted-interests',
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query result'),
        expect.objectContaining({
          found: true,
          id: mockRow.id,
        })
      );
    });

    it('should log when profile is not found', async () => {
      // Arrange
      const oidcSubjectId = 'non-existent-oidc-subject';
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      // Act
      const result = await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(result).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query result'),
        expect.objectContaining({
          found: false,
        })
      );
    });

    it('should log row structure metadata when found', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'encrypted-gender',
        interests: null,
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query result'),
        expect.objectContaining({
          hasGender: true,
          hasInterests: false,
        })
      );
    });
  });

  describe('Decryption Operation Logging', () => {
    it('should log decryption operation for gender field', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'encrypted-gender',
        interests: null,
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Decrypting sensitive fields'),
        expect.objectContaining({
          hasGender: true,
        })
      );
    });

    it('should log decryption operation for interests field', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: null,
        interests: 'encrypted-interests',
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Decrypting sensitive fields'),
        expect.objectContaining({
          hasInterests: true,
        })
      );
    });

    it('should log successful decryption completion', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'encrypted-gender',
        interests: 'encrypted-interests',
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Decryption completed successfully'),
        expect.anything()
      );
    });
  });

  describe('Error Context Logging', () => {
    it('should log detailed error context when SQL query fails', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const sqlError = new Error('SQL syntax error: table does not exist');
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(sqlError),
        }),
      });

      // Act & Assert
      await expect(repository.findByOidcSubjectId(oidcSubjectId)).rejects.toThrow(RepositoryException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[D1MemberProfileRepository]'),
        expect.objectContaining({
          errorType: 'Error',
          errorMessage: sqlError.message,
          operation: 'findByOidcSubjectId',
        })
      );
    });

    it('should log error context when decryption fails', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'invalid-encrypted-data',
        interests: null,
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const decryptionError = new Error('Invalid encrypted data format');
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });
      mockEncryptionService.decrypt.mockRejectedValue(decryptionError);

      // Act & Assert
      await expect(repository.findByOidcSubjectId(oidcSubjectId)).rejects.toThrow(RepositoryException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Decryption failed'),
        expect.objectContaining({
          errorMessage: decryptionError.message,
        })
      );
    });

    it('should log error type classification', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const sqlError = new Error('Database connection failed');
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(sqlError),
        }),
      });

      // Act & Assert
      await expect(repository.findByOidcSubjectId(oidcSubjectId)).rejects.toThrow(RepositoryException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          errorType: expect.stringMatching(/Error/),
          isRepositoryException: false,
        })
      );
    });
  });

  describe('Success Logging', () => {
    it('should log successful operation with basic profile info', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'encrypted-gender',
        interests: 'encrypted-interests',
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('findByOidcSubjectId completed successfully'),
        expect.objectContaining({
          id: mockRow.id,
          status: mockRow.status,
        })
      );
    });

    it('should not expose PII in success logs', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockRow = {
        id: 'member-123',
        oidc_subject_id: oidcSubjectId,
        status: MemberStatus.ACTIVE,
        nickname: '測試用戶',
        gender: 'encrypted-gender',
        interests: 'encrypted-interests',
        linked_vc_did: null,
        derived_rank: null,
        version: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockRow),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      const successLog = consoleLogSpy.mock.calls.find((call: any) =>
        call[0].includes('completed successfully')
      );
      expect(successLog).toBeDefined();
      expect(successLog[1]).not.toHaveProperty('gender');
      expect(successLog[1]).not.toHaveProperty('interests');
      expect(successLog[1]).not.toHaveProperty('nickname');
    });
  });

  describe('Database Connection Diagnostics', () => {
    it('should detect and log database connection issues', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const connectionError = new Error('D1 database connection timeout');
      mockDb.prepare.mockImplementation(() => {
        throw connectionError;
      });

      // Act & Assert
      await expect(repository.findByOidcSubjectId(oidcSubjectId)).rejects.toThrow(RepositoryException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[D1MemberProfileRepository]'),
        expect.objectContaining({
          errorMessage: expect.stringContaining('connection'),
        })
      );
    });

    it('should log prepare() call execution', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Executing SQL query'),
        expect.anything()
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });
  });

  describe('Parameter Binding Diagnostics', () => {
    it('should log bind() parameter count', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const mockBind = vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      });
      mockDb.prepare.mockReturnValue({
        bind: mockBind,
      });

      // Act
      await repository.findByOidcSubjectId(oidcSubjectId);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Parameter binding'),
        expect.objectContaining({
          parameterCount: 1,
        })
      );
      expect(mockBind).toHaveBeenCalledWith(oidcSubjectId);
    });

    it('should detect bind() parameter mismatch', async () => {
      // Arrange
      const oidcSubjectId = 'test-oidc-subject-123';
      const bindError = new Error('Parameter count mismatch: expected 1, got 0');
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockImplementation(() => {
          throw bindError;
        }),
      });

      // Act & Assert
      await expect(repository.findByOidcSubjectId(oidcSubjectId)).rejects.toThrow(RepositoryException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[D1MemberProfileRepository]'),
        expect.objectContaining({
          errorMessage: expect.stringContaining('Parameter'),
        })
      );
    });
  });
});
