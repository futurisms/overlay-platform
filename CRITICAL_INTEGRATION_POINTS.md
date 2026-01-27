# Critical Integration Points

**Purpose**: Document integration points that have historically failed in production, with prevention strategies and verification steps.

**Last Updated**: January 26, 2026 (v1.2 release)

---

## Overview

This document captures the 9 critical bugs fixed in v1.2, analyzed as integration points. Each entry documents:
- **What**: The integration point and its purpose
- **Where**: Code location
- **Common Failure**: How it typically breaks
- **Symptoms**: What users see when it fails
- **Test**: How to verify it works
- **Fix**: How we resolved it
- **Prevention**: How to avoid it in future

---

## Integration Point 1: Overlay Criteria Persistence

### What
Backend must process the `criteria` array when updating an overlay via PUT /overlays/{id}

### Where
- **File**: `lambda/functions/api/overlays/index.js`
- **Function**: `handleUpdate` (lines 141-212)
- **Route**: `PUT /overlays/{id}`

### Common Failure
Backend ignores the `criteria` field in request body, processes only overlay metadata (name, description, status)

### Symptoms
- Frontend shows "Criterion added successfully!" toast
- UI displays the criterion in the list
- Page refresh removes the criterion (not persisted)
- Database `evaluation_criteria` table empty for that overlay

### Root Cause
Original `handleUpdate` function only processed `name`, `description`, `status` fields. The `criteria` field was never extracted from request body or processed.

### Fix Applied (v1.2)
```javascript
async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;
  const { name, description, status, criteria } = JSON.parse(requestBody);

  // Update overlay metadata
  const overlayQuery = `...`;
  await dbClient.query(overlayQuery, [overlayId, name, description, status]);

  // ✅ NEW: Handle criteria updates if provided
  if (criteria !== undefined) {
    console.log(`Updating criteria for overlay ${overlayId}`);

    // Delete existing criteria
    await dbClient.query('DELETE FROM evaluation_criteria WHERE overlay_id = $1', [overlayId]);

    // Insert new criteria
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      await dbClient.query(insertQuery, [overlayId, c.name, c.description, ...]);
    }
  }
}
```

### Test Procedure
```bash
# 1. Create or edit overlay via UI
# 2. Add criterion (name, weight, description)
# 3. Click "Add Criterion"
# 4. Refresh page (F5)
# 5. PASS: Criterion still visible
# 6. Check database:
SELECT * FROM evaluation_criteria WHERE overlay_id = '<overlay_id>';
# Expected: Row exists with criterion data
```

### Prevention Checklist
- [ ] When adding new fields to PUT endpoints, verify backend processes them
- [ ] After "success" message, refresh page to verify persistence
- [ ] Always check database directly after save operations
- [ ] Add integration test: POST → GET → verify response includes saved data
- [ ] Log all fields received in request body for debugging

### History
- **First Occurred**: January 26, 2026 (v1.1 → v1.2)
- **Severity**: HIGH (admins blocked from creating evaluation templates)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: MEDIUM (similar pattern could affect other CRUD endpoints)

---

## Integration Point 2: React Component Keys

### What
React list components must have unique, stable keys for each item

### Where
- **File**: `frontend/app/overlays/[id]/page.tsx`
- **Component**: Criteria list rendering (line 432)
- **Pattern**: `.map()` over criteria array

### Common Failure
Key prop only checks one field name (`criterion.criterion_id`), but backend returns different field name (`criteria_id`)

### Symptoms
- Browser console warning: "Each child in a list should have a unique key prop"
- React may re-render entire list on updates instead of just changed items
- Possible UI glitches with item reordering

### Root Cause
Database column is `criteria_id` (plural), but frontend expects `criterion_id` (singular). Backend response mapping uses database field names without normalization.

### Fix Applied (v1.2)
```typescript
// Before ❌
<Card key={criterion.criterion_id}>

// After ✅
<Card key={criterion.criterion_id || criterion.criteria_id}>
```

### Test Procedure
```bash
# 1. Open browser console (F12)
# 2. Navigate to Edit Overlay page
# 3. PASS: No React key warnings
# 4. Add new criterion
# 5. PASS: No warnings after list updates
```

