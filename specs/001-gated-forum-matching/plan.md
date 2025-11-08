# Implementation Plan: 三人行必有我師論壇

**Branch**: `001-gated-forum-matching` | **Date**: 2025-11-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-gated-forum-matching/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature will create a community platform, "三人行必有我師論壇," where users can join exclusive forums based on a "Rank Card" Verifiable Credential. The system will use OIDC for authentication, the `twdiw` API for VC verification, and `tlk.io` for chat functionalities. The backend will be developed on Cloudflare Workers, providing a scalable and secure foundation for the web application.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20.x
**Primary Dependencies**: wrangler, hono, oidc-client-ts, vitest
**Storage**: Cloudflare D1 for structured data (Member Profiles, Forums).
**Testing**: vitest
**Target Platform**: Cloudflare Workers
**Project Type**: Web Application (frontend + backend)
**Performance Goals**:
  - OIDC login & registration < 30s
  - VC verification flow < 60s
  - Daily match private chat entry < 10s
  - Private chat invitation delivery < 5s
**Constraints**: NEEDS CLARIFICATION
**Scale/Scope**: NEEDS CLARIFICATION

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **P1: Security First**: Compliant. The design uses OIDC for authentication and requires encryption for sensitive user data (FR11).
- **P2: User-Centric Design**: Compliant. The specification includes clear UX considerations for failure cases, such as VC verification errors and chat service unavailability.
- **P3: Code Quality & Maintainability**: Compliant. To be enforced through code reviews and adherence to established coding standards during implementation.
- **P4: Performance & Scalability**: Compliant. The architecture uses Cloudflare Workers and D1, which are inherently scalable. Specific performance success criteria are defined (SC1-SC6).
- **P5: Data Privacy**: Compliant. The specification explicitly requires sensitive self-declared data to be encrypted at rest (FR11).
- **TS1: Preferred Technologies**: Compliant. The plan uses the established stack of TypeScript and Node.js.
- **TS2: Microservices Architecture**: N/A. This feature will be developed as a single service within the existing project structure.
- **TS3: API First**: Compliant. The backend will expose a clear API for the frontend, and the system is designed around interactions with external APIs (`twdiw`, `tlk.io`, OIDC).
- **GF1: No PII in Logs**: Compliant. To be enforced during implementation.
- **GF3: No Unjustified Dependencies**: Compliant. Dependencies like `hono` and `oidc-client-ts` are justified for building a robust web application on Cloudflare Workers.

## Project Structure

### Documentation (this feature)

```text
specs/001-gated-forum-matching/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
backend/
├── src/
│   ├── index.ts
│   ├── handlers/
│   ├── models/
│   └── services/
└── tests/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

**Structure Decision**: The project will be structured as a web application with a distinct `frontend` and `backend` directory. This separation aligns with the feature's requirements for a user-facing interface and a corresponding backend service, promoting a clean architecture and separation of concerns. The existing `src` and `tests` directories will be restructured to fit this model.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
|           |            |                                     |
|           |            |                                     |
