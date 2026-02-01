# Edit Criteria Feature - Complete Implementation Plan

**Date:** 2026-02-01
**Purpose:** Groundwork analysis for tomorrow's implementation
**Status:** Analysis Complete - Ready for Implementation

---

## Executive Summary

**Current State:** Edit Criteria UI exists and updates `criteria_text` column, but AI agents and display logic use `description` column instead.

**The Mismatch:**
- ✅ Edit Criteria **writes** to: `criteria_text` column
- ❌ AI agents **read** from: `description` column
- ❌ Session page **displays**: `description` field
- **Result:** User's detailed rubric edits are ignored

**Required Changes:** 3 backend files need updating to read `criteria_text` instead of (or in addition to) `description`.

---

## PART 1: Data Flow Analysis

### 1.1 READ Path - What Displays Now

**Session Detail Page** (`frontend/app/session/[id]/page.tsx`)

**Line 533-537:** Displays description field
```typescript
{criterion.description && (
  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
    {criterion.description}
  </p>
)}
```

**Fields displayed:**
- `criterion.name` (line 516)
- `criterion.category` (line 520)
- `criterion.weight` (line 526)
- `criterion.max_score` (line 529)
- `criterion.description` (line 535) ← **Currently displays this**

---

**API GET Endpoint** (`lambda/functions/api/overlays/index.js`)

**Lines 58-65:** Database query
```javascript
const criteriaQuery = `
  SELECT criteria_id, name, description, criterion_type, weight,
         is_required, display_order, validation_rules,
         criteria_text, max_score  // ← Both fields fetched
  FROM evaluation_criteria
  WHERE overlay_id = $1
  ORDER BY display_order, name
`;
```

**Lines 69-81:** Response mapping
```javascript
overlay.criteria = criteriaResult.rows.map(c => ({
  criteria_id: c.criteria_id,
  name: c.name,
  description: c.description,           // ← Returns description
  category: c.criterion_type,
  weight: c.weight / 100,
  max_score: c.max_score || c.weight,   // ← Returns max_score from DB
  is_required: c.is_required,
  is_active: true,
  display_order: c.display_order,
  validation_rules: c.validation_rules,
  criteria_text: c.criteria_text || '', // ← Also returns criteria_text
}));
```

**✅ API returns BOTH fields** - frontend can choose which to display

---

### 1.2 WRITE Path - What Edit Criteria Updates

**Edit Criteria Page** (`frontend/app/overlays/[id]/edit-criteria/page.tsx`)

**Lines 90-97:** Sends update data
```typescript
const updateData = {
  criteria: criteria.map(c => ({
    criteria_id: c.criteria_id,
    criteria_text: c.criteria_text || null,  // ← Updates criteria_text
    max_score: c.max_score || null,          // ← Updates max_score
  })),
};
```

**Frontend sends:** `criteria_id`, `criteria_text`, `max_score` (does NOT send `description`)

---

**Backend PUT Endpoint** (`lambda/functions/api/overlays/index.js`)

**Lines 199-205:** UPDATE query
```javascript
const updateQuery = `
  UPDATE evaluation_criteria
  SET criteria_text = COALESCE($2, criteria_text),  // ← Updates criteria_text
      max_score = COALESCE($3, max_score),          // ← Updates max_score
      updated_at = CURRENT_TIMESTAMP
  WHERE criteria_id = $1 AND overlay_id = $4
`;
```

**Backend updates:** `criteria_text` column (does NOT update `description`)

---

### 1.3 Database Current State

**Seed Data** (`lambda/functions/database-migration/migrations/001_seed_data.sql`)

**Lines 112-128:** Sample criteria
```sql
INSERT INTO evaluation_criteria (overlay_id, name, description, criterion_type, weight, ...)
VALUES
  ('...', 'Party Identification', 'Verify all parties are correctly identified', 'boolean', 10.0, ...),
  ('...', 'Effective Date', 'Contract effective date', 'date', 5.0, ...),
  ('...', 'Terms Clarity', 'Are contract terms clear and unambiguous?', 'choice', 20.0, ...);
```

**Database columns:**
- `description`: Has SHORT descriptive text (populated by seed data)
- `criteria_text`: NULL (added by migration 008, never populated)
- `max_score`: Set to `weight` value (populated by migration 008)

