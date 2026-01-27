-- Migration 004: Add context fields to overlays table
-- Purpose: Provide AI agents with document context for better evaluation

-- Add document context fields to overlays table
ALTER TABLE overlays
ADD COLUMN IF NOT EXISTS document_purpose TEXT,
ADD COLUMN IF NOT EXISTS when_used TEXT,
ADD COLUMN IF NOT EXISTS process_context TEXT,
ADD COLUMN IF NOT EXISTS target_audience VARCHAR(255);

-- Add comments to explain field purposes
COMMENT ON COLUMN overlays.document_purpose IS 'What is the document meant to achieve? (e.g., "Legal contract to establish terms", "Proposal to secure funding")';
COMMENT ON COLUMN overlays.when_used IS 'When should this evaluation template be used? (e.g., "Pre-signature review", "Initial submission screening")';
COMMENT ON COLUMN overlays.process_context IS 'What process is this document part of? (e.g., "Procurement process", "Grant application workflow")';
COMMENT ON COLUMN overlays.target_audience IS 'Who is the intended audience? (e.g., "Legal team", "Executive leadership", "External auditors")';

-- Update existing overlays with sample context
UPDATE overlays
SET
    document_purpose = CASE
        WHEN name LIKE '%Contract%' THEN 'Legal agreement establishing terms, obligations, and conditions between parties'
        WHEN name LIKE '%Proposal%' THEN 'Formal document to secure approval, funding, or partnership'
        WHEN name LIKE '%Report%' THEN 'Analytical document to inform decision-making with data and recommendations'
        ELSE 'Business document requiring structured evaluation'
    END,
    when_used = CASE
        WHEN name LIKE '%Contract%' THEN 'Pre-signature review and compliance verification'
        WHEN name LIKE '%Proposal%' THEN 'Initial submission screening before detailed review'
        WHEN name LIKE '%Report%' THEN 'Quality assurance before stakeholder distribution'
        ELSE 'Document intake and initial assessment'
    END,
    process_context = CASE
        WHEN name LIKE '%Contract%' THEN 'Legal review and approval workflow'
        WHEN name LIKE '%Proposal%' THEN 'Competitive evaluation and selection process'
        WHEN name LIKE '%Report%' THEN 'Internal reporting and governance process'
        ELSE 'Document management and quality control process'
    END,
    target_audience = CASE
        WHEN name LIKE '%Contract%' THEN 'Legal team, executives, compliance officers'
        WHEN name LIKE '%Proposal%' THEN 'Evaluation committee, decision-makers'
        WHEN name LIKE '%Report%' THEN 'Executive leadership, board members'
        ELSE 'Internal stakeholders and reviewers'
    END
WHERE document_purpose IS NULL;

-- Verification query
SELECT
    overlay_id,
    name,
    document_purpose,
    when_used,
    process_context,
    target_audience
FROM overlays
LIMIT 5;
