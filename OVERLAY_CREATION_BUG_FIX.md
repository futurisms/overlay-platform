# Overlay Creation Bug Fix - Implementation Plan

**Date:** 2026-02-01
**Bug:** "invalid input syntax for type uuid: 'temp-176997552241'"
**Status:** Investigation Complete - Ready for Implementation
**Priority:** HIGH (blocks overlay creation feature)

---

## Executive Summary

**Problem**: Cannot create new evaluation criteria via Overlay Management page
**Root Cause**: Frontend sends temporary IDs to backend, triggering UPDATE logic instead of INSERT
**Impact**: Users cannot add criteria to overlays, blocking end-to-end testing
**Fix Complexity**: LOW - Single file change (5 lines)
**Estimated Time**: 10-15 minutes implementation + 10 minutes testing

---

## Root Cause Analysis

### The Error

```
Error: invalid input syntax for type uuid: "temp-176997552241"
```

### What's Happening

1. **Frontend generates temp ID** (line 116):
   ```typescript
   criteria_id: `temp-${Date.now()}`, // e.g., "temp-176997552241"
   ```

2. **Frontend sends temp ID to backend** (line 121):
   ```typescript
   await apiClient.updateOverlay(overlayId, {
     criteria: updatedCriteria, // Includes new criterion with temp ID
   });
   ```

3. **Backend sees temp ID and tries UPDATE** (line 196):
   ```javascript
   if (c.criteria_id) {  // temp-176997552241 exists, so condition is TRUE
     // Goes to UPDATE path instead of INSERT path
     const updateQuery = `UPDATE evaluation_criteria ... WHERE criteria_id = $1`;
   ```

4. **PostgreSQL rejects temp ID** (line 207):
   ```javascript
   await dbClient.query(updateQuery, [
     c.criteria_id,  // "temp-176997552241" cannot be cast to UUID type
     // ... other params
   ]);
   ```

### Why Temp IDs Exist

The frontend uses temp IDs for **React keys** during optimistic UI updates:

```typescript
{criteria.map((criterion) => (
  <Card key={criterion.criteria_id}>  // Line 432 - needs a key for React
```

After adding a criterion, the frontend reloads data from backend (line 137):
```typescript
await loadOverlayData();  // Gets real UUID from database
```

---

## Database Schema

```sql
CREATE TABLE evaluation_criteria (
    criteria_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Auto-generates UUIDs
    overlay_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    -- ... other fields
);
```

- `criteria_id` is **UUID type** (not VARCHAR)
- Database auto-generates UUIDs via `uuid_generate_v4()`
- Cannot accept strings like "temp-176997552241"

---

## Backend Logic (Already Correct)

The backend **already has correct logic** to handle both cases:

```javascript
// Line 196-248: Handle criteria updates
if (c.criteria_id) {
  // UPDATE existing criterion
  const updateQuery = `
    UPDATE evaluation_criteria
    SET criteria_text = COALESCE($2, criteria_text),
        max_score = COALESCE($3, max_score),
        updated_at = CURRENT_TIMESTAMP
    WHERE criteria_id = $1 AND overlay_id = $4
  `;
  await dbClient.query(updateQuery, [c.criteria_id, ...]);
} else {
  // INSERT new criterion (when criteria_id is undefined/null)
  const insertQuery = `
    INSERT INTO evaluation_criteria
    (overlay_id, name, description, ...)
    VALUES ($1, $2, $3, ...)
    RETURNING criteria_id  -- Returns newly generated UUID
  `;
  const result = await dbClient.query(insertQuery, [...]);
  console.log(`Inserted new criterion: ${result.rows[0].criteria_id}`);
}
```

**Backend expects:**
- If `criteria_id` provided → UPDATE existing record
- If `criteria_id` absent → INSERT new record and generate UUID

**Frontend is breaking this by:**
- Sending temp IDs for new criteria
- Triggering UPDATE path when INSERT path is needed

---

## The Fix

### File to Change

**File:** `frontend/app/overlays/[id]/page.tsx`
**Function:** `handleAddCriterion`
**Lines:** 112-119

### Current Code (BROKEN)

