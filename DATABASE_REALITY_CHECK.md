# Database Reality Check - Criteria Fields

**Date:** 2026-02-01
**Investigation:** Verify which fields AI agents use before making changes

---

## Executive Summary

**Finding:** AI evaluations ARE working, BUT they're using the `description` field (from seed data), NOT the `criteria_text` field (which is NULL everywhere).

**Impact:** The Edit Criteria feature will NOT work as intended until AI agents are updated to use `criteria_text` instead of `description`.

---

## What's Actually in the Database

### From Seed Data (001_seed_data.sql)

```sql
INSERT INTO evaluation_criteria (overlay_id, name, description, criterion_type, weight, ...)
VALUES
    ('...', 'Party Identification', 'Verify all parties are correctly identified', 'boolean', 10.0, ...),
    ('...', 'Terms Clarity', 'Are contract terms clear and unambiguous?', 'choice', 20.0, ...),
    ('...', 'Risk Assessment', 'Overall risk level', 'choice', 25.0, ...);
```

**Result:**
- `description` column: Has values like "Verify all parties are correctly identified"
- `criteria_text` column: Doesn't exist yet (added later)

### From Migration 008 (008_add_criteria_details.sql)

```sql
ALTER TABLE evaluation_criteria
  ADD COLUMN IF NOT EXISTS criteria_text TEXT,
  ADD COLUMN IF NOT EXISTS max_score DECIMAL(10,2);

UPDATE evaluation_criteria
SET max_score = weight
WHERE max_score IS NULL;
```

**Result:**
- `criteria_text` column: **NOW EXISTS but is NULL for all rows**
- `max_score` column: **Set to weight value** (10.0, 20.0, 25.0, etc.)

### Current Database State

For existing criteria created before migration 008:

| Column | Value | Source |
|--------|-------|--------|
| `name` | "Party Identification" | Seed data |
| `description` | "Verify all parties are correctly identified" | Seed data |
| `criteria_text` | **NULL** | Never populated |
| `max_score` | 10.0 | Migration 008 (copied from weight) |
| `weight` | 10.0 | Seed data |

---

## What the API Returns (GET /overlays/{id})

**Code:** `lambda/functions/api/overlays/index.js` lines 57-81

**What it fetches from database:**
```sql
SELECT criteria_id, name, description, criterion_type, weight,
       is_required, display_order, validation_rules,
       criteria_text,  -- ✅ FETCHES criteria_text
       max_score       -- ✅ FETCHES max_score
FROM evaluation_criteria
```

**What it returns to frontend:**
```javascript
{
  criteria_id: "abc-123",
  name: "Party Identification",
  description: "Verify all parties are correctly identified",  // ✅ Has value
  criteria_text: '',  // ❌ Empty string (because NULL in database)
  max_score: 10.0,    // ✅ Has value (from migration 008)
  weight: 10.0
}
```

**Key Point:** Frontend receives `criteria_text: ''` (empty) because database has NULL.

---

## What AI Agents Fetch (getEvaluationCriteria)

**Code:** `lambda/layers/common/nodejs/db-utils.js` lines 87-113

**What it fetches from database:**
```sql
SELECT
  criteria_id AS criterion_id,
  overlay_id,
  name,
  description,     -- ✅ FETCHES description
  criterion_type,
  weight,
  is_required,
  display_order,
  validation_rules
  -- ❌ MISSING: criteria_text
  -- ❌ MISSING: max_score (column not in SELECT)
FROM evaluation_criteria
```

**What it returns to AI agents:**
```javascript
{
  criterion_id: "abc-123",
  name: "Party Identification",
  description: "Verify all parties are correctly identified",  // ✅ From database
  category: "boolean",
  max_score: 100,  // ❌ HARDCODED! Ignores database value (10.0)
  evaluation_method: "ai_analysis"
  // ❌ criteria_text NOT AVAILABLE (not fetched)
}
```

**Key Point:** AI agents get `description` (has value) but NOT `criteria_text` (not fetched).

---

## What AI Agents Actually Use (Scoring Agent)

**Code:** `lambda/functions/scoring/index.js` lines 72-74

