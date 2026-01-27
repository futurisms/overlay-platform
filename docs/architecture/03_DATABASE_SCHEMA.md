# Database Schema Documentation

**Overlay Platform - PostgreSQL 16.6**
**Last Updated**: January 26, 2026
**Schema Version**: v1.1

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Core Tables](#core-tables)
4. [Review Session Tables](#review-session-tables)
5. [Clarification & AI Tables](#clarification--ai-tables)
6. [Supporting Tables](#supporting-tables)
7. [Critical Architecture Decisions](#critical-architecture-decisions)
8. [Indexes & Performance](#indexes--performance)
9. [JSONB Columns](#jsonb-columns)
10. [Lessons Learned](#lessons-learned)

---

## Schema Overview

The Overlay Platform database consists of **19 tables** organized into functional groups:

### Table Groups:
- **Multi-tenancy** (2 tables): organizations, users
- **Evaluation System** (3 tables): overlays, evaluation_criteria, evaluation_responses
- **Document Management** (3 tables): document_submissions, document_versions, feedback_reports
- **Review Sessions** (4 tables): review_sessions, session_participants, session_invitations, clarification_questions/answers
- **AI Analysis** (2 tables): ai_agent_results, ai_analysis_results
- **Supporting** (5 tables): user_roles, user_sessions, llm_configurations, notifications, audit_logs

### Database Extensions:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Cryptographic functions
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OVERLAY PLATFORM SCHEMA                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ organizations    │
│──────────────────│
│ organization_id◆ │──┐
│ name             │  │
│ domain           │  │
│ subscription_tier│  │
│ max_users        │  │
│ is_active        │  │
└──────────────────┘  │
                      │
                      │  ┌──────────────────┐
                      ├──│ users            │
                      │  │──────────────────│
                      │  │ user_id◆         │──┐
                      │  │ organization_id● │  │
                      │  │ email            │  │
                      │  │ username         │  │
                      │  │ is_active        │  │
                      │  └──────────────────┘  │
                      │                        │
                      │  ┌──────────────────┐  │
                      ├──│ overlays         │  │
                      │  │──────────────────│  │
                      │  │ overlay_id◆      │──┼───┐
                      │  │ organization_id● │  │   │
                      │  │ name             │  │   │
                      │  │ document_type    │  │   │
                      │  │ document_purpose │  │   │  (v1.1 context fields)
                      │  │ when_used        │  │   │
                      │  │ process_context  │  │   │
                      │  │ target_audience  │  │   │
                      │  └──────────────────┘  │   │
                      │                        │   │
                      │  ┌──────────────────┐  │   │
                      └──│ llm_configs      │  │   │
                         │──────────────────│  │   │
                         │ config_id◆       │  │   │
                         │ organization_id● │  │   │
                         │ provider         │  │   │
                         │ model_name       │  │   │
                         └──────────────────┘  │   │
                                               │   │
┌──────────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────┐                       │
├──│ evaluation_criteria  │                       │
│  │──────────────────────│                       │
│  │ criteria_id◆         │──┐                    │  ⚠️ NOTE: Column is "criteria_id"
│  │ overlay_id●          │  │                    │     NOT "criterion_id" (v1.1 fix)
│  │ name                 │  │                    │
│  │ description          │  │                    │
│  │ criterion_type       │  │                    │
│  │ weight (0.0-100.0)   │  │                    │
│  │ display_order        │  │                    │
│  └──────────────────────┘  │                    │
│                            │                    │
│  ┌──────────────────────┐  │                    │
├──│ review_sessions      │  │                    │
│  │──────────────────────│  │                    │
│  │ session_id◆          │──┼───┐                │
│  │ organization_id●     │  │   │                │
│  │ overlay_id●          │  │   │                │
│  │ name                 │  │   │                │
│  │ status               │  │   │                │
│  │ max_participants     │  │   │                │
│  └──────────────────────┘  │   │                │
│                            │   │                │
│  ┌──────────────────────┐  │   │                │
└──│ session_participants │  │   │                │
   │──────────────────────│  │   │                │
   │ participant_id◆      │  │   │                │
   │ session_id●          │  │   │                │
   │ user_id●             │  │   │                │
   │ role                 │  │   │                │
   │ status               │  │   │                │
   └──────────────────────┘  │   │                │
                             │   │                │
   ┌──────────────────────┐  │   │                │
   │ document_submissions │  │   │                │
   │──────────────────────│  │   │                │
   │ submission_id◆       │──┼───┼────────────────┤
   │ overlay_id●          │  │   │                │
   │ session_id●          │  │   │                │
   │ submitted_by●        │  │   │                │
   │ document_name        │  │   │                │
   │ s3_key               │  │   │                │
   │ s3_bucket            │  │   │                │
   │ status               │  │   │                │
   │ ai_analysis_status   │  │   │                │
   └──────────────────────┘  │   │                │
            │                │   │                │
            │                │   │                │
   ┌────────┼────────────────┘   │                │
   │        │                    │                │
   ▼        ▼                    ▼                ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ evaluation_responses│  │ feedback_reports │  │ clarification_questions│
│─────────────────────│  │──────────────────│  │──────────────────────│
│ response_id◆        │  │ report_id◆       │  │ question_id◆         │
│ submission_id●      │  │ submission_id●   │  │ submission_id●       │
│ criteria_id●        │  │ created_by●      │  │ question_text        │
│ response_value(JSON)│  │ report_type      │  │ priority             │
│ score (0.00-99.99)  │  │ content (TEXT)   │  │ status               │
│ is_ai_generated     │  │ severity         │  └──────────────────────┘
└─────────────────────┘  │ status           │            │
                         └──────────────────┘            │
                                  │                      ▼
                                  │         ┌──────────────────────┐
                                  │         │ clarification_answers│
                     ⚠️ CRITICAL: │         │──────────────────────│
                     AI scoring   │         │ answer_id◆           │
                     agent saves  │         │ question_id●         │
                     to THIS      │         │ submission_id●       │
                     table with   │         │ answered_by●         │
                     report_type  │         │ answer_text          │
                     = 'comment'  │         └──────────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ ai_agent_results │  ⚠️ NOT used for feedback
                         │──────────────────│     (stores individual
                         │ result_id◆       │      agent results only)
                         │ submission_id●   │
                         │ agent_name       │
                         │ agent_type       │
                         │ status           │
                         │ result (JSONB)   │
                         └──────────────────┘

Legend:
  ◆ = Primary Key
  ● = Foreign Key
  (JSONB) = JSONB column for flexible data
  (TEXT) = Large text field
```

---

## Core Tables

### organizations

**Purpose**: Multi-tenant organization accounts. Each organization has isolated data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| organization_id | UUID | PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Organization name |
| domain | VARCHAR(255) | UNIQUE | Email domain (e.g., "acme.com") |
| subscription_tier | VARCHAR(50) | NOT NULL, CHECK | 'free', 'professional', 'enterprise' |
| max_users | INTEGER | DEFAULT 10 | Maximum allowed users |
| max_overlays | INTEGER | DEFAULT 5 | Maximum allowed overlays |
| is_active | BOOLEAN | DEFAULT true | Organization status |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |
| settings | JSONB | DEFAULT {} | Flexible settings storage |

**Indexes**:
- `idx_organizations_domain` (domain)
- `idx_organizations_is_active` (is_active)

**Relationships**:
- One organization → Many users
- One organization → Many overlays
- One organization → Many review_sessions

---

### users

**Purpose**: User accounts within organizations. Authentication via AWS Cognito.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | UUID | PRIMARY KEY | Unique identifier |
| organization_id | UUID | FK, NOT NULL | Parent organization |
| email | VARCHAR(255) | NOT NULL | User email (unique per org) |
| username | VARCHAR(100) | NOT NULL | Display username |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password (unused if Cognito) |
| first_name | VARCHAR(100) | | User first name |
| last_name | VARCHAR(100) | | User last name |
| is_active | BOOLEAN | DEFAULT true | Account status |
| email_verified | BOOLEAN | DEFAULT false | Email verification status |
| last_login_at | TIMESTAMPTZ | | Last login timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |
| preferences | JSONB | DEFAULT {} | User preferences |

**Unique Constraint**: `users_email_org_unique (email, organization_id)`

**Indexes**:
- `idx_users_organization_id` (organization_id)
- `idx_users_email` (email)
- `idx_users_username` (username)
- `idx_users_is_active` (is_active)

**Relationships**:
- Many users → One organization
- One user → Many submissions
- One user → Many session participations

---

### user_roles

**Purpose**: Role-based access control for users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_role_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK, NOT NULL | User reference |
| role_name | VARCHAR(50) | NOT NULL, CHECK | 'admin', 'manager', 'reviewer', 'submitter', 'viewer' |
| granted_at | TIMESTAMPTZ | DEFAULT NOW | When role was granted |
| granted_by | UUID | FK (users) | Who granted the role |

**Unique Constraint**: `user_role_unique (user_id, role_name)`

**Indexes**:
- `idx_user_roles_user_id` (user_id)
- `idx_user_roles_role_name` (role_name)

---

### overlays

**Purpose**: Evaluation template configurations for document review.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| overlay_id | UUID | PRIMARY KEY | Unique identifier |
| organization_id | UUID | FK, NOT NULL | Parent organization |
| name | VARCHAR(255) | NOT NULL | Overlay name |
| description | TEXT | | Overlay description |
| document_type | VARCHAR(100) | NOT NULL | Document type (pdf, docx, etc.) |
| version | VARCHAR(20) | DEFAULT '1.0.0' | Version number |
| is_active | BOOLEAN | DEFAULT true | Overlay status |
| is_template | BOOLEAN | DEFAULT false | Is this a reusable template? |
| created_by | UUID | FK (users) | Creator user |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |
| configuration | JSONB | NOT NULL, DEFAULT {} | Flexible configuration |
| **document_purpose** | **TEXT** | | **What is the document meant to achieve?** (v1.1) |
| **when_used** | **TEXT** | | **When should this template be used?** (v1.1) |
| **process_context** | **TEXT** | | **What process is this part of?** (v1.1) |
| **target_audience** | **VARCHAR(255)** | | **Who is the intended audience?** (v1.1) |

**Unique Constraint**: `overlays_name_org_unique (name, organization_id, version)`

**Indexes**:
- `idx_overlays_organization_id` (organization_id)
- `idx_overlays_document_type` (document_type)
- `idx_overlays_is_active` (is_active)
- `idx_overlays_created_by` (created_by)
- `idx_overlays_configuration_gin` USING GIN (configuration)

**Context Fields (Added v1.1)**:
These fields provide AI agents with contextual understanding of the document for more accurate evaluation:
- `document_purpose`: "Legal agreement establishing terms between parties"
- `when_used`: "Pre-signature review and compliance verification"
- `process_context`: "Legal review and approval workflow"
- `target_audience`: "Legal team, executives, compliance officers"

**Relationships**:
- Many overlays → One organization
- One overlay → Many evaluation_criteria
- One overlay → Many review_sessions
- One overlay → Many document_submissions

---

### evaluation_criteria

**Purpose**: Individual evaluation criteria within overlays.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **criteria_id** | UUID | PRIMARY KEY | Unique identifier ⚠️ |
| overlay_id | UUID | FK, NOT NULL | Parent overlay |
| name | VARCHAR(255) | NOT NULL | Criterion name |
| description | TEXT | | Criterion description |
| criterion_type | VARCHAR(50) | NOT NULL, CHECK | 'text', 'number', 'boolean', 'date', 'choice', 'file', 'ai_analysis' |
| weight | DECIMAL(5,2) | DEFAULT 1.0, CHECK | Weight (0.0-100.0) |
| is_required | BOOLEAN | DEFAULT true | Is this criterion required? |
| display_order | INTEGER | DEFAULT 0 | Display order in UI |
| validation_rules | JSONB | DEFAULT {} | Validation rules |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |

⚠️ **CRITICAL NAMING**: Column is `criteria_id` (plural), NOT `criterion_id` (singular). See [Lessons Learned](#lessons-learned).

**Indexes**:
- `idx_evaluation_criteria_overlay_id` (overlay_id)
- `idx_evaluation_criteria_display_order` (overlay_id, display_order)

**Relationships**:
- Many criteria → One overlay
- One criterion → Many evaluation_responses

---

## Review Session Tables

### review_sessions

**Purpose**: Collaborative review sessions for document evaluation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| session_id | UUID | PRIMARY KEY | Unique identifier |
| organization_id | UUID | FK, NOT NULL | Parent organization |
| overlay_id | UUID | FK, NOT NULL | Evaluation overlay to use |
| name | VARCHAR(255) | NOT NULL | Session name |
| description | TEXT | | Session description |
| session_type | VARCHAR(50) | NOT NULL, DEFAULT 'standard', CHECK | 'standard', 'peer_review', 'expert_review', 'collaborative' |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active', CHECK | 'draft', 'active', 'paused', 'completed', 'archived', 'cancelled' |
| start_date | TIMESTAMPTZ | DEFAULT NOW | Session start date |
| end_date | TIMESTAMPTZ | | Session end date |
| max_participants | INTEGER | DEFAULT 10 | Maximum participants |
| is_public | BOOLEAN | DEFAULT false | Is session publicly accessible? |
| allow_anonymous | BOOLEAN | DEFAULT false | Allow anonymous submissions? |
| created_by | UUID | FK (users), NOT NULL | Creator user |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |
| settings | JSONB | DEFAULT {} | Flexible settings |

**Indexes**:
- `idx_review_sessions_organization_id` (organization_id)
- `idx_review_sessions_overlay_id` (overlay_id)
- `idx_review_sessions_status` (status)
- `idx_review_sessions_created_by` (created_by)
- `idx_review_sessions_start_date` (start_date DESC)
- `idx_review_sessions_is_public` (is_public)
- `idx_review_sessions_org_status` (organization_id, status)
- `idx_review_sessions_settings_gin` USING GIN (settings)

**Relationships**:
- Many sessions → One organization
- Many sessions → One overlay
- One session → Many participants
- One session → Many submissions

---

### session_participants

**Purpose**: Users participating in review sessions with assigned roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| participant_id | UUID | PRIMARY KEY | Unique identifier |
| session_id | UUID | FK, NOT NULL | Review session |
| user_id | UUID | FK, NOT NULL | Participant user |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'reviewer', CHECK | 'owner', 'moderator', 'reviewer', 'observer', 'contributor' |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active', CHECK | 'invited', 'active', 'inactive', 'removed', 'declined' |
| joined_at | TIMESTAMPTZ | DEFAULT NOW | When user joined |
| last_activity_at | TIMESTAMPTZ | DEFAULT NOW | Last activity timestamp |
| invited_by | UUID | FK (users) | Who invited this user |
| permissions | JSONB | DEFAULT {} | Custom permissions |

**Unique Constraint**: `session_user_unique (session_id, user_id)`

**Indexes**:
- `idx_session_participants_session_id` (session_id)
- `idx_session_participants_user_id` (user_id)
- `idx_session_participants_status` (status)
- `idx_session_participants_role` (role)
- `idx_session_participants_session_status` (session_id, status)
- `idx_session_participants_permissions_gin` USING GIN (permissions)

---

### session_invitations

**Purpose**: Invitations to join review sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| invitation_id | UUID | PRIMARY KEY | Unique identifier |
| session_id | UUID | FK, NOT NULL | Review session |
| inviter_id | UUID | FK (users), NOT NULL | User who sent invite |
| invitee_id | UUID | FK (users), NOT NULL | User being invited |
| invitee_email | VARCHAR(255) | NOT NULL | Invitee email address |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'reviewer', CHECK | 'moderator', 'reviewer', 'observer', 'contributor' |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'pending', CHECK | 'pending', 'accepted', 'declined', 'expired', 'cancelled' |
| message | TEXT | | Optional invitation message |
| expires_at | TIMESTAMPTZ | | Invitation expiration |
| invited_at | TIMESTAMPTZ | DEFAULT NOW | When invitation was sent |
| responded_at | TIMESTAMPTZ | | When invitee responded |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |

**Unique Constraint**: `session_invitee_unique (session_id, invitee_id)`

**Indexes**:
- `idx_session_invitations_session_id` (session_id)
- `idx_session_invitations_inviter_id` (inviter_id)
- `idx_session_invitations_invitee_id` (invitee_id)
- `idx_session_invitations_status` (status)
- `idx_session_invitations_invitee_email` (invitee_email)
- `idx_session_invitations_invited_at` (invited_at DESC)
- `idx_session_invitations_invitee_status` (invitee_id, status)

---

## Clarification & AI Tables

### document_submissions

**Purpose**: Documents submitted for review and AI analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| submission_id | UUID | PRIMARY KEY | Unique identifier |
| overlay_id | UUID | FK, NOT NULL | Evaluation overlay |
| session_id | UUID | FK | Review session (optional) |
| submitted_by | UUID | FK (users), NOT NULL | Submitter user |
| document_name | VARCHAR(255) | NOT NULL | Original filename |
| s3_key | VARCHAR(1024) | NOT NULL | S3 object key |
| s3_bucket | VARCHAR(255) | NOT NULL | S3 bucket name |
| file_size | BIGINT | NOT NULL | File size in bytes |
| content_type | VARCHAR(100) | | MIME type |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'submitted', CHECK | 'submitted', 'in_review', 'approved', 'rejected', 'needs_revision', 'archived' |
| submitted_at | TIMESTAMPTZ | DEFAULT NOW | Submission timestamp |
| reviewed_at | TIMESTAMPTZ | | Review completion timestamp |
| reviewed_by | UUID | FK (users) | Reviewer user |
| ai_analysis_status | VARCHAR(50) | DEFAULT 'pending', CHECK | 'pending', 'processing', 'completed', 'failed', 'skipped' |
| ai_analysis_completed_at | TIMESTAMPTZ | | AI analysis completion timestamp |
| metadata | JSONB | DEFAULT {} | Additional metadata |

**Indexes**:
- `idx_document_submissions_overlay_id` (overlay_id)
- `idx_document_submissions_session_id` (session_id)
- `idx_document_submissions_submitted_by` (submitted_by)
- `idx_document_submissions_status` (status)
- `idx_document_submissions_submitted_at` (submitted_at DESC)
- `idx_document_submissions_reviewed_by` (reviewed_by)
- `idx_document_submissions_s3_key` (s3_key)

**Relationships**:
- Many submissions → One overlay
- Many submissions → One session (optional)
- Many submissions → One submitted_by user
- One submission → Many evaluation_responses
- One submission → Many feedback_reports
- One submission → Many ai_agent_results

---

### evaluation_responses

**Purpose**: Responses to evaluation criteria for each submission.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| response_id | UUID | PRIMARY KEY | Unique identifier |
| submission_id | UUID | FK, NOT NULL | Document submission |
| **criteria_id** | UUID | FK, NOT NULL | Evaluation criterion ⚠️ |
| response_value | JSONB | NOT NULL | Response data (flexible format) |
| score | DECIMAL(5,2) | | Score (0.00-99.99) |
| confidence | DECIMAL(5,4) | | AI confidence (0.0000-1.0000) |
| is_ai_generated | BOOLEAN | DEFAULT false | Generated by AI or human? |
| reviewed_by | UUID | FK (users) | Reviewer (if human-reviewed) |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |

⚠️ **CRITICAL NAMING**: Column is `criteria_id` (plural), NOT `criterion_id` (singular). See [Lessons Learned](#lessons-learned).

**Unique Constraint**: `evaluation_responses_unique (submission_id, criteria_id)`

**Indexes**:
- `idx_evaluation_responses_submission_id` (submission_id)
- `idx_evaluation_responses_criteria_id` (criteria_id)
- `idx_evaluation_responses_is_ai_generated` (is_ai_generated)

**Relationships**:
- Many responses → One submission
- Many responses → One criterion

---

### feedback_reports

**Purpose**: Feedback and reports on document submissions. **⚠️ CRITICAL: This is where AI scoring agent saves results.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| report_id | UUID | PRIMARY KEY | Unique identifier |
| submission_id | UUID | FK, NOT NULL | Document submission |
| created_by | UUID | FK (users), NOT NULL | Report creator (AI user) |
| report_type | VARCHAR(50) | NOT NULL, CHECK | **'comment'** (AI-generated), 'issue', 'suggestion', 'approval', 'rejection' |
| title | VARCHAR(255) | | Report title |
| **content** | **TEXT** | NOT NULL | **JSONB-formatted text with AI results** |
| severity | VARCHAR(20) | CHECK | 'low', 'medium', 'high', 'critical' |
| status | VARCHAR(50) | DEFAULT 'open', CHECK | 'open', 'in_progress', 'resolved', 'closed' |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |
| resolved_at | TIMESTAMPTZ | | Resolution timestamp |
| resolved_by | UUID | FK (users) | Resolver user |

**⚠️ CRITICAL ARCHITECTURE DECISION**:

The AI scoring agent saves results to `feedback_reports` with:
- `report_type = 'comment'` (indicates AI-generated report)
- `content` field contains JSON string with:
  - `overall_score` (number)
  - `strengths` (array of strings)
  - `weaknesses` (array of strings)
  - `recommendations` (array of strings)
  - `detailed_feedback` (string)

**Why feedback_reports instead of ai_agent_results?**
- `ai_agent_results` stores individual agent execution results (structure validator, grammar checker, etc.)
- `feedback_reports` stores the **final consolidated feedback** from the scoring agent
- This separates intermediate analysis from final user-facing feedback
- See [Critical Architecture Decisions](#critical-architecture-decisions) for detailed rationale

**Indexes**:
- `idx_feedback_reports_submission_id` (submission_id)
- `idx_feedback_reports_created_by` (created_by)
- `idx_feedback_reports_status` (status)
- `idx_feedback_reports_created_at` (created_at DESC)

**Relationships**:
- Many reports → One submission
- Many reports → One creator user

---

### clarification_questions

**Purpose**: AI-generated questions for document submissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| question_id | UUID | PRIMARY KEY | Unique identifier |
| submission_id | UUID | FK, NOT NULL | Document submission |
| question_text | TEXT | NOT NULL | Question text |
| question_type | VARCHAR(50) | NOT NULL, DEFAULT 'open_ended', CHECK | 'open_ended', 'yes_no', 'multiple_choice', 'clarification', 'validation' |
| context | TEXT | | Context for question |
| section_reference | VARCHAR(255) | | Document section reference |
| priority | VARCHAR(20) | DEFAULT 'medium', CHECK | 'low', 'medium', 'high', 'critical' |
| is_required | BOOLEAN | DEFAULT false | Must be answered? |
| ai_model | VARCHAR(100) | | Model that generated question |
| ai_confidence | DECIMAL(5,4) | | AI confidence (0.0000-1.0000) |
| status | VARCHAR(50) | DEFAULT 'pending', CHECK | 'pending', 'answered', 'skipped', 'resolved' |
| asked_by | UUID | FK (users) | User who asked (if human) |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| metadata | JSONB | DEFAULT {} | Additional metadata |

**Indexes**:
- `idx_clarification_questions_submission_id` (submission_id)
- `idx_clarification_questions_priority` (priority)
- `idx_clarification_questions_status` (status)
- `idx_clarification_questions_asked_by` (asked_by)
- `idx_clarification_questions_created_at` (created_at DESC)
- `idx_clarification_questions_submission_status` (submission_id, status)
- `idx_clarification_questions_metadata_gin` USING GIN (metadata)

---

### clarification_answers

**Purpose**: User responses to clarification questions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| answer_id | UUID | PRIMARY KEY | Unique identifier |
| question_id | UUID | FK, NOT NULL | Clarification question |
| submission_id | UUID | FK, NOT NULL | Document submission |
| answered_by | UUID | FK (users), NOT NULL | User who answered |
| answer_text | TEXT | NOT NULL | Answer text |
| is_satisfactory | BOOLEAN | | Is answer satisfactory? |
| requires_followup | BOOLEAN | DEFAULT false | Needs follow-up question? |
| reviewed_by | UUID | FK (users) | Reviewer user |
| answered_at | TIMESTAMPTZ | DEFAULT NOW | Answer timestamp |
| reviewed_at | TIMESTAMPTZ | | Review timestamp |
| metadata | JSONB | DEFAULT {} | Additional metadata |

**Unique Constraint**: `question_answer_user_unique (question_id, answered_by)`

**Indexes**:
- `idx_clarification_answers_question_id` (question_id)
- `idx_clarification_answers_submission_id` (submission_id)
- `idx_clarification_answers_answered_by` (answered_by)
- `idx_clarification_answers_reviewed_by` (reviewed_by)
- `idx_clarification_answers_answered_at` (answered_at DESC)
- `idx_clarification_answers_metadata_gin` USING GIN (metadata)

---

### ai_agent_results

**Purpose**: Individual AI agent execution results from Step Functions workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| result_id | UUID | PRIMARY KEY | Unique identifier |
| submission_id | UUID | FK, NOT NULL | Document submission |
| agent_name | VARCHAR(100) | NOT NULL | Agent name (e.g., "structure-validator") |
| agent_type | VARCHAR(50) | NOT NULL, CHECK | 'structure_validator', 'content_analyzer', 'grammar_checker', 'clarification', 'scoring', 'orchestrator' |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'pending', CHECK | 'pending', 'running', 'completed', 'failed', 'skipped', 'timeout' |
| result | JSONB | DEFAULT {} | Agent-specific results |
| error_message | TEXT | | Error message if failed |
| processing_time_ms | INTEGER | | Processing time in milliseconds |
| tokens_used | INTEGER | | LLM tokens consumed |
| cost_usd | DECIMAL(10,6) | | Cost in USD |
| started_at | TIMESTAMPTZ | | Agent start timestamp |
| completed_at | TIMESTAMPTZ | | Agent completion timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Record creation timestamp |
| metadata | JSONB | DEFAULT {} | Additional metadata |

**⚠️ IMPORTANT**: This table stores **individual agent results**, NOT the final user-facing feedback. Final feedback is in `feedback_reports` table.

**Indexes**:
- `idx_ai_agent_results_submission_id` (submission_id)
- `idx_ai_agent_results_agent_name` (agent_name)
- `idx_ai_agent_results_agent_type` (agent_type)
- `idx_ai_agent_results_status` (status)
- `idx_ai_agent_results_completed_at` (completed_at DESC)
- `idx_ai_agent_results_result_gin` USING GIN (result)
- `idx_ai_agent_results_metadata_gin` USING GIN (metadata)

---

## Supporting Tables

### ai_analysis_results

**Purpose**: General AI analysis results for documents (different from ai_agent_results).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| analysis_id | UUID | PRIMARY KEY | Unique identifier |
| submission_id | UUID | FK, NOT NULL | Document submission |
| model_name | VARCHAR(100) | NOT NULL | AI model name |
| model_version | VARCHAR(50) | | Model version |
| analysis_type | VARCHAR(50) | NOT NULL, CHECK | 'document_classification', 'content_extraction', 'quality_assessment', 'compliance_check', 'risk_analysis' |
| findings | JSONB | NOT NULL, DEFAULT [] | Analysis findings |
| recommendations | JSONB | DEFAULT [] | Recommendations |
| confidence_score | DECIMAL(5,4) | | Confidence (0.0000-1.0000) |
| processing_time_ms | INTEGER | | Processing time |
| token_count | INTEGER | | Tokens used |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| metadata | JSONB | DEFAULT {} | Additional metadata |

**Indexes**:
- `idx_ai_analysis_results_submission_id` (submission_id)
- `idx_ai_analysis_results_model_name` (model_name)
- `idx_ai_analysis_results_analysis_type` (analysis_type)
- `idx_ai_analysis_results_created_at` (created_at DESC)

---

### llm_configurations

**Purpose**: LLM model configurations and parameters per organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| config_id | UUID | PRIMARY KEY | Unique identifier |
| organization_id | UUID | FK, NOT NULL | Parent organization |
| name | VARCHAR(255) | NOT NULL | Configuration name |
| provider | VARCHAR(50) | NOT NULL, CHECK | 'anthropic', 'openai', 'azure', 'aws_bedrock' |
| model_name | VARCHAR(100) | NOT NULL | Model name |
| model_version | VARCHAR(50) | | Model version |
| is_active | BOOLEAN | DEFAULT true | Is configuration active? |
| is_default | BOOLEAN | DEFAULT false | Is default for organization? |
| parameters | JSONB | NOT NULL, DEFAULT {} | Model parameters (temperature, max_tokens, etc.) |
| rate_limit_per_minute | INTEGER | DEFAULT 60 | Rate limit |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW | Last update timestamp |

**Unique Constraint**: `llm_config_name_org_unique (name, organization_id)`

**Indexes**:
- `idx_llm_configurations_organization_id` (organization_id)
- `idx_llm_configurations_is_active` (is_active)
- `idx_llm_configurations_provider` (provider)

---

### audit_logs

**Purpose**: Complete audit trail of system activities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| log_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK (users) | User who performed action |
| organization_id | UUID | FK | Organization context |
| action | VARCHAR(100) | NOT NULL | Action performed |
| resource_type | VARCHAR(50) | NOT NULL | Type of resource affected |
| resource_id | UUID | | Resource identifier |
| ip_address | INET | | IP address of request |
| user_agent | TEXT | | User agent string |
| details | JSONB | DEFAULT {} | Additional details |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Timestamp |

**Indexes**:
- `idx_audit_logs_user_id` (user_id)
- `idx_audit_logs_organization_id` (organization_id)
- `idx_audit_logs_action` (action)
- `idx_audit_logs_resource_type` (resource_type)
- `idx_audit_logs_resource_id` (resource_id)
- `idx_audit_logs_created_at` (created_at DESC)

---

### notifications

**Purpose**: User notifications and alerts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| notification_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK, NOT NULL | Recipient user |
| notification_type | VARCHAR(50) | NOT NULL, CHECK | 'submission', 'review', 'approval', 'rejection', 'comment', 'system', 'alert' |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Notification message |
| is_read | BOOLEAN | DEFAULT false | Has user read it? |
| action_url | VARCHAR(512) | | URL for action button |
| related_resource_type | VARCHAR(50) | | Type of related resource |
| related_resource_id | UUID | | Related resource identifier |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| read_at | TIMESTAMPTZ | | When user read it |

**Indexes**:
- `idx_notifications_user_id` (user_id)
- `idx_notifications_is_read` (user_id, is_read)
- `idx_notifications_created_at` (created_at DESC)

---

### document_versions

**Purpose**: Version history of documents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| version_id | UUID | PRIMARY KEY | Unique identifier |
| submission_id | UUID | FK, NOT NULL | Document submission |
| version_number | INTEGER | NOT NULL | Version number |
| s3_key | VARCHAR(1024) | NOT NULL | S3 object key for version |
| s3_version_id | VARCHAR(255) | | S3 version ID |
| uploaded_by | UUID | FK (users), NOT NULL | User who uploaded |
| upload_reason | TEXT | | Reason for new version |
| changes_description | TEXT | | Description of changes |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |

**Unique Constraint**: `document_versions_unique (submission_id, version_number)`

**Indexes**:
- `idx_document_versions_submission_id` (submission_id)
- `idx_document_versions_version_number` (submission_id, version_number DESC)

---

### user_sessions

**Purpose**: Active user sessions for authentication tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| session_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK, NOT NULL | User |
| session_token | VARCHAR(255) | NOT NULL, UNIQUE | Session token |
| ip_address | INET | | IP address |
| user_agent | TEXT | | User agent string |
| expires_at | TIMESTAMPTZ | NOT NULL | Expiration timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW | Creation timestamp |
| last_activity_at | TIMESTAMPTZ | DEFAULT NOW | Last activity timestamp |

**Indexes**:
- `idx_user_sessions_user_id` (user_id)
- `idx_user_sessions_session_token` (session_token)
- `idx_user_sessions_expires_at` (expires_at)

---

## Critical Architecture Decisions

### 1. Why feedback_reports for AI Results, Not ai_agent_results?

**Problem**: Where should the AI scoring agent save its final feedback?

**Options Considered**:
1. **ai_agent_results table**: Stores individual agent execution results
2. **feedback_reports table**: Stores user-facing feedback and reports

**Decision**: Use `feedback_reports` with `report_type = 'comment'`

**Rationale**:

| Factor | ai_agent_results | feedback_reports (chosen) |
|--------|------------------|---------------------------|
| **Purpose** | Intermediate agent outputs | Final consolidated feedback |
| **User-facing** | No (technical logs) | Yes (displayed to users) |
| **Data format** | Agent-specific JSONB | Standardized feedback format |
| **Query efficiency** | Need aggregation across agents | Single query for all feedback |
| **Consistency** | Different formats per agent | Consistent format for UI |
| **Historical tracking** | Shows workflow execution | Shows feedback evolution |

**Implementation**:
```sql
-- Scoring agent saves to feedback_reports
INSERT INTO feedback_reports (
    submission_id,
    created_by,
    report_type,
    title,
    content  -- JSONB string with overall_score, strengths, weaknesses, recommendations
) VALUES (
    :submission_id,
    :ai_user_id,
    'comment',  -- Indicates AI-generated
    'AI Analysis Report',
    :json_content
);
```

**Benefits**:
- ✅ Clear separation of concerns (intermediate vs final results)
- ✅ Easier querying for feedback display
- ✅ Consistent UI data structure
- ✅ Preserves both agent logs (ai_agent_results) and final feedback (feedback_reports)

**Lesson Learned (v1.1 Feedback Display Fix)**:
- Initial implementation incorrectly queried `ai_agent_results` for feedback
- Fixed to query `feedback_reports` with `report_type = 'comment'`
- See [Lessons Learned](#lessons-learned) section for details

---

### 2. criteria_id vs criterion_id Naming Convention

**Problem**: Inconsistent column naming between database and code.

**Database Schema**:
```sql
CREATE TABLE evaluation_criteria (
    criteria_id UUID PRIMARY KEY,  -- Plural form
    ...
);

CREATE TABLE evaluation_responses (
    criteria_id UUID REFERENCES evaluation_criteria(criteria_id),  -- Plural form
    ...
);
```

**Code Initially Used**:
```javascript
// WRONG - Code used singular form
const query = `SELECT er.criterion_id, ... FROM evaluation_responses er`;
```

**Result**: SQL error `"column er.criterion_id does not exist"`

**Fix Applied (v1.1)**:
```javascript
// CORRECT - Match database column name
const query = `SELECT er.criteria_id, ... FROM evaluation_responses er`;
```

**Why criteria_id (plural)?**:
- Table name is `evaluation_criteria` (plural)
- Convention: Use plural for collections/multiple items
- Primary key follows table name pattern

**Recommendation**:
- **Always use `criteria_id`** in database queries
- API responses can map to `criterion_id` for clarity if needed
- Document this naming convention prominently

---

### 3. JSONB for Flexible Data Storage

**Why JSONB?**

Several tables use JSONB columns for flexible, schema-less data:
- `overlays.configuration` - Overlay-specific settings
- `evaluation_responses.response_value` - Flexible response format
- `ai_agent_results.result` - Agent-specific output format
- `feedback_reports.content` - Feedback data (stored as JSON string, parsed in code)
- `*_metadata` columns - Additional data without schema changes

**Benefits**:
- ✅ No schema changes needed for new fields
- ✅ Fast indexing with GIN indexes
- ✅ Native PostgreSQL operators (`->`, `->>`, `@>`, etc.)
- ✅ Efficient storage (binary format)

**Trade-offs**:
- ❌ Less strict validation (application must validate)
- ❌ Harder to enforce constraints
- ❌ More complex queries for nested data

**Best Practices**:
1. Use GIN indexes for queried JSONB columns
2. Validate JSONB structure in application code
3. Document expected JSONB schema in comments
4. Consider migrating frequently-queried fields to columns

---

### 4. Multi-tenancy with Organizations

**Pattern**: Organization-scoped data isolation

**Implementation**:
- All user-generated content has `organization_id` foreign key
- Queries always filter by `organization_id`
- Row-level security can be added later

**Benefits**:
- ✅ Data isolation between organizations
- ✅ Scalable to many organizations
- ✅ Single database for all tenants
- ✅ Shared infrastructure reduces costs

---

## Indexes & Performance

### Index Strategy:

1. **Foreign Keys**: All foreign keys have indexes
2. **Commonly Queried**: Status fields, dates, boolean flags
3. **Composite Indexes**: Multi-column queries (organization_id + status)
4. **GIN Indexes**: JSONB columns for containment queries
5. **Unique Constraints**: Enforce data integrity

### Most Critical Indexes:

| Table | Index | Why Critical |
|-------|-------|--------------|
| document_submissions | idx_document_submissions_submitted_at | Listing recent submissions |
| document_submissions | idx_document_submissions_status | Filtering by status |
| feedback_reports | idx_feedback_reports_submission_id | Retrieving feedback |
| ai_agent_results | idx_ai_agent_results_submission_id | Tracking workflow progress |
| evaluation_responses | idx_evaluation_responses_submission_id | Loading evaluation scores |
| review_sessions | idx_review_sessions_org_status | Dashboard session lists |

### Performance Characteristics:

| Operation | Average Time | Notes |
|-----------|--------------|-------|
| Fetch submission | ~10ms | Single record by ID |
| Fetch feedback | ~50ms | Joins feedback_reports + evaluation_responses |
| List submissions | ~100ms | Filtered by session, paginated |
| AI agent result query | ~30ms | Single submission, all agents |
| Session dashboard | ~150ms | Aggregates across multiple tables |

---

## JSONB Columns

### Complete JSONB Column Reference:

| Table | Column | Purpose | Example Structure |
|-------|--------|---------|-------------------|
| organizations | settings | Org-wide settings | `{"theme": "dark", "notifications": true}` |
| users | preferences | User preferences | `{"language": "en", "timezone": "UTC"}` |
| overlays | configuration | Overlay config | `{"auto_score": true, "min_score": 70}` |
| evaluation_criteria | validation_rules | Validation logic | `{"min_length": 100, "max_length": 5000}` |
| evaluation_responses | response_value | Response data | `{"text": "...", "score": 85}` |
| document_submissions | metadata | Additional info | `{"is_pasted_text": true, "source": "api"}` |
| feedback_reports | (content is TEXT) | Feedback JSON | Stored as JSON string, parsed in code |
| ai_agent_results | result | Agent output | `{"findings": [...], "score": 78}` |
| ai_agent_results | metadata | Agent metadata | `{"model": "claude-sonnet-4-5", "tokens": 1234}` |
| review_sessions | settings | Session settings | `{"auto_invite": false, "deadline": "..."}` |
| session_participants | permissions | User permissions | `{"can_approve": true, "can_delete": false}` |
| clarification_questions | metadata | Question metadata | `{"generated_by": "clarification-agent"}` |
| clarification_answers | metadata | Answer metadata | `{"edited": true, "edit_count": 2}` |
| audit_logs | details | Audit details | `{"before": {...}, "after": {...}}` |

### GIN Indexes on JSONB:

```sql
-- Enables fast containment queries (@>, ?, ?|, ?&)
CREATE INDEX idx_overlays_configuration_gin ON overlays USING GIN (configuration);
CREATE INDEX idx_ai_agent_results_result_gin ON ai_agent_results USING GIN (result);
CREATE INDEX idx_ai_agent_results_metadata_gin ON ai_agent_results USING GIN (metadata);
-- ... (11 more GIN indexes)
```

---

## Lessons Learned

### Lesson 1: Table Mismatch (v1.1 Feedback Display Fix - Stage 1)

**Date**: January 25, 2026 22:34:50 UTC

**Problem**: GET /submissions/{id}/feedback endpoint returned 404 "Feedback not found"

**Root Cause**:
- Endpoint queried `ai_agent_results` table
- Scoring agent actually saves to `feedback_reports` table with `report_type = 'comment'`

**Fix**:
```javascript
// BEFORE:
const query = `SELECT * FROM ai_agent_results WHERE submission_id = $1`;

// AFTER:
const query = `SELECT * FROM feedback_reports
               WHERE submission_id = $1 AND report_type = 'comment'`;
```

**Lesson**: Always verify where data is actually stored, not where you assume it is.

---

### Lesson 2: Column Name Mismatch (v1.1 SQL Column Fix - Stage 2)

**Date**: January 25, 2026 23:03:52 UTC

**Problem**: After Stage 1 fix, endpoint returned 500 error: `"column er.criterion_id does not exist"`

**Root Cause**:
- Database uses `criteria_id` (plural)
- Query used `criterion_id` (singular)
- Also referenced non-existent `er.feedback` column

**Fix**:
```javascript
// BEFORE:
SELECT er.criterion_id, er.feedback, ...
FROM evaluation_responses er
JOIN evaluation_criteria ec ON er.criterion_id = ec.criteria_id

// AFTER:
SELECT er.criteria_id, er.score, ...  -- Removed er.feedback
FROM evaluation_responses er
JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
```

**Lessons**:
1. **Test SQL queries directly** in database client before deploying
2. **Column naming consistency** is critical - document conventions
3. **Schema verification** - verify columns exist before using them
4. **Progressive debugging** - test backend endpoints before assuming frontend issues

---

### Lesson 3: Test Before Deploy

**Problem**: First feedback fix introduced new SQL errors

**Lesson**:
1. Test database queries in pgAdmin/psql first
2. Invoke Lambda directly with test events
3. Run integration tests before deployment
4. Don't assume partial fixes are complete

**Testing Approach**:
```bash
# 1. Test query directly in database
psql -h <host> -U <user> -d overlay_db -c "SELECT ..."

# 2. Test Lambda with event
aws lambda invoke \
  --function-name overlay-api-submissions \
  --payload file://test-event.json \
  response.json

# 3. Check response
cat response.json | jq .
```

---

### Lesson 4: Document Database Architecture

**Problem**: Unclear which tables are used by which components

**Solution**: Create comprehensive documentation (this file)

**Document**:
- Table relationships
- Critical decisions (feedback_reports vs ai_agent_results)
- Column naming conventions
- JSONB structure expectations
- Common query patterns

---

### Lesson 5: Separation of Concerns

**Insight**: Keep intermediate results separate from final user-facing data

**Implementation**:
- `ai_agent_results`: Intermediate agent execution logs
- `feedback_reports`: Final consolidated feedback for users

**Benefits**:
- Clearer architecture
- Easier debugging (can see each agent's output)
- Flexible reporting (can regenerate feedback without re-running agents)
- Better performance (optimized queries for each use case)

---

## Schema Evolution

### Migration History:

| Migration | Date | Description |
|-----------|------|-------------|
| 000_initial_schema.sql | 2026-01-19 | Initial 13 tables |
| 002_add_review_sessions.sql | 2026-01-20 | Review sessions, clarification Q&A, ai_agent_results |
| 003_add_test_user.sql | 2026-01-20 | Seed test user data |
| 004_add_overlay_context_fields.sql | 2026-01-22 | Document context fields for AI agents |

### Future Schema Changes:

**Planned**:
- Add full-text search indexes (pg_trgm extension)
- Add document embeddings table for semantic search
- Add collaborative editing tables
- Add real-time WebSocket session table

---

## Views

### v_active_submissions

**Purpose**: Active submissions with user and overlay details

```sql
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
```

### v_user_permissions

**Purpose**: User permissions summary

```sql
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
```

---

## Summary

### Database Statistics:
- **Total Tables**: 19
- **Total Indexes**: 95+
- **GIN Indexes**: 11 (for JSONB)
- **Foreign Keys**: 45+
- **Unique Constraints**: 12
- **Check Constraints**: 21
- **Views**: 2

### Key Design Patterns:
1. ✅ **Multi-tenancy** via organization_id
2. ✅ **Soft deletes** via is_active/status fields
3. ✅ **Audit trail** in audit_logs table
4. ✅ **Flexible schema** with JSONB columns
5. ✅ **Separation of concerns** (intermediate vs final results)
6. ✅ **Performance optimization** with strategic indexes
7. ✅ **Data integrity** with foreign keys and constraints

### Critical Takeaways:
- **Always use `criteria_id`**, not `criterion_id`
- **Feedback is in `feedback_reports`**, not `ai_agent_results`
- **Test SQL queries** before deploying Lambda functions
- **JSONB provides flexibility** but requires application validation
- **Indexes are critical** for performance at scale

---

**Document Version**: 1.0
**Last Updated**: January 26, 2026
**Maintained By**: Architecture Team
