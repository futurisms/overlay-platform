# Platform State — v1.1 Stable (February 13, 2026)

## Executive Summary

The Overlay Platform is a production AI-powered document analysis system that processes submissions through a 6-agent workflow to provide comprehensive evaluation feedback. Currently serving **19 users** across **17 organizations** with **165 total submissions** processed through **31 active sessions** using **22 configured overlays**.

**Current Scale**:
- **API Calls**: 55 Claude API invocations
- **Tokens Processed**: 274,613 total (190,804 input + 83,809 output)
- **Total Cost**: $1.83 USD across all agents
- **Average Cost Per Submission**: $0.17 USD
- **Completed Annotations**: 7 documents with sandwich-format annotations

**Architecture**: Next.js frontend (Vercel) → AWS API Gateway → 22 Lambda functions → Aurora PostgreSQL + S3 + Cognito

**Version**: v1.1 Stable
**Git Tag**: `v1.1-stable`
**Database Snapshot**: `overlay-v1-1-stable-20260213`
**Production URL**: https://overlay-platform.vercel.app

---

## Feature Inventory

### For System Admins (`system_admin` role / `admin` PostgreSQL role)

**Session Management**
- ✅ Create, edit, delete analysis sessions
- ✅ Set session parameters (start/end dates, descriptions, project names)
- ✅ View all sessions across all users
- ✅ Invite analysts to sessions via email
- ✅ Remove participants from sessions

**Overlay & Criteria Management**
- ✅ Create custom overlays (document evaluation templates)
- ✅ Configure evaluation criteria with weights and max scores
- ✅ Edit criteria text and descriptions
- ✅ View full evaluation criteria details
- ✅ Manage overlay organization assignment

**Document Submission & Analysis**
- ✅ Upload documents (PDF, DOCX, DOC, TXT up to 10MB)
- ✅ Paste text directly (UTF-8 safe, up to 10MB)
- ✅ Attach up to 5 PDF appendices (5MB each)
- ✅ View all submissions across all sessions
- ✅ Download original documents and appendices
- ✅ View AI analysis results (structure, content, grammar scores)
- ✅ View comprehensive feedback reports
- ✅ Delete submissions
- ✅ View original submission content (text extraction from S3)

**Annotated Documents** (v1.4)
- ✅ Generate AI-powered annotated documents
- ✅ Sandwich format: text → recommendation → text
- ✅ Async generation (202 Accepted, poll for status)
- ✅ Download annotated DOCX files
- ✅ View annotation status and polling UI

**Cost Tracking** (v1.1)
- ✅ Admin dashboard with token usage by agent
- ✅ Cost breakdown (6 agents: evaluation + annotation)
- ✅ Per-submission cost visibility
- ✅ Real-time cost updates

**Notes System** (v1.5)
- ✅ Persistent notepad (localStorage + database)
- ✅ Right-click text selection to add to notes
- ✅ Save notes with titles to database
- ✅ View, edit, delete saved notes
- ✅ Export notes to Word (.docx)
- ✅ Notes scoped per user with ownership verification

**Authentication & Security** (v1.1)
- ✅ Password show/hide toggle on login
- ✅ Forgot password flow (Cognito email reset)
- ✅ Request code via email
- ✅ Reset password with 6-digit code
- ✅ Password requirements enforced (12+ chars)

### For Analysts (`document_admin` Cognito group / `analyst` PostgreSQL role)

**Session Access** (Restricted)
- ✅ View only sessions they're invited to
- ✅ Access granted via `session_participants` table
- ❌ Cannot create or edit sessions
- ❌ Cannot delete sessions

**Document Submission**
- ✅ Upload documents to assigned sessions
- ✅ Paste text submissions
- ✅ Attach PDF appendices
- ✅ View ONLY their own submissions (filtered in backend)
- ✅ View their submission results and feedback
- ✅ Generate annotated documents for their submissions
- ✅ Delete their own submissions

**Permissions Restrictions** (v1.1)
- ❌ Cannot view evaluation criteria (hidden in UI + 403 backend)
- ❌ Cannot edit overlays or criteria
- ❌ Cannot invite other analysts
- ❌ Cannot see other analysts' submissions
- ❌ Cannot access admin dashboard

**Notes System** (Same as Admin)
- ✅ All notes features available
- ✅ Notes scoped to their user ID

**Authentication** (Same as Admin)
- ✅ Password toggle and forgot password

---

## Architecture Overview

### Full Stack Topology

```
User Browser (overlay-platform.vercel.app)
         ↓
    Next.js 16.1.4 (Vercel)
         ↓
    [localhost:3001 proxy in dev]
         ↓
AWS API Gateway (https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/)
         ↓
    ┌────────────────┬──────────────────┬──────────────────┐
    ↓                ↓                  ↓                  ↓
10 API Lambdas   6 AI Agents      Lambda Layer      Step Functions
    ↓                ↓                  ↓                  ↓
    └────────────────┴──────────────────┴──────────────────┘
                           ↓
         ┌─────────────────┼─────────────────┬──────────────┐
         ↓                 ↓                 ↓              ↓
    Aurora PostgreSQL   S3 Bucket      Cognito       CloudWatch
     (16.6 Serverless)  (Documents)  (Auth Users)      (Logs)
```

