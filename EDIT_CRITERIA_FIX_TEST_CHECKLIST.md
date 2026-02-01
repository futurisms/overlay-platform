# Edit Criteria Fix - Test Verification Checklist

**Date:** 2026-02-01
**Fix Applied:** UPDATE instead of DELETE+INSERT for criteria editing
**Deployment:** OverlayComputeStack deployed at 15:36 UTC
**Commit:** d7d38a9

---

## What Was Fixed

**Problem:**
- Editing criteria failed with foreign key constraint error
- Error: `evaluation_responses_criteria_id_fkey`
- Backend used DELETE + INSERT which broke foreign keys

**Solution:**
- Changed to UPDATE existing criteria in-place
- Preserves criteria_id and foreign key relationships
- Only updates provided fields (criteria_text, max_score)

---

## Prerequisites

1. **Frontend servers running:**
   ```bash
   # Terminal 1: Proxy (port 3001)
   cd frontend && node proxy-server.js

   # Terminal 2: Dev server (port 3000)
   cd frontend && npm run dev
   ```

2. **Login credentials:**
   - Email: admin@example.com
   - Password: TestPassword123!

3. **Test overlay:**
   - Use existing overlay that has submissions with AI evaluation completed
   - Example: "Innovate UK Smart Grant - 13 Criteria" overlay
   - Verify it has evaluation_responses in database

---

## Test Case 1: Edit Criteria with Existing Evaluations (PRIMARY TEST)

**This is the critical test - this scenario failed before the fix**

### Setup Verification

**Step 1.1:** Verify overlay has existing evaluation responses
```sql
-- Run this query to confirm test data exists
SELECT
  ec.criteria_id,
  ec.name,
  ec.criteria_text,
  ec.max_score,
  COUNT(er.response_id) AS response_count
FROM evaluation_criteria ec
LEFT JOIN evaluation_responses er ON ec.criteria_id = er.criteria_id
WHERE ec.overlay_id = 'YOUR_OVERLAY_ID'
GROUP BY ec.criteria_id, ec.name, ec.criteria_text, ec.max_score
ORDER BY ec.display_order;
```

**Expected:**
- ✅ At least one criterion has response_count > 0
- ✅ This confirms foreign key relationships exist

### Test Execution

**Step 1.2:** Navigate to Edit Criteria page
1. Open http://localhost:3000
2. Login with admin@example.com
3. Click any session that uses an overlay with existing submissions
4. Scroll to "Evaluation Criteria" section
5. Click "Edit Criteria" button (top right)

**Expected:**
- ✅ Page loads without errors
- ✅ All criteria display with current values
- ✅ criteria_text shows existing text (or empty if null)
- ✅ max_score shows existing value

**Step 1.3:** Edit criteria text
1. Find first criterion with evaluation responses
2. Update criteria_text field:
   ```
   UPDATED TEST: This rubric text has been edited to verify the UPDATE fix works.

   The system should now use UPDATE instead of DELETE+INSERT.

   Scoring guidance:
   - Excellent (90-100): All elements present
   - Good (70-89): Most elements present
   - Fair (50-69): Some elements missing
   - Poor (0-49): Major gaps
   ```
3. Do NOT click Save yet

**Step 1.4:** Edit max score
1. Change max_score from current value to a different value
2. Example: If 100, change to 150
3. Note the new value

**Step 1.5:** Save changes
1. Click "Save Changes" button
2. Watch for loading state
3. Wait for response

**Expected Results:**
- ✅ **No error message** (this is the key test!)
- ✅ Success message appears: "Criteria updated successfully!"
- ✅ Success message is green
- ✅ Success message auto-dismisses after 3 seconds
- ✅ Page remains on edit screen
- ✅ Form fields retain edited values

**Step 1.6:** Verify in database
```sql
SELECT
  criteria_id,
  name,
  LEFT(criteria_text, 50) AS criteria_text_preview,
  max_score,
  updated_at
FROM evaluation_criteria
WHERE overlay_id = 'YOUR_OVERLAY_ID'
ORDER BY display_order;
```

**Expected:**
- ✅ criteria_text contains "UPDATED TEST" text
- ✅ max_score shows new value (e.g., 150)
- ✅ updated_at timestamp is recent (within last minute)
- ✅ criteria_id is UNCHANGED (same UUID as before)

