# CURRENT PRODUCTION TEST - MANUAL EXECUTION
**Date:** 2026-02-01 08:45 UTC
**Purpose:** Verify what's WORKING vs BROKEN in current deployed state
**Status:** Pre-Migration Testing (Database at 006, Lambda has mixed state)

---

## Test Prerequisites

**Frontend Servers Must Be Running:**
```bash
# Terminal 1: CORS Proxy
cd frontend
node proxy-server.js
# Expected: "🔄 CORS Proxy Server running on http://localhost:3001"

# Terminal 2: Next.js Dev Server
cd frontend
npm run dev
# Expected: "✓ Ready in ~1s"
```

**Test Credentials:**
- Email: `admin@example.com`
- Password: `TestPassword123!`

---

## Test Results Template

| Test # | Feature | Status | Notes |
|--------|---------|--------|-------|
| 1 | Login | ? | |
| 2 | Dashboard Loads | ? | |
| 3 | View Existing Submission | ? | |
| 4 | AI Analysis for New Submission | ? | |

**Status Legend:**
- ✅ WORKING - Feature functions correctly
- ❌ BROKEN - Feature fails with error
- ⚠️ PARTIAL - Feature loads but data missing/incomplete
- ❓ UNKNOWN - Could not test (no data, blocked by previous failure)

---

## Test 1: Login Authentication

**Steps:**
1. Open browser to http://localhost:3000
2. Should auto-redirect to http://localhost:3000/login
3. Enter credentials:
   - Email: `admin@example.com`
   - Password: `TestPassword123!`
4. Click "Sign in" button

**Expected Behavior:**
- Login form submits without errors
- Redirects to http://localhost:3000/dashboard
- JWT token stored in localStorage

**How to Verify:**
- Open Browser DevTools → Console
- Run: `localStorage.getItem('auth_token')`
- Should return a JWT token string

**Record Result:**
```
Status: [ ] WORKING  [ ] BROKEN  [ ] PARTIAL
Error Message (if any):
Screenshot (if broken):
```

---

## Test 2: Dashboard Loads

**Prerequisites:** Must pass Test 1 (logged in)

**Steps:**
1. After successful login, verify dashboard URL: http://localhost:3000/dashboard
2. Wait 3-5 seconds for data to load
3. Check if page shows:
   - "Review Sessions" heading
   - List of sessions (or "No review sessions found")
   - Session cards with overlay names, dates, status

**Expected Behavior:**
- Dashboard renders without JavaScript errors
- API call to `/sessions` succeeds (check Network tab)
- Session list displays (may be empty or have data)

**How to Verify:**
- Open Browser DevTools → Network tab
- Look for request to: `http://localhost:3001/sessions`
- Status should be: 200 OK
- Response should be JSON array

**Record Result:**
```
Status: [ ] WORKING  [ ] BROKEN  [ ] PARTIAL
Sessions Displayed:
API Response Status:
Error Message (if any):
Screenshot:
```

---

## Test 3: View Existing Submission

**Prerequisites:**
- Must pass Test 1 (logged in)
- Must pass Test 2 (dashboard loads)
- Must have at least 1 existing submission in database

**Steps:**
1. From dashboard, click on any session card to open session detail page
2. URL should be: http://localhost:3000/session/{session-id}
3. Wait for submissions list to load
4. Click on any submission to open submission detail page
5. URL should be: http://localhost:3000/submission/{submission-id}
6. Wait 3-5 seconds for feedback to load

**Expected Behavior:**
- Submission detail page loads without errors
- Shows document information (name, upload date, status)
- Shows feedback section with:
  - Overall score (0-100)
  - Strengths, weaknesses, recommendations
  - Individual criterion scores
- Download buttons work (main document + appendices if any)

**How to Verify:**
- Check Network tab for API calls:
  - GET `/submissions/{id}` → 200 OK
  - GET `/submissions/{id}/feedback` → 200 OK
- Verify feedback data displays on page
- Test "Download Document" button (should trigger download)

**Record Result:**
```
Status: [ ] WORKING  [ ] BROKEN  [ ] PARTIAL
Submission ID Tested:
Feedback Displayed: [ ] Yes  [ ] No
Overall Score Shown: [ ] Yes  [ ] No
Download Works: [ ] Yes  [ ] No
API Response Status:
Error Message (if any):
Screenshot:
```

