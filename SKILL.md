---
name: test-driven-implementation
description: Systematic implementation with mandatory verification at each step. Use when building features that involve database changes, API endpoints, role-based access, multi-user functionality, or data isolation. Enforces pre-implementation planning (listing ALL tables, endpoints, components needed), incremental verification (testing after EACH step), and end-to-end validation (complete user flows with multiple roles). Prevents missing dependencies, untested code, and data leaks. Essential for full-stack features, permission systems, and multi-role applications.
---

# Test-Driven Implementation

Systematic approach to prevent missing dependencies, untested code, and integration failures.

## Core Principle

**NEVER proceed to next step without verification of current step.**

Every feature requires three phases: Plan → Implement with Verification → End-to-End Test.

## Phase 1: Pre-Implementation Analysis (MANDATORY)

Before writing ANY code, create complete dependency analysis.

### Database Analysis Checklist

List ALL required database objects:

```markdown
## Database Requirements

Tables:
- [ ] table_name (columns: col1, col2, ...)
- [ ] junction_table (for many-to-many)

Columns (additions to existing tables):
- [ ] table.new_column (type, constraints)

Indexes:
- [ ] idx_table_column (for performance on WHERE/JOIN)

Foreign Keys:
- [ ] table.fk_column → referenced_table.pk

Constraints:
- [ ] CHECK constraints
- [ ] UNIQUE constraints

Missing Dependencies: [list any tables/columns that don't exist yet]
```

### API Analysis Checklist

List ALL required endpoints:

```markdown
## API Requirements

Endpoints:
- [ ] POST /resource - Create (who can access?)
- [ ] GET /resource/:id - Read (permission checks?)
- [ ] PUT /resource/:id - Update (ownership checks?)
- [ ] DELETE /resource/:id - Delete (who can delete?)

Request/Response Schemas:
- [ ] Define request body schemas
- [ ] Define response schemas
- [ ] Define error responses

Permission Checks:
- [ ] Admin-only operations
- [ ] Resource ownership verification
- [ ] Role-based filtering

Error Cases:
- [ ] 400 Bad Request (validation)
- [ ] 401 Unauthorized (auth)
- [ ] 403 Forbidden (permissions)
- [ ] 404 Not Found
- [ ] 500 Server Error

Missing Dependencies: [list dependencies on other services/data]
```

### Frontend Analysis Checklist

List ALL required UI components:

```markdown
## Frontend Requirements

Routes/Pages:
- [ ] /path/to/page (who can access?)

Components:
- [ ] ComponentName (props, state, role-aware?)

API Integrations:
- [ ] API method calls needed
- [ ] Error handling for each call
- [ ] Loading states

User Flows:
- [ ] Admin flow: step1 → step2 → step3
- [ ] User flow: step1 → step2 → step3

Role-Based UI:
- [ ] Elements hidden for non-admins
- [ ] Conditional rendering by role

Missing Dependencies: [list missing API endpoints, components]
```

### Dependency Verification

Run these checks BEFORE implementation:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('table1', 'table2');

-- Verify columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('user_role', 'is_active');

-- Verify indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'users'
  AND indexname LIKE 'idx_%';
```

**STOP: Present analysis to user for approval before proceeding.**

## Phase 2: Incremental Implementation with Verification

Test EACH component immediately after creation.

### After Each Database Migration

**Implement:**
1. Write migration SQL
2. Include rollback script
3. Apply migration

**Verify:**
```sql
-- Test table exists
SELECT * FROM new_table LIMIT 1;

-- Test column exists
SELECT new_column FROM existing_table LIMIT 1;

-- Test index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'table_name';

-- Test constraints work
INSERT INTO table (invalid_data) VALUES (...); -- Should fail
```

**Document:**
```markdown
Migration XXX Applied:
- Table: table_name (X rows)
- Columns: col1, col2 ✅
- Indexes: idx_name ✅
- Verified: [timestamp]
```

### After Each API Endpoint

**Implement:**
1. Write handler function
2. Add route
3. Deploy

**Verify:**
```bash
# Test happy path
curl -X POST https://api/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"valid": "data"}'
# Expected: 200/201

# Test validation
curl -X POST https://api/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"invalid": "data"}'
# Expected: 400

# Test auth
curl -X POST https://api/endpoint
# Expected: 401

# Test permissions (if admin-only)
curl -X POST https://api/endpoint \
  -H "Authorization: Bearer $ANALYST_TOKEN"
# Expected: 403
```

**Document:**
```markdown
Endpoint: POST /resource
- Happy path: ✅ 201 Created
- Validation: ✅ 400 Bad Request
- Auth: ✅ 401 Unauthorized
- Permissions: ✅ 403 Forbidden (analyst)
- Verified: [timestamp]
```

### After Each Frontend Component

**Implement:**
1. Create component
2. Add to page/route
3. Wire up API calls

**Verify (Manual):**
- [ ] Component renders
- [ ] Data loads from API
- [ ] Form submission works
- [ ] Error states display
- [ ] Loading states show
- [ ] Admin sees admin UI
- [ ] Non-admin doesn't see admin UI
- [ ] Console has no errors

**Document:**
```markdown
Component: InvitationModal
- Renders: ✅
- API call works: ✅
- Error handling: ✅
- Role-aware: ✅ (hidden for analysts)
- Verified: [timestamp]
```

## Phase 3: End-to-End Validation (MANDATORY)

After ALL components complete, test complete user flows.

### Test Scenario Template

For each user role, test complete workflow:

```markdown
## Test: [Role] - [Feature Flow]

Setup:
- Login as: [role]
- Navigate to: [starting point]

Steps:
1. Action: [what to do]
   Expected: [what should happen]
   Actual: [what happened]
   Status: ✅/❌

