import { RepositoryException } from './RepositoryException';

/**
 * Exception thrown when optimistic locking conflict is detected.
 * This occurs when the version field in the database doesn't match
 * the expected version during an update operation.
 *
 * Resolution strategies:
 * - Reload the entity and retry the operation
 * - Notify the user about concurrent modification
 * - Apply conflict resolution logic based on business rules
 */
export class OptimisticLockException extends RepositoryException {
  constructor(
    entityType: string,
    entityId: string,
    expectedVersion: number,
    actualVersion: number,
    cause?: Error
  ) {
    super(
      `Optimistic lock conflict detected for ${entityType} with id ${entityId}. ` +
        `Expected version ${expectedVersion} but found ${actualVersion}. ` +
        `The entity may have been modified by another process.`,
      cause
    );
    this.name = 'OptimisticLockException';
  }
}