### AWS Services Used

**Compute**:
- **Lambda Functions**: 22 functions (10 API + 6 AI agents + 6 support)
- **Step Functions**: 1 state machine for 6-agent workflow orchestration
- **Lambda Layer**: Shared code (db-utils, llm-client, cors, permissions)

**Database & Storage**:
- **Aurora PostgreSQL 16.6** (Serverless v2 in private VPC)
- **S3 Bucket**: `overlay-docs-975050116849` (document storage)
- **DynamoDB**: `overlay-llm-config` (LLM configuration)

**Authentication**:
- **Cognito User Pool**: `eu-west-1_lC25xZ8s6`
- **Cognito Groups**: `system_admin`, `document_admin`, `end_user`

**API & Networking**:
- **API Gateway REST API**: `wojz5amtrl`
- **VPC**: Private subnets for Aurora
- **NAT Gateway**: Lambda → S3/Claude API access

**Monitoring**:
- **CloudWatch Logs**: 22 log groups
- **CloudWatch Metrics**: Lambda invocations, duration, errors

**Region**: `eu-west-1` (Ireland)

---

## AI Agent Pipeline

### 6-Agent Workflow (Sequential Execution via Step Functions)

| # | Agent Name | Purpose | Input | Output | Avg Tokens | Avg Cost | Avg Time |
|---|------------|---------|-------|--------|------------|----------|----------|
| 1 | **structure-validator** | Validates document format, completeness, template adherence | Document text + overlay config | Structure score (0-100), validation issues | 2,210 input + 75 output | $0.01 | ~10s |
| 2 | **content-analyzer** | Evaluates content quality, clarity, completeness | Document text + context | Content score (0-100), strengths, weaknesses | 5,263 input + 2,450 output | $0.05 | ~30s |
| 3 | **grammar-checker** | Identifies spelling, grammar, writing quality issues | Document text | Grammar score (0-100), error list | 2,711 input + 461 output | $0.02 | ~15s |
| 4 | **clarification** | Generates clarification questions if needed | Document text + analysis results | Questions array (if applicable) | Variable | Variable | ~20s |
| 5 | **orchestrator** | Summarizes all agent results | All agent outputs | Summary + average score | 715 input + 458 output | $0.01 | ~10s |
| 6 | **scoring** | Calculates final weighted score + comprehensive feedback | All agent outputs + criteria | Final score, criterion scores, feedback report | 6,338 input + 2,743 output | $0.06 | ~30s |

**Total Pipeline**:
- **Total Calls**: 55 across 11 submissions
- **Avg Tokens Per Submission**: ~17,437 input + ~6,187 output = ~23,624 total
- **Avg Cost Per Submission**: ~$0.13 USD (evaluation only)

### Annotation Agent (Separate from Pipeline)

| Agent Name | Purpose | Input | Output | Avg Tokens | Avg Cost | Avg Time |
|------------|---------|-------|--------|------------|----------|----------|
| **annotate-document** | Generates sandwich-format annotated document | Document text + feedback | Annotated DOCX (text → recommendation → text) | 3,685 input + 4,386 output | $0.08 | ~60-90s |

**Current Usage**: 7 completed annotations out of 165 submissions (~4% annotation rate)

**Async Pattern**: Lambda self-invocation for background processing (202 Accepted → poll → 200 OK)

---

## User Roles & Permissions Matrix

| Feature | System Admin | Analyst | End User (Future) |
|---------|--------------|---------|-------------------|
| **Sessions** | | | |
| View all sessions | ✅ Yes | ❌ No (only assigned) | ❌ No |
| Create sessions | ✅ Yes | ❌ No | ❌ No |
| Edit sessions | ✅ Yes | ❌ No | ❌ No |
| Delete sessions | ✅ Yes | ❌ No | ❌ No |
| Invite participants | ✅ Yes | ❌ No | ❌ No |
| **Overlays & Criteria** | | | |
| View overlays | ✅ Yes | ✅ Yes (list only) | ❌ No |
| View evaluation criteria | ✅ Yes | ❌ **No (v1.1)** | ❌ No |
| Edit criteria | ✅ Yes | ❌ No | ❌ No |
| Create overlays | ✅ Yes | ❌ No | ❌ No |
| **Submissions** | | | |
| View all submissions | ✅ Yes | ❌ No (only own) | ❌ No |
| Upload documents | ✅ Yes | ✅ Yes | ✅ Yes (future) |
| View feedback | ✅ Yes | ✅ Yes (own only) | ✅ Yes (own only, future) |
| Delete submissions | ✅ Yes | ✅ Yes (own only) | ❌ No |
| Generate annotations | ✅ Yes | ✅ Yes (own only) | ✅ Yes (own only, future) |
| **Notes** | | | |
| Create/edit/delete notes | ✅ Yes | ✅ Yes | ✅ Yes (future) |
| Export to Word | ✅ Yes | ✅ Yes | ✅ Yes (future) |
| **Admin Features** | | | |
| View cost dashboard | ✅ Yes | ❌ No | ❌ No |
| Manage users | ✅ Yes | ❌ No | ❌ No |
| View analytics | ✅ Yes | ❌ No | ❌ No |

---

## API Reference

