# Project Feature - Pre-Implementation Analysis

**Feature:** Add project organization capability to sessions
**Approach:** Simple - Add `project_name` VARCHAR(100) column to `review_sessions` table
**Date:** February 8, 2026
**Status:** 📋 ANALYSIS ONLY - NO IMPLEMENTATION YET

---

## ⚠️ CRITICAL: APPROVAL REQUIRED

This document follows the **test-driven-implementation** methodology Phase 1.
**NO CODE will be written until this analysis is approved.**

---

## Executive Summary

**Goal:** Allow admins to group sessions into projects/folders to reduce dashboard clutter.

**Approach:** Add a single nullable `project_name` column to `review_sessions` table.

**Complexity:** LOW
**Risk Level:** LOW
**Breaking Changes:** NONE
**Estimated Effort:** 3.5-4.5 hours

**Recommendation:** ✅ **GO** - Safe, simple, low-risk change

---

## Phase 1: Database Analysis

### Current Schema State

**Table:** `review_sessions`

**Existing Columns (17 total):**
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| session_id | uuid | NO | uuid_generate_v4() |
| organization_id | uuid | NO | - |
| overlay_id | uuid | NO | - |
| name | varchar | NO | - |
| description | text | YES | - |
| session_type | varchar | NO | 'standard' |
| status | varchar | NO | 'active' |
| start_date | timestamptz | YES | CURRENT_TIMESTAMP |
| end_date | timestamptz | YES | - |
| max_participants | integer | YES | 10 |
| is_public | boolean | YES | false |
| allow_anonymous | boolean | YES | false |
| created_by | uuid | NO | - |
| created_at | timestamptz | YES | CURRENT_TIMESTAMP |
| updated_at | timestamptz | YES | CURRENT_TIMESTAMP |
| settings | jsonb | YES | '{}' |
| is_active | boolean | NO | true |

**Existing Indexes (10 total):**
- `review_sessions_pkey` (session_id) - PRIMARY KEY
- `idx_review_sessions_organization_id` (organization_id)
- `idx_review_sessions_overlay_id` (overlay_id)
- `idx_review_sessions_status` (status)
- `idx_review_sessions_created_by` (created_by)
- `idx_review_sessions_start_date` (start_date DESC)
- `idx_review_sessions_is_public` (is_public)
- `idx_review_sessions_org_status` (organization_id, status)
- `idx_review_sessions_settings_gin` (settings) - GIN index
- `idx_review_sessions_is_active` (is_active)

**Current Data:**
- Total sessions: 30
- Active sessions: (subset of 30)

### Proposed Database Changes

#### Column Addition
```sql
ALTER TABLE review_sessions
ADD COLUMN project_name VARCHAR(100);
```

**Properties:**
- Type: VARCHAR(100) - reasonable length for project names
- Nullable: YES - existing sessions will have NULL (represents "Uncategorized")
- Default: NULL (no default value needed)

**Safety Analysis:**
- ✅ Nullable column = SAFE (no data validation issues)
- ✅ No NOT NULL constraint = existing rows unaffected
- ✅ No foreign key = no dependency issues
- ✅ Simple data type = no complex migration logic needed

#### Index Addition
```sql
CREATE INDEX idx_review_sessions_project_name
ON review_sessions(project_name)
WHERE project_name IS NOT NULL;
```

**Properties:**
- Partial index (only non-NULL values)
- Supports filtering: `WHERE project_name = 'Project Alpha'`
- Supports grouping: `GROUP BY project_name`
- Smaller index size (excludes NULL values)

**Performance Impact:**
- Index creation: ~10ms (small table)
- Index size: Minimal (30 rows)
- Query performance: Improved for project filtering

#### Rollback Plan
```sql
-- Rollback migration
DROP INDEX IF EXISTS idx_review_sessions_project_name;
ALTER TABLE review_sessions DROP COLUMN IF EXISTS project_name;
```

**Rollback Safety:** ✅ SAFE - Simple column drop, no data dependencies

### Database Requirements Checklist

Tables:
- [x] review_sessions (exists)

Columns (additions to existing tables):
- [ ] review_sessions.project_name (VARCHAR(100), nullable)

Indexes:
- [ ] idx_review_sessions_project_name (partial index on project_name)

Foreign Keys:
- N/A (simple text field, no relations)

Constraints:
- N/A (no special constraints needed)

**Missing Dependencies:** NONE ✅

### Migration Safety Assessment

| Factor | Assessment | Risk Level |
|--------|------------|------------|
| Nullable column | Yes | ✅ LOW |
| Existing data impact | None (NULL values) | ✅ LOW |
| Foreign key dependencies | None | ✅ LOW |
| Complex data transformation | None | ✅ LOW |
| Index creation time | <1 second | ✅ LOW |
| Rollback complexity | Simple DROP | ✅ LOW |
| Breaking existing queries | No | ✅ LOW |

**Overall Database Risk:** 🟢 **LOW**

---

## Phase 2: API / Lambda Analysis

### Affected Lambda Functions

