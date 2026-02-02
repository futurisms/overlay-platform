# Overlay Creation Fix - Test Verification Guide

**Date:** 2026-02-01
**Fix Applied:** Removed temp criteria_id generation
**Commit:** 289934f
**Files Modified:** 1 (frontend/app/overlays/[id]/page.tsx)

---

## What Was Fixed

**Problem:**
- Frontend sent temp IDs like `temp-176997552241` for new criteria
- Backend tried to use temp IDs as UUIDs
- PostgreSQL rejected: "invalid input syntax for type uuid: 'temp-176997552241'"
- Users couldn't add criteria to overlays

**Solution:**
- Removed temp ID generation from frontend (line 116)
- Backend now generates real UUIDs via `uuid_generate_v4()`
- Frontend reloads data after add to get real UUID

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

3. **Clear browser cache:**
   - Press Ctrl+Shift+Delete
   - Clear cached images and files
   - Or use Ctrl+F5 for hard refresh

---

## Test 1: Add Criterion to Existing Overlay

**Purpose:** Verify can add criteria without temp ID error

**Steps:**

1. **Navigate to overlays page:**
   - Open http://localhost:3000
   - Login with admin credentials
   - Click "Overlays" in navigation

2. **Open existing overlay:**
   - Click on "Grant Application Review" overlay
   - Scroll to "Evaluation Criteria" section

3. **Click "Add New Criterion" button:**
   - Form should expand below existing criteria

4. **Fill in criterion details:**
   - **Name:** "Test Criterion - Overlay Fix"
   - **Description:** "Testing the temp ID fix"
   - **Category:** "test"
   - **Weight:** 0.5
   - **Max Score:** 100

5. **Click "Add Criterion" button:**
   - **Expected:** Success message appears
   - **Expected:** Form closes
   - **Expected:** Page reloads with new criterion visible
   - **Expected:** NO error about "invalid input syntax for type uuid"

6. **Verify new criterion:**
   - New criterion appears in list
   - Shows correct name and details
   - Has Edit and Delete buttons

7. **Check browser console (F12):**
   - **Expected:** No errors
   - **Expected:** No warnings about temp IDs

**Success Criteria:**
- ✅ Can add criterion without errors
- ✅ Success message displays
- ✅ New criterion appears in list
- ✅ No console errors
- ✅ Criterion has real UUID (not visible in UI, but no errors means it worked)

**Status:** ⏳ Not Tested

---

## Test 2: Add Multiple Criteria in Sequence

**Purpose:** Verify can add multiple criteria without issues

**Steps:**

1. **On same overlay page from Test 1:**
   - Click "Add New Criterion" again

2. **Add second criterion:**
   - **Name:** "Test Criterion 2"
   - **Description:** "Second test criterion"
   - **Category:** "test"
   - **Weight:** 0.3
   - **Max Score:** 50
   - Click "Add Criterion"

3. **Verify second criterion added:**
   - Success message appears
   - Page reloads
   - Both new criteria visible

4. **Add third criterion:**
   - **Name:** "Test Criterion 3"
   - **Description:** "Third test criterion"
   - **Category:** "test"
   - **Weight:** 0.2
   - **Max Score:** 25
   - Click "Add Criterion"

5. **Verify all three criteria:**
   - All three new criteria visible
   - All show correct details
   - No errors in console

**Success Criteria:**
- ✅ Can add multiple criteria sequentially
- ✅ Each add operation succeeds
- ✅ All criteria display correctly
- ✅ No accumulated errors

**Status:** ⏳ Not Tested

---

## Test 3: Create New Overlay with Criteria

**Purpose:** Verify works for newly created overlays too

**Steps:**

1. **Navigate to overlays page:**
   - Click "Overlays" in navigation
   - Click "Create New Overlay" button

2. **Fill overlay details:**
   - **Name:** "Test Overlay - Fix Verification"
   - **Description:** "Testing overlay creation fix"
   - **Document Type:** "test-document"
   - Click "Create Intelligence Template"

3. **Verify overlay created:**
   - Redirects to overlay detail page
   - Shows empty criteria section

4. **Add first criterion:**
   - Click "Add New Criterion"
   - **Name:** "First Criterion - New Overlay"
   - **Description:** "First criterion on new overlay"
   - **Category:** "test"
   - **Weight:** 1.0
   - **Max Score:** 100
   - Click "Add Criterion"

