-- Overlay Platform - Seed Data Migration
-- PostgreSQL 16.6
-- Created: 2026-01-19
-- Description: Insert initial data for the Overlay platform

-- =============================================================================
-- SEED: Default Organization
-- =============================================================================

INSERT INTO organizations (organization_id, name, domain, subscription_tier, max_users, max_overlays, is_active, settings)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Overlay Demo Organization', 'demo.overlay.com', 'enterprise', 100, 50, true,
     '{"features": ["ai_analysis", "advanced_reporting", "api_access"], "theme": "default"}'::jsonb);

-- =============================================================================
-- SEED: Default Users
-- =============================================================================

-- Password for all demo users is 'Password123!' (hashed with bcrypt)
-- In production, users would register with their own passwords
INSERT INTO users (user_id, organization_id, email, username, password_hash, first_name, last_name, is_active, email_verified, preferences)
VALUES
    -- Admin user
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
     'admin@overlay.com', 'admin',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gU.5rH.aJZ0a',
     'Admin', 'User', true, true,
     '{"notifications": {"email": true, "in_app": true}, "theme": "dark"}'::jsonb),

    -- Manager user
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
     'manager@overlay.com', 'manager',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gU.5rH.aJZ0a',
     'Manager', 'User', true, true,
     '{"notifications": {"email": true, "in_app": true}}'::jsonb),

    -- Reviewer user
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'reviewer@overlay.com', 'reviewer',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gU.5rH.aJZ0a',
     'Reviewer', 'User', true, true,
     '{"notifications": {"email": true, "in_app": false}}'::jsonb),

    -- Submitter user
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
     'submitter@overlay.com', 'submitter',
     '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gU.5rH.aJZ0a',
     'Submitter', 'User', true, true,
     '{"notifications": {"email": false, "in_app": true}}'::jsonb);

-- =============================================================================
-- SEED: User Roles
-- =============================================================================

INSERT INTO user_roles (user_id, role_name, granted_by)
VALUES
    -- Admin has all roles
    ('10000000-0000-0000-0000-000000000001', 'admin', NULL),
    ('10000000-0000-0000-0000-000000000001', 'manager', NULL),
    ('10000000-0000-0000-0000-000000000001', 'reviewer', NULL),
    ('10000000-0000-0000-0000-000000000001', 'submitter', NULL),

    -- Manager role
    ('10000000-0000-0000-0000-000000000002', 'manager', '10000000-0000-0000-0000-000000000001'),
    ('10000000-0000-0000-0000-000000000002', 'reviewer', '10000000-0000-0000-0000-000000000001'),

    -- Reviewer role
    ('10000000-0000-0000-0000-000000000003', 'reviewer', '10000000-0000-0000-0000-000000000001'),

    -- Submitter role
    ('10000000-0000-0000-0000-000000000004', 'submitter', '10000000-0000-0000-0000-000000000001');

-- =============================================================================
-- SEED: Default Overlays (Document Review Templates)
-- =============================================================================

INSERT INTO overlays (overlay_id, organization_id, name, description, document_type, version, is_active, is_template, created_by, configuration)
VALUES
    -- Contract Review Overlay
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
     'Contract Review - Standard',
     'Standard contract review overlay for legal agreements, NDAs, and vendor contracts',
     'contract', '1.0.0', true, true, '10000000-0000-0000-0000-000000000001',
     '{"sections": ["parties", "terms", "obligations", "termination", "liability"], "auto_extract": true, "ai_enabled": true}'::jsonb),

    -- Financial Document Review
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
     'Financial Statement Review',
     'Review overlay for financial statements, budgets, and expense reports',
     'financial', '1.0.0', true, true, '10000000-0000-0000-0000-000000000001',
     '{"sections": ["revenue", "expenses", "assets", "liabilities"], "calculation_validation": true, "ai_enabled": true}'::jsonb),

    -- Compliance Document Review
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'Compliance Document Review',
     'Review overlay for compliance documents, regulatory filings, and audit reports',
     'compliance', '1.0.0', true, true, '10000000-0000-0000-0000-000000000001',
     '{"sections": ["requirements", "evidence", "findings", "remediation"], "compliance_checks": true, "ai_enabled": true}'::jsonb),

    -- General Document Review
    ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
     'General Document Review',
     'Generic document review overlay for miscellaneous documents',
     'general', '1.0.0', true, true, '10000000-0000-0000-0000-000000000001',
     '{"sections": ["summary", "details", "attachments"], "ai_enabled": true}'::jsonb);

-- =============================================================================
-- SEED: Evaluation Criteria
-- =============================================================================

