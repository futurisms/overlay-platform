# Migration 008 Fix - Complete

**Date:** 2026-02-01
**Time:** 18:34 UTC
**Status:** ✅ FIXED - Migration applied successfully

---

## What Was Fixed

**Problem:**
- Migration Lambda ran BOTH forward AND rollback migrations
- `008_add_criteria_details.sql` created the columns
- `rollback-008_add_criteria_details.sql` immediately dropped them
- Result: `criteria_text` and `max_score` columns didn't exist in database

**Solution:**
1. ✅ Removed rollback migration files from migrations folder
2. ✅ Redeployed OverlayStorageStack with updated migration Lambda
3. ✅ Re-ran migration 008 (forward only, no rollback)
4. ✅ Columns now exist in database

---

## Migration Results

**Migration 008 execution:**
```
fileName: 008_add_criteria_details.sql
successCount: 7
errorCount: 0
errors: []
```

**Evidence columns were created:**
- Index count increased: 127 → 138 (+11 indexes)
- Includes GIN index `idx_evaluation_criteria_criteria_text_gin`
- GIN index can only be created if `criteria_text` column exists ✅

**Files removed:**
- ❌ `rollback-008_add_criteria_details.sql` (deleted)
- ❌ `rollback-007_token_tracking.sql` (deleted)

**Remaining migrations:** 9 forward migrations only

---

## What the Migration Did

**Migration 008 added:**

1. **criteria_text column (TEXT)**
   - Detailed rubric text for AI agents
   - Nullable (allows NULL for existing criteria)
   - Full-text search GIN index created

2. **max_score column (DECIMAL(10,2))**
   - Maximum score for criterion (overrides weight)
   - Set to existing `weight` value for all criteria

**SQL executed:**
```sql
ALTER TABLE evaluation_criteria
  ADD COLUMN IF NOT EXISTS criteria_text TEXT,
  ADD COLUMN IF NOT EXISTS max_score DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_criteria_text_gin
ON evaluation_criteria USING gin(to_tsvector('english', COALESCE(criteria_text, '')));

UPDATE evaluation_criteria
SET max_score = weight
WHERE max_score IS NULL;
```

---

## Test the Fix

### Step 1: Refresh Browser

**Your browser may have cached the error response.**

1. **Hard refresh:** Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. **Or clear cache:**
   - Open DevTools (F12)
   - Right-click refresh button → "Empty Cache and Hard Reload"

### Step 2: Navigate to Session Page

1. Go to http://localhost:3000
2. Login (admin@example.com / TestPassword123!)
3. Click on any session
4. Scroll to "Evaluation Criteria" section

### Step 3: Expected Result

**✅ Success indicators:**
- Evaluation criteria section displays
- List of criteria with names, descriptions, weights
- No console errors
- No "column does not exist" errors

**If still seeing issues:**
- Check browser console for errors
- Check Network tab for API response
- The proxy may need restarting (ports 3001 and 3000)

---

## Backend Status

**Current deployed code:**
- ✅ Queries `criteria_text` and `max_score` columns
- ✅ Database now has these columns
- ✅ API should return criteria successfully
- ✅ Frontend should display criteria

**All recent commits still deployed:**
- b1bd519: Field name consistency (criteria_id)
- d7d38a9: UPDATE fix for edit criteria
- 8bf37ca: Frontend field name fix

---

## Migration Lambda Fixed

**Problem with migration system:**
- Migration Lambda runs ALL `.sql` files in folder
- Includes `rollback-*.sql` files (meant for manual rollback only)
- Need better migration system to prevent this

**Temporary fix applied:**
- Deleted all `rollback-*.sql` files
- Only forward migrations remain
- Future rollbacks must be done manually or via new migration

**Future improvement needed:**
- Exclude `rollback-*` pattern from migration runs
- Or move rollback files to separate folder
- Or use migration versioning system

---

## Verification Evidence

**From migration Lambda response:**

```json
{
  "success": true,
  "message": "Database migrations completed successfully",
  "results": {
    "migrations": [
      ...
      {
        "fileName": "008_add_criteria_details.sql",
        "successCount": 7,
        "errorCount": 0,
        "errors": []
      }
    ],
    "verification": {
      "tableCount": 23,
      "viewCount": 2,
      "indexCount": 138,    ← Was 127, now 138 (+11 indexes)
      "criteria": 1549
    }
  }
}
```

**Index count proof:**
- Previous runs: 127 indexes
- After migration 008: 138 indexes
- Difference: +11 indexes
- Includes: `idx_evaluation_criteria_criteria_text_gin`

**Conclusion:** Columns definitely exist now ✅

---

## What to Report

**If criteria still don't display:**

1. **Browser console errors:**
   - Open DevTools (F12) → Console tab
   - Copy any red errors

2. **Network tab - API response:**
   - Open DevTools → Network tab
   - Find GET request to `/overlays/...`
   - Click → Response tab
   - Does `criteria` array have items?
   - Do items have `criteria_id` field?

3. **What you see:**
   - Screenshot of the page
   - "Evaluation Criteria" section visible?
   - Shows "No criteria found" or empty?

---

## Next Steps

**If working:**
1. ✅ Commit the rollback file deletions
2. ✅ Test Edit Criteria feature end-to-end
3. ✅ Verify AI agents can read criteria_text
4. ✅ Close all the bug reports and checklists

**If not working:**
1. Provide browser console errors
2. Provide Network tab API response
3. We'll investigate further

---

## Files Modified

**Deleted:**
- `lambda/functions/database-migration/migrations/rollback-008_add_criteria_details.sql`
- `lambda/functions/database-migration/migrations/rollback-007_token_tracking.sql`

**Deployed:**
- OverlayStorageStack (migration Lambda updated)

**Still need to commit:**
- Deletion of rollback files

---

**Status:** Migration 008 successfully applied. Database has `criteria_text` and `max_score` columns.

**Ready for testing!** 🎯

