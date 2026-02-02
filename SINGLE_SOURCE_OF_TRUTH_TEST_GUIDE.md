# Single Source of Truth - Test Verification Guide

**Date:** 2026-02-01
**Feature:** Copy criteria_text to description on save
**Commit:** 8cea224
**Deployment:** OverlayComputeStack (49 seconds)
**Files Modified:** 3 backend files

---

## What Changed

**Problem (Before):**
- Two separate fields: `criteria_text` and `description`
- Confusion about which field is "source of truth"
- AI agents had fallback logic: `criteria_text || description`
- Frontend displayed `description` only
- Potential for inconsistency

**Solution (After):**
- Backend copies `criteria_text` → `description` on save
- `description` is single source of truth (always current)
- `criteria_text` preserves edit history (audit trail)
- AI agents read `description` directly (no fallback)
- Frontend displays `description` (no change)

**Architecture:**
```
User edits criteria → Backend saves to:
                      1. criteria_text (audit trail)
                      2. description (single source)
                           ↓
                      AI agents read description
                           ↓
                      Frontend displays description
```

---

## Prerequisites

1. **Dev servers running:**
   ```bash
   # Terminal 1: Proxy server (port 3001)
   cd frontend
   node proxy-server.js

   # Terminal 2: Next.js dev server (port 3000)
   cd frontend
   npm run dev
   ```

2. **Login credentials:**
   - Email: admin@example.com
   - Password: TestPassword123!

3. **Backend deployed:**
   - ✅ OverlayComputeStack deployed (commit 8cea224)
   - Changes include: overlays handler, scoring agent, content-analyzer agent

---

## Test 1: Edit Criteria and Verify Description Updated

**Purpose:** Verify description field is updated when editing criteria

**Steps:**

1. **Navigate to Edit Criteria page:**
   - Login to http://localhost:3000
   - Go to Overlays → Select "Grant Application Review"
   - Scroll to "Evaluation Criteria" section
   - Click "Edit Criteria" button (top right of criteria card)

2. **Edit a criterion:**
   - Find first criterion (e.g., "Question 1 - Project Need")
   - Current criteria_text should be NULL (no previous edits)
   - Edit the text area to: "EDITED - This criterion evaluates the project's overall need and impact on the community."
   - Click "Save Changes"

3. **Verify save succeeded:**
   - **Expected:** Success message appears
   - **Expected:** Page reloads or updates

4. **Check database (via API):**
   - Navigate back to Overlays page
   - Click on "Grant Application Review" again
   - Scroll to criteria section
   - **Expected:** Description shows the EDITED text
   - **Expected:** Frontend displays updated description

5. **Verify both fields updated:**
   - Can't check directly in UI, but backend logs should show update
   - CloudWatch logs should show: "Updated criterion: <uuid> (criteria_text: updated)"

**Success Criteria:**
- ✅ Can edit criteria text
- ✅ Save succeeds with no errors
- ✅ Description field shows updated text
- ✅ Both criteria_text and description updated in database

**Status:** ⏳ Not Tested

---

## Test 2: AI Agents Use Updated Criteria

**Purpose:** Verify AI agents read updated description field

**Steps:**

1. **Upload a document to test overlay:**
   - Navigate to Sessions page
   - Select or create a session with "Grant Application Review" overlay
   - Upload a test document (or paste text)
   - Submit for AI analysis

2. **Wait for AI processing:**
   - Document status should change: pending → in_progress → completed
   - Usually takes 30-60 seconds

3. **View feedback:**
   - Click on submitted document
   - Go to "AI Feedback" or "Evaluation Results" section

4. **Verify AI used updated criteria:**
   - Check if feedback references the EDITED criteria text
   - Look for mentions of "project's overall need and impact on the community"
   - AI should use description field (which now has updated text)

5. **Check CloudWatch logs (optional):**
   - Go to CloudWatch → Log groups
   - Find `/aws/lambda/overlay-scoring`
   - Look for log showing criteria text used in prompt
   - **Expected:** Should show updated description text

**Success Criteria:**
- ✅ AI analysis completes successfully
- ✅ Feedback references updated criteria text
- ✅ AI agents read from description field
- ✅ No fallback to old criteria_text

**Status:** ⏳ Not Tested

---

## Test 3: Multiple Edit Cycles

**Purpose:** Verify description stays current through multiple edits

**Steps:**

1. **Edit same criterion again:**
   - Go to Edit Criteria page
   - Edit the same criterion from Test 1
   - Change text to: "SECOND EDIT - Updated criteria for project need assessment"
   - Save changes

2. **Verify description updated again:**
   - Navigate back to Overlay page
   - **Expected:** Description shows "SECOND EDIT..." text
   - **Expected:** No traces of first edit in display

3. **Edit different criterion:**
   - Edit a different criterion on same overlay
   - Change text to: "EDITED - Different criterion text"
   - Save changes

4. **Verify both descriptions current:**
   - View overlay criteria list
   - **Expected:** First criterion shows "SECOND EDIT..."
   - **Expected:** Second criterion shows "EDITED - Different criterion..."
   - **Expected:** Both descriptions display current values

