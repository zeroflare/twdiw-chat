# twdiw-chat Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-11-08

## Active Technologies
- **001-gated-forum-matching**:
    - TypeScript 5.x, Node.js 20.x
    - Cloudflare Workers, Wrangler
    - Hono (for routing)
    - Vitest (for testing)
    - Cloudflare D1 (for persistence)
    - OIDC Client (for authentication)
- **001-sandbox-api-integration**:
    - TypeScript 5.x, Node.js 20.x
- TypeScript 5.x, Node.js 20.x + wrangler, hono, oidc-client-ts, vites (001-gated-forum-matching)
- Cloudflare D1 for structured data (Member Profiles, Forums). (001-gated-forum-matching)

## Project Structure

```text
src/
├── domain/
│   ├── entities/       # Aggregate Roots (MemberProfile, Forum, etc.)
│   ├── events/         # Domain Events
│   ├── repositories/   # Repository Interfaces
│   ├── services/       # Domain Services
│   └── value-objects/  # Value Objects (EncryptedPersonalInfo)
├── handlers/           # API route handlers
├── models/             # Data Transfer Objects (DTOs)
└── services/           # Application Services / Use Cases
tests/
├── backend/            # Unit & integration tests for domain/services
└── frontend/
```

## Commands

- **Run tests**: `npm test`
- **Run linter**: `npm run lint`
- **Combined**: `npm test && npm run lint`

## Code Style

- **TypeScript 5.x, Node.js 20.x**: Follow standard modern conventions.
- **Domain-Driven Design (DDD)**: The core logic is modeled using DDD patterns.
    - **Rich Aggregates**: Encapsulate business rules and state.
    - **Domain Events**: Decouple bounded contexts.
    - **Repositories**: Abstract persistence.
    - **Value Objects**: Represent descriptive aspects of the domain.
- **Immutability**: Prefer immutable data structures where possible.

## Recent Changes
- 001-gated-forum-matching: Added TypeScript 5.x, Node.js 20.x + wrangler, hono, oidc-client-ts, vites
- **001-gated-forum-matching (2025-11-08)**:
    - Implemented core domain layer using Domain-Driven Design (DDD).
    - Created `MemberProfile` aggregate root with rank verification logic.
    - Created `Forum` aggregate root with access control and capacity management.
    - Created `PrivateChatSession` aggregate root for managing chat lifecycles.
    - Implemented `EncryptedPersonalInfo` value object using Web Crypto API (AES-256-GCM).
    - Defined repository interfaces (`IMemberProfileRepository`, `IForumRepository`, etc.).
    - Defined domain service interfaces (`MatchingService`, `RankVerificationService`).
    - Extensive TDD approach with high test coverage in `tests/backend/`.

- **001-sandbox-api-integration**:
    - Initial setup with TypeScript and Node.js.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
