-- Migration 012: Create user_invitations table
-- Purpose: Token-based invitation system for analysts
-- Date: February 3, 2026

BEGIN;

CREATE TABLE user_invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Invitation details
  email VARCHAR(255) NOT NULL,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(user_id),

  -- Token for secure signup link
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Status tracking
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(user_id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate invitations for same email+session
  CONSTRAINT email_session_unique UNIQUE(email, session_id)
);

-- Indexes for performance
CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_token ON user_invitations(token);
CREATE INDEX idx_invitations_session ON user_invitations(session_id);
CREATE INDEX idx_invitations_expires ON user_invitations(expires_at);
CREATE INDEX idx_invitations_invited_by ON user_invitations(invited_by);

-- Comments
COMMENT ON TABLE user_invitations IS 'Token-based invitation system for analyst onboarding';
COMMENT ON COLUMN user_invitations.token IS 'URL-safe random token (32 bytes base64url)';
COMMENT ON COLUMN user_invitations.expires_at IS 'Invitation expires after 7 days';
COMMENT ON COLUMN user_invitations.accepted_at IS 'When invitation was accepted (NULL if pending)';

-- Verify table was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_invitations'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_invitations table not created';
  END IF;

  RAISE NOTICE 'Migration 012 successful: user_invitations table created';
END $$;

COMMIT;