### Prevention Checklist
- [ ] Check console for React warnings after every frontend change
- [ ] Use consistent field naming between backend and frontend
- [ ] Always provide fallback keys when field names vary
- [ ] Add ESLint rule: `react/jsx-key` to catch missing keys
- [ ] Document field name mappings in API documentation

### History
- **First Occurred**: January 26, 2026
- **Severity**: MEDIUM (affects developer experience and performance)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: LOW (one-line fix, pattern now known)

---

## Integration Point 3: Status Field Consistency

### What
Backend must return `is_active` field for criteria even when database has no such column

### Where
- **File**: `lambda/functions/api/overlays/index.js`
- **Function**: `handleGet` (lines 69-79)
- **Route**: `GET /overlays/{id}`

### Common Failure
Response omits `is_active` field, causing frontend to display "Inactive" badge (falsy value)

### Symptoms
- All criteria show "Inactive" status badge
- Should show "Active" badge
- Confusing for users (criteria ARE active)

### Root Cause
Database `evaluation_criteria` table has no `is_active` column (all criteria implicitly active). Frontend expects explicit boolean field in response.

### Fix Applied (v1.2)
```javascript
// Before ❌
overlay.criteria = criteriaResult.rows.map(c => ({
  criterion_id: c.criteria_id,
  name: c.name,
  // is_active missing
}));

// After ✅
overlay.criteria = criteriaResult.rows.map(c => ({
  criterion_id: c.criteria_id,
  name: c.name,
  is_active: true,  // All criteria are active by default
}));
```

### Test Procedure
```bash
# 1. Navigate to Edit Overlay page
# 2. View criteria list
# 3. PASS: All criteria show "Active" badge (green)
# 4. FAIL: "Inactive" badges → Check backend response includes is_active: true
```

### Prevention Checklist
- [ ] When frontend expects boolean flags, always return explicit values (not undefined)
- [ ] Document which fields are required vs optional in API responses
- [ ] Add response schema validation in integration tests
- [ ] Use TypeScript interfaces to catch missing fields at compile time
- [ ] Set sensible defaults for boolean flags

### History
- **First Occurred**: January 26, 2026
- **Severity**: MEDIUM (confusing UI, but no functionality lost)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: LOW (pattern now documented)

---

## Integration Point 4: API Response Field Names

### What
Backend response field names must exactly match what frontend expects

### Where
- **File**: `lambda/functions/api/sessions/index.js`
- **Function**: `handleGetSessionSubmissions` (line 130)
- **Route**: `GET /sessions/{id}/submissions`

### Common Failure
Backend returns `avg_score`, frontend expects `overall_score`

### Symptoms
- Submissions list shows "Score: /100" (empty score value)
- Should show "Score: 84/100"
- Score data exists in database but not displayed

### Root Cause
SQL query aliased calculated score as `avg_score`:
```sql
(SELECT AVG(score) ...) as avg_score  -- ❌ Wrong alias
```

Frontend template uses:
```typescript
Score: {submission.overall_score}/100  // Expects overall_score
```

### Fix Applied (v1.2)
```sql
-- Before ❌
(SELECT AVG(score) FROM evaluation_responses ...) as avg_score

-- After ✅
(SELECT AVG(score) FROM evaluation_responses ...) as overall_score
```

### Test Procedure
```bash
# 1. Navigate to session detail page
# 2. Scroll to submissions list
# 3. PASS: Each submission shows "Score: 84/100" (actual score)
# 4. FAIL: Shows "/100" without number → Check field name in SQL query matches frontend
```

### Prevention Checklist
- [ ] Use shared TypeScript interfaces between frontend and backend
- [ ] Document API response schemas in OpenAPI/Swagger
- [ ] Add integration tests that verify exact field names
- [ ] Use API client generator (e.g., openapi-generator) to keep types synced
- [ ] Code review: Check SQL aliases match frontend expectations

