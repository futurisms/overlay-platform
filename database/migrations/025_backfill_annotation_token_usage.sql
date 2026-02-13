-- Backfill annotation token usage into token_usage table
-- This ensures existing annotations show up in the admin dashboard

INSERT INTO token_usage (
  submission_id,
  agent_name,
  input_tokens,
  output_tokens,
  model_name,
  created_at
)
SELECT
  submission_id,
  'annotate-document' as agent_name,
  input_tokens,
  output_tokens,
  model_used as model_name,
  created_at
FROM document_annotations
WHERE generation_status = 'completed'
  AND input_tokens IS NOT NULL
  AND output_tokens IS NOT NULL
  -- Only insert if not already tracked (avoid duplicates)
  AND NOT EXISTS (
    SELECT 1 FROM token_usage tu
    WHERE tu.submission_id = document_annotations.submission_id
      AND tu.agent_name = 'annotate-document'
  );