---

## Test 4: AI Analysis for New Submission

**Prerequisites:**
- Must pass Test 1 (logged in)
- Must pass Test 2 (dashboard loads)
- Must have at least 1 session with status "in_progress"

**Test 4A: Upload via "Paste Text" (Fastest Test)**

**Steps:**
1. Navigate to session detail: http://localhost:3000/session/{session-id}
2. Click "Submit Document" button
3. Select "Paste Text" tab
4. Paste sample text:
   ```
   This is a test document submission to verify AI workflow functionality.

   Section 1: Introduction
   This document tests the multi-agent AI analysis system.

   Section 2: Content
   The system should analyze structure, content, and grammar.

   Section 3: Conclusion
   Testing complete.
   ```
5. Enter document name: "Test Submission - Production Check"
6. Click "Submit Text" button

**Expected Behavior:**
- Upload succeeds without errors
- New submission appears in submissions list
- Status: "pending" → "in_progress" → "completed" (within 2-5 minutes)
- Can view submission detail and see AI feedback

**How to Verify:**
1. Check Network tab for POST `/submissions` → 201 Created
2. Note the submission ID from response
3. Navigate to submission detail page
4. Wait and refresh every 30 seconds
5. Status should change from pending → in_progress → completed
6. Feedback should appear after status = completed

**Test 4B: Check CloudWatch Logs (Backend Verification)**

If frontend shows "in_progress" for >5 minutes, check backend:

```bash
# Check Step Functions execution
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-west-1:{account}:stateMachine:overlay-ai-workflow \
  --max-results 1 \
  --query "executions[0].[status,startDate]" \
  --output table

# Check orchestrator Lambda logs
aws logs tail /aws/lambda/overlay-orchestrator --since 5m --follow
```

**Record Result:**
```
Status: [ ] WORKING  [ ] BROKEN  [ ] PARTIAL
Submission Created: [ ] Yes  [ ] No
AI Workflow Started: [ ] Yes  [ ] No
Final Status: [ ] completed  [ ] pending  [ ] failed
Feedback Generated: [ ] Yes  [ ] No
Time to Complete: _____ minutes
Error Message (if any):
Screenshot:
```

---

## Test Summary

**Copy results here after completing all tests:**

```
Test 1 - Login:
Test 2 - Dashboard:
Test 3 - View Submission:
Test 4 - AI Analysis:

Overall Assessment:
[ ] System is FULLY FUNCTIONAL (all 4 tests pass)
[ ] System is MOSTLY FUNCTIONAL (3/4 tests pass)
[ ] System is PARTIALLY FUNCTIONAL (2/4 tests pass)
[ ] System is BROKEN (0-1 tests pass)

Critical Findings:
-
-
-

Matches Analysis Predictions:
[ ] Yes - findings match DATABASE_DEPENDENCIES.md predictions
[ ] No - unexpected failures found
[ ] Partial - some differences from predictions
```

---

## Expected Results Based on Analysis

**From DATABASE_DEPENDENCIES.md:**

**Should WORK:**
- ✅ Login (auth system)
- ✅ Dashboard loads (sessions API safe)
- ✅ View existing submissions (submissions API safe)
- ✅ AI analysis workflow (all 6 agents safe)
- ✅ Download documents (S3 presigned URLs)

**Should FAIL:**
- ❌ View overlay details via GET /overlays/{id} (missing criteria_text, max_score columns)
- ❌ Edit criteria via PUT /overlays/{id} (missing criteria_text, max_score columns)

**This Test Does NOT Cover:**
- Edit Criteria feature (known broken, requires migration 008)
- Delete submission feature (backend ready, frontend incomplete)

---

## Next Actions After Testing

**If all 4 tests PASS:**
- System is 85% functional as predicted
- Only Edit Criteria is broken
- Safe to proceed with migration 008 + deployment

**If Test 1-3 PASS but Test 4 FAILS:**
- Core features work, but AI workflow broken
- Investigate Step Functions and agent logs
- May need to rollback Lambda functions

**If Test 1-2 FAIL:**
- Critical system failure
- Database or API Gateway issue
- DO NOT PROCEED - investigate root cause

---

**END OF MANUAL TEST SCRIPT**
