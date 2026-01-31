-- Overlay Platform - Initial Database Schema Migration
-- PostgreSQL 16.6
-- Created: 2026-01-19
-- Description: Creates all tables for the Overlay platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: organizations
-- Description: Stores organization/tenant information
-- =============================================================================
CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    max_users INTEGER DEFAULT 10,
    max_overlays INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT subscription_tier_check CHECK (subscription_tier IN ('free', 'professional', 'enterprise'))
);

CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);

-- =============================================================================
-- TABLE: users
-- Description: User accounts within organizations
-- =============================================================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    preferences JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT users_email_org_unique UNIQUE (email, organization_id)
);

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =============================================================================
-- TABLE: user_roles
-- Description: Maps users to their roles
-- =============================================================================
CREATE TABLE user_roles (
    user_role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(user_id),

    CONSTRAINT role_name_check CHECK (role_name IN ('admin', 'manager', 'reviewer', 'submitter', 'viewer')),
    CONSTRAINT user_role_unique UNIQUE (user_id, role_name)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_name ON user_roles(role_name);

-- =============================================================================
-- TABLE: overlays
-- Description: Overlay configurations for document review
-- =============================================================================
CREATE TABLE overlays (
    overlay_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT overlays_name_org_unique UNIQUE (name, organization_id, version)
);

CREATE INDEX idx_overlays_organization_id ON overlays(organization_id);
CREATE INDEX idx_overlays_document_type ON overlays(document_type);
CREATE INDEX idx_overlays_is_active ON overlays(is_active);
CREATE INDEX idx_overlays_created_by ON overlays(created_by);
CREATE INDEX idx_overlays_configuration_gin ON overlays USING GIN (configuration);

-- =============================================================================
-- TABLE: evaluation_criteria
-- Description: Criteria used for evaluating documents
-- =============================================================================
CREATE TABLE evaluation_criteria (
    criteria_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    overlay_id UUID NOT NULL REFERENCES overlays(overlay_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criterion_type VARCHAR(50) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 1.0,
    is_required BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT criterion_type_check CHECK (criterion_type IN ('text', 'number', 'boolean', 'date', 'choice', 'file', 'ai_analysis')),
    CONSTRAINT weight_check CHECK (weight >= 0 AND weight <= 100)
);

CREATE INDEX idx_evaluation_criteria_overlay_id ON evaluation_criteria(overlay_id);
CREATE INDEX idx_evaluation_criteria_display_order ON evaluation_criteria(overlay_id, display_order);

-- =============================================================================
-- TABLE: user_sessions
-- Description: Active user sessions for authentication
-- =============================================================================
CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- =============================================================================
-- TABLE: document_submissions
-- Description: Documents submitted for review
-- =============================================================================
CREATE TABLE document_submissions (
    submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    overlay_id UUID NOT NULL REFERENCES overlays(overlay_id),
    submitted_by UUID NOT NULL REFERENCES users(user_id),
    document_name VARCHAR(255) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(user_id),
    ai_analysis_status VARCHAR(50) DEFAULT 'pending',
    ai_analysis_completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT submission_status_check CHECK (status IN ('submitted', 'in_review', 'approved', 'rejected', 'needs_revision', 'archived')),
    CONSTRAINT ai_analysis_status_check CHECK (ai_analysis_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'))
);

CREATE INDEX idx_document_submissions_overlay_id ON document_submissions(overlay_id);
CREATE INDEX idx_document_submissions_submitted_by ON document_submissions(submitted_by);
CREATE INDEX idx_document_submissions_status ON document_submissions(status);
CREATE INDEX idx_document_submissions_submitted_at ON document_submissions(submitted_at DESC);
CREATE INDEX idx_document_submissions_reviewed_by ON document_submissions(reviewed_by);
CREATE INDEX idx_document_submissions_s3_key ON document_submissions(s3_key);

-- =============================================================================
-- TABLE: evaluation_responses
-- Description: Responses to evaluation criteria for submissions
-- =============================================================================
CREATE TABLE evaluation_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    criteria_id UUID NOT NULL REFERENCES evaluation_criteria(criteria_id),
    response_value JSONB NOT NULL,
    score DECIMAL(5,2),
    confidence DECIMAL(5,4),
    is_ai_generated BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT evaluation_responses_unique UNIQUE (submission_id, criteria_id)
);

CREATE INDEX idx_evaluation_responses_submission_id ON evaluation_responses(submission_id);
CREATE INDEX idx_evaluation_responses_criteria_id ON evaluation_responses(criteria_id);
CREATE INDEX idx_evaluation_responses_is_ai_generated ON evaluation_responses(is_ai_generated);

-- =============================================================================
-- TABLE: feedback_reports
-- Description: Feedback and reports on document submissions
-- =============================================================================
CREATE TABLE feedback_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(user_id),
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    severity VARCHAR(20),
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(user_id),

    CONSTRAINT report_type_check CHECK (report_type IN ('comment', 'issue', 'suggestion', 'approval', 'rejection')),
    CONSTRAINT severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))
);

