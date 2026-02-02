# Simple Tester Role with Session-Based Access - Minimal Design

**Date:** 2026-02-02 (Updated)
**Type:** Simple Enhancement (NOT Multi-Tenant)
**Goal:** Allow external testers to use platform with session-based access control
**Effort:** 15-22 hours (vs 200+ hours for full multi-tenant)

---

## Executive Summary

Add a simple two-role system with session-based access control to existing single-org platform:
- **Admin** (existing user) - Full control + manage session access
- **Tester** (new role) - Access only assigned sessions, submit and view own results

**Scope:** Minimal changes to existing codebase + session access control
**No Changes To:** Organizations, multiple orgs, complex RBAC beyond sessions
**Target Users:** External testers, QA team, pilot users

**Key Addition:** Session-based access control - testers only see sessions they're assigned to.

---

## Requirements

### What Testers CAN Do
- ✅ Login with their account
- ✅ **View ONLY assigned sessions** (not all sessions)
- ✅ Submit documents to assigned sessions
- ✅ View their own submissions
- ✅ View their own AI results
- ✅ Download their own results

### What Testers CANNOT Do
- ❌ Create overlays
- ❌ Edit evaluation criteria
- ❌ Create sessions
- ❌ Delete sessions
- ❌ **View sessions they're not assigned to**
- ❌ View other users' submissions
- ❌ Edit any settings
- ❌ Invite users
- ❌ Delete other users' submissions

### What Admin CAN Do
- ✅ Everything (unchanged from current system)
- ✅ Create tester accounts
- ✅ View all submissions (including testers')
- ✅ Delete any submission
- ✅ **NEW: Assign testers to specific sessions**
- ✅ **NEW: Revoke session access from testers**
- ✅ **NEW: View who has access to each session**

---

## Database Changes (MINIMAL + Session Access)

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

-- Index
CREATE INDEX idx_users_role ON users(user_role);
```

---

### 2. Add Session Access Table (NEW)

```sql
-- Migration: 010_add_session_access.sql
CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Audit trail
  granted_by UUID REFERENCES users(user_id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate access grants
  CONSTRAINT session_user_unique UNIQUE(session_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_session_access_session ON session_access(session_id);
CREATE INDEX idx_session_access_user ON session_access(user_id);
CREATE INDEX idx_session_access_granted_by ON session_access(granted_by);
```

**Why This Table:**
- Controls which testers can access which sessions
- Admins always have access (enforced in code, not database)
- Simple many-to-many relationship
- Audit trail (who granted access and when)

---

### 3. Submitted By (Already Exists)

```sql
-- Already have this from v1.8:
-- document_submissions.submitted_by UUID REFERENCES users(user_id)

-- Backfill if needed:
UPDATE document_submissions
SET submitted_by = created_by
WHERE submitted_by IS NULL;
```

---

## Permission Logic (SIMPLE + Session Access)

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
 * Check if user can access a specific session
 * Admins can access all sessions
 * Testers can only access sessions they're assigned to
 */
async function canAccessSession(dbClient, user, sessionId) {
  // Admins can access any session
  if (isAdmin(user)) {
    return true;
  }

  // Testers must have explicit access
  const query = `
    SELECT 1 FROM session_access
    WHERE session_id = $1 AND user_id = $2
  `;
  const result = await dbClient.query(query, [sessionId, user.user_id]);

  return result.rows.length > 0;
}

/**
 * Get all sessions accessible to user
 * Admins get all sessions
 * Testers get only assigned sessions
 */
async function getAccessibleSessions(dbClient, user) {
  if (isAdmin(user)) {
    // Admin sees all sessions
    const query = `
      SELECT * FROM review_sessions
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return await dbClient.query(query);
  } else {
    // Tester sees only assigned sessions
    const query = `
      SELECT rs.*
      FROM review_sessions rs
      INNER JOIN session_access sa ON rs.session_id = sa.session_id
      WHERE sa.user_id = $1
        AND rs.deleted_at IS NULL
      ORDER BY rs.created_at DESC
    `;
    return await dbClient.query(query, [user.user_id]);
  }
}

/**
 * Grant session access to user (admin only)
 */
async function grantSessionAccess(dbClient, adminUser, userId, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can grant session access');
  }

  const query = `
    INSERT INTO session_access (session_id, user_id, granted_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (session_id, user_id) DO NOTHING
    RETURNING access_id
  `;

  return await dbClient.query(query, [sessionId, userId, adminUser.user_id]);
}

