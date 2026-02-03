-- Migration 014: Add is_active column to review_sessions
-- Purpose: Track active vs archived sessions for permission filtering
-- Date: February 3, 2026
-- Hotfix for Phase 2A

BEGIN;

-- Add is_active column (default true for existing sessions)
ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Add index for filtering active sessions
CREATE INDEX IF NOT EXISTS idx_review_sessions_is_active
  ON review_sessions(is_active);

-- Add comment
COMMENT ON COLUMN review_sessions.is_active IS 'Track if session is active (true) or archived (false)';

-- Verify column was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_sessions' AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION 'Migration failed: is_active column not created';
  END IF;

  RAISE NOTICE 'Migration 014 successful: is_active column added to review_sessions';
END $$;

COMMIT;
