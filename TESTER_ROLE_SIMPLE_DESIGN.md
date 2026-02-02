# Simple Tester Role - Minimal Design

**Date:** 2026-02-02
**Type:** Simple Enhancement (NOT Multi-Tenant)
**Goal:** Allow external testers to use platform without admin privileges
**Effort:** 10-15 hours (vs 200+ hours for full multi-tenant)

---

## Executive Summary

Add a simple two-role system to existing single-org platform:
- **Admin** (existing user) - Full control
- **Tester** (new role) - Submit and view own results only

**Scope:** Minimal changes to existing codebase
**No Changes To:** Organizations, multiple orgs, complex RBAC
**Target Users:** External testers, QA team, pilot users

---

## Requirements

### What Testers CAN Do
- ✅ Login with their account
- ✅ View list of available sessions
- ✅ Submit documents to sessions
- ✅ View their own submissions
- ✅ View their own AI results
- ✅ Download their own results

### What Testers CANNOT Do
- ❌ Create overlays
- ❌ Edit evaluation criteria
- ❌ Create sessions
- ❌ Delete sessions
- ❌ View other users' submissions
- ❌ Edit any settings
- ❌ Invite users
- ❌ Delete other users' submissions

### What Admin CAN Do
- ✅ Everything (unchanged from current system)
- ✅ Create tester accounts
- ✅ View all submissions (including testers')
- ✅ Delete any submission

---

## Database Changes (MINIMAL)

### 1. Add Role to Users Table

```sql
-- Migration: 009_add_user_role.sql
ALTER TABLE users
  ADD COLUMN user_role VARCHAR(50) DEFAULT 'admin';

-- Update existing admin
UPDATE users
SET user_role = 'admin'
WHERE email = 'admin@example.com';

-- Constraint
ALTER TABLE users
  ADD CONSTRAINT valid_user_role CHECK (user_role IN ('admin', 'tester'));

-- Index (optional)
CREATE INDEX idx_users_role ON users(user_role);
```

**That's it!** No new tables, no complex relationships.

---

### 2. Add Submitted By to Submissions (Already Exists)

```sql
-- Already have this from v1.8:
-- document_submissions.submitted_by UUID REFERENCES users(user_id)

-- If needed, backfill for existing submissions:
UPDATE document_submissions
SET submitted_by = created_by
WHERE submitted_by IS NULL;
```

---

## Permission Logic (SIMPLE)

### Backend Permission Helper

```javascript
// lambda/layers/common/nodejs/permissions.js

/**
 * Check if user is admin
 */
function isAdmin(user) {
  return user.user_role === 'admin';
}

/**
 * Check if user can edit overlays/criteria/sessions
 */
function canEdit(user) {
  return isAdmin(user);
}

/**
 * Check if user can view submission
 */
function canViewSubmission(user, submission) {
  // Admins can view all
  if (isAdmin(user)) return true;

  // Testers can only view their own
  return submission.submitted_by === user.user_id;
}

/**
 * Check if user can delete submission
 */
function canDeleteSubmission(user, submission) {
  // Admins can delete any
  if (isAdmin(user)) return true;

  // Testers can delete their own (before AI processing)
  if (submission.submitted_by === user.user_id) {
    return submission.status === 'pending';
  }

  return false;
}

module.exports = {
  isAdmin,
  canEdit,
  canViewSubmission,
  canDeleteSubmission
};
```

---

## API Changes (3 handlers)

### 1. Overlays Handler (Protect Writes)

```javascript
// lambda/functions/api/overlays/index.js

const { canEdit } = require('/opt/nodejs/permissions');

async function handleCreate(dbClient, requestBody, user) {
  // Check permission
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can create overlays' })
    };
  }

  // ... existing create logic
}

async function handleUpdate(dbClient, pathParameters, requestBody, user) {
  // Check permission
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can edit overlays' })
    };
  }

  // ... existing update logic
}

async function handleDelete(dbClient, pathParameters, user) {
  // Check permission
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can delete overlays' })
    };
  }

  // ... existing delete logic
}

// GET remains unchanged (testers can view overlays)
```

---

### 2. Sessions Handler (Protect Writes)

```javascript
// lambda/functions/api/sessions/index.js

const { canEdit } = require('/opt/nodejs/permissions');

async function handleCreate(dbClient, requestBody, user) {
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can create sessions' })
    };
  }

  // ... existing create logic
}

async function handleUpdate(dbClient, pathParameters, requestBody, user) {
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can edit sessions' })
    };
  }

  // ... existing update logic
}

async function handleDelete(dbClient, pathParameters, user) {
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can delete sessions' })
    };
  }

  // ... existing delete logic
}

// GET remains unchanged (testers can view sessions)
```

---

### 3. Submissions Handler (Filter by User)

```javascript
// lambda/functions/api/submissions/index.js

const { isAdmin, canViewSubmission, canDeleteSubmission } = require('/opt/nodejs/permissions');

async function handleList(dbClient, queryParams, user) {
  let query;

  if (isAdmin(user)) {
    // Admins see all submissions
    query = `
      SELECT * FROM document_submissions
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;
  } else {
    // Testers see only their own
    query = `
      SELECT * FROM document_submissions
      WHERE submitted_by = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
  }

  const params = isAdmin(user) ? [] : [user.user_id];
  const result = await dbClient.query(query, params);

  return {
    statusCode: 200,
    body: JSON.stringify({ submissions: result.rows })
  };
}

async function handleGet(dbClient, pathParameters, user) {
  const { submissionId } = pathParameters;

  const query = `
    SELECT * FROM document_submissions
    WHERE submission_id = $1
      AND deleted_at IS NULL
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }

  const submission = result.rows[0];

  // Check permission
  if (!canViewSubmission(user, submission)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Access denied' })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(submission)
  };
}