### Authentication
All endpoints require JWT token (except `/auth` endpoint).
- **Header**: `Authorization: Bearer <jwt_token>`
- **Token Source**: Cognito User Pool (`eu-west-1_lC25xZ8s6`)
- **Token Expiry**: 1 hour (ID token), 30 days (refresh token)

### Endpoints

| Method | Path | Lambda | Auth | Description |
|--------|------|--------|------|-------------|
| **Auth** | | | | |
| POST | `/auth` | overlay-api-auth | None | Login, register, forgotPassword, confirmForgotPassword |
| **Sessions** | | | | |
| GET | `/sessions` | overlay-api-sessions | Required | List sessions (all for admin, assigned for analyst) |
| GET | `/sessions/{id}` | overlay-api-sessions | Required | Get session details + submissions (filtered by role) |
| POST | `/sessions` | overlay-api-sessions | Admin | Create new session |
| PUT | `/sessions/{id}` | overlay-api-sessions | Admin | Update session |
| DELETE | `/sessions/{id}` | overlay-api-sessions | Admin | Delete session |
| **Submissions** | | | | |
| GET | `/submissions/{id}` | overlay-api-submissions | Required | Get submission details + feedback |
| POST | `/submissions` | overlay-api-submissions | Required | Create submission (triggers 6-agent workflow) |
| DELETE | `/submissions/{id}` | overlay-api-submissions | Required | Delete submission (owner or admin) |
| GET | `/submissions/{id}/download` | overlay-api-submissions | Required | Get presigned S3 URL for main document |
| GET | `/submissions/{id}/appendix/{index}` | overlay-api-submissions | Required | Get presigned S3 URL for appendix |
| GET | `/submissions/{id}/content` | overlay-api-submissions | Required | Get extracted text content from S3 documents |
| **Annotations** | | | | |
| GET | `/submissions/{id}/annotate` | overlay-api-annotate-document | Required | Generate or get status of annotated document |
| GET | `/submissions/{id}/annotate/download` | overlay-api-annotate-document | Required | Download annotated DOCX file |
| **Overlays** | | | | |
| GET | `/overlays` | overlay-api-overlays | Required | List all overlays |
| GET | `/overlays/{id}` | overlay-api-overlays | **Admin (v1.1)** | Get overlay + criteria (403 for analysts) |
| POST | `/overlays` | overlay-api-overlays | Admin | Create overlay |
| PUT | `/overlays/{id}` | overlay-api-overlays | Admin | Update overlay + criteria |
| DELETE | `/overlays/{id}` | overlay-api-overlays | Admin | Soft delete overlay |
| **Users** | | | | |
| GET | `/users/me` | overlay-api-users | Required | Get current user info |
| PUT | `/users/{id}` | overlay-api-users | Admin | Update user |
| **Invitations** | | | | |
| POST | `/invitations` | overlay-api-invitations | Admin | Create invitation (Cognito user + session access) |
| POST | `/invitations/accept` | overlay-api-invitations | None | Accept invitation (signup via token) |
| **Admin** | | | | |
| GET | `/admin/dashboard` | overlay-api-admin | Admin | Get cost dashboard data |
| GET | `/admin/analytics` | overlay-api-admin | Admin | Get platform analytics |
| **Notes** | | | | |
| GET | `/notes` | overlay-api-notes | Required | List user's notes |
| GET | `/notes/{id}` | overlay-api-notes | Required | Get note (ownership check) |
| POST | `/notes` | overlay-api-notes | Required | Create note |
| PUT | `/notes/{id}` | overlay-api-notes | Required | Update note (ownership check) |
| DELETE | `/notes/{id}` | overlay-api-notes | Required | Delete note (ownership check) |

---

## Database Schema (26 Tables, 3,773 Total Rows)

### Core Tables (High Activity)

| Table | Rows | Purpose | Key Columns |
|-------|------|---------|-------------|
| `evaluation_criteria` | 3,159 | Evaluation criteria definitions | `criteria_id`, `overlay_id`, `name`, `description`, `weight`, `max_score` |
| `feedback_reports` | 308 | AI-generated feedback reports | `report_id`, `submission_id`, `report_type`, `title`, `content`, `severity` |
| `notifications` | 262 | User notifications | `notification_id`, `user_id`, `type`, `message`, `read_at` |
| `evaluation_responses` | 252 | Criterion scores per submission | `response_id`, `submission_id`, `criteria_id`, `score`, `reasoning` |
| `document_submissions` | 165 | User document submissions | `submission_id`, `session_id`, `overlay_id`, `document_name`, `s3_key`, `status`, `ai_analysis_status`, `overall_score`, `appendix_files` (JSONB) |
| `token_usage` | 55 | Claude API token tracking | `token_usage_id`, `submission_id`, `agent_name`, `input_tokens`, `output_tokens`, `cost_usd` (computed), `model_name` |
| `session_participants` | 40 | User-session access control | `user_id`, `session_id`, `role`, `status`, `invited_by` |
| `review_sessions` | 31 | Analysis sessions | `session_id`, `name`, `description`, `overlay_id`, `status`, `start_date`, `end_date`, `project_name` |
| `overlays` | 22 | Document evaluation templates | `overlay_id`, `name`, `description`, `document_type`, `document_purpose`, `target_audience`, `is_active` |
| `users` | 19 | Platform users | `user_id` (Cognito sub), `email`, `username`, `first_name`, `last_name`, `user_role`, `organization_id` |

