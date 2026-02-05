-- Migration 017: Create user_invitations table (clean version)
-- Purpose: Create invitation system for analyst onboarding
-- Date: February 5, 2026
-- Note: This replaces failed migrations 011 and 012

-- Create user_invitations table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_session ON user_invitations(session_id);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON user_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON user_invitations(invited_by);

-- Add comment
COMMENT ON TABLE user_invitations IS 'Token-based invitation system for analyst onboarding';

-- Verify table was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_invitations'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_invitations table not created';
  END IF;

  RAISE NOTICE 'Migration 017 successful: user_invitations table created';
END $$;