async function handleDelete(dbClient, pathParameters, user) {
  const { submissionId } = pathParameters;

  // Get submission
  const getQuery = `SELECT * FROM document_submissions WHERE submission_id = $1`;
  const result = await dbClient.query(getQuery, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }

  const submission = result.rows[0];

  // Check permission
  if (!canDeleteSubmission(user, submission)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins or submission owner (pending only) can delete' })
    };
  }

  // ... existing delete logic
}

// POST (create submission) remains unchanged (both roles can submit)
```

---

## Frontend Changes (SIMPLE)

### 1. Hide Admin UI Elements

```typescript
// frontend/lib/auth.ts

export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.user_role === 'admin';
}

export function isTester(): boolean {
  const user = getCurrentUser();
  return user?.user_role === 'tester';
}
```

### 2. Conditional Rendering

```tsx
// frontend/app/dashboard/page.tsx

import { isAdmin } from '@/lib/auth';

export default function Dashboard() {
  const userIsAdmin = isAdmin();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Everyone sees sessions */}
      <SessionsList />

      {/* Only admins see these */}
      {userIsAdmin && (
        <>
          <CreateOverlayButton />
          <CreateSessionButton />
          <ManageUsersButton />
        </>
      )}

      {/* Everyone sees their submissions */}
      <MySubmissions />
    </div>
  );
}
```

### 3. Hide Edit Buttons for Testers

```tsx
// frontend/app/overlays/page.tsx

import { isAdmin } from '@/lib/auth';

export default function OverlaysPage() {
  const userIsAdmin = isAdmin();

  return (
    <div>
      <h1>Evaluation Overlays</h1>

      {userIsAdmin && (
        <Button onClick={createOverlay}>Create New Overlay</Button>
      )}

      <OverlayList>
        {overlays.map(overlay => (
          <OverlayCard key={overlay.id}>
            <h3>{overlay.name}</h3>
            <p>{overlay.description}</p>

            {/* Only show edit/delete for admins */}
            {userIsAdmin && (
              <div>
                <Button onClick={() => editOverlay(overlay.id)}>Edit</Button>
                <Button onClick={() => deleteOverlay(overlay.id)}>Delete</Button>
              </div>
            )}
          </OverlayCard>
        ))}
      </OverlayList>
    </div>
  );
}
```

### 4. Filter Navigation

```tsx
// frontend/components/navigation.tsx

import { isAdmin } from '@/lib/auth';

