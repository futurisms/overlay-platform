-- Rollback Migration: Remove Token Usage Tracking
-- Purpose: Rollback migration 007 - drop token_usage table and view
-- Date: February 3, 2026

-- Drop view first (depends on table)
DROP VIEW IF EXISTS v_token_usage_summary;

-- Drop indexes (will be dropped with table, but explicit for clarity)
DROP INDEX IF EXISTS idx_token_usage_submission_id;
DROP INDEX IF EXISTS idx_token_usage_agent_name;
DROP INDEX IF EXISTS idx_token_usage_created_at;
DROP INDEX IF EXISTS idx_token_usage_total_tokens;
DROP INDEX IF EXISTS idx_token_usage_agent_date;

-- Drop table
DROP TABLE IF EXISTS token_usage;

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'token_usage'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: token_usage table still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'v_token_usage_summary'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: v_token_usage_summary view still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: token_usage table and view removed';
END $$;
