-- Rollback Migration 025: Drop document_annotations table
-- Purpose: Rollback migration 025 - remove document_annotations table and indexes
-- Date: 2026-02-11

-- Drop indexes first (will be dropped with table, but explicit for clarity)
DROP INDEX IF EXISTS idx_document_annotations_submission_id;
DROP INDEX IF EXISTS idx_document_annotations_json;

-- Drop table
DROP TABLE IF EXISTS document_annotations CASCADE;

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'document_annotations'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: document_annotations table still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: document_annotations table removed';
END $$;
