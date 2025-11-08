# Data Model

This document defines the data models for the key entities in the "三人行必有我師論壇" feature. The models are designed for storage in a relational database (Cloudflare D1).

## 1. MemberProfile

Represents a registered user in the platform.

| Field | Type | Description | Constraints / Rules |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | Unique identifier for the member (UUID). | Primary Key, Not Null |
| `oidcSubjectId` | `TEXT` | The `sub` claim from the OIDC provider. Used as the primary external identifier. | Not Null, Unique |
| `status` | `TEXT` | The member's verification status. | Not Null, Enum: `GENERAL`, `VERIFIED` |
| `nickname` | `TEXT` | User's self-declared display name. | Not Null |
| `gender` | `TEXT` | User's self-declared gender. Encrypted at rest. | |
| `interests` | `TEXT` | User's self-declared interests (e.g., JSON array). Encrypted at rest. | |
| `linkedVcDid` | `TEXT` | The DID (Decentralized Identifier) from the verified "Rank Card" VC. | Unique |
| `derivedRank` | `TEXT` | The rank derived from the verified VC (e.g., "Gold", "Silver"). | |
| `createdAt` | `INTEGER` | Timestamp of when the member was created. | Not Null, Unix Timestamp |
| `updatedAt` | `INTEGER` | Timestamp of when the member was last updated. | Not Null, Unix Timestamp |

### State Transitions
- A `MemberProfile` is created with `status: 'GENERAL'`.
- After a successful "Rank Card" VC verification, the `status` transitions to `VERIFIED`, and `linkedVcDid` and `derivedRank` are populated.

## 2. Forum

Represents a gated group forum that requires a specific rank to access.

| Field | Type | Description | Constraints / Rules |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | Unique identifier for the forum (UUID). | Primary Key, Not Null |
| `requiredRank` | `TEXT` | The rank required to access this forum. | Not Null |
| `description` | `TEXT` | A brief description of the forum. | |
| `tlkChannelId` | `TEXT` | The channel ID for the corresponding `tlk.io` chat room. | Not Null, Unique |
| `createdAt` | `INTEGER` | Timestamp of when the forum was created. | Not Null, Unix Timestamp |

## 3. PrivateChatSession

Represents a private chat session, either from a daily match or a group-initiated invitation.

| Field | Type | Description | Constraints / Rules |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | Unique identifier for the session (UUID). | Primary Key, Not Null |
| `memberAId` | `TEXT` | The ID of the first member in the session. | Not Null, Foreign Key -> MemberProfile(id) |
| `memberBId` | `TEXT` | The ID of the second member in the session. | Not Null, Foreign Key -> MemberProfile(id) |
| `tlkChannelId` | `TEXT` | The channel ID for the corresponding private `tlk.io` chat room. | Not Null, Unique |
| `type` | `TEXT` | The type of session. | Not Null, Enum: `DAILY_MATCH`, `GROUP_INITIATED` |
| `createdAt` | `INTEGER` | Timestamp of when the session was created. | Not Null, Unix Timestamp |
| `expiresAt` | `INTEGER` | Timestamp of when the session expires. | Not Null, Unix Timestamp |

### Lifecycle
- A `PrivateChatSession` is created when two members are matched.
- The session is considered active until its `expiresAt` timestamp.
- A background process or on-access check should be implemented to terminate and clean up expired sessions.

## 4. Relationships

- A **MemberProfile** can have one `derivedRank`.
- A **Forum** has one `requiredRank`. Many **MemberProfile**s can access a single **Forum**, provided they have the `requiredRank`.
- A **PrivateChatSession** involves exactly two **MemberProfile**s.

*Note: `Forum Post` from the spec is omitted from the core data model as the chat functionality is handled by the external `tlk.io` service, which will manage its own post/message data.*
