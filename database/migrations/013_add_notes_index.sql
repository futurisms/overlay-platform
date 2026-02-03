-- Migration 013: Add indexes for notes filtering
-- Purpose: Performance optimization for role-based notes filtering
-- Date: February 3, 2026

BEGIN;

-- Add index for filtering notes by creator (analysts see only own notes)
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id
  ON user_notes(user_id);

-- Add composite index for common query pattern (session + creator)
CREATE INDEX IF NOT EXISTS idx_user_notes_session_user
  ON user_notes(session_id, user_id);

-- Add index for date-based filtering
CREATE INDEX IF NOT EXISTS idx_user_notes_created_at
  ON user_notes(created_at DESC);

-- Comments
COMMENT ON INDEX idx_user_notes_user_id IS 'Filter notes by creator (for analyst role)';
COMMENT ON INDEX idx_user_notes_session_user IS 'Optimized for fetching analyst notes per session';

-- Verify indexes were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_notes_user_id'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_user_notes_user_id not created';
  END IF;

  RAISE NOTICE 'Migration 013 successful: notes indexes created';
END $$;

COMMIT;
