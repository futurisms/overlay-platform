# Overlay Platform - System Overview

**Last Updated**: January 25, 2026 (v1.1)
**Status**: Production Ready
**Architecture Type**: Serverless, Event-Driven, Microservices

---

## Purpose

The Overlay Platform is an **AI-powered document evaluation system** designed for assessing grant applications, funding proposals, and other formal documents against predefined evaluation criteria.

### Problem It Solves

Organizations need to evaluate hundreds of grant applications consistently, but:
- Manual evaluation is time-consuming and inconsistent
- Evaluators have different interpretations of criteria
- Feedback quality varies between reviewers
- No systematic way to track evaluation history

### Solution

An automated AI evaluation platform that:
- ✅ Evaluates documents against customizable criteria (overlays)
- ✅ Provides consistent, structured feedback (scores, strengths, weaknesses, recommendations)
- ✅ Generates clarification questions for unclear sections
- ✅ Maintains evaluation history and analytics
- ✅ Supports both file uploads (PDF/DOCX/DOC/TXT) and direct text paste

---

## User Roles

### 1. System Administrators
**Capabilities**:
- Create and manage evaluation overlays (templates)
- Define evaluation criteria with weights
- Configure LLM agent parameters
- View platform analytics

**Typical Users**: Grant program managers, funding organization administrators

### 2. Evaluators
**Capabilities**:
- Create review sessions for specific overlays
- Invite reviewers and moderators
- Monitor submission status
- Review AI-generated feedback
- Download evaluation reports

**Typical Users**: Grant reviewers, program officers, evaluation committees

### 3. Applicants/Submitters
**Capabilities**:
- Submit documents for evaluation (upload or paste text)
- View AI feedback (scores, strengths, weaknesses)
- Answer clarification questions
- Track submission status

**Typical Users**: Grant applicants, proposal writers, organizations seeking funding

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USER INTERFACE                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Next.js 15 Frontend (TypeScript + Tailwind CSS)              │    │
│  │  - Dashboard, Sessions, Submissions, Overlays                  │    │
│  │  - Real-time status updates (polling every 10s)               │    │
│  │  - Tabbed interface: Upload File / Paste Text                 │    │
│  └────────────────┬──────────────────────────┬────────────────────┘    │
│                   │                          │                          │
│                   │  CORS Proxy :3001        │  Direct (Production)     │
│                   │  (Development Only)       │                          │
└───────────────────┼──────────────────────────┼──────────────────────────┘
                    │                          │
                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (AWS)                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  API Gateway REST API                                          │    │
│  │  - Cognito JWT Authorizer                                      │    │
│  │  - 39+ endpoints (CRUD operations)                            │    │
│  │  - Request/response validation                                 │    │
│  └────────────────┬──────────────────────────────────────────────┘    │
│                   │                                                      │
│                   ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  9 Lambda Functions (Node.js 20.x)                            │    │
│  │  - organizations-handler                                       │    │
│  │  - overlays-crud-handler                                       │    │
│  │  - sessions-crud-handler                                       │    │
│  │  - submissions-crud-handler ⭐ (triggers AI workflow)         │    │
│  │  - users-handler                                               │    │
│  │  - invitations-handler                                         │    │
│  │  - answers-handler                                             │    │
│  │  - analytics-handler                                           │    │
│  │  - llm-config-handler                                          │    │
│  └────────────────┬──────────────────────────────────────────────┘    │
└───────────────────┼──────────────────────────────────────────────────────┘
                    │
                    ├──────────────┐
                    ▼              ▼
