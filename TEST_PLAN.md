# END-TO-END FUNCTIONALITY TEST PLAN
**Generated:** 2026-02-01 08:25 UTC
**Purpose:** Comprehensive testing strategy for Overlay Platform
**Status:** Pre-deployment test plan (NO TESTS EXECUTED YET)

---

## EXECUTIVE SUMMARY

**Test Coverage:**
- Total Features: 12 user-facing feature areas
- Total Test Cases: 47 end-to-end tests
- Critical Path Tests: 8 tests (must pass for viable system)

**Feature Status:**
- ✅ Work Now (no migration needed): 9 features (38 tests)
- ⚠️ Need Migration 008: 1 feature (4 tests)
- ❌ Incomplete (needs frontend): 2 features (5 tests)

**Test Categories:**
1. **SMOKE TESTS** - Critical path (must work)
2. **REGRESSION TESTS** - Existing features (should still work)
3. **NEW FEATURE TESTS** - Restored features (DELETE + Edit Criteria)

---

## TEST ENVIRONMENT

**Frontend:**
- URL: http://localhost:3000
- Proxy: http://localhost:3001
- Framework: Next.js 16.1.4

**Backend:**
- API Gateway: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/
- Database: Aurora PostgreSQL 16.6 (Migration 006)
- Lambda Functions: 18 functions

**Test User:**
- Email: admin@example.com
- Password: TestPassword123!
- Role: system_admin (full access)

---

## FEATURE-TO-FUNCTION MAPPING

### Feature 1: Authentication
**Frontend:** /login
**API Endpoints:** POST /auth/login, POST /auth/logout
**Lambda:** overlay-api-auth
**Database Tables:** users, user_sessions, user_roles
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 2: Dashboard
**Frontend:** /dashboard
**API Endpoints:** GET /sessions
**Lambda:** overlay-api-sessions
**Database Tables:** review_sessions, document_submissions, overlays
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 3: Session Management
**Frontend:** /dashboard, /session/{id}
**API Endpoints:**
- GET /sessions
- GET /sessions/{id}
- POST /sessions
- DELETE /sessions/{id}
- PUT /sessions/{id}

**Lambda:** overlay-api-sessions
**Database Tables:** review_sessions, document_submissions, overlays
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 4: Overlay Management (View/List)
**Frontend:** /overlays, /overlays/{id}
**API Endpoints:**
- GET /overlays
- GET /overlays/{id}
- POST /overlays
- DELETE /overlays/{id}

**Lambda:** overlay-api-overlays
**Database Tables:** overlays, evaluation_criteria
**Status:** ⚠️ PARTIAL - GET /overlays/{id} will fail
**Dependencies:** Migration 008 (for viewing criteria details)

### Feature 5: Overlay Management (Edit Criteria)
**Frontend:** /overlays/{id}/edit
**API Endpoints:**
- PUT /overlays/{id}

**Lambda:** overlay-api-overlays
**Database Tables:** overlays, evaluation_criteria
**Status:** ⚠️ BLOCKED - Needs Migration 008
**Dependencies:** Migration 008 (criteria_text, max_score columns)

### Feature 6: Document Submission (Upload File)
**Frontend:** /session/{id} - Upload File tab
**API Endpoints:** POST /submissions
**Lambda:** overlay-api-submissions
**Database Tables:** document_submissions, S3 bucket
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 7: Document Submission (Paste Text)
**Frontend:** /session/{id} - Paste Text tab
**API Endpoints:** POST /submissions
**Lambda:** overlay-api-submissions
**Database Tables:** document_submissions
**Status:** ✅ Works Now
**Dependencies:** None (UTF-8 encoding fixed in v1.4)

### Feature 8: Appendix Upload
**Frontend:** /session/{id} - Appendices section
**API Endpoints:** POST /submissions (with appendices)
**Lambda:** overlay-api-submissions
**Database Tables:** document_submissions (appendix_files JSONB)
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 9: AI Analysis (6-Agent Workflow)
**Frontend:** /submission/{id} - Auto-refresh status
**API Endpoints:** GET /submissions/{id}/feedback
**Lambda Functions:**
- overlay-orchestrator
- overlay-structure-validator
- overlay-content-analyzer
- overlay-grammar-checker
- overlay-clarification
- overlay-scoring

