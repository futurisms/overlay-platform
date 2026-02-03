-- Migration 010: Add user_role to users table
-- Purpose: Support admin vs analyst roles
-- Date: February 3, 2026

BEGIN;

-- Add user_role column (defaults to 'admin' for existing users)
ALTER TABLE users
  ADD COLUMN user_role VARCHAR(50) DEFAULT 'admin';

-- Add constraint to ensure only valid roles
ALTER TABLE users
  ADD CONSTRAINT valid_user_role
  CHECK (user_role IN ('admin', 'analyst'));

-- Add index for role filtering
CREATE INDEX idx_users_role ON users(user_role);

-- Add comment
COMMENT ON COLUMN users.user_role IS 'User role: admin (full access) or analyst (session-based access)';

-- Verify column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_role'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_role column not created';
  END IF;

  RAISE NOTICE 'Migration 010 successful: user_role column added';
END $$;

COMMIT;
