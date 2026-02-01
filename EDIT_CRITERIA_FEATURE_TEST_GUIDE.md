# Edit Criteria Feature - Testing Guide

**Date:** 2026-02-01
**Feature:** Edit detailed rubric text and max scores for evaluation criteria
**Status:** ✅ Code Complete - Ready for Testing

---

## Overview

This feature allows administrators to edit detailed rubric text (`criteria_text`) and maximum scores (`max_score`) for evaluation criteria within an overlay. The AI agents use this rubric text to provide more detailed and consistent evaluations.

---

## Prerequisites

### 1. Frontend Servers Running

```bash
# Terminal 1: CORS Proxy
cd frontend
node proxy-server.js

# Terminal 2: Next.js Dev Server
cd frontend
npm run dev
```

### 2. Test Account

- **Email:** admin@example.com
- **Password:** TestPassword123!
- **Role:** system_admin

### 3. Test Data

You need:
- At least one overlay with criteria (e.g., "Innovate UK Smart Grant - 13 Criteria")
- At least one session using that overlay

---

## Test Cases

### Test 1: Navigation to Edit Criteria Page

**Steps:**
1. Login at http://localhost:3000/login
2. Navigate to Dashboard
3. Click on any active session
4. Scroll to "Evaluation Criteria" section
5. Click "Edit Criteria" button (top right of card)

**Expected Results:**
- ✅ "Edit Criteria" button visible in Evaluation Criteria section
- ✅ Button has Edit icon (pencil) + "Edit Criteria" text
- ✅ Clicking button navigates to `/overlays/{overlay_id}/edit-criteria`
- ✅ Page loads without errors

**Status:** ⏳ Not Tested

---

### Test 2: Page Load and Data Display

**Steps:**
1. Navigate to edit criteria page (from Test 1)
2. Wait for page to load

**Expected Results:**
- ✅ Page displays "Edit Evaluation Criteria" title
- ✅ Overlay name displayed as subtitle
- ✅ Overlay description shown (if exists)
- ✅ All criteria cards displayed in correct order
- ✅ Each criterion shows:
  - Criterion number and name
  - Description (if exists)
  - Textarea for criteria_text (rubric)
  - Number input for max_score
  - Read-only weight and display_order
- ✅ "Save Changes" button at bottom
- ✅ "Cancel" button at bottom

**Status:** ⏳ Not Tested

---

### Test 3: Edit Criteria Text (Rubric)

**Steps:**
1. On edit criteria page
2. Find first criterion
3. Click in "Detailed Rubric Text" textarea
4. Type or paste text:
   ```
   Assess the logical flow and coherence of arguments. Look for:
   - Clear thesis statement
   - Supporting evidence and examples
   - Smooth transitions between ideas
   - Consistent reasoning throughout

   Excellent (9-10): All elements present with sophisticated analysis
   Good (7-8): Most elements present with clear reasoning
   Fair (5-6): Some elements missing or weak connections
   Poor (0-4): Lacks structure or coherent argument
   ```
5. Verify text displays correctly in textarea

**Expected Results:**
- ✅ Textarea accepts input
- ✅ Multi-line text displays correctly
- ✅ No character limit errors (reasonable text length)
- ✅ Placeholder text visible when empty
- ✅ Helper text shown: "Provide specific guidance..."

**Status:** ⏳ Not Tested

---

### Test 4: Edit Max Score

**Steps:**
1. Find criterion with default weight (e.g., 100)
2. Click in "Maximum Score" input
3. Change value to 150
4. Tab to next field
5. Verify value persists

**Expected Results:**
- ✅ Input accepts numeric values
- ✅ Can use decimal values (e.g., 100.5)
- ✅ Default value shows current weight
- ✅ Helper text: "Override the default weight if needed..."
- ✅ Min value: 0
- ✅ Step: 0.01

**Status:** ⏳ Not Tested

---

### Test 5: Save Changes - Success

**Steps:**
1. Edit criteria text for 2-3 criteria
2. Edit max_score for 1-2 criteria
3. Click "Save Changes" button
4. Wait for save to complete