5. **Verify criterion added:**
   - **Expected:** Success message
   - **Expected:** Criterion appears in list
   - **Expected:** No temp ID errors

6. **Add second criterion to new overlay:**
   - Follow same process
   - Verify both criteria show

**Success Criteria:**
- ✅ Can create new overlay
- ✅ Can add criteria to new overlay
- ✅ No temp ID errors
- ✅ All operations succeed

**Status:** ⏳ Not Tested

---

## Test 4: Edit and Delete Still Work (Regression Test)

**Purpose:** Verify existing functionality not broken

**Steps:**

1. **On overlay with test criteria:**
   - Find one of the test criteria added earlier

2. **Test edit functionality:**
   - Click "Edit" button on test criterion
   - Change description to "EDITED - Testing edit still works"
   - Click "Save Changes"
   - **Expected:** Success message
   - **Expected:** Changes saved and visible

3. **Test delete functionality:**
   - Click "Delete" button (trash icon) on test criterion
   - **Expected:** Confirmation dialog appears
   - Click "Confirm"
   - **Expected:** Criterion removed from list
   - **Expected:** Success message

4. **Verify console:**
   - **Expected:** No errors during edit or delete

**Success Criteria:**
- ✅ Can edit existing criteria (with real UUIDs)
- ✅ Can delete existing criteria
- ✅ No errors or regressions

**Status:** ⏳ Not Tested

---

## Test 5: Backend Logs Verification

**Purpose:** Verify backend generates real UUIDs

**Steps:**

1. **Open AWS CloudWatch:**
   - Go to CloudWatch → Log groups
   - Find `/aws/lambda/overlay-api-overlays`

2. **Filter recent logs:**
   - Click on latest log stream
   - Look for log entries from test time

3. **Find INSERT logs:**
   - Search for: "Inserted new criterion"
   - **Expected log format:**
     ```
     Inserted new criterion: Test Criterion - Overlay Fix
     (id: a1b2c3d4-e5f6-7890-abcd-ef1234567890, type: test, weight: 100)
     ```

4. **Verify UUID format:**
   - **Expected:** Real UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - **NOT:** Temp ID like `temp-176997552241`

**Success Criteria:**
- ✅ Backend logs show INSERT operations
- ✅ UUIDs are real (8-4-4-4-12 format)
- ✅ No temp IDs in backend logs

**Status:** ⏳ Not Tested (Optional)

---

## Test 6: Database Verification

**Purpose:** Confirm real UUIDs in database

**Steps:**

1. **Query database via migration Lambda:**
   ```bash
   aws lambda invoke \
     --function-name overlay-database-migration \
     --payload '{"query": "SELECT criteria_id, name FROM evaluation_criteria WHERE name LIKE '\''Test Criterion%'\'' ORDER BY created_at DESC LIMIT 3"}' \
     --cli-binary-format raw-in-base64-out \
     query-result.json

   cat query-result.json
   ```

2. **Verify results:**
   - **Expected:** 3 rows returned (from Tests 1-3)
   - **Expected:** Each has real UUID criteria_id
   - **Format:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - **NOT:** `temp-176997552241`

**Success Criteria:**
- ✅ Database contains test criteria
- ✅ All criteria_id values are real UUIDs
- ✅ No temp IDs in database

**Status:** ⏳ Not Tested (Optional)

---

## Test 7: React Keys Working (Developer Tools)

**Purpose:** Verify React rendering uses real UUIDs as keys

**Steps:**

1. **Open React DevTools:**
   - Install React DevTools browser extension if needed
   - Press F12 → React tab

2. **Navigate to overlay page with criteria:**
   - Open overlay with test criteria

3. **Inspect component tree:**
   - Find criteria map/list component
   - Expand to see individual criterion components

4. **Check component keys:**
   - **Expected:** Each criterion has real UUID as key
   - **Expected:** No "key" warnings in console

**Success Criteria:**
- ✅ React uses real UUIDs as keys
- ✅ No duplicate key warnings
- ✅ No "key should be UUID" warnings

**Status:** ⏳ Not Tested (Optional)

---

## Common Issues to Watch For

### Issue 1: Still Getting Temp ID Error

**Symptom:** Error: "invalid input syntax for type uuid: 'temp-...'"

