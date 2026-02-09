-- Migration 016: Create missing tables (simplified, no verification)
-- Purpose: Create session_access and user_invitations tables
-- Date: February 5, 2026

-- Drop tables if they exist (to start fresh)
DROP TABLE IF EXISTS session_access CASCADE;
DROP TABLE IF EXISTS user_invitations CASCADE;

-- Create session_access table
CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(user_id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT session_user_unique UNIQUE(user_id, session_id)
);

CREATE INDEX idx_session_access_user ON session_access(user_id);
CREATE INDEX idx_session_access_session ON session_access(session_id);
CREATE INDEX idx_session_access_granted_by ON session_access(granted_by);

-- Create user_invitations table
CREATE TABLE user_invitations (
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

CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_token ON user_invitations(token);
CREATE INDEX idx_invitations_session ON user_invitations(session_id);
CREATE INDEX idx_invitations_expires ON user_invitations(expires_at);
CREATE INDEX idx_invitations_invited_by ON user_invitations(invited_by);