### Supporting Tables (Moderate Activity)

| Table | Rows | Purpose |
|-------|------|---------|
| `user_roles` | 18 | Role definitions (deprecated, using user.user_role directly) |
| `organizations` | 17 | Tenant organizations |
| `document_annotations` | 7 | Annotated document metadata |
| `user_invitations` | 6 | Session invitation tokens |
| `user_notes` | 5 | User note-taking feature |
| `llm_configurations` | 3 | LLM model configurations |

### Empty Tables (Reserved for Future Features)

`clarification_answers`, `ai_token_usage`, `audit_logs`, `ai_agent_results`, `user_sessions`, `ai_analysis_results`, `organization_credits`, `clarification_questions`, `session_invitations`, `document_versions`

### Key Relationships

```
organizations → users (1:N)
users → review_sessions (creator) (1:N)
users → session_participants (N:M via join table)
overlays → review_sessions (1:N)
overlays → evaluation_criteria (1:N)
review_sessions → document_submissions (1:N)
document_submissions → feedback_reports (1:N)
document_submissions → evaluation_responses (1:N)
document_submissions → token_usage (1:N)
document_submissions → document_annotations (1:1)
evaluation_criteria → evaluation_responses (1:N)
users → user_notes (1:N)
users → user_invitations (invited_by) (1:N)
review_sessions → user_invitations (1:N)
```

### Important JSONB Columns

**`document_submissions.appendix_files`**:
```json
[
  {
    "file_name": "appendix1.pdf",
    "s3_key": "documents/abc123/appendix_0.pdf",
    "file_size": 524288,
    "upload_order": 1
  }
]
```

**`feedback_reports.content`**:
```json
{
  "summary": "Overall analysis...",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1"],
  "recommendations": ["Rec 1", "Rec 2"],
  "scores": {
    "structure": 85,
    "content": 72,
    "grammar": 90,
    "average": 82
  }
}
```

---

## Migration History

### Applied Migrations (25 migrations)

Based on `database/migrations/` directory:

1. `001_initial_schema.sql` - Core tables: users, organizations, overlays, sessions, submissions
2. `002_add_user_roles.sql` - User role system
3. `003_create_evaluation_criteria.sql` - Criteria definitions
4. `004_create_feedback_reports.sql` - AI feedback storage
5. `005_create_evaluation_responses.sql` - Criterion scores
6. `006_add_session_participants.sql` - Session access control
7. `007_add_clarification_questions.sql` - AI clarification feature
8. `008_add_notifications.sql` - User notifications
9. `009_add_user_sessions.sql` - Session tracking
10. `010_add_llm_configurations.sql` - LLM config management
11. `011_add_ai_analysis_results.sql` - AI analysis storage
12. `012_add_organization_credits.sql` - Credit system (future)
13. `013_add_audit_logs.sql` - Audit trail
14. `014_add_document_versions.sql` - Version control (future)
15. `015_add_session_invitations.sql` - Invitation system
16. `016_add_appendix_files.sql` - Appendix support (JSONB column)
17. `017_add_user_invitations.sql` - User invitation tokens
18. `018_update_password_policy.sql` - 12-char password requirement
19. `019_handle_cognito_users.sql` - Cognito user ID sync
20. `020_add_user_notes.sql` - Notes feature (v1.5)
21. `021_fix_user_id_mismatch.sql` - User ID FK constraint fix
22. `022_add_document_annotations.sql` - Annotation feature (v1.4)
23. `023_fix_user_id_fk.sql` - User ID foreign key repair
24. `024_add_token_usage.sql` - Claude API cost tracking
25. `025_backfill_annotation_token_usage.sql` - Backfill annotation costs (v1.1)

### Rollback Procedures

Each migration has a corresponding `rollback-XXX_*.sql` file in `database/migrations/`.

**To rollback**:
```bash
# 1. Copy rollback SQL to Lambda migrations directory
cp database/migrations/rollback-025_*.sql lambda/functions/database-migration/migrations/

# 2. Redeploy migration Lambda
cdk deploy OverlayStorageStack

# 3. Run rollback via Lambda
npm run migrate:lambda
```

---

## Cost Analysis (Production Data)

### Current Spend Breakdown (Real Production Data)

| Agent | Calls | Input Tokens | Output Tokens | Cost (USD) | % of Total |
|-------|-------|--------------|---------------|------------|------------|
| **scoring** | 10 | 63,379 | 27,429 | $0.6016 | 32.9% |
| **content-analyzer** | 10 | 52,633 | 24,501 | $0.5254 | 28.7% |
| **annotate-document** | 5 | 18,427 | 21,932 | $0.3843 | 21.0% |
| **grammar-checker** | 10 | 27,106 | 4,613 | $0.1505 | 8.2% |
| **orchestrator** | 10 | 7,151 | 4,578 | $0.0901 | 4.9% |
| **structure-validator** | 10 | 22,108 | 756 | $0.0777 | 4.2% |
| **TOTAL** | **55** | **190,804** | **83,809** | **$1.8296** | **100%** |

### Per-Submission Cost Analysis