┌──────────────────────────┐  ┌──────────────────────────────────────────┐
│  AWS Step Functions      │  │  Data Storage                            │
│  (AI Orchestration)      │  │                                          │
│                          │  │  ┌────────────────────────────────────┐ │
│  ┌─────────────────────┐ │  │  │  Aurora PostgreSQL Serverless v2  │ │
│  │ Structure Validator │ │  │  │  - 15+ tables                     │ │
│  │ (30s)              │ │  │  │  - JSONB columns for flexibility  │ │
│  └──────┬──────────────┘ │  │  │  - VPC private subnets           │ │
│         │                 │  │  └────────────────────────────────────┘ │
│  ┌──────▼──────────────┐ │  │                                          │
│  │ Content Analyzer    │ │  │  ┌────────────────────────────────────┐ │
│  │ (45s)              │ │  │  │  S3 Bucket (Documents)             │ │
│  └──────┬──────────────┘ │  │  │  - PDFs, DOCX, DOC, TXT files     │ │
│         │                 │  │  │  - Pasted text stored as .txt     │ │
│  ┌──────▼──────────────┐ │  │  │  - Organized by user/timestamp   │ │
│  │ Grammar Checker     │ │  │  └────────────────────────────────────┘ │
│  │ (30s)              │ │  │                                          │
│  └──────┬──────────────┘ │  │  ┌────────────────────────────────────┐ │
│         │                 │  │  │  DynamoDB (LLM Config)             │ │
│  ┌──────▼──────────────┐ │  │  │  - Agent parameters               │ │
│  │ Clarification       │ │  │  │  - Model selection                │ │
│  │ (30s)              │ │  │  └────────────────────────────────────┘ │
│  └──────┬──────────────┘ │  │                                          │
│         │                 │  │  ┌────────────────────────────────────┐ │
│  ┌──────▼──────────────┐ │  │  │  Secrets Manager                   │ │
│  │ Scoring            │ │  │  │  - Database credentials            │ │
│  │ (15s)              │ │  │  │  - Claude API key                  │ │
│  └──────┬──────────────┘ │  │  └────────────────────────────────────┘ │
│         │                 │  └──────────────────────────────────────────┘
│         │ Save Results    │
│         ▼                 │
│  feedback_reports table   │
│  (JSONB content)         │
└──────────────────────────┘

                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Anthropic Claude API                                          │    │
│  │  - Model: claude-sonnet-4-5-20250929                          │    │
│  │  - Used by all 6 AI agents                                    │    │
│  │  - Context window: 200K tokens                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|----------|
| **Framework** | Next.js | 15.x | Server-side rendering, routing |
| **Language** | TypeScript | 5.x | Type safety |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **UI Components** | shadcn/ui (Radix UI) | Latest | Accessible components |
| **Icons** | Lucide React | Latest | Icon library |
| **State Management** | React Hooks | 18.x | useState, useEffect |
| **API Client** | Custom fetch wrapper | - | JWT token management |
| **Dev Proxy** | Node.js HTTP proxy | - | CORS workaround (dev only) |

**Key Files**:
- `frontend/app/` - Next.js App Router pages
- `frontend/components/ui/` - shadcn/ui components
- `frontend/lib/api-client.ts` - API integration
- `frontend/lib/auth.ts` - Authentication utilities
- `frontend/proxy-server.js` - Development CORS proxy

### Backend (AWS Infrastructure)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|----------|
| **IaC** | AWS CDK | 2.x | Infrastructure as Code |
| **Language** | TypeScript (CDK) + Node.js (Lambda) | 20.x | CDK stacks + Lambda runtime |
| **API Gateway** | AWS REST API | - | HTTP endpoints |
| **Compute** | AWS Lambda | Node.js 20.x | Serverless functions |
| **Orchestration** | AWS Step Functions | - | AI agent workflow |
| **Database** | Aurora PostgreSQL Serverless v2 | 15.x | Relational data |
| **Storage** | Amazon S3 | - | Document storage |
| **Config Store** | Amazon DynamoDB | - | LLM configuration |
| **Secrets** | AWS Secrets Manager | - | Credentials storage |
| **Authentication** | Amazon Cognito | - | User management + JWT |
| **Monitoring** | CloudWatch Logs | - | Logging and debugging |

**Key Stacks** (CDK):
- `lib/auth-stack.ts` - Cognito User Pool
- `lib/storage-stack.ts` - Aurora, S3, DynamoDB
- `lib/compute-stack.ts` - API Gateway + 9 Lambda functions
- `lib/orchestration-stack.ts` - Step Functions + 6 AI agents

### AI/ML Layer

| Component | Technology | Purpose |
|-----------|-----------|----------|
| **LLM Provider** | Anthropic Claude API | Document analysis |
| **Model** | claude-sonnet-4-5-20250929 | Latest Sonnet 4.5 |
| **Agents** | 6 specialized Lambda functions | Structure, Content, Grammar, Clarification, Scoring, Orchestration |
| **Text Extraction** | mammoth (DOCX), pdf-parse (PDF) | Convert documents to text |
| **Workflow Engine** | AWS Step Functions | Sequential agent execution |
| **Context Window** | 200K tokens | Handles large documents |

