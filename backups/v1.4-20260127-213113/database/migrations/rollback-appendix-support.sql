-- Rollback: Remove Multi-Document Upload Support (v1.4)
-- Date: January 27, 2026
-- Purpose: Revert appendix_files column addition if needed

-- Drop index first
DROP INDEX IF EXISTS idx_submissions_appendix_files;

-- Remove appendix_files column
ALTER TABLE document_submissions
DROP COLUMN IF EXISTS appendix_files;

-- Verify rollback
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_submissions'
    AND column_name = 'appendix_files'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: appendix_files column still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: appendix_files column removed from document_submissions';
END $$;
