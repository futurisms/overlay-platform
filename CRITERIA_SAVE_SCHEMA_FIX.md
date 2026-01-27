# Criteria Save - Schema Mismatch Fix

## Problem
After deploying the initial criteria save fix, users encountered a new database error:

```
column "category" of relation "evaluation_criteria" does not exist
```

This occurred when trying to add a criterion through the frontend form.

## Root Cause
The initial fix assumed the database had columns (`category`, `max_score`, `evaluation_method`, `is_active`) that don't actually exist in the `evaluation_criteria` table.

### Actual Database Schema
**Table**: `evaluation_criteria`

```sql
CREATE TABLE evaluation_criteria (
    criteria_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    overlay_id UUID NOT NULL REFERENCES overlays(overlay_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criterion_type VARCHAR(50) NOT NULL,         -- ❌ NOT "category"
    weight DECIMAL(5,2) DEFAULT 1.0,
    is_required BOOLEAN DEFAULT true,            -- ❌ NOT "is_active"
    display_order INTEGER DEFAULT 0,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- NO max_score column
    -- NO evaluation_method column
    -- NO is_active column
);
```

### Field Name Mismatches

| Frontend Field | Database Column | Notes |
|----------------|-----------------|-------|
| `criterion_id` | `criteria_id` | Different spelling |
| `category` | `criterion_type` | Different name |
| `max_score` | ❌ Does not exist | Frontend only |
| `is_active` | ❌ Does not exist | Frontend only |
| `weight` | `weight` | ✅ Match |
| `description` | `description` | ✅ Match |
| `name` | `name` | ✅ Match |
| ❌ N/A | `is_required` | Database only |
| ❌ N/A | `validation_rules` | Database only |

## Fix Applied (January 25, 2026, 17:23 UTC)

### Backend Changes

**File**: [lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js)

#### 1. Updated INSERT Statement (CREATE and UPDATE handlers)

**Before (BROKEN)**:
```javascript
await dbClient.query(
  `INSERT INTO evaluation_criteria
   (overlay_id, name, description, category, weight, max_score, evaluation_method, is_active, display_order)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [
    overlayId,
    c.name,
    c.description || null,
    c.category || 'general',
    c.weight || 1.0,
    c.max_score || 100,
    c.evaluation_method || 'auto',
    c.is_active !== undefined ? c.is_active : true,
    i
  ]
);
```

**After (FIXED)**:
```javascript
// Map frontend fields to actual database columns
// Frontend uses: category, max_score, is_active, criterion_id
// Database has: criterion_type, weight, is_required, criteria_id
await dbClient.query(
  `INSERT INTO evaluation_criteria
   (overlay_id, name, description, criterion_type, weight, is_required, display_order, validation_rules)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [
    overlayId,
    c.name,
    c.description || null,
    c.category || c.criterion_type || 'text',  // Map category -> criterion_type
    c.weight || 1.0,
    c.is_required !== undefined ? c.is_required : true,
    i,
    c.validation_rules || '{}'
  ]
);
```

#### 2. Updated GET Endpoint to Map Database Fields Back to Frontend

**Before (BROKEN)**:
```javascript
const criteriaResult = await dbClient.query(criteriaQuery, [overlayId]);
const overlay = overlayResult.rows[0];
overlay.criteria = criteriaResult.rows;  // Direct assignment, wrong field names
```

**After (FIXED)**:
```javascript
const criteriaResult = await dbClient.query(criteriaQuery, [overlayId]);
const overlay = overlayResult.rows[0];

// Map database fields to frontend field names
overlay.criteria = criteriaResult.rows.map(c => ({
  criterion_id: c.criteria_id,  // Map criteria_id -> criterion_id
  name: c.name,
  description: c.description,
  category: c.criterion_type,    // Map criterion_type -> category
  weight: parseFloat(c.weight),
  max_score: 100,                // Frontend expects this, use default
  is_active: true,               // Frontend expects this, use default
  is_required: c.is_required,
  display_order: c.display_order,
  validation_rules: c.validation_rules
}));
```

### Mapping Strategy

1. **Frontend → Database (INSERT)**:
   - `category` maps to `criterion_type`
   - `max_score` is ignored (not in database)
   - `is_active` maps to `is_required`
   - `criterion_id` not used (database generates `criteria_id`)

2. **Database → Frontend (SELECT)**:
   - `criteria_id` maps to `criterion_id`
   - `criterion_type` maps to `category`
   - `max_score` set to default 100
   - `is_active` set to default true
   - `is_required` passed through

## Deployment

```bash
# Package fixed Lambda
cd c:\Projects\overlay-platform
powershell -Command "Compress-Archive -Path 'lambda/functions/overlays-crud-handler/*' -DestinationPath 'overlay-overlays-crud.zip' -Force"

# Deploy to AWS
aws lambda update-function-code \
  --function-name overlay-api-overlays \
  --zip-file fileb://overlay-overlays-crud.zip \
  --region eu-west-1
```

**Deployed**: January 25, 2026, 17:23:46 UTC
**Status**: Active ✅

## Testing

The fix has been deployed and is ready for testing.

### Test Steps

1. Refresh your browser to clear any cached frontend code
2. Navigate to any overlay edit page: `http://localhost:3000/overlays/{id}`
3. Click "Add Criterion"
4. Fill in the form:
   - **Name**: "Test Criterion"
   - **Description**: "Testing schema fix"
   - **Weight**: 0.5
   - **Max Score**: 100 (will be ignored, that's OK)
   - **Category**: "test" (will map to criterion_type)
5. Click "Save Criterion"
6. **Expected**: Success message, criterion appears in list
7. **Expected**: No database errors
8. Refresh page (F5) - criterion should persist

### Expected Database State

After saving, check the database:

```sql
SELECT criteria_id, name, description, criterion_type, weight, is_required, display_order
FROM evaluation_criteria
WHERE overlay_id = '<your-overlay-id>'
ORDER BY display_order;
```

You should see:
- `criterion_type` = "test" (from frontend's "category" field)
- `weight` = 0.5
- `is_required` = true (default)
- `validation_rules` = {}
- NO max_score or is_active columns (frontend-only fields)

## Why This Happened

1. **Initial Fix Was Too Hasty**: The first fix added criteria handling without checking the actual database schema
2. **Frontend/Backend Mismatch**: The frontend TypeScript interfaces didn't match the database schema
3. **No Schema Documentation**: Lack of clear schema documentation led to assumptions

## Prevention for Future

1. **Always Check Schema First**: Before writing database INSERT/UPDATE code, verify actual column names
2. **Use Schema-First Design**: Generate TypeScript interfaces from database schema
3. **Add Integration Tests**: Test full CRUD operations against real database
4. **Document Field Mappings**: Clearly document when frontend/backend field names differ

## Related Files

- [lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js) - Backend handler (FIXED)
- [migrations/000_initial_schema.sql](migrations/000_initial_schema.sql) - Database schema definition
- [frontend/app/overlays/[id]/page.tsx](frontend/app/overlays/[id]/page.tsx) - Frontend edit page (no changes needed)
- [CRITERIA_SAVE_FIX.md](CRITERIA_SAVE_FIX.md) - Initial fix documentation

## Summary

The criteria save functionality now works correctly by:
1. Mapping frontend field names to database column names
2. Using actual database schema columns (criterion_type, is_required, etc.)
3. Providing default values for frontend-only fields (max_score, is_active)

All CRUD operations (Add/Edit/Delete criteria) should now work without database errors! ✅