5. **Verify criteria_text preserves history (optional):**
   - Can't see in UI, but database should have both values
   - criteria_text: Latest edit
   - description: Same as criteria_text (copied on save)

**Success Criteria:**
- ✅ Multiple edits work correctly
- ✅ Description always shows latest value
- ✅ No stale data displayed
- ✅ Each criterion independently editable

**Status:** ⏳ Not Tested

---

## Test 4: New Criterion (No Previous Edit)

**Purpose:** Verify description behavior for criteria never edited

**Steps:**

1. **View unedited criterion:**
   - Go to Overlays → Grant Application Review
   - Find a criterion that has NOT been edited yet
   - **Expected:** Description shows seed data value
   - Example: "Verify all parties are correctly identified"

2. **Verify AI uses seed data:**
   - Upload document to session
   - Let AI analyze
   - Check feedback for unedited criteria
   - **Expected:** AI uses original seed description

3. **Edit the previously unedited criterion:**
   - Go to Edit Criteria page
   - Edit a criterion that was showing seed data
   - Change to: "FIRST EDIT - Custom criteria text"
   - Save changes

4. **Verify transition from seed to edited:**
   - **Expected:** Description now shows "FIRST EDIT..."
   - **Expected:** Seed data replaced with edited text
   - **Expected:** AI will use new text in future analyses

**Success Criteria:**
- ✅ Unedited criteria show seed description
- ✅ First edit replaces seed data
- ✅ Description field updated on first edit
- ✅ Transition is seamless

**Status:** ⏳ Not Tested

---

## Test 5: Frontend Display (Regression Test)

**Purpose:** Verify frontend still displays correctly

**Steps:**

1. **Check Session Detail page:**
   - Navigate to any session with criteria
   - Scroll to "Evaluation Criteria" section
   - **Expected:** Criteria display with descriptions
   - **Expected:** Shows description field (not criteria_text)

2. **Check Overlay Management page:**
   - Navigate to Overlays → Select overlay
   - View criteria list
   - **Expected:** Criteria display correctly
   - **Expected:** Description field shown

3. **Check Submission Feedback page:**
   - View a completed submission
   - Look at AI feedback section
   - **Expected:** Criteria names and descriptions display
   - **Expected:** No missing or duplicate text

4. **Verify no dual display:**
   - **Expected:** No place shows both criteria_text AND description
   - **Expected:** Only description displayed everywhere
   - **Expected:** No confusion about which field to read

**Success Criteria:**
- ✅ All pages display description correctly
- ✅ No UI regressions
- ✅ No duplicate or missing text
- ✅ Clean single field display

**Status:** ⏳ Not Tested

---

## Test 6: Database State Verification

**Purpose:** Confirm both fields updated in database

**Steps:**

1. **Query database via migration Lambda:**
   ```bash
   aws lambda invoke \
     --function-name overlay-database-migration \
     --payload '{"migrationSQL": "SELECT criteria_id, name, LEFT(description, 50) as description_preview, LEFT(criteria_text, 50) as criteria_text_preview FROM evaluation_criteria WHERE name LIKE '\''%EDITED%'\'' LIMIT 5;"}' \
     --cli-binary-format raw-in-base64-out \
     verify-result.json

   cat verify-result.json
   ```

2. **Verify results:**
   - **Expected:** Edited criteria show same text in both fields
   - **Expected:** description = criteria_text (first 50 chars)
   - **Format:**
     ```
     name: "Question 1 - Project Need"
     description: "EDITED - This criterion evaluates the project's..."
     criteria_text: "EDITED - This criterion evaluates the project's..."
     ```

3. **Check unedited criteria:**
   ```bash
   # Query criteria never edited
   SELECT criteria_id, name,
          description IS NOT NULL as has_description,
          criteria_text IS NULL as no_criteria_text
   FROM evaluation_criteria
   WHERE criteria_text IS NULL
   LIMIT 5;
   ```
   - **Expected:** Unedited criteria have NULL criteria_text
   - **Expected:** Description still has seed data
   - **Expected:** Only description field populated

**Success Criteria:**
- ✅ Edited criteria: both fields have same value
- ✅ Unedited criteria: criteria_text is NULL, description has seed data
- ✅ Database consistency maintained

**Status:** ⏳ Not Tested (Optional)

---

## Test 7: Backend Logs Verification

**Purpose:** Confirm backend update logic executes correctly

**Steps:**

1. **Edit a criterion (from Test 1):**
   - Edit any criterion
   - Save changes

2. **Check CloudWatch Logs:**
   - Go to CloudWatch → Log groups
   - Find `/aws/lambda/overlay-api-overlays`
   - Look for recent UPDATE log entries

3. **Verify log output:**
   - **Expected:** "Updated criterion: <uuid> (criteria_text: updated, max_score: unchanged)"
   - **Expected:** No errors about description field
   - **Expected:** Successful 200 response

4. **Check AI agent logs:**
   - Find `/aws/lambda/overlay-scoring`
   - Find `/aws/lambda/overlay-content-analyzer`
   - Look for criteria text in prompt

