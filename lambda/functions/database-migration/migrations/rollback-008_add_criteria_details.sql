-- Rollback Migration 008: Remove Detailed Criteria Fields
-- Purpose: Rollback criteria_text and max_score columns if needed
-- Version: v1.5
-- Date: 2026-02-01

-- ========================================
-- Drop GIN index
-- ========================================

DROP INDEX IF EXISTS idx_evaluation_criteria_criteria_text_gin;

-- ========================================
-- Drop columns from evaluation_criteria
-- ========================================

ALTER TABLE evaluation_criteria
  DROP COLUMN IF EXISTS criteria_text,
  DROP COLUMN IF EXISTS max_score;

-- Rollback complete
SELECT 'Rollback 008: Remove Detailed Criteria Fields - COMPLETE' AS status;
