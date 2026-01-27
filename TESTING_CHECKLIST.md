# Testing Checklist

**Purpose**: Validate all critical flows work end-to-end after deployment or code changes.

**When to run**:
- After every deployment
- After modifying Lambda handlers
- After database schema changes
- Before merging to main branch
- Before production release

---

## Pre-Testing Setup

- [ ] Proxy server running on http://localhost:3001
- [ ] Frontend dev server running on http://localhost:3000
- [ ] Valid auth token obtained (login as admin@example.com)
- [ ] Database seeded with test data
- [ ] All Lambda functions deployed to AWS

---

## 1. Critical Bug Verification (v1.2 Fixes)

**Purpose**: Verify all 9 critical bugs fixed in v1.2 are resolved

### 1.1 Score Display & Calculation
**Tests Fix #4, #5**

- [ ] Navigate to any session detail page
- [ ] Scroll to "Submissions" section
- [ ] **PASS**: Submissions show scores like "84/100" (not "/100")
- [ ] Click into a submission detail page
- [ ] Note the overall score (e.g., 84/100)
- [ ] Return to session list
- [ ] **PASS**: Same score displayed in list view
- [ ] **FAIL**: Scores missing or different → Check SQL query uses `feedback_reports` table

**Verification SQL**:
```sql
-- This query should return the Scoring Agent's final score
SELECT
  ds.document_name,
  ROUND(COALESCE(
    (fr.content::jsonb->'scores'->>'average')::numeric,
    (fr.content::jsonb->>'overall_score')::numeric
  ), 0) as overall_score
FROM document_submissions ds
LEFT JOIN feedback_reports fr ON ds.submission_id = fr.submission_id
WHERE fr.report_type = 'comment'
ORDER BY ds.submitted_at DESC;
```

### 1.2 Submissions List Visibility
**Tests Fix #6, #8**

- [ ] Navigate to session detail page
- [ ] Check header shows "Submissions (N)" where N > 0
- [ ] **PASS**: Submissions list shows N items (matches header count)
- [ ] **PASS**: Each submission shows document name, status, score
- [ ] **FAIL**: List empty despite count > 0 → Check COALESCE in score query

### 1.3 Dashboard Session Filtering
**Tests Fix #7**

- [ ] Navigate to dashboard
- [ ] Review all displayed sessions
- [ ] **PASS**: All sessions show "Active" status badge
- [ ] **PASS**: No "Archived" sessions visible
- [ ] Archive a test session: DELETE /sessions/{id}
- [ ] Refresh dashboard
- [ ] **PASS**: Archived session no longer appears
- [ ] **FAIL**: Archived sessions visible → Check `status = 'active'` filter in query

### 1.4 Criteria Persistence
**Tests Fix #1**

- [ ] Navigate to Overlays list
- [ ] Click "Edit Criteria" on any overlay
- [ ] Add new criterion:
  - Name: "Test Criterion"
  - Description: "Test description"
  - Weight: 0.2
  - Max Score: 100
- [ ] Click "Add Criterion"
- [ ] **PASS**: Success message appears
- [ ] Refresh page (F5)
- [ ] **PASS**: New criterion still visible in list
- [ ] **FAIL**: Criterion disappears → Check backend `handleUpdate` processes criteria

### 1.5 UI Status & Warnings
**Tests Fix #2, #3**

- [ ] Navigate to Edit Overlay page
- [ ] Open browser console (F12)
- [ ] **PASS**: No React key warnings
- [ ] **PASS**: All criteria show "Active" badge (not "Inactive")
- [ ] **FAIL**: Console warnings → Check React key includes fallback
- [ ] **FAIL**: "Inactive" badges → Check backend returns `is_active: true`

### 1.6 SQL Operator Error
**Tests Fix #9**

- [ ] Navigate to any session detail page
- [ ] **PASS**: Page loads without errors
- [ ] Open browser Network tab
- [ ] **PASS**: GET /sessions/{id} returns 200 status
- [ ] Check response JSON
- [ ] **PASS**: `submissions` array present in response
- [ ] **FAIL**: 500 error with "operator does not exist" → Check `::jsonb` cast in queries

**CloudWatch Verification**:
```bash
# No SQL operator errors in last 10 minutes
aws logs filter-log-events \
  --log-group-name /aws/lambda/overlay-api-sessions \
  --start-time $(($(date +%s) - 600))000 \
  --filter-pattern "operator"
# Expected: No results
```