**Possible Causes:**
1. Browser cached old JavaScript
2. Dev server not restarted after code change
3. Code change not applied correctly

**Fix:**
1. Hard refresh browser: Ctrl+Shift+R
2. Clear browser cache completely
3. Verify code change: `git diff HEAD~1 frontend/app/overlays/[id]/page.tsx`
4. Restart dev server: Kill process, clear .next, restart

---

### Issue 2: Criteria Not Appearing After Add

**Symptom:** Success message shows but criterion doesn't appear

**Possible Causes:**
1. Frontend reload failing
2. Backend INSERT failing silently
3. GET request returning stale data

**Fix:**
1. Check browser console for errors
2. Check CloudWatch logs for backend errors
3. Manually refresh page (F5)
4. Query database to see if criterion was inserted

---

### Issue 3: Edit/Delete Buttons Not Working

**Symptom:** Can't edit or delete criteria after adding

**Possible Causes:**
1. Real UUID not being returned from backend
2. Frontend state not updated after reload
3. Event handlers not receiving correct IDs

**Fix:**
1. Check browser console for errors
2. Inspect React state with DevTools
3. Verify backend RETURNING clause works
4. Check if loadOverlayData() is being called

---

## Edge Cases to Test (Optional)

### Edge Case 1: Empty Description
- Add criterion with no description
- **Expected:** Should work (description is optional)

### Edge Case 2: Weight Boundaries
- Add criterion with weight: 0.0
- Add criterion with weight: 1.0
- **Expected:** Both should work

### Edge Case 3: Special Characters in Name
- Add criterion with name: "Test & Verify < > \" ' @"
- **Expected:** Should work without SQL injection issues

### Edge Case 4: Long Names
- Add criterion with 200+ character name
- **Expected:** Should work or show validation error

---

## Success Criteria Summary

**All tests must pass:**
- ✅ Test 1: Add criterion to existing overlay
- ✅ Test 2: Add multiple criteria in sequence
- ✅ Test 3: Create new overlay with criteria
- ✅ Test 4: Edit and delete still work (regression)
- ⏸️ Test 5: Backend logs verification (optional)
- ⏸️ Test 6: Database verification (optional)
- ⏸️ Test 7: React keys working (optional)

**Minimum Required:**
- Tests 1, 2, 3, 4 MUST pass
- No console errors
- No backend errors

---

## Cleanup After Testing

**Remove test data:**

1. **Delete test criteria via UI:**
   - Use Delete button on each test criterion
   - Confirm deletion

2. **Delete test overlay (optional):**
   - Navigate to overlays page
   - Find "Test Overlay - Fix Verification"
   - Delete if no longer needed

3. **Or keep test data:**
   - Test criteria can stay for future testing
   - No harm in leaving them

---

## Files Changed Summary

**Frontend:**
- `frontend/app/overlays/[id]/page.tsx` (Line 116)
  - **Before:** `criteria_id: \`temp-${Date.now()}\`,`
  - **After:** `// criteria_id will be generated by backend via uuid_generate_v4()`

**Backend:** NO CHANGES
- Backend already had correct INSERT/UPDATE logic
- Backend already generates UUIDs via `uuid_generate_v4()`

**Database:** NO CHANGES
- Schema already correct (criteria_id UUID type)
- Auto-generates UUIDs on INSERT

---

## Test Results

**Date Tested:** _______________
**Tested By:** _______________
**Environment:** Development (localhost:3000)

| Test | Status | Notes |
|------|--------|-------|
| Test 1: Add criterion | ⏳ Not Tested | |
| Test 2: Multiple criteria | ⏳ Not Tested | |
| Test 3: New overlay | ⏳ Not Tested | |
| Test 4: Edit/Delete regression | ⏳ Not Tested | |
| Test 5: Backend logs | ⏳ Not Tested | |
| Test 6: Database verification | ⏳ Not Tested | |
| Test 7: React keys | ⏳ Not Tested | |

**Overall Status:** ⏳ Not Tested

---

## Next Steps After Testing

**If all tests pass:**
1. ✅ Mark fix as verified
2. ✅ Push commit to remote
3. ✅ Close related issues
4. ✅ Update CLAUDE.md if needed

**If tests fail:**
1. Document failure details
2. Check console and CloudWatch logs
3. Verify code change applied correctly
4. Debug and apply additional fixes
5. Re-test

---

**END OF TEST GUIDE**
