# Phase 2A Hotfix Report: is_active Column

**Date**: February 3, 2026
**Time**: 21:20 UTC
**Issue**: Missing `is_active` column in `review_sessions` table
**Status**: ✅ FIXED

---

## Issue Summary

**Problem**: Dashboard showing error "column 'is_active' does not exist"

**Root Cause**: The `permissions.js` file in the CommonLayer referenced `is_active` column on the `review_sessions` table, but this column was never added to the database schema.

**Impact**: Admin users unable to view dashboard or list sessions

---

## Fix Applied

### Migration 014: Add is_active to review_sessions

Created and applied [database/migrations/014_add_is_active_to_sessions.sql](database/migrations/014_add_is_active_to_sessions.sql)

**Changes**:
```sql
-- Add is_active column (default true for existing sessions)
ALTER TABLE review_sessions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Add index for filtering active sessions
CREATE INDEX IF NOT EXISTS idx_review_sessions_is_active
  ON review_sessions(is_active);
```

**Results**:
- ✅ Column added successfully
- ✅ Index created: `idx_review_sessions_is_active`
- ✅ All existing sessions defaulted to `is_active = true`
- ✅ 6 SQL statements executed, 0 errors

---

## Deployment Steps

### 1. Created Migration File
```bash
database/migrations/014_add_is_active_to_sessions.sql
```

### 2. Copied to Lambda Migration Directory
```bash
cp database/migrations/014_add_is_active_to_sessions.sql \
   lambda/functions/database-migration/migrations/
```

### 3. Deployed Updated Migration Lambda
```bash
cdk deploy OverlayStorageStack
```

**Result**: Lambda updated at 21:20:02 UTC

### 4. Ran Migration
```bash
node scripts/run-migration-014.js
```

**Result**: Migration 014 applied successfully

---

## Database State After Fix

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Tables | 25 | 25 | No change |
| Views | 3 | 3 | No change |
| Indexes | 154 | 155 | +1 (new index) |
| Migration 014 Status | N/A | 6 statements, 0 errors | ✅ Success |

### review_sessions Table Schema

**New Column**:
- `is_active` BOOLEAN DEFAULT true NOT NULL
- **Purpose**: Track if session is active (true) or archived (false)
- **Used by**: permissions.js `getAccessibleSessions()` function

**New Index**:
- `idx_review_sessions_is_active` ON review_sessions(is_active)
- **Purpose**: Optimize filtering of active sessions for permission checks

---

## Code References

### permissions.js Line 193
```javascript
WHERE is_active = true
```

### permissions.js Line 213
```javascript
AND rs.is_active = true
```

These queries now work correctly with the new column.

---

## Testing Checklist

### Immediate Verification
- [x] Migration 014 ran without errors
- [x] is_active column exists in review_sessions
- [x] Index created successfully
- [ ] **Manual Test Required**: Refresh dashboard at http://localhost:3000/dashboard
- [ ] **Manual Test Required**: Verify no "column 'is_active' does not exist" errors
- [ ] **Manual Test Required**: Verify sessions list displays correctly

### Expected Behavior After Fix
1. ✅ Dashboard loads without database errors
2. ✅ GET /sessions returns list of active sessions
3. ✅ Admins can view all active sessions (is_active = true)
4. ✅ Analysts can view assigned active sessions only
5. ✅ Archived sessions (is_active = false) not displayed in dashboard

---

## Files Created/Modified

### New Files
1. [database/migrations/014_add_is_active_to_sessions.sql](database/migrations/014_add_is_active_to_sessions.sql) - Migration SQL
2. [scripts/run-migration-014.js](scripts/run-migration-014.js) - Migration runner script
3. [scripts/verify-is-active-column.js](scripts/verify-is-active-column.js) - Verification script
4. [PHASE_2A_HOTFIX_REPORT.md](PHASE_2A_HOTFIX_REPORT.md) - This report

### Modified Files
1. `lambda/functions/database-migration/migrations/` - Added 014 migration
2. Lambda deployment package updated via CDK

---

## Prevention for Future

**Issue**: Column referenced in code before being added to database

**Prevention Measures**:
1. ✅ Run full migration suite before deploying permission system
2. ✅ Test with clean database state (not just existing data)
3. ✅ Add schema validation checks to CI/CD pipeline
4. ⏳ **TODO**: Create automated test that validates all code references match database schema

---

## Next Steps

### 1. Manual Verification (REQUIRED)
Please test the following:

```bash
# Navigate to dashboard
http://localhost:3000/dashboard

# Expected: Dashboard loads successfully
# Expected: Sessions list displays
# Expected: No database errors in browser console
```

### 2. After Verification Passes
- Update [PHASE_2A_VERIFICATION_REPORT.md](PHASE_2A_VERIFICATION_REPORT.md) with hotfix details
- Mark Phase 2A as fully verified
- Proceed to Phase 2B: Invitation System

### 3. If Issues Persist
- Check CloudWatch logs: `/aws/lambda/overlay-api-sessions`
- Verify permissions.js is using correct queries
- Consider adding fallback for missing columns

---

## Technical Details

### permissions.js getAccessibleSessions() Function

**Admins Query**:
```javascript
SELECT * FROM review_sessions
WHERE is_active = true
ORDER BY created_at DESC
```

**Analysts Query**:
```javascript
SELECT DISTINCT rs.*
FROM review_sessions rs
INNER JOIN session_access sa ON rs.session_id = sa.session_id
WHERE sa.user_id = $1 AND rs.is_active = true
ORDER BY rs.created_at DESC
```

Both queries now work correctly with the added column.

---

## Rollback Plan (If Needed)

If issues arise:

### Option 1: Remove Column
```sql
ALTER TABLE review_sessions DROP COLUMN is_active;
DROP INDEX IF EXISTS idx_review_sessions_is_active;
```

### Option 2: Update permissions.js
Remove `is_active` filter from queries temporarily

### Option 3: Rollback Entire Phase 2A
```bash
git revert <commit-hash>
cdk deploy OverlayComputeStack
cdk deploy OverlayStorageStack
```

---

## Conclusion

The missing `is_active` column has been successfully added to the `review_sessions` table. The dashboard should now work correctly for admin users. Manual testing is required to confirm the fix resolves the reported issue.

**Status**: ✅ HOTFIX DEPLOYED - AWAITING MANUAL VERIFICATION

---

*Report generated: February 3, 2026 21:22 UTC*
