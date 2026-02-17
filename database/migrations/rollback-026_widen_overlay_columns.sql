-- Rollback Migration 026: Widen overlay columns for DOCX import
-- Reverts document_type and name columns to original sizes
-- Author: Claude Code
-- Date: 2026-02-13

BEGIN;

-- Check if any data would be truncated
DO $$
DECLARE
  long_names_count INTEGER;
  long_types_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO long_names_count
  FROM overlays
  WHERE LENGTH(name) > 255;

  SELECT COUNT(*) INTO long_types_count
  FROM overlays
  WHERE LENGTH(document_type) > 100;

  IF long_names_count > 0 THEN
    RAISE EXCEPTION 'Cannot rollback: % overlay names exceed 255 characters', long_names_count;
  END IF;

  IF long_types_count > 0 THEN
    RAISE EXCEPTION 'Cannot rollback: % document types exceed 100 characters', long_types_count;
  END IF;
END $$;

-- Revert document_type from VARCHAR(500) to VARCHAR(100)
ALTER TABLE overlays ALTER COLUMN document_type TYPE VARCHAR(100);

-- Revert name from VARCHAR(500) to VARCHAR(255)
ALTER TABLE overlays ALTER COLUMN name TYPE VARCHAR(255);

-- Remove migration record
DELETE FROM schema_migrations WHERE migration_name = '026_widen_overlay_columns';

COMMIT;