| Metric | Value |
|--------|-------|
| Submissions with Cost Data | 11 |
| Average Cost Per Submission | $0.17 USD |
| Minimum Cost | $0.04 USD |
| Maximum Cost | $0.24 USD |
| Total Cost | $1.83 USD |

**Cost Breakdown by Submission Type**:
- **Evaluation Only** (6 agents, no annotation): ~$0.13 USD
- **Evaluation + Annotation** (6 agents + annotation): ~$0.21 USD

### Cost Projections at Scale

#### Monthly Projections

| Submissions/Month | Eval Only Cost | With Annotation (30%) | Total Monthly Cost |
|-------------------|----------------|------------------------|-------------------|
| 100 | $13.00 | $19.40 | $19.40 |
| 500 | $65.00 | $97.00 | $97.00 |
| 1,000 | $130.00 | $194.00 | $194.00 |
| 5,000 | $650.00 | $970.00 | $970.00 |
| 10,000 | $1,300.00 | $1,940.00 | $1,940.00 |

**Assumptions**:
- 70% evaluation only ($0.13 each)
- 30% with annotation ($0.21 each)
- No volume discounts applied

#### AWS Infrastructure Costs (Estimated Monthly)

| Service | Usage | Est. Cost/Month |
|---------|-------|-----------------|
| **Aurora Serverless v2** | 0.5 ACU min, burst to 2 ACU | $40-80 |
| **Lambda** | 22 functions, ~10K invocations | $5-10 |
| **API Gateway** | ~10K requests | $0.04 |
| **S3** | 165 documents ~50MB average | $1-2 |
| **Cognito** | 19 MAU | Free (under 50K MAU) |
| **CloudWatch** | Logs + metrics | $5-10 |
| **NAT Gateway** | Data transfer | $30-45 |
| **TOTAL INFRA** | | **~$80-150/month** |

### Total Cost of Operations

| Scale | Claude API Cost | AWS Infra | Total Monthly | Cost Per Submission |
|-------|----------------|-----------|---------------|---------------------|
| 100 submissions | $19 | $80 | $99 | $0.99 |
| 500 submissions | $97 | $80 | $177 | $0.35 |
| 1,000 submissions | $194 | $100 | $294 | $0.29 |
| 5,000 submissions | $970 | $120 | $1,090 | $0.22 |
| 10,000 submissions | $1,940 | $150 | $2,090 | $0.21 |

### Margin Analysis (Pricing Recommendations)

| Pricing Tier | Price Per Submission | Cost at 1,000/mo | Gross Margin | Monthly Revenue |
|--------------|----------------------|------------------|--------------|-----------------|
| **Bronze** (Eval only) | $2.00 | $0.29 | 85.5% | $2,000 |
| **Silver** (+ Annotation) | $3.50 | $0.29 | 91.7% | $3,500 |
| **Gold** (+ Priority) | $5.00 | $0.29 | 94.2% | $5,000 |

**Volume Discount Potential**:
- Claude API volume pricing: 10-15% discount at $50K+/month spend
- At 10K submissions/month: $1,940 Claude + $150 AWS = $2,090 COGS
- With volume discount: ~$1,850 COGS = 18% cost reduction

---

## Current Limitations & Known Issues

### Platform Limitations

1. **Frontend Deployment**: Only on Vercel, no CloudFront/S3 alternative configured
2. **Email Templates**: Uses Cognito default templates (no custom branding for password reset)
3. **No Rate Limiting**: Forgot password endpoint not rate-limited (abuse potential)
4. **Single Organization**: Multi-tenant architecture exists but not fully enabled
5. **No Webhooks**: No external notifications (email only via Cognito)
6. **No Bulk Operations**: Must process submissions one at a time
7. **No Document Comparison**: Cannot compare multiple submissions side-by-side
8. **No Export API**: Cannot export all data programmatically (must use database dump)

### Known Issues

1. **Annotation Timeout**: Very large documents (>20 pages) may timeout at 5min Lambda limit
2. **UTF-8 Encoding**: Fixed in v1.4 but historical submissions may have encoding issues
3. **S3 Presigned URLs**: 15-minute expiry may cause download failures on slow connections
4. **Frontend Caching**: Next.js cache not optimized, some redundant API calls
5. **Database Connection Pool**: Limited to 5 connections, may bottleneck at high concurrency
6. **No Schema Migrations Table**: Migrations tracked manually in code, not in database
7. **Token Usage Gaps**: Pre-v1.1 annotations not tracked (55 calls recorded, 165 submissions exist)

### Scale Bottlenecks

1. **Aurora**: Serverless v2 min 0.5 ACU may struggle above 100 concurrent users
2. **Lambda Concurrency**: Default 1000 concurrent, may need limit increase
3. **Step Functions**: 25K executions/account limit (sufficient for ~2.5K submissions/month)
4. **API Gateway**: 10K RPS limit (sufficient for current scale)

### Security Considerations

1. **JWT Token Storage**: Stored in localStorage (XSS risk if compromised)
2. **No MFA**: Optional MFA configured but not enforced
3. **Session Timeout**: 1-hour token expiry may be too long for sensitive documents
4. **CORS**: Broad CORS policy in dev proxy (production API Gateway more restrictive)
5. **Input Validation**: Basic validation exists but not comprehensive (SQL injection protected by parameterized queries)

