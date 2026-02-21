# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start (New Developers)

1. **Clone and Install**:
   ```bash
   git clone <repo-url>
   cd overlay-platform
   npm install          # Install backend dependencies
   cd frontend
   npm install          # Install frontend dependencies
   ```

2. **Start Development**:
   ```bash
   # Terminal 1: Frontend
   cd frontend
   npm run dev          # Starts Next.js on port 3000

   # Terminal 2: Proxy (REQUIRED)
   cd frontend
   node proxy-server.js # Starts CORS proxy on port 3001
   ```

3. **Test Login**:
   - URL: http://localhost:3000/login
   - Email: `admin@example.com`
   - Password: `TestPassword123!`

4. **First Commit**:
   ```bash
   git add <specific-files>
   git commit -m "Your message

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   git push origin master
   ```

## Project Overview

Overlay Platform is an AI-powered document review and evaluation system with a Next.js frontend and AWS Lambda backend. The system processes documents through a 6-agent AI workflow that provides structured feedback based on configurable evaluation criteria.

**Current Version**: v1.8 (UX Improvements & Dialog Polling)
**Release Date**: February 11, 2026
**Status**: Production Ready

### Two-Role System

**System Admin** (`system_admin` Cognito group, `admin` PostgreSQL role):
- Full CRUD access to all resources
- Can create/edit/delete sessions, overlays, criteria
- Can invite analysts to sessions
- Sees all submissions across all users

**Analyst** (`document_admin` Cognito group, `analyst` PostgreSQL role):
- Restricted to assigned sessions via `session_participants` table
- Can only view/edit their own submissions
- Cannot create/edit/delete sessions or overlays
- Dashboard and session detail pages filtered to show only their submissions

## Architecture

### Three-Tier Stack Structure

The project uses AWS CDK with **separate stacks** that must be deployed in order:

1. **StorageStack** - Database, VPC, S3, DynamoDB (deployed once, rarely changes)
2. **AuthStack** - Cognito User Pool (deployed once, rarely changes)
3. **ComputeStack** - 10 Lambda API handlers (deploy after handler changes)
4. **OrchestrationStack** - Lambda Layer + 6 AI agents + Step Functions (deploy after AI agent changes)

### Component Breakdown

**Frontend** (`frontend/`):
- Next.js 16.1.4 with App Router
- TypeScript + Tailwind CSS + shadcn/ui components
- 8 pages: Dashboard, Session Detail, Submission Detail, Overlays Management, Login, Note Detail
- Right sidebar with global notepad + saved notes library (v1.5 complete)
- Text selection via right-click context menu to add to notes
- Full CRUD for notes: Create, Read, Update, Delete
- Word export functionality (.docx format)
- Professional styled confirmation dialogs
- API client with JWT authentication (28+ methods)
- **Requires local proxy server** for CORS handling in development

**Backend** (`lambda/functions/api/`):
- 10 Lambda handlers (sessions, submissions, overlays, users, invitations, answers, analytics, llm-config, organizations, notes)
- REST API via API Gateway: `https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production`
- PostgreSQL Aurora Serverless v2 in private VPC

**AI Workflow** (`lambda/functions/step-functions/`):
- 6 AI agents: structure-validator, content-analyzer, grammar-checker, clarification, scoring, orchestrator
- Step Functions state machine coordinates agent execution
- Agents receive concatenated text (main document + appendices with separators)

**Database**:
- Aurora PostgreSQL 16.6 in private VPC subnets
- Migration Lambda: `overlay-database-migration` (only VPC-accessible way to run migrations)
- Key tables: `document_submissions` (with `appendix_files` JSONB column), `review_sessions`, `overlays`, `evaluation_criteria`, `user_notes`

## Local Development Setup

### Starting Development Servers

**CRITICAL**: You must run BOTH servers in separate terminals:

```bash
# Terminal 1: Start CORS proxy server (REQUIRED)
cd frontend
node proxy-server.js
# Should show: "🔄 CORS Proxy Server running on http://localhost:3001"

# Terminal 2: Start Next.js dev server
cd frontend
npm run dev
# Should show: "✓ Ready in 1176ms"
```

Frontend URL: http://localhost:3000
Proxy URL: http://localhost:3001 (proxies to API Gateway)

**Why the proxy?** API Gateway doesn't have CORS configured for localhost. The proxy adds CORS headers and forwards requests to production API Gateway.

### Environment Configuration

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### Test Credentials

- Email: `admin@example.com`
- Password: `TestPassword123!`
- Role: `system_admin` (full access)

## Common Commands

### Frontend Development

```bash
cd frontend

# Development
npm run dev              # Start Next.js dev server on port 3000
node proxy-server.js     # Start CORS proxy on port 3001 (separate terminal)

# Build
npm run build            # Build for production
npm start                # Run production build locally

# Linting
npm run lint             # Run ESLint
```

### Backend/Infrastructure

```bash
# Build CDK stacks
npm run build            # Compile TypeScript to JavaScript
npm run watch            # Watch mode for development

# Testing
npm test                 # Run Jest tests
npm run test:api         # Test API endpoints
npm run test:workflow    # Test AI workflow

# CDK Deployment
cdk diff                 # Show changes before deploying
cdk deploy OverlayStorageStack        # Deploy database/VPC (rare)
cdk deploy OverlayAuthStack           # Deploy Cognito (rare)
cdk deploy OverlayComputeStack        # Deploy API Lambdas (common)
cdk deploy OverlayOrchestrationStack  # Deploy AI agents (common)

# Database
npm run migrate:lambda   # Run database migrations via Lambda
npm run create-admin     # Create admin user
npm run seed:llm-config  # Seed LLM configuration

# Utilities
npm run query:results    # Query AI agent results
```

## Database Migration Workflow

**IMPORTANT**: Database is in private VPC - direct connections from local machine will timeout.

### Running Migrations

