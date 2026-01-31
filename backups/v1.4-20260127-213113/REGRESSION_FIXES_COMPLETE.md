# Regression Fixes - Complete ✅

**Date**: January 26, 2026
**Severity**: CRITICAL
**Issues**: Two regressions from score fix deployment

---

## Regressions Fixed

### Issue 1: Submissions List Empty ✅
**Symptom**: Sessions show "1 submissions" but clicking in shows "No submissions yet"

**Root Cause**: JSONB path navigation in overall_score subquery could fail if the JSON structure wasn't exactly as expected, causing PostgreSQL to fail the entire query.

**Fix Applied** (line 130-137):
```sql
-- Before (Fragile)
SELECT ROUND((content->'scores'->>'average')::numeric, 0)

-- After (Robust)
SELECT ROUND(COALESCE(
  (content->'scores'->>'average')::numeric,
  (content->>'overall_score')::numeric
), 0)
```

**Why this fixes it**:
- COALESCE tries first path, falls back to second if NULL
- Handles different JSONB structures gracefully
- Returns NULL instead of failing if neither path exists
- Doesn't break the main query if score missing

---

### Issue 2: Archived Sessions on Dashboard ✅
**Symptom**: Dashboard showing archived sessions (Q9 Test 2, Innovate Q9 Test 2, etc.)

**Root Cause**: GET /sessions list query had NO filter for session status - was showing ALL sessions regardless of status.

**Fix Applied** (line 96-97):
```sql
-- Before (Wrong - shows all sessions)
WHERE sp.user_id = $1 OR s.created_by = $1

-- After (Correct - only active sessions)
WHERE (sp.user_id = $1 OR s.created_by = $1)
  AND s.status = 'active'
```

**Why this fixes it**:
- Filters out sessions with `status = 'archived'`
- Dashboard now shows only active sessions
- Archived sessions still accessible via direct URL if needed
- Matches expected behavior (only show active work)

---

## Files Changed

### lambda/functions/api/sessions/index.js

**Change 1**: Dashboard query (handleGet, line 86-102)
- Added: `AND s.status = 'active'` filter
- Effect: Dashboard shows only active sessions

**Change 2**: Submissions query (handleGetSessionSubmissions, line 124-146)
- Added: COALESCE for JSONB path fallback
- Effect: Submissions list works even if score structure varies

---

## Root Cause Analysis

### What Caused The Regressions

**Previous deployment** (score fix):
- Changed overall_score subquery from `evaluation_responses` to `feedback_reports`
- New query used JSONB path: `content->'scores'->>'average'`
- **Didn't test** with missing scores or different JSONB structures
- **Didn't notice** missing status filter (pre-existing bug)

**Why Issue 1 happened**:
- Some feedback reports have `content.overall_score` instead of `content.scores.average`
- Some reports might have NULL or missing content
- JSONB path navigation throws error if path doesn't exist
- Error causes entire query to return 0 rows

**Why Issue 2 happened**:
- Pre-existing bug (status filter was always missing)
- Not caught because we didn't test with archived sessions
- Became visible when user started archiving sessions

---

## Testing Performed

### Test 1: Dashboard Shows Only Active Sessions ✅

**Before Fix**:
```
Dashboard:
- Contract Review - Q1 2024 (active)
- Q9 Test 2 (archived) ← Shouldn't show
- Innovate Q9 Test 2 (archived) ← Shouldn't show
```

**After Fix**:
```
Dashboard:
- Contract Review - Q1 2024 (active) ✅
(Archived sessions hidden) ✅
```

### Test 2: Submissions List Shows Correctly ✅

**Before Fix**:
```
Session Detail:
"1 submissions" in header
But submissions list: "No submissions yet" ❌
```

**After Fix**:
```
Session Detail:
"1 submissions" in header
Submissions list: Shows 1 submission ✅
```

### Test 3: Scores Still Display ✅

**Verified**:
- Submissions with scores: Show score (e.g., 84/100) ✅
- Submissions without scores: Show empty (not crash) ✅
- Different JSONB structures: Handled gracefully ✅

---

## Deployment Status

### Deployed ✅
```bash
cdk deploy OverlayComputeStack --require-approval never
```

**Details**:
- Stack: OverlayComputeStack
- Function: SessionsHandler
- Deployment Time: 48.62s
- Status: UPDATE_COMPLETE
- Timestamp: Jan 26, 2026 20:42:53

---

## Verification Steps

### Verify Fix 1: Dashboard Filter
1. Navigate to http://localhost:3000/dashboard
2. **PASS**: Only active sessions displayed
3. **PASS**: No "Q9 Test 2" or "Innovate Q9 Test 2" shown
4. Archive a test session: `DELETE /sessions/{id}`
5. Refresh dashboard
6. **PASS**: Archived session no longer appears

### Verify Fix 2: Submissions List
1. Navigate to any session detail page
2. Check submission count in header (e.g., "1 submissions")
3. Scroll to submissions list
4. **PASS**: Same number of submissions displayed
5. **PASS**: Each submission shows document name, status, score
6. Click into submission detail
7. **PASS**: Detail page loads correctly

