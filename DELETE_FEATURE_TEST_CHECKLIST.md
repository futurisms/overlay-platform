# DELETE SUBMISSION FEATURE - TEST CHECKLIST
**Date:** 2026-02-01
**Feature:** Delete button with confirmation dialog on submissions list
**Location:** Session detail page (frontend/app/session/[id]/page.tsx)

---

## Prerequisites

1. ✅ Frontend servers running:
   - Terminal 1: `cd frontend && node proxy-server.js`
   - Terminal 2: `cd frontend && npm run dev`

2. ✅ Logged in as admin@example.com

3. ✅ Have at least 2-3 test submissions in a session

---

## Test Cases

### Test 1: UI Elements Display

**Steps:**
1. Navigate to any session detail page
2. Locate the submissions list section

**Expected Results:**
- [ ] Each submission card shows a trash icon button on the right side
- [ ] Trash icon is styled in red color
- [ ] Button is positioned correctly (not overlapping text)
- [ ] Button has hover effect (lighter red background)

**Status:** Not Tested

---

### Test 2: Delete Button Click (Open Dialog)

**Steps:**
1. Click the trash icon on any submission

**Expected Results:**
- [ ] Confirmation dialog appears immediately
- [ ] Dialog shows submission name in bold
- [ ] Dialog message: "Are you sure you want to delete [NAME]? This action cannot be undone..."
- [ ] Dialog has two buttons: "Cancel" and "Delete"
- [ ] Delete button is styled red/destructive
- [ ] Clicking trash icon does NOT navigate to submission detail page

**Status:** Not Tested

---

### Test 3: Cancel Delete Action

**Steps:**
1. Click trash icon on a submission
2. In the dialog, click "Cancel" button

**Expected Results:**
- [ ] Dialog closes
- [ ] Submission remains in the list
- [ ] No API call made (check Network tab)
- [ ] No error messages

**Status:** Not Tested

---

### Test 4: Confirm Delete Action - Success

**Steps:**
1. Click trash icon on a submission
2. In the dialog, click "Delete" button
3. Wait for deletion to complete

**Expected Results:**
- [ ] "Delete" button shows "Deleting..." with spinner
- [ ] Both buttons disabled during deletion
- [ ] Network tab shows DELETE request to `/submissions/{id}`
- [ ] Request includes Authorization header
- [ ] Response: 200 OK with success message
- [ ] Dialog closes after successful deletion
- [ ] Deleted submission removed from list immediately
- [ ] Other submissions remain visible
- [ ] No page refresh required

**Status:** Not Tested

---

### Test 5: Delete Last Submission in Session

**Steps:**
1. Find a session with only 1 submission
2. Delete that submission
3. Observe the result

**Expected Results:**
- [ ] Deletion succeeds
- [ ] List shows empty state: "No submissions yet"
- [ ] Session page remains accessible
- [ ] Can still upload new submissions

**Status:** Not Tested

---

### Test 6: Delete Submission with Appendices

**Steps:**
1. Find a submission that has appendices attached
2. Delete that submission
3. Check database/S3 (optional)

**Expected Results:**
- [ ] Deletion succeeds
- [ ] Main document removed from S3
- [ ] All appendices removed from S3 (CASCADE)
- [ ] Database records cleaned up
- [ ] No orphaned data

**Status:** Not Tested

---

### Test 7: Delete Submission with Completed AI Analysis

**Steps:**
1. Find a submission with status="completed" and feedback
2. Delete that submission

**Expected Results:**
- [ ] Deletion succeeds
- [ ] Feedback reports deleted (CASCADE)
- [ ] Evaluation responses deleted (CASCADE)
- [ ] No orphaned feedback data

**Status:** Not Tested

---

### Test 8: Delete Submission with In-Progress Analysis

**Steps:**
1. Submit a new document (AI analysis starts)
2. Immediately try to delete while status="in_progress"

**Expected Results:**
- [ ] Deletion succeeds OR shows appropriate warning
- [ ] Step Functions execution continues or is aborted
- [ ] No errors in CloudWatch logs
- [ ] Submission removed from list

