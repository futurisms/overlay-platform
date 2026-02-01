# Edit Criteria Backend Bug Analysis

**Date:** 2026-02-01
**Issue:** Foreign key constraint violation when updating criteria
**Error:** `foreign key constraint "evaluation_responses_criteria_id_fkey" on table "evaluation_responses"`

---

## Problem Summary

The Edit Criteria feature frontend successfully sends update requests, but the backend fails with a foreign key constraint violation. The bug occurs when trying to update criteria that have existing evaluation responses (i.e., criteria that have been used in AI evaluations).

---

## Root Cause Analysis

### 1. Frontend Behavior (CORRECT)

**Location:** `frontend/app/overlays/[id]/edit-criteria/page.tsx` lines 91-97

**What Frontend Sends:**
```javascript
PUT /overlays/{overlay_id}
{
  criteria: [
    {
      criteria_id: "abc-123-existing-id",  // ✅ Indicates UPDATE
      criteria_text: "Updated rubric text...",
      max_score: 150
    },
    {
      criteria_id: "def-456-existing-id",
      criteria_text: "Another rubric...",
      max_score: 100
    }
  ]
}
```

**Intent:** Update EXISTING criteria records with new values for `criteria_text` and `max_score` fields only.

---

### 2. Backend Behavior (INCORRECT)

**Location:** `lambda/functions/api/overlays/index.js` lines 188-225 (handleUpdate function)

**What Backend Does:**

**Step 1 (Line 192):** DELETE all existing criteria
```javascript
await dbClient.query('DELETE FROM evaluation_criteria WHERE overlay_id = $1', [overlayId]);
```

