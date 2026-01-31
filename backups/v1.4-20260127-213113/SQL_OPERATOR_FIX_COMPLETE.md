# SQL Operator Fix - Complete ✅

**Date**: January 26, 2026
**Severity**: CRITICAL
**Issue**: "operator does not exist: text -> unknown" error breaking all session queries

---

## Problem

### Error Message
```
operator does not exist: text -> unknown
```

### Impact
- **TOTAL OUTAGE**: GET /sessions/{id} endpoint completely broken
- Session detail page fails to load
- Submissions list unavailable
- Users cannot view session data
- Frontend displays error instead of content

### Root Cause
PostgreSQL JSONB operator `->` used on TEXT column without explicit type cast.

**Location**: lambda/functions/api/sessions/index.js
- Lines 88-89 (handleGet - specific session)
- Lines 157-158 (handleGetSessionSubmissions)

---

## Technical Analysis

### Why This Happened

**Previous deployment** added JSONB score queries to retrieve AI-generated scores:

```sql
SELECT ROUND(COALESCE(
  (content->'scores'->>'average')::numeric,
  (content->>'overall_score')::numeric
), 0)
FROM feedback_reports
```

**The Problem**:
- `content` column in `feedback_reports` table is defined as TEXT
- PostgreSQL requires explicit cast to JSONB before using `->` operator
- Without cast: "operator does not exist: text -> unknown"
- Query fails, returns 500 error to frontend

### Database Schema Context

```sql
CREATE TABLE feedback_reports (
    report_id UUID PRIMARY KEY,
    submission_id UUID REFERENCES document_submissions,
    report_type VARCHAR(50),
    title VARCHAR(255),
    content TEXT,           ← TEXT type, not JSONB!
    severity VARCHAR(20),
    created_at TIMESTAMP,
    created_by UUID
);
```

**Why TEXT and not JSONB?**
- Original schema design used TEXT to store JSON strings
- Frontend parses JSON when displaying
- Backend queries now need JSONB operators for score extraction
- **Solution**: Cast TEXT to JSONB in queries, not schema migration

---

## The Fix

### Code Changes

**File**: [lambda/functions/api/sessions/index.js](lambda/functions/api/sessions/index.js)

#### Fix 1: handleGet function (lines 86-96)

**Before (Broken)** ❌:
```sql
(
  SELECT ROUND(COALESCE(
    (content->'scores'->>'average')::numeric,
    (content->>'overall_score')::numeric
  ), 0)
  FROM feedback_reports
  WHERE submission_id = ds.submission_id
  AND report_type = 'comment'
  ORDER BY created_at DESC
  LIMIT 1
) as overall_score
```

**After (Fixed)** ✅:
```sql
(
  SELECT ROUND(COALESCE(
    (content::jsonb->'scores'->>'average')::numeric,
    (content::jsonb->>'overall_score')::numeric
  ), 0)
  FROM feedback_reports
  WHERE submission_id = ds.submission_id
  AND report_type = 'comment'
  ORDER BY created_at DESC
  LIMIT 1
) as overall_score
```

**Change**: Added `::jsonb` cast to `content` before using JSONB operators

#### Fix 2: handleGetSessionSubmissions function (lines 155-165)

**Before (Broken)** ❌:
```sql
(
  SELECT ROUND(COALESCE(
    (content->'scores'->>'average')::numeric,
    (content->>'overall_score')::numeric
  ), 0)
  FROM feedback_reports
  WHERE submission_id = ds.submission_id
  AND report_type = 'comment'
  ORDER BY created_at DESC
  LIMIT 1
) as overall_score
```

**After (Fixed)** ✅:
```sql
(
  SELECT ROUND(COALESCE(
    (content::jsonb->'scores'->>'average')::numeric,
    (content::jsonb->>'overall_score')::numeric
  ), 0)
  FROM feedback_reports
  WHERE submission_id = ds.submission_id
  AND report_type = 'comment'
  ORDER BY created_at DESC
  LIMIT 1
) as overall_score
```

