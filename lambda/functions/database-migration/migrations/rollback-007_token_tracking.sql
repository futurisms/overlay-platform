-- Rollback Migration 007: Token Tracking Schema
-- Purpose: Remove all token tracking schema changes
-- Version: v1.7 rollback
-- Date: 2026-01-31

-- ========================================
-- 1. Drop indexes
-- ========================================

DROP INDEX IF EXISTS idx_org_credits_available;

DROP INDEX IF EXISTS idx_ai_token_usage_created;
DROP INDEX IF EXISTS idx_ai_token_usage_agent;
DROP INDEX IF EXISTS idx_ai_token_usage_overlay;
DROP INDEX IF EXISTS idx_ai_token_usage_session;
DROP INDEX IF EXISTS idx_ai_token_usage_org;

DROP INDEX IF EXISTS idx_feedback_reports_model;
DROP INDEX IF EXISTS idx_feedback_reports_tokens;

-- ========================================
-- 2. Drop trigger and function for organization_credits
-- ========================================

DROP TRIGGER IF EXISTS trigger_update_organization_credits_timestamp ON organization_credits;
DROP FUNCTION IF EXISTS update_organization_credits_timestamp();

-- ========================================
-- 3. Drop tables
-- ========================================

DROP TABLE IF EXISTS organization_credits CASCADE;
DROP TABLE IF EXISTS ai_token_usage CASCADE;

-- ========================================
-- 4. Remove columns from feedback_reports
-- ========================================

ALTER TABLE feedback_reports
DROP COLUMN IF EXISTS model_used,
DROP COLUMN IF EXISTS output_tokens,
DROP COLUMN IF EXISTS input_tokens;

-- ========================================
-- 5. Verification queries (comment out for actual rollback)
-- ========================================

-- Verify columns removed from feedback_reports
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'feedback_reports' AND column_name IN ('input_tokens', 'output_tokens', 'model_used');
-- Should return 0 rows

-- Verify tables dropped
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('ai_token_usage', 'organization_credits');
-- Should return 0 rows

-- Verify indexes dropped
-- SELECT indexname FROM pg_indexes
-- WHERE indexname LIKE '%token%' OR indexname LIKE '%credits%';
-- Should return 0 rows

-- Rollback complete
SELECT 'Rollback Migration 007: Token Tracking Schema - COMPLETE' AS status;
