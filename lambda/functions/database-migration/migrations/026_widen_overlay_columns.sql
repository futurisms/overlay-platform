-- Migration 026: Widen overlay columns for DOCX import
-- Widens document_type and name columns to handle longer imported values
-- Author: Claude Code
-- Date: 2026-02-13

BEGIN;

-- Drop dependent view first
DROP VIEW IF EXISTS v_active_submissions;

-- Widen document_type from VARCHAR(100) to VARCHAR(500)
-- Allows for longer document type descriptions from imported DOCX files
ALTER TABLE overlays ALTER COLUMN document_type TYPE VARCHAR(500);

-- Widen name from VARCHAR(255) to VARCHAR(500)
-- Allows for longer overlay names from imported DOCX files
ALTER TABLE overlays ALTER COLUMN name TYPE VARCHAR(500);

-- Recreate the view with the same definition
CREATE OR REPLACE VIEW v_active_submissions AS
SELECT
    ds.submission_id,
    ds.document_name,
    ds.status,
    ds.submitted_at,
    ds.ai_analysis_status,
    u.email AS submitted_by_email,
    (u.first_name || ' ' || u.last_name) AS submitted_by_name,
    o.name AS overlay_name,
    o.document_type,
    org.name AS organization_name
FROM document_submissions ds
JOIN users u ON ds.submitted_by = u.user_id
JOIN overlays o ON ds.overlay_id = o.overlay_id
JOIN organizations org ON o.organization_id = org.organization_id
WHERE ds.status <> 'archived';

-- Record migration
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('026_widen_overlay_columns', CURRENT_TIMESTAMP)
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