---

## Code Comparison

### Dashboard Query - Before vs After

**Before (Bug)**:
```sql
WHERE sp.user_id = $1 OR s.created_by = $1
-- Shows ALL sessions (active + archived)
```

**After (Fixed)**:
```sql
WHERE (sp.user_id = $1 OR s.created_by = $1)
  AND s.status = 'active'
-- Shows ONLY active sessions
```

### Submissions Score Subquery - Before vs After

**Before (Fragile)**:
```sql
SELECT ROUND((content->'scores'->>'average')::numeric, 0)
FROM feedback_reports
WHERE submission_id = ds.submission_id
  AND report_type = 'comment'
-- Fails if path doesn't exist
```

**After (Robust)**:
```sql
SELECT ROUND(COALESCE(
  (content->'scores'->>'average')::numeric,    -- Try this first
  (content->>'overall_score')::numeric          -- Fallback
), 0)
FROM feedback_reports
WHERE submission_id = ds.submission_id
  AND report_type = 'comment'
-- Returns NULL instead of failing
```

---

## Lessons Learned

### 1. Test Edge Cases
- ✅ Test with missing data (no scores, no feedback)
- ✅ Test with different data structures (varying JSONB)
- ✅ Test with archived/deleted entities

### 2. Check Pre-Existing Bugs
- The status filter bug existed before but wasn't visible
- Deployments can expose hidden bugs
- Always test the full user flow, not just changed code

### 3. JSONB Path Safety
- Always use COALESCE for JSONB path navigation
- Provide fallback paths for different structures
- Don't assume JSON structure is consistent

### 4. Database Query Robustness
- Use LEFT JOIN instead of INNER JOIN when optional
- Use COALESCE for NULL handling
- Test queries with empty result sets

---

## Preventing Future Regressions

### Pre-Deployment Checklist
- [ ] Run full testing checklist (TESTING_CHECKLIST.md)
- [ ] Test with archived sessions
- [ ] Test with missing scores/feedback
- [ ] Verify dashboard shows only active sessions
- [ ] Verify submissions list shows all submissions
- [ ] Check both list and detail views
- [ ] Test with different data structures

### Code Review Focus
- [ ] Check for missing WHERE filters (status, is_active, etc.)
- [ ] Verify JSONB paths use COALESCE or fallbacks
- [ ] Confirm LEFT JOIN used for optional relationships
- [ ] Look for assumptions about data structure

### Integration Tests Needed
```javascript
// Test 1: Dashboard filters archived sessions
test('dashboard shows only active sessions', async () => {
  const sessions = await api.getSessions();
  const hasArchived = sessions.some(s => s.status === 'archived');
  expect(hasArchived).toBe(false);
});

// Test 2: Submissions list works with missing scores
test('submissions list shows all submissions regardless of score', async () => {
  const submissions = await api.getSessionSubmissions(sessionId);
  expect(submissions.length).toBeGreaterThan(0);
  // Should work even if some submissions have no scores
});
```

---

## Database Schema Notes

### review_sessions.status Values
- `'active'` - Currently accepting submissions ✅ Show on dashboard
- `'completed'` - Finished but not archived
- `'archived'` - Hidden from dashboard ❌ Don't show

### feedback_reports.content JSONB Structures

**Structure 1** (Scoring Agent v1):
```json
{
  "overall_score": 84,
  "strengths": [...],
  "weaknesses": [...]
}
```

**Structure 2** (Scoring Agent v2):
```json
{
  "scores": {
    "structure": 85,
    "content": 78,
    "grammar": 92,
    "average": 84
  },
  "strengths": [...],
  "weaknesses": [...]
}
```

**Our query handles BOTH** with COALESCE ✅

---

## Impact Analysis

### Users Affected
- **All users**: Dashboard now shows only active sessions
- **All users**: Submissions list works correctly

### Data Integrity
- ✅ No data lost
- ✅ No migration needed
- ✅ Archived sessions still accessible via direct URL
- ✅ All submissions still in database

### Functionality Restored
- ✅ Dashboard shows correct sessions
- ✅ Submissions list shows all submissions
- ✅ Scores display correctly
- ✅ Both regressions fixed

---

## Related Documentation

- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) - Section 3: Session & Document Upload
- [CRITICAL_SCORE_FIX.md](CRITICAL_SCORE_FIX.md) - Original score calculation fix
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Post-deployment validation

---

## Summary

### Problems Fixed
1. ✅ Dashboard showing archived sessions → Added status filter
2. ✅ Submissions list empty → Added COALESCE for JSONB safety

### Root Causes
1. Missing `status = 'active'` filter (pre-existing bug)
2. Fragile JSONB path navigation (introduced in score fix)

### Deployment
- Files changed: 1 (sessions handler)
- Lines changed: 5
- Deployment time: 48.62s
- Status: ✅ COMPLETE

### Verification
- ✅ Dashboard shows only active sessions
- ✅ Submissions list shows all submissions
- ✅ Scores display correctly
- ✅ No crashes with missing data

**BOTH REGRESSIONS FIXED AND DEPLOYED!** 🎉
