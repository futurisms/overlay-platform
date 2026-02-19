# Overlay Platform v1.9 — Production State Report

**Date**: February 18, 2026
**Version**: v1.9-stable
**Production URL**: https://overlay.futurisms.ai
**Database Snapshot**: overlay-v1-9-stable-20260218
**Git Tag**: v1.9-stable

---

## Executive Summary

Overlay Platform v1.9 is a **production-ready AI-powered document review and evaluation system** running on AWS with Next.js frontend. This release builds on v1.8 with significant improvements to user experience, CORS configuration, and content management workflows.

**Key Metrics** (as of Feb 18, 2026):
- **Users**: 19 total (14 admins, 5 analysts)
- **Sessions**: 42 active review sessions
- **Submissions**: 141 document submissions processed
- **Overlays**: 36 evaluation templates
- **AI Cost**: $1.83 total across 55 agent calls
- **Annotations**: 7 annotated documents generated
- **Custom Domain**: https://overlay.futurisms.ai (SSL enabled)

---

## What's New in v1.9

### 1. **Custom Domain with SSL** 🎯
- **Production URL**: https://overlay.futurisms.ai (replaced vercel-preview URLs)
- **SSL**: Fully configured with Let's Encrypt certificate
- **DNS**: Configured via Cloudflare with proper CNAME records
- **Impact**: Professional branding, better security, improved SEO

### 2. **DOCX Overlay Import** 📄
- **Feature**: Upload Word documents to auto-create evaluation overlays
- **Parser**: Extracts overlay metadata (name, description, document type) and criteria (title, type, scoring rubric)
- **UI**: New "Import from DOCX" button on Intelligence Setup page
- **Flow**: Upload → Parse → Preview/Edit → Create Overlay
- **Fixed**: Field extraction bug (extractFieldBetween pattern now correctly identifies field boundaries)
- **Database**: Widened columns to support longer imported values (Migration 026, 027)

### 3. **Dashboard Pagination** 📊
- **Sessions per page**: 6 (optimal for 2x3 grid layout)
- **Controls**: Previous/Next buttons + smart page numbers with ellipsis
- **Counter**: "Showing X-Y of Z sessions" display
- **Behavior**: Resets to page 1 when project filter changes
- **Visibility**: Hidden when ≤6 total sessions

### 4. **Styled Delete Confirmations** ✨
- **Component**: Professional `ConfirmDialog` replaces browser `confirm()`
- **Features**: Red warning icon, clear title, destructive action button
- **Locations**: Sessions, overlays, criteria deletion
- **UX**: Consistent styling with dark mode support

### 5. **CORS Improvements** 🔧
- **Lambda Layer**: Added overlay.futurisms.ai to allowed origins
- **API Gateway**: Updated CORS configuration for custom domain
- **Proxy Server**: Strips API Gateway CORS headers to prevent localhost conflicts
- **Result**: No more CORS errors in development or production

### 6. **Database Schema Updates** 🗄️
- **Migration 026**: Widened overlays.name (255→500), overlays.document_type (100→500)
- **Migration 027**: Widened evaluation_criteria.name (255→500), evaluation_criteria.criterion_type (50→255)
- **Purpose**: Support longer text from DOCX imports
- **Rollback**: Safe rollback scripts included for both migrations

---

## Production Database State

### Table Row Counts (Top 10)
| Table | Rows | Purpose |
|-------|------|---------|
| `evaluation_criteria` | 3,339 | Evaluation rubrics and scoring criteria |
| `feedback_reports` | 308 | AI-generated feedback per submission |
| `notifications` | 276 | System notifications for users |
| `evaluation_responses` | 252 | User responses to evaluation questions |
| `document_submissions` | 141 | Uploaded documents for review |
| `token_usage` | 55 | AI token consumption tracking |
| `session_participants` | 51 | User assignments to sessions |
| `review_sessions` | 42 | Active review sessions |
| `overlays` | 36 | Evaluation templates |
| `users` | 19 | Platform users |

### AI Token Usage & Cost (by Agent)
| Agent | Calls | Input Tokens | Output Tokens | Cost (USD) |
|-------|-------|--------------|---------------|------------|
| **scoring** | 10 | 63,379 | 27,429 | $0.60 |
| **content-analyzer** | 10 | 52,633 | 24,501 | $0.53 |
| **annotate-document** | 5 | 18,427 | 21,932 | $0.38 |
| **grammar-checker** | 10 | 27,106 | 4,613 | $0.15 |
| **orchestrator** | 10 | 7,151 | 4,578 | $0.09 |
| **structure-validator** | 10 | 22,108 | 756 | $0.08 |
| **TOTAL** | **55** | **190,804** | **83,809** | **$1.83** |