1. Create migration SQL file: `database/migrations/NNN_description.sql`
2. Create rollback file: `database/migrations/rollback-NNN_description.sql`
3. **Copy migration to Lambda directory**: `cp database/migrations/NNN_description.sql lambda/functions/database-migration/migrations/`
4. **Redeploy migration Lambda**: `cdk deploy OverlayStorageStack`
5. Run migration via Lambda:

```bash
npm run migrate:lambda
```

Or manually invoke:

```bash
aws lambda invoke \
  --function-name overlay-database-migration \
  --payload '{"migrationSQL": "YOUR SQL HERE"}' \
  --cli-binary-format raw-in-base64-out \
  response.json
```

### Migration Example

```sql
-- Forward migration
ALTER TABLE document_submissions
ADD COLUMN new_field VARCHAR(255);

-- Rollback migration
ALTER TABLE document_submissions
DROP COLUMN IF EXISTS new_field;
```

## Debugging with CloudWatch Logs

**Viewing Lambda Logs**:
```bash
# Tail logs in real-time (last 5 minutes)
export MSYS_NO_PATHCONV=1 && export MSYS2_ARG_CONV_EXCL="*" && \
aws logs tail /aws/lambda/overlay-api-sessions --since 5m --format short

# Other Lambda log groups:
# /aws/lambda/overlay-api-submissions
# /aws/lambda/overlay-api-invitations
# /aws/lambda/overlay-api-users
# /aws/lambda/overlay-database-migration
```

**Key Log Patterns**:
- `ERROR: User not found in database` - User exists in Cognito but not PostgreSQL
- `User query result: []` - PostgreSQL query returned no user
- `Branch: ADMIN` or `Branch: ANALYST` - Shows which permission path was taken
- `Sessions returned: 0` - No sessions found for user (check session_participants)

**Common Issues in Logs**:
1. **User ID mismatch**: Log shows Cognito `sub` but PostgreSQL query returns empty
2. **Missing permissions**: 403 errors in CloudWatch indicate permission check failures
3. **SQL errors**: Look for constraint violations or missing columns

## Deployment Workflow

### Backend Changes (API Handlers)

```bash
# 1. Deploy ComputeStack (contains API Lambda functions)
cdk deploy OverlayComputeStack

# 2. If Lambda Layer changed, also deploy:
cdk deploy OverlayOrchestrationStack
```

### AI Agent Changes

```bash
# Deploy OrchestrationStack (contains Lambda Layer + AI agents)
cdk deploy OverlayOrchestrationStack
```

### Database Schema Changes

```bash
# 1. Create migration files
# 2. Test locally if possible
# 3. Run via Lambda
npm run migrate:lambda

# 4. Deploy backend changes that use new schema
cdk deploy OverlayComputeStack
```

### Frontend Changes

**Production deployment**: Frontend is deployed on Vercel with automatic deployment from GitHub master branch.

**Deployment Flow**:
1. Push commits to `master` branch: `git push origin master`
2. Vercel automatically detects push via GitHub webhook
3. Builds Next.js application (`npm run build`)
4. Deploys to production URL
5. Deployment typically takes 2-3 minutes

**Vercel Configuration**:
- Framework: Next.js 16.1.4
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Environment Variables: Set in Vercel dashboard (match `frontend/.env.local`)

**Important Notes**:
- No need to run proxy server in production (API Gateway has CORS configured for production domain)
- Local development still requires proxy server for CORS
- Check Vercel dashboard for deployment status and logs
- Rollback available via Vercel dashboard if needed

## Critical Implementation Details

### UTF-8 Text Encoding (Fixed in v1.4)

When handling pasted text in frontend, use `TextEncoder` instead of `btoa()`:

```typescript
// ❌ WRONG: btoa() fails on Unicode characters
const textContent = btoa(pastedText);

// ✅ CORRECT: Use TextEncoder for UTF-8 support
const encoder = new TextEncoder();
const uint8Array = encoder.encode(pastedText);
const textContent = btoa(String.fromCharCode(...uint8Array));
```

Backend decodes correctly with: `Buffer.from(document_content, 'base64')`

### Multi-Document Processing

AI agents use `getDocumentWithAppendices()` utility from Lambda Layer:

```javascript
// Concatenates main document + appendices with separators
const documentText = await getDocumentWithAppendices(
  dbClient,
  submissionId,
  s3Bucket,
  s3Key
);

// Format: Main → ---APPENDIX 1: filename--- → Text1 → ---APPENDIX 2: filename--- → Text2
```

### S3 Presigned URLs

Download endpoints generate 15-minute expiring URLs:

```javascript
const command = new GetObjectCommand({
  Bucket: s3Bucket,
  Key: s3Key,
  ResponseContentDisposition: `attachment; filename="${document_name}"`,
});
const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
```

### JSONB Column Handling

The `appendix_files` column uses JSONB with GIN index:

```sql
-- Query pattern
SELECT appendix_files
FROM document_submissions
WHERE submission_id = $1;

-- Returns: [{"file_name": "...", "s3_key": "...", "file_size": 123, "upload_order": 1}]
```

### Score Display Logic (v1.8)

**IMPORTANT**: Session pages display content score, NOT overall average score.

**Rationale**:
- Overall average score (combines all 6 agents) can be misleadingly high (e.g., 77)
- Content score (structure + content analysis) better reflects document quality (e.g., 52)
- Matches what users see on submission detail page for consistency

**SQL Query Pattern** (`lambda/functions/api/sessions/index.js`):
```sql
-- Extract content score from JSONB feedback
(content::jsonb->'scores'->>'content')::numeric as overall_score

-- NOT average score:
-- (content::jsonb->'scores'->>'average')::numeric  ❌ WRONG
```

**Where Applied**:
- Session detail page submission cards
- Session list page submission counts
- Dashboard session cards

**Feedback Structure**:
```json
{
  "scores": {
    "average": 77,        // Overall average (all agents)
    "content": 52,        // Content quality score ← Used in UI
    "structure": 45,
    "grammar": 95,
    "consistency": 80
  }
}
```

