-- Migration: 0003_create_private_chat_sessions
-- Description: Create private_chat_sessions table with expiry tracking and foreign key constraints
-- Security: Foreign key validation, CHECK constraints for session types, expiry enforcement

CREATE TABLE IF NOT EXISTS private_chat_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    member_a_id TEXT NOT NULL,
    member_b_id TEXT NOT NULL,
    tlk_channel_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('DAILY_MATCH', 'GROUP_INITIATED')),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'TERMINATED')) DEFAULT 'ACTIVE',
    version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,

    -- Foreign key constraints (enforced at application level for D1 compatibility)
    -- member_a_id references member_profiles(id)
    -- member_b_id references member_profiles(id)

    -- Security constraints
    CHECK (length(id) > 0),
    CHECK (length(member_a_id) > 0),
    CHECK (length(member_b_id) > 0),
    CHECK (length(tlk_channel_id) > 0),
    CHECK (member_a_id != member_b_id),  -- Prevent self-chat sessions
    CHECK (version > 0),
    CHECK (created_at > 0),
    CHECK (updated_at > 0),
    CHECK (expires_at > 0),
    CHECK (updated_at >= created_at),
    CHECK (expires_at > created_at)  -- Expiry must be after creation
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_member_a_id ON private_chat_sessions(member_a_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_member_b_id ON private_chat_sessions(member_b_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_tlk_channel_id ON private_chat_sessions(tlk_channel_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_type ON private_chat_sessions(type);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_status ON private_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_expires_at ON private_chat_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_created_at ON private_chat_sessions(created_at);

-- Composite index for finding sessions by member pairs
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_member_pair ON private_chat_sessions(member_a_id, member_b_id);

-- Composite indexes for status-based queries
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_status_member_a ON private_chat_sessions(status, member_a_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_status_member_b ON private_chat_sessions(status, member_b_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_sessions_status_expires ON private_chat_sessions(status, expires_at);