2. Action: [next action]
   Expected: [what should happen]
   Actual: [what happened]
   Status: ✅/❌

[Repeat for all steps]

Database Verification:
```sql
-- Count visible records
SELECT COUNT(*) FROM table WHERE [role-based filter];
-- Expected: X
-- Actual: Y
```

Result: PASS/FAIL
Issues: [any problems found]
```

### Required Test Scenarios

**Scenario 1: Admin Happy Path**
- Test complete admin workflow
- Verify all admin functions work
- Check admin sees all data

**Scenario 2: Non-Admin Happy Path**
- Test complete user workflow
- Verify limited access works
- Check user sees only own/assigned data

**Scenario 3: Permission Enforcement**
- User tries admin action → 403
- User views other user data → Empty/Forbidden
- User views own data → Success

**Scenario 4: Edge Cases**
- Invalid data → Validation error
- Expired tokens → Error
- Missing required data → Error
- Duplicate data → Conflict error

**Scenario 5: Data Isolation (Critical)**
```sql
-- As admin
SELECT COUNT(*) FROM submissions;
-- Expected: All records

-- As user (simulate by adding WHERE)
SELECT COUNT(*) FROM submissions WHERE user_id = 'user123';
-- Expected: Only user's records

-- Verify difference
-- Admin count should be >= User count
-- If equal and multiple users exist, isolation is broken!
```

## Verification Checklist (Before "Complete")

Mark feature complete ONLY when ALL checks pass:

### Database ✅
- [ ] All tables exist and accessible
- [ ] All columns exist with correct types
- [ ] All indexes created
- [ ] All foreign keys work
- [ ] Sample data inserted successfully
- [ ] Row counts documented

### Backend ✅
- [ ] All endpoints respond correctly
- [ ] All permission checks enforced
- [ ] All error cases return correct codes
- [ ] CloudWatch logs clean (no errors)
- [ ] Token tracking working (if applicable)

### Frontend ✅
- [ ] All pages render without errors
- [ ] All forms submit successfully
- [ ] All buttons/links work
- [ ] Role-based UI displays correctly
- [ ] Console shows no errors
- [ ] Mobile responsive

### Integration ✅
- [ ] Admin complete flow tested
- [ ] User complete flow tested
- [ ] Permission checks verified
- [ ] Data isolation confirmed
- [ ] No data leaks found

### Documentation ✅
- [ ] Pre-implementation analysis saved
- [ ] Each step verification documented
- [ ] End-to-end test results saved
- [ ] Known issues documented

## Common Mistakes This Prevents

### ❌ Missing Tables/Columns
**Caught in:** Phase 1 - Dependency verification fails
**Prevention:** List ALL tables upfront, query to verify

### ❌ Untested Permissions
**Caught in:** Phase 2 - API verification with different roles
**Prevention:** Test EACH endpoint with admin + non-admin tokens

### ❌ Data Leaks
**Caught in:** Phase 3 - Data isolation verification
**Prevention:** Query database as different users, count records

### ❌ Broken User Flows
**Caught in:** Phase 3 - End-to-end scenarios
**Prevention:** Test complete workflows from start to finish

### ❌ Missing Error Handling
**Caught in:** Phase 2 & 3 - Edge case testing
**Prevention:** Test invalid data, missing auth, expired tokens

## Success Criteria

Feature passes when:

✅ **Planning complete:** All dependencies listed and verified  
✅ **Incremental verification:** Each component tested after creation  
✅ **Integration tested:** Complete user flows verified  
✅ **Permissions enforced:** All role checks working  
✅ **Data isolated:** Users see only their data  
✅ **Documented:** All tests recorded with results

NO shortcuts. NO "I'll test it later."

## When to Use This Skill

Apply for ANY feature involving:
- Database schema changes
- New API endpoints
- Role-based access control
- Multi-user functionality
- Data isolation requirements
- Permission systems
- User authentication/authorization

Especially critical for:
- Adding new user roles
- Implementing access control
- Building multi-tenant features
- Creating invitation systems
- Any feature with "admin vs user" distinction

## Template: Quick Start

```markdown
# Feature: [Feature Name]

## Phase 1: Analysis

### Database Requirements
- Tables: [list]
- Columns: [list]
- Indexes: [list]
- Dependencies: [what must exist first]

### API Requirements
- Endpoints: [list with permissions]
- Schemas: [request/response]
- Error cases: [list]

### Frontend Requirements
- Components: [list]
- Routes: [list]
- User flows: [describe]

**Approval:** [ ] User approved plan

## Phase 2: Implementation Log

### Migration XXX
- Created: [what]
- Verified: [SQL query results]
- Status: ✅

### API Endpoint: [path]
- Tested: Happy path ✅
- Tested: Validation ✅
- Tested: Auth ✅
- Tested: Permissions ✅
- Status: ✅

### Component: [name]
- Renders: ✅
- API works: ✅
- Role-aware: ✅
- Status: ✅

## Phase 3: End-to-End Tests

### Test 1: Admin Flow
- Step 1: ✅
- Step 2: ✅
- Result: PASS

### Test 2: User Flow
- Step 1: ✅
- Step 2: ✅
- Result: PASS

### Test 3: Permissions
- Admin action as user: 403 ✅
- Data isolation: Verified ✅
- Result: PASS

## Final Checklist
- [ ] Database ✅
- [ ] Backend ✅
- [ ] Frontend ✅
- [ ] Integration ✅
- [ ] Documentation ✅

Feature Status: ✅ COMPLETE
```

---

Remember: This skill exists because AI tends to skip verification. The systematic approach catches 90% of bugs before they become problems. Use it religiously.