---

## SaaS-Relevant Metrics

### Current User Base

| Metric | Value |
|--------|-------|
| Total Users | 19 |
| System Admins | 14 (74%) |
| Analysts | 5 (26%) |
| Organizations | 17 |
| Active Sessions | 31 |
| Configured Overlays | 22 |

### Usage Patterns

| Metric | Value | Notes |
|--------|-------|-------|
| Total Submissions | 165 | All-time |
| Submissions with AI Analysis | 11 | Cost tracked (v1.1) |
| Annotation Rate | 4.2% | 7 of 165 submissions annotated |
| Avg Appendices Per Submission | 0.15 | 24 total appendices across 165 submissions |
| Avg Criteria Per Overlay | 144 | 3,159 criteria / 22 overlays |
| Avg Participants Per Session | 1.29 | 40 participations / 31 sessions |

### Feature Adoption

| Feature | Usage | Adoption % |
|---------|-------|------------|
| Password Reset (v1.1) | 0 uses | 0% (just released) |
| Annotated Documents (v1.4) | 7 generated | 4.2% of submissions |
| Notes Feature (v1.5) | 5 saved notes | 26% of users |
| Multi-Document (v1.4) | 24 appendices attached | 15% of submissions |
| Text Paste Upload | ~30% estimated | Based on submission names |

### Cost Per User

| Metric | Value |
|--------|-------|
| Total Cost | $1.83 |
| Users | 19 |
| Cost Per User | $0.10 |
| Submissions Per User | 8.68 |
| Cost Per User-Submission | $0.17 |

### Churn Risk Indicators (Future Metrics)

- **Last Login Date**: Not tracked yet (add to `users` table)
- **Session Completion Rate**: Not tracked yet (add to `review_sessions` table)
- **Abandoned Submissions**: Not tracked yet (add status transitions to audit log)
- **Feature Usage Heatmap**: Not tracked yet (add usage_stats table)

### Pricing Sensitivity Analysis

**Question**: What's the maximum price users will pay per submission?

**Data Points**:
- **Cost to Deliver**: $0.29/submission at 1,000/month scale
- **Competitor Pricing**: Unknown (no direct competitors identified)
- **Value Delivered**: 6 AI agents + comprehensive feedback + optional annotation
- **Time Savings**: ~2-4 hours of manual review per document

**Recommended Initial Pricing**:
- **Evaluation Only**: $2-3 per submission (7-10x margin)
- **With Annotation**: $4-5 per submission (14-17x margin)
- **Bundle Pricing**: $500/month for 200 submissions ($2.50 each)

---

## Technology Stack

### Frontend (Vercel)

**Framework**: Next.js 16.1.4
**Runtime**: React 19.2.3
**Language**: TypeScript 5

**UI Libraries**:
- Radix UI (dialog, alert, label, progress, tabs, scroll-area)
- Tailwind CSS 4.0
- Lucide React (icons)
- Sonner (toast notifications)
- shadcn/ui components

**Data/File Libraries**:
- docx 9.5.1 (Word document generation for notes)
- file-saver 2.0.5 (file downloads)
- date-fns 4.1.0 (date formatting)

**Build Tools**:
- TypeScript compiler
- ESLint
- Tailwind PostCSS

### Backend (AWS)

**Compute**:
- Node.js 20.x runtime (all Lambdas)
- AWS Lambda (22 functions)
- AWS Step Functions (state machine)
- Lambda Layer (shared code)

**Database**:
- PostgreSQL 16.6 (Aurora Serverless v2)
- pg (node-postgres) driver

**Storage**:
- S3 (document storage)
- DynamoDB (LLM config)

**AI/ML**:
- Claude Sonnet 4.5 (model: claude-sonnet-4-5-20250929)
- Anthropic SDK (@anthropic-ai/sdk)
- Text extraction: pdf-parse, mammoth (DOCX)

**Authentication**:
- AWS Cognito User Pools
- JWT token validation
- @aws-sdk/client-cognito-identity-provider

**Infrastructure**:
- AWS CDK 2.x (TypeScript)
- CloudFormation (generated from CDK)

**Monitoring**:
- CloudWatch Logs
- CloudWatch Metrics

**Region**: eu-west-1 (Ireland)

### CI/CD

**Frontend**: Vercel auto-deploy on GitHub push
**Backend**: Manual CDK deploy (`cdk deploy OverlayComputeStack`)

**Git**:
- Repository: https://github.com/futurisms/overlay-platform
- Branch: `master`
- Tags: `v1.0`, `v1.1-stable`

---

## Development Skills & Practices

The Overlay Platform follows a systematic development methodology documented in four core skills:

### 1. Database Migration Management
**File**: `.claude/skills/Database_Migration_Management.md`

**Summary**: Safe schema changes with forward migrations and rollback scripts. Every database change follows the pattern:

1. Create forward migration: `database/migrations/NNN_description.sql`
2. Create rollback: `database/migrations/rollback-NNN_description.sql`
3. Copy to Lambda: `lambda/functions/database-migration/migrations/`
4. Deploy Lambda: `cdk deploy OverlayStorageStack`
5. Run migration: `npm run migrate:lambda`
6. Verify: Query database to confirm changes
7. Test rollback: Ensure rollback script works

