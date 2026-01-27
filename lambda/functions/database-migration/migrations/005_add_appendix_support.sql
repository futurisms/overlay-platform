-- Migration: Add Multi-Document Upload Support (v1.4)
-- Date: January 27, 2026
-- Purpose: Enable uploading main document + multiple PDF appendices

-- Add appendix_files column to store appendix metadata
ALTER TABLE document_submissions
ADD COLUMN IF NOT EXISTS appendix_files JSONB DEFAULT '[]';

-- Add comment to explain structure
COMMENT ON COLUMN document_submissions.appendix_files IS
'Array of appendix file metadata: [{file_name, s3_key, file_size, upload_order}]. Example: [{"file_name": "gantt-chart.pdf", "s3_key": "submissions/abc-123/appendix-1.pdf", "file_size": 125000, "upload_order": 1}]';

-- Create index for efficient JSONB queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_submissions_appendix_files
ON document_submissions USING GIN (appendix_files);

-- Verify migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_submissions'
    AND column_name = 'appendix_files'
  ) THEN
    RAISE EXCEPTION 'Migration failed: appendix_files column not created';
  END IF;

  RAISE NOTICE 'Migration successful: appendix_files column added to document_submissions';
END $$;
