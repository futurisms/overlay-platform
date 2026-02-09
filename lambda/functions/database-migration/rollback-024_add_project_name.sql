-- Rollback: Remove project_name column and index
-- Date: 2026-02-08
-- WARNING: This will delete all project assignments

-- Remove index first
DROP INDEX IF EXISTS idx_review_sessions_project_name;

-- Remove column
ALTER TABLE review_sessions
DROP COLUMN IF EXISTS project_name;

-- Verify removal
DO $$
BEGIN
  -- Check column removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_sessions' AND column_name = 'project_name'
  ) THEN
    RAISE EXCEPTION 'Column project_name still exists after rollback';
  END IF;

  -- Check index removed
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'review_sessions' AND indexname = 'idx_review_sessions_project_name'
  ) THEN
    RAISE EXCEPTION 'Index idx_review_sessions_project_name still exists after rollback';
  END IF;

  RAISE NOTICE 'Rollback 024: project_name column and index removed successfully';
END $$;
