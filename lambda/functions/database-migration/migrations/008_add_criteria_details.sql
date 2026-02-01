-- Migration 008: Add Detailed Criteria Fields
-- Purpose: Support Edit Criteria feature with detailed rubric text and max scores
-- Version: v1.5
-- Date: 2026-02-01

-- ========================================
-- Add criteria_text and max_score columns to evaluation_criteria
-- ========================================

ALTER TABLE evaluation_criteria
  ADD COLUMN IF NOT EXISTS criteria_text TEXT,
  ADD COLUMN IF NOT EXISTS max_score DECIMAL(10,2);

COMMENT ON COLUMN evaluation_criteria.criteria_text IS 'Detailed rubric text for this criterion - used by AI agents for evaluation';
COMMENT ON COLUMN evaluation_criteria.max_score IS 'Maximum score for this criterion (overrides weight if specified)';

-- ========================================
-- Create GIN index for full-text search on criteria_text
-- ========================================

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_criteria_text_gin
ON evaluation_criteria USING gin(to_tsvector('english', COALESCE(criteria_text, '')));

COMMENT ON INDEX idx_evaluation_criteria_criteria_text_gin IS 'Full-text search index for criteria text';

-- ========================================
-- Set default max_score values based on existing weight
-- ========================================

UPDATE evaluation_criteria
SET max_score = weight
WHERE max_score IS NULL;

-- ========================================
-- Verification query
-- ========================================

-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'evaluation_criteria'
-- AND column_name IN ('criteria_text', 'max_score')
-- ORDER BY column_name;

-- Migration complete
SELECT 'Migration 008: Add Detailed Criteria Fields - COMPLETE' AS status;
