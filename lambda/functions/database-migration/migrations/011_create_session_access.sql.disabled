-- Migration 011: Create session_access table
-- Purpose: Control which analysts can access which sessions
-- Date: February 3, 2026

BEGIN;

CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(user_id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate access grants
  CONSTRAINT session_user_unique UNIQUE(user_id, session_id)
);

-- Indexes for performance
CREATE INDEX idx_session_access_user ON session_access(user_id);
CREATE INDEX idx_session_access_session ON session_access(session_id);
CREATE INDEX idx_session_access_granted_by ON session_access(granted_by);

-- Comments
COMMENT ON TABLE session_access IS 'Controls which analysts can access which sessions';
COMMENT ON COLUMN session_access.user_id IS 'Analyst who has access';
COMMENT ON COLUMN session_access.session_id IS 'Session they can access';
COMMENT ON COLUMN session_access.granted_by IS 'Admin who granted access';

-- Verify table was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'session_access'
  ) THEN
    RAISE EXCEPTION 'Migration failed: session_access table not created';
  END IF;

  RAISE NOTICE 'Migration 011 successful: session_access table created';
END $$;

COMMIT;