```typescript
const updatedCriteria = [
  ...criteria,
  {
    ...newCriterion,
    criteria_id: `temp-${Date.now()}`, // ❌ PROBLEM: Backend tries to UPDATE
    is_active: true,
  },
];

const result = await apiClient.updateOverlay(overlayId, {
  criteria: updatedCriteria,
});
```

### Fixed Code (SOLUTION)

```typescript
const updatedCriteria = [
  ...criteria,  // Existing criteria with real UUIDs
  {
    ...newCriterion,
    // ✅ FIX: Don't include criteria_id for new criteria
    // Backend will INSERT and generate UUID via uuid_generate_v4()
    is_active: true,
  },
];

const result = await apiClient.updateOverlay(overlayId, {
  criteria: updatedCriteria,
});
```

### Why This Works

1. **Existing criteria**: Have real UUID `criteria_id` → Backend UPDATEs them (correct)
2. **New criterion**: Has NO `criteria_id` → Backend INSERTs it (correct)
3. **Backend INSERT**: Generates real UUID and returns it via `RETURNING criteria_id`
4. **Frontend reload**: Calls `loadOverlayData()` to fetch real UUID
5. **React rendering**: Uses real UUID as key going forward

---

## Alternative Solution (More Explicit)

If we want to be more explicit about filtering temp IDs:

```typescript
const updatedCriteria = [
  ...criteria,
  {
    ...newCriterion,
    criteria_id: `temp-${Date.now()}`,  // Keep temp ID for local state
    is_active: true,
  },
];

// Filter out temp IDs before sending to backend
const criteriaForBackend = updatedCriteria.map(c => {
  // If criteria_id starts with "temp-", exclude it from the object
  if (c.criteria_id && c.criteria_id.startsWith('temp-')) {
    const { criteria_id, ...rest } = c;  // Destructure to exclude criteria_id
    return rest;
  }
  return c;
});

const result = await apiClient.updateOverlay(overlayId, {
  criteria: criteriaForBackend,
});
```

**Pros:**
- More explicit about intent
- Keeps temp ID for potential local state management

**Cons:**
- More code (8 extra lines)
- Unnecessary complexity since we reload data immediately anyway

