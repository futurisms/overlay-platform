# Overlay Platform — Complete Context for Claude Code

**Current Version**: v1.9-stable (February 18, 2026)
**Production URL**: https://overlay.futurisms.ai
**Database Snapshot**: overlay-v1-9-stable-20260218

---

## Quick Reference

### What is this Platform?
AI-powered document review and evaluation system with Next.js frontend and AWS Lambda backend. The system processes documents through a 6-agent AI workflow that provides structured feedback based on configurable evaluation criteria.

### Current State
- **Users**: 19 (14 admins, 5 analysts)
- **Sessions**: 42 review sessions
- **Submissions**: 141 documents processed
- **Overlays**: 36 evaluation templates
- **AI Cost**: $1.83 total ($0.133/submission)
- **Production**: Running on https://overlay.futurisms.ai

### Test Login
- URL: https://overlay.futurisms.ai/login
- Email: admin@example.com
- Password: TestPassword123!
- Role: system_admin (full access)

---

## Version History

### v1.9 (Feb 18, 2026) — **CURRENT**
- ✅ Custom domain: https://overlay.futurisms.ai with SSL
- ✅ DOCX overlay import (upload Word doc to auto-create evaluation templates)
- ✅ Dashboard pagination (6 sessions per page)
- ✅ Styled delete confirmation dialogs (sessions, overlays, criteria)
- ✅ CORS improvements (Lambda Layer, API Gateway, proxy)
- ✅ Database column widening (migrations 026, 027)
- ✅ Proxy CORS header filtering

### v1.8 (Feb 5, 2026)
- Admin dashboard with token usage analytics
- Password reset flow via Cognito
- Hide criteria from analysts
- Async annotated document generation

### v1.7 (Feb 5, 2026)
- Fixed analyst access system (matching Cognito + PostgreSQL user_ids)
- Comprehensive RBAC in permissions.js
- Fixed submission filtering for analysts

### v1.6 (Jan 30, 2026)
- Original submission content viewer (expandable section with copy functionality)
- Text extraction from PDF, DOCX, plain text

### v1.5 (Jan 29, 2026)
- Complete notes system (right sidebar, text selection, database persistence)
- Saved notes library + Word export + full CRUD

### v1.4 and earlier
- Multi-document upload (PDF appendices)
- Core AI workflow (6 agents)
- Session management, authentication

---

## Architecture

### Stack
- **Frontend**: Next.js 16.1.4 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: AWS Lambda (10 API handlers) + API Gateway + Aurora PostgreSQL 16.6
- **AI**: 6 Lambda agents coordinated by Step Functions (Claude Opus 4.6)
- **Auth**: AWS Cognito with JWT tokens
- **Storage**: S3 for documents, Aurora Serverless v2 for data

### AWS CDK Stacks
1. **StorageStack**: Database, VPC, S3, DynamoDB (deploy once, rarely changes)
2. **AuthStack**: Cognito User Pool (deploy once, rarely changes)
3. **ComputeStack**: 10 Lambda API handlers (deploy after handler changes)
4. **OrchestrationStack**: Lambda Layer + 6 AI agents + Step Functions (deploy after AI changes)

### Frontend Pages (8 main)
- `/dashboard` — Main dashboard with pagination **(v1.9 update)**
- `/session/[id]` — Session upload UI (file + paste text)
- `/submission/[id]` — Feedback display + original content viewer
- `/overlays` — Intelligence Setup with DOCX import **(v1.9 new)**
- `/notes/[id]` — Note detail with Word export
- `/admin/dashboard` — Admin analytics dashboard
- `/login` — User authentication
- `/signup` — Analyst signup via invitation

### Backend API Handlers (10)
- `sessions` — Review session CRUD
- `submissions` — Document upload/download/feedback
- `overlays` — Overlay CRUD (supports DOCX import in v1.9)
- `users` — User management
- `invitations` — Analyst invitations
- `notes` — Notes CRUD with ownership checks
- `answers` — Clarification answers
- `analytics` — Token usage stats
- `llm-config` — LLM configuration
- `organizations` — Organization management

### AI Agents (6)
1. **structure-validator** — Validates document structure
2. **content-analyzer** — Analyzes content quality
3. **grammar-checker** — Checks grammar and style
4. **clarification** — Identifies unclear sections
5. **scoring** — Assigns scores based on criteria
6. **orchestrator** — Coordinates agent execution

---

## Key Features (Complete List)

### Core Functionality
✅ User authentication (Cognito + JWT)
✅ Two-role system (admin + analyst with session-scoped access)
✅ Session management (create, edit, delete with project grouping)
✅ Document upload (file + paste text + PDF appendices)
✅ AI processing (6-agent workflow)
✅ Feedback display (scores, strengths, weaknesses, recommendations)
✅ Download (S3 presigned URLs)

### Advanced Features
✅ **Notes System** (v1.5): Right sidebar, text selection, database persistence, Word export
✅ **Original Content Viewer** (v1.6): Expandable section with copy functionality
✅ **Token Tracking** (v1.7): Real-time AI cost monitoring
✅ **Admin Dashboard** (v1.8): Token usage analytics, cost breakdown
✅ **Password Reset** (v1.8): Secure reset flow via Cognito
✅ **Async Annotations** (v1.8): Generate annotated Word docs with polling

