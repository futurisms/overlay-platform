-- Rollback Migration 027: Widen evaluation_criteria columns for DOCX import
-- Reverts criterion_type and name columns to original sizes
-- Author: Claude Code
-- Date: 2026-02-13

BEGIN;

-- Check if any data would be truncated
DO $$
DECLARE
  long_types_count INTEGER;
  long_names_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO long_types_count
  FROM evaluation_criteria
  WHERE LENGTH(criterion_type) > 50;

  SELECT COUNT(*) INTO long_names_count
  FROM evaluation_criteria
  WHERE LENGTH(name) > 255;

  IF long_types_count > 0 THEN
    RAISE EXCEPTION 'Cannot rollback: % criterion types exceed 50 characters', long_types_count;
  END IF;

  IF long_names_count > 0 THEN
    RAISE EXCEPTION 'Cannot rollback: % criterion names exceed 255 characters', long_names_count;
  END IF;
END $$;

-- Revert criterion_type from VARCHAR(255) to VARCHAR(50)
ALTER TABLE evaluation_criteria ALTER COLUMN criterion_type TYPE VARCHAR(50);

-- Revert name from VARCHAR(500) to VARCHAR(255)
ALTER TABLE evaluation_criteria ALTER COLUMN name TYPE VARCHAR(255);

-- Remove migration record
DELETE FROM schema_migrations WHERE migration_name = '027_widen_criteria_columns';

COMMIT;