export function Navigation() {
  const userIsAdmin = isAdmin();

  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/sessions">Sessions</Link>
      <Link href="/my-submissions">My Submissions</Link>

      {/* Admin-only links */}
      {userIsAdmin && (
        <>
          <Link href="/overlays">Manage Overlays</Link>
          <Link href="/users">Manage Users</Link>
          <Link href="/analytics">Analytics</Link>
        </>
      )}
    </nav>
  );
}
```

---

## User Management (SIMPLE)

### Admin Creates Tester Account

**Option 1: Manual via Database**

```sql
-- Create tester account
INSERT INTO users (email, password_hash, user_role, first_name, last_name)
VALUES (
  'tester@example.com',
  '$2a$10$...', -- bcrypt hash of password
  'tester',
  'Test',
  'User'
);
```

**Option 2: Simple Admin UI (Future Enhancement)**

```tsx
// frontend/app/admin/users/create.tsx

export default function CreateUserPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'tester'>('tester');

  async function handleSubmit() {
    await apiClient.createUser({ email, password, role });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Select
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="tester">Tester (Submit & View Only)</option>
        <option value="admin">Admin (Full Access)</option>
      </Select>
      <Button type="submit">Create User</Button>
    </form>
  );
}
```

---

## JWT Token Update

### Include Role in Token

```javascript
// lambda/functions/api/auth/index.js

const jwt = require('jsonwebtoken');