### 1.7 Session Detail Completeness
**Tests Fix #8**

- [ ] Navigate to session detail page for session with submissions
- [ ] **PASS**: Page header shows "Submissions (N)" with N > 0
- [ ] **PASS**: Submissions section shows N items
- [ ] **PASS**: Each submission shows:
  - Document name
  - Status badge (submitted/in_review/approved/rejected)
  - Overall score (if completed)
  - Submission date
  - Submitted by name
- [ ] **FAIL**: Missing data → Check GET /sessions/{id} includes submissions query

---

## 2. Authentication Flow

**Expected outcome**: User can log in and access protected pages

- [ ] Navigate to http://localhost:3000/login
- [ ] Enter credentials: `admin@example.com` / `TestPassword123!`
- [ ] Click "Sign In"
- [ ] **PASS**: Redirected to dashboard
- [ ] **PASS**: Dashboard shows sessions and quick action cards
- [ ] **FAIL**: Login error or stuck on login page → Check Cognito configuration

**Common failure points**:
- CORS errors → Check proxy server is running
- Invalid credentials → Verify user exists in Cognito
- Token expired → Re-login to get fresh token

---

## 3. Overlay Management Flow

**Expected outcome**: Admin can create overlays and add evaluation criteria

### 2.1 View Overlays
- [ ] Click "Manage Overlays" card on dashboard
- [ ] **PASS**: Grid of overlays displayed with name, description, status, criteria count
- [ ] **FAIL**: Empty state or error → Check GET /overlays endpoint

### 2.2 Create New Overlay
- [ ] Click "Create New Overlay" button
- [ ] Fill in form:
  - Name: "Test Overlay [timestamp]"
  - Description: "Test overlay for validation"
  - Document Type: "test"
- [ ] Click "Create Overlay"
- [ ] **PASS**: Success message, redirected to edit page
- [ ] **FAIL**: Error message → Check POST /overlays endpoint

### 2.3 Add Evaluation Criteria
- [ ] On edit overlay page, click "Add New Criterion"
- [ ] Fill in form:
  - Name: "Test Criterion 1"
  - Description: "First test criterion"
  - Weight: 0.25
  - Max Score: 100
  - Category: "test"
- [ ] Click "Add Criterion"
- [ ] **PASS**: Success message AND criterion appears in list below
- [ ] **FAIL**: Success message but no criterion → Check PUT /overlays/{id} saves criteria
- [ ] **FAIL**: No success message → Check request payload and response

### 2.4 Verify Criteria Persistence
- [ ] Refresh the page (F5)
- [ ] **PASS**: Criterion still appears in list
- [ ] **FAIL**: Criterion disappeared → Check database query in GET /overlays/{id}

**Common failure points**:
- Criteria not saving → Check handleUpdate in overlays handler processes criteria field
- Schema mismatch → Verify field mapping (category↔criterion_type, weight↔max_score)
- Database constraint violations → Check weight range (0-100), criterion_type enum values

---

## 4. Session & Document Upload Flow

**Expected outcome**: User can upload documents to sessions for AI analysis

### 3.1 View Sessions
- [ ] Navigate to dashboard
- [ ] **PASS**: At least 8 review sessions displayed
- [ ] Click on a session (e.g., "Contract Review - Q1 2024")
- [ ] **PASS**: Session detail page loads with metadata
- [ ] **PASS**: Evaluation criteria displayed (if overlay has criteria)
- [ ] **FAIL**: No sessions → Check database seed data

### 3.2 Upload File
- [ ] Click "Upload File" tab
- [ ] Select a test document (PDF, DOCX, or TXT)
- [ ] Click "Upload Document"
- [ ] **PASS**: Success dialog appears with document name and green checkmark
- [ ] **PASS**: Can click "View Submission" or "Stay Here"
- [ ] **FAIL**: Browser confirm() appears → Dialog component not installed
- [ ] **FAIL**: Upload fails → Check S3 permissions, base64 encoding

### 3.3 Paste Text
- [ ] Click "Paste Text" tab
- [ ] Enter title (optional): "Test Pasted Content"
- [ ] Paste or type text content
- [ ] Click "Submit Text"
- [ ] **PASS**: Success dialog shows custom title or "Pasted Content - [date]"
- [ ] **PASS**: Document appears in submissions list
- [ ] **FAIL**: Shows "pasted-text.txt" → Title field not being sent to backend

