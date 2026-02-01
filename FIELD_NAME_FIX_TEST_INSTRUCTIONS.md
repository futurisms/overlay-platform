# Field Name Fix - Test Instructions

**Date:** 2026-02-01
**Fix Applied:** Consistent criteria_id field name in GET handler
**Deployment:** OverlayComputeStack deployed at 15:56 UTC
**Commit:** b1bd519

---

## What Was Fixed

**Problem:**
- GET handler returned `criterion_id` (inconsistent)
- PUT handler expected `criteria_id` (database column name)
- Frontend received `criterion_id`, tried to send `criteria_id` (undefined)
- Backend saw no `criteria_id` field → triggered INSERT path
- INSERT failed: "null value in column 'name' violates not-null constraint"

**Solution:**
- Changed GET handler line 70 from `criterion_id` to `criteria_id`
- Now both GET and PUT use consistent `criteria_id` field name
- Frontend will receive `criteria_id` and send it back correctly
- Backend will recognize criteria for UPDATE, not INSERT

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
   - Use existing overlay with criteria
   - Example: "Innovate UK Smart Grant - 13 Criteria"

---

## Test Case 1: Verify GET Returns criteria_id (CRITICAL)

**Purpose:** Confirm GET handler now returns consistent field name

**Steps:**

1. **Open browser DevTools**
   - Press F12 → Network tab
   - Clear network log

2. **Navigate to Session Detail page**
   - Login at http://localhost:3000/login
   - Click any session
   - Wait for page to load

3. **Check API response**
   - Find GET request to `/overlays/{overlay_id}` in Network tab
   - Click the request → Response tab
   - Expand `criteria` array
   - Look at first criterion object

**Expected Result:**
```json
{
  "criteria": [
    {
      "criteria_id": "abc-123-uuid-here",  // ✅ Field name is criteria_id
      "name": "Question 1 - Project Need",
      "criteria_text": "Assess the clarity...",
      "max_score": 100,
      ...
    }
  ]
}
```

**Success Criteria:**
- ✅ Field is named `criteria_id` (NOT `criterion_id`)
- ✅ Value is a valid UUID
- ✅ All criteria have `criteria_id` field

**Status:** ⏳ Not Tested

---

## Test Case 2: Edit Criteria Without Error (PRIMARY TEST)

**Purpose:** Verify the complete fix - editing criteria now works

**Steps:**

1. **Navigate to Edit Criteria page**
   - From Session Detail page
   - Scroll to "Evaluation Criteria" section
   - Click "Edit Criteria" button

2. **Edit a criterion**
   - Find first criterion
   - Update criteria_text:
     ```
     TEST FIX: This rubric has been edited to verify the criteria_id field fix works.

     The system now sends criteria_id consistently, so UPDATE path will be used.
     ```
   - Update max_score (e.g., change 100 to 125)

3. **Save changes**
   - Click "Save Changes" button
   - Watch for response

**Expected Result:**
- ✅ No error message
- ✅ Success message: "Criteria updated successfully!" (green)
- ✅ Success message auto-dismisses after 3 seconds
- ✅ Form remains on edit page with updated values

**What Would Have Failed Before:**
- ❌ Error: "null value in column 'name' violates not-null constraint"
- ❌ Red error alert at top of page
- ❌ Changes not saved

**Status:** ⏳ Not Tested

---

## Test Case 3: Verify Database Updated (Not Inserted)

**Purpose:** Confirm UPDATE path was used, not INSERT

**Steps:**

1. **Check CloudWatch Logs**
   ```bash
   aws logs tail /aws/lambda/overlay-api-overlays --since 5m
   ```

2. **Look for log messages**

**Expected Logs:**
```
Updating criteria for overlay {overlay_id}, received {N} criteria
  - Updated criterion: {criteria_id} (criteria_text: updated, max_score: 125)
Successfully processed {N} criteria for overlay {overlay_id}
```

**Should NOT see:**
```
Inserted new criterion: ...
```

**Success Criteria:**
- ✅ Log shows "Updated criterion" message
- ✅ Log shows correct criteria_id (UUID)
- ✅ Log shows criteria_text: updated
- ✅ No "Inserted new criterion" messages

**Status:** ⏳ Not Tested

---

## Test Case 4: Verify criteria_id Unchanged in Database

**Purpose:** Confirm criteria_id was preserved (not regenerated)

**Steps:**

1. **Before editing, note criteria_id:**
   - Navigate to Edit Criteria page
   - Open DevTools Console
   - Run:
     ```javascript
     console.log(window.location.pathname); // Note overlay_id
     ```
   - Check Network tab for GET /overlays/{id} response
   - Note the `criteria_id` value for first criterion

2. **Edit and save criterion**
   - Edit criteria_text and/or max_score
   - Save changes

3. **Check criteria_id after save:**
   - Refresh page or click "Edit Criteria" again
   - Check Network tab for GET /overlays/{id} response
   - Compare `criteria_id` value

**Expected Result:**
- ✅ `criteria_id` is IDENTICAL before and after edit
- ✅ Same UUID value preserved
- ✅ No new UUID generated

**Why This Matters:**
- If criteria_id changed → INSERT was used (WRONG)
- If criteria_id same → UPDATE was used (CORRECT)

**Status:** ⏳ Not Tested

---

## Test Case 5: Edit Multiple Criteria