### v1.9 Features (NEW)
✅ **DOCX Overlay Import**: Upload Word docs to auto-create evaluation templates
✅ **Dashboard Pagination**: 6 sessions per page with Previous/Next controls
✅ **Styled Delete Dialogs**: Professional confirmation dialogs for all delete actions
✅ **Custom Domain**: https://overlay.futurisms.ai with SSL certificate
✅ **Improved CORS**: Supports custom domain in dev and production

---

## Development Setup

### Prerequisites
- Node.js 20+ (for Next.js)
- AWS CLI configured with credentials
- Git repository cloned

### Local Development
```bash
# Terminal 1: Frontend (Next.js dev server)
cd frontend
npm install
npm run dev          # Starts on http://localhost:3000

# Terminal 2: CORS Proxy (REQUIRED for API Gateway communication)
cd frontend
node proxy-server.js # Starts on http://localhost:3001
```

**CRITICAL**: Both servers must run simultaneously. The proxy adds CORS headers and forwards requests to production API Gateway.

### Environment Variables
```bash
# frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### Common Commands
```bash
# Frontend
npm run build        # Build for production
npm run lint         # Run ESLint

# Backend (CDK)
cdk diff             # Show changes before deploying
cdk deploy OverlayComputeStack        # Deploy API Lambdas
cdk deploy OverlayOrchestrationStack  # Deploy AI agents

# Database Migrations
npm run migrate:lambda  # Run migrations via Lambda (VPC-only access)

# CloudWatch Logs
export MSYS_NO_PATHCONV=1 && export MSYS2_ARG_CONV_EXCL="*" && \
aws logs tail /aws/lambda/overlay-api-sessions --since 5m --format short
```

---

## Security & Access Control

### Authentication
- **Cognito User Pool**: eu-west-1_lC25xZ8s6
- **JWT Tokens**: 1-hour expiration, verified on all API requests
- **Password Policy**: Min 12 characters, requires uppercase, lowercase, number, special char

### Authorization (RBAC)
**System Admin** (`system_admin` Cognito group, `admin` PostgreSQL role):
- Full CRUD on all resources
- Can create/edit/delete sessions, overlays, criteria
- Can invite analysts
- Sees all submissions

**Analyst** (`document_admin` Cognito group, `analyst` PostgreSQL role):
- Restricted to assigned sessions via `session_participants` table
- Can only view/edit their own submissions
- Cannot create/edit/delete sessions or overlays
- Dashboard filtered to show only their submissions

---

## Database

### Connection
- **Type**: Aurora PostgreSQL 16.6 Serverless v2
- **VPC**: Private subnets only (NOT accessible from local machine)
- **Access**: Use `overlay-database-migration` Lambda for all queries

### Key Tables
- `users` (19 rows): User accounts with role-based permissions
- `review_sessions` (42 rows): Analysis sessions with project grouping
- `document_submissions` (141 rows): Uploaded documents
- `overlays` (36 rows): Evaluation templates
- `evaluation_criteria` (3,339 rows): Scoring rubrics
- `feedback_reports` (308 rows): AI-generated feedback
- `token_usage` (55 rows): AI cost tracking
- `user_notes` (5 rows): User-created notes

### Recent Migrations
- **026_widen_overlay_columns.sql** (v1.9): Widened overlays.name (255→500), overlays.document_type (100→500)
- **027_widen_criteria_columns.sql** (v1.9): Widened evaluation_criteria.name (255→500), evaluation_criteria.criterion_type (50→255)

---

## DOCX Overlay Import (v1.9 Feature)

### Overview
Users can upload Word documents to automatically create evaluation overlays with criteria.

### Parser Logic
**File**: `frontend/lib/docx-parser.ts`

Extracts:
- **Overlay metadata**: Name, Description, Document Type, Document Purpose, When Used, Process Context, Target Audience
- **Criteria**: Title, Type, Description (full scoring rubric), Weight, Max Score

**Key Pattern**: `extractFieldBetween(text, fieldLabel, nextLabels)`
- Searches for field label in text
- Stops at the earliest occurrence of any next label
- Prevents bleeding of consecutive fields (e.g., "Document Type:" bleeding into "Document Purpose:")

**Critical Fix** (v1.9): Parser now extracts ONLY from "EVALUATION CRITERIA" section onwards to avoid picking up overlay metadata fields when searching for criteria fields.

### UI Component
**File**: `frontend/components/overlays/ImportOverlayDialog.tsx`

Flow:
1. User clicks "Import from DOCX" on Intelligence Setup page
2. Upload .docx file
3. Parse document (extracts overlay + criteria)
4. Preview/edit parsed data
5. Click "Create Overlay" to save to database

### Database Changes
Migrations 026 and 027 widened columns to support longer imported text values.

---

## Dashboard Pagination (v1.9 Feature)

### Implementation
**File**: `frontend/app/dashboard/page.tsx`

- **Sessions per page**: 6 (constant `SESSIONS_PER_PAGE`)
- **State**: `currentPage` (starts at 1)
- **Resets**: Automatically resets to page 1 when project filter changes
- **Calculations**: `totalPages`, `startIndex`, `endIndex`, `paginatedSessions`, `showingFrom`, `showingTo`

### UI Controls
- **Info text**: "Showing 1-6 of 35 sessions"
- **Previous button**: Disabled on page 1
- **Page numbers**: Smart display with ellipsis (shows first, last, current, current±1)
- **Next button**: Disabled on last page
- **Visibility**: Hidden when ≤6 total sessions

---

## CORS Configuration (v1.9 Updates)

### Three Locations Updated
1. **Lambda Layer** (`lambda/layers/common/nodejs/cors.js`):
   - Added `https://overlay.futurisms.ai` to allowed origins