**What users see now:**
- Session page shows: `description` = "Verify all parties are correctly identified"
- AI agents receive: `description` = "Verify all parties are correctly identified"
- When user edits: Updates `criteria_text` (currently NULL)
- **Problem:** Edits go to criteria_text, but everything reads description

---

## PART 2: AI Agent Analysis

### 2.1 Scoring Agent

**File:** `lambda/functions/scoring/index.js`

**Line 72-74:** Builds criteria prompt
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`
  //                              ^^^^^^^^^^^^^ Uses description field
).join('\n');
```

**What AI sees:**
```
EVALUATION CRITERIA:
- Party Identification (boolean): Verify all parties are correctly identified [Max: 100, Weight: 10, Method: ai_analysis]
- Terms Clarity (choice): Are contract terms clear and unambiguous? [Max: 100, Weight: 20, Method: ai_analysis]
```

**Problem:** Uses `c.description` (short text), ignores `c.criteria_text` (detailed rubric)

---

### 2.2 Content-Analyzer Agent

**File:** `lambda/functions/content-analyzer/index.js`

**Line 53-55:** Builds criteria prompt
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max Score: ${c.max_score}, Weight: ${c.weight}]`
  //                              ^^^^^^^^^^^^^ Uses description field
).join('\n');
```

**Same problem:** Uses `c.description`, ignores `c.criteria_text`

---

### 2.3 DB-Utils (Data Fetching Layer)

**File:** `lambda/layers/common/nodejs/db-utils.js`

**Lines 87-113:** getEvaluationCriteria function
```javascript
async function getEvaluationCriteria(client, overlayId) {
  const query = `
    SELECT
      criteria_id AS criterion_id,
      overlay_id,
      name,
      description,           // ← Fetches description
      criterion_type,
      weight,
      is_required,
      display_order,
      validation_rules
      // ❌ Does NOT fetch criteria_text
      // ❌ Does NOT fetch max_score
    FROM evaluation_criteria
    WHERE overlay_id = $1
    ORDER BY display_order, name
  `;

  const result = await client.query(query, [overlayId]);

  return result.rows.map(row => ({
    ...row,
    category: row.criterion_type || 'general',
    max_score: 100,  // ❌ HARDCODED! Ignores database value
    evaluation_method: 'ai_analysis',
  }));
}
```