**Expected Results:**
- ✅ "Save Changes" button changes to "Saving..." with spinner
- ✅ Both buttons disabled during save
- ✅ Success message appears: "Criteria updated successfully!" (green)
- ✅ Success message auto-dismisses after 3 seconds
- ✅ No errors displayed
- ✅ Page remains on edit screen (doesn't navigate away)
- ✅ Form fields retain edited values

**Status:** ⏳ Not Tested

---

### Test 6: Verify Backend Saved Data

**Steps:**
1. After successful save (Test 5)
2. Navigate back to session page
3. Click "Edit Criteria" again
4. Verify data persisted

**Expected Results:**
- ✅ Previously edited criteria_text displays correctly
- ✅ Previously edited max_score displays correctly
- ✅ All changes persisted to database

**Status:** ⏳ Not Tested

---

### Test 7: Database Verification

**Steps:**
1. After saving changes, query database:
   ```sql
   SELECT
     criteria_id,
     name,
     LEFT(criteria_text, 50) as criteria_text_preview,
     max_score,
     weight
   FROM evaluation_criteria
   WHERE overlay_id = 'YOUR_OVERLAY_ID'
   ORDER BY display_order;
   ```

**Expected Results:**
- ✅ `criteria_text` column contains saved rubric text
- ✅ `max_score` column contains saved values
- ✅ NULL values remain NULL if not edited
- ✅ Data matches what was entered in form

**Status:** ⏳ Not Tested

---

### Test 8: Cancel Without Saving

**Steps:**
1. Navigate to edit criteria page
2. Edit some criteria text
3. Edit some max scores
4. Click "Cancel" button

**Expected Results:**
- ✅ Navigates back to previous page (session detail)
- ✅ No changes saved to database
- ✅ No error messages
- ✅ No confirmation dialog (changes discarded immediately)

**Status:** ⏳ Not Tested

---

### Test 9: Back Button Navigation

**Steps:**
1. Navigate to edit criteria page
2. Edit some values (don't save)
3. Click "Back" button (top left)

**Expected Results:**
- ✅ Navigates back to previous page
- ✅ No changes saved
- ✅ No errors

**Status:** ⏳ Not Tested

---

### Test 10: Error Handling - Network Failure

**Steps:**
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Navigate to edit criteria page
4. Try to load page

**Expected Results:**
- ✅ Loading spinner shows
- ✅ Error message displays: "Failed to load overlay"
- ✅ Error card shows with red styling
- ✅ "Go Back" button available
- ✅ Clicking "Go Back" navigates to previous page

**Status:** ⏳ Not Tested

---

### Test 11: Error Handling - Save Failure

**Steps:**
1. Navigate to edit criteria page
2. Edit some values
3. Open DevTools → Network tab
4. Enable "Offline" mode
5. Click "Save Changes"

**Expected Results:**
- ✅ "Saving..." state shows
- ✅ After timeout, error message displays (red alert)
- ✅ Error: "Failed to save criteria"
- ✅ Form remains editable
- ✅ Can retry after going back online

**Status:** ⏳ Not Tested

---

### Test 12: Empty Criteria List

**Steps:**
1. Create overlay with no criteria (or query overlay with 0 criteria)
2. Navigate to edit criteria page for that overlay

**Expected Results:**
- ✅ Page loads successfully
- ✅ Message displays: "No criteria found for this overlay."
- ✅ No save button shown
- ✅ Back button still available

**Status:** ⏳ Not Tested

---

### Test 13: Large Text Input

**Steps:**
1. Navigate to edit criteria page
2. Paste very long text (2000+ characters) into criteria_text
3. Save changes

**Expected Results:**
- ✅ Textarea accepts large text
- ✅ Textarea scrolls to show all text
- ✅ Save succeeds
- ✅ Full text stored in database (TEXT column supports it)

**Status:** ⏳ Not Tested

---

### Test 14: Special Characters and Unicode

**Steps:**
1. Enter text with special characters:
   ```
   Test with: "quotes", 'apostrophes', £€¥ symbols, é à ü accents,
   bullet points •, em-dash —, and emojis 🎯📝✅
   ```
2. Save changes
3. Reload page

**Expected Results:**
- ✅ All characters display correctly in textarea
- ✅ Save succeeds
- ✅ Characters persist correctly after reload
- ✅ No encoding errors

**Status:** ⏳ Not Tested

---

### Test 15: Edit All Criteria (Bulk Update)

**Steps:**
1. Navigate to edit criteria page with 10+ criteria
2. Edit criteria_text for ALL criteria
3. Edit max_score for ALL criteria
4. Save changes

**Expected Results:**
- ✅ Page handles many form fields without lag
- ✅ Save completes successfully
- ✅ All changes persisted
- ✅ Success message appears
- ✅ No timeout errors

**Status:** ⏳ Not Tested

---

### Test 16: UI Responsiveness (Mobile View)

**Steps:**
1. Resize browser to mobile width (375px)
2. Navigate to edit criteria page
3. Test all interactions

**Expected Results:**
- ✅ Page layout adapts to narrow screen
- ✅ Cards stack vertically
- ✅ Textareas remain usable
- ✅ Buttons accessible
- ✅ No horizontal scrolling required
- ✅ Save button remains visible at bottom

**Status:** ⏳ Not Tested

---

### Test 17: Verify AI Agents Use Criteria Text

**Steps:**
1. Edit criteria_text for a criterion with detailed rubric
2. Save changes
3. Submit a new document to a session using this overlay
4. Wait for AI analysis to complete
5. View feedback for that criterion

**Expected Results:**
- ✅ AI feedback reflects the rubric guidance provided
- ✅ More detailed and specific feedback than before
- ✅ Scoring aligns with rubric levels (Excellent/Good/Fair/Poor)
- ✅ Feedback mentions specific elements from rubric

**Status:** ⏳ Not Tested

---

### Test 18: Concurrent Edit Detection (Optional)

**Steps:**
1. Open edit criteria page in two browser tabs
2. Edit different criteria in each tab
3. Save in Tab 1
4. Save in Tab 2

**Expected Results:**
- ✅ Both saves complete without errors
- ✅ Last save wins (expected behavior)
- ⚠️ No concurrent edit warning (feature not implemented)

**Status:** ⏳ Not Tested

---

## API Endpoints Used

### GET `/overlays/{id}`
**Purpose:** Fetch overlay with criteria

**Request:**
```
GET /overlays/4eadcbc9-102b-428a-a850-8f2c3bbb0142
Authorization: Bearer {token}
```

**Response:**
```json
{
  "overlay_id": "...",
  "name": "Innovate UK Smart Grant",
  "description": "...",
  "criteria": [
    {
      "criteria_id": "...",
      "name": "Question 1 - Project Need",
      "description": "...",
      "criteria_text": "Assess the clarity and evidence...",
      "max_score": 100,
      "weight": 100,
      "display_order": 1
    }
  ]
}
```

### PUT `/overlays/{id}`
**Purpose:** Update criteria

**Request:**
```json
PUT /overlays/4eadcbc9-102b-428a-a850-8f2c3bbb0142
Authorization: Bearer {token}
Content-Type: application/json

{
  "criteria": [
    {
      "criteria_id": "abc123",
      "criteria_text": "Updated rubric text here...",
      "max_score": 150
    },
    {
      "criteria_id": "def456",
      "criteria_text": null,
      "max_score": null
    }
  ]
}
```

**Response:**
```json
{
  "message": "Overlay updated successfully",
  "overlay_id": "..."
}
```

---

## Files Involved

### Frontend
1. `frontend/app/overlays/[id]/edit-criteria/page.tsx` - Main edit page
2. `frontend/lib/api-client.ts` - Already has `updateOverlay()` method
3. `frontend/app/session/[id]/page.tsx` - Added "Edit Criteria" button

### Backend (Already Deployed)
1. `lambda/functions/api/overlays/index.js` - PUT handler (lines 152-280)
2. Database columns: `criteria_text` (TEXT), `max_score` (DECIMAL)

---

## Known Limitations

1. **No Concurrent Edit Protection**
   - Multiple users can edit same criteria simultaneously
   - Last save wins (overwrites previous)
   - No conflict detection or warning

2. **No Change History**
   - No audit trail of who changed what
   - No "revert to previous" functionality
   - Consider adding created_by/updated_by columns

3. **No Field Validation**
   - criteria_text accepts any length (database is TEXT type)
   - max_score accepts any positive number
   - No validation for reasonable score ranges

4. **No Auto-Save**
   - Changes lost if browser closes before saving
   - No draft functionality
   - Must explicitly click "Save Changes"

5. **No Bulk Operations**
   - Can't copy rubric from one criterion to all
   - Can't set max_score for all criteria at once
   - Must edit each individually

---

## Future Enhancements

1. **Rich Text Editor**
   - Add formatting (bold, italic, lists)
   - Better multi-paragraph editing
   - Syntax highlighting for rubric structure

2. **Template Library**
   - Save commonly used rubric templates
   - Apply template to multiple criteria
   - Share templates across overlays

3. **Preview Mode**
   - Show how AI will interpret the rubric
   - Test rubric with sample text
   - Validate rubric clarity

4. **Validation Rules**
   - Warn if criteria_text too short (e.g., < 50 chars)
   - Warn if max_score unusual (e.g., > 1000)
   - Suggest improvements

5. **Batch Import/Export**
   - Export all criteria to CSV/JSON
   - Edit in spreadsheet
   - Import updated values

---

## Success Criteria

Feature is considered successful if:

✅ All 18 test cases pass
✅ Data persists correctly to database
✅ AI agents use updated rubric text in evaluations
✅ No console errors during normal usage
✅ Mobile view works correctly
✅ Performance acceptable with 20+ criteria

---

## Test Results Summary

**Total Tests:** 18
**Passed:** 0
**Failed:** 0
**Not Tested:** 18

**Tested By:** _______________
**Date:** _______________
**Environment:** Development (localhost:3000)

---

**END OF TEST GUIDE**
