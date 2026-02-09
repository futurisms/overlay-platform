@echo off
REM Create user_invitations table via Lambda migration
REM This script invokes the migration Lambda with the SQL to create the missing table

echo Creating user_invitations table via Lambda...

aws lambda invoke ^
  --function-name overlay-database-migration ^
  --payload "{\"migrationSQL\": \"CREATE TABLE IF NOT EXISTS user_invitations (invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), email VARCHAR(255) NOT NULL, session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE, invited_by UUID NOT NULL REFERENCES users(user_id), token VARCHAR(255) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ, accepted_by UUID REFERENCES users(user_id), created_at TIMESTAMPTZ DEFAULT NOW(), CONSTRAINT email_session_unique UNIQUE(email, session_id)); CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email); CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token); CREATE INDEX IF NOT EXISTS idx_invitations_session ON user_invitations(session_id); CREATE INDEX IF NOT EXISTS idx_invitations_expires ON user_invitations(expires_at); CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON user_invitations(invited_by);\"}" ^
  --cli-binary-format raw-in-base64-out ^
  response.json

echo.
echo Response saved to response.json
type response.json
echo.
echo Done. Check response.json for results.
