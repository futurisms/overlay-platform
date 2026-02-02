# Criteria Field Usage Analysis - Database State Report

**Date:** 2026-02-01
**Analysis:** criteria_text vs description field usage
**Database:** overlay-db-edit-criteria-20260201-evening

---

## Executive Summary

**Finding:** The `criteria_text` column is **brand new** and **completely unused**
**Data State:** All 1,622 criteria have NULL `criteria_text`, all use `description`
**Recommendation:** **Keep current dual-field system** - no rollback needed

---

## Step 1: Database Query Results

### Criteria Count Summary

```
Total criteria in database: 1,622
├── With criteria_text (NOT NULL): 0 (0%)
└── Without criteria_text (NULL): 1,622 (100%)

Field usage breakdown:
├── Using description field: 1,622 (100%)
├── Using criteria_text field: 0 (0%)
└── Has both fields: 0 (0%)
```

**Conclusion:** `criteria_text` is completely unused - all NULL values

---

## Step 2: Sample Data Analysis

### Seed Data Pattern

All 1,622 criteria were created via seed data files:
- `001_seed_data.sql` - Initial criteria with `description` field
- Seed data format:
  ```sql
  INSERT INTO evaluation_criteria
    (overlay_id, name, description, criterion_type, weight, ...)
  VALUES
    ('uuid', 'Party Identification', 'Verify all parties are correctly identified', ...),
    ('uuid', 'Effective Date', 'Contract effective date', ...),
    ...
  ```

### Current Field State

**description field:**
- Populated: 1,622 criteria (100%)
- Source: Seed data SQL files
- Content: Short descriptions like "Verify all parties are correctly identified"
- Used by: Frontend display, AI agents (via fallback)

**criteria_text field:**
- Populated: 0 criteria (0%)
- Source: User edits (none yet)
- Content: All NULL
- Used by: AI agents (primary), but falls back to description

### Sample Criteria (Top 5)

```
1. Party Identification
   description: "Verify all parties are correctly identified"
   criteria_text: NULL
   Primary field: description

2. Effective Date
   description: "Contract effective date"
   criteria_text: NULL
   Primary field: description

3. Contract Value
   description: "Total contract value and payment terms"
   criteria_text: NULL
   Primary field: description

4. Termination Clause
   description: "Terms for contract termination"
   criteria_text: NULL
   Primary field: description

5. Liability Limitations
   description: "Liability and indemnification provisions"
   criteria_text: NULL
   Primary field: description
```

---

## Step 3: Impact Analysis

### Current System Architecture

**Today's deployment (v1.7):**
1. Migration 008 added `criteria_text` column (deployed today)
2. AI agents updated to read `criteria_text || description` (deployed today)
3. Edit Criteria UI updates `criteria_text` field (deployed today)
4. Frontend displays `description` field (unchanged)

**Data flow:**
```
User views criteria → Frontend shows description
User edits criteria → Backend writes to criteria_text
AI analyzes doc → Agents read (criteria_text || description)
                  ↓
                  Reads description (criteria_text is NULL)
```

### Impact of Simplification (if we chose Option B)

**If we simplified to description-only:**

1. **Data loss:** NONE
   - criteria_text is all NULL
   - No user edits would be lost

2. **Code changes needed:**
   - Rollback migration 008 (drop column, drop index)
   - Update 3 files to remove fallback logic:
     - `db-utils.js` (remove criteria_text from SELECT)
     - `scoring/index.js` (use description directly)
     - `content-analyzer/index.js` (use description directly)
   - Update Edit Criteria UI to write to description
   - Re-deploy OverlayOrchestrationStack

3. **Frontend changes:**
   - Edit Criteria page: Change field from criteria_text to description
   - Session page: Already uses description (no change)
   - Overlay page: Already uses description (no change)

4. **Migration needed:**
   ```sql
   -- Drop GIN index
   DROP INDEX IF EXISTS idx_evaluation_criteria_criteria_text_gin;

   -- Drop column
   ALTER TABLE evaluation_criteria DROP COLUMN IF EXISTS criteria_text;
   ```

5. **Estimated effort:**
   - Migration: 5 minutes
   - Code changes: 20 minutes
   - Testing: 15 minutes
   - Deployment: 5 minutes
   - **Total: 45 minutes**

---

## Step 4: Recommendation

### Context

**Timeline:**
- February 1, 2026 (today):
  - 8:00 AM: Started debugging session
  - 10:15 AM: Fixed migration 008 issue
  - 4:00 PM: Deployed Edit Criteria feature
  - 9:00 PM: Created database snapshot

**Current state:**
- Migration 008: Successfully applied (criteria_text column exists)
- Edit Criteria: Fully deployed and functional
- AI agents: Using fallback logic (criteria_text || description)
- Database: All criteria_text values are NULL
- Production usage: Zero (feature deployed today)

### Option A: Keep Dual-Field System (RECOMMENDED)

**Rationale:**
1. **Already working** - System tested and deployed
2. **No rollback churn** - Avoid undoing today's work
3. **Future flexibility** - Can simplify later if needed
4. **Clear semantics** - criteria_text is "user edited", description is "seed data"

**Pros:**
- ✅ Zero additional work required
- ✅ Already tested and verified
- ✅ No risk of regression
- ✅ Preserves today's successful deployment
- ✅ Clear separation between seed and edited criteria
- ✅ Fallback logic provides safety net

**Cons:**
- ⚠️ More complex (two fields instead of one)
- ⚠️ Requires documentation of field hierarchy
- ⚠️ AI agents have fallback logic overhead

