-- Migration: 0002_create_forums
-- Description: Create forums table with rank-based access control
-- Security: CHECK constraints for rank validation, unique tlk channel IDs

CREATE TABLE IF NOT EXISTS forums (
    id TEXT PRIMARY KEY NOT NULL,
    required_rank TEXT NOT NULL CHECK (required_rank IN (
        'EARTH_OL_GRADUATE',
        'LIFE_WINNER_S', 
        'QUASI_WEALTHY_VIP',
        'DISTINGUISHED_PETTY',
        'NEWBIE_VILLAGE'
    )),
    description TEXT,
    tlk_channel_id TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    member_count INTEGER NOT NULL DEFAULT 0,
    creator_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')) DEFAULT 'ACTIVE',
    version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Security constraints
    CHECK (length(id) > 0),
    CHECK (length(tlk_channel_id) > 0),
    CHECK (length(creator_id) > 0),
    CHECK (capacity > 0),
    CHECK (member_count >= 0),
    CHECK (member_count <= capacity),
    CHECK (version > 0),
    CHECK (created_at > 0),
    CHECK (updated_at > 0),
    CHECK (updated_at >= created_at),
    CHECK (description IS NULL OR length(description) <= 500)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_forums_required_rank ON forums(required_rank);
CREATE INDEX IF NOT EXISTS idx_forums_tlk_channel_id ON forums(tlk_channel_id);
CREATE INDEX IF NOT EXISTS idx_forums_status ON forums(status);
CREATE INDEX IF NOT EXISTS idx_forums_creator_id ON forums(creator_id);
CREATE INDEX IF NOT EXISTS idx_forums_created_at ON forums(created_at);

-- Composite index for finding accessible forums
CREATE INDEX IF NOT EXISTS idx_forums_status_rank ON forums(status, required_rank);
