# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-11

### Added
- Debug endpoints for VC verification cache management
- Comprehensive logging for VC verification flow
- Intelligent caching mechanism with TTL and API call limits
- Support for null DID values in domain entities

### Fixed
- VC verification frontend/backend status synchronization
- Polling mechanism stops correctly after verification completion
- API response format matching between frontend and backend
- User status update logic in completed verification state
- DID handling logic aligned with Taiwan Wallet VP API specification

### Changed
- Removed DID extraction from VP response (not provided by official API)
- Updated frontend display to show name and email instead of DID
- Optimized polling intervals (10s TTL, 3s API calls)
- Enhanced error handling in verification flow

### Technical
- Modified `verifyWithRankCard` to accept null DID parameter
- Updated `VCVerificationService` to remove DID extraction attempts
- Fixed status matching logic in API endpoints
- Improved cache management for verification results

## [1.0.0] - 2025-11-10

### Added
- Complete VC verification system with Taiwan Wallet integration
- Forum access control based on rank verification
- Daily matching system for peer-to-peer chat
- OIDC authentication with TWDIW SSO
- Real-time chat integration with tlk.io
- Encrypted PII storage using AES-256-GCM
- Cloudflare Workers single-point deployment
- Domain-Driven Design architecture
- Comprehensive test suite

### Security
- JWT-based session management
- Rate limiting for API endpoints
- CORS protection
- Optimistic locking for data consistency
- Secure cookie handling with HttpOnly and SameSite attributes

### Infrastructure
- Cloudflare D1 database with migrations
- Cloudflare KV for session storage
- Cron triggers for automated cleanup
- Assets serving for SPA routing
- Environment-based configuration management
