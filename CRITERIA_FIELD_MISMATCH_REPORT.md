# CRITICAL: AI Agents Use Wrong Criteria Field

**Date:** 2026-02-01
**Status:** 🚨 CRITICAL BUG DISCOVERED
**Impact:** Edit Criteria feature is NOT being used by AI agents

---

## Executive Summary

**PROBLEM:** The Edit Criteria feature allows users to edit `criteria_text` and `max_score` fields, but the AI agents are using the `description` field (not `criteria_text`) and a hardcoded `max_score: 100` (not the database value).

**IMPACT:** Changes made via Edit Criteria page are **NOT used** by AI evaluation agents. Users think they're customizing rubrics, but AI agents ignore those changes.

**AFFECTED COMPONENTS:**
- ✅ Frontend: Correctly edits `criteria_text` and `max_score`
- ✅ Backend API: Correctly saves `criteria_text` and `max_score` to database
- ❌ **AI Agents: Using wrong fields (`description` instead of `criteria_text`)**
- ❌ **db-utils: Not fetching `criteria_text` or `max_score` from database**

---

## Detailed Findings

### Finding 1: getEvaluationCriteria() Doesn't Fetch criteria_text

**Location:** `lambda/layers/common/nodejs/db-utils.js` lines 87-113

**Code:**
```javascript
async function getEvaluationCriteria(client, overlayId) {
  const query = `
    SELECT
      criteria_id AS criterion_id,
      overlay_id,
      name,
      description,           // ❌ Fetches description (old field)
      criterion_type,
      weight,
      is_required,
      display_order,
      validation_rules
      // ❌ MISSING: criteria_text (new field from migration 008)
      // ❌ MISSING: max_score (column added in migration 008)
    FROM evaluation_criteria
    WHERE overlay_id = $1
    ORDER BY display_order, name
  `;

  const result = await client.query(query, [overlayId]);

  // Add default values for fields used by AI agents
  return result.rows.map(row => ({
    ...row,
    category: row.criterion_type || 'general',
    max_score: 100,  // ❌ HARDCODED! Ignores database value
    evaluation_method: 'ai_analysis',
  }));
}
```

**Issues:**
1. **Doesn't fetch `criteria_text`** - The detailed rubric field users edit is never loaded
2. **Doesn't fetch `max_score`** - The score field users edit is never loaded
3. **Hardcodes `max_score: 100`** - Overrides any database value with 100

---

### Finding 2: Scoring Agent Uses description Field

**Location:** `lambda/functions/scoring/index.js` lines 72-74

**Code:**
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`
  // ❌ Uses c.description (from database)
  // ❌ Should use c.criteria_text (user-edited detailed rubric)
).join('\n');
```

**Sent to Claude API:**
```
EVALUATION CRITERIA:
- Question 1 - Project Need (text): Brief one-line description [Max: 100, Weight: 100, Method: ai_analysis]
- Question 2 - Feasibility (text): Another brief description [Max: 100, Weight: 100, Method: ai_analysis]
```

**What SHOULD be sent:**
```
EVALUATION CRITERIA:
- Question 1 - Project Need (text): [Detailed rubric text with scoring guidance, examples, and criteria that user spent time editing...] [Max: 150, Weight: 150, Method: ai_analysis]
```

---

### Finding 3: Content-Analyzer Uses description Field

**Location:** `lambda/functions/content-analyzer/index.js` lines 53-55

**Code:**
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max Score: ${c.max_score}, Weight: ${c.weight}]`
  // ❌ Uses c.description (from database)
  // ❌ Should use c.criteria_text (user-edited detailed rubric)
).join('\n');
```

**Same problem** as scoring agent - sends brief description instead of detailed rubric.

---

### Finding 4: Other Agents Don't Use Criteria

**Orchestrator:** Doesn't reference criteria at all (lines 1-188) ✅
**Structure Validator:** Not checked, likely doesn't use criteria ✅
**Grammar Checker:** Not checked, likely doesn't use criteria ✅
**Clarification:** Not checked, may use criteria ⚠️

---

## Impact Analysis

### User Experience Impact: HIGH ⚠️

**What Users Think:**
1. Admin edits detailed rubric via Edit Criteria page
2. Admin adds scoring guidance: "Excellent (90-100): ...", "Good (70-89): ..."
3. Admin adjusts max_score from 100 to 150
4. Admin expects AI to use this guidance

