import { RepositoryException } from './RepositoryException';

/**
 * Exception thrown when a foreign key constraint is violated during a database operation.
 * This typically occurs when attempting to insert or update a record with a reference
 * to a non-existent entity (e.g., memberAId or memberBId that doesn't exist).
 *
 * Note: D1 doesn't enforce foreign key constraints at the database level,
 * so this exception is thrown by application-level validation.
 *
 * Resolution strategies:
 * - Verify referenced entities exist before creating relationships
 * - Use cascading deletes where appropriate
 * - Provide meaningful error message to the user
 */
export class ForeignKeyViolationException extends RepositoryException {
  constructor(
    entityType: string,
    fieldName: string,
    referencedId: string,
    cause?: Error
  ) {
    super(
      `Foreign key violation for ${entityType}: ` +
        `Referenced ${fieldName} = "${referencedId}" does not exist.`,
      cause
    );
    this.name = 'ForeignKeyViolationException';
  }
}