**Key Principles**:
- Never modify production database without migration + rollback
- Test migrations on dev data before production
- Use transactions where possible
- Foreign key constraints handled carefully (drop → update → re-add)

**Example**: Migration 023 fixed user_id FK mismatches by temporarily dropping constraints, updating IDs, then restoring constraints.

### 2. AWS Full-Stack Deployment
**File**: `.claude/skills/AWS_Full-Stack_Deployment_v4.md`

**Summary**: Four-stack CDK architecture with proper separation of concerns:

1. **StorageStack**: Database, VPC, S3 (deployed once, rarely changes)
2. **AuthStack**: Cognito (deployed once, rarely changes)
3. **ComputeStack**: API Lambdas (deploy after handler changes)
4. **OrchestrationStack**: Lambda Layer + AI agents (deploy after agent changes)

**CORS Two-Part System**:
- **Development**: Local proxy server (`node proxy-server.js`) on port 3001 adds CORS headers
- **Production**: API Gateway configured with CORS headers directly

**Deployment Commands**:
```bash
cdk deploy OverlayComputeStack        # API changes
cdk deploy OverlayOrchestrationStack  # AI agent changes
cdk deploy OverlayStorageStack        # Database/infra changes (rare)
```

**Lambda Patterns**:
- Shared code via Lambda Layer (`/opt/nodejs/`)
- VPC access for Aurora (private subnets)
- IAM policies scoped per Lambda
- Environment variables for config

### 3. Test-Driven Implementation
**File**: `.claude/skills/Test-Driven_Implementation_v2.md`

**Summary**: Incremental verification at each step prevents rework. The pattern:

1. **Phase 1**: Research and design (read code, understand architecture)
2. **Phase 2**: Implement smallest testable unit
3. **Phase 3**: Test on localhost immediately
4. **Phase 4**: Deploy to production
5. **Phase 5**: Verify in production
6. **Phase 6**: Document and commit

**Key Principles**:
- Test each change independently before moving to next change
- Don't batch multiple changes without testing
- Use `console.log` liberally for debugging
- Check CloudWatch logs for production issues
- Always have a rollback plan

**Example**: Annotation feature implemented in 5 phases over 3 days with testing after each phase.

### 4. Production Readiness
**File**: `.claude/skills/Production_Readiness.md`

**Summary**: Pre-deployment checklist to catch issues before production:

**Phase 1 - Localhost Verification**:
- Feature works with dev proxy
- No console errors
- Edge cases handled
- Error messages clear

**Phase 2 - Backend Deployment**:
- Deploy backend first (API Gateway + Lambdas)
- Test API endpoints with curl/Postman
- Check CloudWatch logs for errors
- Verify database changes applied

**Phase 3 - Frontend Deployment**:
- Vercel auto-deploys on git push
- Verify CORS working (no proxy in production)
- Test all flows end-to-end
- Check responsive design

**Phase 4 - Production Smoke Test**:
- Login works
- Core features functional
- Data persists correctly
- No critical errors in logs

**Phase 5 - Rollback Preparation**:
- Document rollback procedure
- Keep previous Lambda versions
- Database rollback script ready
- Git tag for version control

---

## Deployment Process

### Backend Deployment (CDK)

**Prerequisites**:
- AWS CLI configured with credentials
- Node.js 20+ installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)

**Commands**:

```bash
# 1. Build TypeScript
npm run build

# 2. Synthesize CloudFormation
cdk synth

# 3. Show what will change
cdk diff OverlayComputeStack

# 4. Deploy specific stack
cdk deploy OverlayComputeStack --require-approval never

# 5. Verify deployment
aws lambda list-functions --region eu-west-1 | grep overlay

# 6. Check logs
export MSYS_NO_PATHCONV=1 && export MSYS2_ARG_CONV_EXCL="*" && \
aws logs tail /aws/lambda/overlay-api-sessions --since 5m --format short
```

**Stack Deployment Order**:
1. `OverlayStorageStack` (first time only)
2. `OverlayAuthStack` (first time only)
3. `OverlayComputeStack` (after API changes)
4. `OverlayOrchestrationStack` (after AI agent changes)

**Common Scenarios**:

| Change | Stack to Deploy | Reason |
|--------|----------------|--------|
| API handler code | ComputeStack | Lambda functions in this stack |
| AI agent code | OrchestrationStack | AI agents in this stack |
| Lambda Layer code | OrchestrationStack | Layer defined here |
| Database migration | StorageStack | RDS in this stack |
| Cognito config | AuthStack | User Pool in this stack |
| Multiple changes | Both Compute + Orchestration | If unsure, deploy both |

### Frontend Deployment (Vercel)

**Automatic Deployment**:
```bash
git add -A
git commit -m "feat: description"
git push origin master
```

Vercel detects push and auto-deploys within 2-3 minutes.

**Manual Trigger**:
```bash
# From Vercel dashboard: Deployments → Redeploy
```

**Environment Variables** (Vercel dashboard):
- `NEXT_PUBLIC_API_BASE_URL`: Not set in production (uses runtime detection)

**Build Settings**:
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### Database Migration Deployment