**Critical issues:**
1. ❌ Does NOT fetch `criteria_text` column
2. ❌ Does NOT fetch `max_score` column
3. ❌ Hardcodes `max_score: 100` (ignores user's custom max_score)
4. ✅ Fetches `description` column

**Impact:** ALL AI agents use db-utils, so they ALL miss criteria_text and max_score

---

## PART 3: Gap Analysis

### 3.1 Field Usage Matrix

| Component | Reads FROM | Writes TO | Impact |
|-----------|-----------|-----------|---------|
| **Session Page Display** | `description` | - | Shows OLD short text |
| **Edit Criteria UI** | `criteria_text` | `criteria_text` | Edits NEW detailed rubric |
| **API GET Handler** | BOTH | - | Returns both fields ✅ |
| **API PUT Handler** | - | `criteria_text` | Updates NEW field ✅ |
| **Scoring Agent** | `description` | - | Uses OLD short text ❌ |
| **Content-Analyzer** | `description` | - | Uses OLD short text ❌ |
| **db-utils** | `description` | - | Fetches OLD field only ❌ |

---

### 3.2 The Disconnect

**Current Flow:**
```
User edits criteria → Updates criteria_text column
                      ↓
AI agents call db-utils → Fetches description column
                      ↓
AI uses description → Ignores user's detailed rubric
```

**What SHOULD happen:**
```
User edits criteria → Updates criteria_text column
                      ↓
AI agents call db-utils → Fetches criteria_text column
                      ↓
AI uses criteria_text → Uses user's detailed rubric
```

---

### 3.3 max_score Issue

**Current:**
- User sets `max_score: 150` in Edit Criteria
- Backend saves `150` to database ✅
- db-utils hardcodes `max_score: 100` ❌
- AI agents see `max_score: 100` ❌
- Scoring calculations wrong

**Should be:**
- User sets `max_score: 150`
- Backend saves `150` to database ✅
- db-utils fetches `150` from database ✅
- AI agents see `max_score: 150` ✅
- Scoring calculations correct

---

## PART 4: Required Changes

### 4.1 Change Summary

**Must change (3 files):**
1. ✅ **db-utils.js** - Fetch criteria_text and max_score from database
2. ✅ **scoring/index.js** - Use criteria_text (fallback to description)
3. ✅ **content-analyzer/index.js** - Use criteria_text (fallback to description)

**Optional (1 file):**
4. ⚠️ **Session page** - Display criteria_text if available (for user verification)

**No changes needed:**
- ✅ Edit Criteria UI (already correct)
- ✅ API PUT handler (already correct)
- ✅ API GET handler (already returns both fields)

---

### 4.2 Detailed Implementation Steps

---

#### CHANGE 1: Update db-utils.js

**File:** `lambda/layers/common/nodejs/db-utils.js`
**Function:** `getEvaluationCriteria` (lines 87-113)
**Risk:** MEDIUM (affects ALL AI agents)
**Time:** 5 minutes

**Current code (lines 88-112):**
```javascript
async function getEvaluationCriteria(client, overlayId) {
  const query = `
    SELECT
      criteria_id AS criterion_id,
      overlay_id,
      name,
      description,
      criterion_type,
      weight,
      is_required,
      display_order,
      validation_rules
    FROM evaluation_criteria
    WHERE overlay_id = $1
    ORDER BY display_order, name
  `;

  const result = await client.query(query, [overlayId]);

  return result.rows.map(row => ({
    ...row,
    category: row.criterion_type || 'general',
    max_score: 100, // Default max score
    evaluation_method: 'ai_analysis',
  }));
}
```

**New code:**
```javascript
async function getEvaluationCriteria(client, overlayId) {
  const query = `
    SELECT
      criteria_id AS criterion_id,
      overlay_id,
      name,
      description,
      criteria_text,      // ← ADD THIS
      criterion_type,
      weight,
      max_score,          // ← ADD THIS
      is_required,
      display_order,
      validation_rules
    FROM evaluation_criteria
    WHERE overlay_id = $1
    ORDER BY display_order, name
  `;

  const result = await client.query(query, [overlayId]);

  return result.rows.map(row => ({
    ...row,
    category: row.criterion_type || 'general',
    max_score: row.max_score || row.weight || 100,  // ← FIX: Use DB value first
    evaluation_method: 'ai_analysis',
    // Ensure criteria_text is available (may be NULL)
    criteria_text: row.criteria_text || row.description || '',  // ← ADD: Fallback logic
  }));
}
```

**Changes:**
- Line 98: Add `criteria_text` to SELECT
- Line 101: Add `max_score` to SELECT
- Line 110: Change `max_score: 100` to `max_score: row.max_score || row.weight || 100`
- Line 113: Add `criteria_text: row.criteria_text || row.description || ''`

**Testing:**
```javascript
// After change, criteria objects will have:
{
  criterion_id: "abc-123",
  name: "Party Identification",
  description: "Verify all parties are correctly identified",  // Original short text
  criteria_text: "Assess party identification...",             // NEW detailed rubric (or fallback to description)
  max_score: 150,                                              // From database (not hardcoded)
  category: "boolean",
  weight: 10
}
```

---

#### CHANGE 2: Update Scoring Agent

**File:** `lambda/functions/scoring/index.js`
**Lines:** 72-74
**Risk:** LOW (only affects scoring prompt)
**Time:** 3 minutes

**Current code:**
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`
).join('\n');
```

**New code:**
```javascript
const criteriaText = criteria.map(c => {
  // Use criteria_text if available (detailed rubric), fallback to description
  const details = c.criteria_text || c.description || 'No specific criteria provided';
  return `- ${c.name} (${c.category}): ${details} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`;
}).join('\n');
```

**Changes:**
- Add variable `details` with fallback logic: `criteria_text || description`
- Use `details` instead of `c.description` in template string

**Result:**
- If criteria_text has value → AI sees detailed rubric
- If criteria_text is NULL → AI sees description (current behavior)
- No breaking changes for existing overlays

---

#### CHANGE 3: Update Content-Analyzer Agent

**File:** `lambda/functions/content-analyzer/index.js`
**Lines:** 53-55
**Risk:** LOW (only affects content analysis prompt)
**Time:** 3 minutes

**Current code:**
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max Score: ${c.max_score}, Weight: ${c.weight}]`
).join('\n');
```

