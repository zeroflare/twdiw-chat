import { RepositoryException } from './RepositoryException';

/**
 * Exception thrown when a unique constraint is violated during a database operation.
 * This typically occurs when attempting to insert or update a record with a duplicate
 * value for a unique field (e.g., oidcSubjectId, linkedVcDid, tlkChannelId).
 *
 * Resolution strategies:
 * - Check if the record already exists before inserting
 * - Provide meaningful error message to the user
 * - Use idempotent operations where appropriate
 */
export class UniqueConstraintViolationException extends RepositoryException {
  constructor(
    entityType: string,
    fieldName: string,
    fieldValue: string,
    cause?: Error
  ) {
    super(
      `Unique constraint violation for ${entityType}: ` +
        `A record with ${fieldName} = "${fieldValue}" already exists.`,
      cause
    );
    this.name = 'UniqueConstraintViolationException';
  }
}