**Recommendation:** Use the simple fix (just don't add temp ID)

---

## Implementation Steps

### Step 1: Update handleAddCriterion Function

**File:** `frontend/app/overlays/[id]/page.tsx`
**Lines:** 112-119

Change:
```typescript
const updatedCriteria = [
  ...criteria,
  {
    ...newCriterion,
    criteria_id: `temp-${Date.now()}`, // ❌ Remove this line
    is_active: true,
  },
];
```

To:
```typescript
const updatedCriteria = [
  ...criteria,
  {
    ...newCriterion,
    // criteria_id will be generated by backend
    is_active: true,
  },
];
```

### Step 2: Verify No Other Uses of Temp IDs

Search for any other places that might depend on temp IDs:
```bash
grep -n "temp-" frontend/app/overlays/[id]/page.tsx
```

**Expected:** Only line 116 should match (the one we're fixing)

### Step 3: Test the Fix

1. **Start dev servers** (both proxy and Next.js)
2. **Login** as admin
3. **Navigate** to Overlays page
4. **Click** on existing overlay or create new one
5. **Add new criterion**:
   - Name: "Test Criterion"
   - Description: "Test description"
   - Weight: 0.5
   - Max Score: 100
   - Category: "test"
6. **Click** "Add Criterion"
7. **Verify**:
   - No error message
   - Success message appears
   - Page reloads with new criterion
   - New criterion has real UUID (not temp ID)

### Step 4: Verify Backend Logs

Check CloudWatch Logs for `overlay-api-overlays`:
```
Expected log: "Inserted new criterion: Test Criterion (id: <real-uuid>, ...)"
```

### Step 5: Verify Database

Query database via migration Lambda:
```sql
SELECT criteria_id, name FROM evaluation_criteria
WHERE name = 'Test Criterion';
```

**Expected:** Real UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### Step 6: Commit Changes

```bash
git add frontend/app/overlays/[id]/page.tsx
git commit -m "$(cat <<'EOF'
fix: Remove temp IDs when adding new criteria to overlays

Frontend was sending temp-* IDs to backend, causing UUID validation errors.
Backend expected either real UUID (for UPDATE) or no ID (for INSERT).

Changed handleAddCriterion to exclude criteria_id for new criteria.
Backend now correctly INSERTs new criteria and generates real UUIDs.

Fixes: "invalid input syntax for type uuid: 'temp-176997552241'"

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Checklist

### Basic Functionality

- [ ] Can add new criterion to existing overlay
- [ ] Can add multiple criteria in sequence
- [ ] New criteria display correctly after reload
- [ ] New criteria have real UUIDs (not temp IDs)
- [ ] No console errors in browser DevTools
- [ ] No backend errors in CloudWatch Logs

### Edge Cases

- [ ] Can add criterion with empty description (optional field)
- [ ] Can add criterion with weight 0.0
- [ ] Can add criterion with weight 1.0
- [ ] Can add criterion to newly created overlay (empty criteria list)
- [ ] Can add criterion to overlay with existing criteria

### Regression Testing

- [ ] Can still edit existing criteria (with real UUIDs)
- [ ] Can still delete existing criteria
- [ ] Can still update overlay metadata
- [ ] Session page still displays criteria correctly
- [ ] Edit Criteria page still works

---

## Rollback Plan

If the fix causes issues:

1. **Revert commit:**
   ```bash
   git revert HEAD
   git push
   ```

2. **Alternative quick fix** (backend side):
   ```javascript
   // In lambda/functions/api/overlays/index.js line 196
   if (c.criteria_id && !c.criteria_id.startsWith('temp-')) {
     // UPDATE existing criterion
   } else {
     // INSERT new criterion
   }
   ```

3. **Deploy backend fix:**
   ```bash
   cdk deploy OverlayComputeStack
   ```

---

## Risk Assessment

**Overall Risk:** **LOW**

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Break existing criteria editing | MEDIUM | VERY LOW | Only affects new criteria (no criteria_id), existing criteria still have real UUIDs |
| React key warnings | LOW | VERY LOW | Frontend reloads immediately after add, gets real UUID from backend |
| Data loss | NONE | NONE | No data deletion, only changing ID format sent to backend |
| Backend compatibility | NONE | NONE | Backend already supports INSERT without criteria_id |

---

## Post-Implementation Verification

After deploying the fix, verify:

1. **Create 3 new criteria** on a test overlay
2. **Check database** for all 3 criteria with real UUIDs
3. **Edit one criterion** to verify UPDATE still works
4. **Delete one criterion** to verify DELETE still works
5. **Create new overlay from scratch** with criteria
6. **Check CloudWatch Logs** for successful INSERT messages

---

## Files Reference

### Frontend (NEEDS CHANGE)

- **File:** `frontend/app/overlays/[id]/page.tsx`
- **Line 116:** Remove temp ID assignment
- **Line 432:** Uses criteria_id as React key (still works after reload)

### Backend (NO CHANGE NEEDED)

- **File:** `lambda/functions/api/overlays/index.js`
- **Line 196-218:** UPDATE logic for existing criteria (has criteria_id)
- **Line 220-247:** INSERT logic for new criteria (no criteria_id)
- **Line 232:** `RETURNING criteria_id` returns newly generated UUID

### Database Schema (NO CHANGE NEEDED)

- **Table:** `evaluation_criteria`
- **Column:** `criteria_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- **Auto-generates UUIDs on INSERT**

---

## Summary

**What's Broken:**
- Frontend sends temp IDs to backend
- Backend tries to UPDATE with invalid UUID
- PostgreSQL rejects non-UUID value

**What We're Fixing:**
- Remove temp ID from new criteria
- Let backend generate real UUIDs
- Frontend gets real UUID on reload

**Why It Works:**
- Backend already has correct INSERT/UPDATE logic
- Database already auto-generates UUIDs
- Frontend already reloads data after add
- React keys work with real UUIDs after reload

**Effort:**
- Code change: 1 line removal
- Testing: 10 minutes
- Total: 15-20 minutes

---

**STATUS:** Ready for implementation tomorrow ✅

**Next Steps:**
1. Apply fix to line 116
2. Test locally
3. Commit changes
4. Verify end-to-end

**No deployment needed** - frontend-only change