### Notes Feature (v1.5) - Complete System

**Architecture**: Five-phase implementation completed:
- **Phase 1**: Right sidebar with localStorage persistence
- **Phase 2**: Text selection via right-click context menu
- **Phase 3A**: Database persistence backend (PostgreSQL + Lambda API)
- **Phase 3B**: Frontend integration for saving notes
- **Phase 5**: Saved notes library + Word export + Full CRUD

**User Workflow**:
1. User accumulates notes in persistent notepad (localStorage)
2. Right-click selected text anywhere to add to notepad
3. Click "Save Note" → enters title → saves to database
4. Click "Saved" tab → views all saved notes in list
5. Click note → view full content in detail page
6. Actions: Edit, Delete, Export to Word (.docx)
7. Notepad remains separate from saved notes (can continue taking new notes)

**Frontend Components**:

*Core System*:
- `NotesContext.tsx` - Global state with localStorage (`overlay-notes-content` key) + API integration
- `ConditionalSidebar.tsx` - Wrapper that hides sidebar on login page
- `Sidebar.tsx` - Collapsible 300px sidebar with 3 tabs (Notes, Saved, Tools)
- `TextSelectionHandler.tsx` - Right-click context menu to add selected text
- `useTextSelection.ts` - Hook for getting/clearing text selection
- `useNotes.ts` - Hook for notes context access

*Notes Tab*:
- `NotesPanel.tsx` - Textarea with Save/Clear buttons, character count
- `SaveNoteDialog.tsx` - Dialog to enter title before saving

*Saved Tab*:
- `SavedNotesPanel.tsx` - Scrollable list of saved notes with auto-refresh
- Shows: title, preview (50 chars), relative time ("2 hours ago")
- Loading, error, and empty states
- Refresh button in header

*Note Detail Page* (`/notes/[id]`):
- Full content display with metadata (created/updated dates)
- AI Summary section (blue card, if exists - future Phase 4)
- Action buttons: Back, Export to Word, Edit, Delete
- `EditNoteDialog.tsx` - Edit title and content
- `ConfirmDialog.tsx` - Professional styled confirmation dialogs

*Word Export*:
- `docx-export.ts` - Utility to generate .docx files
- Uses `docx` npm package + `file-saver`
- Formats: Title (Heading 1), AI Summary (if exists), Content (paragraphs), Footer (metadata)

**Backend Endpoints** (`/notes`):
```typescript
POST /notes           // Create note (requires: title, content, session_id?)
                      // Returns: { note_id, created_at }

GET /notes            // List user's notes (sorted by created_at DESC)
                      // Returns: { notes: [{ note_id, title, content_preview, created_at, session_id }], total }

GET /notes/{id}       // Get full note (with ownership check)
                      // Returns: { note_id, title, content, ai_summary, created_at, updated_at, session_id }

PUT /notes/{id}       // Update note (accepts: title?, content?, ai_summary?)
                      // Returns: { note_id, updated_at }

DELETE /notes/{id}    // Delete note (with ownership check)
                      // Returns: { success: true, note_id }
```

**Authentication**:
- All endpoints extract `user_id` from JWT token's `sub` claim
- Ownership verification on GET/PUT/DELETE operations (403 if not owner)
- Notes scoped per user automatically

**Database Schema**:
```sql
CREATE TABLE user_notes (
  note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID REFERENCES review_sessions(session_id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  ai_summary TEXT,                    -- For future AI summarization (Phase 4)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX idx_user_notes_session_id ON user_notes(session_id);
CREATE INDEX idx_user_notes_created_at ON user_notes(created_at DESC);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Key Implementation Details**:
- **Text Selection**: Right-click only (no floating button - positioning issues with sidebar)
- **Note Format**: Appends with bullet points: `• ${selectedText}`
- **Persistence**: localStorage for notepad, PostgreSQL for saved notes (hybrid approach)
- **Auto-Refresh**: SavedNotesPanel reloads when pathname changes (detects navigation)
- **Delete Flow**: Shows styled dialog → deletes → redirects to /dashboard → auto-refresh list
- **Character Limits**: Title max 255 chars, content unlimited
- **Word Export**: Safe filename (replaces special chars), includes metadata footer
- **Sidebar Visibility**: Hidden on login page, visible everywhere else
- **CRUD Operations**: All verify ownership, return proper HTTP status codes

**Security**:
- JWT authentication required for all endpoints
- User_id extracted from token (not request body)
- Foreign key constraints enforce referential integrity
- CASCADE delete when user deleted
- SET NULL when session deleted (notes remain accessible)

**Future Enhancements (Phase 4)**:
- AI-powered summarization of long notes
- Auto-populate `ai_summary` field using Claude API
- Display in blue card on note detail page

### Original Submission Content Viewer (v1.6)

**Purpose**: Allows users to view and copy the full text content of submitted documents and appendices directly on the submission detail page, without needing to download files.

**Architecture**:
- Backend endpoint fetches documents from S3 and extracts text
- Frontend displays content in expandable section with lazy loading
- Content only fetched when user expands the section (performance optimization)

**Backend Endpoint** (`GET /submissions/{id}/content`):
```javascript
// Returns structured JSON with decoded text content
{
  submission_id: "uuid",
  main_document: {
    name: "document.pdf",
    text: "extracted text content..."
  },
  appendices: [
    {
      fileName: "appendix1.pdf",
      text: "extracted text...",
      uploadOrder: 1
    }
  ]
}
```

**Text Extraction**:
- PDF files: Uses `pdf-parse` library
- DOCX files: Uses `mammoth` library
- Plain text: Direct UTF-8 decoding
- Handles multiple file formats automatically based on S3 key extension

**Frontend Component** (`frontend/app/submission/[id]/page.tsx`):
- **Expandable section**: Collapsed by default, positioned before "Overall Analysis Score"
- **Document count badge**: Shows total documents (e.g., "2 documents")
- **Lazy loading**: Content fetched only when section is expanded
- **Loading indicator**: Shown during content fetch
- **Copy functionality**:
  - "Copy All" button (blue, prominent, always visible in header)
  - Individual copy buttons for main document and each appendix
  - Formatted copy output with section headers and character counts
- **Display features**:
  - Monospace font for proper text formatting
  - Character counts for each section
  - Max height (400px) with internal scrolling per section
  - Visual feedback (checkmarks) when content copied

**Copy Format Example**:
```
ORIGINAL SUBMISSION
================================================================================