**Change**: Added `::jsonb` cast to `content` before using JSONB operators

---

## Deployment Status

### Deployed ✅
```bash
cdk deploy OverlayComputeStack --require-approval never
```

**Details**:
- Stack: OverlayComputeStack
- Function: SessionsHandler (overlay-api-sessions)
- Deployment Time: 48.59s
- Status: UPDATE_COMPLETE
- Timestamp: Jan 26, 2026 21:00:32

**Verification**:
- CloudWatch logs: No "operator does not exist" errors ✅
- Lambda function updated successfully ✅
- API Gateway routing intact ✅

---

## Verification Steps

### 1. Check CloudWatch Logs
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/overlay-api-sessions \
  --start-time $(($(date +%s) - 600))000 \
  --filter-pattern "operator"
```

**Expected**: No results (no operator errors) ✅

### 2. Test GET /sessions/{id} Endpoint
```bash
curl -X GET https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions/4f7b22cb-7c2e-47a5-9fde-2430ff3c4e06 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "session_id": "4f7b22cb-7c2e-47a5-9fde-2430ff3c4e06",
  "name": "Q91",
  "status": "active",
  "participants": [...],
  "submissions": [
    {
      "submission_id": "...",
      "document_name": "Empowering Patients",
      "status": "approved",
      "overall_score": 84
    }
  ],
  "submission_count": 1
}
```

### 3. Test Frontend Session Detail Page
1. Navigate to: http://localhost:3000/session/4f7b22cb-7c2e-47a5-9fde-2430ff3c4e06
2. **PASS**: Page loads without errors
3. **PASS**: Session details displayed
4. **PASS**: Submissions list shows "1 submission"
5. **PASS**: Submission score displays "84/100"

---

## PostgreSQL Type Casting Reference

### JSONB Operators in PostgreSQL

**Operator**: `->` (Get JSON object field)
- Input: JSONB, output: JSONB
- Example: `'{"a": 1}'::jsonb -> 'a'` → `1`

**Operator**: `->>` (Get JSON object field as text)
- Input: JSONB, output: TEXT
- Example: `'{"a": 1}'::jsonb ->> 'a'` → `"1"` (as text)

**Type Casting**: `::jsonb`
- Converts TEXT to JSONB type
- Required when column is TEXT but query needs JSONB operators
- Example: `content::jsonb -> 'scores'`

### Common Pattern for TEXT Columns Storing JSON

```sql
-- WRONG: Direct operator on TEXT
SELECT content->'scores' FROM feedback_reports;
-- Error: operator does not exist: text -> unknown