async function generateToken(user) {
  const payload = {
    user_id: user.user_id,
    email: user.email,
    user_role: user.user_role,  // ← ADD THIS
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  return jwt.sign(payload, process.env.JWT_SECRET);
}
```

### Validate Role in Middleware

```javascript
// lambda/layers/common/nodejs/auth-middleware.js

async function validateAuth(event) {
  const token = event.headers.Authorization?.replace('Bearer ', '');

  if (!token) {
    throw new Error('No token provided');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  return {
    user_id: decoded.user_id,
    email: decoded.email,
    user_role: decoded.user_role  // ← Available in all handlers
  };
}
```

---

## Implementation Plan

### Phase 1: Database (30 minutes)

**Tasks:**
1. Create migration 009_add_user_role.sql
2. Test migration on local database
3. Deploy migration to production
4. Verify admin role set correctly

**SQL:**
```sql
-- 009_add_user_role.sql
ALTER TABLE users
  ADD COLUMN user_role VARCHAR(50) DEFAULT 'admin';

UPDATE users
SET user_role = 'admin'
WHERE email = 'admin@example.com';

ALTER TABLE users
  ADD CONSTRAINT valid_user_role CHECK (user_role IN ('admin', 'tester'));

CREATE INDEX idx_users_role ON users(user_role);
```

---

### Phase 2: Backend Permissions (2-3 hours)

**Tasks:**
1. Create permissions.js helper in Lambda Layer
2. Update overlays handler (add permission checks)
3. Update sessions handler (add permission checks)
4. Update submissions handler (filter by user)
5. Update auth handler (include role in JWT)
6. Test with Postman/curl

**Files to Modify:**
- `lambda/layers/common/nodejs/permissions.js` (NEW)
- `lambda/functions/api/overlays/index.js` (3 functions)
- `lambda/functions/api/sessions/index.js` (3 functions)
- `lambda/functions/api/submissions/index.js` (3 functions)
- `lambda/functions/api/auth/index.js` (1 function)

**Deployment:**
```bash
cdk deploy OverlayComputeStack
```

---

### Phase 3: Frontend UI (3-4 hours)

**Tasks:**
1. Add isAdmin() helper to auth.ts
2. Update dashboard to hide admin buttons
3. Update overlays page to hide edit/delete
4. Update sessions page to hide create/edit
5. Update navigation to hide admin links
6. Test with tester account

**Files to Modify:**
- `frontend/lib/auth.ts` (add isAdmin helper)
- `frontend/app/dashboard/page.tsx` (conditional rendering)
- `frontend/app/overlays/page.tsx` (hide edit buttons)
- `frontend/app/overlays/[id]/page.tsx` (hide edit buttons)
- `frontend/app/session/[id]/page.tsx` (hide edit buttons)
- `frontend/components/navigation.tsx` (filter links)

**Testing:**
- Login as admin → See all features
- Login as tester → See limited features
- Verify buttons hidden correctly

---

### Phase 4: Testing (2-3 hours)

**Test Cases:**

**As Admin:**
- ✅ Can create overlays
- ✅ Can edit criteria
- ✅ Can create sessions
- ✅ Can view all submissions
- ✅ Can delete any submission

**As Tester:**
- ✅ Can login
- ✅ Can view sessions
- ✅ Can submit document
- ✅ Can view own submissions
- ✅ Can view own results
- ❌ Cannot create overlays (API returns 403)
- ❌ Cannot edit criteria (buttons hidden)
- ❌ Cannot create sessions (API returns 403)
- ❌ Cannot view other users' submissions (API returns 403)
- ❌ Cannot delete other users' submissions (API returns 403)

**Security Tests:**
- Try tester JWT with admin-only endpoint → Should get 403
- Try to view another user's submission → Should get 403
- Try to edit overlay via API (bypass UI) → Should get 403

---

### Phase 5: Documentation (1 hour)

**Update CLAUDE.md:**

```markdown
## User Roles

**Admin:**
- Full access to all features
- Can create/edit overlays, criteria, sessions
- Can view all submissions
- Can manage users (future)

**Tester:**
- Read-only access
- Can submit documents to sessions
- Can view own submissions and results
- Cannot create/edit overlays, criteria, or sessions

**Current Users:**
- admin@example.com - Admin role
- tester@example.com - Tester role (if created)
```

---

## Total Effort Estimate

| Phase | Time | Complexity |
|-------|------|------------|
| 1. Database | 30 min | Low |
| 2. Backend | 2-3 hours | Medium |
| 3. Frontend | 3-4 hours | Medium |
| 4. Testing | 2-3 hours | Low |
| 5. Documentation | 1 hour | Low |
| **TOTAL** | **10-15 hours** | **Medium** |

**Single developer:** 1-2 days
**Compared to full multi-tenant:** 10 hours vs 200+ hours (20x simpler!)

---

## Permission Matrix (SIMPLE)

| Action | Admin | Tester |
|--------|-------|--------|
| **Authentication** |
| Login | ✅ | ✅ |
| Change Password | ✅ | ✅ |
| **Overlays** |
| View Overlays | ✅ | ✅ |
| Create Overlay | ✅ | ❌ |
| Edit Overlay | ✅ | ❌ |
| Delete Overlay | ✅ | ❌ |
| **Criteria** |
| View Criteria | ✅ | ✅ |
| Edit Criteria | ✅ | ❌ |
| **Sessions** |
| View Sessions | ✅ | ✅ |
| Create Session | ✅ | ❌ |
| Edit Session | ✅ | ❌ |
| Delete Session | ✅ | ❌ |
| **Submissions** |
| Submit Document | ✅ | ✅ |
| View Own Submissions | ✅ | ✅ |
| View All Submissions | ✅ | ❌ |
| Delete Own (Pending) | ✅ | ✅ |
| Delete Any | ✅ | ❌ |
| **Results** |
| View Own Results | ✅ | ✅ |
| View All Results | ✅ | ❌ |
| Download Own Results | ✅ | ✅ |
| **Users** |
| Create Users | ✅ | ❌ |
| View Users | ✅ | ❌ |
| Edit Users | ✅ | ❌ |

---

## What This Does NOT Include

**Out of Scope (Use Full Multi-Tenant Design for These):**
- ❌ Multiple organizations
- ❌ Organization admins
- ❌ Session-level access control
- ❌ User invitations
- ❌ Advanced RBAC
- ❌ Audit logging
- ❌ Billing/subscriptions
- ❌ Row-Level Security
- ❌ Data isolation between orgs

**This is ONLY:**
- ✅ Simple two-role system (admin vs tester)
- ✅ Permission checks in API
- ✅ Conditional UI rendering
- ✅ Filter submissions by user

---

## Migration Path to Full Multi-Tenant (Future)

If you later want full multi-tenant:

1. **This design is compatible** with future multi-tenant
2. **user_role** can become part of user_roles table
3. **No breaking changes** to existing tester accounts
4. **Gradual migration** - add features incrementally

**Upgrade Path:**
```
Simple Tester Role (10 hours)
    ↓
Add User Invitations (20 hours)
    ↓
Add Session Access Control (30 hours)
    ↓
Add Organizations (50 hours)
    ↓
Full Multi-Tenant SaaS (200 hours)
```

---

## Comparison: Simple vs Full Multi-Tenant

| Feature | Simple Tester | Full Multi-Tenant |
|---------|---------------|-------------------|
| **User Roles** | 2 (admin, tester) | 3+ (super admin, org admin, user) |
| **Organizations** | 1 (implicit) | Unlimited |
| **Data Isolation** | None needed | Row-Level Security |
| **Session Access** | All or none | Granular per-user |
| **User Management** | Manual | Invitations, SSO, etc. |
| **Implementation** | 10-15 hours | 200-290 hours |
| **Complexity** | Low | High |
| **Database Changes** | 1 column | 5+ tables |
| **Use Case** | Small team, external testers | SaaS product, many customers |

---

## Recommended Approach

**Use Simple Tester Role If:**
- ✅ You have < 10 users
- ✅ All users trust each other (single team)
- ✅ You just need read-only access for testers
- ✅ You want to deploy this week

**Use Full Multi-Tenant If:**
- ✅ You have multiple customers
- ✅ Need complete data isolation
- ✅ Planning to sell as SaaS
- ✅ Have 2+ months for development

**For Most Cases:** Start with Simple Tester Role, upgrade later if needed.

---

## Example User Flow

### Tester Login and Submit

```
1. Tester logs in
   URL: https://platform.com/login
   Email: tester@example.com
   Password: TesterPassword123!

2. Tester sees dashboard
   - Sessions list (view only)
   - My Submissions section
   - NO Create Overlay button
   - NO Create Session button

3. Tester clicks on session
   - Sees session details
   - Sees evaluation criteria (read-only)
   - Can upload document
   - NO Edit button
   - NO Delete session button

4. Tester uploads document
   - Same UI as admin
   - Document submitted
   - AI analysis runs

5. Tester views results
   - Sees own submission in "My Submissions"
   - Can view AI feedback
   - Can download results
   - Cannot see other users' submissions
```

---

## Security Considerations (SIMPLE)

### Backend Validation
- ✅ Every write operation checks `canEdit(user)`
- ✅ Submission views check `canViewSubmission(user, submission)`
- ✅ JWT includes user_role

### Frontend Protection
- ✅ Admin buttons hidden from testers
- ✅ Navigation filtered by role
- ✅ API calls will fail if bypassed (403)

### What's NOT Included
- ❌ Row-Level Security (not needed - single org)
- ❌ Audit logging (can add later)
- ❌ Rate limiting per role (not needed yet)

---

## Deployment Checklist

**Before Deployment:**
- [ ] Database migration tested
- [ ] Backend permission checks tested
- [ ] Frontend UI tested
- [ ] Tester account created
- [ ] Admin can still do everything

**Deployment Steps:**
1. Run database migration
2. Deploy backend (cdk deploy OverlayComputeStack)
3. Deploy frontend (restart dev server)
4. Create tester account
5. Test both roles
6. Update documentation

**Rollback Plan:**
- Revert database migration (drop column)
- Revert backend code
- Revert frontend code

---

## Cost/Benefit Analysis

**Benefits:**
- ✅ Allow external users to test platform
- ✅ Protect configuration from accidental changes
- ✅ Simple implementation (1-2 days)
- ✅ Easy to understand and maintain
- ✅ Foundation for future RBAC

**Costs:**
- ⚠️ Minimal additional code (~500 lines)
- ⚠️ Small JWT payload increase
- ⚠️ Testing time (few hours)

**ROI:** Very high - big capability gain for minimal effort

---

## Conclusion

**This design provides:**
- Simple two-role system (10 hours vs 200+ for full multi-tenant)
- Read-only testers who can submit and view results
- Admin retains full control
- Foundation for future enhancements
- Easy to implement and test

**Next Steps:**
1. Approve this design
2. Implement Phase 1 (database)
3. Implement Phase 2 (backend)
4. Implement Phase 3 (frontend)
5. Test thoroughly
6. Create tester accounts
7. Deploy to production

**Status:** Design Complete - Ready for Implementation

---

**END OF SIMPLE TESTER ROLE DESIGN**