**Step 1.7:** Verify foreign keys intact
```sql
SELECT
  er.response_id,
  er.criteria_id,
  er.score,
  ec.name AS criterion_name,
  ds.document_name
FROM evaluation_responses er
JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
JOIN document_submissions ds ON er.submission_id = ds.submission_id
WHERE ec.overlay_id = 'YOUR_OVERLAY_ID'
LIMIT 5;
```

**Expected:**
- ✅ Query returns results (no broken foreign keys)
- ✅ All evaluation_responses still reference valid criteria
- ✅ criteria_id matches criteria in evaluation_criteria table

**Status:** ⏳ Not Tested

---

## Test Case 2: Edit Multiple Criteria

**Purpose:** Verify batch updates work correctly

**Steps:**
1. Navigate to Edit Criteria page
2. Edit criteria_text for 3 different criteria
3. Edit max_score for 2 different criteria
4. Click "Save Changes"

**Expected:**
- ✅ No errors
- ✅ Success message appears
- ✅ All 5 changes persisted to database
- ✅ Database updated_at reflects recent update
- ✅ Other criteria (not edited) remain unchanged

**Status:** ⏳ Not Tested

---

## Test Case 3: Edit Only criteria_text (Leave max_score Unchanged)

**Purpose:** Verify COALESCE logic preserves unchanged fields

**Steps:**
1. Navigate to Edit Criteria page
2. Note current max_score value (e.g., 100)
3. Edit only criteria_text
4. Do NOT edit max_score
5. Click "Save Changes"

**Expected:**
- ✅ criteria_text updated in database
- ✅ max_score remains UNCHANGED (still 100)
- ✅ No errors

**Database Verification:**
```sql
SELECT criteria_text, max_score
FROM evaluation_criteria
WHERE criteria_id = 'EDITED_CRITERION_ID';
```

**Status:** ⏳ Not Tested

---

## Test Case 4: Edit Only max_score (Leave criteria_text Unchanged)

**Purpose:** Verify partial updates work both ways

**Steps:**
1. Navigate to Edit Criteria page
2. Note current criteria_text (or empty if null)
3. Edit only max_score
4. Do NOT edit criteria_text
5. Click "Save Changes"

**Expected:**
- ✅ max_score updated in database
- ✅ criteria_text remains UNCHANGED
- ✅ No errors

**Status:** ⏳ Not Tested

---

## Test Case 5: Verify Existing Submissions Still Work

**Purpose:** Ensure edited criteria don't break existing evaluations

**Steps:**
1. Edit criteria as in Test Case 1
2. Navigate to existing submission that was evaluated with old criteria
3. View submission detail page
4. Check feedback/scores section

**Expected:**
- ✅ Submission page loads without errors
- ✅ Scores still display correctly
- ✅ Feedback still references criteria correctly
- ✅ No broken foreign key errors in frontend

**Status:** ⏳ Not Tested

---

## Test Case 6: Submit New Document After Editing Criteria

**Purpose:** Verify new submissions use updated criteria

**Steps:**
1. Edit criteria_text with detailed rubric
2. Save changes
3. Submit new document to session using this overlay
4. Wait for AI analysis to complete
5. View feedback for new submission

**Expected:**
- ✅ AI uses NEW criteria_text in evaluation
- ✅ Feedback reflects updated rubric guidance
- ✅ Scoring uses updated max_score
- ✅ New evaluation_responses created with correct criteria_id

**Status:** ⏳ Not Tested

---

## Test Case 7: CloudWatch Logs Verification

**Purpose:** Verify backend logs show UPDATE operations

**Steps:**
1. Edit criteria via frontend
2. Check CloudWatch logs for overlays Lambda
3. Search for log entries from handleUpdate function

**Expected Logs:**
```
Updating criteria for overlay {overlay_id}, received {N} criteria
  - Updated criterion: {criteria_id} (criteria_text: updated, max_score: 150)
  - Updated criterion: {criteria_id} (criteria_text: unchanged, max_score: unchanged)
Successfully processed {N} criteria for overlay {overlay_id}
```

**Should NOT see:**
```
DELETE FROM evaluation_criteria WHERE overlay_id = $1
Inserted criterion: ...
```

**How to Check:**
```bash
aws logs tail /aws/lambda/overlay-api-overlays --since 5m --follow
```

**Status:** ⏳ Not Tested

---

## Test Case 8: Rollback Test (If Something Breaks)

**Purpose:** Verify backup can be restored

**Steps:**
1. If fix causes issues, restore backup:
   ```bash
   cp lambda/functions/api/overlays/index.js.backup-20260201 lambda/functions/api/overlays/index.js
   ```
