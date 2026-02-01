# Frontend Field Name Fix - Test Verification

**Date:** 2026-02-01
**Fix Applied:** Updated frontend from criterion_id to criteria_id
**Commit:** 8bf37ca
**Files Modified:** 2 frontend files (10 changes total)

---

## What Was Fixed

**Problem:**
- Backend API changed field name from `criterion_id` to `criteria_id` (commit b1bd519)
- Two frontend pages still expected old `criterion_id` field name
- Criteria disappeared from session pages

**Solution:**
- Updated Session Detail Page (1 reference)
- Updated Overlay Management Page (9 references)
- Both pages now use `criteria_id` to match API

---

## Test Verification Steps

### Prerequisites

1. **Start both dev servers:**
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

---

## Test 1: Session Detail Page - Criteria Display

**Purpose:** Verify evaluation criteria now display on session pages

**Steps:**

1. **Navigate to session page:**
   - Open http://localhost:3000
   - Login with admin credentials
   - Click on any active session (e.g., "Grant Application Review")

2. **Scroll to "Evaluation Criteria" section:**
   - Look for card titled "Evaluation Criteria"
   - Should be below document submissions list

3. **Verify criteria display:**
   - **Expected:** See list of evaluation criteria
   - Each criterion should show:
     - Name (e.g., "Question 1 - Project Need")
     - Category badge (e.g., "text")
     - Weight percentage
     - Max Score value
     - Description (if available)

4. **Check console:**
   - Press F12 → Console tab
   - **Expected:** No errors
   - **Especially no:** "Cannot read property 'criterion_id' of undefined"

**Success Criteria:**
- ✅ Criteria section displays with data
- ✅ All criteria show correctly
- ✅ No console errors
- ✅ React keys working (no duplicate key warnings)

**Status:** ⏳ Not Tested

---

## Test 2: Overlay Management Page - View Criteria

**Purpose:** Verify criteria display on overlay management page

**Steps:**

1. **Navigate to overlay page:**
   - From dashboard, click "Overlays" in navigation
   - Click on an overlay (e.g., "Grant Application Review")

2. **View criteria section:**
   - Scroll to "Evaluation Criteria" section
   - **Expected:** See list of all criteria

3. **Verify each criterion card shows:**
   - Criterion name
   - Description
   - Weight value
   - Max Score value
   - Category
   - "Edit" and "Delete" buttons visible

4. **Check console:**
   - **Expected:** No errors
   - **No:** "undefined" errors related to criterion_id

**Success Criteria:**
- ✅ All criteria display correctly
- ✅ Cards render properly
- ✅ Edit/Delete buttons visible
- ✅ No console errors

**Status:** ⏳ Not Tested

---

## Test 3: Overlay Management Page - Edit Criterion

**Purpose:** Verify edit functionality works with new field name

**Steps:**

1. **On overlay management page:**
   - Click "Edit" button on any criterion
   - **Expected:** Criterion switches to edit mode

2. **Edit mode displays:**
   - Form fields pre-filled with current values
   - Can edit: Name, Description, Category, Weight, Max Score
   - "Save Changes" and "Cancel" buttons visible

3. **Make a change:**
   - Edit the description field
   - Click "Save Changes"

4. **Verify save:**
   - **Expected:** Success message appears
   - Criterion switches back to view mode
   - Changes persisted

5. **Check console:**
   - **Expected:** No errors during edit or save

**Success Criteria:**
- ✅ Edit mode activates correctly
- ✅ Can save changes
- ✅ Success message appears
- ✅ No console errors

**Status:** ⏳ Not Tested

---

## Test 4: Overlay Management Page - Delete Criterion

**Purpose:** Verify delete functionality works with new field name

**Steps:**

1. **On overlay management page:**
   - Click "Delete" button (trash icon) on a criterion
   - **Expected:** Confirmation dialog appears

2. **Confirm deletion:**
   - Click confirm in dialog
   - **Expected:** Criterion removed from list

3. **Verify deletion:**
   - Criterion no longer in list
   - Success message may appear
   - Page still functional

4. **Check console:**
   - **Expected:** No errors during deletion

**Success Criteria:**
- ✅ Delete button works
- ✅ Criterion removed from list
- ✅ No console errors

**Status:** ⏳ Not Tested

---

## Test 5: Edit Criteria Page (Regression Test)