5. **Verify agents use description:**
   - **Expected:** Prompt shows description field value
   - **Expected:** No fallback logic triggered
   - **Expected:** Edited text visible in agent logs

**Success Criteria:**
- ✅ Backend logs show successful UPDATE
- ✅ Both fields updated (logs may not show description explicitly)
- ✅ AI agent logs show description field usage
- ✅ No errors in any logs

**Status:** ⏳ Not Tested (Optional)

---

## Common Issues to Watch For

### Issue 1: Description Not Updating

**Symptom:** Edited criteria_text but description still shows old value

**Possible Causes:**
1. Backend UPDATE query not executed
2. COALESCE($2, description) keeps old value if $2 is NULL
3. Frontend cache showing stale data

**Fix:**
1. Check CloudWatch logs for UPDATE query execution
2. Verify criteria_text parameter is not NULL
3. Hard refresh browser (Ctrl+F5)
4. Query database to check actual values

---

### Issue 2: AI Uses Old Criteria

**Symptom:** AI feedback doesn't reflect edited criteria

**Possible Causes:**
1. AI agents not redeployed
2. Using cached criteria from previous run
3. Description field not actually updated in database

**Fix:**
1. Verify OverlayComputeStack deployed (commit 8cea224)
2. Query database to confirm description updated
3. Re-run AI analysis on new document

---

### Issue 3: Dual Display in UI

**Symptom:** UI shows both criteria_text and description

**Possible Causes:**
1. Frontend code showing both fields
2. API returning both fields to frontend
3. Component not updated

**Fix:**
1. Check frontend code for criteria_text references
2. Should only display description field
3. No changes needed (frontend already correct)

---

## Edge Cases to Test (Optional)

### Edge Case 1: NULL Handling
- Edit criterion with empty string
- **Expected:** Both fields become empty string (not NULL)

### Edge Case 2: Unicode Characters
- Edit with emoji: "📝 EDITED - Criterion with emoji"
- **Expected:** Both fields preserve emoji correctly

### Edge Case 3: Long Text
- Edit with 2000+ character text
- **Expected:** Both fields store full text

### Edge Case 4: SQL Injection
- Edit with: `'); DROP TABLE evaluation_criteria; --`
- **Expected:** Safely escaped, no SQL injection

---

## Success Criteria Summary

**All tests must pass:**
- ✅ Test 1: Description updated on save
- ✅ Test 2: AI agents use updated criteria
- ✅ Test 3: Multiple edit cycles work
- ✅ Test 4: New criterion behavior correct
- ✅ Test 5: Frontend display unchanged (regression)
- ⏸️ Test 6: Database state verified (optional)
- ⏸️ Test 7: Backend logs confirmed (optional)

**Minimum Required:**
- Tests 1, 2, 3, 4, 5 MUST pass
- No errors in UI or backend
- Description is single source of truth

---

## Files Changed Summary

**Backend:**
1. `lambda/functions/api/overlays/index.js` (line 201)
   - Added: `description = COALESCE($2, description),`
   - Copies criteria_text value to description on UPDATE

2. `lambda/functions/scoring/index.js` (line 73)
   - Before: `${c.criteria_text || c.description}`
   - After: `${c.description}`
   - Removed fallback logic

3. `lambda/functions/content-analyzer/index.js` (line 54)
   - Before: `${c.criteria_text || c.description}`
   - After: `${c.description}`
   - Removed fallback logic

**Frontend:** NO CHANGES
- Already displays description field correctly

**Database:** NO CHANGES
- Both columns already exist
- No schema migration needed

---

## Test Results

**Date Tested:** _______________
**Tested By:** _______________
**Environment:** Development (localhost:3000)

| Test | Status | Notes |
|------|--------|-------|
| Test 1: Description updated | ⏳ Not Tested | |
| Test 2: AI uses updated criteria | ⏳ Not Tested | |
| Test 3: Multiple edit cycles | ⏳ Not Tested | |
| Test 4: New criterion behavior | ⏳ Not Tested | |
| Test 5: Frontend display | ⏳ Not Tested | |
| Test 6: Database verification | ⏳ Not Tested | |
| Test 7: Backend logs | ⏳ Not Tested | |

**Overall Status:** ⏳ Not Tested

---

## Next Steps After Testing

**If all tests pass:**
1. ✅ Mark feature as complete
2. ✅ Update CLAUDE.md with new architecture
3. ✅ Document single source of truth pattern
4. ✅ Close related issues

**If tests fail:**
1. Document failure details
2. Check CloudWatch logs for errors
3. Query database to verify actual state
4. Apply additional fixes if needed
5. Re-deploy and re-test

---

## Architectural Benefits

**Before (Dual-Field with Fallback):**
- ⚠️ Two fields with different values
- ⚠️ Fallback logic in AI agents
- ⚠️ Confusion about source of truth
- ⚠️ Potential for inconsistency

**After (Single Source of Truth):**
- ✅ description is always current
- ✅ No fallback logic needed
- ✅ Clear single source of truth
- ✅ criteria_text preserves edit history
- ✅ Simpler code (no conditionals)

---

**END OF TEST GUIDE**