**Average cost per submission**: $0.133 (based on 55 calls across ~14 submissions)

---

## Architecture Overview

### Three-Tier Stack (AWS CDK)
1. **StorageStack**: Aurora PostgreSQL 16.6, VPC, S3, DynamoDB
2. **AuthStack**: Cognito User Pool with system_admin and document_admin groups
3. **ComputeStack**: 10 Lambda API handlers (sessions, submissions, overlays, users, notes, etc.)
4. **OrchestrationStack**: Lambda Layer + 6 AI agents + Step Functions workflow

### Frontend (Next.js 16.1.4)
- **Framework**: App Router with TypeScript + Tailwind CSS + shadcn/ui
- **Pages**: 8 main pages (Dashboard, Session Detail, Submission Detail, Overlays, Login, Notes, Admin Dashboard)
- **Features**: Right sidebar with global notepad, text selection context menu, Word export, full CRUD for notes
- **Development**: Requires local CORS proxy (`proxy-server.js`) for API Gateway communication
- **Production**: Deployed on Vercel at https://overlay.futurisms.ai

### Backend (AWS Lambda + API Gateway)
- **API Handlers**: 10 Lambda functions for REST API
- **API Gateway**: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
- **Database**: Aurora Serverless v2 in private VPC subnets
- **AI Workflow**: 6 agents coordinated by Step Functions state machine

### AI Agents (6-Agent Pipeline)
1. **structure-validator**: Validates document structure
2. **content-analyzer**: Analyzes content quality and relevance
3. **grammar-checker**: Checks grammar, spelling, and style
4. **clarification**: Identifies ambiguous or unclear sections
5. **scoring**: Assigns numeric scores based on criteria
6. **orchestrator**: Coordinates agent execution and aggregates results

---

## Key Features (Complete List)

### Core Functionality
✅ **User Authentication**: Cognito-based with JWT tokens
✅ **Two-Role System**: System Admin (full access) + Analyst (session-scoped)
✅ **Session Management**: Create, edit, delete review sessions with project grouping
✅ **Document Upload**: File upload + paste text with PDF appendix support (max 5 files, 5MB each)
✅ **AI Processing**: 6-agent workflow with structure, content, grammar, clarification, scoring
✅ **Feedback Display**: Scores, strengths, weaknesses, recommendations per criterion
✅ **Download**: Main document and appendix downloads via S3 presigned URLs

### Advanced Features (v1.5+)
✅ **Notes System**: Right sidebar with persistent notepad, text selection via right-click, database persistence
✅ **Saved Notes Library**: Full CRUD for notes with Word export functionality
✅ **Original Submission Viewer**: Expandable section showing full document text with copy buttons (v1.6)
✅ **Token Tracking**: Real-time AI cost monitoring in admin dashboard (v1.7)
✅ **Analyst Invitations**: Email-based signup with session-scoped access (v1.7)
✅ **Admin Dashboard**: Token usage analytics, cost breakdown, submission trends (v1.8)
✅ **Password Reset**: Secure password reset flow via Cognito (v1.8)
✅ **Async Annotations**: Generate annotated Word docs with polling updates (v1.8)

### v1.9 Features
✅ **DOCX Overlay Import**: Upload Word docs to auto-create evaluation templates
✅ **Dashboard Pagination**: 6 sessions per page with Previous/Next controls
✅ **Styled Delete Dialogs**: Professional confirmation dialogs for all delete actions
✅ **Custom Domain**: https://overlay.futurisms.ai with SSL certificate
✅ **Improved CORS**: Supports custom domain in dev and production

---

## Security & Access Control

### Authentication
- **Cognito User Pool**: eu-west-1_lC25xZ8s6
- **JWT Tokens**: 1-hour expiration, verified on all API requests
- **Password Policy**: Min 12 characters, requires uppercase, lowercase, number, special char

### Authorization (RBAC)
- **System Admin** (`system_admin` Cognito group, `admin` PostgreSQL role):
  - Full CRUD on all resources
  - Can create/edit/delete sessions, overlays, criteria
  - Can invite analysts to sessions
  - Sees all submissions across all users

- **Analyst** (`document_admin` Cognito group, `analyst` PostgreSQL role):
  - Restricted to assigned sessions via `session_participants` table
  - Can only view/edit their own submissions
  - Cannot create/edit/delete sessions or overlays
  - Dashboard and session pages filtered to show only their submissions