2. Redeploy:
   ```bash
   cdk deploy OverlayComputeStack --require-approval never
   ```

**Expected:**
- ✅ Backup restores to previous version
- ✅ Redeployment succeeds
- ✅ System returns to pre-fix state

**Status:** ⏳ Not Needed (only if fix fails)

---

## Test Case 9: Error Handling - Invalid criteria_id

**Purpose:** Verify graceful handling of non-existent criteria_id

**Steps:**
1. Manually send PUT request with fake criteria_id:
   ```bash
   curl -X PUT \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"criteria":[{"criteria_id":"00000000-0000-0000-0000-000000000000","criteria_text":"test","max_score":100}]}' \
     https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays/YOUR_OVERLAY_ID
   ```

**Expected:**
- ✅ No error thrown
- ✅ Log warning: "Criterion 00000000-0000-0000-0000-000000000000 not found for overlay {id}"
- ✅ rowCount = 0 (no update occurred)
- ✅ 200 response (not 500 error)

**Status:** ⏳ Not Tested

---

## Regression Tests

### Regression 1: Create New Overlay (Should Still Work)

**Steps:**
1. Create new overlay with criteria
2. Verify criteria inserted correctly
3. No evaluation_responses exist yet

**Expected:**
- ✅ New overlay creates successfully
- ✅ Criteria inserted with new UUIDs
- ✅ No errors

**Status:** ⏳ Not Tested

### Regression 2: Update Overlay Metadata (Should Still Work)

**Steps:**
1. Update overlay name and description (not criteria)
2. Send PUT request without criteria field

**Expected:**
- ✅ Overlay metadata updates
- ✅ Criteria remain unchanged
- ✅ No errors

**Status:** ⏳ Not Tested

---

## Success Criteria

**Fix is considered successful if:**

1. ✅ Test Case 1 passes (edit criteria with existing evaluations)
2. ✅ No foreign key constraint errors
3. ✅ criteria_text updates correctly
4. ✅ max_score updates correctly
5. ✅ criteria_id remains unchanged
6. ✅ Foreign key relationships preserved
7. ✅ CloudWatch logs show UPDATE operations (not DELETE)
8. ✅ At least 2 regression tests pass

**Minimum Required:**
- Test Case 1 MUST pass (this was the failing scenario)

---

## Known Limitations After Fix

1. **No Concurrent Edit Protection:**
   - Multiple users can edit same criteria simultaneously
   - Last save wins

2. **No Audit Trail:**
   - No history of who changed what
   - No "revert to previous" functionality

3. **UPDATE-Only Design:**
   - Cannot delete criteria via this endpoint
   - Cannot reorder criteria via this endpoint
   - Only updates criteria_text and max_score

---

## Rollback Plan (If Needed)

**If fix causes unexpected issues:**

1. **Restore backup:**
   ```bash
   cp lambda/functions/api/overlays/index.js.backup-20260201 lambda/functions/api/overlays/index.js
   ```

2. **Redeploy:**
   ```bash
   cdk deploy OverlayComputeStack --require-approval never
   ```

3. **Verify rollback:**
   - Previous behavior restored
   - Edit Criteria will fail again (expected)
   - Other overlay operations still work

4. **Alternative fix:**
   - Investigate why UPDATE approach failed
   - Consider alternative approaches (stored procedure, CASCADE delete, etc.)

---

## Post-Testing Actions

**After all tests pass:**

1. ✅ Mark all test cases as "Passed"
2. ✅ Update EDIT_CRITERIA_BUG_ANALYSIS.md with test results
3. ✅ Push changes to GitHub
4. ✅ Update user documentation
5. ✅ Consider deleting backup file after 7 days

**If any tests fail:**

1. Document failure in this checklist
2. Check CloudWatch logs for errors
3. Review database state
4. Determine if rollback needed
5. Create new fix if needed

---

## Test Results Summary

**Total Tests:** 9 (7 primary + 2 regression)
**Passed:** 0
**Failed:** 0
**Not Tested:** 9

**Tested By:** _______________
**Date:** _______________
**Environment:** Production (deployed at 15:36 UTC on 2026-02-01)

---

**PRIMARY TEST:** Test Case 1 - Edit Criteria with Existing Evaluations
**Result:** ⏳ PENDING

**This is the critical test. If this passes, the fix is working.**

---

**END OF TEST CHECKLIST**