**Database Tables:** document_submissions, feedback_reports, evaluation_responses
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 10: Feedback Viewing
**Frontend:** /submission/{id} - Feedback display
**API Endpoints:** GET /submissions/{id}/feedback
**Lambda:** overlay-api-submissions
**Database Tables:** feedback_reports, evaluation_responses
**Status:** ✅ Works Now (with parsing fix from 8eeb7f1)
**Dependencies:** None
**Note:** Feedback parsing extracts strengths/weaknesses from text

### Feature 11: Notes System
**Frontend:** Sidebar (all pages)
**API Endpoints:**
- POST /notes
- GET /notes
- PUT /notes/{id}
- DELETE /notes/{id}

**Lambda:** overlay-api-notes
**Database Tables:** user_notes
**Status:** ✅ Works Now
**Dependencies:** None

### Feature 12: Document Download
**Frontend:** /submission/{id} - Download buttons
**API Endpoints:**
- GET /submissions/{id}/download
- GET /submissions/{id}/download-appendix/{index}

**Lambda:** overlay-api-submissions
**Database Tables:** document_submissions, S3 bucket
**Status:** ✅ Works Now
**Dependencies:** None (S3 presigned URLs)

### Feature 13: DELETE Analysis (NEW)
**Frontend:** ❌ Not implemented
**API Endpoints:** DELETE /submissions/{id}
**Lambda:** overlay-api-submissions (handleDelete exists)
**Database Tables:** document_submissions (CASCADE deletes)
**Status:** ❌ INCOMPLETE - Backend ready, frontend missing
**Dependencies:** None (schema compatible)
**Missing:**
- Frontend API client method: `deleteSubmission()`
- Frontend UI: Delete button on submission detail page

### Feature 14: Edit Criteria (NEW)
**Frontend:** ❌ Partial implementation
**API Endpoints:** PUT /overlays/{id}
**Lambda:** overlay-api-overlays (handleUpdate exists)
**Database Tables:** overlays, evaluation_criteria
**Status:** ⚠️ BLOCKED - Needs Migration 008
**Dependencies:** Migration 008 (criteria_text, max_score columns)

---

## CRITICAL PATH TESTS (SMOKE TESTS)

These 8 tests MUST pass for the system to be viable. If any fail, deployment should be rolled back.

### CP-1: User Login
**Priority:** CRITICAL
**Feature:** Authentication
**Status:** ✅ Works Now

**Steps:**
1. Navigate to http://localhost:3000
2. Should redirect to /login
3. Enter email: admin@example.com
4. Enter password: TestPassword123!
5. Click "Login"

**Expected:**
- ✅ Redirect to /dashboard
- ✅ User session created
- ✅ No errors in console

**Actual:** (To be tested)

---

### CP-2: View Dashboard
**Priority:** CRITICAL
**Feature:** Dashboard
**Status:** ✅ Works Now

**Steps:**
1. After login, verify dashboard loads
2. Check sessions list displays

**Expected:**
- ✅ Dashboard page renders
- ✅ Sessions list loads
- ✅ "Create New Session" button visible
- ✅ No 500 errors

**Actual:** (To be tested)

---

### CP-3: Create New Session
**Priority:** CRITICAL
**Feature:** Session Management
**Status:** ✅ Works Now

**Steps:**
1. From dashboard, click "Create New Session"
2. Fill in session details
3. Select an overlay
4. Click "Create"

**Expected:**
- ✅ Session created successfully
- ✅ Redirect to session detail page
- ✅ Session ID assigned
- ✅ Status: active

**Actual:** (To be tested)

---

### CP-4: Upload Document (Paste Text)
**Priority:** CRITICAL
**Feature:** Document Submission (Paste)
**Status:** ✅ Works Now

**Steps:**
1. From session detail page
2. Click "Paste Text" tab
3. Paste sample text (include unicode characters: café, résumé)
4. Click "Submit for Analysis"