**Key Files**:
- `lambda/functions/structure-validator/` - Document structure validation
- `lambda/functions/content-analyzer/` - Content quality analysis
- `lambda/functions/grammar-checker/` - Grammar and style checking
- `lambda/functions/clarification/` - Question generation
- `lambda/functions/scoring/` - Final score calculation
- `lambda/functions/orchestrator/` - Workflow coordination

---

## Core Components

### 1. Frontend (Next.js Application)

**Location**: `frontend/`

**Purpose**: User interface for document submission and feedback viewing

**Key Features**:
- 📊 Dashboard with session overview
- 📝 Tabbed submission interface (Upload File / Paste Text)
- 📈 Real-time status updates (polling every 10s)
- 🎯 Evaluation criteria display before submission
- 💬 Clarification Q&A interface
- 📄 Detailed feedback view (scores, strengths, weaknesses, recommendations)
- ⚙️ Overlay management (admin only)

**Pages**:
- `/` - Landing page
- `/login` - Authentication
- `/dashboard` - Session list
- `/session/[id]` - Session detail with submission interface
- `/submission/[id]` - Submission detail with AI feedback
- `/overlays` - Overlay management
- `/overlays/[id]` - Edit overlay criteria

**Technology Decisions**:
- **Why Next.js 15?** Server-side rendering for SEO, App Router for modern patterns
- **Why Tailwind CSS?** Rapid prototyping, consistent design system
- **Why shadcn/ui?** Accessible, customizable, TypeScript-native components
- **Why polling instead of WebSockets?** Simpler implementation, sufficient for use case

### 2. API Layer (AWS Lambda + API Gateway)

**Location**: `lambda/functions/api/`

**Purpose**: RESTful API for CRUD operations and business logic

**9 Lambda Handlers**:

1. **organizations-handler** (`lambda/functions/api/organizations/`)
   - Routes: GET/POST/PUT/DELETE /organizations
   - Purpose: Manage organizations

2. **overlays-crud-handler** (`lambda/functions/api/overlays/`)
   - Routes: GET/POST/PUT/DELETE /overlays
   - Purpose: Manage evaluation templates with criteria
   - Critical: Returns document context (purpose, when_used, process_context, target_audience)

3. **sessions-crud-handler** (`lambda/functions/api/sessions/`)
   - Routes: GET/POST/PUT/DELETE /sessions, GET /sessions/available
   - Purpose: Manage review sessions
   - Additional: GET /sessions/{id}/report (analytics)

4. **submissions-crud-handler** ⭐ (`lambda/functions/api/submissions/`)
   - Routes: GET/POST/PUT/DELETE /submissions
   - Purpose: Handle document submissions
   - **CRITICAL**: Triggers Step Functions workflow via `StartExecutionCommand`
   - Additional: GET /submissions/{id}/feedback (returns AI analysis)
   - Environment Variable Required: `WORKFLOW_STATE_MACHINE_ARN`

5. **users-handler** (`lambda/functions/api/users/`)
   - Routes: GET/POST/PUT/DELETE /users
   - Purpose: User profile management

6. **invitations-handler** (`lambda/functions/api/invitations/`)
   - Routes: POST /sessions/{id}/invite, GET /invitations
   - Purpose: Session invitation workflow

7. **answers-handler** (`lambda/functions/api/answers/`)
   - Routes: GET/POST /submissions/{id}/answers
   - Purpose: Clarification answer submission

8. **analytics-handler** (`lambda/functions/api/analytics/`)
   - Routes: GET /analytics/overview, GET /analytics/submissions
   - Purpose: Platform usage analytics

9. **llm-config-handler** (`lambda/functions/api/llm-config/`)
   - Routes: GET/PUT /llm-config/{agentName}
   - Purpose: LLM agent configuration (admin only)
   - Storage: DynamoDB table `overlay-llm-config`

**Technology Decisions**:
- **Why Lambda?** Serverless, auto-scaling, pay-per-use
- **Why Node.js 20?** Modern JavaScript, async/await, fast cold starts
- **Why API Gateway REST API?** Simple, well-documented, integrates with Cognito
- **Why Cognito JWT?** Built-in authentication, no custom auth code needed

### 3. AI Orchestration Layer (Step Functions + Lambda)

**Location**: `lambda/functions/` (6 AI agent folders)

**Purpose**: Sequential AI analysis of submitted documents

**Workflow** (defined in `lib/orchestration-stack.ts`):