### 3.4 Verify Submission Created
- [ ] Scroll down to submissions list
- [ ] **PASS**: New submission appears with status "pending" or "analyzing"
- [ ] **FAIL**: Submission not in list → Check POST /submissions response, refresh page

**Common failure points**:
- CORS blocking upload → Check proxy server
- File too large → Check Lambda/API Gateway payload limits
- S3 upload fails → Check IAM permissions on Lambda role
- Document name not saved → Check backend accepts document_name parameter

---

## 5. AI Processing Flow

**Expected outcome**: Step Functions workflow processes document and generates feedback

### 5.1 Manual Trigger (Current Implementation)
- [ ] Copy submission ID from submission list
- [ ] Open AWS Console → Step Functions
- [ ] Find "OverlayOrchestrator" state machine
- [ ] Click "Start execution"
- [ ] Paste JSON payload:
```json
{
  "submissionId": "SUBMISSION_UUID_HERE",
  "documentId": "DOCUMENT_UUID_HERE",
  "s3Key": "documents/FILENAME.pdf",
  "s3Bucket": "overlay-documents-XXXXX",
  "overlayId": "OVERLAY_UUID_HERE"
}
```
- [ ] **PASS**: Execution starts and completes (green status)
- [ ] **FAIL**: Execution fails → Check logs for each agent Lambda

### 5.2 Monitor Processing
- [ ] Wait 2-3 minutes for workflow to complete
- [ ] **PASS**: All 6 agents complete successfully:
  - structure-validator
  - content-analyzer
  - grammar-checker
  - orchestrator
  - clarification
  - scoring
- [ ] **FAIL**: Agent fails → Check CloudWatch logs, database connection, LLM API key

### 5.3 Automatic Trigger (Future Implementation)
⚠️ **KNOWN ISSUE**: S3 event trigger not yet connected to Step Functions
- [ ] TODO: Connect S3 event → Step Functions via EventBridge
- [ ] TODO: Test automatic trigger on upload

**Common failure points**:
- Step Functions not triggered → S3 event not wired up (manual trigger required)
- Agent timeout → Increase Lambda timeout or optimize processing
- Database connection pool exhausted → Check connection cleanup in agents
- LLM API errors → Verify Claude API key in Secrets Manager

---

## 6. Feedback Display Flow

**Expected outcome**: User can view AI-generated feedback with scores and recommendations

### 6.1 Navigate to Submission
- [ ] From submissions list, click on a completed submission
- [ ] **PASS**: Submission detail page loads
- [ ] **PASS**: Overall score displayed (0-100)
- [ ] **FAIL**: 404 error → Check submission ID is valid

### 6.2 View Overall Feedback
- [ ] **PASS**: Overall feedback paragraph displayed
- [ ] **PASS**: Copy button in top-right corner
- [ ] Click copy button
- [ ] **PASS**: Toast notification "Copied to clipboard!"
- [ ] **PASS**: Button icon changes to checkmark for 2 seconds
- [ ] **FAIL**: No feedback → Check ai_agent_results table has data

### 6.3 View Strengths/Weaknesses/Recommendations
- [ ] Click "Strengths" tab
- [ ] **PASS**: List of strengths displayed
- [ ] **PASS**: "Copy All" button in header
- [ ] Click "Copy All"
- [ ] **PASS**: Copied as numbered list to clipboard
- [ ] Repeat for "Weaknesses" and "Recommendations" tabs
- [ ] **FAIL**: Empty tabs → Check feedback parsing in GET /submissions/{id}/feedback

### 6.4 View Clarification Questions
- [ ] Scroll to "Clarification Questions" section
- [ ] **PASS**: AI-generated questions displayed (if any)
- [ ] **PASS**: Answer input field for each question
- [ ] Enter answer text
- [ ] Click "Submit Answer"
- [ ] **PASS**: Success message, answer saved
- [ ] **FAIL**: No questions → Check clarification agent output

**Common failure points**:
- Schema mismatch → Check endpoint queries ai_agent_results not feedback_reports
- JSONB parsing errors → Check content field is valid JSON
- Missing scores/feedback → Check all agents completed successfully
- Copy button not working → Check Toaster component in layout.tsx

---

## 7. Analytics & Reporting Flow

**Expected outcome**: Admin can view analytics and export session reports