### History
- **First Occurred**: January 26, 2026
- **Severity**: HIGH (users couldn't see submission scores)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: MEDIUM (similar pattern in other endpoints)

---

## Integration Point 5: Score Calculation Source of Truth

### What
All score displays must use the Scoring Agent's final calculated score, not recalculate from raw criteria

### Where
- **File**: `lambda/functions/api/sessions/index.js`
- **Functions**: `handleGetSessionSubmissions` (lines 131-140), `handleGet` (lines 87-96)
- **Routes**: `GET /sessions/{id}/submissions`, `GET /sessions/{id}`

### Common Failure
List view averages individual criteria scores, bypassing Scoring Agent's weighted calculation

### Symptoms
- **List view**: Shows 72/100
- **Detail view**: Shows 84/100
- **Same submission, different scores!**
- Users confused, lose trust in AI scoring

### Root Cause
Two different calculation methods in production:

**List View (WRONG)**:
```sql
-- Simple average of individual criteria
SELECT AVG(score) FROM evaluation_responses WHERE submission_id = ...
-- Result: (75 + 80 + 60) / 3 = 72
```

**Detail View (CORRECT)**:
```javascript
// Uses Scoring Agent's final weighted calculation
const feedbackContent = JSON.parse(scoringResult.rows[0].content);
const overall_score = feedbackContent.scores?.average;
// Result: 84 (weighted with criterion importance)
```

### Fix Applied (v1.2)
```sql
-- Before ❌
SELECT AVG(score) FROM evaluation_responses

-- After ✅
SELECT ROUND(COALESCE(
  (content::jsonb->'scores'->>'average')::numeric,
  (content::jsonb->>'overall_score')::numeric
), 0)
FROM feedback_reports
WHERE report_type = 'comment'
```

### Test Procedure
```bash
# 1. Navigate to submissions list (any session)
# 2. Note score for a submission (e.g., "Empowering Patients": 84/100)
# 3. Click into submission detail page
# 4. PASS: Same score displayed (84/100)
# 5. Return to list
# 6. PASS: Still shows 84/100
# 7. FAIL: Different scores → Check both queries use feedback_reports table
```

### Prevention Checklist
- [ ] **CRITICAL**: Never recalculate scores that agents have computed
- [ ] Document single source of truth for each calculated value
- [ ] All score queries must use `feedback_reports` table with `report_type = 'comment'`
- [ ] Add integration test: Compare list score to detail score for same submission
- [ ] Code review: Reject any AVG(score) from evaluation_responses in display logic

### History
- **First Occurred**: January 26, 2026
- **Severity**: CRITICAL (wrong data displayed, undermines trust in AI)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: HIGH (easy to write wrong query, pattern not obvious)

### Related Documentation
- [CRITICAL_SCORE_FIX.md](CRITICAL_SCORE_FIX.md) - Detailed analysis
- Scoring Agent design: `lambda/functions/scoring/index.js:210-228`

---

## Integration Point 6: JSONB Path Safety

### What
Queries using JSONB path navigation must handle different JSON structures with COALESCE fallbacks

### Where
- **File**: `lambda/functions/api/sessions/index.js`
- **Function**: `handleGetSessionSubmissions` (lines 131-140)
- **Pattern**: All queries accessing `feedback_reports.content` field

### Common Failure
Single JSONB path fails if structure doesn't match, causing entire query to return 0 rows

### Symptoms
- Session header shows "Submissions (1)"
- Submissions list shows "No submissions yet"
- Data exists in database but not visible

### Root Cause
Different JSONB structures exist in production:

**Structure 1 (Scoring Agent v1)**:
```json
{
  "overall_score": 84,
  "strengths": [...],
  "weaknesses": [...]
}
```

**Structure 2 (Scoring Agent v2)**:
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

Query with single path:
```sql
-- ❌ Fails if scores.average doesn't exist
(content::jsonb->'scores'->>'average')::numeric
```

### Fix Applied (v1.2)
```sql
-- Before ❌
SELECT (content->'scores'->>'average')::numeric as overall_score

-- After ✅
SELECT ROUND(COALESCE(
  (content::jsonb->'scores'->>'average')::numeric,  -- Try structured format
  (content::jsonb->>'overall_score')::numeric       -- Fallback to flat format
), 0) as overall_score
```

### Test Procedure
```bash
# 1. Create submission and run AI analysis
# 2. Navigate to session detail page
# 3. Check header: "Submissions (N)"
# 4. PASS: List shows N items (matches header count)
# 5. FAIL: List empty despite count > 0 → Check COALESCE in score query

# Database verification:
SELECT
  submission_id,
  content::jsonb->'scores' IS NOT NULL as has_structured,
  content::jsonb->>'overall_score' IS NOT NULL as has_flat
FROM feedback_reports
WHERE report_type = 'comment';
# Verify both formats exist, COALESCE handles both
```

### Prevention Checklist
- [ ] **ALWAYS** use COALESCE for JSONB path navigation
- [ ] Provide fallback paths for different JSON structures
- [ ] Test queries with multiple data formats
- [ ] Document expected JSONB structures in code comments
- [ ] Use JSON schema validation for agent outputs

### Code Pattern
```sql
-- ✅ Safe JSONB query pattern
SELECT ROUND(COALESCE(
  (content::jsonb->'path1'->'path2'->>'field')::numeric,  -- Primary path
  (content::jsonb->'altpath'->>'field')::numeric,         -- Fallback 1
  (content::jsonb->>'field')::numeric,                    -- Fallback 2
  0                                                        -- Default value
), 0)
```

### History
- **First Occurred**: January 26, 2026
- **Severity**: HIGH (data invisible despite existing)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: MEDIUM (any new JSONB queries could have same issue)

---

## Integration Point 7: Status Filtering in List Queries

### What
All list queries must filter by status/is_active to hide archived/deleted entities

### Where
- **File**: `lambda/functions/api/sessions/index.js`
- **Function**: `handleGet` (line 121)
- **Route**: `GET /sessions`

### Common Failure
Missing `WHERE status = 'active'` filter, showing ALL entities regardless of status

### Symptoms
- Dashboard cluttered with archived sessions (Q9 Test 2, etc.)
- Should only show active sessions
- Deleted/archived items still visible

### Root Cause
Original query had NO status filter:
```sql
-- ❌ Shows ALL sessions
WHERE sp.user_id = $1 OR s.created_by = $1
```

### Fix Applied (v1.2)
```sql
-- Before ❌
WHERE sp.user_id = $1 OR s.created_by = $1

-- After ✅
WHERE (sp.user_id = $1 OR s.created_by = $1)
  AND s.status = 'active'  -- Only show active sessions
```

### Test Procedure
```bash
# 1. Navigate to dashboard
# 2. Review all displayed sessions
# 3. PASS: All sessions show "Active" status badge
# 4. Archive a session: DELETE /sessions/{id}
# 5. Refresh dashboard
# 6. PASS: Archived session no longer appears
# 7. Direct link to archived session still works (not deleted, just hidden)
```

### Prevention Checklist
- [ ] **ALL** list queries must filter by status/is_active/is_deleted
- [ ] Code review: Check WHERE clause includes status filter
- [ ] Test with archived/deleted entities to verify they're hidden
- [ ] Document status field meanings (active, archived, deleted)
- [ ] Add index on status column for performance

### Status Field Patterns
```sql
-- ✅ Sessions
WHERE status = 'active'

-- ✅ Overlays
WHERE is_active = true

-- ✅ Users
WHERE is_deleted = false

-- ✅ Submissions (show all, status is workflow state)
-- No filter needed - status indicates workflow position
```

### History
- **First Occurred**: January 26, 2026 (pre-existing bug, exposed by user activity)
- **Severity**: MEDIUM (UI clutter, but no functionality lost)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: HIGH (easy to forget, every list query needs it)

---

## Integration Point 8: Complete Response Payloads

### What
Endpoints must return ALL data that frontend displays on that page, avoiding N+1 queries

### Where
- **File**: `lambda/functions/api/sessions/index.js`
- **Function**: `handleGet` (lines 82-107)
- **Route**: `GET /sessions/{id}`

### Common Failure
Endpoint returns partial data (session + participants) but omits related entities (submissions)

### Symptoms
- Session detail page header shows "Submissions (0)"
- User knows submissions exist (saw them on submissions page)
- Inconsistent counts across pages

### Root Cause
Endpoint design evolved with separate routes:
- `GET /sessions/{id}` → Session + participants
- `GET /sessions/{id}/submissions` → Submissions list

Frontend expected submissions in main response but backend never included them.

### Fix Applied (v1.2)
```javascript
// Before ❌
const session = sessionResult.rows[0];
session.participants = participantsResult.rows;
return { statusCode: 200, body: JSON.stringify(session) };

// After ✅
const session = sessionResult.rows[0];
session.participants = participantsResult.rows;
session.submissions = submissionsResult.rows;        // ✅ NEW
session.submission_count = submissionsResult.rows.length;  // ✅ NEW
return { statusCode: 200, body: JSON.stringify(session) };
```

### Test Procedure
```bash
# 1. Navigate to session detail page
# 2. Check header: "Submissions (N)"
# 3. PASS: N > 0 for sessions with submissions
# 4. Scroll to submissions section
# 5. PASS: List shows N items (matches header)
# 6. PASS: Each submission shows name, status, score

# API verification:
curl -X GET https://.../sessions/{id} -H "Authorization: Bearer $TOKEN"
# Expected response includes:
{
  "session_id": "...",
  "name": "Q91",
  "participants": [...],
  "submissions": [...],        // ✅ Must be present
  "submission_count": 1         // ✅ Must be present
}
```

### Prevention Checklist
- [ ] Identify all data displayed on page
- [ ] Return ALL data in single endpoint call
- [ ] Avoid forcing frontend to make N+1 queries
- [ ] Add aggregated counts (submission_count, participant_count)
- [ ] Document response schema with ALL fields

### Design Pattern
```javascript
// ✅ Complete response pattern
async function handleGetEntity(id) {
  // Get main entity
  const entity = await getEntity(id);

  // Get all related entities displayed on page
  entity.children = await getChildren(id);
  entity.metadata = await getMetadata(id);
  entity.counts = {
    children: entity.children.length,
    // ... other counts
  };

  return entity;
}
```

### History
- **First Occurred**: January 26, 2026
- **Severity**: HIGH (incomplete page data, poor UX)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: MEDIUM (other endpoints may have same issue)

---

## Integration Point 9: PostgreSQL Type Casting

### What
JSONB operators (`->`, `->>`) require explicit `::jsonb` cast when column is TEXT type

### Where
- **File**: `lambda/functions/api/sessions/index.js`
- **Lines**: 88-89, 157-158
- **Pattern**: All queries accessing `feedback_reports.content` field

### Common Failure
JSONB operator used on TEXT column without cast, causing **total outage**

### Symptoms
- **Error**: "operator does not exist: text -> unknown"
- GET /sessions/{id} returns 500 error
- Session detail page shows error screen
- **TOTAL OUTAGE** of session functionality

### Root Cause
Database schema defines `content` as TEXT (not JSONB):
```sql
CREATE TABLE feedback_reports (
    content TEXT,  -- ❌ TEXT type, not JSONB
    ...
);
```

Query uses JSONB operators without cast:
```sql
-- ❌ Fails: operator does not exist
SELECT content->'scores'->>'average'
FROM feedback_reports
```

PostgreSQL error: "text -> unknown" means:
- Left operand: TEXT type
- Operator: `->` (expects JSONB)
- Right operand: 'scores' (type unknown, can't infer)

### Fix Applied (v1.2)
```sql
-- Before ❌
(content->'scores'->>'average')::numeric

-- After ✅
(content::jsonb->'scores'->>'average')::numeric
       ^^^^^^^^ Cast TEXT to JSONB before using operator
```

### Test Procedure
```bash
# 1. Navigate to session detail page
# 2. PASS: Page loads without errors
# 3. Check browser Network tab
# 4. PASS: GET /sessions/{id} returns 200 status

# CloudWatch verification:
aws logs filter-log-events \
  --log-group-name /aws/lambda/overlay-api-sessions \
  --start-time $(($(date +%s) - 600))000 \
  --filter-pattern "operator"
# Expected: No results (no operator errors)

# Database test:
SELECT
  (content::jsonb->'scores'->>'average')::numeric as score
FROM feedback_reports
WHERE report_type = 'comment'
LIMIT 1;
# Expected: Returns score value (e.g., 84)
```

### Prevention Checklist
- [ ] **ALWAYS** check column type before using JSONB operators
- [ ] If TEXT column, add `::jsonb` cast: `column::jsonb->'field'`
- [ ] Test queries in psql before deploying
- [ ] Use `\d table_name` to verify column types
- [ ] Consider migrating TEXT columns to JSONB type

### PostgreSQL Type System
```sql
-- ✅ JSONB column (no cast needed)
CREATE TABLE example (data JSONB);
SELECT data->'field' FROM example;

-- ✅ TEXT column (cast required)
CREATE TABLE example (data TEXT);
SELECT data::jsonb->'field' FROM example;

-- ❌ TEXT column (no cast) - ERROR
CREATE TABLE example (data TEXT);
SELECT data->'field' FROM example;
-- Error: operator does not exist: text -> unknown
```

### Why Not Migrate Schema?
**Option A: Schema Migration**
```sql
ALTER TABLE feedback_reports
ALTER COLUMN content TYPE JSONB USING content::jsonb;
```
- ❌ Requires downtime
- ❌ Risk of data corruption
- ❌ Complex rollback

**Option B: Query-Level Casting** (CHOSEN)
```sql
SELECT content::jsonb->'field' FROM feedback_reports;
```
- ✅ Zero downtime
- ✅ Works with existing data
- ✅ Easy rollback
- ✅ Backward compatible

### History
- **First Occurred**: January 26, 2026 (introduced by previous fix)
- **Severity**: CRITICAL (total outage, 500 errors)
- **Fixed In**: v1.2 (commit 67f1ead)
- **Recurrence Risk**: LOW (now known pattern, well-documented)

---

## Quick Reference Table

| # | Integration Point | Failure Rate | Last Issue | Severity | Prevention |
|---|-------------------|--------------|------------|----------|------------|
| 1 | Criteria Persistence | 1 time | Jan 26, 2026 | HIGH | Verify DB after save |
| 2 | React Keys | 1 time | Jan 26, 2026 | MEDIUM | Check console warnings |
| 3 | Status Fields | 1 time | Jan 26, 2026 | MEDIUM | Return explicit booleans |
| 4 | Field Names | 1 time | Jan 26, 2026 | HIGH | TypeScript interfaces |
| 5 | Score Calculation | 1 time | Jan 26, 2026 | CRITICAL | Never recalculate scores |
| 6 | JSONB Paths | 1 time | Jan 26, 2026 | HIGH | Always use COALESCE |
| 7 | Status Filtering | Pre-existing | Jan 26, 2026 | MEDIUM | Filter all list queries |
| 8 | Complete Responses | 1 time | Jan 26, 2026 | HIGH | Return all page data |
| 9 | JSONB Casting | 1 time | Jan 26, 2026 | CRITICAL | Cast TEXT to JSONB |

---

## Pre-Deployment Checklist

Before deploying ANY change, verify these integration points:

### Backend Changes
- [ ] New PUT/POST endpoints process ALL fields from request body
- [ ] List queries filter by status/is_active/is_deleted
- [ ] Response payloads include ALL data displayed on page
- [ ] JSONB queries use `::jsonb` cast on TEXT columns
- [ ] JSONB paths use COALESCE for different structures
- [ ] Calculated values come from source of truth (don't recalculate)
- [ ] Field names match frontend expectations exactly
- [ ] Boolean flags have explicit values (not undefined)

### Frontend Changes
- [ ] React lists have unique, stable keys
- [ ] Console clean (no warnings after component renders)
- [ ] Field names match backend response structure
- [ ] Handle undefined/null values gracefully
- [ ] Loading states shown during API calls
- [ ] Error states shown on API failures

### Testing
- [ ] Integration test passes: `node scripts/end-to-end-test.js`
- [ ] Manual verification: Complete workflow end-to-end
- [ ] Browser console clean (no errors or warnings)
- [ ] Database verified: Data persisted correctly
- [ ] CloudWatch logs checked: No errors in last 5 minutes

---

## Post-Deployment Verification

After deployment, verify these integration points immediately:

### Quick Smoke Test (5 minutes)
```bash
# 1. Login
curl -X POST https://.../cognito/login
# PASS: Returns auth token

# 2. List sessions
curl -X GET https://.../sessions -H "Authorization: Bearer $TOKEN"
# PASS: Returns only active sessions

# 3. Get session detail
curl -X GET https://.../sessions/{id} -H "Authorization: Bearer $TOKEN"
# PASS: Response includes participants, submissions, submission_count

# 4. Create overlay and add criterion
curl -X POST https://.../overlays -d '{"name":"Test",...}'
curl -X PUT https://.../overlays/{id} -d '{"criteria":[...]}'
curl -X GET https://.../overlays/{id}
# PASS: Response includes criteria array with saved criterion

# 5. Check scores
curl -X GET https://.../sessions/{id}/submissions
# PASS: All submissions have overall_score field
```

### Full Verification (15 minutes)
1. Run [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) Section 1: "Critical Bug Verification"
2. Check all 8 "Must Pass" items
3. Verify CloudWatch logs clean for all Lambda functions
4. Test one complete workflow end-to-end

---

## Rollback Procedures

If any integration point fails after deployment:

### Immediate Actions
1. Check CloudWatch logs for error messages
2. Identify which integration point is failing (see table above)
3. Determine severity:
   - **CRITICAL** (outage) → Rollback immediately
   - **HIGH** (data loss/visibility) → Rollback within 15 minutes
   - **MEDIUM** (UI issues) → Fix forward or rollback within 1 hour

### Rollback Commands
```bash
# Option 1: Git revert (preferred)
git revert HEAD
cdk deploy OverlayComputeStack --require-approval never

# Option 2: Git reset (if multiple bad commits)
git reset --hard HEAD~1
cdk deploy OverlayComputeStack --require-approval never

# Option 3: Deploy previous tag
git checkout v1.2-stable
cdk deploy OverlayComputeStack --require-approval never
```

### After Rollback
1. Document failure in this file (add to history section)
2. Increment failure rate in quick reference table
3. Create hotfix branch for proper fix
4. Test fix thoroughly before redeploying
5. Update prevention checklist based on root cause

---

## Integration Points by Risk Level

### CRITICAL (Causes Outages)
- **#5**: Score Calculation Source of Truth
- **#9**: PostgreSQL Type Casting

**Prevention**:
- Never deploy score-related changes without testing both list and detail views
- Always verify JSONB queries in psql before deploying
- Add integration tests for score consistency
- Check CloudWatch logs immediately after deployment

### HIGH (Data Loss or Invisibility)
- **#1**: Criteria Persistence
- **#4**: API Response Field Names
- **#6**: JSONB Path Safety
- **#8**: Complete Response Payloads

**Prevention**:
- Verify database after all save operations
- Use TypeScript interfaces for API responses
- Always use COALESCE for JSONB paths
- Return complete data in single endpoint

### MEDIUM (UI Issues, No Data Loss)
- **#2**: React Keys
- **#3**: Status Fields
- **#7**: Status Filtering

**Prevention**:
- Check browser console after every frontend change
- Return explicit boolean values
- Filter all list queries by status

---

## Related Documentation

- [CRITICAL_FIXES_SESSION_SUMMARY.md](CRITICAL_FIXES_SESSION_SUMMARY.md) - Complete v1.2 session summary
- [CRITICAL_SCORE_FIX.md](CRITICAL_SCORE_FIX.md) - Score calculation analysis
- [SQL_OPERATOR_FIX_COMPLETE.md](SQL_OPERATOR_FIX_COMPLETE.md) - JSONB casting details
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) - Comprehensive testing guide
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Safe deployment procedures
- [RELEASE_v1.2.md](RELEASE_v1.2.md) - Release notes with all fixes

---

## Lessons Learned

### Pattern Recognition
All 9 bugs share common patterns:
1. **Backend-Frontend Mismatch**: Different field names/structures (4 bugs)
2. **Incomplete Implementations**: Missing fields in responses (3 bugs)
3. **Database Type Issues**: TEXT vs JSONB casting (2 bugs)

### Root Causes
- **Lack of integration testing**: Bugs only caught in production
- **No API schema validation**: Field mismatches not detected
- **Insufficient smoke testing**: Score mismatch existed but not noticed
- **Missing type safety**: No TypeScript on backend

### Improvements Made
1. ✅ Created comprehensive testing checklist
2. ✅ Documented all integration points
3. ✅ Added pre/post-deployment verification
4. ✅ Established rollback procedures
5. ✅ Created integration test script

### Future Improvements
- [ ] Add TypeScript to backend Lambda functions
- [ ] Generate API client from OpenAPI schema
- [ ] Add CI/CD integration tests
- [ ] Set up CloudWatch alarms for error patterns
- [ ] Create Postman collection for manual testing

---

**Last Updated**: January 26, 2026 (v1.2 release)
**Maintained By**: Development Team
**Review Schedule**: After every production incident or release
