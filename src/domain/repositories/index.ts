/**
 * Repository Interfaces - DDD Repository Pattern
 *
 * This module exports all repository interfaces for the domain layer.
 *
 * Following Domain-Driven Design (DDD) principles:
 * - Repositories provide a collection-like interface for aggregate roots
 * - Repositories abstract persistence implementation details
 * - Domain layer depends on interfaces, not implementations (Dependency Inversion)
 * - Infrastructure layer provides concrete implementations
 *
 * Usage:
 * ```typescript
 * import { IMemberProfileRepository, IForumRepository, IPrivateChatSessionRepository } from '@/domain/repositories';
 * ```
 */

export { IMemberProfileRepository } from './IMemberProfileRepository';
export { IForumRepository } from './IForumRepository';
export { IPrivateChatSessionRepository } from './IPrivateChatSessionRepository';
