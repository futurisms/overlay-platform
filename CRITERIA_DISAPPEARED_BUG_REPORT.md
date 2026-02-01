# Bug Report: Evaluation Criteria Disappeared from Session Pages

**Date:** 2026-02-01
**Severity:** HIGH - Feature Breaking
**Status:** Root cause identified

---

## Summary

Evaluation criteria disappeared from session detail pages after commit b1bd519 which changed the API field name from `criterion_id` to `criteria_id`. The backend change was correct, but frontend pages were not updated to match.

---

## Root Cause

### The Change (Commit b1bd519)

**File:** `lambda/functions/api/overlays/index.js` line 70

**Before:**
```javascript
overlay.criteria = criteriaResult.rows.map(c => ({
  criterion_id: c.criteria_id,  // Map criteria_id to criterion_id
  ...
}));
```

**After:**
```javascript
overlay.criteria = criteriaResult.rows.map(c => ({
  criteria_id: c.criteria_id,    // Use consistent criteria_id field name
  ...
}));
```

**Why we made this change:**
- To fix the Edit Criteria save bug
- Frontend Edit Criteria page expects `criteria_id`
- Database column is `criteria_id`
- Using consistent naming across API

### The Problem

**Two frontend pages still expect the OLD field name:**

1. **Session Detail Page:** `frontend/app/session/[id]/page.tsx` line 510
   ```typescript
   {overlay.criteria.map((criterion: any, index: number) => (
     <div key={criterion.criterion_id || index}  // ← Looking for criterion_id
   ```

2. **Overlay Management Page:** `frontend/app/overlays/[id]/page.tsx` line 17
   ```typescript
   interface Criterion {
     criterion_id: string;  // ← Expecting criterion_id
     name: string;
     ...
   }
   ```

### What Happens Now

1. **API returns:**
   ```json
   {
     "criteria": [
       {
         "criteria_id": "abc-123",  // ← New field name
         "name": "Question 1",
         ...
       }
     ]
   }
   ```

2. **Session page looks for:**
   ```typescript
   criterion.criterion_id  // ← undefined!
   ```

3. **React rendering:**
   - Can't find `criterion_id` field
   - Falls back to using `index` as key: `key={criterion.criterion_id || index}`
   - But `criterion_id` is undefined, so always uses index
   - React may not properly render the list or criteria appear broken

---

## Impact Analysis

### Pages Affected

1. ✅ **Edit Criteria Page** - `frontend/app/overlays/[id]/edit-criteria/page.tsx`
   - **Status:** WORKING
   - Uses `criteria_id` (correct, matches new API)