MAIN DOCUMENT
--------------------------------------------------------------------------------
Document: proposal.txt
Characters: 1,234

[main document text]

================================================================================

APPENDIX 1
--------------------------------------------------------------------------------
File: references.pdf
Characters: 567

[appendix 1 text]
```

**API Client Method** (`frontend/lib/api-client.ts`):
```typescript
async getSubmissionContent(submissionId: string) {
  return this.request<{
    submission_id: string;
    main_document: { name: string; text: string };
    appendices: Array<{ fileName: string; text: string; uploadOrder: number }>;
  }>(`/submissions/${submissionId}/content`);
}
```

**Implementation Details**:
- Content fetching uses existing `getDocumentFromS3` pattern from Lambda Layer
- S3 bucket and keys retrieved from `document_submissions` table
- Appendices sorted by `upload_order` field
- Error handling: Shows toast notifications on failure
- State management: Separate state for content, loading, and expansion
- No caching: Fresh content fetched each time section is expanded

**Performance Considerations**:
- Lazy loading reduces initial page load time
- Content only fetched on user action (expand)
- Large documents may take 2-5 seconds to load (shows loading indicator)
- Consider future caching if performance becomes an issue

### Auto-Logout on Token Expiration (v1.8)

**Purpose**: Gracefully handle JWT token expiration by automatically logging users out and redirecting to login page.

**Implementation** (`frontend/lib/api-client.ts`):
```typescript
// Global 401 handler in request method (after line 66)
if (response.status === 401) {
  console.log('[Auth] 401 Unauthorized - clearing tokens and redirecting to login');
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('accessToken');
    window.location.href = '/login?session=expired';
  }
  return { error: 'Session expired', status: 401 };
}
```

**Login Page Detection** (`frontend/app/login/page.tsx`):
```typescript
useEffect(() => {
  const sessionParam = searchParams.get('session');
  if (sessionParam === 'expired') {
    setError('Your session has expired. Please sign in again.');
  }
}, [searchParams]);
```

**Key Features**:
- Clears all authentication tokens from localStorage
- Redirects to `/login?session=expired`
- Shows user-friendly "session expired" error message
- Prevents showing technical 401 errors to users
- Works across all API endpoints automatically

### Submission Dialog Real-Time Polling (v1.8)

**Purpose**: Keep users informed of AI analysis progress by polling submission status and showing real-time updates in the success dialog.

**Implementation** (`frontend/app/session/[id]/page.tsx`):
```typescript
// State for dialog polling
const [dialogAnalysisStatus, setDialogAnalysisStatus] = useState<string>("pending");
const [dialogScore, setDialogScore] = useState<number | null>(null);

// Polling useEffect (polls every 5 seconds)
useEffect(() => {
  if (!successSubmissionId || !showSuccessDialog) return;

  const pollSubmission = async () => {
    try {
      const response = await apiClient.getSubmission(successSubmissionId);
      if (response.data) {
        const status = response.data.ai_analysis_status;
        setDialogAnalysisStatus(status);

        if (status === 'completed') {
          const feedbackResponse = await apiClient.getSubmissionFeedback(successSubmissionId);
          if (feedbackResponse.data?.overall_score !== undefined) {
            setDialogScore(feedbackResponse.data.overall_score);
          }
          // Auto-refresh submissions list
          const submissionsResult = await apiClient.getSessionSubmissions(sessionId);
          if (submissionsResult.data) {
            setSubmissions(submissionsResult.data.submissions || []);
          }
        }
      }
    } catch (err) {
      console.error('[Dialog Poll] Error polling submission:', err);
    }
  };

  pollSubmission(); // Poll immediately
  const intervalId = setInterval(pollSubmission, 5000); // Then every 5 seconds
  return () => clearInterval(intervalId); // Cleanup on unmount
}, [successSubmissionId, showSuccessDialog, sessionId]);
```

**UI States**:
- **Pending/In Progress** (Blue): Spinner + "AI Analysis In Progress" + "View Progress" button
- **Completed** (Green): Checkmark + "Analysis Complete! Scored X/100" + "View Results" button
- **Failed** (Red): X icon + "Analysis Failed" + "Close" button

**Key Features**:
- Polls every 5 seconds when dialog is open
- Automatically stops polling when dialog closes
- Fetches final score when analysis completes
- Auto-refreshes session submissions list
- Button label changes from "View Progress" to "View Results"
- Visual state changes (color, icon) based on status

### Dashboard Project Filtering & Pagination (v1.8)

**Purpose**: Improve navigation and organization for users with many analysis sessions.

**Features** (`frontend/app/dashboard/page.tsx`):
- **Project Filtering**: Dropdown filter with "All", "Uncategorized", and project names
- **Pagination**: 6 sessions per page with page number buttons
- **Session Counter**: Shows "Showing X-Y of Z sessions"
- **Smart Pagination**: Shows first page, last page, current page, and adjacent pages with ellipsis

**Implementation**:
```typescript
// Filter sessions by selected project
const filteredSessions = selectedProject === 'All' || !selectedProject
  ? sessions
  : selectedProject === 'Uncategorized'
  ? sessions.filter(s => !s.project_name)
  : sessions.filter(s => s.project_name === selectedProject);