```javascript
const criteriaText = criteria.map(c =>
  `- ${c.name} (${c.category}): ${c.description} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`
).join('\n');
```

**Sent to Claude API:**
```
EVALUATION CRITERIA:
- Party Identification (boolean): Verify all parties are correctly identified [Max: 100, Weight: 10, Method: ai_analysis]
- Terms Clarity (choice): Are contract terms clear and unambiguous? [Max: 100, Weight: 20, Method: ai_analysis]
- Risk Assessment (choice): Overall risk level [Max: 100, Weight: 25, Method: ai_analysis]
```

**What AI sees:**
- ✅ `name`: From database
- ✅ `description`: From database (SHORT description from seed data)
- ❌ `max_score`: Hardcoded 100 (ignores database value of 10.0)
- ✅ `weight`: From database
- ❌ `criteria_text`: Not available (not fetched)

---

## Why AI Evaluations Currently Work

**User Report:** "AI evaluations ARE working with criteria"

**Why This Is True:**
1. AI agents use `description` field ✅
2. `description` field HAS data (from seed data) ✅
3. AI receives criteria information ✅
4. AI generates evaluations ✅

**Everything works... until someone tries to edit criteria.**

---

## What Happens When User Edits Criteria

**Scenario:** Admin uses Edit Criteria page to add detailed rubric

### Step 1: User edits via frontend
```
Admin navigates to Edit Criteria page
Admin sees:
  - criteria_text: '' (empty, because NULL in database)
  - max_score: 10.0 (from database)

Admin edits:
  - criteria_text: "Assess party identification. EXCELLENT (9-10): All parties clearly identified with full legal names..."
  - max_score: 150
```

### Step 2: Frontend sends UPDATE
```javascript
PUT /overlays/{id}
{
  "criteria": [{
    "criteria_id": "abc-123",
    "criteria_text": "Assess party identification. EXCELLENT (9-10): ...",
    "max_score": 150
  }]
}
```

### Step 3: Backend saves to database
```sql
UPDATE evaluation_criteria
SET criteria_text = 'Assess party identification. EXCELLENT (9-10): ...',
    max_score = 150,
    updated_at = CURRENT_TIMESTAMP
WHERE criteria_id = 'abc-123';
```

**Result:** Database now has:
- `description`: "Verify all parties are correctly identified" (UNCHANGED)
- `criteria_text`: "Assess party identification. EXCELLENT (9-10): ..." (NEW)
- `max_score`: 150 (UPDATED from 10.0)

### Step 4: New submission arrives, AI evaluates

**What AI agent fetches:**
```javascript
{
  name: "Party Identification",
  description: "Verify all parties are correctly identified",  // ← OLD SHORT TEXT
  max_score: 100,  // ← HARDCODED, ignores 150 from database
  // criteria_text NOT FETCHED
}
```

**What AI sends to Claude:**
```
- Party Identification (boolean): Verify all parties are correctly identified [Max: 100, ...]
```

**Result:**
- ❌ AI uses OLD short description
- ❌ AI ignores NEW detailed rubric (criteria_text)
- ❌ AI uses hardcoded max_score: 100 (ignores 150 from database)
- ❌ **User's edits have ZERO effect on AI evaluation**

---

## The Problem Summarized

**Current State (Why It Works):**
- Database has `description` with data ✅
- AI agents use `description` ✅
- Evaluations work ✅

**After User Edits (Why It Breaks):**
- User edits `criteria_text` field ✅
- Database saves `criteria_text` ✅
- AI agents don't fetch `criteria_text` ❌
- AI agents continue using old `description` ❌
- **User's edits are ignored** ❌

**Root Cause:**
AI agents are coded to use `description` (old field), not `criteria_text` (new field for detailed rubrics).

---

## Comparison: API vs AI Agents

| Field | API GET Fetches? | AI Agents Fetch? | Used By AI? |
|-------|------------------|------------------|-------------|
| `name` | ✅ Yes | ✅ Yes | ✅ Yes |
| `description` | ✅ Yes | ✅ Yes | ✅ **Yes** |
| `criteria_text` | ✅ **Yes** | ❌ **No** | ❌ **No** |
| `max_score` | ✅ **Yes** | ❌ No (hardcoded) | ❌ No (uses 100) |
| `weight` | ✅ Yes | ✅ Yes | ✅ Yes |

