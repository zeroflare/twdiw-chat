-- Migration: 0005_create_matching_queue
-- Description: Create matching_queue table for daily matching between 地球OL財富畢業證書持有者 and 人生勝利組S級玩家
-- Security: Foreign key validation, CHECK constraints for rank validation, expiry enforcement
-- Purpose: Enable 1-on-1 matching queue system for rank-based pairing
-- Updated: Use English enum values to match code implementation

CREATE TABLE IF NOT EXISTS matching_queue (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL,
    rank TEXT NOT NULL CHECK (rank IN (
        'EARTH_OL_GRADUATE',
        'LIFE_WINNER_S', 
        'QUASI_WEALTHY_VIP',
        'DISTINGUISHED_PETTY',
        'NEWBIE_VILLAGE'
    )),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'MATCHED', 'EXPIRED', 'CANCELLED')) DEFAULT 'PENDING',
    matched_with_id TEXT,  -- NULL until matched, references member_id of matched partner
    version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,

    -- Security constraints (secure-by-default)
    -- Ensure all text fields are non-empty strings
    CHECK (length(id) > 0),
    CHECK (length(member_id) > 0),
    CHECK (version > 0),
    CHECK (created_at > 0),
    CHECK (updated_at > 0),
    CHECK (expires_at > 0),
    CHECK (updated_at >= created_at),
    CHECK (expires_at > created_at),  -- Queue entries must have future expiration

    -- Business logic constraints
    CHECK (matched_with_id IS NULL OR length(matched_with_id) > 0),
    CHECK (matched_with_id IS NULL OR matched_with_id != member_id),  -- Prevent self-matching
    CHECK (
        (status = 'MATCHED' AND matched_with_id IS NOT NULL) OR
        (status IN ('PENDING', 'EXPIRED', 'CANCELLED') AND matched_with_id IS NULL)
    )  -- Status and matched_with_id relationship
);

-- Single-column indexes for frequent queries
CREATE INDEX idx_matching_queue_member_id ON matching_queue(member_id);
CREATE INDEX idx_matching_queue_rank ON matching_queue(rank);
CREATE INDEX idx_matching_queue_status ON matching_queue(status);
CREATE INDEX idx_matching_queue_expires_at ON matching_queue(expires_at);
CREATE INDEX idx_matching_queue_created_at ON matching_queue(created_at);
CREATE INDEX idx_matching_queue_matched_with_id ON matching_queue(matched_with_id);

-- Composite indexes for matching operations
CREATE INDEX idx_matching_queue_status_rank ON matching_queue(status, rank);
CREATE INDEX idx_matching_queue_status_expires ON matching_queue(status, expires_at);
CREATE INDEX idx_matching_queue_rank_status_created ON matching_queue(rank, status, created_at);
CREATE INDEX idx_matching_queue_member_status ON matching_queue(member_id, status);

-- Partial index for PENDING matches (FIFO optimization)
CREATE INDEX idx_matching_queue_pending_rank_created ON matching_queue(status, rank, created_at)
    WHERE status = 'PENDING';