/**
 * Revoke session access from user (admin only)
 */
async function revokeSessionAccess(dbClient, adminUser, userId, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can revoke session access');
  }

  const query = `
    DELETE FROM session_access
    WHERE session_id = $1 AND user_id = $2
  `;

  return await dbClient.query(query, [sessionId, userId]);
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
  canAccessSession,
  getAccessibleSessions,
  grantSessionAccess,
  revokeSessionAccess,
  canViewSubmission,
  canDeleteSubmission
};
```

---

## API Changes (5 handlers)

### 1. Overlays Handler (Protect Writes)

```javascript
// lambda/functions/api/overlays/index.js
// NO CHANGES - same as before (protect writes with canEdit)
```

---

### 2. Sessions Handler (Add Access Control)

```javascript
// lambda/functions/api/sessions/index.js

const { canEdit, getAccessibleSessions, canAccessSession } = require('/opt/nodejs/permissions');

async function handleList(dbClient, user) {
  // Get sessions based on user role
  const result = await getAccessibleSessions(dbClient, user);

  return {
    statusCode: 200,
    body: JSON.stringify({ sessions: result.rows })
  };
}

async function handleGet(dbClient, pathParameters, user) {
  const { sessionId } = pathParameters;

  // Check session access
  const hasAccess = await canAccessSession(dbClient, user, sessionId);
  if (!hasAccess) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'You do not have access to this session' })
    };
  }

  const query = `SELECT * FROM review_sessions WHERE session_id = $1`;
  const result = await dbClient.query(query, [sessionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows[0])
  };
}

async function handleCreate(dbClient, requestBody, user) {
  if (!canEdit(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can create sessions' })
    };
  }

  // ... existing create logic
}

// UPDATE and DELETE same as before (protect with canEdit)
```

---

### 3. Submissions Handler (Add Session Access Check)

```javascript
// lambda/functions/api/submissions/index.js

const { isAdmin, canViewSubmission, canDeleteSubmission, canAccessSession } = require('/opt/nodejs/permissions');

async function handleCreate(dbClient, requestBody, user) {
  const { session_id, document_name, document_content } = requestBody;

  // Check user has access to session
  const hasAccess = await canAccessSession(dbClient, user, session_id);
  if (!hasAccess) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'You do not have access to this session' })
    };
  }

  // ... existing create logic (set submitted_by = user.user_id)
}

async function handleList(dbClient, queryParams, user) {
  const { session_id } = queryParams;

  let query;
  let params = [];

  if (session_id) {
    // Filter by session - also check access
    const hasAccess = await canAccessSession(dbClient, user, session_id);
    if (!hasAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You do not have access to this session' })
      };
    }

    if (isAdmin(user)) {
      // Admin sees all submissions in session
      query = `
        SELECT * FROM document_submissions
        WHERE session_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      params = [session_id];
    } else {
      // Tester sees only their own in session
      query = `
        SELECT * FROM document_submissions
        WHERE session_id = $1 AND submitted_by = $2 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      params = [session_id, user.user_id];
    }
  } else {
    // All submissions
    if (isAdmin(user)) {
      query = `SELECT * FROM document_submissions WHERE deleted_at IS NULL ORDER BY created_at DESC`;
    } else {
      query = `SELECT * FROM document_submissions WHERE submitted_by = $1 AND deleted_at IS NULL ORDER BY created_at DESC`;
      params = [user.user_id];
    }
  }

  const result = await dbClient.query(query, params);
  return {
    statusCode: 200,
    body: JSON.stringify({ submissions: result.rows })
  };
}

// GET and DELETE same as before
```

---

### 4. Session Access Handler (NEW)

```javascript
// lambda/functions/api/session-access/index.js

const { isAdmin, grantSessionAccess, revokeSessionAccess } = require('/opt/nodejs/permissions');