-- Contract Review Criteria
INSERT INTO evaluation_criteria (overlay_id, name, description, criterion_type, weight, is_required, display_order, validation_rules)
VALUES
    -- Contract overlay criteria
    ('20000000-0000-0000-0000-000000000001', 'Party Identification', 'Verify all parties are correctly identified', 'boolean', 10.0, true, 1,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000001', 'Effective Date', 'Contract effective date', 'date', 5.0, true, 2,
     '{"required": true, "future_dates_allowed": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000001', 'Contract Value', 'Total contract value in USD', 'number', 15.0, true, 3,
     '{"min": 0, "max": 10000000, "currency": "USD"}'::jsonb),
    ('20000000-0000-0000-0000-000000000001', 'Terms Clarity', 'Are contract terms clear and unambiguous?', 'choice', 20.0, true, 4,
     '{"options": ["Excellent", "Good", "Fair", "Poor", "Unclear"]}'::jsonb),
    ('20000000-0000-0000-0000-000000000001', 'Risk Assessment', 'Overall risk level', 'choice', 25.0, true, 5,
     '{"options": ["Low", "Medium", "High", "Critical"]}'::jsonb),
    ('20000000-0000-0000-0000-000000000001', 'AI Contract Analysis', 'Automated contract analysis', 'ai_analysis', 15.0, false, 6,
     '{"model": "claude-3-5-sonnet", "analysis_type": "contract_review"}'::jsonb),
    ('20000000-0000-0000-0000-000000000001', 'Reviewer Comments', 'Additional comments or concerns', 'text', 10.0, false, 7,
     '{"max_length": 2000}'::jsonb),

    -- Financial Statement Criteria
    ('20000000-0000-0000-0000-000000000002', 'Statement Period', 'Reporting period covered', 'text', 5.0, true, 1,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', 'Revenue Accuracy', 'Revenue figures verified', 'boolean', 25.0, true, 2,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', 'Expense Accuracy', 'Expense figures verified', 'boolean', 25.0, true, 3,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', 'Balance Sheet Check', 'Assets = Liabilities + Equity', 'boolean', 20.0, true, 4,
     '{"required": true, "formula": "assets == liabilities + equity"}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', 'AI Financial Analysis', 'Automated financial analysis', 'ai_analysis', 15.0, false, 5,
     '{"model": "claude-3-5-sonnet", "analysis_type": "financial_review"}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', 'Auditor Notes', 'Auditor observations', 'text', 10.0, false, 6,
     '{"max_length": 2000}'::jsonb),

    -- Compliance Document Criteria
    ('20000000-0000-0000-0000-000000000003', 'Regulation Reference', 'Applicable regulation or standard', 'text', 10.0, true, 1,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000003', 'Compliance Status', 'Overall compliance status', 'choice', 30.0, true, 2,
     '{"options": ["Compliant", "Partially Compliant", "Non-Compliant", "Not Applicable"]}'::jsonb),
    ('20000000-0000-0000-0000-000000000003', 'Evidence Provided', 'Supporting evidence attached', 'boolean', 15.0, true, 3,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000003', 'Findings Count', 'Number of findings identified', 'number', 15.0, true, 4,
     '{"min": 0, "max": 100}'::jsonb),
    ('20000000-0000-0000-0000-000000000003', 'AI Compliance Check', 'Automated compliance verification', 'ai_analysis', 20.0, false, 5,
     '{"model": "claude-3-5-sonnet", "analysis_type": "compliance_check"}'::jsonb),
    ('20000000-0000-0000-0000-000000000003', 'Remediation Plan', 'Required remediation actions', 'text', 10.0, false, 6,
     '{"max_length": 2000}'::jsonb),

    -- General Document Criteria
    ('20000000-0000-0000-0000-000000000004', 'Document Summary', 'Brief summary of document', 'text', 20.0, true, 1,
     '{"required": true, "max_length": 500}'::jsonb),
    ('20000000-0000-0000-0000-000000000004', 'Document Quality', 'Overall document quality', 'choice', 30.0, true, 2,
     '{"options": ["Excellent", "Good", "Acceptable", "Poor", "Unacceptable"]}'::jsonb),
    ('20000000-0000-0000-0000-000000000004', 'Completeness', 'Is the document complete?', 'boolean', 25.0, true, 3,
     '{"required": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000004', 'AI Document Analysis', 'General document analysis', 'ai_analysis', 15.0, false, 4,
     '{"model": "claude-3-5-sonnet", "analysis_type": "document_analysis"}'::jsonb),
    ('20000000-0000-0000-0000-000000000004', 'Additional Notes', 'Any additional observations', 'text', 10.0, false, 5,
     '{"max_length": 1000}'::jsonb);

-- =============================================================================
-- SEED: LLM Configurations
-- =============================================================================