```
1. Structure Validator (30s)
   ↓ Validates document format and structure
2. Content Analyzer (45s)
   ↓ Evaluates content against criteria
3. Grammar Checker (30s)
   ↓ Checks grammar, spelling, style
4. Clarification (30s)
   ↓ Generates clarification questions
5. Scoring (15s)
   ↓ Calculates overall score and feedback
```

**Total Duration**: ~150 seconds (2.5 minutes)

**Key Features**:
- ✅ Sequential execution (results passed between agents)
- ✅ Retry logic (3 attempts with exponential backoff)
- ✅ Error handling (continue workflow even if one agent fails)
- ✅ State management (Step Functions maintains execution state)
- ✅ CloudWatch logging (detailed execution logs)

**Technology Decisions**:
- **Why Step Functions?** Visual workflow, built-in retries, state management
- **Why sequential?** Each agent builds on previous results
- **Why Lambda for agents?** Isolated execution, easy testing, independent deployment

### 4. Data Storage Layer

**Database**: Aurora PostgreSQL Serverless v2

**Location**: `lambda/functions/database-migration/migrations/`

**15+ Tables** (see `03_DATABASE_SCHEMA.md` for details):
- `overlays` - Evaluation templates
- `evaluation_criteria` - Criteria with weights
- `review_sessions` - Evaluation sessions
- `document_submissions` - Submitted documents
- `feedback_reports` ⭐ - AI-generated feedback (JSONB)
- `clarification_questions` - AI-generated questions
- `clarification_answers` - User responses
- ... and 8 more tables

**S3 Bucket**: `overlay-docs-{account-id}`

**Purpose**: Document storage (PDF, DOCX, DOC, TXT, pasted text)

**Structure**:
```
overlay-docs-975050116849/
├── submissions/
│   └── {user-id}/
│       ├── {timestamp}-{filename}.pdf
│       ├── {timestamp}-{filename}.docx
│       └── {timestamp}-pasted-text.txt
```

**DynamoDB Table**: `overlay-llm-config`

**Purpose**: LLM agent configuration (model selection, parameters)

**Technology Decisions**:
- **Why Aurora Serverless v2?** Auto-scaling, PostgreSQL compatibility, JSONB support
- **Why S3 for documents?** Cost-effective, unlimited storage, built-in versioning
- **Why DynamoDB for config?** Low-latency reads, schema flexibility
- **Why JSONB in PostgreSQL?** Flexible schema for AI results, queryable JSON

---

## Key Architectural Decisions

### 1. Why Serverless Architecture?

**Decision**: Use AWS Lambda + API Gateway + Step Functions instead of EC2/ECS

**Reasons**:
- ✅ **Auto-scaling**: Handles 1 or 1000 requests without configuration
- ✅ **Cost**: Pay only for actual usage, no idle server costs
- ✅ **Maintenance**: No OS patching, security updates handled by AWS
- ✅ **Development Speed**: Focus on business logic, not infrastructure
- ✅ **Reliability**: Built-in redundancy and fault tolerance

**Trade-offs**:
- ❌ Cold start latency (~1-2 seconds for first request)
- ❌ 15-minute Lambda timeout (adequate for our use case)
- ❌ Vendor lock-in (mitigated by using standard patterns)

### 2. Why Next.js for Frontend?

**Decision**: Use Next.js 15 instead of React SPA or traditional server-side framework

**Reasons**:
- ✅ **Server-Side Rendering**: Better SEO, faster initial page load
- ✅ **App Router**: Modern routing with React Server Components
- ✅ **TypeScript**: Type safety across frontend
- ✅ **File-based Routing**: Intuitive page organization
- ✅ **API Routes**: Backend for frontend (BFF) pattern (not used in v1.1)

**Trade-offs**:
- ❌ Learning curve for App Router (newer pattern)
- ❌ Build complexity (requires Node.js server for SSR in production)

### 3. Why Step Functions for AI Orchestration?

**Decision**: Use Step Functions instead of Lambda chaining or custom orchestration

**Reasons**:
- ✅ **Visual Workflow**: Easy to understand agent execution order
- ✅ **Built-in Retries**: Exponential backoff without custom code
- ✅ **State Management**: Automatic state persistence between steps
- ✅ **Error Handling**: Continue workflow even if one agent fails
- ✅ **Monitoring**: CloudWatch integration for debugging
- ✅ **Durability**: Execution history retained for 90 days