**Gap:** API and AI agents are fetching different fields!

---

## Why My Original Report Was Correct

My earlier analysis correctly identified:
1. ❌ AI agents don't fetch `criteria_text` - **CORRECT**
2. ❌ AI agents hardcode `max_score: 100` - **CORRECT**
3. ❌ AI agents use `description` instead of `criteria_text` - **CORRECT**
4. ❌ Edit Criteria feature won't work without AI agent updates - **CORRECT**

**User's confusion:** "AI evaluations ARE working" is true because:
- No one has edited criteria yet (criteria_text is NULL everywhere)
- AI agents use description (which has data from seed)
- So evaluations work fine... for now

**What will happen:** As soon as someone uses Edit Criteria feature:
- Frontend will edit criteria_text
- AI will ignore it and use description
- User will report "my edits don't affect AI"

---

## The Fix Is Still Needed

**Files that need updating:**

1. **lambda/layers/common/nodejs/db-utils.js** (lines 87-113)
   - Add `criteria_text` and `max_score` to SELECT query
   - Use database `max_score` instead of hardcoded 100
   - Return both `description` and `criteria_text` to AI agents

2. **lambda/functions/scoring/index.js** (lines 72-74)
   - Use `criteria_text` if available, fallback to `description`
   - Use database `max_score` instead of hardcoded 100

3. **lambda/functions/content-analyzer/index.js** (lines 53-55)
   - Same as scoring agent

---

## Recommended Approach

### Option A: Prefer criteria_text (Recommended)

```javascript
// In db-utils.js
const query = `
  SELECT
    criteria_id AS criterion_id,
    overlay_id,
    name,
    description,
    criteria_text,     -- ADD THIS
    criterion_type,
    weight,
    max_score,         -- ADD THIS
    is_required,
    display_order,
    validation_rules
  FROM evaluation_criteria
  WHERE overlay_id = $1
  ORDER BY display_order, name
`;

return result.rows.map(row => ({
  ...row,
  category: row.criterion_type || 'general',
  max_score: row.max_score || row.weight || 100,  // Use DB first
  evaluation_method: 'ai_analysis',
}));
```

```javascript
// In scoring/index.js and content-analyzer/index.js
const criteriaText = criteria.map(c => {
  // Prefer criteria_text (detailed rubric), fallback to description
  const details = c.criteria_text || c.description || 'No criteria provided';
  return `- ${c.name} (${c.category}): ${details} [Max: ${c.max_score}, Weight: ${c.weight}]`;
}).join('\n');
```

**Benefits:**
- Allows users to add detailed rubrics
- Falls back to description if criteria_text is NULL
- Works for both old and new criteria
- Edit Criteria feature works as intended

---

## Testing Plan (After Fix)

1. **Test: No criteria_text (current state)**
   - AI should use description (fallback)
   - Existing behavior preserved ✅

2. **Test: Edit criteria_text**
   - Edit via Edit Criteria page
   - Submit new document
   - AI should use NEW criteria_text (not description) ✅

3. **Test: Edit max_score**
   - Set max_score to 150
   - Submit new document
   - AI should show "Max: 150" (not 100) ✅

---

## Conclusion

**Current State:**
- AI evaluations work using `description` field ✅
- Edit Criteria feature saves to `criteria_text` field ✅
- **AI agents don't use `criteria_text`** ❌
- **Feature appears to work but doesn't** ❌

**After Fix:**
- AI agents will fetch `criteria_text` and `max_score` ✅
- AI agents will prefer `criteria_text` over `description` ✅
- Edit Criteria feature will actually affect AI evaluations ✅
- Users' rubric customizations will be used ✅

**Priority:** HIGH - Feature is broken but not yet discovered by users

**Estimated Fix Time:** 30 minutes coding + 10 minutes deployment + 20 minutes testing

---

**Report Date:** 2026-02-01
**Verified By:** Claude Sonnet 4.5
**Status:** Ready to proceed with fix

