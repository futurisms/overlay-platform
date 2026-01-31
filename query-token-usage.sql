-- Query token usage for submission
SELECT
  report_type,
  input_tokens,
  output_tokens,
  (input_tokens + output_tokens) as total_tokens,
  ROUND((input_tokens * 0.003 / 1000 + output_tokens * 0.015 / 1000)::numeric, 4) as cost_usd,
  model_used,
  created_at
FROM feedback_reports
WHERE submission_id = '848a047d-5c17-4b83-b1e2-d40555c70fc2'
ORDER BY created_at;