**Trade-offs**:
- ❌ Cost per execution (~$0.025 per 1000 state transitions)
- ❌ Complexity in local testing (requires AWS SAM or mocking)

### 4. Why Aurora Serverless v2?

**Decision**: Use Aurora Serverless v2 instead of RDS, DynamoDB, or Aurora Serverless v1

**Reasons**:
- ✅ **Auto-scaling**: Scales down to 0.5 ACU (Aurora Capacity Units) when idle
- ✅ **PostgreSQL**: Rich SQL features, JSONB support
- ✅ **Predictable Performance**: No cold starts (unlike v1)
- ✅ **VPC Integration**: Secure database access from Lambda
- ✅ **Backup & HA**: Automated backups, multi-AZ replication

**Trade-offs**:
- ❌ Minimum cost even when idle (~$40/month at 0.5 ACU)
- ❌ VPC complexity (Lambda functions need VPC access)

### 5. Why Paste Text Feature?

**Decision**: Add direct text paste option in v1.1 instead of file-upload-only

**Reasons**:
- ✅ **User Experience**: 50% faster workflow (no file creation needed)
- ✅ **Collaboration**: Easy to paste from emails, chats, documents
- ✅ **Testing**: Quick testing of evaluation criteria
- ✅ **Accessibility**: Works on mobile devices without file system access
- ✅ **Consistent Architecture**: Text stored in S3 like files, same AI workflow

**Implementation**: See `PASTE_TEXT_FEATURE.md` for details

---

## System Boundaries

### In Scope
- ✅ Document submission (upload or paste)
- ✅ AI evaluation (6 agents)
- ✅ Feedback display (scores, strengths, weaknesses, recommendations)
- ✅ Clarification Q&A
- ✅ Overlay management (evaluation templates)
- ✅ Session management (review sessions)
- ✅ User authentication (Cognito)
- ✅ Analytics (basic usage metrics)

### Out of Scope (v1.1)
- ❌ Real-time collaboration (multiple users editing simultaneously)
- ❌ Document versioning (track changes over time)
- ❌ Advanced search (full-text search across submissions)
- ❌ Batch processing (evaluate multiple documents at once)
- ❌ Custom AI models (only Claude Sonnet 4.5 supported)
- ❌ Integration with external systems (e.g., Salesforce, Jira)

---

## Performance Characteristics

### Frontend
- **Initial Page Load**: ~1-2 seconds (SSR)
- **Subsequent Navigation**: ~100-300ms (client-side routing)
- **API Calls**: ~200-500ms (Lambda cold start) or ~50-100ms (warm)

### Backend
- **API Gateway → Lambda**: ~10-50ms overhead
- **Lambda Execution**: ~100-300ms for CRUD operations
- **Database Queries**: ~20-100ms (Aurora Serverless v2)
- **S3 Upload**: ~500ms-2s (depends on file size)

### AI Workflow
- **Total Duration**: ~150 seconds (2.5 minutes)
- **Structure Validator**: ~30 seconds
- **Content Analyzer**: ~45 seconds (most complex)
- **Grammar Checker**: ~30 seconds
- **Clarification**: ~30 seconds
- **Scoring**: ~15 seconds

**Note**: Times are averages for typical documents (1,000-5,000 words)

---

## Security Model

### Authentication
- **Method**: Amazon Cognito with JWT tokens
- **Token Expiry**: 24 hours
- **Storage**: Browser localStorage (development), HttpOnly cookies (production recommended)
- **Flow**: Login → Cognito → JWT IdToken → API Gateway Authorizer

### Authorization
- **Method**: Cognito User Groups (system_admin, evaluator, applicant)
- **Enforcement**: Lambda function checks user groups
- **Principle**: Least privilege (users can only access their own data)

### Data Security
- **In Transit**: HTTPS for all API calls
- **At Rest**:
  - Aurora: Encrypted with AWS KMS
  - S3: Server-side encryption (AES-256)
  - Secrets Manager: Encrypted credentials
- **VPC**: Database and Lambda functions in private subnets
- **IAM**: Principle of least privilege for all roles

### API Security
- **Rate Limiting**: API Gateway throttling (10,000 requests/second)
- **Input Validation**: Request body validation in Lambda
- **SQL Injection**: Parameterized queries (no string concatenation)
- **XSS**: React escapes output by default
- **CSRF**: SameSite cookies (production), CORS proxy (development)

---

## Scalability