async function handleGrantAccess(dbClient, pathParameters, requestBody, user) {
  // Only admins can grant access
  if (!isAdmin(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can grant session access' })
    };
  }

  const { sessionId } = pathParameters;
  const { user_id } = requestBody;

  try {
    const result = await grantSessionAccess(dbClient, user, user_id, sessionId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        access_id: result.rows[0]?.access_id
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleRevokeAccess(dbClient, pathParameters, user) {
  if (!isAdmin(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can revoke session access' })
    };
  }

  const { sessionId, userId } = pathParameters;

  try {
    await revokeSessionAccess(dbClient, user, userId, sessionId);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function handleListAccess(dbClient, pathParameters, user) {
  if (!isAdmin(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can view access list' })
    };
  }

  const { sessionId } = pathParameters;

  const query = `
    SELECT
      sa.access_id,
      sa.user_id,
      u.email,
      u.first_name,
      u.last_name,
      sa.granted_at,
      sa.granted_by,
      admin.email as granted_by_email
    FROM session_access sa
    JOIN users u ON sa.user_id = u.user_id
    LEFT JOIN users admin ON sa.granted_by = admin.user_id
    WHERE sa.session_id = $1
    ORDER BY sa.granted_at DESC
  `;

  const result = await dbClient.query(query, [sessionId]);

  return {
    statusCode: 200,
    body: JSON.stringify({ access_list: result.rows })
  };
}

exports.handler = async (event) => {
  const dbClient = await getDbClient();
  const user = await validateAuth(event);

  const { httpMethod, pathParameters, body } = event;
  const requestBody = body ? JSON.parse(body) : {};

  try {
    let response;

    if (httpMethod === 'POST') {
      // Grant access
      response = await handleGrantAccess(dbClient, pathParameters, requestBody, user);
    } else if (httpMethod === 'DELETE') {
      // Revoke access
      response = await handleRevokeAccess(dbClient, pathParameters, user);
    } else if (httpMethod === 'GET') {
      // List access
      response = await handleListAccess(dbClient, pathParameters, user);
    }

    return response;
  } finally {
    await dbClient.end();
  }
};
```

---

### 5. API Gateway Routes (NEW)

```javascript
// Add to CDK stack

// Session access management
api.addRoute('POST /sessions/{sessionId}/access', sessionAccessHandler);
api.addRoute('DELETE /sessions/{sessionId}/access/{userId}', sessionAccessHandler);
api.addRoute('GET /sessions/{sessionId}/access', sessionAccessHandler);
```

---

## Frontend Changes (SESSION ACCESS)

### 1. Session Access Management Component (NEW)

```tsx
// frontend/components/session-access-manager.tsx

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_role: string;
}

interface SessionAccessManagerProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionAccessManager({ sessionId, isOpen, onClose }: SessionAccessManagerProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersWithAccess, setUsersWithAccess] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, sessionId]);

  async function loadData() {
    setLoading(true);
    try {
      // Get all tester users
      const usersResponse = await apiClient.getUsers({ role: 'tester' });
      setAllUsers(usersResponse.data.users);

      // Get users with access to this session
      const accessResponse = await apiClient.getSessionAccess(sessionId);
      const accessUserIds = accessResponse.data.access_list.map((a: any) => a.user_id);
      setUsersWithAccess(new Set(accessUserIds));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAccess(userId: string, hasAccess: boolean) {
    try {
      if (hasAccess) {
        // Grant access
        await apiClient.grantSessionAccess(sessionId, userId);
        setUsersWithAccess(prev => new Set([...prev, userId]));
      } else {
        // Revoke access
        await apiClient.revokeSessionAccess(sessionId, userId);
        setUsersWithAccess(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    } catch (error) {
      console.error('Error updating access:', error);
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Manage Session Access</h2>
        <p className="text-slate-600 mb-6">
          Select which testers can access this session
        </p>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-3">
            {allUsers.length === 0 ? (
              <p className="text-slate-500">No testers available. Create tester accounts first.</p>
            ) : (
              allUsers.map(user => (
                <div key={user.user_id} className="flex items-center gap-3 p-3 border rounded">
                  <Checkbox
                    checked={usersWithAccess.has(user.user_id)}
                    onCheckedChange={(checked) => handleToggleAccess(user.user_id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{user.first_name} {user.last_name}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </div>
                  {usersWithAccess.has(user.user_id) && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Has Access
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
}
```

---

### 2. Add to Session Detail Page

```tsx
// frontend/app/session/[id]/page.tsx

import { isAdmin } from '@/lib/auth';
import { SessionAccessManager } from '@/components/session-access-manager';
import { useState } from 'react';

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const [showAccessManager, setShowAccessManager] = useState(false);
  const userIsAdmin = isAdmin();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Session Details</h1>

        {userIsAdmin && (
          <Button onClick={() => setShowAccessManager(true)}>
            Manage Access
          </Button>
        )}
      </div>

      {/* Session content */}
      <SessionDetails sessionId={params.id} />

      {/* Access manager modal */}
      {userIsAdmin && (
        <SessionAccessManager
          sessionId={params.id}
          isOpen={showAccessManager}
          onClose={() => setShowAccessManager(false)}
        />
      )}
    </div>
  );
}
```

---

### 3. Update API Client

```typescript
// frontend/lib/api-client.ts

class ApiClient {
  // ... existing methods

  // Get users (optionally filter by role)
  async getUsers(params?: { role?: 'admin' | 'tester' }) {
    return this.request<any>('/users', {
      method: 'GET',
      params
    });
  }

  // Session access management
  async getSessionAccess(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/access`, {
      method: 'GET'
    });
  }

  async grantSessionAccess(sessionId: string, userId: string) {
    return this.request<any>(`/sessions/${sessionId}/access`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId })
    });
  }

  async revokeSessionAccess(sessionId: string, userId: string) {
    return this.request<any>(`/sessions/${sessionId}/access/${userId}`, {
      method: 'DELETE'
    });
  }
}
```

---

### 4. Tester Dashboard (Show Only Assigned Sessions)

```tsx
// frontend/app/dashboard/page.tsx

import { isAdmin } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const userIsAdmin = isAdmin();

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    // API automatically filters by accessible sessions
    const response = await apiClient.getSessions();
    setSessions(response.data.sessions);
  }

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Sessions list - automatically filtered by backend */}
      <div className="mt-6">
        <h2>
          {userIsAdmin ? 'All Sessions' : 'My Assigned Sessions'}
        </h2>

        {sessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {userIsAdmin
              ? 'No sessions created yet.'
              : 'You have not been assigned to any sessions yet. Contact your administrator.'}
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map(session => (
              <SessionCard key={session.session_id} session={session} />
            ))}
          </div>
        )}
      </div>

      {/* Only admins see create button */}
      {userIsAdmin && (
        <Button onClick={createSession}>Create New Session</Button>
      )}
    </div>
  );
}
```

---

## Permission Matrix (WITH SESSION ACCESS)

| Action | Admin | Tester |
|--------|-------|--------|
| **Authentication** |
| Login | ✅ | ✅ |
| **Sessions** |
| View All Sessions | ✅ | ❌ |
| View Assigned Sessions | ✅ | ✅ |
| Create Session | ✅ | ❌ |
| Edit Session | ✅ | ❌ |
| Delete Session | ✅ | ❌ |
| **Session Access** |
| Assign User to Session | ✅ | ❌ |
| Revoke User from Session | ✅ | ❌ |
| View Access List | ✅ | ❌ |
| **Overlays & Criteria** |
| View Overlays | ✅ | ✅ |
| Create/Edit Overlays | ✅ | ❌ |
| Edit Criteria | ✅ | ❌ |
| **Submissions** |
| Submit to Assigned Session | ✅ | ✅ |
| Submit to Unassigned Session | ✅ | ❌ |
| View Own Submissions | ✅ | ✅ |
| View All Submissions | ✅ | ❌ |
| Delete Own (Pending) | ✅ | ✅ |
| Delete Any | ✅ | ❌ |
| **Results** |
| View Own Results | ✅ | ✅ |
| View All Results | ✅ | ❌ |

---

## Implementation Plan (WITH SESSION ACCESS)

### Phase 1: Database (1.5 hours)

**Tasks:**
1. Create migration 009_add_user_role.sql
2. Create migration 010_add_session_access.sql
3. Test migrations on local database
4. Deploy migrations to production
5. Verify indexes created

**SQL:**
```sql
-- 009_add_user_role.sql
ALTER TABLE users ADD COLUMN user_role VARCHAR(50) DEFAULT 'admin';
UPDATE users SET user_role = 'admin' WHERE email = 'admin@example.com';
ALTER TABLE users ADD CONSTRAINT valid_user_role CHECK (user_role IN ('admin', 'tester'));
CREATE INDEX idx_users_role ON users(user_role);

-- 010_add_session_access.sql
CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(user_id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT session_user_unique UNIQUE(session_id, user_id)
);
CREATE INDEX idx_session_access_session ON session_access(session_id);
CREATE INDEX idx_session_access_user ON session_access(user_id);
```

---

### Phase 2: Backend Permissions (4-5 hours)

**Tasks:**
1. Create permissions.js helper with session access functions
2. Update sessions handler (filter by accessible sessions)
3. Update submissions handler (check session access)
4. Create session-access handler (grant/revoke/list)
5. Update auth handler (include role in JWT)
6. Add API Gateway routes
7. Test with Postman/curl

**Files to Create:**
- `lambda/functions/api/session-access/index.js` (NEW)

**Files to Modify:**
- `lambda/layers/common/nodejs/permissions.js` (add session access functions)
- `lambda/functions/api/sessions/index.js` (filter by access)
- `lambda/functions/api/submissions/index.js` (check session access)

**Deployment:**
```bash
cdk deploy OverlayComputeStack
```

---

### Phase 3: Frontend UI (4-5 hours)

**Tasks:**
1. Create SessionAccessManager component
2. Add "Manage Access" button to session detail page
3. Update API client with session access methods
4. Update dashboard to show assigned sessions message
5. Test admin assigning testers
6. Test tester seeing only assigned sessions

**Files to Create:**
- `frontend/components/session-access-manager.tsx` (NEW)

**Files to Modify:**
- `frontend/lib/api-client.ts` (add session access methods)
- `frontend/app/session/[id]/page.tsx` (add Manage Access button)
- `frontend/app/dashboard/page.tsx` (update empty state message)

---

### Phase 4: Testing (3-4 hours)

**Test Cases:**

**As Admin:**
- ✅ Can view all sessions
- ✅ Can assign tester to session
- ✅ Can revoke tester from session
- ✅ Can view access list
- ✅ Can submit to any session
- ✅ Can view all submissions

**As Tester:**
- ✅ Can login
- ✅ Dashboard shows only assigned sessions
- ✅ Can access assigned session
- ✅ Can submit to assigned session
- ❌ Cannot see unassigned sessions in list (API returns 403)
- ❌ Cannot access unassigned session via direct URL (API returns 403)
- ❌ Cannot submit to unassigned session (API returns 403)
- ❌ Cannot view others' submissions

**Security Tests:**
- Try tester accessing unassigned session via API → 403
- Try tester submitting to unassigned session → 403
- Try tester calling grant/revoke access → 403
- Verify session filtering works correctly

---

### Phase 5: Documentation (1-2 hours)

**Update CLAUDE.md:**
```markdown
## User Roles & Session Access

**Admin:**
- Full access to all features
- Can create/edit overlays, criteria, sessions
- Can assign testers to specific sessions
- Can view all submissions

**Tester:**
- Session-based access (must be assigned)
- Can only see assigned sessions
- Can submit documents to assigned sessions
- Can view own submissions and results
- Cannot create/edit anything
```

**Create User Guide:**
- How to assign testers to sessions
- What testers can see
- How to revoke access

---

## Total Effort Estimate (WITH SESSION ACCESS)

| Phase | Time | Complexity |
|-------|------|------------|
| 1. Database | 1.5 hours | Low |
| 2. Backend | 4-5 hours | Medium |
| 3. Frontend | 4-5 hours | Medium |
| 4. Testing | 3-4 hours | Medium |
| 5. Documentation | 1-2 hours | Low |
| **TOTAL** | **15-22 hours** | **Medium** |

**Single developer:** 2-3 days
**Compared to full multi-tenant:** 20 hours vs 200+ hours (10x simpler!)

---

## User Flows (WITH SESSION ACCESS)

### FLOW 1: Admin Assigns Tester to Session

```
1. Admin navigates to session
   URL: /session/{sessionId}
   ↓
2. Admin clicks "Manage Access" button
   Opens modal showing all testers
   ↓
3. Admin sees list of testers
   - Tester 1: john@example.com (checkbox unchecked)
   - Tester 2: jane@example.com (checkbox checked - already has access)
   - Tester 3: bob@example.com (checkbox unchecked)
   ↓
4. Admin checks box for john@example.com
   API call: POST /sessions/{sessionId}/access
   Body: { user_id: "john-uuid" }
   ↓
5. System grants access
   - Creates session_access record
   - john@example.com can now see this session
   ↓
6. Admin closes modal
   Changes saved automatically
```

---

### FLOW 2: Tester Accesses Assigned Session

```
1. Tester logs in
   Email: john@example.com
   Password: TesterPassword123!
   ↓
2. Dashboard loads
   API: GET /sessions (returns only assigned sessions)
   ↓
3. Tester sees assigned sessions
   "Football Analysis" - assigned ✅
   "Question 18 Session" - NOT in list (not assigned)
   ↓
4. Tester clicks "Football Analysis"
   URL: /session/{footballSessionId}
   API checks: canAccessSession(john, footballSessionId) → true
   ↓
5. Session page loads
   - Can view criteria
   - Can upload document
   - Can submit
   ↓
6. Tester tries to access unassigned session (via URL)
   URL: /session/{question18SessionId}
   API checks: canAccessSession(john, question18SessionId) → false
   Result: 403 Forbidden error
```

---

### FLOW 3: Admin Revokes Access

```
1. Admin goes to session
   ↓
2. Clicks "Manage Access"
   ↓
3. Sees jane@example.com has access (checkbox checked)
   ↓
4. Admin unchecks jane@example.com
   API call: DELETE /sessions/{sessionId}/access/jane-uuid
   ↓
5. System revokes access
   - Deletes session_access record
   - jane@example.com can no longer see this session
   ↓
6. jane's dashboard updates
   Session no longer appears in her list
```

---

## What This Does NOT Include

**Out of Scope:**
- ❌ Multiple organizations
- ❌ Organization-level permissions
- ❌ User invitations system
- ❌ Advanced RBAC beyond sessions
- ❌ Audit logging (can add later)
- ❌ Email notifications
- ❌ Billing/subscriptions
- ❌ Row-Level Security (not needed - single org)

**This IS:**
- ✅ Simple two-role system (admin vs tester)
- ✅ Session-based access control
- ✅ Permission checks in API
- ✅ Conditional UI rendering
- ✅ Filter submissions by user
- ✅ Admin UI to manage access

---

## Security Considerations (SESSION ACCESS)

### Backend Validation
- ✅ Every session view checks `canAccessSession()`
- ✅ Every submission checks session access
- ✅ Every write operation checks `canEdit(user)`
- ✅ JWT includes user_role
- ✅ session_access table enforces assignments

### Frontend Protection
- ✅ Session list filtered by accessible sessions
- ✅ Admin buttons hidden from testers
- ✅ Access manager only visible to admins
- ✅ API calls will fail if bypassed (403)

### Database Integrity
- ✅ Foreign key constraints
- ✅ Unique constraint (user can't be assigned twice)
- ✅ CASCADE delete (access removed if session deleted)

---

## Migration Path to Full Multi-Tenant

This design is **fully compatible** with future multi-tenant:

```
Simple Tester + Session Access (20 hours)
    ↓
Add User Invitations (15 hours)
    ↓
Add Email Notifications (10 hours)
    ↓
Add Organizations (50 hours)
    ↓
Full Multi-Tenant (200 hours)
```

---

## Comparison: Simple vs Full Multi-Tenant

| Feature | Simple + Session Access | Full Multi-Tenant |
|---------|-------------------------|-------------------|
| **User Roles** | 2 (admin, tester) | 3+ (super admin, org admin, user) |
| **Organizations** | 1 (implicit) | Unlimited |
| **Session Access** | ✅ Per-user assignment | ✅ Per-user + per-org |
| **Data Isolation** | Submissions by user | Orgs + Users |
| **User Management** | Manual | Invitations, SSO |
| **Implementation** | 15-22 hours | 200-290 hours |
| **Complexity** | Low-Medium | High |
| **Database Changes** | 1 column + 1 table | 5+ tables |
| **Use Case** | Small team, controlled access | SaaS, many customers |

---

## Example Data

### Users Table
```
user_id  | email              | user_role | first_name | last_name
---------|--------------------|-----------|------------|----------
uuid-1   | admin@example.com  | admin     | Admin      | User
uuid-2   | john@example.com   | tester    | John       | Doe
uuid-3   | jane@example.com   | tester    | Jane       | Smith
```

### Sessions Table
```
session_id | name                    | created_by
-----------|-------------------------|------------
sess-1     | Football Analysis       | uuid-1
sess-2     | Question 18 Session     | uuid-1
sess-3     | Grant Applications      | uuid-1
```

### Session Access Table
```
access_id | session_id | user_id | granted_by | granted_at
----------|------------|---------|------------|------------
acc-1     | sess-1     | uuid-2  | uuid-1     | 2026-02-02 10:00
acc-2     | sess-1     | uuid-3  | uuid-1     | 2026-02-02 10:01
acc-3     | sess-2     | uuid-2  | uuid-1     | 2026-02-02 11:00
```

**Result:**
- John (uuid-2) can access: Football Analysis, Question 18
- Jane (uuid-3) can access: Football Analysis only
- Admin (uuid-1) can access: All sessions

---

## Deployment Checklist

**Before Deployment:**
- [ ] Database migrations tested
- [ ] Backend permission checks tested
- [ ] Session filtering tested
- [ ] Frontend access manager tested
- [ ] Tester can only see assigned sessions
- [ ] Admin can assign/revoke access

**Deployment Steps:**
1. Run migration 009 (user_role)
2. Run migration 010 (session_access)
3. Deploy backend (cdk deploy OverlayComputeStack)
4. Deploy frontend (restart dev server)
5. Create tester accounts
6. Assign testers to test session
7. Test both roles
8. Update documentation

**Rollback Plan:**
- Revert migrations (drop session_access table, drop user_role column)
- Revert backend code
- Revert frontend code

---

## Cost/Benefit Analysis

**Benefits:**
- ✅ Controlled access to specific sessions
- ✅ Testers can't see everything
- ✅ Flexible assignment (admin controls)
- ✅ Still simple to implement (2-3 days)
- ✅ Foundation for future RBAC

**Costs:**
- ⚠️ One additional table (session_access)
- ⚠️ Session filtering logic
- ⚠️ Access management UI
- ⚠️ Additional testing time

**ROI:** Very high - critical access control for minimal effort

---

## When to Use This vs Full Multi-Tenant

**Use Simple Tester + Session Access If:**
- ✅ You have < 20 users
- ✅ All users belong to same organization
- ✅ Need session-level access control
- ✅ Want to deploy this week

**Use Full Multi-Tenant If:**
- ✅ You have multiple customer organizations
- ✅ Need complete data isolation between orgs
- ✅ Planning to sell as SaaS product
- ✅ Have 2+ months for development

**For Most Cases:** Start with Simple + Session Access, upgrade later if needed.

---

## Conclusion

**This design provides:**
- Simple two-role system (15-22 hours vs 200+ for full multi-tenant)
- Session-based access control (admin assigns testers)
- Read-only testers who can only access assigned sessions
- Admin retains full control + access management
- Foundation for future enhancements
- Easy to implement and test

**Key Addition:** Session access control ensures testers only see what they're assigned to, providing proper segmentation without full multi-tenant complexity.

**Next Steps:**
1. Approve this design
2. Implement Phase 1 (database + session_access table)
3. Implement Phase 2 (backend + session filtering)
4. Implement Phase 3 (frontend + access manager UI)
5. Test thoroughly
6. Create tester accounts and assign to sessions
7. Deploy to production

**Status:** Design Complete - Ready for Implementation

---

**END OF SIMPLE TESTER ROLE WITH SESSION ACCESS DESIGN**