**Status:** Not Tested

---

### Test 9: Error Handling - Network Failure

**Steps:**
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Try to delete a submission

**Expected Results:**
- [ ] Error message displays: "Failed to delete submission"
- [ ] Dialog remains open
- [ ] Submission NOT removed from list
- [ ] Can retry after going back online

**Status:** Not Tested

---

### Test 10: Error Handling - 404 Not Found

**Steps:**
1. Manually edit submission_id in deleteSubmissionId state (DevTools)
2. Try to delete with invalid ID

**Expected Results:**
- [ ] Error message displays with appropriate text
- [ ] Dialog closes or shows error
- [ ] List remains unchanged

**Status:** Not Tested

---

### Test 11: Error Handling - 401 Unauthorized

**Steps:**
1. Clear auth token: `localStorage.removeItem('auth_token')`
2. Try to delete a submission

**Expected Results:**
- [ ] Error message displays: "Unauthorized" or similar
- [ ] Submission NOT deleted
- [ ] May redirect to login page

**Status:** Not Tested

---

### Test 12: Multiple Rapid Clicks Prevention

**Steps:**
1. Click trash icon
2. Immediately click "Delete" multiple times rapidly

**Expected Results:**
- [ ] Button disabled after first click
- [ ] Only ONE DELETE request sent
- [ ] No duplicate deletions
- [ ] Loading state shows during request

**Status:** Not Tested

---

### Test 13: Keyboard Navigation

**Steps:**
1. Click trash icon to open dialog
2. Press Tab key to navigate
3. Press Enter on focused button

**Expected Results:**
- [ ] Can tab between Cancel and Delete buttons
- [ ] Focus visible on buttons
- [ ] Enter key activates focused button
- [ ] Escape key closes dialog (same as Cancel)

**Status:** Not Tested

---

### Test 14: Mobile/Responsive View

**Steps:**
1. Resize browser to mobile width (375px)
2. Try to delete a submission

**Expected Results:**
- [ ] Trash icon visible and clickable
- [ ] Dialog displays correctly on small screen
- [ ] Buttons stack vertically if needed
- [ ] All text readable

**Status:** Not Tested

---

### Test 15: Backend Verification

**Steps:**
1. Delete a submission
2. Check backend logs

**Expected Results:**
- [ ] CloudWatch logs show DELETE handler invoked
- [ ] Log: "Deleted submission {id}"
- [ ] Log: "Deleted X associated records"
- [ ] No error logs
- [ ] Database query shows submission removed

**Verification Query:**
```sql
SELECT submission_id, document_name, status
FROM document_submissions
WHERE submission_id = '{deleted_id}';
-- Should return 0 rows
```

**Status:** Not Tested

---

## Summary

**Total Tests:** 15
**Passed:** 0
**Failed:** 0
**Not Tested:** 15

---

## Known Issues / Notes

_(Fill in during testing)_

-

---

## Code Changes Made

### Files Modified:
1. `frontend/app/session/[id]/page.tsx`
   - Added Trash2 icon import
   - Added AlertDialog imports
   - Added state: deleteSubmissionId, deleteSubmissionName, isDeleting
   - Added handlers: handleDeleteClick, handleDeleteConfirm, handleDeleteCancel
   - Added delete button to each submission card
   - Added AlertDialog for confirmation

2. `frontend/lib/api-client.ts`
   - Added `deleteSubmission(submissionId: string)` method
   - Method: DELETE /submissions/{id}

3. `frontend/components/ui/alert-dialog.tsx` (NEW)
   - Created shadcn/ui AlertDialog component
   - Used by delete confirmation dialog

### Backend API Endpoint (Already Exists):
- **Endpoint:** `DELETE /submissions/{id}`
- **Handler:** `lambda/functions/api/submissions/index.js` (line 410)
- **Status:** ✅ Implemented and deployed

---

## Deployment Status

- ✅ Backend: Already deployed (handleDelete exists in submissions Lambda)
- ⚠️ Frontend: Code changes made, NOT YET TESTED
- ⏳ Next: Manual testing required

---

**END OF TEST CHECKLIST**