**What Actually Happens:**
1. Frontend saves changes to `criteria_text` and `max_score` columns ✅
2. Backend updates database correctly ✅
3. **AI agents completely ignore these fields** ❌
4. AI uses the old `description` field (brief one-liner) ❌
5. AI uses hardcoded `max_score: 100` (ignores user's 150) ❌
6. **User's detailed rubric is never seen by AI** ❌

**Result:** False sense of control. Users waste time creating detailed rubrics that are never used.

---

### Data Integrity Impact: LOW ✅

- Database schema is correct
- Data is being saved correctly
- No data corruption
- Just not being read correctly

---

### Business Impact: HIGH ⚠️

**V1.4 Feature Promises:**
- "Edit detailed rubric text for AI evaluation"
- "Customize scoring criteria"
- "Provide specific guidance to AI agents"

**Reality:**
- Feature exists but doesn't work
- AI ignores user customization
- Users may report "AI doesn't follow my rubric"

---

## Root Cause

**Timeline of Events:**

1. **Original Schema (Migration 000):**
   - `evaluation_criteria` table has `description` column
   - AI agents coded to use `description`

2. **Migration 008 (2026-01-XX):**
   - Added `criteria_text` column for detailed rubrics
   - Added `max_score` column for customizable scoring
   - **Did NOT update AI agents to use new columns**
   - **Did NOT update db-utils to fetch new columns**

3. **Edit Criteria Feature (2026-02-01):**
   - Frontend built to edit `criteria_text` and `max_score`
   - Backend API correctly saves to database
   - **Did NOT verify AI agents use these fields**
   - **Did NOT test end-to-end with AI evaluation**

**Root Cause:** Migration added new columns but codebase was not updated to use them.

---

## The Fix Required

### Fix 1: Update db-utils.js (Lambda Layer)

**File:** `lambda/layers/common/nodejs/db-utils.js` lines 87-113

**Changes Needed:**

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
      validation_rules,
      criteria_text,     // ✅ ADD THIS
      max_score          // ✅ ADD THIS
    FROM evaluation_criteria
    WHERE overlay_id = $1
    ORDER BY display_order, name
  `;

  const result = await client.query(query, [overlayId]);

  return result.rows.map(row => ({
    ...row,
    category: row.criterion_type || 'general',
    max_score: row.max_score || row.weight || 100,  // ✅ Use database value first
    evaluation_method: 'ai_analysis',
    // ✅ Ensure criteria_text is available (may be NULL)
    criteria_text: row.criteria_text || row.description || '',
  }));
}
```

---

### Fix 2: Update Scoring Agent

**File:** `lambda/functions/scoring/index.js` lines 72-74

**Change from:**
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`
).join('\n');
```

**Change to:**
```javascript
const criteriaText = criteria.map(c => {
  // Use criteria_text if available (detailed rubric), fallback to description
  const details = c.criteria_text || c.description || 'No specific criteria provided';
  return `- ${c.name} (${c.category}): ${details} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`;
}).join('\n');
```

---

### Fix 3: Update Content-Analyzer Agent

**File:** `lambda/functions/content-analyzer/index.js` lines 53-55

**Change from:**
```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max Score: ${c.max_score}, Weight: ${c.weight}]`
).join('\n');
```

**Change to:**
```javascript
const criteriaText = criteria.map(c => {
  // Use criteria_text if available (detailed rubric), fallback to description
  const details = c.criteria_text || c.description || 'No specific criteria provided';
  return `- ${c.name} (${c.category}): ${details} [Max Score: ${c.max_score}, Weight: ${c.weight}]`;
}).join('\n');
```

---

### Fix 4: Check Other Agents (If Needed)

Files to check:
- `lambda/functions/clarification/index.js` - May use criteria
- `lambda/functions/structure-validator/index.js` - Probably doesn't
- `lambda/functions/grammar-checker/index.js` - Probably doesn't

---

## Deployment Plan

### Phase 1: Fix Lambda Layer (db-utils.js)

```bash
# 1. Edit lambda/layers/common/nodejs/db-utils.js
# 2. Deploy OrchestrationStack (contains Lambda Layer)
cdk deploy OverlayOrchestrationStack --require-approval never

