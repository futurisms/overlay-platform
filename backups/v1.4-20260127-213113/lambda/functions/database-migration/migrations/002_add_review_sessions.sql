-- Overlay Platform - Review Sessions Migration
-- PostgreSQL 16.6
-- Created: 2026-01-20
-- Description: Adds review sessions, invitations, and clarification tables

-- =============================================================================
-- TABLE: review_sessions
-- Description: Collaborative review sessions for document evaluation
-- =============================================================================
CREATE TABLE review_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    overlay_id UUID NOT NULL REFERENCES overlays(overlay_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    session_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE,
    max_participants INTEGER DEFAULT 10,
    is_public BOOLEAN DEFAULT false,
    allow_anonymous BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT session_type_check CHECK (session_type IN ('standard', 'peer_review', 'expert_review', 'collaborative')),
    CONSTRAINT session_status_check CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived', 'cancelled'))
);

CREATE INDEX idx_review_sessions_organization_id ON review_sessions(organization_id);
CREATE INDEX idx_review_sessions_overlay_id ON review_sessions(overlay_id);
CREATE INDEX idx_review_sessions_status ON review_sessions(status);
CREATE INDEX idx_review_sessions_created_by ON review_sessions(created_by);
CREATE INDEX idx_review_sessions_start_date ON review_sessions(start_date DESC);
CREATE INDEX idx_review_sessions_is_public ON review_sessions(is_public);

-- =============================================================================
-- TABLE: session_participants
-- Description: Users participating in review sessions
-- =============================================================================
CREATE TABLE session_participants (
    participant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'reviewer',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(user_id),
    permissions JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT participant_role_check CHECK (role IN ('owner', 'moderator', 'reviewer', 'observer', 'contributor')),
    CONSTRAINT participant_status_check CHECK (status IN ('invited', 'active', 'inactive', 'removed', 'declined')),
    CONSTRAINT session_user_unique UNIQUE (session_id, user_id)
);

CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX idx_session_participants_status ON session_participants(status);
CREATE INDEX idx_session_participants_role ON session_participants(role);

-- =============================================================================
-- TABLE: session_invitations
-- Description: Invitations to join review sessions
-- =============================================================================
CREATE TABLE session_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(user_id),
    invitee_id UUID NOT NULL REFERENCES users(user_id),
    invitee_email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'reviewer',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT invitation_role_check CHECK (role IN ('moderator', 'reviewer', 'observer', 'contributor')),
    CONSTRAINT invitation_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    CONSTRAINT session_invitee_unique UNIQUE (session_id, invitee_id)
);

CREATE INDEX idx_session_invitations_session_id ON session_invitations(session_id);
CREATE INDEX idx_session_invitations_inviter_id ON session_invitations(inviter_id);
CREATE INDEX idx_session_invitations_invitee_id ON session_invitations(invitee_id);
CREATE INDEX idx_session_invitations_status ON session_invitations(status);
CREATE INDEX idx_session_invitations_invitee_email ON session_invitations(invitee_email);
CREATE INDEX idx_session_invitations_invited_at ON session_invitations(invited_at DESC);

-- =============================================================================
-- TABLE: clarification_questions
-- Description: AI-generated questions for document submissions
-- =============================================================================
CREATE TABLE clarification_questions (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'open_ended',
    context TEXT,
    section_reference VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'medium',
    is_required BOOLEAN DEFAULT false,
    ai_model VARCHAR(100),
    ai_confidence DECIMAL(5,4),
    status VARCHAR(50) DEFAULT 'pending',
    asked_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT question_type_check CHECK (question_type IN ('open_ended', 'yes_no', 'multiple_choice', 'clarification', 'validation')),
    CONSTRAINT question_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT question_status_check CHECK (status IN ('pending', 'answered', 'skipped', 'resolved'))
);

CREATE INDEX idx_clarification_questions_submission_id ON clarification_questions(submission_id);
CREATE INDEX idx_clarification_questions_priority ON clarification_questions(priority);
CREATE INDEX idx_clarification_questions_status ON clarification_questions(status);
CREATE INDEX idx_clarification_questions_asked_by ON clarification_questions(asked_by);
CREATE INDEX idx_clarification_questions_created_at ON clarification_questions(created_at DESC);

-- =============================================================================
-- TABLE: clarification_answers
-- Description: User responses to clarification questions
-- =============================================================================
CREATE TABLE clarification_answers (
    answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES clarification_questions(question_id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    answered_by UUID NOT NULL REFERENCES users(user_id),
    answer_text TEXT NOT NULL,
    is_satisfactory BOOLEAN,
    requires_followup BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(user_id),
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT question_answer_user_unique UNIQUE (question_id, answered_by)
);

CREATE INDEX idx_clarification_answers_question_id ON clarification_answers(question_id);
CREATE INDEX idx_clarification_answers_submission_id ON clarification_answers(submission_id);
CREATE INDEX idx_clarification_answers_answered_by ON clarification_answers(answered_by);
CREATE INDEX idx_clarification_answers_reviewed_by ON clarification_answers(reviewed_by);
CREATE INDEX idx_clarification_answers_answered_at ON clarification_answers(answered_at DESC);

-- =============================================================================
-- TABLE: ai_agent_results
-- Description: Individual AI agent results from document analysis workflow
-- =============================================================================
CREATE TABLE ai_agent_results (
    result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT agent_type_check CHECK (agent_type IN ('structure_validator', 'content_analyzer', 'grammar_checker', 'clarification', 'scoring', 'orchestrator')),
    CONSTRAINT agent_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'timeout'))
);

CREATE INDEX idx_ai_agent_results_submission_id ON ai_agent_results(submission_id);
CREATE INDEX idx_ai_agent_results_agent_name ON ai_agent_results(agent_name);
CREATE INDEX idx_ai_agent_results_agent_type ON ai_agent_results(agent_type);
CREATE INDEX idx_ai_agent_results_status ON ai_agent_results(status);
CREATE INDEX idx_ai_agent_results_completed_at ON ai_agent_results(completed_at DESC);

-- =============================================================================
-- Add session_id column to document_submissions
-- Description: Link submissions to review sessions
-- =============================================================================
ALTER TABLE document_submissions
ADD COLUMN session_id UUID REFERENCES review_sessions(session_id);

CREATE INDEX idx_document_submissions_session_id ON document_submissions(session_id);

-- =============================================================================
-- Update triggers for updated_at columns
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to existing tables
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

-- Apply to new tables
CREATE TRIGGER update_review_sessions_updated_at BEFORE UPDATE ON review_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Indexes for performance optimization
-- =============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_session_participants_session_status ON session_participants(session_id, status);
CREATE INDEX idx_session_invitations_invitee_status ON session_invitations(invitee_id, status);
CREATE INDEX idx_clarification_questions_submission_status ON clarification_questions(submission_id, status);
CREATE INDEX idx_review_sessions_org_status ON review_sessions(organization_id, status);

-- GIN indexes for JSONB columns
CREATE INDEX idx_review_sessions_settings_gin ON review_sessions USING GIN (settings);
CREATE INDEX idx_session_participants_permissions_gin ON session_participants USING GIN (permissions);
CREATE INDEX idx_clarification_questions_metadata_gin ON clarification_questions USING GIN (metadata);
CREATE INDEX idx_clarification_answers_metadata_gin ON clarification_answers USING GIN (metadata);
CREATE INDEX idx_ai_agent_results_result_gin ON ai_agent_results USING GIN (result);
CREATE INDEX idx_ai_agent_results_metadata_gin ON ai_agent_results USING GIN (metadata);