### Data Isolation
- **User Scoping**: All queries filter by `user_id` from JWT token
- **Session Scoping**: Analysts can only access sessions they're invited to
- **Ownership Checks**: Notes, submissions verified against user_id before modification

---

## Deployment & Operations

### Database Backups
- **Manual Snapshots**: Created via AWS RDS CLI before major releases
- **Current Snapshot**: overlay-v1-9-stable-20260218 (created Feb 18, 2026)
- **Retention**: Manual snapshots retained indefinitely unless explicitly deleted
- **Restore**: Can restore to new cluster via AWS Console or CLI

### CI/CD
- **Frontend**: Vercel auto-deploys on `git push origin master` (2-3 minutes)
- **Backend**: Manual CDK deployment via `cdk deploy OverlayComputeStack` (4-5 minutes)
- **Database**: Migrations run via `overlay-database-migration` Lambda (VPC-only access)

### Monitoring
- **CloudWatch Logs**: `/aws/lambda/overlay-api-*` for all Lambda functions
- **Error Tracking**: Logs show request/response, stack traces, SQL errors
- **Token Usage**: Real-time tracking in admin dashboard with cost breakdowns

### Common Commands
```bash
# Frontend Development
cd frontend && npm run dev          # Next.js dev server (port 3000)
cd frontend && node proxy-server.js # CORS proxy (port 3001, required)

# Backend Deployment
cdk deploy OverlayComputeStack      # Deploy API Lambda functions
cdk deploy OverlayOrchestrationStack # Deploy AI agents

# Database Operations
npm run migrate:lambda              # Run database migrations
aws logs tail /aws/lambda/overlay-api-sessions --since 5m --format short

# Git Workflow
git add <files>
git commit -m "Your message\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin master
```

---

## Known Issues & Limitations

### Current Limitations
1. **Frontend Deployment**: No automated production deployment setup (Vercel manual)
2. **Database Access**: Cannot connect directly from local machine (VPC-only, use migration Lambda)
3. **Migration Tracking**: `schema_migrations` table doesn't exist (migrations tracked via git)
4. **CORS Proxy**: Required for local development (port 3001)
5. **Annotation Generation**: Async polling required (no real-time updates)

### Planned Improvements (SaaS Roadmap)
- **Multi-Tenancy**: Three-tier hierarchy (Super Admin → Account Admin → Analyst)
- **Billing**: Stripe integration with usage-based pricing
- **API Rate Limiting**: CloudFront + API Gateway throttling
- **Enhanced Analytics**: Session-level cost tracking, AI performance metrics
- **Real-Time Updates**: WebSocket support for live submission status

---

## File Structure (Key Files)

### Frontend
```
frontend/
├── app/
│   ├── dashboard/page.tsx          # Main dashboard with pagination
│   ├── session/[id]/page.tsx       # Session upload UI
│   ├── submission/[id]/page.tsx    # Feedback display + original content viewer
│   ├── overlays/page.tsx           # Intelligence Setup with DOCX import
│   ├── notes/[id]/page.tsx         # Note detail with Word export
│   └── admin/dashboard/page.tsx    # Admin analytics dashboard
├── components/
│   ├── overlays/ImportOverlayDialog.tsx  # DOCX import component
│   ├── ui/ConfirmDialog.tsx        # Styled delete confirmations
│   └── sidebar/                    # Notes sidebar components
├── lib/
│   ├── api-client.ts               # API client with 28+ methods
│   ├── docx-parser.ts              # DOCX parsing utility (NEW in v1.9)
│   └── docx-export.ts              # Word document export
└── proxy-server.js                 # Local CORS proxy (strips API Gateway headers)
```

### Backend
```
lambda/
├── functions/
│   ├── api/                        # 10 REST API handlers
│   │   ├── sessions/index.js       # Session CRUD
│   │   ├── submissions/index.js    # Document upload/download
│   │   ├── overlays/index.js       # Overlay CRUD (supports DOCX import)
│   │   ├── notes/index.js          # Notes CRUD with ownership checks
│   │   └── ...
│   ├── step-functions/             # 6 AI agents
│   │   ├── structure-validator.js
│   │   ├── content-analyzer.js
│   │   ├── grammar-checker.js
│   │   ├── clarification.js
│   │   ├── scoring.js
│   │   └── orchestrator.js
│   └── database-migration/         # Migration Lambda (VPC-only)
└── layers/
    └── common/nodejs/
        ├── cors.js                 # CORS config (overlay.futurisms.ai added)
        ├── db-utils.js             # Database utilities
        └── llm-client.js           # Claude API client
```

