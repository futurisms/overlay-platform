-- Migration 027: Widen evaluation_criteria columns for DOCX import
-- Widens criterion_type and name columns to handle longer imported values
-- Author: Claude Code
-- Date: 2026-02-13

BEGIN;

-- Widen criterion_type from VARCHAR(50) to VARCHAR(255)
-- This was causing "value too long" errors on import
ALTER TABLE evaluation_criteria ALTER COLUMN criterion_type TYPE VARCHAR(255);

-- Widen name from VARCHAR(255) to VARCHAR(500)
-- Allows for longer criterion titles from imported DOCX files
ALTER TABLE evaluation_criteria ALTER COLUMN name TYPE VARCHAR(500);

-- Record migration
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('027_widen_criteria_columns', CURRENT_TIMESTAMP)
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
