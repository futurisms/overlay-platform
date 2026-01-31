-- Migration 007: Token Tracking Schema
-- Purpose: Add token usage tracking columns and tables for AI analysis cost monitoring
-- Version: v1.7
-- Date: 2026-01-31

-- ========================================
-- 1. Add token tracking columns to feedback_reports
-- ========================================

ALTER TABLE feedback_reports
ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS model_used VARCHAR(100);

COMMENT ON COLUMN feedback_reports.input_tokens IS 'Number of input tokens sent to Claude API';
COMMENT ON COLUMN feedback_reports.output_tokens IS 'Number of output tokens received from Claude API';
COMMENT ON COLUMN feedback_reports.model_used IS 'Claude model used for analysis (e.g., claude-sonnet-4-5-20250929)';

-- ========================================
-- 2. Create ai_token_usage table (aggregated statistics)
-- ========================================

CREATE TABLE IF NOT EXISTS ai_token_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
  session_id UUID REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  overlay_id UUID REFERENCES overlays(overlay_id) ON DELETE SET NULL,
  agent_name VARCHAR(100) NOT NULL,  -- Dynamic, no CHECK constraint for future custom agents
  total_input_tokens INTEGER DEFAULT 0 NOT NULL,
  total_output_tokens INTEGER DEFAULT 0 NOT NULL,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0.00 NOT NULL,
  analysis_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE ai_token_usage IS 'Aggregated token usage statistics per organization/session/overlay/agent';
COMMENT ON COLUMN ai_token_usage.agent_name IS 'Agent name (dynamic, supports future custom agents)';
COMMENT ON COLUMN ai_token_usage.total_cost_usd IS 'Total cost in USD based on Claude API pricing';
COMMENT ON COLUMN ai_token_usage.analysis_count IS 'Number of analyses performed';

-- ========================================
-- 3. Create organization_credits table
-- ========================================

CREATE TABLE IF NOT EXISTS organization_credits (
  organization_id UUID PRIMARY KEY REFERENCES organizations(organization_id) ON DELETE CASCADE,
  total_credits INTEGER DEFAULT 0 NOT NULL,
  used_credits INTEGER DEFAULT 0 NOT NULL,
  available_credits INTEGER GENERATED ALWAYS AS (total_credits - used_credits) STORED,
  is_unlimited BOOLEAN DEFAULT FALSE NOT NULL,
  last_topup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT check_credits_non_negative CHECK (total_credits >= 0 AND used_credits >= 0),
  CONSTRAINT check_used_not_exceed_total CHECK (used_credits <= total_credits OR is_unlimited = TRUE)
);

COMMENT ON TABLE organization_credits IS 'Credit system for token usage cost management';
COMMENT ON COLUMN organization_credits.total_credits IS 'Total credits purchased (1 credit = $0.01)';
COMMENT ON COLUMN organization_credits.used_credits IS 'Credits consumed by AI analyses';
COMMENT ON COLUMN organization_credits.available_credits IS 'Remaining credits (generated column)';
COMMENT ON COLUMN organization_credits.is_unlimited IS 'If true, credit checks are bypassed (for testing/admin)';

-- ========================================
-- 4. Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_feedback_reports_tokens ON feedback_reports(input_tokens, output_tokens) WHERE input_tokens > 0;
CREATE INDEX IF NOT EXISTS idx_feedback_reports_model ON feedback_reports(model_used);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_org ON ai_token_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_session ON ai_token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_overlay ON ai_token_usage(overlay_id);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_agent ON ai_token_usage(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created ON ai_token_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_credits_available ON organization_credits(available_credits) WHERE is_unlimited = FALSE;

-- ========================================
-- 5. Create trigger for organization_credits updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_organization_credits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_organization_credits_timestamp
  BEFORE UPDATE ON organization_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_credits_timestamp();

-- ========================================
-- 6. Seed initial credits for admin organization
-- ========================================

INSERT INTO organization_credits (organization_id, total_credits, is_unlimited)
SELECT organization_id, 1000000, TRUE
FROM organizations
WHERE name = 'System Admin'
ON CONFLICT (organization_id) DO UPDATE
SET is_unlimited = TRUE, total_credits = 1000000, updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 7. Verification queries (comment out for actual migration)
-- ========================================

-- Verify new columns in feedback_reports
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'feedback_reports' AND column_name IN ('input_tokens', 'output_tokens', 'model_used');

-- Verify ai_token_usage table created
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'ai_token_usage';

-- Verify organization_credits table created
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'organization_credits';

-- Verify admin org has unlimited credits
-- SELECT o.name, oc.is_unlimited, oc.total_credits, oc.available_credits
-- FROM organizations o
-- JOIN organization_credits oc ON o.organization_id = oc.organization_id
-- WHERE o.name = 'System Admin';

-- Migration complete
SELECT 'Migration 007: Token Tracking Schema - COMPLETE' AS status;
