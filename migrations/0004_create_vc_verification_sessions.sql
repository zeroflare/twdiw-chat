-- Migration 0004: Create VC verification sessions table
-- Stores temporary verification sessions for twdiw API integration

CREATE TABLE vc_verification_sessions (
  transaction_id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed', 'expired')),
  qr_code_url TEXT,
  auth_uri TEXT,
  verifiable_credential TEXT, -- JSON string
  extracted_did TEXT,
  extracted_rank TEXT CHECK(extracted_rank IN ('Gold', 'Silver', 'Bronze')),
  error TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  
  -- Constraints
  CHECK(expires_at > created_at),
  CHECK(completed_at IS NULL OR completed_at >= created_at),
  
  -- Foreign key reference (enforced at application level)
  FOREIGN KEY (member_id) REFERENCES member_profiles(id)
);

-- Indexes for efficient queries
CREATE INDEX idx_vc_sessions_member ON vc_verification_sessions(member_id);
CREATE INDEX idx_vc_sessions_status ON vc_verification_sessions(status);
CREATE INDEX idx_vc_sessions_expires ON vc_verification_sessions(expires_at);
CREATE INDEX idx_vc_sessions_created ON vc_verification_sessions(created_at);

-- Composite index for cleanup queries
CREATE INDEX idx_vc_sessions_cleanup ON vc_verification_sessions(expires_at, status);