**Process**:
```bash
# 1. Create migration
cat > database/migrations/026_description.sql <<EOF
-- Forward migration SQL
EOF

cat > database/migrations/rollback-026_description.sql <<EOF
-- Rollback SQL
EOF

# 2. Copy to Lambda directory
cp database/migrations/026_description.sql \
   lambda/functions/database-migration/migrations/

# 3. Deploy Lambda
cdk deploy OverlayStorageStack

# 4. Run migration
npm run migrate:lambda

# 5. Verify
aws lambda invoke --function-name overlay-database-migration \
  --payload '{"querySQL": "SELECT * FROM table_name LIMIT 1;"}' \
  --cli-binary-format raw-in-base64-out --region eu-west-1 response.json
cat response.json
```

---

## Backup & Recovery

### Database Snapshots

**Manual Snapshot**:
```bash
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier overlaystoragestack-auroracluster23d869c0-higkke9k7oro \
  --db-cluster-snapshot-identifier overlay-v1-2-$(date +%Y%m%d) \
  --region eu-west-1
```

**Restore from Snapshot**:
```bash
# 1. Create new cluster from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier overlay-restored \
  --snapshot-identifier overlay-v1-1-stable-20260213 \
  --engine aurora-postgresql \
  --engine-version 16.6 \
  --vpc-security-group-ids sg-xyz \
  --db-subnet-group-name overlay-subnet-group \
  --region eu-west-1

# 2. Create DB instances in cluster
aws rds create-db-instance \
  --db-instance-identifier overlay-restored-instance-1 \
  --db-cluster-identifier overlay-restored \
  --db-instance-class db.serverless \
  --engine aurora-postgresql \
  --region eu-west-1

# 3. Update Lambda environment variables
aws lambda update-function-configuration \
  --function-name overlay-api-sessions \
  --environment Variables={DB_HOST=overlay-restored.cluster-xyz.eu-west-1.rds.amazonaws.com} \
  --region eu-west-1

# 4. Test connectivity
npm run migrate:lambda
```

**Current Snapshots**:
- `overlay-v1-1-stable-20260213` - v1.1 stable release (Feb 13, 2026)
- Automatic daily snapshots retained for 7 days

### Code Backups

**Git Tags**:
```bash
# List all tags
git tag

# Create new tag
git tag -a v1.2 -m "Version 1.2 description"
git push origin v1.2

# Restore from tag
git checkout v1.1-stable
```

**Current Tags**:
- `v1.0` - Initial production release
- `v1.1-stable` - Current stable (5bf4d27)

**GitHub Repository**: https://github.com/futurisms/overlay-platform

**Recovery Procedure**:
```bash
# 1. Clone repository
git clone https://github.com/futurisms/overlay-platform.git

# 2. Checkout specific version
git checkout v1.1-stable

# 3. Install dependencies
npm install
cd frontend && npm install && cd ..

# 4. Deploy backend
cdk deploy --all --require-approval never

# 5. Deploy frontend
git push origin master  # Vercel auto-deploys
```

### S3 Document Backup

**Bucket Versioning**: Enabled
**Lifecycle Policy**: Retain all versions for 90 days

**Manual Backup**:
```bash
aws s3 sync s3://overlay-docs-975050116849 ./s3-backup/ \
  --region eu-west-1
```

**Restore Documents**:
```bash
aws s3 sync ./s3-backup/ s3://overlay-docs-975050116849 \
  --region eu-west-1
```

---

## Version History

### v1.1 Stable (February 13, 2026)

**Major Features**:
- ✅ Password show/hide toggle on login
- ✅ Forgot password flow (Cognito email verification)
- ✅ Analyst permission restrictions (criteria hidden frontend + backend 403)
- ✅ Annotation cost tracking in admin dashboard

**Changes from v1.0**:
- Auth Lambda: Added `forgotPassword` and `confirmForgotPassword` actions
- Frontend Login: 4 UI states (login, forgot, reset, success)
- Session Page: Evaluation criteria hidden for analysts
- Overlays API: Permission check on GET endpoint for analysts
- Admin Dashboard: 6 agents tracked (evaluation + annotation)

**Database Changes**:
- Migration 025: Backfill annotation token usage

**Git Commit**: `5bf4d27`
**Database Snapshot**: `overlay-v1-1-stable-20260213`

### v1.0 Baseline (January 2026)

**Core Features**:
- 6-agent AI evaluation pipeline
- Session-based document analysis
- Overlays and evaluation criteria
- Two-role system (admin/analyst)
- Annotated document generation
- Notes system with Word export
- Multi-document support (main + appendices)
- Cost tracking (evaluation pipeline only)

**Initial Deployment**:
- Backend: AWS (Lambda + Aurora + S3 + Cognito)
- Frontend: Vercel (Next.js)

---

## End of Document

**Document Version**: v1.1
**Created**: February 13, 2026
**Last Updated**: February 13, 2026
**Author**: Platform Documentation System
**Purpose**: Complete platform state documentation for SaaS planning and new developer onboarding

**Next Steps**:
1. Review cost projections for pricing decisions
2. Identify high-value features for commercial roadmap
3. Plan multi-tenant enablement
4. Design subscription tiers based on usage patterns
5. Develop go-to-market strategy grounded in real cost data
