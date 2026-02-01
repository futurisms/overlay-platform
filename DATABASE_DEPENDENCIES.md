# DATABASE DEPENDENCIES ANALYSIS
**Generated:** 2026-02-01 08:20 UTC
**Purpose:** Map database schema vs Lambda function expectations
**Status:** Pre-deployment analysis (NO CHANGES YET)

---

## EXECUTIVE SUMMARY

**Current State:**
- Database: Migration 006 applied
- Missing: Migrations 007 (token tracking) and 008 (criteria enhancements)
- **CRITICAL**: 2 Lambda functions expect columns that don't exist

**Schema Mismatches Identified:**
| Missing Column | Table | Expected By | Severity |
|---------------|-------|-------------|----------|
| `criteria_text` | evaluation_criteria | api/overlays handler | CRITICAL |
| `max_score` | evaluation_criteria | api/overlays handler | CRITICAL |
| `input_tokens` | feedback_reports | (none - migration 007 not used) | LOW |
| `output_tokens` | feedback_reports | (none - migration 007 not used) | LOW |
| `model_used` | feedback_reports | (none - migration 007 not used) | LOW |

---

## SCHEMA EVOLUTION TIMELINE

### Migration 000: Initial Schema (Jan 19, 2026)
**Status:** ✅ Applied

**Core Tables Created:**
- `organizations` - Tenant/organization management
- `users` - User accounts
- `user_roles` - Role-based access control
- `overlays` - Document review configurations
- `evaluation_criteria` - Scoring criteria for documents
- `review_sessions` - Review workflow sessions
- `document_submissions` - Submitted documents
- `evaluation_responses` - Criterion scores/responses
- `feedback_reports` - AI-generated feedback
- `llm_configurations` - AI model settings
- And more...

**evaluation_criteria schema (base):**
```sql
CREATE TABLE evaluation_criteria (
    criteria_id UUID PRIMARY KEY,
    overlay_id UUID REFERENCES overlays,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criterion_type VARCHAR(50) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 1.0,
    is_required BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    validation_rules JSONB DEFAULT '{}'
);
```

**feedback_reports schema (base):**
```sql
CREATE TABLE feedback_reports (
    report_id UUID PRIMARY KEY,
    submission_id UUID REFERENCES document_submissions,
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(500),
    content TEXT NOT NULL,
    severity VARCHAR(20),
    created_at TIMESTAMPTZ
);
```

---

### Migration 001: Seed Data (Jan 19, 2026)
**Status:** ✅ Applied (with expected duplicate key conflicts)
- Seeds initial organization, admin user, test data

---

### Migration 002: Add Review Sessions (Jan 20, 2026)
**Status:** ✅ Applied
- Enhanced review_sessions table structure

---

### Migration 003: Add Test User (Jan 20, 2026)
**Status:** ✅ Applied
- Added test user account

---

### Migration 004: Add Overlay Context Fields (Jan 22, 2026)
**Status:** ✅ Applied
- Added context fields to overlays table:
  - `document_purpose`
  - `when_used`
  - `process_context`
  - `target_audience`

---

### Migration 005: Add Appendix Support (Jan 23, 2026)
**Status:** ✅ Applied
- Added `appendix_files` JSONB column to document_submissions

---

### Migration 006: Add User Notes (Jan 29, 2026)
**Status:** ✅ Applied (CURRENT DATABASE STATE)
- Created `user_notes` table for note-taking feature
- Full CRUD support for notes

**Current Database State:** Migrations 000-006

---

### Migration 007: Token Tracking (Jan 31, 2026)
**Status:** ⚠️ NOT APPLIED (exists in Lambda but rolled back)

**Would Add:**
```sql
ALTER TABLE feedback_reports
ADD COLUMN input_tokens INTEGER DEFAULT 0,
ADD COLUMN output_tokens INTEGER DEFAULT 0,
ADD COLUMN model_used VARCHAR(100);

CREATE TABLE ai_token_usage (...);
CREATE TABLE organization_credits (...);
```

**Impact:** Low - No Lambda functions currently use these columns

---

### Migration 008: Criteria Enhancements (NOT CREATED YET)
**Status:** ❌ MISSING - MUST BE CREATED

**Must Add:**
```sql
ALTER TABLE evaluation_criteria
ADD COLUMN criteria_text TEXT,
ADD COLUMN max_score INTEGER;

CREATE INDEX idx_evaluation_criteria_criteria_text_gin
ON evaluation_criteria USING gin(to_tsvector('english', criteria_text));
```

**Impact:** CRITICAL - Required for Edit Criteria feature

---

## LAMBDA FUNCTION DATABASE DEPENDENCIES

### CRITICAL: Functions with Schema Mismatches

#### 1. lambda/functions/api/overlays/index.js
**Status:** ⚠️ SCHEMA MISMATCH - WILL FAIL