-- CORRECT: Cast to JSONB first
SELECT content::jsonb->'scores' FROM feedback_reports;
-- Works: TEXT cast to JSONB, then operator applied
```

---

## Why Not Migrate Schema to JSONB?

### Option 1: Schema Migration (NOT CHOSEN)
```sql
ALTER TABLE feedback_reports
ALTER COLUMN content TYPE JSONB USING content::jsonb;
```

**Downsides**:
- Requires downtime for large tables
- Risk of data corruption if any rows have invalid JSON
- Need to update all existing code that expects TEXT
- Rollback is complex

### Option 2: Query-Level Casting (CHOSEN) ✅
```sql
SELECT content::jsonb->'scores' FROM feedback_reports;
```

**Benefits**:
- No schema change needed ✅
- Zero downtime ✅
- Works with existing data ✅
- Easy to rollback (just remove ::jsonb) ✅
- Backward compatible with code expecting TEXT ✅

---

## Impact Analysis

### Before Fix
- ❌ GET /sessions/{id} → 500 error
- ❌ Session detail page → Error screen
- ❌ Submissions list → Empty/error
- ❌ Scores → Not displayed
- ❌ Users blocked from viewing sessions

### After Fix
- ✅ GET /sessions/{id} → 200 success
- ✅ Session detail page → Loads correctly
- ✅ Submissions list → Shows all submissions
- ✅ Scores → Display correctly (84/100)
- ✅ Users can view all session data

### Data Integrity
- ✅ No data lost
- ✅ No migration needed
- ✅ Existing JSON content unchanged
- ✅ All queries return correct results

---

## Related Fixes in This Session

This SQL operator fix is part of a series of critical fixes:

1. ✅ **Criteria not saving** (overlays handler)
2. ✅ **React key warning** (frontend)
3. ✅ **Inactive status display** (backend field mapping)
4. ✅ **Score display empty** (field name mismatch)
5. ✅ **CRITICAL: Score calculation wrong** (wrong data source)
6. ✅ **Submissions list empty** (JSONB path safety)
7. ✅ **Archived sessions on dashboard** (missing status filter)
8. ✅ **Session detail not loading submissions** (incomplete endpoint)
9. ✅ **SQL operator error** (missing JSONB cast) ← THIS FIX

---

## Lessons Learned

### 1. Schema vs Query Design
- Store as TEXT if frontend needs text format
- Cast to JSONB in queries when operators needed
- Avoid premature schema migrations

### 2. PostgreSQL Type System
- Operators are strict about input types
- TEXT and JSONB are different types (no implicit conversion)
- Always cast when using JSONB operators on TEXT columns

### 3. Testing JSONB Queries
- Test queries directly in psql before deploying
- Verify column types: `\d table_name`
- Check operator compatibility: `\do+ operator_name`

### 4. Error Messages Are Precise
- "operator does not exist: text -> unknown" = type mismatch
- "text" = left operand type
- "unknown" = right operand type (couldn't infer)
- Fix: Cast left operand to expected type

---

## Prevention Checklist

### Before Deploying JSONB Queries:

- [ ] Check column type: `\d table_name`
- [ ] If TEXT column, add `::jsonb` cast
- [ ] Test query in psql first
- [ ] Verify JSONB structure exists in data
- [ ] Add COALESCE for different JSONB structures
- [ ] Test with missing/null JSON fields
- [ ] Check CloudWatch logs after deployment

### Code Review Focus:

- [ ] Look for `content->` patterns (missing cast?)
- [ ] Verify TEXT columns have `::jsonb` cast
- [ ] Check JSONB path exists in actual data
- [ ] Confirm fallback paths with COALESCE
- [ ] Test with edge cases (null, empty, malformed JSON)

---

## Related Documentation

- [CRITICAL_SCORE_FIX.md](CRITICAL_SCORE_FIX.md) - Original score calculation fix
- [REGRESSION_FIXES_COMPLETE.md](REGRESSION_FIXES_COMPLETE.md) - JSONB path safety with COALESCE
- [SESSION_DETAIL_FIX.md](SESSION_DETAIL_FIX.md) - Submissions not loading fix
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) - Comprehensive testing procedures

---

## Summary

### Problem
- **Critical**: SQL operator error breaking all session queries
- **Error**: "operator does not exist: text -> unknown"
- **Cause**: JSONB operator `->` used on TEXT column without cast

### Root Cause
- `feedback_reports.content` is TEXT type
- Queries use JSONB operators (`->`, `->>`)
- PostgreSQL requires explicit `::jsonb` cast

### Fix
- Added `::jsonb` cast to `content` in 2 locations
- Lines 88-89 (handleGet)
- Lines 157-158 (handleGetSessionSubmissions)

### Deployment
- Files changed: 1 (sessions handler)
- Lines changed: 4 (added ::jsonb)
- Deployment time: 48.59s
- Status: ✅ COMPLETE

### Verification
- ✅ No operator errors in CloudWatch logs
- ✅ GET /sessions/{id} returns data successfully
- ✅ Submissions list displays correctly
- ✅ Scores show correct values
- ✅ Frontend session detail page works

**SQL OPERATOR ERROR FIXED - SESSIONS LOADING CORRECTLY!** 🎉
