-- Add project_name column to review_sessions
-- Date: 2026-02-08
-- Purpose: Allow grouping sessions into projects/folders for better organization

-- Add column (nullable, no default)
ALTER TABLE review_sessions
ADD COLUMN project_name VARCHAR(100);

-- Add comment
COMMENT ON COLUMN review_sessions.project_name IS 'Optional project/folder name for organizing sessions';

-- Create partial index (only for non-NULL values to improve performance)
CREATE INDEX idx_review_sessions_project_name
ON review_sessions(project_name)
WHERE project_name IS NOT NULL;

-- Verify migration
DO $$
BEGIN
  -- Check column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_sessions' AND column_name = 'project_name'
  ) THEN
    RAISE EXCEPTION 'Column project_name was not created';
  END IF;

  -- Check index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'review_sessions' AND indexname = 'idx_review_sessions_project_name'
  ) THEN
    RAISE EXCEPTION 'Index idx_review_sessions_project_name was not created';
  END IF;

  RAISE NOTICE 'Migration 024: project_name column and index created successfully';
END $$;