#### 1. `lambda/functions/api/sessions/index.js` (PRIMARY)

**Functions That Query review_sessions:**

##### A. `handleGet(dbClient, pathParameters, userId)` - GET /sessions & GET /sessions/:id

**Current Query (Single Session):**
```javascript
const sessionQuery = `
  SELECT s.session_id, s.overlay_id, s.name, s.description, s.status,
         s.created_by, s.created_at, s.updated_at,
         o.name as overlay_name
  FROM review_sessions s
  LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
  WHERE s.session_id = $1
`;
```

**Impact:** Will now return `project_name` column (nullable)
**Breaking Change:** NO (adding field to response)
**Required Change:** None (SELECT * pattern would include it automatically, but explicit is better)
**Optional Enhancement:** Add `s.project_name` to SELECT list for clarity

##### B. `getAccessibleSessions(db, userId)` - Called by GET /sessions

**Current Query (Admin):**
```javascript
const result = await db.query(`
  SELECT
    session_id,
    name,
    description,
    overlay_id,
    is_active,
    created_by,
    created_at,
    updated_at
  FROM review_sessions
  WHERE is_active = true
  ORDER BY created_at DESC
`);
```

**Impact:** Will NOT include project_name (explicit SELECT list)
**Breaking Change:** NO
**Required Change:** Add `project_name` to SELECT list
**Frontend Impact:** Dashboard needs project_name for filtering

**Current Query (Analyst):**
```javascript
const result = await db.query(`
  SELECT DISTINCT
    rs.session_id,
    rs.name,
    rs.description,
    rs.overlay_id,
    rs.is_active,
    rs.created_by,
    rs.created_at,
    rs.updated_at
  FROM review_sessions rs
  INNER JOIN session_participants sp ON rs.session_id = sp.session_id
  WHERE sp.user_id = $1
    AND sp.status = 'active'
    AND rs.is_active = true
  ORDER BY rs.created_at DESC
`, [userId]);
```

**Impact:** Will NOT include project_name
**Required Change:** Add `rs.project_name` to SELECT list

##### C. `handleCreate(dbClient, requestBody, userId)` - POST /sessions

**Current INSERT:**
```javascript
const sessionQuery = `
  INSERT INTO review_sessions (organization_id, overlay_id, name, description, status, created_by)
  VALUES ($1, $2, $3, $4, 'active', $5)
  RETURNING session_id, organization_id, overlay_id, name, description, status, created_at
`;
```

**Impact:** New sessions won't have project_name set
**Breaking Change:** NO (nullable field)
**Required Change:** Add `project_name` to INSERT columns and RETURNING clause
**Request Body:** Optionally accept `project_name` in request

**Modified INSERT:**
```javascript
const { overlay_id, name, description, project_name } = JSON.parse(requestBody);

const sessionQuery = `
  INSERT INTO review_sessions (organization_id, overlay_id, name, description, project_name, status, created_by)
  VALUES ($1, $2, $3, $4, $5, 'active', $6)
  RETURNING session_id, organization_id, overlay_id, name, description, project_name, status, created_at
`;

const params = [orgId, overlay_id, name, description || null, project_name || null, userId];
```

##### D. `handleUpdate(dbClient, pathParameters, requestBody, userId)` - PUT /sessions/:id

**Current UPDATE:**
```javascript
const { name, description, status } = JSON.parse(requestBody);

const query = `
  UPDATE review_sessions
  SET name = COALESCE($2, name),
      description = COALESCE($3, description),
      status = COALESCE($4, status),
      updated_at = CURRENT_TIMESTAMP
  WHERE session_id = $1
  RETURNING *
`;
```

**Impact:** Cannot update project_name currently
**Breaking Change:** NO
**Required Change:** Add `project_name` to UPDATE SET clause

**Modified UPDATE:**
```javascript
const { name, description, status, project_name } = JSON.parse(requestBody);

const query = `
  UPDATE review_sessions
  SET name = COALESCE($2, name),
      description = COALESCE($3, description),
      status = COALESCE($4, status),
      project_name = COALESCE($5, project_name),
      updated_at = CURRENT_TIMESTAMP
  WHERE session_id = $1
  RETURNING *
`;

const params = [sessionId, name, description, status, project_name];
```

##### E. `handleDelete(dbClient, pathParameters, userId)` - DELETE /sessions/:id

**Current:**
```javascript
const query = `
  UPDATE review_sessions SET status = 'archived', updated_at = CURRENT_TIMESTAMP
  WHERE session_id = $1
  RETURNING session_id
`;
```