### 7.1 Session Analytics
- [ ] Navigate to session detail page
- [ ] Scroll to bottom (future: analytics section)
- [ ] TODO: Test GET /sessions/{id}/report endpoint
- [ ] TODO: Verify submission counts, average scores

### 7.2 CSV Export
- [ ] TODO: Add export button to session page
- [ ] TODO: Test GET /sessions/{id}/export endpoint
- [ ] **PASS**: CSV file downloads with all submissions
- [ ] **FAIL**: Empty CSV → Check query includes ai_agent_results

**Common failure points**:
- Wrong table queried → Must use ai_agent_results not feedback_reports
- Missing data → Check JSONB field parsing

---

## 8. Integration Validation Commands

Run these commands to verify backend state:

### Check Overlays
```bash
node scripts/check-overlays.js
```
Expected: List of all overlays with criteria counts

### Check Submissions
```bash
node scripts/check-submissions.js
```
Expected: List of submissions with AI analysis status

### Check AI Agent Results
```bash
node scripts/check-ai-results.js
```
Expected: Feedback data for completed submissions

### End-to-End Test
```bash
node scripts/end-to-end-test.js
```
Expected: All tests pass (overlay creation, criteria addition, submission, feedback retrieval)

---

## Test Results Template

```
# Test Run: [DATE] [TIME]
Tester: [NAME]
Branch: [BRANCH_NAME]
Deployment: [COMMIT_SHA]

## Results Summary
- Authentication: ✅ PASS / ❌ FAIL
- Overlay Management: ✅ PASS / ❌ FAIL
- Document Upload: ✅ PASS / ❌ FAIL
- AI Processing: ✅ PASS / ❌ FAIL
- Feedback Display: ✅ PASS / ❌ FAIL

## Issues Found
1. [Issue description]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]
   - Fix: [...]

## Notes
[Any additional observations]
```

---

## Quick Smoke Test (5 minutes)

When time is limited, run this abbreviated test:

1. ✅ Login → Dashboard loads
2. ✅ Create overlay → Add criterion → Criterion saves
3. ✅ Upload document to session → Success dialog appears
4. ✅ View submission → Feedback displays
5. ✅ Copy feedback → Toast notification works

If all 5 pass, critical paths are working.

---

## Automated Test Suite

For CI/CD integration, run:
```bash
npm run test:integration
# or
node scripts/end-to-end-test.js
```

This validates all critical flows programmatically.

---

## Next Sessions to Create

**Status**: Q9, Q10, Q11 overlays created with criteria ✅

**Remaining**: Create sessions for Q12-Q18 over the next few days

### Planned Session Creation:
- [ ] **Q12 Session** - TBD
- [ ] **Q13 Session** - TBD
- [ ] **Q14 Session** - TBD
- [ ] **Q15 Session** - TBD
- [ ] **Q16 Session** - TBD
- [ ] **Q17 Session** - TBD
- [ ] **Q18 Session** - TBD

**Instructions**:
1. Create overlay first (if not exists) via "Manage Overlays"
2. Add evaluation criteria (5 criteria per overlay recommended)
3. Create session via dashboard "Create Session" button
4. Select overlay from dropdown
5. Set start/end dates appropriately

**Testing After Creation**:
- Verify session appears on dashboard
- Check evaluation criteria display on session page
- Test document upload with AI analysis
- Confirm scores display correctly

---

## v1.2 Verification Summary

All critical bugs from v1.2 release should be verified:

### Must Pass ✅:
- [ ] Scores match between list and detail views (Fix #5)
- [ ] Submissions list shows all items (Fix #6, #8)
- [ ] Dashboard shows only active sessions (Fix #7)
- [ ] Criteria save and persist (Fix #1)
- [ ] No React warnings in console (Fix #2)
- [ ] Criteria show "Active" status (Fix #3)
- [ ] Scores display with values "84/100" (Fix #4)
- [ ] No SQL operator errors (Fix #9)

### If Any Fail:
1. Check [CRITICAL_FIXES_SESSION_SUMMARY.md](CRITICAL_FIXES_SESSION_SUMMARY.md) for details
2. Verify deployment completed: `cdk deploy OverlayComputeStack`
3. Check CloudWatch logs for errors
4. Review [RELEASE_v1.2.md](RELEASE_v1.2.md) for troubleshooting

**Platform Status**: ✅ All bugs resolved, fully operational