**Expected:**
- ✅ Submission created
- ✅ Status: pending → in_progress
- ✅ UTF-8 text preserved (no encoding errors)
- ✅ AI workflow triggered

**Actual:** (To be tested)

**Test Data:**
```
This is a test submission with unicode: café, résumé, naïve, 中文, 日本語
Total characters: ~100
```

---

### CP-5: AI Analysis Completes
**Priority:** CRITICAL
**Feature:** AI Analysis (6-Agent Workflow)
**Status:** ✅ Works Now

**Steps:**
1. After submitting document
2. Wait on submission detail page (auto-refresh)
3. Monitor status transitions

**Expected:**
- ✅ Status: pending → in_progress → completed
- ✅ All 6 agents execute successfully
- ✅ No agent failures in CloudWatch Logs
- ✅ Completion time: <2 minutes

**Actual:** (To be tested)

**Monitoring:**
- Check Step Functions execution status
- Verify no "ValidationException" errors
- Confirm all agents return results

---

### CP-6: View Feedback
**Priority:** CRITICAL
**Feature:** Feedback Viewing
**Status:** ✅ Works Now

**Steps:**
1. After analysis completes
2. View submission detail page
3. Check feedback display

**Expected:**
- ✅ Overall score displayed (0-100)
- ✅ Strengths tab shows items (parsed from text)
- ✅ Weaknesses tab shows items (parsed from text)
- ✅ Recommendations tab shows items (parsed from text)
- ✅ Detailed feedback visible
- ✅ No "Objects are not valid as a React child" error

**Actual:** (To be tested)

**Known Issue:**
- Feedback parsing fix (8eeb7f1) extracts sections from text
- If arrays are empty, parser will extract from summary

---

### CP-7: Download Document
**Priority:** CRITICAL
**Feature:** Document Download
**Status:** ✅ Works Now

**Steps:**
1. From submission detail page
2. Click "Download" button

**Expected:**
- ✅ S3 presigned URL generated
- ✅ File downloads (15-minute expiry)
- ✅ Original filename preserved
- ✅ Content intact

**Actual:** (To be tested)

---

### CP-8: Logout
**Priority:** CRITICAL
**Feature:** Authentication
**Status:** ✅ Works Now

**Steps:**
1. From any page
2. Click "Logout" button

**Expected:**
- ✅ Session terminated
- ✅ Redirect to /login
- ✅ Cannot access protected pages
- ✅ JWT token cleared

**Actual:** (To be tested)

---

## REGRESSION TESTS (EXISTING FEATURES)

These tests verify that existing functionality still works after deployment.

### RT-1: Upload Document (File Upload)
**Priority:** HIGH
**Feature:** Document Submission (File)
**Status:** ✅ Works Now

**Steps:**
1. From session detail page
2. Click "Upload File" tab
3. Select PDF file (max 5MB)
4. Click "Upload"

**Expected:**
- ✅ File uploaded to S3
- ✅ Submission created
- ✅ AI workflow triggered
- ✅ Status: pending → in_progress

**Test Files:**
- Small PDF: 100KB
- Large PDF: 4.5MB
- Invalid: 6MB (should reject)

---

### RT-2: Upload Appendices (Multiple PDFs)
**Priority:** HIGH
**Feature:** Appendix Upload
**Status:** ✅ Works Now

**Steps:**
1. After uploading main document
2. Upload 2-3 PDF appendices
3. Submit for analysis

**Expected:**
- ✅ Up to 10 appendices allowed
- ✅ Stored in appendix_files JSONB
- ✅ AI agents receive concatenated text
- ✅ Format: Main → ---APPENDIX 1--- → Text1 → ---APPENDIX 2--- → Text2

**Test Files:**
- appendix1.pdf (500KB)
- appendix2.pdf (1MB)
- appendix3.pdf (800KB)

---

### RT-3: Download Appendix
**Priority:** MEDIUM
**Feature:** Document Download
**Status:** ✅ Works Now

**Steps:**
1. From submission with appendices
2. Click "Download Appendix 1"
3. Verify download

**Expected:**
- ✅ S3 presigned URL for specific appendix
- ✅ Correct filename
- ✅ Content matches uploaded file

---