# This updates the layer used by ALL AI agents
```

### Phase 2: Fix AI Agents

```bash
# 1. Edit lambda/functions/scoring/index.js
# 2. Edit lambda/functions/content-analyzer/index.js
# 3. Check/edit clarification/index.js if needed
# 4. Deploy OrchestrationStack again
cdk deploy OverlayOrchestrationStack --require-approval never
```

### Phase 3: Test End-to-End

1. Edit criteria via Edit Criteria page
2. Add detailed rubric with scoring guidance
3. Set max_score to 150 (not 100)
4. Submit new document
5. Wait for AI evaluation
6. **Verify feedback reflects detailed rubric**
7. **Verify scores use max_score of 150**

---

## Testing Checklist

After deploying fixes:

1. **Test: AI Uses criteria_text**
   - Edit criterion: Add detailed rubric with "Excellent (90-100): ..."
   - Submit document
   - Check feedback - should reference rubric details ✅

2. **Test: AI Uses max_score**
   - Edit criterion: Set max_score to 150
   - Submit document
   - Check score - should be out of 150, not 100 ✅

3. **Test: Fallback to description**
   - Create new overlay with criteria (criteria_text is NULL)
   - Submit document
   - AI should use description field as fallback ✅

4. **Test: No regression**
   - Verify old overlays still work
   - Verify scoring still calculates correctly ✅

---

## Risk Assessment

### Deployment Risk: MEDIUM ⚠️

**Why Medium:**
- Changes affect Lambda Layer (shared by all agents)
- Changes affect AI agent prompts (could affect output quality)
- Need to redeploy OrchestrationStack (6 Lambda functions)

**Mitigation:**
- Backup current layer before deployment
- Test with one submission before full rollout
- Monitor CloudWatch logs for errors
- Have rollback plan ready

### Rollback Plan:

If deployment causes issues:
```bash
# Restore previous layer version via CDK
# (Lambda Layer versions are immutable, can revert to previous)

# Or restore from git:
git revert <commit-hash>
cdk deploy OverlayOrchestrationStack --require-approval never
```

---

## Why This Wasn't Caught Earlier

1. **No End-to-End Testing:**
   - Edit Criteria feature tested in isolation
   - Never tested with actual AI evaluation
   - Assumed AI agents would use new fields

2. **Migration Incomplete:**
   - Migration 008 added columns
   - Didn't update code to use columns
   - No validation that code references new columns

3. **Documentation Gap:**
   - No documentation on which fields AI agents use
   - No diagram showing data flow from UI → DB → AI

---

## Recommendations

### Immediate Actions (Required):

1. ✅ Deploy fixes to db-utils.js, scoring agent, content-analyzer
2. ✅ Test end-to-end with real document submission
3. ✅ Update EDIT_CRITERIA_FIX_TEST_CHECKLIST.md with new tests
4. ✅ Document in CLAUDE.md which fields AI agents use

### Future Improvements (Nice to Have):

1. **Add Integration Tests:**
   - Test that changes in UI flow through to AI agents
   - Verify AI prompts contain expected criteria_text

2. **Add Field Usage Documentation:**
   - Document which components read which database columns
   - Add comments in code: "// Used by AI agents"

3. **Add Migration Validation:**
   - After schema changes, verify code updated
   - Checklist: "Did you update all code that reads this column?"

4. **Add E2E Testing:**
   - Automated test: Edit criteria → Submit → Verify AI feedback

---

## Files Requiring Changes

### Must Change:
1. ✅ `lambda/layers/common/nodejs/db-utils.js` - Add criteria_text and max_score to query
2. ✅ `lambda/functions/scoring/index.js` - Use criteria_text instead of description
3. ✅ `lambda/functions/content-analyzer/index.js` - Use criteria_text instead of description

### Should Check:
4. ⚠️ `lambda/functions/clarification/index.js` - May use criteria, check if needs update
5. ⚠️ `lambda/functions/structure-validator/index.js` - Probably OK, verify
6. ⚠️ `lambda/functions/grammar-checker/index.js` - Probably OK, verify

### Documentation:
7. ✅ `EDIT_CRITERIA_FIX_TEST_CHECKLIST.md` - Add test for AI using criteria_text
8. ✅ `CLAUDE.md` - Document which fields AI agents use
9. ✅ This report (`CRITERIA_FIELD_MISMATCH_REPORT.md`)

---

## Summary

**Current State:**
- Edit Criteria feature saves data correctly ✅
- AI agents use wrong fields ❌
- Users' rubric customizations are ignored ❌

**After Fix:**
- AI agents will use `criteria_text` (detailed rubric) ✅
- AI agents will use `max_score` (from database) ✅
- Edit Criteria feature will actually work end-to-end ✅

**Estimated Fix Time:** 30 minutes coding + 10 minutes deployment + 30 minutes testing = 70 minutes

**Priority:** HIGH - Feature currently doesn't work as intended

---

**Report Generated:** 2026-02-01
**Investigation By:** Claude Sonnet 4.5
**Status:** Ready for fix implementation