// Pagination
const SESSIONS_PER_PAGE = 6;
const paginatedSessions = filteredSessions.slice(startIndex, endIndex);
```

**Key Features**:
- Resets to page 1 when filter changes
- Extracts unique project names from sessions
- Shows all projects sorted alphabetically
- Previous/Next buttons disabled at boundaries
- Responsive grid layout (1 col mobile, 2 cols desktop)

### Analyst Invitation and Signup System

**CRITICAL**: The analyst signup process must create users in BOTH Cognito and PostgreSQL with matching user_ids.

**Invitation Flow**:
1. Admin creates invitation via `/invitations` endpoint
   - Creates entry in `user_invitations` table with `session_id` and unique token
   - Sends email with signup link: `/signup?token={token}`

2. Analyst signs up via invitation link
   - Backend validates token, retrieves `session_id` from invitation
   - **MUST create Cognito user first** using `AdminCreateUserCommand`
   - **MUST use Cognito's returned user_id (sub)** as PostgreSQL user_id
   - Creates PostgreSQL user with: `user_id = cognito_sub`, `user_role = 'analyst'`
   - Creates `session_participants` entry: `(user_id, session_id, role='reviewer', status='active')`
   - Updates invitation: `accepted_at = NOW(), accepted_by = user_id`

3. Analyst logs in
   - Cognito authenticates, returns JWT with `sub` claim (user_id)
   - Backend queries: `SELECT * FROM users WHERE user_id = {sub from JWT}`
   - Permissions system uses `user_role` from PostgreSQL

**Critical Implementation in `lambda/functions/api/invitations/index.js`**:
```javascript
// Step 1: Create Cognito user FIRST
const cognitoClient = new CognitoIdentityProviderClient({ region: 'eu-west-1' });
const createUserCommand = new AdminCreateUserCommand({
  UserPoolId: process.env.USER_POOL_ID,
  Username: email,
  UserAttributes: [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' },
    { Name: 'given_name', Value: firstName },
    { Name: 'family_name', Value: lastName },
  ],
  TemporaryPassword: password,
  MessageAction: 'SUPPRESS',
});
const cognitoUser = await cognitoClient.send(createUserCommand);

// Step 2: Set permanent password
await cognitoClient.send(new AdminSetUserPasswordCommand({
  UserPoolId: process.env.USER_POOL_ID,
  Username: email,
  Password: password,
  Permanent: true,
}));

// Step 3: Add to document_admin group
await cognitoClient.send(new AdminAddUserToGroupCommand({
  UserPoolId: process.env.USER_POOL_ID,
  Username: email,
  GroupName: 'document_admin',
}));

// Step 4: Create PostgreSQL user with SAME user_id from Cognito
const userId = cognitoUser.User.Username; // This is the Cognito sub
await dbClient.query(
  `INSERT INTO users (user_id, email, username, first_name, last_name, user_role, password_hash)
   VALUES ($1, $2, $3, $4, $5, 'analyst', 'COGNITO_AUTH')`,
  [userId, email, email, firstName, lastName]
);

// Step 5: Create session_participants entry
await dbClient.query(
  `INSERT INTO session_participants (user_id, session_id, invited_by, role, status)
   VALUES ($1, $2, $3, 'reviewer', 'active')`,
  [userId, invitation.session_id, invitation.invited_by]
);
```

**Required Environment Variables**:
- `USER_POOL_ID`: Cognito User Pool ID (eu-west-1_lC25xZ8s6)

**Required IAM Permissions**:
```typescript
invitationsHandler.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'cognito-idp:AdminCreateUser',
    'cognito-idp:AdminSetUserPassword',
    'cognito-idp:AdminAddUserToGroup',
  ],
  resources: [props.userPool.userPoolArn],
}));
```

**Password Requirements**:
- Minimum 12 characters
- Must contain: uppercase, lowercase, number, special character

### Role-Based Access Control (RBAC)

**Backend Implementation** (`lambda/layers/common/nodejs/permissions.js`):

All permission checks query the `users` table to get `user_role`, then:

**Sessions Access**:
- Admins: See all active sessions
- Analysts: Query `session_participants` WHERE `user_id = {userId}` AND `status = 'active'`

**Submissions Filtering** (`lambda/functions/api/sessions/index.js`):
```javascript
// Get user role
const userQuery = await dbClient.query('SELECT user_role FROM users WHERE user_id = $1', [userId]);
const userRole = userQuery.rows[0]?.user_role;

// Build query with conditional filtering
let query = `SELECT ... FROM document_submissions WHERE session_id = $1`;
const params = [sessionId];

// Analysts can only see their own submissions
if (userRole === 'analyst') {
  query += ' AND submitted_by = $2';
  params.push(userId);
}
```

This filtering applies to:
- `GET /sessions/{id}` - Session detail with submissions list
- `GET /sessions/{id}/submissions` - Submissions endpoint
- Dashboard submission counts

**Frontend Access Control** (`frontend/app/dashboard/page.tsx`):
```typescript
// Check if user is admin
const userIsAdmin = currentUser.groups?.includes('system_admin') || false;
setIsAdmin(userIsAdmin);

// Hide admin-only UI elements for analysts
{isAdmin && (
  <Button>Create Analysis Session</Button>
)}
```

### Git Workflow

**IMPORTANT**: When committing changes:

```bash
# Never use git add . or git add -A (can accidentally add sensitive files)
# Always add specific files:
git add path/to/specific/file.ts

# Commit with co-authored tag:
git commit -m "$(cat <<'EOF'
Your commit message here.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

## Testing Checklist

After deployment, run through:

### Core Functionality
1. **Authentication**:
   - Login at http://localhost:3000/login
   - Verify sidebar NOT visible on login page
   - After login, verify sidebar appears

2. **Overlays**: View/create/edit evaluation criteria

3. **Session Upload**: Test both "Upload File" and "Paste Text" tabs

4. **Appendix Upload**: Attach PDF appendices (max 5MB each)

