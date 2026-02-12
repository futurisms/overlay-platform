-- Migration: Add generation status tracking for annotations
-- This allows frontend to poll for status during long-running annotation generation

-- Add generation_status column to document_annotations
ALTER TABLE document_annotations
ADD COLUMN generation_status VARCHAR(20) DEFAULT 'completed' CHECK (generation_status IN ('generating', 'completed', 'failed'));

-- Update existing annotations to 'completed' status
UPDATE document_annotations SET generation_status = 'completed';

-- Add index for status queries
CREATE INDEX idx_document_annotations_status ON document_annotations(submission_id, generation_status);

-- Add updated_at trigger if not exists (for status updates)
CREATE OR REPLACE FUNCTION update_annotation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_document_annotations_updated_at ON document_annotations;
CREATE TRIGGER update_document_annotations_updated_at
  BEFORE UPDATE ON document_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_annotation_updated_at();
