-- Migration: Add Token Usage Tracking Table
-- Purpose: Track Claude API token usage per AI agent invocation
-- Date: February 3, 2026

CREATE TABLE IF NOT EXISTS token_usage (
  token_usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
  agent_name VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  model_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and analytics queries
CREATE INDEX IF NOT EXISTS idx_token_usage_submission_id ON token_usage(submission_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_name ON token_usage(agent_name);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_total_tokens ON token_usage(total_tokens);

-- Composite index for common analytics queries (tokens by agent over time)
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_date ON token_usage(agent_name, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE token_usage IS 'Claude API token usage tracking per AI agent invocation';
COMMENT ON COLUMN token_usage.submission_id IS 'Document submission this token usage belongs to';
COMMENT ON COLUMN token_usage.agent_name IS 'AI agent name (orchestrator, scoring, content-analyzer, etc.)';
COMMENT ON COLUMN token_usage.input_tokens IS 'Number of input tokens consumed';
COMMENT ON COLUMN token_usage.output_tokens IS 'Number of output tokens generated';
COMMENT ON COLUMN token_usage.total_tokens IS 'Total tokens (input + output) - computed column';
COMMENT ON COLUMN token_usage.model_name IS 'Claude model used (e.g., claude-sonnet-4-20250514)';
COMMENT ON COLUMN token_usage.created_at IS 'Timestamp when tokens were consumed';

-- Create view for easy aggregation queries
CREATE OR REPLACE VIEW v_token_usage_summary AS
SELECT
  submission_id,
  COUNT(*) as agent_calls,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  ARRAY_AGG(DISTINCT agent_name ORDER BY agent_name) as agents_used,
  MAX(created_at) as last_agent_call
FROM token_usage
GROUP BY submission_id;

COMMENT ON VIEW v_token_usage_summary IS 'Aggregated token usage per submission';

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'token_usage'
  ) THEN
    RAISE EXCEPTION 'Migration failed: token_usage table not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'v_token_usage_summary'
  ) THEN
    RAISE EXCEPTION 'Migration failed: v_token_usage_summary view not created';
  END IF;

  RAISE NOTICE 'Migration successful: token_usage table and view created';
END $$;