5. **AI Processing**: Verify status transitions (pending → in_progress → completed)

6. **Feedback Display**: Check scores, strengths, weaknesses, recommendations

7. **Download**: Test main document and appendix downloads

### Dialog Polling (v1.8)

**Real-Time Status Updates**
8. Navigate to session detail page
9. Submit a new document (file or paste text)
10. Verify success dialog appears immediately after submission
11. Verify dialog shows blue state with spinner
12. Verify button says "View Progress"
13. Keep dialog open and wait for analysis to complete (30-60 seconds)
14. Verify dialog automatically updates to green state
15. Verify checkmark icon appears
16. Verify message shows "Analysis Complete! Scored X/100"
17. Verify button changes to "View Results"
18. Click "View Results" → verify redirects to submission detail page
19. Navigate back to session detail page
20. Verify submissions list automatically refreshed (new submission shows completed status)

**Polling Behavior**
21. Submit another document
22. Open browser DevTools console
23. Verify "[Dialog Poll]" log messages appear every 5 seconds
24. Close dialog before analysis completes
25. Verify polling stops (no more console logs)
26. Check CloudWatch logs for submissions handler
27. Verify no excessive polling requests after dialog closed

**Error States**
28. Manually trigger analysis failure (if possible, via Lambda)
29. Verify dialog shows red state with X icon
30. Verify message shows "Analysis Failed"
31. Verify button says "Close" or "Retry"

**Auto-Logout Testing (v1.8)**
32. Login to application
33. Open browser DevTools → Application → Local Storage
34. Delete `auth_token` key to simulate expired token
35. Make any API request (navigate to different page)
36. Verify automatic redirect to `/login?session=expired`
37. Verify error message: "Your session has expired. Please sign in again."
38. Verify all token keys cleared from localStorage
39. Login again → verify full access restored

### Original Submission Content Viewer (v1.6)

**Viewing Original Content**
8. Navigate to any completed submission detail page
9. Locate "Original Submission" section (positioned before "Overall Analysis Score")
10. Verify section shows document count badge (e.g., "2 documents")
11. Verify "Copy All" button is visible in header (blue, prominent)
12. Click header to expand section
13. Verify loading indicator appears
14. Wait for content to load (2-5 seconds for large documents)

**Content Display**
15. Verify main document section displays:
    - Document name
    - Character count
    - Full text content in monospace font
    - "Copy" button
16. If submission has appendices, verify each appendix section displays:
    - "Appendix N" header
    - File name
    - Character count
    - Full text content
    - Individual "Copy" button
17. Verify each section has max height with internal scrolling
18. Test scrolling within content areas

**Copy Functionality**
19. Click "Copy All" button
20. Verify success toast appears
21. Paste into text editor and verify format:
    - "ORIGINAL SUBMISSION" header with separator
    - "MAIN DOCUMENT" section with metadata
    - Full main document text
    - Each appendix with "APPENDIX N" header and separator
    - Proper formatting with character counts
22. Click individual "Copy" button on main document
23. Verify checkmark appears temporarily
24. Paste and verify single section copied with header
25. Click individual "Copy" button on each appendix
26. Verify each copies correctly with formatted headers

**Edge Cases**
27. Test with submission that has only main document (no appendices)
28. Test with submission that has multiple appendices (3-5)
29. Test expanding/collapsing section multiple times
30. Verify content is re-fetched each time (no stale cache)
31. Test with very long documents (10,000+ characters)
32. Test with documents containing Unicode characters
33. Test error handling: manually trigger API error and verify toast notification

### Notes Feature (v1.5 Complete System)

**Phase 1-2: Notepad + Text Selection**
1. Open sidebar → Notes tab
2. Type notes directly in textarea
3. Verify character count updates
4. Refresh page → verify content persists (localStorage)
5. Select text in feedback → right-click → "Add to Notes"
6. Verify selected text appends with bullet point: `• ${text}`

**Phase 3: Save to Database**
7. Click "Save Note" button (only enabled when notepad has content)
8. Enter title in dialog (max 255 characters with counter)
9. See content preview in dialog
10. Click "Save Note" → verify success toast
11. Verify notepad content remains (not cleared after save)
12. Click "Clear" button → verify confirmation prompt
13. Confirm clear → verify notepad emptied + success toast

**Phase 5: Saved Notes Library**
14. Click "Saved" tab in sidebar
15. Verify list shows saved notes:
    - Title (bold, truncated if long)
    - Content preview (50 characters)
    - Relative time ("2 hours ago")
    - Total count in header
16. Click "Refresh" button → verify list updates
17. Click on a saved note → opens detail page

**Note Detail Page**
18. Verify displays:
    - Full title
    - Created date (formatted)
    - Updated date (if different from created)
    - Complete content with line breaks preserved
19. Click "Back" button → returns to previous page
20. Test all action buttons:

**Export to Word**
21. Click "Export to Word" button
22. Verify .docx file downloads
23. Open file in Microsoft Word
24. Verify formatting:
    - Title as Heading 1
    - Content with line breaks
    - Footer with generation date

**Edit Note**
25. Click "Edit" button
26. Verify dialog pre-filled with current title and content
27. Modify title and/or content
28. Click "Save Changes"
29. Verify success toast
30. Verify page reloads with updated content
31. Verify "Updated" date changes

**Delete Note**
32. Click "Delete" button
33. Verify professional confirmation dialog shows:
    - Red warning icon
    - Note title clearly displayed
    - Warning about permanent deletion
34. Click "Cancel" → dialog closes, note remains
35. Click "Delete" again → Click "Delete Note"
36. Verify success toast
37. Verify redirect to /dashboard
38. Open sidebar → Saved tab
39. Verify deleted note no longer appears in list
40. Verify note count updated

**Auto-Refresh Testing**
41. Save a new note
42. Open Saved tab → verify new note appears without manual refresh
43. Delete a note from detail page
44. Verify Saved list automatically updates after redirect

