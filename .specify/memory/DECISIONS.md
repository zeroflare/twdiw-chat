# Architecture Decisions Record

## ADR-012: Automated Project Maintenance and Context Update (2025-11-09)
**Status**: ACCEPTED
**Context**: The project requires a standardized closing procedure to ensure all documentation and agent context files are up-to-date.
**Decision**: Implement a multi-step closing procedure.
- **progress.md**: Backup, summarize, and clean the file to maintain a concise record of recent activities.
- **Agent Context**: Execute `.specify/scripts/bash/update-agent-context.sh` to update `GEMINI.md` and other agent-specific context files based on the latest `plan.md`.
- **Memory Files**: Manually update `.specify/memory/DECISIONS.md`, `BUNDLE_INDEX.md`, and `CHECKPOINTS.md` to reflect the session's activities. `constitution.md` is to remain unchanged.
**Consequences**:
- ✅ Ensures project documentation is consistently maintained.
- ✅ Keeps AI agent context files synchronized with project state.
- ✅ Provides a clear and repeatable process for ending a work session.

## ADR-003: Matching Queue Status Management (2025-11-08)
**Status**: ACCEPTED
**Context**: Waiting users couldn't discover when they were matched because queue records were deleted
**Decision**: Update queue records to status='MATCHED' instead of deleting them
- Both matched users get status='MATCHED' with partner's member_id
- Enables discovery through polling mechanism
- Preserves data for analytics
**Consequences**: 
- ✅ Both users can discover matches regardless of who initiated
- ✅ Better user experience with polling updates
- ✅ Data retention for future analytics

## ADR-004: UI Rank Display Standardization (2025-11-08)
**Status**: ACCEPTED
**Context**: Frontend displayed English enum codes instead of Chinese rank names
**Decision**: Centralized rank mapping with Chinese display names
- Created rankUtils.ts with mapping functions
- Updated all components to use Chinese names
- Consistent display across entire application
**Consequences**:
- ✅ User-friendly Chinese rank names throughout UI
- ✅ Centralized mapping for easy maintenance
- ✅ Consistent user experience

## ADR-005: Forum Member Count Calculation (2025-11-08)
**Status**: ACCEPTED
**Context**: Forum member counts only showed single rank instead of adjacent rank access
**Decision**: Calculate member counts based on adjacent rank access system
- Sum all ranks that can access each forum
- Reflects actual potential forum population
- Aligns with adjacent rank access logic
**Consequences**:
- ✅ Accurate member counts reflecting accessibility
- ✅ Better user expectations for forum activity
- ✅ Consistent with access control system

## ADR-001: tlk.io Integration Architecture (2025-11-08)
**Status**: ACCEPTED
**Context**: Chat room loading failures and nickname persistence issues across user switches
**Decision**: Unified frontend-controlled tlk.io integration
- Backend APIs return only data (channelId, nickname)
- Frontend renders proper tlk.io HTML structure with data-nickname
- Script loading controlled by frontend with proper timing
**Consequences**: 
- ✅ Consistent chat room loading
- ✅ Correct nickname display per user
- ✅ Follows tlk.io documentation specifications
- ✅ Eliminates frontend/backend rendering conflicts

## ADR-002: User Isolation Strategy (2025-11-08)
**Status**: ACCEPTED  
**Context**: tlk.io nickname caching causing wrong nicknames across user switches
**Decision**: Multi-level user isolation
- Channel-level: Include user identifier in channelId generation
- URL-level: Add user hash parameter to iframe/script URLs
- Frontend-level: Use oidcSubjectId as React component key
**Consequences**:
- ✅ Complete user isolation in chat environments
- ✅ No cross-user nickname contamination
- ✅ Proper component lifecycle management

## ADR-007: OIDC Cookie HMAC Integration (2025-11-08)
**Status**: ACCEPTED
**Context**: CookieSigningService needed integration with OIDC authentication endpoints for state cookie integrity protection
**Decision**: Integrate HMAC signing into login and callback endpoints with minimal code changes
- Login endpoint: Sign JSON.stringify({state, codeVerifier}) before setCookie
- Callback endpoint: Verify signature before processing state cookie
- Use COOKIE_SIGNING_KEY environment variable for signing secret
- Return 400 error on signature verification failure
- Preserve all existing security attributes and flow
**Consequences**:
- ✅ OIDC state cookie tampering prevention (CSRF protection)
- ✅ Minimal code changes (15 lines) with no breaking API changes
- ✅ Timing-safe signature verification prevents timing attacks
- ✅ Graceful error handling with security event logging
- ⚠️ Requires COOKIE_SIGNING_KEY secret configuration for deployment
- ⚠️ Existing OIDC sessions invalidated (users must re-login once)

## ADR-006: OIDC Cookie Integrity Protection (2025-11-08)
**Status**: ACCEPTED
**Context**: OIDC state cookies containing state and codeVerifier need integrity protection to prevent CSRF attacks and tampering
**Decision**: Implement CookieSigningService with HMAC-SHA256 signing
- sign() method creates value.signature format with 64-char hex HMAC
- verify() method with timing-safe comparison prevents timing attacks
- Web Crypto API compatible with Cloudflare Workers
- Error handling without throwing for graceful degradation
**Consequences**:
- ✅ OIDC state cookie tampering prevention
- ✅ CSRF attack mitigation through integrity verification
- ✅ Timing attack resistance via constant-time comparison
- ✅ Ready for integration with auth endpoints

