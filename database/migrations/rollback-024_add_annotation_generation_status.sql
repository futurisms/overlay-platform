-- Rollback: Remove generation status tracking

-- Drop trigger
DROP TRIGGER IF EXISTS update_document_annotations_updated_at ON document_annotations;
DROP FUNCTION IF EXISTS update_annotation_updated_at();

-- Drop index
DROP INDEX IF EXISTS idx_document_annotations_status;

-- Drop column
ALTER TABLE document_annotations DROP COLUMN IF EXISTS generation_status;
