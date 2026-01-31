-- Check if token-related columns exist in any tables
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name ILIKE '%token%'
   OR column_name ILIKE '%cost%'
ORDER BY table_name, ordinal_position;

-- Check feedback_reports table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feedback_reports'
ORDER BY ordinal_position;

-- Check ai_analysis_results table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_analysis_results'
ORDER BY ordinal_position;

-- Get a recent submission with completed analysis
SELECT
  s.submission_id,
  s.document_name,
  s.ai_analysis_status,
  s.submitted_at
FROM document_submissions s
WHERE s.ai_analysis_status = 'completed'
ORDER BY s.submitted_at DESC
LIMIT 3;

-- Check if ai_analysis_results table has any data
SELECT COUNT(*) as total_analysis_records
FROM ai_analysis_results;

-- Check feedback_reports for a completed submission (use submission_id from above)
-- SELECT report_type, created_at FROM feedback_reports
-- WHERE submission_id = '[replace-with-id]'
-- ORDER BY report_type;
