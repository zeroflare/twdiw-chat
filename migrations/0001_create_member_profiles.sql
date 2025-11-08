-- Migration: 0001_create_member_profiles
-- Description: Create member_profiles table with encryption field support and security constraints
-- Security: Parameterized queries only, CHECK constraints for enum validation, indexed for performance

CREATE TABLE IF NOT EXISTS member_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    oidc_subject_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('GENERAL', 'VERIFIED')) DEFAULT 'GENERAL',
    nickname TEXT NOT NULL,
    gender TEXT,  -- Encrypted at rest (application-level encryption)
    interests TEXT,  -- Encrypted at rest (application-level encryption), stored as JSON array
    linked_vc_did TEXT UNIQUE,
    derived_rank TEXT CHECK (derived_rank IS NULL OR derived_rank IN (
        'EARTH_OL_GRADUATE',
        'LIFE_WINNER_S',
        'QUASI_WEALTHY_VIP', 
        'DISTINGUISHED_PETTY',
        'NEWBIE_VILLAGE'
    )),
    version INTEGER NOT NULL DEFAULT 1,  -- Optimistic locking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Security constraints
    CHECK (length(id) > 0),
    CHECK (length(oidc_subject_id) > 0),
    CHECK (length(nickname) > 0 AND length(nickname) <= 100),
    CHECK (version > 0),
    CHECK (created_at > 0),
    CHECK (updated_at > 0),
    CHECK (updated_at >= created_at)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_member_profiles_oidc_subject_id ON member_profiles(oidc_subject_id);
CREATE INDEX IF NOT EXISTS idx_member_profiles_status ON member_profiles(status);
CREATE INDEX IF NOT EXISTS idx_member_profiles_linked_vc_did ON member_profiles(linked_vc_did) WHERE linked_vc_did IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_profiles_derived_rank ON member_profiles(derived_rank) WHERE derived_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_profiles_created_at ON member_profiles(created_at);