2. **API Gateway** (`lib/compute-stack.ts`):
   - Added `overlay.futurisms.ai` to CORS configuration
   - Updated `FRONTEND_URL` environment variable

3. **Proxy Server** (`frontend/proxy-server.js`):
   - Strips API Gateway CORS headers from responses
   - Prevents double CORS header conflicts in localhost

---

## Troubleshooting

### Frontend Shows "Missing Authentication Token"
- **Cause**: Proxy server not running or API Gateway route not configured
- **Fix**: Start proxy with `node proxy-server.js` in frontend directory

### Database Connection Timeout
- **Cause**: Aurora is in private VPC, not accessible from internet
- **Fix**: Use `overlay-database-migration` Lambda for all database operations

### CORS Errors in Development
- **Cause**: Proxy not stripping API Gateway CORS headers
- **Fix**: Ensure proxy-server.js has header filtering logic (v1.9 update)

### Analyst Sees "No analysis sessions available"
- **Cause**: User exists in Cognito but not PostgreSQL, or user_id mismatch
- **Fix**: Check CloudWatch logs, verify session_participants entries

---

## Git Workflow

### Committing Changes
```bash
# NEVER use git add . or git add -A (can accidentally add sensitive files)
# Always add specific files:
git add path/to/specific/file.ts

# Commit with co-authored tag:
git commit -m "$(cat <<'EOF'
Your commit message here.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

git push origin master
```

### Tagging Releases
```bash
git tag -a v1.X-stable -m "Version message"
git push origin v1.X-stable
```

---

## Key Files Reference

### v1.9 New Files
- `frontend/lib/docx-parser.ts` — DOCX parsing utility
- `frontend/components/overlays/ImportOverlayDialog.tsx` — Import dialog
- `database/migrations/026_widen_overlay_columns.sql` — Column widening
- `database/migrations/027_widen_criteria_columns.sql` — Criteria columns

### v1.9 Updated Files
- `lambda/layers/common/nodejs/cors.js` — Added overlay.futurisms.ai
- `lib/compute-stack.ts` — Updated CORS + FRONTEND_URL
- `frontend/proxy-server.js` — Strip API Gateway CORS headers
- `frontend/app/dashboard/page.tsx` — Pagination + styled delete dialog
- `frontend/app/overlays/page.tsx` — Import button + styled delete dialog
- `frontend/components/ui/ConfirmDialog.tsx` — Professional delete confirmations

### Core Frontend Files
- `frontend/app/layout.tsx` — Root layout with NotesProvider and ConditionalSidebar
- `frontend/lib/api-client.ts` — API client with 28+ methods
- `frontend/contexts/NotesContext.tsx` — Global notes state
- `frontend/components/sidebar/Sidebar.tsx` — Right sidebar with 3 tabs

### Core Backend Files
- `lambda/functions/api/overlays/index.js` — Overlay CRUD (supports DOCX import)
- `lambda/functions/api/sessions/index.js` — Session CRUD + submissions list
- `lambda/functions/api/submissions/index.js` — Document upload/download/feedback
- `lambda/layers/common/nodejs/db-utils.js` — Database utilities

---

## SaaS Roadmap Summary

A comprehensive SaaS roadmap has been created covering:
- **Three-tier hierarchy**: Super Admin → Account Admin → Analyst
- **Pricing**: Trial (free), Starter (£49/mo), Professional (£149/mo), Enterprise (£399/mo)
- **Implementation**: 6 sprints (12 weeks)
- **Sprint 1 Priority**: Multi-tenancy + Super Admin dashboard

Reference: `Overlay_SaaS_Roadmap_v1.md`

---

## Production URLs

- **Frontend**: https://overlay.futurisms.ai
- **API Gateway**: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
- **Cognito**: https://cognito-idp.eu-west-1.amazonaws.com/
- **GitHub**: https://github.com/futurisms/overlay-platform

---

## Support

- **Documentation**: CLAUDE.md (complete developer guide)
- **Git Tag**: v1.9-stable
- **Database Snapshot**: overlay-v1-9-stable-20260218
- **Generated**: February 18, 2026

---

**This document provides essential context for Claude Code sessions. For detailed implementation guides, refer to CLAUDE.md in the repository root.**