**Purpose:** Verify Edit Criteria page still works (wasn't changed)

**Steps:**

1. **Navigate to session page:**
   - Click on any session
   - Scroll to "Evaluation Criteria" section
   - Click "Edit Criteria" button (top right of card)

2. **Verify page loads:**
   - Edit Criteria page displays
   - All criteria show with text areas and score inputs

3. **Make an edit:**
   - Edit criteria_text for any criterion
   - Click "Save Changes"

4. **Verify save:**
   - **Expected:** Success message
   - Changes persist

**Success Criteria:**
- ✅ Edit Criteria page works (no regression)
- ✅ Can still save changes
- ✅ No errors

**Status:** ⏳ Not Tested

---

## Test 6: Browser DevTools - Network Tab

**Purpose:** Verify API response has correct field name

**Steps:**

1. **Open DevTools:**
   - Press F12 → Network tab
   - Clear network log

2. **Navigate to session page:**
   - Click on a session
   - Wait for page to load

3. **Find API call:**
   - Look for GET request to `/overlays/{overlay_id}`
   - Click on the request → Response tab

4. **Inspect response:**
   - Expand `criteria` array
   - Look at first criterion object

**Expected Response:**
```json
{
  "criteria": [
    {
      "criteria_id": "abc-123-uuid-here",  // ← Field is criteria_id
      "name": "Question 1 - Project Need",
      "description": "...",
      "category": "text",
      "weight": 100,
      "max_score": 100,
      ...
    }
  ]
}
```

**Success Criteria:**
- ✅ Response contains `criteria_id` field (not `criterion_id`)
- ✅ Value is a valid UUID
- ✅ Frontend successfully reads this field

**Status:** ⏳ Not Tested

---

## Test 7: React Developer Tools (Optional)

**Purpose:** Verify component state uses correct field

**Steps:**

1. **Install React DevTools** (if not installed):
   - Chrome extension or Firefox add-on

2. **Navigate to session page:**
   - Open session with criteria

3. **Open React DevTools:**
   - Components tab
   - Find SessionDetailPage component
   - Inspect `overlay` state

4. **Check criteria state:**
   - Expand `overlay.criteria` array
   - Look at first criterion object

**Expected State:**
```javascript
criteria: [
  {
    criteria_id: "abc-123",  // ← Uses criteria_id
    name: "...",
    ...
  }
]
```

**Success Criteria:**
- ✅ State has `criteria_id` field
- ✅ No `criterion_id` field present
- ✅ Component renders correctly with this data

**Status:** ⏳ Not Tested (Optional)

---

## Common Issues to Watch For

### Issue 1: Criteria Still Not Displaying

**Symptom:** Criteria section shows "No criteria found" or empty

**Check:**
1. Clear browser cache (Ctrl+F5)
2. Verify dev server restarted after changes
3. Check API response in Network tab (does it have criteria array?)
4. Check console for errors

**Fix:**
- Hard refresh: Ctrl+Shift+R
- Clear .next cache again: `rm -rf frontend/.next`
- Restart dev server

---

### Issue 2: Console Errors About "undefined"

**Symptom:** Error: "Cannot read property 'criteria_id' of undefined"

**Check:**
1. Did we miss a reference?
2. Is data actually coming from API?
3. Check Network tab for API response

**Fix:**
- Grep for any remaining `criterion_id` references:
  ```bash
  grep -r "criterion_id" frontend/app/
  ```
- If found, update to `criteria_id`

---

### Issue 3: Edit/Delete Buttons Don't Work

**Symptom:** Clicking Edit or Delete does nothing

**Check:**
1. Console errors when clicking?
2. Are handlers receiving correct ID?
3. Check React DevTools for component state

**Fix:**
- Verify all event handlers updated to use `criteria_id`
- Check handleSaveEdit, handleDeleteCriterion functions

---

## Success Criteria Summary

**All tests must pass:**

- ✅ Test 1: Session page displays criteria
- ✅ Test 2: Overlay page displays criteria
- ✅ Test 3: Edit criterion works
- ✅ Test 4: Delete criterion works
- ✅ Test 5: Edit Criteria page still works (no regression)
- ✅ Test 6: API response verified
- ⏸️ Test 7: React DevTools (optional)

**Minimum Required:**
- Tests 1, 2, 3 MUST pass
- No console errors

---

## Files Modified Summary

**Session Detail Page:**
- `frontend/app/session/[id]/page.tsx`
- 1 change: React key from `criterion.criterion_id` → `criterion.criteria_id`

**Overlay Management Page:**
- `frontend/app/overlays/[id]/page.tsx`
- 9 changes:
  1. Interface definition: `criterion_id` → `criteria_id`
  2. Temp ID assignment: `criterion_id` → `criteria_id`
  3. handleStartEdit: `criterion.criterion_id` → `criterion.criteria_id`
  4. Map comparison: `c.criterion_id` → `c.criteria_id`
  5. Filter comparison: `c.criterion_id` → `c.criteria_id`
  6. React key: `criterion.criterion_id` → `criterion.criteria_id`
  7. Edit mode check: `criterion.criterion_id` → `criterion.criteria_id`
  8. Save handler: `criterion.criterion_id` → `criterion.criteria_id`
  9. Delete handler: `criterion.criterion_id` → `criterion.criteria_id`

---

## Test Results

**Total Tests:** 6 required + 1 optional = 7 tests
**Passed:** 0
**Failed:** 0
**Not Tested:** 7

**Tested By:** _______________
**Date:** _______________
**Environment:** Development (localhost:3000)

---

## Next Steps After Testing

**If all tests pass:**
1. ✅ Mark tests as passed
2. ✅ Delete temporary test files if any
3. ✅ Consider feature complete
4. ✅ Update user documentation if needed

**If tests fail:**
1. Document failure details
2. Check console errors
3. Grep for any remaining `criterion_id` references
4. Apply additional fixes if needed
5. Re-test

---

**END OF TEST VERIFICATION GUIDE**