**Step 2 (Lines 195-222):** INSERT new criteria
```javascript
for (let i = 0; i < criteria.length; i++) {
  const c = criteria[i];

  const insertQuery = `
    INSERT INTO evaluation_criteria
    (overlay_id, name, description, criterion_type, weight, is_required, display_order, criteria_text, max_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  await dbClient.query(insertQuery, [...]);
}
```

**Problem:**
- Backend **ignores** the `criteria_id` field from frontend
- Assumes criteria update = "replace all criteria"
- Uses DELETE + INSERT pattern instead of UPDATE

---

### 3. Database Constraint

**Location:** `lambda/functions/database-migration/migrations/000_initial_schema.sql`

**Foreign Key Definition:**
```sql
CREATE TABLE evaluation_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
    criteria_id UUID NOT NULL REFERENCES evaluation_criteria(criteria_id),  -- ⚠️ NO CASCADE
    ...
);
```

**Key Point:**
- `criteria_id` has foreign key to `evaluation_criteria(criteria_id)`
- **NO `ON DELETE CASCADE` clause**
- If evaluation_responses exist that reference a criteria_id, you CANNOT delete that criterion

---

### 4. When the Error Occurs

**Scenario:**
1. Overlay exists with criteria (e.g., "Innovate UK Smart Grant" with 13 criteria)
2. Documents are submitted and AI analysis completes
3. AI creates `evaluation_responses` records with scores for each criterion
4. Each response has `criteria_id` pointing to a criterion
5. Admin tries to edit criteria using Edit Criteria page
6. Frontend sends UPDATE request with `criteria_id` values
7. Backend tries to DELETE criteria (line 192)
8. Database rejects DELETE because evaluation_responses reference these criteria
9. Error: `foreign key constraint "evaluation_responses_criteria_id_fkey" on table "evaluation_responses"`

---

## Incorrect Assumptions in Backend Code

### Assumption 1: Frontend wants to replace all criteria
**Reality:** Frontend wants to update specific fields of existing criteria

### Assumption 2: Criteria can be deleted and recreated
**Reality:** Criteria cannot be deleted if they have evaluation responses

### Assumption 3: Frontend doesn't send criteria_id
**Reality:** Frontend sends criteria_id to indicate which criteria to update

---

## The Fix

### Current Code (Lines 188-225):
```javascript
// Handle criteria updates if provided
if (criteria !== undefined) {
  console.log(`Updating criteria for overlay ${overlayId}, received ${criteria.length} criteria`);

  // ❌ Delete existing criteria
  await dbClient.query('DELETE FROM evaluation_criteria WHERE overlay_id = $1', [overlayId]);

  // ❌ Insert new criteria
  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    const insertQuery = `
      INSERT INTO evaluation_criteria
      (overlay_id, name, description, criterion_type, weight, is_required, display_order, criteria_text, max_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await dbClient.query(insertQuery, [...]);
  }
}
```

### Corrected Code:
```javascript
// Handle criteria updates if provided
if (criteria !== undefined && Array.isArray(criteria)) {
  console.log(`Updating criteria for overlay ${overlayId}, received ${criteria.length} criteria`);

  // ✅ Update existing criteria in-place
  for (const c of criteria) {
    // Check if criteria_id is provided (indicates UPDATE not INSERT)
    if (c.criteria_id) {
      // UPDATE existing criterion - only update provided fields
      const updateQuery = `
        UPDATE evaluation_criteria
        SET criteria_text = COALESCE($2, criteria_text),
            max_score = COALESCE($3, max_score),
            updated_at = CURRENT_TIMESTAMP
        WHERE criteria_id = $1 AND overlay_id = $4
      `;

      const result = await dbClient.query(updateQuery, [
        c.criteria_id,
        c.criteria_text !== undefined ? c.criteria_text : null,
        c.max_score !== undefined ? c.max_score : null,
        overlayId
      ]);

      if (result.rowCount === 0) {
        console.warn(`Criterion ${c.criteria_id} not found for overlay ${overlayId}`);
      } else {
        console.log(`  - Updated criterion: ${c.criteria_id} (criteria_text: ${c.criteria_text ? 'updated' : 'unchanged'}, max_score: ${c.max_score !== undefined ? c.max_score : 'unchanged'})`);
      }
    } else {
      // INSERT new criterion (if criteria_id not provided)
      // This branch handles creating NEW criteria, not editing existing ones
      const insertQuery = `
        INSERT INTO evaluation_criteria
        (overlay_id, name, description, criterion_type, weight, is_required, display_order, criteria_text, max_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING criteria_id
      `;

      const criterionType = c.criterion_type || c.category || 'text';
      const weightValue = c.max_score !== undefined ? c.max_score :
                          (c.weight !== undefined && c.weight <= 1 ? c.weight * 100 : c.weight || 10);

      const result = await dbClient.query(insertQuery, [
        overlayId,
        c.name,
        c.description || null,
        criterionType,
        weightValue,
        c.is_required !== undefined ? c.is_required : false,
        c.display_order !== undefined ? c.display_order : 0,
        c.criteria_text || null,
        c.max_score !== undefined ? c.max_score : weightValue,
      ]);

      console.log(`  - Inserted new criterion: ${c.name} (id: ${result.rows[0].criteria_id})`);
    }
  }

  console.log(`Successfully processed ${criteria.length} criteria for overlay ${overlayId}`);
}
```

---

## Key Changes in the Fix

### 1. Check for criteria_id
```javascript
if (c.criteria_id) {
  // UPDATE path
} else {
  // INSERT path
}
```

### 2. Use UPDATE instead of DELETE + INSERT
```javascript
UPDATE evaluation_criteria
SET criteria_text = COALESCE($2, criteria_text),
    max_score = COALESCE($3, max_score),
    updated_at = CURRENT_TIMESTAMP
WHERE criteria_id = $1 AND overlay_id = $4
```

### 3. Only update provided fields
- Use `COALESCE($2, criteria_text)` - if new value is NULL, keep existing
- Only pass fields that frontend explicitly sent
- Don't touch other fields (name, description, weight, etc.)

### 4. Preserve foreign key relationships
- No DELETE operation = no broken foreign keys
- Criteria IDs remain unchanged
- Evaluation responses continue to reference valid criteria

---

## Testing the Fix

### Test Case 1: Update criteria with existing responses
**Setup:**
1. Create overlay with criteria
2. Submit document and complete AI analysis
3. Verify evaluation_responses exist

**Steps:**
1. Edit criteria via frontend
2. Update criteria_text and max_score
3. Save changes

**Expected:**
- ✅ No foreign key error
- ✅ criteria_text updated in database
- ✅ max_score updated in database
- ✅ Other fields unchanged (name, description, weight)
- ✅ Existing evaluation_responses still valid

### Test Case 2: Update criteria without existing responses
**Setup:**
1. Create overlay with criteria
2. No submissions yet (no evaluation_responses)

**Steps:**
1. Edit criteria via frontend
2. Update criteria_text and max_score
3. Save changes

**Expected:**
- ✅ Same as Test Case 1 (both should work)

### Test Case 3: Create new criteria (if feature supports it)
**Setup:**
1. Overlay exists

**Steps:**
1. Send criteria without criteria_id
2. Backend should INSERT new criterion

**Expected:**
- ✅ New criterion created with new UUID
- ✅ All fields set from request

---

## Database Verification Queries

### Check criteria before update:
```sql
SELECT criteria_id, name, criteria_text, max_score
FROM evaluation_criteria
WHERE overlay_id = 'YOUR_OVERLAY_ID'
ORDER BY display_order;
```

### Check evaluation responses referencing criteria:
```sql
SELECT
  er.response_id,
  er.criteria_id,
  ec.name AS criterion_name,
  er.score,
  ds.document_name
FROM evaluation_responses er
JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
JOIN document_submissions ds ON er.submission_id = ds.submission_id
WHERE ec.overlay_id = 'YOUR_OVERLAY_ID'
LIMIT 10;
```

### Verify criteria after update:
```sql
SELECT criteria_id, name, criteria_text, max_score, updated_at
FROM evaluation_criteria
WHERE overlay_id = 'YOUR_OVERLAY_ID'
ORDER BY display_order;
```

---

## Why the Original Design Was Wrong

### Design Flaw 1: Misunderstanding Frontend Intent
- Frontend sends `criteria_id` = "update this specific criterion"
- Backend ignores it = "replace all criteria"

### Design Flaw 2: Destructive Pattern
- DELETE + INSERT is destructive
- Loses data: criteria_id changes, foreign keys break
- Not idempotent: running twice causes different results

### Design Flaw 3: Assumptions About Usage
- Assumed criteria are edited BEFORE any submissions
- Didn't account for editing criteria AFTER AI evaluations
- Didn't consider foreign key constraints

---

## Impact of the Bug

### What Fails:
- ✅ Edit Criteria feature is completely broken for overlays with existing submissions
- ✅ Any overlay that has been used for AI evaluation cannot have criteria edited
- ✅ Error message is cryptic and doesn't explain the issue to users

### What Works:
- ✅ Editing NEW overlays (never used for evaluation) - no evaluation_responses exist yet
- ✅ Creating NEW criteria (if supported)

---

## Recommended Deployment Steps

1. **Update Lambda Handler:**
   - Replace lines 188-225 in `lambda/functions/api/overlays/index.js`
   - Deploy ComputeStack: `cdk deploy OverlayComputeStack`

2. **Test Immediately:**
   - Use existing overlay with submissions
   - Edit criteria via frontend
   - Verify no error
   - Check database for updated values

3. **Verify No Regression:**
   - Test creating new overlay
   - Test updating new overlay (no submissions yet)
   - Ensure both still work

---

## Files to Modify

**Backend:**
- `lambda/functions/api/overlays/index.js` - handleUpdate function (lines 188-225)

**Frontend:**
- No changes needed (already correct)

**Database:**
- No schema changes needed

---

## Lessons Learned

1. **Check for IDs in Updates:** If frontend sends an ID, it wants to UPDATE, not replace
2. **Respect Foreign Keys:** Deleting records with foreign key dependencies requires CASCADE or fails
3. **Test with Real Data:** Testing only on empty databases misses foreign key issues
4. **Use UPDATE not DELETE+INSERT:** Preserves IDs, foreign keys, and is more efficient

---

**Status:** Bug identified and fix proposed. Ready for implementation.

**Next Steps:**
1. Review proposed fix
2. Apply changes to Lambda handler
3. Deploy to production
4. Test with real overlay that has submissions