## ADR-009: JWT UTF-8 Character Encoding Fix (2025-11-09)
**Status**: ACCEPTED
**Context**: JWT payload parsing in OIDCService failed to properly decode UTF-8 multi-byte characters (Chinese characters like '吳勝繙' appeared as garbled text 'å\x90³å\x8B\x9Dç¹\x99')
**Decision**: Enhanced base64URLDecode() method to use TextDecoder for proper UTF-8 handling
- Decode base64 to binary string using atob()
- Convert binary string to Uint8Array byte-by-byte
- Use TextDecoder('utf-8') to properly decode UTF-8 bytes to string
- Maintains backward compatibility with ASCII-only payloads
**Consequences**:
- ✅ Proper display of Chinese, Japanese, Korean, Cyrillic, and emoji characters in JWT payloads
- ✅ Follows Web Standards (TextEncoder/TextDecoder API)
- ✅ No breaking changes to existing ASCII payloads
- ✅ Clear documentation of UTF-8 handling pipeline

## ADR-008: EncryptionService Key Normalization (2025-11-09)
**Status**: ACCEPTED
**Context**: EncryptionService failed with "Imported AES key length must be 128, 192, or 256 bits but provided 384" when using 384-bit encryption keys from environment variables
**Decision**: Implement automatic key normalization to 256 bits in EncryptionService
- Truncate oversized keys (384-bit → 256-bit by taking first 32 bytes)
- Zero-pad undersized keys (128-bit, 192-bit → 256-bit)
- Deterministic normalization ensures consistent encryption/decryption
- Base64 format validation in constructor
- No breaking changes for existing 256-bit keys
**Consequences**:
- ✅ Accepts keys of any length without throwing errors
- ✅ Maintains AES-256-GCM security properties
- ✅ Backward compatible with existing implementations
- ✅ Simplifies deployment (no strict key length requirements)
- ⚠️ Truncation of oversized keys may reduce entropy (acceptable trade-off)

## ADR-010: Frontend/Backend Separation Deployment (2025-11-09)
**Status**: ACCEPTED
**Context**: Workers Site asset serving issues with __STATIC_CONTENT_MANIFEST undefined causing 404 errors for CSS/JS files
**Decision**: Separate frontend and backend deployments
- Backend: Cloudflare Workers (API only) - serves /api/* routes
- Frontend: Cloudflare Pages (static assets) - separate GitHub-triggered builds
- Remove Workers Site configuration and getAssetFromKV complexity
- OIDC callback handling requires backend redirect to frontend domain
**Consequences**:
- ✅ Clean separation of concerns (API vs static assets)
- ✅ Simpler deployment process for each component
- ✅ Independent scaling and optimization
- ✅ No Workers Site complexity or asset serving issues
- ⚠️ OIDC callback flow needs adjustment for cross-domain redirect
- ⚠️ CORS configuration must include Pages domain

## ADR-011: Taiwan Wallet Verifier Service Integration (2025-11-09)
**Status**: ACCEPTED
**Context**: Need to integrate Taiwan government wallet verifier API (https://verifier-sandbox.wallet.gov.tw/) for official credential verification alongside existing TWDIW verification
**Decision**: Create TaiwanWalletVerifierService adapter implementing RankVerificationService interface
- Secure Bearer token authentication with environment variable configuration
- Comprehensive VP structure parsing and rank extraction
- Error handling without exposing sensitive data
- Follows existing service patterns for consistency
**Consequences**:
- ✅ Official government credential verification capability
- ✅ Maintains compatibility with existing verification flows
- ✅ Secure API communication with proper authentication
- ✅ Ready for integration with domain layer

## Previous Decisions
- Domain-Driven Design architecture
- Cloudflare Workers serverless deployment
- OIDC authentication with JWT tokens
- Encrypted PII storage using AES-256-GCM

## Checkpoint 2025-11-09: SSCI-Lite Closing Steps
**Summary**: Executed the standardized SSCI-Lite closing procedure to update documentation and agent context files.

**Details**:
- Updated  with the latest project information from .
- Archived the existing  to .
- Cleaned  to a new template.
- Appended a summary of the session to  and .

**Completed Tasks**:
- **Fix CORS Domain Configuration**: Corrected CORS configuration to resolve cross-origin request blocking issues.
- **Fix Cloudflare Pages JavaScript MIME Type Issue**: Resolved ES modules loading issue on Cloudflare Pages.

## Checkpoint 2025-11-09: SSCI-Lite Closing Steps
**Summary**: Executed the standardized SSCI-Lite closing procedure to update documentation and agent context files.

**Details**:
- Updated `GEMINI.md` with the latest project information from `specs/001-gated-forum-matching/plan.md`.
- Archived the existing `progress.md` to `progress.md.bak`.
- Cleaned `progress.md` to a new template.
- Appended a summary of the session to `.specify/memory/CHECKPOINTS.md` and `.specify/memory/DECISIONS.md`.

**Completed Tasks**:
- **Fix CORS Domain Configuration**: Corrected CORS configuration to resolve cross-origin request blocking issues.
- **Fix Cloudflare Pages JavaScript MIME Type Issue**: Resolved ES modules loading issue on Cloudflare Pages.