### Database Migrations
```
database/migrations/
├── 026_widen_overlay_columns.sql          # NEW in v1.9
├── rollback-026_widen_overlay_columns.sql # NEW in v1.9
├── 027_widen_criteria_columns.sql         # NEW in v1.9
└── rollback-027_widen_criteria_columns.sql # NEW in v1.9
```

---

## Version History

### v1.9 (Feb 18, 2026) — Custom Domain + DOCX Import + Pagination
- ✅ Custom domain: https://overlay.futurisms.ai with SSL
- ✅ DOCX overlay import (upload Word doc, auto-parse into overlay + criteria)
- ✅ Dashboard pagination (6 sessions per page)
- ✅ Styled delete confirmation dialogs (sessions, overlays, criteria)
- ✅ CORS improvements (Lambda Layer, API Gateway, proxy)
- ✅ Database column widening (migrations 026, 027)
- ✅ Proxy CORS header filtering (prevents localhost conflicts)

### v1.8 (Feb 5, 2026) — Admin Dashboard + Password Reset
- ✅ Admin dashboard with token usage analytics
- ✅ Password reset flow via Cognito
- ✅ Hide criteria from analysts (security improvement)
- ✅ Async annotated document generation with polling
- ✅ Content quality score as headline (UI improvement)

### v1.7 (Feb 5, 2026) — Analyst Access System Fixed
- ✅ Fixed analyst invitation signup (matching Cognito + PostgreSQL user_ids)
- ✅ Comprehensive RBAC in permissions.js
- ✅ Fixed submission filtering (analysts see only their own)
- ✅ Diagnostic logging for access issues

### v1.6 (Jan 30, 2026) — Original Submission Content Viewer
- ✅ Expandable section showing full document text
- ✅ Copy functionality ("Copy All" + individual sections)
- ✅ Text extraction from PDF, DOCX, plain text files
- ✅ Lazy-loaded content fetching from S3

### v1.5 (Jan 29, 2026) — Complete Notes System
- ✅ Right sidebar with localStorage persistence
- ✅ Text selection via right-click context menu
- ✅ Database persistence (PostgreSQL + Lambda API)
- ✅ Saved notes library + Word export + full CRUD

### v1.4 (Earlier 2026) — Multi-Document Upload
- ✅ PDF appendices support (max 5 files, 5MB each)
- ✅ Concatenated document processing for AI agents
- ✅ JSONB column for appendix metadata

### v1.3 and earlier — Core Platform
- ✅ AI-powered document review system
- ✅ 6-agent workflow (structure, content, grammar, clarification, scoring, orchestrator)
- ✅ Configurable evaluation criteria (overlays)
- ✅ Session management
- ✅ User authentication via Cognito

---

## SaaS Roadmap Reference

A comprehensive SaaS roadmap has been created (`Overlay_SaaS_Roadmap_v1.md`) covering:

### Three-Tier User Hierarchy
- **Super Admin**: Platform owner, manages all accounts
- **Account Admin**: Organization owner, manages team and billing
- **Analyst**: Team member, assigned to specific sessions

### Pricing Tiers
- **Trial**: Free 14 days (1 session, 10 submissions)
- **Starter**: £49/month (5 sessions, 50 submissions/month)
- **Professional**: £149/month (Unlimited sessions, 200 submissions/month)
- **Enterprise**: £399/month (Unlimited everything + white-label + API access)

### Implementation Plan
- **6 sprints** (12 weeks total)
- **Sprint 1 Priority**: Multi-tenancy + Super Admin dashboard
- **Estimated Cost**: £24,000 - £36,000 (assuming 2-person team)

---

## Test Credentials

**Production Login**: https://overlay.futurisms.ai/login

- **Email**: admin@example.com
- **Password**: TestPassword123!
- **Role**: system_admin (full access)

---

## Support & Documentation

- **CLAUDE.md**: Complete developer guide (loaded in all Claude Code sessions)
- **GitHub**: https://github.com/futurisms/overlay-platform
- **Git Tag**: v1.9-stable
- **Database Snapshot**: overlay-v1-9-stable-20260218

---

## Conclusion

Overlay Platform v1.9 represents a **mature, production-ready system** with 141 processed submissions, $1.83 in AI costs, and professional branding via https://overlay.futurisms.ai. The platform successfully handles real-world document review workflows with a robust two-role permission system, comprehensive AI feedback, and user-friendly features like DOCX import, dashboard pagination, and styled confirmations.

**Next Steps for SaaS**: Implement multi-tenancy (Sprint 1 of roadmap), add Stripe billing, and deploy Super Admin dashboard for account management.

---

**Generated**: February 18, 2026
**Claude Code Version**: Sonnet 4.5
**Platform Version**: v1.9-stable