**New code:**
```javascript
const criteriaText = criteria.map(c => {
  // Use criteria_text if available (detailed rubric), fallback to description
  const details = c.criteria_text || c.description || 'No specific criteria provided';
  return `- ${c.name} (${c.category}): ${details} [Max Score: ${c.max_score}, Weight: ${c.weight}]`;
}).join('\n');
```

**Changes:**
- Same pattern as scoring agent
- Add `details` variable with fallback logic
- Use `details` instead of `c.description`

---

#### CHANGE 4 (Optional): Update Session Page Display

**File:** `frontend/app/session/[id]/page.tsx`
**Lines:** 533-537
**Risk:** VERY LOW (cosmetic change)
**Time:** 2 minutes

**Current code:**
```typescript
{criterion.description && (
  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
    {criterion.description}
  </p>
)}
```

**New code:**
```typescript
{(criterion.criteria_text || criterion.description) && (
  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
    {criterion.criteria_text || criterion.description}
  </p>
)}
```

**Changes:**
- Display `criteria_text` if available, fallback to `description`
- Allows users to see their detailed rubric on session page

**Why optional:**
- API already returns both fields
- This is just for display purposes
- Not required for AI agents to work
- Can be done later if desired

---

## PART 5: Deployment Plan

### 5.1 Deployment Sequence

**Step 1: Deploy Lambda Layer (db-utils.js)**
```bash
cdk deploy OverlayOrchestrationStack --require-approval never
```
- This updates the Lambda Layer used by ALL AI agents
- Duration: ~2 minutes

**Step 2: Verify AI agents pick up new layer**
- Lambda cold start will use new layer automatically
- No separate deployment needed for agents

**Step 3 (Optional): Deploy frontend**
- Only if implementing Change 4 (session page display)
- Restart dev server with updated code

---

### 5.2 Testing Checklist

**Test 1: Verify db-utils returns criteria_text**
```javascript
// Check CloudWatch logs for AI agent
// Should see criteria_text in fetched data
```

**Test 2: Edit criteria and verify AI uses it**
1. Navigate to Edit Criteria page
2. Edit criteria_text with detailed rubric:
   ```
   Assess party identification clearly and comprehensively.

   EXCELLENT (90-100): All parties identified with full legal names and addresses
   GOOD (70-89): All parties identified with names, some details missing
   FAIR (50-69): Most parties identified but incomplete information
   POOR (0-49): Missing parties or major identification gaps
   ```
3. Set max_score to 150
4. Save changes
5. Submit new document
6. Wait for AI evaluation
7. Check feedback - should reference rubric levels (EXCELLENT/GOOD/etc.)
8. Check scores - should be out of 150 (not 100)

**Test 3: Verify fallback works for old criteria**
1. Use overlay with no criteria_text (NULL)
2. Submit document
3. AI should use description field (current behavior)
4. No errors

**Test 4: Verify max_score from database**
1. Edit criteria, set max_score to 200
2. Submit document
3. Check feedback - should show score out of 200
4. Verify score calculations use 200 (not hardcoded 100)

---

### 5.3 Rollback Plan

**If issues occur:**

```bash
# Revert Lambda Layer changes
git revert <commit-hash>
cdk deploy OverlayOrchestrationStack --require-approval never
```

**What rollback does:**
- AI agents go back to using `description` field
- Edit Criteria feature stops working (same as before)
- But system remains stable

**When to rollback:**
- If AI agents start throwing errors
- If evaluations fail
- If scores are incorrect

