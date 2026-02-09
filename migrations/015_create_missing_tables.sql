-- Migration 015: Create missing tables (session_access and user_invitations)
-- Purpose: Manually create tables that failed in migrations 011 and 012
-- Date: February 5, 2026

-- Create session_access table (migration 011 failed)
CREATE TABLE IF NOT EXISTS session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(user_id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT session_user_unique UNIQUE(user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_access_user ON session_access(user_id);
CREATE INDEX IF NOT EXISTS idx_session_access_session ON session_access(session_id);
CREATE INDEX IF NOT EXISTS idx_session_access_granted_by ON session_access(granted_by);

COMMENT ON TABLE session_access IS 'Controls which analysts can access which sessions';

-- Create user_invitations table (migration 012 failed)
CREATE TABLE IF NOT EXISTS user_invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(user_id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_session_unique UNIQUE(email, session_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_session ON user_invitations(session_id);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON user_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON user_invitations(invited_by);

COMMENT ON TABLE user_invitations IS 'Token-based invitation system for analyst onboarding';

-- Verify tables were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'session_access'
  ) THEN
    RAISE EXCEPTION 'Migration failed: session_access table not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_invitations'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_invitations table not created';
  END IF;

  RAISE NOTICE 'Migration 015 successful: session_access and user_invitations tables created';
END $$;
