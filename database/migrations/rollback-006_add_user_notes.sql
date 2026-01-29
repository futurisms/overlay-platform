-- Rollback Migration: Remove User Notes Table
-- Purpose: Rollback user notes functionality
-- Date: January 29, 2026

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_user_notes_updated_at ON user_notes;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_user_notes_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_user_notes_session_id;
DROP INDEX IF EXISTS idx_user_notes_created_at;
DROP INDEX IF EXISTS idx_user_notes_user_id;

-- Drop table (CASCADE will remove foreign key constraints)
DROP TABLE IF EXISTS user_notes CASCADE;

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_notes'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: user_notes table still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: user_notes table removed';
END $$;
