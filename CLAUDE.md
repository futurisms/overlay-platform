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

**Current Version**: v1.5 (Complete Notes System with Database Persistence, Word Export, Full CRUD)
**Release Date**: January 29, 2026
**Status**: Production Ready

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

**Production deployment is NOT set up yet**. Frontend currently runs on localhost only.

Options discussed:
- Vercel (recommended for Next.js)
- AWS Amplify (attempted but failed with Next.js 16)
- S3 + CloudFront (requires SSR workaround for dynamic routes)

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

## Project Status

**Version**: v1.5 - Complete Notes System (January 29, 2026)
**Backend**: ✅ Fully deployed and operational (10 API handlers)
**Database**: ✅ v1.5 schema with appendices + notes support (21 tables, 127 indexes)
**Frontend**: ⚠️ Localhost only (production deployment needed)
**AI Workflow**: ✅ 6 agents processing submissions
**Notes Feature**: ✅ All phases complete (sidebar, text selection, database persistence, saved library, Word export, full CRUD)

### Version History

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