**Purpose:** Verify batch updates work with consistent field names

**Steps:**

1. Navigate to Edit Criteria page
2. Edit criteria_text for 3 different criteria
3. Edit max_score for 2 different criteria
4. Click "Save Changes"

**Expected Result:**
- ✅ No errors
- ✅ Success message appears
- ✅ All 5 changes persisted
- ✅ CloudWatch logs show 5 "Updated criterion" messages

**Status:** ⏳ Not Tested

---

## Test Case 6: Verify Existing Submissions Still Work

**Purpose:** Ensure foreign key relationships intact

**Steps:**

1. Edit criteria (Test Case 2)
2. Navigate to existing submission that was evaluated
3. View submission detail page
4. Check feedback section

**Expected Result:**
- ✅ Submission page loads without errors
- ✅ Scores display correctly
- ✅ Feedback still references criteria correctly
- ✅ No broken foreign key errors

**Status:** ⏳ Not Tested

---

## Test Case 7: Frontend State Consistency

**Purpose:** Verify frontend correctly handles criteria_id field

**Steps:**

1. **Navigate to Edit Criteria page**
2. **Open DevTools Console**
3. **Check component state:**
   - Open React DevTools (if installed)
   - Find EditCriteriaPage component
   - Inspect `criteria` state

**Expected State:**
```javascript
criteria: [
  {
    criteria_id: "abc-123-uuid",  // ✅ Field name is criteria_id
    name: "Question 1",
    criteria_text: "...",
    max_score: 100,
    ...
  }
]
```

**Success Criteria:**
- ✅ State has `criteria_id` field (not `criterion_id`)
- ✅ Value is valid UUID
- ✅ No undefined values

**Status:** ⏳ Not Tested

---

## Test Case 8: API Request Payload Verification

**Purpose:** Confirm frontend sends correct field name

**Steps:**

1. **Navigate to Edit Criteria page**
2. **Open DevTools → Network tab**
3. **Edit a criterion and save**
4. **Check PUT request payload:**
   - Find PUT request to `/overlays/{id}`
   - Click request → Payload/Request tab
   - Inspect JSON body

**Expected Payload:**
```json
{
  "criteria": [
    {
      "criteria_id": "abc-123-uuid",  // ✅ Field is criteria_id
      "criteria_text": "Updated text...",
      "max_score": 125
    }
  ]
}
```

**Success Criteria:**
- ✅ Payload includes `criteria_id` field (not undefined)
- ✅ `criteria_id` has valid UUID value
- ✅ Backend will recognize it for UPDATE

**Status:** ⏳ Not Tested

---

## Regression Tests

### Regression 1: View Overlay Still Works

**Steps:**
1. Navigate to Session Detail page
2. View "Evaluation Criteria" section

**Expected:**
- ✅ All criteria display correctly
- ✅ No console errors
- ✅ Frontend doesn't break with new field name

**Status:** ⏳ Not Tested

---

### Regression 2: Create New Overlay (If Supported)

**Steps:**
1. Create new overlay with criteria
2. View overlay
3. Edit criteria

**Expected:**
- ✅ New overlay creates successfully
- ✅ Criteria returned with `criteria_id` field
- ✅ Can edit criteria immediately

**Status:** ⏳ Not Tested

---

## Success Criteria

**Fix is considered successful if:**

1. ✅ Test Case 1 passes (GET returns `criteria_id`)
2. ✅ Test Case 2 passes (Edit saves without error)
3. ✅ Test Case 3 passes (CloudWatch shows UPDATE, not INSERT)
4. ✅ Test Case 4 passes (criteria_id unchanged)
5. ✅ Test Case 8 passes (Frontend sends `criteria_id` in payload)

**Minimum Required:**
- Test Case 2 MUST pass (this was the failing scenario)

---

## Rollback Plan (If Needed)

**If fix causes unexpected issues:**

1. **Revert commit:**
   ```bash
   git revert b1bd519
   ```

2. **Redeploy:**
   ```bash
   cdk deploy OverlayComputeStack --require-approval never
   ```

3. **Alternative fix:**
   - If reverting, consider fixing frontend instead
   - Change frontend to use `c.criterion_id` in map function
   - But this is NOT recommended (backend should be consistent)

---

## Post-Testing Actions

**After all tests pass:**

1. ✅ Mark all test cases as "Passed"
2. ✅ Update EDIT_CRITERIA_BUG_ANALYSIS.md with resolution
3. ✅ Update EDIT_CRITERIA_FIX_TEST_CHECKLIST.md
4. ✅ Delete temporary test files if any
5. ✅ Consider the Edit Criteria feature COMPLETE

**If any tests fail:**

1. Document failure details
2. Check CloudWatch logs for errors
3. Review database state
4. Determine if additional fix needed
5. Do NOT proceed to production use until passing

---

## Test Results Summary

**Total Tests:** 8 primary + 2 regression = 10 tests
**Passed:** 0
**Failed:** 0
**Not Tested:** 10

**Tested By:** _______________
**Date:** _______________
**Environment:** Production (deployed at 15:56 UTC on 2026-02-01)

---

**PRIMARY TEST:** Test Case 2 - Edit Criteria Without Error
**Result:** ⏳ PENDING

**This is the critical test. If this passes, the field name fix is working.**

---

**END OF TEST INSTRUCTIONS**