**Edge Cases**
45. Try saving empty notepad → verify error toast
46. Try saving note with empty title → verify validation error
47. Try saving note with 256+ character title → verify validation error
48. Test with Unicode characters (emojis, special chars)
49. Test with very long content (10,000+ characters)
50. Test rapid save/delete operations

## Troubleshooting

### "Failed to submit text" error
- **Cause**: Unicode characters in pasted text
- **Fix**: Use `TextEncoder` API (already fixed in v1.4)
- **Check**: Browser DevTools Console for "InvalidCharacterError"

### Submissions stuck in "pending"
- **Cause**: Step Functions workflow not triggered
- **Fix**: Verify `WORKFLOW_STATE_MACHINE_ARN` environment variable in submissions Lambda
- **Check**: CloudWatch Logs for "Started AI workflow" message

### Database connection timeout
- **Cause**: Aurora is in private VPC, not accessible from internet
- **Fix**: Use `overlay-database-migration` Lambda for all database operations
- **Never**: Try to connect directly from local machine

### API returns 500 errors
- **Check**: CloudWatch Logs for Lambda function (logs group: `/aws/lambda/overlay-api-*`)
- **Common**: JSONB cast errors - ensure `::jsonb` cast on text columns
- **Common**: Missing environment variables in Lambda configuration

### Frontend shows "Missing Authentication Token"
- **Cause**: Proxy server not running or API Gateway route not configured
- **Fix**: Start proxy with `node proxy-server.js` in frontend directory
- **Check**: Proxy logs show request being forwarded

### Analyst sees "No analysis sessions available"
- **Root Cause**: User exists in Cognito but not in PostgreSQL, OR user_id mismatch between Cognito and PostgreSQL
- **Check CloudWatch Logs**:
  ```bash
  export MSYS_NO_PATHCONV=1 && export MSYS2_ARG_CONV_EXCL="*" && \
  aws logs tail /aws/lambda/overlay-api-sessions --since 5m --format short
  ```
  Look for: "ERROR: User not found in database"

- **Debug Steps**:
  1. Verify user exists in PostgreSQL:
     ```sql
     SELECT user_id, email, user_role FROM users WHERE email = 'analyst@example.com';
     ```
  2. Get Cognito user_id from JWT token (check CloudWatch logs for `sub` claim)
  3. Compare: Does PostgreSQL user_id match Cognito `sub`?
  4. Check session_participants entry exists:
     ```sql
     SELECT * FROM session_participants
     WHERE user_id = (SELECT user_id FROM users WHERE email = 'analyst@example.com');
     ```

- **Fix user_id mismatch**: Create migration to update PostgreSQL user_id to match Cognito:
  ```sql
  DO $$
  DECLARE
    old_user_id UUID;
    new_user_id UUID := 'cognito-sub-from-jwt';
  BEGIN
    SELECT user_id INTO old_user_id FROM users WHERE email = 'analyst@example.com';

    -- Drop FK constraints temporarily
    ALTER TABLE session_participants DROP CONSTRAINT IF EXISTS session_participants_user_id_fkey;
    ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_accepted_by_fkey;

    -- Update all tables
    UPDATE session_participants SET user_id = new_user_id WHERE user_id = old_user_id;
    UPDATE user_invitations SET accepted_by = new_user_id WHERE accepted_by = old_user_id;
    UPDATE users SET user_id = new_user_id WHERE user_id = old_user_id;

    -- Re-add FK constraints
    ALTER TABLE session_participants ADD CONSTRAINT session_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
    ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_accepted_by_fkey
      FOREIGN KEY (accepted_by) REFERENCES users(user_id);
  END $$;
  ```

### Analyst sees all submissions instead of only their own
- **Root Cause**: Missing role-based filtering in session detail endpoint
- **Check**: `lambda/functions/api/sessions/index.js` - both `handleGet` and `handleGetSessionSubmissions` functions
- **Required**: Both functions must query user_role and add `WHERE submitted_by = $userId` for analysts
- **Verify**: Check CloudWatch logs for the SQL query being executed - should include `submitted_by` filter for analysts

## Project Status

**Version**: v1.8 - UX Improvements & Dialog Polling (February 11, 2026)
**Backend**: ✅ Fully deployed and operational (10 API handlers + content endpoint)
**Database**: ✅ v1.7 schema with analyst access control (21 tables, 155 indexes)
**Frontend**: ✅ Deployed on Vercel (auto-deployment from GitHub master branch)
**AI Workflow**: ✅ 6 agents processing submissions with real-time status updates
**Notes Feature**: ✅ All phases complete (sidebar, text selection, database persistence, saved library, Word export, full CRUD)
**Content Viewer**: ✅ Expandable section with lazy-loaded S3 content extraction and copy functionality
**Access Control**: ✅ Two-role system (admin/analyst) with session-based permissions and submission filtering
**Session Management**: ✅ Auto-logout on token expiration, project filtering, pagination
**Real-Time Updates**: ✅ Dialog polling for submission status, auto-refresh of session lists

### Version History

**v1.8** (February 11, 2026) - UX Improvements & Dialog Polling
- ✅ Fixed session page to show content score (52) instead of overall average (77)
- ✅ Fixed submission header to show session name instead of document name for context
- ✅ Added auto-logout on 401: clears tokens and redirects to login with "session expired" message
- ✅ Implemented real-time dialog polling: updates every 5 seconds to show completion status
- ✅ Dialog shows green/red/blue states for completed/failed/in-progress
- ✅ Auto-refreshes session submissions list when analysis completes
- ✅ Button changes from "View Progress" to "View Results" on completion
- ✅ Dashboard now has project filtering and pagination (6 sessions per page)
- ✅ Added comprehensive debug logs for submission status polling
- UX Improvements: Better error handling, real-time updates, improved navigation
- Status: Production Ready