**Table:** evaluation_criteria
**Operations:** SELECT, INSERT, DELETE

**Missing Columns Referenced:**
| Line | Operation | Column | Context |
|------|-----------|--------|---------|
| 60 | SELECT | `criteria_text` | GET overlay criteria query |
| 60 | SELECT | `max_score` | GET overlay criteria query |
| 75 | RESPONSE | `max_score` | Map to response object |
| 80 | RESPONSE | `criteria_text` | Map to response object |
| 207 | INSERT | `criteria_text` | Save criteria in handleUpdate |
| 207 | INSERT | `max_score` | Save criteria in handleUpdate |
| 218 | INSERT VALUE | `criteria_text` | Insert criteria value |
| 219 | INSERT VALUE | `max_score` | Insert criteria value |

**Functions Affected:**
- `handleGet()` - GET /overlays/{id} - Will fail on SELECT
- `handleUpdate()` - PUT /overlays/{id} - Will fail on INSERT

**Error Expected:**
```
ERROR: column "criteria_text" does not exist
ERROR: column "max_score" does not exist
```

**User Impact:**
- ❌ Cannot view overlay details (GET fails)
- ❌ Cannot edit criteria (PUT fails)
- ✅ Can create new overlays (POST doesn't use these columns yet)
- ✅ Can delete overlays (DELETE doesn't use these columns)

---

#### 2. lambda/layers/common/nodejs/db-utils.js
**Status:** ⚠️ MINOR ISSUE

**Table:** evaluation_criteria
**Operation:** Default value mapping

**Reference:**
- Line 110: `max_score: 100` (default value in response mapping)

**Impact:** Low - Only provides default value, doesn't query database

---

### Safe Functions (No Schema Mismatches)

#### 3. lambda/functions/api/submissions/index.js
**Status:** ✅ SAFE

**Tables Used:**
- document_submissions (SELECT, INSERT, DELETE)
- feedback_reports (SELECT for feedback)
- evaluation_responses (SELECT for scores)

**Columns:** All columns exist in current schema
**Features:** DELETE analysis, feedback retrieval, content download

---

#### 4. lambda/functions/api/sessions/index.js
**Status:** ✅ SAFE

**Tables Used:**
- review_sessions
- document_submissions
- feedback_reports (JOIN)

---

#### 5. lambda/functions/api/notes/index.js
**Status:** ✅ SAFE

**Tables Used:**
- user_notes (all CRUD operations)

---

#### 6. AI Agents (6 functions)
**Status:** ✅ SAFE

**Functions:**
- orchestrator
- structure-validator
- content-analyzer
- grammar-checker
- clarification
- scoring (uses feedback_reports)

**Tables Used:**
- feedback_reports (INSERT with base columns only)
- evaluation_responses (INSERT)
- document_submissions (SELECT, UPDATE status)

**No Token Tracking:** None of the AI agents use input_tokens, output_tokens, or model_used columns

---

## DATABASE OPERATION SAFETY MATRIX

| Lambda Function | Table | Operation | Current Safety | Post-Migration 008 |
|----------------|-------|-----------|----------------|-------------------|
| api/overlays | evaluation_criteria | SELECT | ❌ FAIL | ✅ SAFE |
| api/overlays | evaluation_criteria | INSERT | ❌ FAIL | ✅ SAFE |
| api/overlays | evaluation_criteria | DELETE | ✅ SAFE | ✅ SAFE |
| api/submissions | document_submissions | ALL | ✅ SAFE | ✅ SAFE |
| api/submissions | feedback_reports | SELECT | ✅ SAFE | ✅ SAFE |
| api/sessions | review_sessions | ALL | ✅ SAFE | ✅ SAFE |
| api/notes | user_notes | ALL | ✅ SAFE | ✅ SAFE |
| scoring | feedback_reports | INSERT | ✅ SAFE | ✅ SAFE |
| All AI agents | * | * | ✅ SAFE | ✅ SAFE |

---

## MIGRATION REQUIREMENTS

### Required Before Deployment

**Migration 008 MUST be created and applied:**

```sql
-- database/migrations/008_add_criteria_enhancements.sql
ALTER TABLE evaluation_criteria
ADD COLUMN IF NOT EXISTS criteria_text TEXT,
ADD COLUMN IF NOT EXISTS max_score INTEGER;

COMMENT ON COLUMN evaluation_criteria.criteria_text IS 'Detailed criteria text for AI agent prompts';
COMMENT ON COLUMN evaluation_criteria.max_score IS 'Maximum possible score for this criterion';

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_criteria_text_gin
ON evaluation_criteria USING gin(to_tsvector('english', criteria_text));

SELECT 'Migration 008: Criteria Enhancements - COMPLETE' AS status;
```

**Rollback script:**
```sql
-- database/migrations/rollback-008_add_criteria_enhancements.sql
ALTER TABLE evaluation_criteria
DROP COLUMN IF EXISTS criteria_text,
DROP COLUMN IF EXISTS max_score;

DROP INDEX IF EXISTS idx_evaluation_criteria_criteria_text_gin;

SELECT 'Rollback 008: Criteria Enhancements - COMPLETE' AS status;
```

---

### Optional (Not Required)

**Migration 007:** Token tracking columns
**Status:** Available but not required
**Reason:** No Lambda functions currently use token tracking

Can be applied later if token tracking feature is implemented.

---

## DEPLOYMENT SEQUENCE

**Correct Order:**
1. ✅ Create migration 008 files
2. ✅ Apply migration 008 via Lambda: `npm run migrate:lambda`
3. ✅ Verify columns exist: Query information_schema
4. ✅ Deploy Lambda functions: `cdk deploy OverlayComputeStack`
5. ✅ Test Edit Criteria feature

**If Deployed Out of Order:**
- Deploying Lambda functions BEFORE migration 008 = SYSTEM BROKEN
- Edit Criteria feature will fail immediately
- GET /overlays/{id} will return 500 errors
- Frontend overlay management unusable

---

## ROLLBACK STRATEGY

**If Migration 008 Fails:**
1. Check migration Lambda logs
2. Fix SQL syntax issues
3. Re-run migration
4. DO NOT deploy Lambda functions until migration succeeds

**If Lambda Deployment Fails After Migration:**
1. Database is now at migration 008 (has new columns)
2. Old Lambda code (pre-restore) won't use new columns - SAFE
3. New Lambda code expects columns - will work
4. Can safely re-deploy or rollback Lambda code
5. Database columns are additive - no data loss

**If Need to Rollback Everything:**
```bash
# 1. Rollback database to snapshot
aws rds restore-db-cluster-from-snapshot \
  --snapshot-identifier overlay-db-before-fixes-20260201

# 2. Rollback Lambda code
git revert 6103ad3
npm run build
cdk deploy OverlayComputeStack

# 3. System restored to pre-deployment state
```

---

## RISK ASSESSMENT

### HIGH RISK Items
1. ❌ Deploying Lambda functions before migration 008
   - Impact: System completely broken
   - Mitigation: MUST apply migration first

2. ❌ Syntax error in migration 008
   - Impact: Migration fails, deployment blocked
   - Mitigation: Test SQL locally, verify syntax

### MEDIUM RISK Items
1. ⚠️ Migration 008 takes longer than expected
   - Impact: Brief downtime during migration
   - Mitigation: Monitor migration progress

2. ⚠️ Lambda deployment partially succeeds
   - Impact: Mixed Lambda versions
   - Mitigation: Re-run deployment, verify all functions updated

### LOW RISK Items
1. ✅ S3 versioning protects documents
2. ✅ Database snapshot available for rollback
3. ✅ Git backup of all code
4. ✅ No data loss risk (additive changes only)

---

## VERIFICATION QUERIES

**After Migration 008:**
```sql
-- Verify new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'evaluation_criteria'
AND column_name IN ('criteria_text', 'max_score')
ORDER BY column_name;

-- Expected result: 2 rows
-- criteria_text | text | YES
-- max_score | integer | YES

-- Check index created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'evaluation_criteria'
AND indexname = 'idx_evaluation_criteria_criteria_text_gin';

-- Expected: 1 row with GIN index definition
```

**Test Query (should NOT fail after migration):**
```sql
SELECT criteria_id, name, criteria_text, max_score
FROM evaluation_criteria
WHERE overlay_id = 'test-overlay-id'
LIMIT 1;

-- Should return rows (or empty set), not error
```

---

## CONCLUSIONS

### Current State
- Database: Migration 006 (stable baseline)
- Lambda functions: Mixed state (some expect migration 008)
- System status: PARTIALLY FUNCTIONAL

### Required Actions
1. **CREATE** migration 008 SQL files
2. **APPLY** migration 008 via Lambda
3. **VERIFY** columns exist
4. **DEPLOY** Lambda functions
5. **TEST** Edit Criteria feature

### Timeline Estimate
- Create migration: 5 minutes
- Apply migration: 2-3 minutes
- Verify: 1 minute
- Deploy Lambda: 5-10 minutes
- Test: 5 minutes
- **Total: ~20-25 minutes**

### Success Criteria
- ✅ Migration 008 applied successfully
- ✅ New columns queryable
- ✅ Lambda functions deployed
- ✅ GET /overlays/{id} returns 200
- ✅ PUT /overlays/{id} accepts criteria updates
- ✅ No 500 errors in CloudWatch Logs

---

**END OF DATABASE DEPENDENCIES ANALYSIS**