**Don't rollback if:**
- Edit Criteria just doesn't work (expected until changes deployed)
- Frontend display issue (doesn't affect AI agents)

---

## PART 6: Risk Assessment

### 6.1 Risk Matrix

| Change | Risk Level | Why | Mitigation |
|--------|-----------|-----|------------|
| db-utils.js | MEDIUM | Affects ALL AI agents | Use fallback logic, test thoroughly |
| scoring/index.js | LOW | Only scoring prompt | Fallback to description if NULL |
| content-analyzer/index.js | LOW | Only analysis prompt | Fallback to description if NULL |
| session page | VERY LOW | Cosmetic only | Can skip if uncertain |

---

### 6.2 What Could Go Wrong

**Scenario 1: criteria_text is NULL**
- **Problem:** AI gets empty string instead of description
- **Mitigation:** Fallback logic `criteria_text || description`
- **Result:** AI uses description (current behavior)

**Scenario 2: max_score is NULL**
- **Problem:** Scoring calculations fail
- **Mitigation:** Fallback logic `max_score || weight || 100`
- **Result:** Uses weight or 100 as default

**Scenario 3: Lambda Layer doesn't update**
- **Problem:** AI agents still use old code
- **Mitigation:** Force cold start by updating Lambda env var
- **Result:** Pick up new layer on next invocation

**Scenario 4: Database column doesn't exist**
- **Problem:** Query fails with "column does not exist"
- **Status:** RESOLVED (migration 008 applied successfully)
- **Verification:** Index count increased to 138, includes GIN index

---

## PART 7: Timeline Estimate

### 7.1 Implementation Time

| Task | Time | Total |
|------|------|-------|
| Update db-utils.js | 5 min | 5 min |
| Update scoring/index.js | 3 min | 8 min |
| Update content-analyzer/index.js | 3 min | 11 min |
| Test locally (verify code) | 5 min | 16 min |
| Commit changes | 2 min | 18 min |
| Deploy OverlayOrchestrationStack | 2 min | 20 min |
| Wait for deployment | 3 min | 23 min |
| Test end-to-end | 10 min | 33 min |
| **(Optional)** Update session page | 2 min | 35 min |

**Total time:** 20-35 minutes (depending on whether session page updated)

---

### 7.2 Testing Time

| Test | Time |
|------|------|
| Edit criteria via UI | 2 min |
| Submit test document | 1 min |
| Wait for AI analysis | 3-5 min |
| Verify feedback uses rubric | 2 min |
| Verify max_score correct | 1 min |
| Test with old overlay (fallback) | 5 min |

**Total testing:** 15-20 minutes

---

## PART 8: Success Criteria

### 8.1 Feature Working

**✅ Edit Criteria feature is successful when:**

1. User edits criteria_text with detailed rubric
2. User sets custom max_score (e.g., 150)
3. User saves changes
4. User submits new document
5. AI evaluation uses the detailed rubric (mentions rubric text in feedback)
6. AI scores use the custom max_score (shows "X out of 150")
7. Feedback reflects the guidance in rubric (e.g., "EXCELLENT level achieved")

---

### 8.2 Fallback Working

**✅ Backward compatibility successful when:**

1. Old overlays (criteria_text = NULL) still work
2. AI uses description field as fallback
3. No errors in CloudWatch logs
4. Evaluations complete successfully

---

## PART 9: Post-Implementation

### 9.1 Documentation Updates

**Files to update after implementation:**
- [ ] CLAUDE.md - Add note that AI agents use criteria_text
- [ ] EDIT_CRITERIA_FEATURE_TEST_GUIDE.md - Update with deployment status
- [ ] DATABASE_REALITY_CHECK.md - Mark as resolved
- [ ] CRITERIA_FIELD_MISMATCH_REPORT.md - Mark as implemented

---

### 9.2 Future Enhancements

**Not in scope for tomorrow:**
1. Rich text editor for criteria_text
2. Template library for common rubrics
3. Preview mode (show how AI will interpret rubric)
4. Batch import/export of criteria
5. Version history for rubric changes

---

## Summary

**Current State:**
- ❌ Edit Criteria updates criteria_text
- ❌ AI agents read description
- ❌ User edits are ignored

**After Implementation:**
- ✅ Edit Criteria updates criteria_text
- ✅ AI agents read criteria_text (fallback to description)
- ✅ User edits are used by AI

**Required Work:** 3 file changes, 20 minutes implementation, 20 minutes testing

**Ready for Implementation:** YES - All groundwork complete

---

**Status:** Analysis complete. Ready to implement tomorrow with NO additional investigation needed.

**Created:** 2026-02-01
**By:** Claude Sonnet 4.5