2. ❌ **Session Detail Page** - `frontend/app/session/[id]/page.tsx`
   - **Status:** BROKEN
   - Uses `criterion_id` (old field name, doesn't match API)
   - Criteria may not display or render incorrectly

3. ❌ **Overlay Management Page** - `frontend/app/overlays/[id]/page.tsx`
   - **Status:** BROKEN
   - Uses `criterion_id` (old field name, doesn't match API)
   - Edit/delete criteria functions may fail

### User-Visible Symptoms

- ✅ Edit Criteria page works (save succeeds)
- ❌ Session detail page doesn't show criteria
- ❌ Overlay management page doesn't show criteria properly
- ❌ Can't edit/delete criteria from overlay management page

---

## Files Requiring Updates

### File 1: Session Detail Page

**File:** `frontend/app/session/[id]/page.tsx`

**Line 510:** Change React key
```typescript
// BEFORE:
key={criterion.criterion_id || index}

// AFTER:
key={criterion.criteria_id || index}
```

No other changes needed (other fields like `name`, `description`, `weight` are fine).

---

### File 2: Overlay Management Page

**File:** `frontend/app/overlays/[id]/page.tsx`

**Multiple locations need updating:**

**Line 17:** Update interface
```typescript
// BEFORE:
interface Criterion {
  criterion_id: string;
  ...
}

// AFTER:
interface Criterion {
  criteria_id: string;  // Changed to match API
  ...
}
```

**Line 116:** Update temp ID assignment
```typescript
// BEFORE:
criterion_id: `temp-${Date.now()}`,

// AFTER:
criteria_id: `temp-${Date.now()}`,
```

**Line 146:** Update edit handler
```typescript
// BEFORE:
setEditingId(criterion.criterion_id);

// AFTER:
setEditingId(criterion.criteria_id);
```

**Line 170:** Update map comparison
```typescript
// BEFORE:
c.criterion_id === criterionId ? { ...c, ...editForm } : c

// AFTER:
c.criteria_id === criterionId ? { ...c, ...editForm } : c
```

**Line 200:** Update filter comparison
```typescript
// BEFORE:
criteria.filter((c) => c.criterion_id !== criterionId);

// AFTER:
criteria.filter((c) => c.criteria_id !== criterionId);
```

**Line 432:** Update React key
```typescript
// BEFORE:
<Card key={criterion.criterion_id}>

// AFTER:
<Card key={criterion.criteria_id}>
```

**Line 433:** Update editing comparison
```typescript
// BEFORE:
{editingId === criterion.criterion_id ? (

// AFTER:
{editingId === criterion.criteria_id ? (
```

**Line 493:** Update save handler
```typescript
// BEFORE:
onClick={() => handleSaveEdit(criterion.criterion_id)}

// AFTER:
onClick={() => handleSaveEdit(criterion.criteria_id)}
```

**Line 540:** Update delete handler
```typescript
// BEFORE:
onClick={() => handleDeleteCriterion(criterion.criterion_id)}

// AFTER:
onClick={() => handleDeleteCriterion(criterion.criteria_id)}
```

---

## Why This Happened

1. **Split development:**
   - Edit Criteria page built expecting `criteria_id` (new standard)
   - Session/Overlay pages built before standardization using `criterion_id`

2. **Backend fix didn't update all frontend:**
   - We fixed the backend to use consistent `criteria_id`
   - We updated Edit Criteria page (already used `criteria_id`)
   - We FORGOT to update Session page and Overlay management page

3. **No TypeScript compilation errors:**
   - Session page uses `any` type: `criterion: any` (line 508)
   - TypeScript can't catch field name mismatches with `any`

---

## Testing Checklist (After Fix)

1. **Session Detail Page:**
   - [ ] Navigate to session detail page
   - [ ] Verify "Evaluation Criteria" section displays criteria
   - [ ] Verify each criterion shows name, description, weight, max_score
   - [ ] No console errors

2. **Overlay Management Page:**
   - [ ] Navigate to overlay detail page
   - [ ] Verify criteria list displays
   - [ ] Click "Edit" on a criterion → Verify edit form appears
   - [ ] Make changes and save → Verify saves successfully
   - [ ] Click "Delete" on a criterion → Verify deletion works
   - [ ] No console errors

3. **Edit Criteria Page:**
   - [ ] Verify page still works (shouldn't be affected)
   - [ ] Edit and save → Verify success message
   - [ ] No regression

---

## Recommended Fix Order

1. **Fix frontend files first** (Session + Overlay pages)
2. **Test locally** with dev server
3. **Commit changes** with message: "fix(frontend): Update criterion_id references to criteria_id to match API"
4. **Verify in production**

---

## Prevention for Future

1. **Use TypeScript interfaces instead of `any`:**
   ```typescript
   // GOOD:
   interface Criterion {
     criteria_id: string;
     name: string;
     ...
   }

   // BAD:
   criterion: any
   ```

2. **Shared type definitions:**
   - Create `frontend/lib/types.ts` with shared interfaces
   - Import in all pages using overlays/criteria

3. **API contract testing:**
   - Add test that verifies API response matches frontend expectations
   - Catches field name mismatches before deployment

---

## Files to Modify

### Frontend Changes (Required):
1. ✅ `frontend/app/session/[id]/page.tsx` - 1 line change
2. ✅ `frontend/app/overlays/[id]/page.tsx` - 9 lines changed (interface + 8 references)

### No Backend Changes Needed:
- Backend is correct (uses `criteria_id`)
- Edit Criteria page is correct (uses `criteria_id`)

---

**Status:** Ready for fix implementation
**Estimated Fix Time:** 10 minutes
**Risk Level:** LOW (simple find/replace)