CREATE INDEX idx_feedback_reports_submission_id ON feedback_reports(submission_id);
CREATE INDEX idx_feedback_reports_created_by ON feedback_reports(created_by);
CREATE INDEX idx_feedback_reports_status ON feedback_reports(status);
CREATE INDEX idx_feedback_reports_created_at ON feedback_reports(created_at DESC);

-- =============================================================================
-- TABLE: ai_analysis_results
-- Description: Results from AI analysis of documents
-- =============================================================================
CREATE TABLE ai_analysis_results (
    analysis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    analysis_type VARCHAR(50) NOT NULL,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    confidence_score DECIMAL(5,4),
    processing_time_ms INTEGER,
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT analysis_type_check CHECK (analysis_type IN ('document_classification', 'content_extraction', 'quality_assessment', 'compliance_check', 'risk_analysis'))
);

CREATE INDEX idx_ai_analysis_results_submission_id ON ai_analysis_results(submission_id);
CREATE INDEX idx_ai_analysis_results_model_name ON ai_analysis_results(model_name);
CREATE INDEX idx_ai_analysis_results_analysis_type ON ai_analysis_results(analysis_type);
CREATE INDEX idx_ai_analysis_results_created_at ON ai_analysis_results(created_at DESC);

-- =============================================================================
-- TABLE: audit_logs
-- Description: Audit trail of all system activities
-- =============================================================================
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    organization_id UUID REFERENCES organizations(organization_id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================================
-- TABLE: llm_configurations
-- Description: LLM model configurations and parameters
-- =============================================================================
CREATE TABLE llm_configurations (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    rate_limit_per_minute INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT provider_check CHECK (provider IN ('anthropic', 'openai', 'azure', 'aws_bedrock')),
    CONSTRAINT llm_config_name_org_unique UNIQUE (name, organization_id)
);

CREATE INDEX idx_llm_configurations_organization_id ON llm_configurations(organization_id);
CREATE INDEX idx_llm_configurations_is_active ON llm_configurations(is_active);
CREATE INDEX idx_llm_configurations_provider ON llm_configurations(provider);

-- =============================================================================
-- TABLE: document_versions
-- Description: Version history of documents
-- =============================================================================
CREATE TABLE document_versions (
    version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    s3_version_id VARCHAR(255),
    uploaded_by UUID NOT NULL REFERENCES users(user_id),
    upload_reason TEXT,
    changes_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT document_versions_unique UNIQUE (submission_id, version_number)
);

CREATE INDEX idx_document_versions_submission_id ON document_versions(submission_id);
CREATE INDEX idx_document_versions_version_number ON document_versions(submission_id, version_number DESC);

-- =============================================================================
-- TABLE: notifications
-- Description: User notifications and alerts
-- =============================================================================
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    action_url VARCHAR(512),
    related_resource_type VARCHAR(50),
    related_resource_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT notification_type_check CHECK (notification_type IN ('submission', 'review', 'approval', 'rejection', 'comment', 'system', 'alert'))
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_overlays_updated_at BEFORE UPDATE ON overlays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_criteria_updated_at BEFORE UPDATE ON evaluation_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_responses_updated_at BEFORE UPDATE ON evaluation_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_reports_updated_at BEFORE UPDATE ON feedback_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_configurations_updated_at BEFORE UPDATE ON llm_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Active submissions with user and overlay details
CREATE VIEW v_active_submissions AS
SELECT
    ds.submission_id,
    ds.document_name,
    ds.status,
    ds.submitted_at,
    ds.ai_analysis_status,
    u.email as submitted_by_email,
    u.first_name || ' ' || u.last_name as submitted_by_name,
    o.name as overlay_name,
    o.document_type,
    org.name as organization_name
FROM document_submissions ds
JOIN users u ON ds.submitted_by = u.user_id
JOIN overlays o ON ds.overlay_id = o.overlay_id
JOIN organizations org ON o.organization_id = org.organization_id
WHERE ds.status NOT IN ('archived');

-- View: User permissions summary
CREATE VIEW v_user_permissions AS
SELECT
    u.user_id,
    u.email,
    u.username,
    u.organization_id,
    org.name as organization_name,
    array_agg(DISTINCT ur.role_name) as roles,
    u.is_active,
    u.email_verified
FROM users u
JOIN organizations org ON u.organization_id = org.organization_id
LEFT JOIN user_roles ur ON u.user_id = ur.user_id
GROUP BY u.user_id, u.email, u.username, u.organization_id, org.name, u.is_active, u.email_verified;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE organizations IS 'Multi-tenant organization accounts';
COMMENT ON TABLE users IS 'User accounts within organizations';
COMMENT ON TABLE overlays IS 'Document review overlay configurations';
COMMENT ON TABLE document_submissions IS 'Documents submitted for review';
COMMENT ON TABLE ai_analysis_results IS 'AI-powered analysis results for documents';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of system activities';

-- =============================================================================
-- INITIAL SCHEMA COMPLETE
-- =============================================================================

-- Grant permissions (adjust as needed for your environment)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO overlay_admin;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO overlay_admin;