### Current Limits (v1.1)
- **Concurrent Users**: ~1,000 (Cognito limit)
- **Concurrent Lambda Executions**: 1,000 (default AWS limit, can be increased)
- **Aurora Connections**: 90 connections per ACU (scalable)
- **S3 Storage**: Unlimited
- **API Gateway**: 10,000 requests/second (throttling)

### Scaling Strategy
- **Horizontal**: Lambda auto-scales to handle load
- **Database**: Aurora Serverless v2 auto-scales ACUs (0.5-128)
- **Storage**: S3 scales automatically
- **Caching**: (Future) CloudFront CDN for static assets

### Bottlenecks
- ⚠️ **AI API Rate Limits**: Anthropic Claude API has rate limits (100 requests/minute)
- ⚠️ **Step Functions**: 25,000 concurrent executions (can be increased)
- ⚠️ **Database Connections**: Lambda concurrency * connections per Lambda (mitigated with connection pooling)

---

## Monitoring & Observability

### Logging
- **CloudWatch Logs**: All Lambda functions log to CloudWatch
- **Log Groups**: `/aws/lambda/{function-name}`
- **Retention**: 30 days (configurable)
- **Search**: CloudWatch Insights for log queries

### Metrics
- **Lambda**: Invocations, duration, errors, throttles
- **API Gateway**: Request count, latency, 4xx/5xx errors
- **Step Functions**: Execution count, success rate, duration
- **Aurora**: CPU, memory, connections, queries

### Tracing
- **X-Ray**: (Future) Distributed tracing across services
- **Correlation IDs**: Request IDs passed between services

### Alerting
- **CloudWatch Alarms**: (Future) Alert on errors, high latency, throttling
- **SNS Topics**: (Future) Email/SMS notifications

---

## Disaster Recovery

### Backup Strategy
- **Aurora**: Automated daily backups (retained 7 days)
- **S3**: Versioning enabled, cross-region replication (future)
- **DynamoDB**: Point-in-time recovery enabled

### Recovery Time Objective (RTO)
- **Database**: ~5 minutes (restore from backup)
- **Lambda**: ~1 minute (redeploy from CDK)
- **S3**: Immediate (data always available)

### Recovery Point Objective (RPO)
- **Database**: ~5 minutes (last automated backup)
- **S3**: 0 seconds (no data loss)

---

## Cost Estimate (Monthly)

**Assumptions**: 1,000 submissions/month, 500 active users

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | 9 API handlers + 6 AI agents, 15,000 invocations | $10 |
| API Gateway | 15,000 requests | $0.05 |
| Step Functions | 1,000 executions | $25 |
| Aurora Serverless v2 | 0.5-2 ACU, 24/7 | $50-200 |
| S3 | 10 GB storage + 1,000 uploads | $0.25 |
| Cognito | 500 MAUs (Monthly Active Users) | $0 (free tier) |
| CloudWatch | 5 GB logs | $2.50 |
| **Total** | | **~$90-240/month** |

**Note**: Largest cost is database (Aurora) and Step Functions executions

---

## Deployment Model

### Environments
- **Development**: Local (frontend) + AWS (backend)
- **Staging**: (Future) Separate AWS account/region
- **Production**: AWS eu-west-1 (Ireland)

### Deployment Strategy
- **Infrastructure**: AWS CDK (`cdk deploy`)
- **Frontend**: Vercel/AWS Amplify (production), local dev server (development)
- **Database Migrations**: Lambda function (`overlay-database-migration`)

### Rollback Strategy
- **Infrastructure**: `cdk deploy` previous version
- **Database**: Restore from backup (use with caution)
- **Frontend**: Revert Git commit, redeploy

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| **v1.1** | 2026-01-25 | Paste text submission, feedback display fixes, SQL column name fixes |
| **v1.0** | 2026-01-20 | Initial production release, 9 API handlers, 6 AI agents, complete UI |

---

## References

- **Architecture Details**: See other documents in `docs/architecture/`
- **Deployment Guide**: See `09_DEPLOYMENT.md`
- **Database Schema**: See `03_DATABASE_SCHEMA.md`
- **LLM Orchestration**: See `05_LLM_ORCHESTRATION.md`
- **Data Flow**: See `01_DATA_FLOW.md`

---

**Last Updated**: January 25, 2026
**Document Owner**: Technical Architecture Team
**Next Review**: February 2026 (before adding semantic learning feature)
