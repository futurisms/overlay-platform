-- Create user_invitations table ONLY
-- This is a minimal script to fix the missing table
-- Run via: aws lambda invoke with payload

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

-- Verify table was created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_invitations'
ORDER BY ordinal_position;
