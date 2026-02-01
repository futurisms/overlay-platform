# URGENT: criteria_text Column Missing - Immediate Fix Required

**Date:** 2026-02-01
**Severity:** CRITICAL - Production Breaking
**Status:** Backend queries non-existent column

---

## The Problem

**Backend error:** `column "criteria_text" does not exist`

**Root cause:**
- Backend code (commit b1bd519) queries `criteria_text` column in line 60
- Migration 008 shows it ran successfully (7 statements, 0 errors)
- BUT: Column doesn't actually exist in production database

**Why this happened:**
- Migration Lambda says it ran migration 008
- But the column wasn't actually created in the database
- Possible causes:
  - Migration ran on wrong database instance
  - Transaction rolled back
  - Migration Lambda has stale code

---

## Immediate Fix: Rollback Backend Code

**We MUST rollback the backend code that references criteria_text**

### Quick Rollback Steps

```bash
# 1. Revert backend commits that reference criteria_text
git revert b1bd519  # Field name consistency fix
git revert d7d38a9  # UPDATE fix

# 2. Redeploy backend WITHOUT criteria_text reference
cdk deploy OverlayComputeStack --require-approval never

# 3. Verify API works again
curl -k "https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays/[id]"
```

**This will:**
- ✅ Stop querying criteria_text column (fixes the error)
- ✅ Restore backend to working state
- ❌ Revert to DELETE+INSERT (foreign key bug returns)
- ❌ Use criterion_id field name (inconsistent)

---

## Migration Status

**From Lambda response:**
```json
{
  "fileName": "008_add_criteria_details.sql",
  "successCount": 7,
  "errorCount": 0,
  "errors": []
}
```

**What this means:**
- ✅ Migration Lambda executed 7 SQL statements
- ✅ No errors reported
- ❓ BUT column doesn't exist - why?

---

## Why Column Doesn't Exist (Theories)

### Theory 1: Wrong Database Connection
- Migration Lambda connected to different RDS instance
- API Lambda connects to correct instance without the column
- Check: Verify both Lambdas use same SECRET_ARN and DB_ENDPOINT

### Theory 2: Transaction Rollback
- Migration ran but transaction was rolled back
- Error not caught or reported
- Check: Lambda logs for rollback messages

### Theory 3: Stale Migration Lambda Code
- Migration Lambda doesn't have migration 008 in its package
- Reported success but didn't actually run ALTER TABLE
- Check: Redeploy migration Lambda with latest code

### Theory 4: IF NOT EXISTS Logic
- Column was created but then dropped
- Or created in wrong schema
- Check: `SELECT * FROM pg_catalog.pg_tables WHERE tablename = 'evaluation_criteria';`

---

## Verification Queries (Need to Run)

**After rollback, verify actual schema:**

```sql
-- Check if column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'evaluation_criteria'
  AND column_name IN ('criteria_text', 'max_score');

-- Expected: 0 rows if column doesn't exist

-- Check all columns
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'evaluation_criteria'
ORDER BY ordinal_position;

-- Expected: Should list all columns (without criteria_text)
```

---

## After Rollback: Proper Migration

**Once backend is rolled back and working:**

1. **Verify migration 008 is in Lambda package:**
   ```bash
   aws lambda get-function --function-name overlay-database-migration
   # Check if migration 008 file is included
   ```

2. **Manually verify database before migration:**
   ```sql
   -- Run BEFORE migration
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'evaluation_criteria'
     AND column_name = 'criteria_text';
   -- Should return 0 rows
   ```

3. **Run migration with logging:**
   ```bash
   aws lambda invoke \
     --function-name overlay-database-migration \
     --log-type Tail \
     --query 'LogResult' \
     --output text \
     response.json | base64 -d
   ```

4. **Verify column exists after migration:**
   ```sql
   -- Run AFTER migration
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'evaluation_criteria'
     AND column_name = 'criteria_text';
   -- Should return 1 row
   ```

5. **Then redeploy backend with criteria_text:**
   ```bash
   git checkout master
   cdk deploy OverlayComputeStack --require-approval never
   ```

---

## Current Backend Code That's Breaking

**File:** `lambda/functions/api/overlays/index.js` lines 59-60

```javascript
const criteriaQuery = `
  SELECT criteria_id, name, description, criterion_type, weight,
         is_required, display_order, validation_rules, criteria_text, max_score
         ^^^^^^^^^^^^^^^^ ^^^^^^^^^ These columns don't exist!
  FROM evaluation_criteria
  WHERE overlay_id = $1
  ORDER BY display_order, name
`;
```

**Error when executed:**
```
ERROR: column "criteria_text" does not exist
```

---

## Rollback Command (EXECUTE NOW)

```bash
# Revert both commits
git revert --no-edit b1bd519 d7d38a9

# Deploy immediately
cdk deploy OverlayComputeStack --require-approval never
```

**Time to fix:** 5 minutes
**Priority:** URGENT - Production is broken

---

## After Rollback Status

**What will work:**
- ✅ GET /overlays/{id} - Will return criteria
- ✅ Session pages will display criteria
- ✅ No more "column doesn't exist" error

**What won't work:**
- ❌ Edit Criteria save (foreign key error returns)
- ❌ Field name inconsistency (criterion_id vs criteria_id)

**But at least production is functional again.**

---

**Next step:** ROLLBACK NOW, investigate migration issue later.