**v1.7** (February 5, 2026) - Analyst Access System Fixed
- ✅ Fixed analyst invitation signup to create matching Cognito and PostgreSQL user_ids
- ✅ Implemented comprehensive role-based access control (RBAC) in permissions.js
- ✅ Fixed submission filtering: analysts now only see their own submissions in session detail pages
- ✅ Added diagnostic logging to sessions handler for debugging access issues
- ✅ Migration 023: Fixed user_id mismatches by temporarily dropping FK constraints
- ✅ Updated CLAUDE.md with analyst troubleshooting procedures and CloudWatch debugging
- Bug Fixes: User not found errors, permission leaks, session access issues
- Security: Proper data isolation between analysts
- Status: Production Ready

**v1.6** (January 30, 2026) - Original Submission Content Viewer
- ✅ New backend endpoint: `GET /submissions/{id}/content`
- ✅ Expandable "Original Submission" section on submission detail page
- ✅ Lazy-loaded content fetching from S3
- ✅ Text extraction from PDF, DOCX, and plain text files
- ✅ Copy functionality: "Copy All" and individual section copy
- ✅ Formatted copy output with headers and character counts
- ✅ Monospace display with scrollable sections
- ✅ Visual feedback (checkmarks) when content copied
- Features: View and copy original document text without downloading
- Performance: Lazy loading, loading indicators, error handling
- Status: Production Ready

**v1.5** (January 29, 2026) - Complete Notes System
- ✅ Phase 1: Right sidebar with localStorage persistence
- ✅ Phase 2: Text selection via right-click context menu
- ✅ Phase 3A: Database persistence backend (PostgreSQL + Lambda API)
- ✅ Phase 3B: Frontend integration for saving notes
- ✅ Phase 5: Saved notes library + Word export + Full CRUD
- ✅ Professional styled confirmation dialogs
- ✅ Auto-refresh after CRUD operations
- ✅ Sidebar hidden on login page
- Features: Save, View, Edit, Delete, Export to Word
- Security: JWT authentication, ownership verification
- Status: Production Ready

**v1.4** (Earlier 2026) - Multi-Document Upload
- PDF appendices support (max 5 files, 5MB each)
- Concatenated document processing for AI agents
- JSONB column for appendix metadata
- UTF-8 encoding fix for pasted text

**v1.3 and earlier** - Core platform functionality
- AI-powered document review system
- 6-agent workflow (structure, content, grammar, clarification, scoring, orchestrator)
- Configurable evaluation criteria (overlays)
- Session management
- User authentication via Cognito

## Key Files Reference

**Configuration**:
- `cdk.json` - CDK app configuration
- `frontend/.env.local` - Frontend environment variables
- `frontend/proxy-server.js` - Local CORS proxy configuration

**Shared Code**:
- `lambda/layers/common/nodejs/db-utils.js` - Database utilities (includes `getDocumentWithAppendices()`)
- `lambda/layers/common/nodejs/llm-client.js` - Claude API client

**API Handlers** (`lambda/functions/api/`):
- `submissions/index.js` - Document upload, download, feedback endpoints
- `sessions/index.js` - Review session CRUD + submissions list
- `overlays/index.js` - Evaluation criteria management
- `notes/index.js` - User notes CRUD with ownership verification

**AI Agents** (`lambda/functions/step-functions/`):
- All agents use same pattern: fetch document → call Claude API → store results
- Results stored in `feedback_reports` table with `report_type` field

**Frontend Key Files**:

*Layout & Structure*:
- `frontend/app/layout.tsx` - Root layout with NotesProvider and ConditionalSidebar
- `frontend/lib/api-client.ts` - API client with JWT auth (28+ methods including 5 notes endpoints)

*Main Pages*:
- `frontend/app/session/[id]/page.tsx` - Upload UI (both file and paste text)
- `frontend/app/submission/[id]/page.tsx` - Feedback display with auto-refresh (wrapped in TextSelectionHandler)
- `frontend/app/notes/[id]/page.tsx` - Note detail page with full CRUD actions

*Notes System*:
- `frontend/contexts/NotesContext.tsx` - Global notes state with localStorage + database integration
- `frontend/components/sidebar/ConditionalSidebar.tsx` - Hides sidebar on login page
- `frontend/components/sidebar/Sidebar.tsx` - Right sidebar with 3 tabs (Notes, Saved, Tools)
- `frontend/components/sidebar/NotesPanel.tsx` - Notepad textarea with Save/Clear buttons
- `frontend/components/sidebar/SavedNotesPanel.tsx` - Saved notes list with auto-refresh
- `frontend/components/sidebar/SaveNoteDialog.tsx` - Dialog for entering note title
- `frontend/components/notes/EditNoteDialog.tsx` - Dialog for editing existing notes
- `frontend/components/TextSelectionHandler.tsx` - Right-click context menu to add selected text
- `frontend/components/ui/ConfirmDialog.tsx` - Professional styled confirmation dialogs
- `frontend/lib/docx-export.ts` - Word document export utility
- `frontend/hooks/useTextSelection.ts` - Hook for getting/clearing text selection
- `frontend/hooks/useNotes.ts` - Hook for notes context access

## Documentation

Comprehensive docs in root directory:
- `TESTING_CHECKLIST.md` - Post-deployment validation
- `DEPLOYMENT_CHECKLIST.md` - Pre/post deployment procedures
- `LESSONS_LEARNED_TESTING_AND_DEBUGGING.md` - Prevention system results
- `V1.4_IMPLEMENTATION_COMPLETE.md` - Multi-document feature technical guide
- `CRITICAL_SCORE_FIX.md` - Score calculation methodology
- `SESSION_DETAIL_FIX.md` - Session data visibility fix
- `ANALYST_ROLE_DESIGN.md` - Two-role system with session access + invitations + notes filtering
- `TOKEN_TRACKING_IMPLEMENTATION.md` - Claude API token usage tracking (operational, $0.13/submission)
- `TOKEN_TRACKING_QUERIES.md` - 15 pre-built SQL queries for cost analysis