### RT-4: View Sessions List
**Priority:** MEDIUM
**Feature:** Session Management
**Status:** ✅ Works Now

**Steps:**
1. Navigate to /dashboard
2. View sessions list

**Expected:**
- ✅ All sessions displayed
- ✅ Sorted by created_at DESC
- ✅ Shows session name, overlay, created date
- ✅ Shows submission count

---

### RT-5: View Session Detail
**Priority:** MEDIUM
**Feature:** Session Management
**Status:** ✅ Works Now

**Steps:**
1. Click on a session from list
2. View session detail page

**Expected:**
- ✅ Session metadata displayed
- ✅ Associated overlay shown
- ✅ Submissions list for this session
- ✅ Upload form available

---

### RT-6: View Overlays List
**Priority:** MEDIUM
**Feature:** Overlay Management (View)
**Status:** ✅ Works Now

**Steps:**
1. Navigate to /overlays
2. View overlays list

**Expected:**
- ✅ All overlays displayed
- ✅ Shows name, description, document type
- ✅ Active/inactive status
- ✅ Edit and Delete buttons visible

---

### RT-7: Create New Overlay
**Priority:** MEDIUM
**Feature:** Overlay Management
**Status:** ✅ Works Now (POST doesn't use new columns)

**Steps:**
1. Navigate to /overlays/new
2. Fill overlay details
3. Add evaluation criteria
4. Click "Create"

**Expected:**
- ✅ Overlay created successfully
- ✅ Criteria saved (without criteria_text/max_score)
- ✅ Redirect to overlays list
- ✅ New overlay visible

**Note:** Creation works because POST doesn't require new columns

---

### RT-8: Delete Overlay
**Priority:** LOW
**Feature:** Overlay Management
**Status:** ✅ Works Now

**Steps:**
1. From overlays list
2. Click "Delete" on an overlay
3. Confirm deletion

**Expected:**
- ✅ Overlay deleted
- ✅ CASCADE deletes evaluation_criteria
- ✅ No orphaned criteria

---

### RT-9: Create Note
**Priority:** LOW
**Feature:** Notes System
**Status:** ✅ Works Now

**Steps:**
1. Open sidebar (any page)
2. Type note text
3. Click "Save Note"

**Expected:**
- ✅ Note saved to user_notes table
- ✅ Note persists across page reloads
- ✅ Character count updates

---

### RT-10: Update Note
**Priority:** LOW
**Feature:** Notes System
**Status:** ✅ Works Now

**Steps:**
1. Open sidebar
2. Edit existing note
3. Click "Save"

**Expected:**
- ✅ Note updated in database
- ✅ updated_at timestamp changed

---

### RT-11: Delete Note
**Priority:** LOW
**Feature:** Notes System
**Status:** ✅ Works Now

**Steps:**
1. Open sidebar
2. Click delete icon
3. Confirm

**Expected:**
- ✅ Note deleted
- ✅ Removed from database

---

### RT-12: Session Export
**Priority:** LOW
**Feature:** Session Management
**Status:** ✅ Works Now

**Steps:**
1. From session detail page
2. Click "Export" button

**Expected:**
- ✅ Word document generated
- ✅ Includes session data
- ✅ Includes all submissions
- ✅ Includes feedback

---

## NEW FEATURE TESTS

Tests for restored DELETE and Edit Criteria features.

### NFT-1: View Overlay Detail
**Priority:** HIGH
**Feature:** Overlay Management (View)
**Status:** ⚠️ BLOCKED (without migration 008), ✅ WORKS (after migration 008)

**Current State Test:**
**Steps:**
1. Navigate to /overlays
2. Click on any overlay
3. Attempt to view detail

**Expected WITHOUT Migration 008:**
- ❌ 500 Internal Server Error
- ❌ CloudWatch Log: "column 'criteria_text' does not exist"
- ❌ Frontend shows error message

**Expected AFTER Migration 008:**
- ✅ Overlay details load
- ✅ Criteria list displays with criteria_text
- ✅ Max scores shown
- ✅ No errors

---

### NFT-2: Edit Overlay Criteria
**Priority:** HIGH
**Feature:** Edit Criteria
**Status:** ⚠️ BLOCKED - Needs Migration 008

**Prerequisites:**
- Migration 008 applied
- Frontend edit UI exists

**Steps:**
1. Navigate to /overlays/{id}
2. Click "Edit Criteria" button
3. Modify criteria:
   - Change criterion name
   - Update criteria_text field
   - Adjust max_score value
4. Click "Save"

**Expected:**
- ✅ PUT /overlays/{id} succeeds
- ✅ Old criteria deleted
- ✅ New criteria inserted with criteria_text, max_score
- ✅ Redirect back to overlay detail
- ✅ Changes reflected immediately

**Test Data:**
```json
{
  "criteria": [
    {
      "name": "Clarity",
      "description": "Document is clear and understandable",
      "criteria_text": "Evaluate clarity, use of plain language, absence of jargon",
      "max_score": 25,
      "weight": 25,
      "criterion_type": "ai_analysis"
    }
  ]
}
```

---

### NFT-3: Edit Criteria Validation
**Priority:** MEDIUM
**Feature:** Edit Criteria
**Status:** ⚠️ BLOCKED - Needs Migration 008

**Steps:**
1. Attempt to edit criteria with invalid data:
   - Empty name
   - Negative max_score
   - max_score > 100

**Expected:**
- ✅ Validation errors shown
- ✅ Changes not saved
- ✅ User receives feedback

---

### NFT-4: Delete Criteria During Edit
**Priority:** MEDIUM
**Feature:** Edit Criteria
**Status:** ⚠️ BLOCKED - Needs Migration 008

**Steps:**
1. Edit overlay criteria
2. Remove one or more criteria
3. Save changes

**Expected:**
- ✅ Old criteria deleted
- ✅ Only remaining criteria re-inserted
- ✅ No orphaned criteria

---

### NFT-5: DELETE Submission (Backend Only)
**Priority:** HIGH
**Feature:** DELETE Analysis
**Status:** ❌ INCOMPLETE - Backend ready, frontend missing

**Backend Test (via curl):**
```bash
# Test DELETE endpoint directly
curl -X DELETE \
  -H "Authorization: Bearer $JWT_TOKEN" \
  https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/{id}
```

**Expected:**
- ✅ HTTP 200 OK
- ✅ Response: {"message": "Submission deleted", "submission_id": "..."}
- ✅ Database: submission_id removed from document_submissions
- ✅ CASCADE: related feedback_reports deleted
- ✅ CASCADE: related evaluation_responses deleted
- ✅ S3: Documents remain (not deleted - manual cleanup needed)

---

### NFT-6: DELETE Submission (Frontend - NOT IMPLEMENTED)
**Priority:** HIGH
**Feature:** DELETE Analysis
**Status:** ❌ NOT IMPLEMENTED

**Missing Components:**
1. Frontend API client method:
```typescript
async deleteSubmission(submissionId: string): Promise<void> {
  await this.apiClient.delete(`/submissions/${submissionId}`);
}
```

2. Frontend UI:
- Delete button on /submission/{id} page
- Confirmation dialog
- Success/error handling
- Redirect to session after delete

**When Implemented, Test:**
1. Navigate to submission detail
2. Click "Delete" button
3. Confirm deletion
4. Verify redirect to session page
5. Verify submission no longer in list

---

### NFT-7: DELETE Submission with Appendices
**Priority:** MEDIUM
**Feature:** DELETE Analysis
**Status:** ❌ INCOMPLETE

**Test:**
1. Delete submission that has appendices
2. Verify CASCADE deletion

**Expected:**
- ✅ Main submission deleted
- ✅ appendix_files JSONB data removed
- ✅ S3 files remain (manual cleanup)

---

### NFT-8: DELETE Submission Error Handling
**Priority:** LOW
**Feature:** DELETE Analysis
**Status:** ❌ INCOMPLETE

**Test:**
1. Attempt to delete non-existent submission
2. Attempt to delete another user's submission (if permissions implemented)

**Expected:**
- ✅ 404 Not Found for non-existent
- ✅ 403 Forbidden for unauthorized (if implemented)
- ✅ Helpful error messages

---

### NFT-9: DELETE Submission Impact on Session
**Priority:** MEDIUM
**Feature:** DELETE Analysis
**Status:** ❌ INCOMPLETE

**Test:**
1. Delete submission from a session
2. View session detail page
3. Verify submission count decremented

**Expected:**
- ✅ Session still exists
- ✅ Submission count accurate
- ✅ No orphaned data

---

## TEST EXECUTION ORDER

### Phase 1: Pre-Migration Smoke Tests (Current State)
**Run BEFORE migration 008**
**Purpose:** Verify existing functionality still works

1. CP-1: User Login
2. CP-2: View Dashboard
3. CP-3: Create New Session
4. CP-4: Upload Document (Paste Text)
5. CP-5: AI Analysis Completes
6. CP-6: View Feedback
7. CP-7: Download Document
8. CP-8: Logout

**Expected:** All 8 tests PASS

---

### Phase 2: Regression Testing (Current State)
**Run BEFORE migration 008**
**Purpose:** Verify all existing features

1. RT-1 through RT-12

**Expected:** All tests PASS

---

### Phase 3: Confirm Known Failure (Current State)
**Run BEFORE migration 008**
**Purpose:** Confirm overlay detail fails as expected

1. NFT-1: View Overlay Detail

**Expected:** 500 error (confirms migration needed)

---

### Phase 4: Apply Migration 008
**Action:** Run migration via Lambda
```bash
npm run migrate:lambda
```

**Verification:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'evaluation_criteria'
AND column_name IN ('criteria_text', 'max_score');
```

**Expected:** 2 rows returned

---

### Phase 5: Deploy Lambda Functions
**Action:** Deploy via CDK
```bash
npm run build
cdk deploy OverlayComputeStack
```

**Verification:**
- Check CloudFormation stack status
- Verify all Lambda functions updated
- Check last modified timestamps

---

### Phase 6: Post-Deployment Smoke Tests
**Run AFTER migration 008 + deployment**
**Purpose:** Verify nothing broke

1. Re-run CP-1 through CP-8

**Expected:** All 8 tests PASS

---

### Phase 7: New Feature Testing
**Run AFTER migration 008 + deployment**
**Purpose:** Verify new features work

1. NFT-1: View Overlay Detail (should now PASS)
2. NFT-2: Edit Overlay Criteria (if frontend ready)
3. NFT-3: Edit Criteria Validation (if frontend ready)
4. NFT-4: Delete Criteria During Edit (if frontend ready)

**Expected:** NFT-1 PASSES, others depend on frontend implementation

---

### Phase 8: DELETE Feature Testing (Backend Only)
**Run AFTER deployment**
**Purpose:** Verify backend DELETE endpoint works

1. NFT-5: DELETE Submission (Backend Only) via curl

**Expected:** Backend DELETE works, frontend integration still needed

---

## PASS/FAIL CRITERIA

### Deployment Success Criteria (ALL must pass)
1. ✅ All 8 Critical Path tests PASS
2. ✅ At least 10/12 Regression tests PASS
3. ✅ NFT-1 (View Overlay Detail) PASSES after migration 008
4. ✅ No new 500 errors in CloudWatch Logs
5. ✅ AI workflow completes successfully (status → completed)
6. ✅ Feedback displays without React errors

### Deployment Failure Criteria (ANY triggers rollback)
1. ❌ Any Critical Path test FAILS
2. ❌ More than 2 Regression tests FAIL
3. ❌ Migration 008 fails to apply
4. ❌ Lambda deployment fails
5. ❌ Database connection errors
6. ❌ S3 access errors

---

## RISK MATRIX

| Test | Impact if Fails | Likelihood | Mitigation |
|------|----------------|------------|------------|
| CP-1: Login | CRITICAL - No system access | Low | Auth unchanged |
| CP-5: AI Analysis | CRITICAL - Core feature broken | Low | Agents unchanged |
| CP-6: Feedback | HIGH - Results invisible | Medium | Parsing fix in place |
| NFT-1: View Overlay | HIGH - Can't edit criteria | High (before migration) | Migration 008 required |
| NFT-2: Edit Criteria | MEDIUM - Can't update | High (frontend missing) | Need UI implementation |
| NFT-5: DELETE | LOW - Workaround available | Low | Backend ready |

---

## TEST DATA REQUIREMENTS

### Test Users
- **Admin:** admin@example.com / TestPassword123!
- **Role:** system_admin (full access)

### Test Overlays
- **Name:** "NHS Procurement Test"
- **Type:** "procurement"
- **Criteria:** 3-5 evaluation criteria

### Test Documents
- **Small Text:** 500 words, UTF-8 with unicode
- **Large Text:** 5,000 words
- **Small PDF:** 100KB contract
- **Large PDF:** 4.5MB proposal
- **Appendices:** 2-3 PDFs, 500KB-1MB each

### Test Sessions
- Create at least 2 active sessions
- Each session with 2-3 submissions
- Mix of completed and pending analyses

---

## MONITORING DURING TESTS

### CloudWatch Logs to Monitor
- `/aws/lambda/overlay-api-submissions` - Upload/download/feedback
- `/aws/lambda/overlay-api-overlays` - Criteria operations
- `/aws/lambda/overlay-orchestrator` - AI workflow coordination
- `/aws/lambda/overlay-scoring` - Feedback generation

### Key Error Patterns
```
ERROR: column "criteria_text" does not exist
ERROR: column "max_score" does not exist
ValidationException: The provided model identifier is invalid
InvalidCharacterError: Failed to execute 'btoa'
Objects are not valid as a React child
```

### Step Functions
- Execution status: SUCCEEDED (not FAILED)
- All 6 agents complete
- No timeout errors
- Execution time: <2 minutes

---

## POST-TEST REPORTING

### Test Report Template
```markdown
## Test Execution Report
**Date:** YYYY-MM-DD HH:MM UTC
**Tester:** [Name]
**Environment:** Production
**Database State:** Migration 006 / Migration 008

### Critical Path Tests (8 tests)
- Passed: X/8
- Failed: X/8
- Blocked: X/8

### Regression Tests (12 tests)
- Passed: X/12
- Failed: X/12
- Skipped: X/12

### New Feature Tests (9 tests)
- Passed: X/9
- Failed: X/9
- Blocked: X/9
- Not Implemented: X/9

### Defects Found
1. [Severity] Description - Test Case ID
2. ...

### Deployment Recommendation
[ ] PASS - Safe to deploy
[ ] PASS with issues - Deploy with known issues documented
[ ] FAIL - Rollback required
```

---

## APPENDIX A: Test Case Details

### Test Case Template
```markdown
**Test ID:** [CP|RT|NFT]-##
**Feature:** [Feature name]
**Priority:** CRITICAL | HIGH | MEDIUM | LOW
**Status:** ✅ Works Now | ⚠️ Needs Migration 008 | ❌ Incomplete

**Prerequisites:**
- [List any setup needed]

**Test Steps:**
1. [Detailed step]
2. [Detailed step]

**Expected Result:**
- ✅ [Expected behavior]
- ✅ [Expected behavior]

**Actual Result:** (Fill during testing)
- [What actually happened]

**Pass/Fail:** [ ] PASS [ ] FAIL

**Notes:**
- [Any observations]
```

---

## APPENDIX B: Quick Reference

### Features That Work Now (No Migration Needed)
1. ✅ Authentication (Login/Logout)
2. ✅ Dashboard
3. ✅ Session Management (Create/View/Delete)
4. ✅ Document Submission (File upload, Paste text)
5. ✅ Appendix Upload
6. ✅ AI Analysis (6-agent workflow)
7. ✅ Feedback Viewing (with parsing)
8. ✅ Notes System (Full CRUD)
9. ✅ Document Download

### Features Blocked Until Migration 008
1. ⚠️ View Overlay Detail (GET /overlays/{id})
2. ⚠️ Edit Criteria (PUT /overlays/{id})

### Features Incomplete (Need Frontend)
1. ❌ DELETE Submission (Backend ready, UI missing)
2. ❌ Edit Criteria UI (Backend ready, UI partial)

---

**END OF TEST PLAN**