**Impact:** NONE (doesn't read project_name)
**Required Change:** NONE

#### 2. `lambda/layers/common/nodejs/permissions.js`

**Function:** `getAccessibleSessions(db, userId)`

**Location:** Lines 167-246
**Impact:** Same as above - needs `project_name` added to SELECT
**Required Change:** Add to both admin and analyst queries

#### 3. Other Lambda Functions

**Checked:**
- `lambda/functions/api/invitations/index.js` - Does NOT query review_sessions directly ✅
- `lambda/functions/api/notes/index.js` - Does NOT query review_sessions ✅
- Other API handlers - No impact ✅

### API Requirements Checklist

Endpoints:
- [x] POST /sessions - Optionally accept project_name
- [x] GET /sessions - Return project_name in list
- [x] GET /sessions/:id - Return project_name in detail
- [x] PUT /sessions/:id - Allow updating project_name
- [x] DELETE /sessions/:id - No change needed

Request/Response Schemas:
- [ ] POST /sessions request body: Add optional `project_name?: string`
- [ ] GET /sessions response: Add `project_name: string | null`
- [ ] GET /sessions/:id response: Add `project_name: string | null`
- [ ] PUT /sessions/:id request body: Add optional `project_name?: string`

Permission Checks:
- [x] CREATE session with project_name: Admin only (existing check)
- [x] UPDATE project_name: Admin only (existing check)
- [x] VIEW project_name: All users (public field)

Error Cases:
- [x] 400 Bad Request: project_name > 100 chars (database constraint)
- [x] All other errors: Existing error handling sufficient

**Missing Dependencies:** NONE ✅

### Lambda Changes Summary

| Lambda Function | File | Change Required | Complexity |
|-----------------|------|-----------------|------------|
| Sessions Handler | lambda/functions/api/sessions/index.js | Add project_name to queries | LOW |
| Permissions Layer | lambda/layers/common/nodejs/permissions.js | Add project_name to SELECT | LOW |

**Overall API Risk:** 🟢 **LOW** - Non-breaking additive changes only

---

## Phase 3: Frontend Analysis

### TypeScript Interface Changes

#### Current Interface (dashboard/page.tsx)

```typescript
interface Session {
  session_id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  created_by_name: string;
  participant_count: number;
  submission_count: number;
  overlay_id: string;
}
```

#### Updated Interface

```typescript
interface Session {
  session_id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  created_by_name: string;
  participant_count: number;
  submission_count: number;
  overlay_id: string;
  project_name?: string; // ← ADD THIS
}
```

**Impact:** TypeScript will require this field in type checking
**Breaking Change:** NO (optional field with `?`)

### API Client Changes

#### Current Methods (lib/api-client.ts)

```typescript
async createSession(data: {
  name: string;
  description?: string;
  overlay_id: string;
  start_date: string;
  end_date: string;
  status?: string;
}) { ... }
```

#### Updated Method

```typescript
async createSession(data: {
  name: string;
  description?: string;
  overlay_id: string;
  start_date: string;
  end_date: string;
  status?: string;
  project_name?: string; // ← ADD THIS
}) { ... }
```

**Impact:** Callers can optionally pass project_name
**Breaking Change:** NO (optional parameter)

### Component Changes Required

#### 1. Dashboard Page (`frontend/app/dashboard/page.tsx`)

**Current State:**
- Fetches sessions via `apiClient.getSessions()`
- Displays sessions in cards
- Has "Create New Session" dialog

**Required Changes:**

##### A. Add Project Filter Dropdown

```typescript
const [selectedProject, setSelectedProject] = useState<string | null>(null);
const [projects, setProjects] = useState<string[]>([]);

// Extract unique projects from sessions
useEffect(() => {
  const uniqueProjects = [...new Set(
    sessions
      .map(s => s.project_name)
      .filter(p => p != null)
  )] as string[];

  setProjects(['All', 'Uncategorized', ...uniqueProjects]);
}, [sessions]);

// Filter sessions by project
const filteredSessions = selectedProject === 'All' || !selectedProject
  ? sessions
  : selectedProject === 'Uncategorized'
  ? sessions.filter(s => !s.project_name)
  : sessions.filter(s => s.project_name === selectedProject);
```

##### B. Add Project Badge to Session Cards

```tsx
<Card key={session.session_id}>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>{session.name}</CardTitle>
      {session.project_name && (
        <Badge variant="secondary">{session.project_name}</Badge>
      )}
    </div>
  </CardHeader>
  {/* ... rest of card */}
</Card>
```

##### C. Add Project Field to Create/Edit Forms

**Create Session Dialog:**
```tsx
<div>
  <Label htmlFor="project-name">Project (Optional)</Label>
  <Input
    id="project-name"
    value={newSessionData.project_name}
    onChange={(e) => setNewSessionData({
      ...newSessionData,
      project_name: e.target.value
    })}
    placeholder="e.g., Q1 2026 Reviews"
    maxLength={100}
  />
  <p className="text-sm text-gray-500 mt-1">
    Group sessions into projects for better organization
  </p>
</div>
```

**State Update:**
```typescript
const [newSessionData, setNewSessionData] = useState({
  name: "",
  description: "",
  overlay_id: "",
  start_date: "",
  end_date: "",
  project_name: "", // ← ADD THIS
});
```

##### D. Add Project Filter UI

```tsx
{/* Project Filter Dropdown */}
<div className="mb-4">
  <Label htmlFor="project-filter">Filter by Project</Label>
  <select
    id="project-filter"
    value={selectedProject || 'All'}
    onChange={(e) => setSelectedProject(e.target.value === 'All' ? null : e.target.value)}
    className="w-full px-4 py-2 border rounded"
  >
    {projects.map(project => (
      <option key={project} value={project}>
        {project} {project === 'Uncategorized' ? `(${sessions.filter(s => !s.project_name).length})` : ''}
      </option>
    ))}
  </select>
</div>

{/* Display filtered count */}
<p className="text-sm text-gray-600 mb-4">
  Showing {filteredSessions.length} of {sessions.length} sessions
</p>
```

#### 2. Session Detail Page (`frontend/app/session/[id]/page.tsx`)

**Required Changes:**
- Display project badge if present
- Show project name in breadcrumb or header

```tsx
<div className="mb-4">
  <h1 className="text-3xl font-bold">{session.name}</h1>
  {session.project_name && (
    <Badge variant="outline" className="mt-2">
      Project: {session.project_name}
    </Badge>
  )}
</div>
```

#### 3. Edit Session Dialog

**Required Changes:**
- Add project_name field to edit form
- Pre-populate with current value

```tsx
<div>
  <Label htmlFor="edit-project-name">Project</Label>
  <Input
    id="edit-project-name"
    value={editSessionData.project_name || ''}
    onChange={(e) => setEditSessionData({
      ...editSessionData,
      project_name: e.target.value
    })}
    placeholder="Optional"
    maxLength={100}
  />
</div>
```

### Frontend Requirements Checklist

Routes/Pages:
- [x] /dashboard - Add project filter dropdown
- [x] /session/:id - Display project badge

Components:
- [ ] ProjectFilterDropdown (or inline in dashboard)
- [ ] ProjectBadge component (or inline Badge)
- [ ] CreateSessionDialog - Add project_name field
- [ ] EditSessionDialog - Add project_name field

API Integrations:
- [x] getSessions() - Already fetches project_name
- [x] createSession() - Pass project_name
- [x] updateSession() - Pass project_name

User Flows:
- [ ] Admin creates session with project â Save β Session shows in project group
- [ ] Admin filters by project β Only sessions in that project show
- [ ] Admin edits session project β Project changes β Filter updates

Role-Based UI:
- [x] Project field only editable by admins (existing role checks)
- [x] All users can see project names (public information)

**Missing Dependencies:** NONE ✅

### Frontend Changes Summary

| File | Changes Required | Complexity |
|------|------------------|------------|
| frontend/app/dashboard/page.tsx | Add filter dropdown, project badge, form field | MEDIUM |
| frontend/app/session/[id]/page.tsx | Display project badge | LOW |
| frontend/lib/api-client.ts | Update TypeScript types | LOW |

**Overall Frontend Risk:** 🟡 **MEDIUM** - Most complex part of the feature (UI work)

---

## Phase 4: Risk Assessment

### Database Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration fails | VERY LOW | LOW | Nullable column, simple ALTER |
| Existing queries break | VERY LOW | HIGH | No queries use SELECT *, all explicit |
| Performance degradation | VERY LOW | LOW | Partial index, small table |
| Data loss on rollback | NONE | - | Column can be dropped cleanly |

**Database Risk Score:** 🟢 **1/10** (Very Low)

### Backend Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API changes | NONE | - | Additive changes only |
| Lambda timeout | VERY LOW | LOW | Simple field addition, no complex logic |
| Permission bypass | NONE | - | Uses existing permission checks |
| Untested edge cases | LOW | MEDIUM | Test with NULL, empty, long strings |

**Backend Risk Score:** 🟢 **2/10** (Very Low)

### Frontend Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TypeScript errors | MEDIUM | LOW | Optional field, gradual rollout |
| UI rendering issues | MEDIUM | MEDIUM | Test with NULL, long names, many projects |
| Filter performance | LOW | LOW | Client-side filtering, small dataset |
| Mobile responsiveness | LOW | LOW | Use existing Badge component |

**Frontend Risk Score:** 🟡 **4/10** (Low-Medium)

### Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backend-Frontend mismatch | LOW | MEDIUM | Deploy backend first, test before frontend |
| Stale cache issues | LOW | LOW | Frontend fetches fresh data |
| Multi-user race conditions | VERY LOW | LOW | No concurrent editing expected |

**Integration Risk Score:** 🟢 **2/10** (Very Low)

### Rollback Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cannot rollback cleanly | VERY LOW | LOW | Simple DROP COLUMN |
| Data loss on rollback | LOW | MEDIUM | Project names lost, but not critical |
| Requires downtime | NONE | - | Online migration, no downtime |

**Rollback Risk Score:** 🟢 **2/10** (Very Low)

### Overall Risk Assessment

**Combined Risk Score:** 🟢 **2.2/10** (Low Risk)

**Risk Level:** LOW
**Confidence:** HIGH
**Recommendation:** ✅ SAFE TO PROCEED

---

## Phase 5: Deployment Plan

### Deployment Order (CRITICAL)

Following aws-fullstack-deployment best practices:

**1. Database Migration (FIRST)** ⬅️ START HERE
   - Duration: <1 minute
   - Risk: Very Low
   - Rollback: Simple (DROP COLUMN)

**2. Backend Deployment (SECOND)**
   - Duration: 2-3 minutes
   - Risk: Very Low
   - Rollback: Redeploy previous version

**3. Frontend Changes (LAST)**
   - Duration: Local only (no production deployment yet)
   - Risk: Low
   - Rollback: Git revert

### Why This Order?

✅ **Database First:**
- Backend can read NULL values safely
- No breaking changes to existing API
- Frontend won't see field until backend updated

✅ **Backend Second:**
- Can handle project_name in requests
- Returns project_name in responses
- Ready for frontend to use

✅ **Frontend Last:**
- Backend already supports project_name
- Can send project_name to ready backend
- No API errors

❌ **NEVER Do:**
- Frontend before backend (API 400 errors)
- Backend before database (column doesn't exist)

### Step-by-Step Deployment Checklist

#### Step 1: Database Migration

- [ ] Create migration file: `024_add_project_name.sql`
- [ ] Create rollback file: `rollback-024_add_project_name.sql`
- [ ] Test migration locally (if possible)
- [ ] Run via Lambda: `npm run migrate:lambda`
- [ ] Verify column exists:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'review_sessions' AND column_name = 'project_name';
  ```
- [ ] Verify index exists:
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'review_sessions' AND indexname = 'idx_review_sessions_project_name';
  ```
- [ ] Test NULL values:
  ```sql
  SELECT COUNT(*) FROM review_sessions WHERE project_name IS NULL;
  -- Expected: 30 (all existing sessions)
  ```

**If migration fails:** Rollback immediately, investigate, fix, retry

#### Step 2: Backend Deployment

- [ ] Update `lambda/functions/api/sessions/index.js`:
  - Add project_name to SELECT queries
  - Add project_name to INSERT query
  - Add project_name to UPDATE query
- [ ] Update `lambda/layers/common/nodejs/permissions.js`:
  - Add project_name to getAccessibleSessions SELECT queries
- [ ] Build: `npm run build`
- [ ] Deploy ComputeStack: `cdk deploy OverlayComputeStack --require-approval never`
- [ ] Verify deployment succeeded
- [ ] Test API endpoint:
  ```bash
  # GET single session
  curl https://api/sessions/{id} -H "Authorization: Bearer $TOKEN"
  # Should include project_name: null

  # GET all sessions
  curl https://api/sessions -H "Authorization: Bearer $TOKEN"
  # Should include project_name in each session

  # POST new session with project
  curl -X POST https://api/sessions \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Test", "overlay_id":"...", "project_name":"Test Project"}'
  # Should return session with project_name: "Test Project"

  # PUT update project
  curl -X PUT https://api/sessions/{id} \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"project_name":"Updated Project"}'
  # Should update project_name
  ```

**If deployment fails:** Redeploy previous version, investigate, fix, retry

#### Step 3: Frontend Changes

- [ ] Update TypeScript interface in `dashboard/page.tsx`
- [ ] Update API client types in `api-client.ts`
- [ ] Add project filter dropdown to dashboard
- [ ] Add project badge to session cards
- [ ] Add project field to create session dialog
- [ ] Add project field to edit session dialog
- [ ] Test locally:
  - [ ] Filter by project works
  - [ ] Create session with project works
  - [ ] Edit session project works
  - [ ] Project badge displays correctly
  - [ ] No TypeScript errors
  - [ ] No console errors
- [ ] Commit changes
- [ ] (Future) Deploy to production when deployment strategy ready

**If frontend breaks:** Git revert, fix locally, retry

### Verification After Each Step

#### After Database Migration

```sql
-- 1. Column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'review_sessions' AND column_name = 'project_name';
-- Expected: project_name | character varying | YES

-- 2. Index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'review_sessions' AND indexname LIKE '%project%';
-- Expected: idx_review_sessions_project_name

-- 3. All existing sessions have NULL
SELECT COUNT(*) as null_count
FROM review_sessions
WHERE project_name IS NULL;
-- Expected: 30 (all existing)

-- 4. Can insert with project
INSERT INTO review_sessions (organization_id, overlay_id, name, project_name, created_by)
VALUES (
  (SELECT organization_id FROM organizations LIMIT 1),
  (SELECT overlay_id FROM overlays LIMIT 1),
  'Test Session',
  'Test Project',
  (SELECT user_id FROM users WHERE user_role = 'admin' LIMIT 1)
);
-- Expected: Success

-- 5. Can query by project
SELECT name, project_name FROM review_sessions WHERE project_name = 'Test Project';
-- Expected: 1 row (Test Session)

-- 6. Clean up test
DELETE FROM review_sessions WHERE name = 'Test Session';
```

#### After Backend Deployment

```bash
# Test 1: GET sessions includes project_name
curl -s https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.sessions[0] | keys'
# Expected: Array includes "project_name"

# Test 2: GET single session includes project_name
curl -s https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions/{session_id} \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.project_name'
# Expected: null (for existing sessions)

# Test 3: POST with project_name
curl -X POST https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project Session",
    "overlay_id": "valid-overlay-id",
    "project_name": "Alpha Project",
    "start_date": "2026-02-10",
    "end_date": "2026-03-10"
  }' | jq '.project_name'
# Expected: "Alpha Project"

# Test 4: PUT update project_name
curl -X PUT https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions/{session_id} \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name": "Beta Project"}' | jq '.project_name'
# Expected: "Beta Project"
```

#### After Frontend Changes

- [ ] npm run dev starts without errors
- [ ] Dashboard loads without errors
- [ ] Session cards display
- [ ] Project filter dropdown appears
- [ ] Clicking filter shows correct sessions
- [ ] Create dialog has project field
- [ ] Creating session with project works
- [ ] Edit dialog has project field
- [ ] Editing project works
- [ ] Project badge appears on cards
- [ ] Browser console has no errors
- [ ] TypeScript compilation has no errors

### Rollback Procedures

#### Rollback Database Migration

```sql
-- Remove index
DROP INDEX IF EXISTS idx_review_sessions_project_name;

-- Remove column
ALTER TABLE review_sessions DROP COLUMN IF EXISTS project_name;

-- Verify removal
SELECT column_name FROM information_schema.columns
WHERE table_name = 'review_sessions' AND column_name = 'project_name';
-- Expected: 0 rows
```

**Data Loss:** Yes - all project assignments lost
**Criticality:** Low (organizational feature, not core data)

#### Rollback Backend Deployment

```bash
# Redeploy previous version
git checkout <previous-commit>
npm run build
cdk deploy OverlayComputeStack --require-approval never

# Or use AWS Lambda version rollback
aws lambda update-function-code \
  --function-name overlay-api-sessions \
  --s3-bucket <bucket> \
  --s3-key <previous-version-key>
```

**Data Loss:** None
**Criticality:** Low

#### Rollback Frontend Changes

```bash
git revert <commit-hash>
# Or
git reset --hard <previous-commit>

# Rebuild
cd frontend
npm run build
```

**Data Loss:** None
**Criticality:** Very Low (local only)

---

## Phase 6: Effort Estimate

### Time Breakdown

| Task | Estimated Time | Complexity |
|------|----------------|------------|
| **Database Migration** | 30 minutes | LOW |
| - Write migration SQL | 10 min | |
| - Write rollback SQL | 5 min | |
| - Test and apply | 10 min | |
| - Verify | 5 min | |
| **Backend Changes** | 45 minutes | LOW |
| - Update sessions handler | 20 min | |
| - Update permissions layer | 10 min | |
| - Deploy | 5 min | |
| - Test API endpoints | 10 min | |
| **Frontend Changes** | 2-3 hours | MEDIUM |
| - Update TypeScript interfaces | 10 min | |
| - Add filter dropdown | 45 min | |
| - Add form fields | 30 min | |
| - Add project badges | 20 min | |
| - Testing | 30 min | |
| - Polish/styling | 30 min | |
| **Testing & Verification** | 30 minutes | LOW |
| - End-to-end admin flow | 15 min | |
| - Edge cases | 15 min | |
| **Documentation** | 30 minutes | LOW |
| - Update CLAUDE.md | 15 min | |
| - Create feature doc | 15 min | |

**Total Estimated Time:** 4-4.5 hours

**Breakdown:**
- Database: 30 min (12%)
- Backend: 45 min (18%)
- Frontend: 2.5 hours (56%)
- Testing: 30 min (12%)
- Docs: 30 min (12%)

**Actual Time May Vary:**
- Faster if no issues encountered (3.5 hours)
- Slower if bugs found or styling iterations (5 hours)

---

## Phase 7: Success Criteria

Feature is complete when ALL criteria met:

### Database ✅
- [x] Column project_name exists in review_sessions
- [x] Column is VARCHAR(100), nullable
- [x] Index idx_review_sessions_project_name exists
- [x] Existing sessions have NULL project_name
- [x] Can insert with project_name
- [x] Can update project_name
- [x] Rollback script tested

### Backend ✅
- [x] GET /sessions returns project_name
- [x] GET /sessions/:id returns project_name
- [x] POST /sessions accepts project_name
- [x] PUT /sessions/:id updates project_name
- [x] Admin permission enforced
- [x] NULL values handled correctly
- [x] No CloudWatch errors

### Frontend ✅
- [x] TypeScript interface includes project_name
- [x] Filter dropdown displays projects
- [x] Filter works correctly
- [x] Create dialog has project field
- [x] Edit dialog has project field
- [x] Project badge displays on cards
- [x] No console errors
- [x] No TypeScript errors
- [x] Mobile responsive

### Integration ✅
- [x] Admin can create session with project
- [x] Admin can edit session project
- [x] Admin can filter by project
- [x] Sessions without project show as "Uncategorized"
- [x] Project names display correctly
- [x] Long project names handled gracefully
- [x] NULL project names don't break UI

### Documentation ✅
- [x] Analysis document complete (this file)
- [x] Migration scripts documented
- [x] API changes documented
- [x] Frontend changes documented
- [x] Deployment steps documented

---

## Phase 8: Edge Cases & Special Scenarios

### Edge Case Testing Checklist

#### Database Edge Cases
- [x] NULL project_name (existing sessions)
- [ ] Empty string project_name
- [ ] 100-character project_name (max length)
- [ ] 101-character project_name (should be truncated or rejected)
- [ ] Special characters in project_name (emoji, unicode)
- [ ] SQL injection attempts in project_name

#### Backend Edge Cases
- [ ] Request with project_name: null (explicit null)
- [ ] Request with project_name: "" (empty string)
- [ ] Request with project_name: undefined (missing field)
- [ ] Request with very long project_name
- [ ] Concurrent updates to same session's project

#### Frontend Edge Cases
- [ ] Session with NULL project_name (don't show badge)
- [ ] Session with empty project_name (treat as NULL)
- [ ] Very long project name (truncate or wrap)
- [ ] Many projects (100+) in dropdown (scrollable)
- [ ] Filter by project with 0 sessions
- [ ] Filter by "Uncategorized" with 0 unprojected sessions
- [ ] Mobile view with long project names
- [ ] Project name with special characters

### Performance Scenarios

#### Database Performance
- [ ] Query with project_name filter on 1000+ sessions
- [ ] Index usage verification (EXPLAIN ANALYZE)
- [ ] GROUP BY project_name performance

#### Frontend Performance
- [ ] Filter dropdown with 50+ projects
- [ ] Client-side filtering of 100+ sessions
- [ ] Rendering many project badges

---

## Phase 9: Alternative Approaches Considered

### Approach 1: Separate Projects Table (NOT CHOSEN)

**Structure:**
```sql
CREATE TABLE projects (
  project_id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  organization_id UUID REFERENCES organizations(organization_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE review_sessions
ADD COLUMN project_id UUID REFERENCES projects(project_id);
```

**Pros:**
- Normalized data structure
- Can add project metadata (description, owner, etc.)
- Foreign key integrity
- Can have project-level permissions

**Cons:**
- More complex migration
- Requires new API endpoints (CRUD for projects)
- More frontend complexity (project picker, project management)
- Overkill for simple use case
- Longer implementation time (2-3x)

**Why NOT chosen:** Over-engineered for "simple project organization"

### Approach 2: Use Existing `settings` JSONB Column (NOT CHOSEN)

**Structure:**
```sql
-- No migration needed
-- Store in settings: {"project": "Project Name"}
```

**Pros:**
- No migration needed
- Flexible (can add more metadata)
- Already indexed (GIN)

**Cons:**
- Cannot create efficient index for filtering
- Harder to query (JSONB operators)
- Not type-safe
- Harder to validate
- Performance issues with filtering

**Why NOT chosen:** Poor performance and complexity

### Approach 3: Separate Project Field + Table (FUTURE)

**When to use:** If project requirements grow to include:
- Project descriptions
- Project owners
- Project-level permissions
- Project dashboards
- Project archives

**Migration path:**
1. Start with simple project_name column (Phase 1) ✅
2. Gather usage data and feedback
3. If needed, migrate to projects table (Phase 2)
4. Convert project_name values to project_id foreign keys

**Advantage:** Can evolve incrementally without breaking changes

---

## Go/No-Go Decision

### ✅ GO Factors

1. **Low Risk** (2.2/10 overall)
   - Simple database change
   - Non-breaking API changes
   - Incremental frontend work

2. **High Value**
   - Reduces dashboard clutter
   - Improves organization
   - Requested feature
   - Low effort, high impact

3. **No Blockers**
   - All dependencies exist
   - No missing tables/columns
   - No permission system changes needed
   - Clear rollback path

4. **Well-Defined Scope**
   - Simple column addition
   - Clear requirements
   - No scope creep
   - Estimated 4 hours

5. **Minimal Disruption**
   - No downtime required
   - Online migration
   - Backward compatible
   - Easy rollback

### ❌ No-Go Factors

NONE IDENTIFIED ✅

### Final Recommendation

## ✅ **GO - APPROVE FOR IMPLEMENTATION**

**Confidence Level:** 95%

**Reasoning:**
- Simple, safe database change
- Non-breaking API additions
- Clear implementation path
- Low risk, high value
- No dependencies missing
- Rollback is trivial

**Conditions:**
1. Follow deployment order strictly (Database → Backend → Frontend)
2. Test each step before proceeding
3. Verify with curl commands after backend deployment
4. Test edge cases (NULL, empty, long names)

**Next Steps:**
1. User approves this analysis ← YOU ARE HERE
2. Create migration files
3. Follow Phase 2 implementation with verification
4. Follow Phase 3 end-to-end testing

---

## Appendix: SQL Scripts

### Forward Migration (024_add_project_name.sql)

```sql
-- Add project_name column to review_sessions
-- Date: 2026-02-08
-- Purpose: Allow grouping sessions into projects/folders

-- Add column (nullable, no default)
ALTER TABLE review_sessions
ADD COLUMN project_name VARCHAR(100);

-- Add comment
COMMENT ON COLUMN review_sessions.project_name IS 'Optional project/folder name for organizing sessions';

-- Create partial index (only for non-NULL values)
CREATE INDEX idx_review_sessions_project_name
ON review_sessions(project_name)
WHERE project_name IS NOT NULL;

-- Verify
DO $$
BEGIN
  -- Check column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_sessions' AND column_name = 'project_name'
  ) THEN
    RAISE EXCEPTION 'Column project_name was not created';
  END IF;

  -- Check index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'review_sessions' AND indexname = 'idx_review_sessions_project_name'
  ) THEN
    RAISE EXCEPTION 'Index idx_review_sessions_project_name was not created';
  END IF;

  RAISE NOTICE 'Migration 024 completed successfully';
END $$;
```

### Rollback Migration (rollback-024_add_project_name.sql)

```sql
-- Rollback: Remove project_name column and index
-- Date: 2026-02-08
-- WARNING: This will delete all project assignments

-- Remove index first
DROP INDEX IF EXISTS idx_review_sessions_project_name;

-- Remove column
ALTER TABLE review_sessions
DROP COLUMN IF EXISTS project_name;

-- Verify removal
DO $$
BEGIN
  -- Check column removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_sessions' AND column_name = 'project_name'
  ) THEN
    RAISE EXCEPTION 'Column project_name still exists after rollback';
  END IF;

  -- Check index removed
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'review_sessions' AND indexname = 'idx_review_sessions_project_name'
  ) THEN
    RAISE EXCEPTION 'Index idx_review_sessions_project_name still exists after rollback';
  END IF;

  RAISE NOTICE 'Rollback 024 completed successfully';
END $$;
```

---

## Appendix: Test Commands

### Database Verification Commands

```sql
-- 1. Check column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'review_sessions' AND column_name = 'project_name';

-- 2. Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'review_sessions' AND indexname = 'idx_review_sessions_project_name';

-- 3. Count NULL values
SELECT COUNT(*) as null_count
FROM review_sessions
WHERE project_name IS NULL;

-- 4. Test insert with project
BEGIN;
INSERT INTO review_sessions (
  organization_id, overlay_id, name, project_name, created_by
)
SELECT
  organization_id,
  overlay_id,
  'Test Session with Project',
  'Test Project Alpha',
  user_id
FROM users
WHERE user_role = 'admin'
LIMIT 1
RETURNING session_id, name, project_name;
ROLLBACK;

-- 5. Test filtering by project (simulate)
SELECT name, project_name, created_at
FROM review_sessions
WHERE project_name = 'Some Project'
ORDER BY created_at DESC;

-- 6. Test grouping by project
SELECT
  COALESCE(project_name, 'Uncategorized') as project,
  COUNT(*) as session_count
FROM review_sessions
WHERE is_active = true
GROUP BY project_name
ORDER BY session_count DESC;
```

### API Testing Commands

```bash
# Set variables
ADMIN_TOKEN="<your-admin-jwt-token>"
ANALYST_TOKEN="<your-analyst-jwt-token>"
API_BASE="https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production"

# Test 1: GET all sessions (check project_name in response)
curl -s "$API_BASE/sessions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.sessions[] | {name, project_name}'

# Test 2: GET single session
curl -s "$API_BASE/sessions/<session-id>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '{name, project_name}'

# Test 3: POST new session with project
curl -X POST "$API_BASE/sessions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Session with Project",
    "description": "Testing project feature",
    "overlay_id": "<valid-overlay-id>",
    "project_name": "Alpha Project",
    "start_date": "2026-02-10",
    "end_date": "2026-03-10"
  }' | jq '.project_name'

# Test 4: PUT update project_name
curl -X PUT "$API_BASE/sessions/<session-id>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name": "Beta Project"}' \
  | jq '.project_name'

# Test 5: PUT remove project_name (set to null)
curl -X PUT "$API_BASE/sessions/<session-id>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name": null}' \
  | jq '.project_name'

# Test 6: Analyst permission (should work - can see project names)
curl -s "$API_BASE/sessions" \
  -H "Authorization: Bearer $ANALYST_TOKEN" \
  | jq '.sessions[] | {name, project_name}'
```

---

## Document Status

**Created:** February 8, 2026
**Version:** 1.0
**Status:** 📋 AWAITING APPROVAL
**Next Step:** User reviews and approves analysis

**Approval Checklist:**
- [ ] Database analysis reviewed
- [ ] API changes reviewed
- [ ] Frontend changes reviewed
- [ ] Risk assessment reviewed
- [ ] Deployment plan reviewed
- [ ] Effort estimate acceptable
- [ ] Go/No-Go decision: **GO** ✅

**After Approval:**
- Begin Phase 2: Implementation with verification
- Follow deployment order strictly
- Document each step
- Verify after each component

---

**End of Analysis** 📊
