-- Migration 025: Create document_annotations table
-- Purpose: Stores AI-generated annotated documents that merge original text with evaluation recommendations in sandwich format
-- Date: 2026-02-11
-- Feature: Annotated Document (on-demand, user-triggered)
-- Author: Claude Code

-- Create document_annotations table
CREATE TABLE IF NOT EXISTS document_annotations (
  annotation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
  annotated_json JSONB NOT NULL,
  model_used VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  input_tokens INTEGER,
  output_tokens INTEGER,
  generation_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for looking up annotations by submission (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_document_annotations_submission_id
  ON document_annotations(submission_id);

-- GIN index on the JSONB for potential future querying of annotation content
CREATE INDEX IF NOT EXISTS idx_document_annotations_json
  ON document_annotations USING GIN (annotated_json);

-- Comments for documentation
COMMENT ON TABLE document_annotations IS 'Stores AI-generated annotated documents with recommendations anchored to original text passages';
COMMENT ON COLUMN document_annotations.annotation_id IS 'Unique identifier for the annotation';
COMMENT ON COLUMN document_annotations.submission_id IS 'Links to the document submission that was annotated';
COMMENT ON COLUMN document_annotations.annotated_json IS 'JSON array of sections: text blocks and annotation blocks in sandwich format';
COMMENT ON COLUMN document_annotations.model_used IS 'Claude model used to generate the annotation';
COMMENT ON COLUMN document_annotations.input_tokens IS 'Input tokens consumed for cost tracking';
COMMENT ON COLUMN document_annotations.output_tokens IS 'Output tokens consumed for cost tracking';
COMMENT ON COLUMN document_annotations.generation_time_ms IS 'Time taken to generate the annotation in milliseconds';

-- Verify migration
DO $$
BEGIN
  -- Check table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'document_annotations'
  ) THEN
    RAISE EXCEPTION 'Migration failed: document_annotations table not created';
  END IF;

  -- Check indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'document_annotations' AND indexname = 'idx_document_annotations_submission_id'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_document_annotations_submission_id not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'document_annotations' AND indexname = 'idx_document_annotations_json'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_document_annotations_json not created';
  END IF;

  RAISE NOTICE 'Migration 025 successful: document_annotations table created';
END $$;