**Actions needed:**
1. Document field hierarchy in CLAUDE.md
2. Add comment to Edit Criteria UI explaining which field is edited
3. Monitor usage over next week
4. Re-evaluate in 1 month if simplification makes sense

### Option B: Simplify to Description-Only

**Rationale:**
1. **Simpler architecture** - One field, one source of truth
2. **No data loss** - criteria_text is all NULL
3. **Cleaner code** - No fallback logic needed
4. **Standard pattern** - Most systems use single field

**Pros:**
- ✅ Simpler code (no fallback logic)
- ✅ Single source of truth
- ✅ Easier to understand and maintain
- ✅ No data loss (all NULL)

**Cons:**
- ❌ Requires rolling back fresh deployment
- ❌ 45 minutes of additional work
- ❌ Need to test rollback migration
- ❌ Risk of introducing regression
- ❌ Loses semantic distinction between seed and edited
- ❌ Edit Criteria would overwrite seed descriptions

**Actions needed:**
1. Create rollback migration (drop column and index)
2. Update 3 backend files (remove criteria_text)
3. Update Edit Criteria UI (write to description)
4. Deploy and test
5. Create new database snapshot

### Option C: Hybrid Approach

**Keep dual-field but clarify semantics:**
1. Rename `criteria_text` → `custom_criteria_text`
2. Document: "Custom text overrides seed description"
3. Update UI label: "Custom Evaluation Text (optional)"
4. Keep fallback logic

**Pros:**
- ✅ Clearer field purpose
- ✅ No architectural change
- ✅ Better UX (users know it's optional)

**Cons:**
- ⚠️ Requires column rename (more work than Option A)
- ⚠️ Still has dual-field complexity

---

## Final Recommendation

### ✅ **RECOMMENDED: Keep Current Dual-Field System (Option A)**

**Reasoning:**

1. **System is working** - Edit Criteria feature deployed successfully today
2. **Zero data loss** - No user edits exist yet (all NULL)
3. **No rollback needed** - Avoid undoing today's deployment
4. **Low risk** - System already tested and verified
5. **Future flexibility** - Can simplify later if usage patterns show it's unnecessary

**But we should:**

1. **Document the field hierarchy clearly**
2. **Add inline comments** explaining which field is used when
3. **Monitor usage** for 1-2 weeks
4. **Re-evaluate** after seeing real usage patterns

**If after 2 weeks:**
- criteria_text remains mostly NULL → Consider simplification
- criteria_text is widely used → Validate current architecture
- Users confused by dual fields → Add better UI labels

---

## Documentation Updates Needed

### 1. CLAUDE.md

Add section:
```markdown
## Evaluation Criteria Fields

**Two-Field System:**
- `description` (TEXT) - Seed data descriptions, displayed in UI
- `criteria_text` (TEXT) - User-edited evaluation text for AI agents

**Field Hierarchy:**
1. AI agents read: `criteria_text || description` (prefer edited text)
2. Frontend displays: `description` (always shows seed description)
3. Edit Criteria writes to: `criteria_text` (preserves seed data)

**Why two fields?**
- Preserves original seed descriptions for reference
- Allows users to customize AI evaluation criteria
- Fallback ensures AI always has text to work with
```

### 2. Edit Criteria UI

Add help text:
```typescript
<Label>Criteria Text (for AI Evaluation)</Label>
<Textarea ... />
<p className="text-xs text-slate-500">
  Customize how AI agents evaluate this criterion. Leave empty to use default description.
</p>
```

### 3. Code Comments

Add comments to fallback logic:
```javascript
// Prefer user-edited criteria_text, fall back to seed description
const criteriaText = criteria.map(c =>
  `- ${c.name}: ${c.criteria_text || c.description}`  // User edit || seed data
).join('\n');
```

---

## Monitoring Plan

### Week 1 (Feb 2-8)
- Count: How many criteria have criteria_text populated?
- Pattern: Which overlays are being edited?
- Usage: Are users editing criteria or leaving defaults?

### Week 2 (Feb 9-15)
- Review: Is dual-field system causing confusion?
- Feedback: Are users asking about which field to edit?
- Decision: Keep or simplify?

### Query for Monitoring

```sql
-- Run weekly to check criteria_text adoption
SELECT
  COUNT(*) as total_criteria,
  COUNT(CASE WHEN criteria_text IS NOT NULL THEN 1 END) as edited_criteria,
  ROUND(100.0 * COUNT(CASE WHEN criteria_text IS NOT NULL THEN 1 END) / COUNT(*), 2) as percent_edited
FROM evaluation_criteria;
```

---

## Summary

| Aspect | Current State | Recommendation |
|--------|---------------|----------------|
| criteria_text usage | 0% (all NULL) | Keep monitoring |
| System complexity | Dual-field with fallback | Acceptable for now |
| Data loss risk | None (no edits yet) | N/A |
| Rollback needed | No | Keep current system |
| Action required | Documentation only | Low effort |
| Re-evaluation date | Feb 15, 2026 | 2 weeks from now |

**Decision:** **Keep current dual-field system**
**Effort:** Documentation only (30 minutes)
**Risk:** Very low
**Flexibility:** Can simplify later if needed

---

**Analysis Complete ✅**

**Next Steps:**
1. Update CLAUDE.md with field hierarchy
2. Add help text to Edit Criteria UI
3. Monitor usage for 2 weeks
4. Re-evaluate on Feb 15, 2026

---

**END OF ANALYSIS**