INSERT INTO llm_configurations (organization_id, name, provider, model_name, model_version, is_active, is_default, parameters, rate_limit_per_minute)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Claude 3.5 Sonnet - Default',
     'anthropic', 'claude-3-5-sonnet-20241022', '3.5', true, true,
     '{"max_tokens": 4096, "temperature": 0.7, "top_p": 0.9, "system_prompt": "You are an expert document reviewer."}'::jsonb,
     60),

    ('00000000-0000-0000-0000-000000000001', 'Claude 3 Opus - Advanced',
     'anthropic', 'claude-3-opus-20240229', '3.0', true, false,
     '{"max_tokens": 4096, "temperature": 0.5, "top_p": 0.95, "system_prompt": "You are an expert document reviewer with advanced analytical capabilities."}'::jsonb,
     30),

    ('00000000-0000-0000-0000-000000000001', 'Claude 3 Haiku - Fast',
     'anthropic', 'claude-3-haiku-20240307', '3.0', true, false,
     '{"max_tokens": 2048, "temperature": 0.7, "top_p": 0.9, "system_prompt": "You are a quick document reviewer."}'::jsonb,
     120);

-- =============================================================================
-- SEED: Sample Document Submissions (for testing)
-- =============================================================================

INSERT INTO document_submissions (submission_id, overlay_id, submitted_by, document_name, s3_key, s3_bucket, file_size, content_type, status, submitted_at, ai_analysis_status, metadata)
VALUES
    ('30000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000004',
     'vendor-agreement-2026.pdf',
     'submissions/2026/01/vendor-agreement-2026.pdf',
     'overlay-docs-975050116849',
     245680,
     'application/pdf',
     'in_review',
     CURRENT_TIMESTAMP - INTERVAL '2 hours',
     'completed',
     '{"original_filename": "vendor-agreement-2026.pdf", "pages": 12}'::jsonb),

    ('30000000-0000-0000-0000-000000000002',
     '20000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000004',
     'q4-2025-financial-statement.xlsx',
     'submissions/2026/01/q4-2025-financial-statement.xlsx',
     'overlay-docs-975050116849',
     89320,
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'submitted',
     CURRENT_TIMESTAMP - INTERVAL '1 hour',
     'pending',
     '{"original_filename": "q4-2025-financial-statement.xlsx", "sheets": 4}'::jsonb);

-- =============================================================================
-- SEED: Sample AI Analysis Results
-- =============================================================================

INSERT INTO ai_analysis_results (submission_id, model_name, model_version, analysis_type, findings, recommendations, confidence_score, processing_time_ms, token_count, metadata)
VALUES
    ('30000000-0000-0000-0000-000000000001',
     'claude-3-5-sonnet-20241022', '3.5', 'contract_review',
     '[
       {"category": "parties", "finding": "All parties clearly identified", "severity": "info"},
       {"category": "terms", "finding": "Payment terms are standard 30 days", "severity": "info"},
       {"category": "risk", "finding": "Unlimited liability clause detected", "severity": "high"},
       {"category": "termination", "finding": "No early termination provision", "severity": "medium"}
     ]'::jsonb,
     '[
       {"priority": "high", "recommendation": "Review and negotiate liability cap"},
       {"priority": "medium", "recommendation": "Add early termination clause with 30-day notice"},
       {"priority": "low", "recommendation": "Consider adding force majeure clause"}
     ]'::jsonb,
     0.8750,
     2340,
     1850,
     '{"analysis_date": "2026-01-19", "reviewer_model": "claude-3-5-sonnet"}'::jsonb);

-- =============================================================================
-- SEED: Sample Notifications
-- =============================================================================

INSERT INTO notifications (user_id, notification_type, title, message, is_read, action_url, related_resource_type, related_resource_id)
VALUES
    ('10000000-0000-0000-0000-000000000003',
     'submission',
     'New Document Submitted for Review',
     'A new vendor agreement has been submitted and requires your review.',
     false,
     '/submissions/30000000-0000-0000-0000-000000000001',
     'document_submission',
     '30000000-0000-0000-0000-000000000001'),

    ('10000000-0000-0000-0000-000000000004',
     'system',
     'Welcome to Overlay Platform',
     'Your account has been created successfully. Start by submitting your first document!',
     false,
     '/dashboard',
     NULL,
     NULL);

-- =============================================================================
-- SEED DATA COMPLETE
-- =============================================================================

-- Verify seed data
SELECT 'Organizations: ' || COUNT(*)::TEXT FROM organizations;
SELECT 'Users: ' || COUNT(*)::TEXT FROM users;
SELECT 'User Roles: ' || COUNT(*)::TEXT FROM user_roles;
SELECT 'Overlays: ' || COUNT(*)::TEXT FROM overlays;
SELECT 'Evaluation Criteria: ' || COUNT(*)::TEXT FROM evaluation_criteria;
SELECT 'LLM Configurations: ' || COUNT(*)::TEXT FROM llm_configurations;
SELECT 'Sample Submissions: ' || COUNT(*)::TEXT FROM document_submissions;
SELECT 'AI Analysis Results: ' || COUNT(*)::TEXT FROM ai_analysis_results;
SELECT 'Notifications: ' || COUNT(*)::TEXT FROM notifications;
