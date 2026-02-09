---
name: rbac-implementation
description: Role-based access control patterns for multi-user applications. Use when implementing user roles, permission systems, admin-only features, resource ownership checks, or role-based filtering. Covers permission function design, API protection middleware, database filtering by role, ownership verification, and testing permissions across roles. Prevents unauthorized access, data leaks, and permission bypasses. Essential for any multi-role application.
---

# RBAC Implementation

Proven permission patterns from production multi-role systems.

## Core Principles

### 1. Deny by Default
**Everything requires explicit permission:**
- ❌ Allow access unless explicitly denied
- ✅ Deny access unless explicitly allowed

### 2. Check Permissions at Every Layer
**Defense in depth:**
- Frontend: Hide UI elements
- API: Verify permissions before processing
- Database: Filter queries by ownership/access

### 3. Separate Authentication from Authorization
**Authentication:** Who are you? (login, token verification)
**Authorization:** What can you do? (role checks, permissions)

## Permission Function Patterns

### Basic Role Checks
```javascript
// permissions.js
function isAdmin(user) {
  return user && user.user_role === 'admin';
}

function isAnalyst(user) {
  return user && user.user_role === 'analyst';
}

function hasRole(user, role) {
  return user && user.user_role === role;
}
```

### Permission Helpers
```javascript
// Check if user can perform admin actions
function canEdit(user) {
  return isAdmin(user);
}

// Check if user can view all data
function canViewAll(user) {
  return isAdmin(user);
}

// Check if user owns resource
function ownsResource(user, resource) {
  return user && resource && user.user_id === resource.created_by;
}

// Check if user can view specific resource
function canView(user, resource) {
  return isAdmin(user) || ownsResource(user, resource);
}

// Check if user can modify resource
function canModify(user, resource) {
  return isAdmin(user) || ownsResource(user, resource);
}

// Check if user can delete resource
function canDelete(user, resource) {
  return isAdmin(user) || ownsResource(user, resource);
}
```

### Session/Project Access Checks
```javascript
// Check if user has access to session (via session_access table)
async function hasSessionAccess(db, userId, sessionId) {
  // Admins have access to all sessions
  const adminCheck = await db.query(
    'SELECT user_role FROM users WHERE user_id = $1',
    [userId]
  );
  
  if (adminCheck.rows[0]?.user_role === 'admin') {
    return true;
  }
  
  // Check session_access table
  const accessCheck = await db.query(
    'SELECT 1 FROM session_access WHERE user_id = $1 AND session_id = $2',
    [userId, sessionId]
  );
  
  return accessCheck.rows.length > 0;
}

// Get all sessions user can access
async function getAccessibleSessions(db, userId) {
  // Check if admin
  const roleCheck = await db.query(
    'SELECT user_role FROM users WHERE user_id = $1',
    [userId]
  );
  
  if (roleCheck.rows[0]?.user_role === 'admin') {
    // Admin sees all sessions
    return db.query('SELECT * FROM review_sessions WHERE is_active = true');
  }
  
  // Analyst sees only assigned sessions
  return db.query(`
    SELECT s.* 
    FROM review_sessions s
    JOIN session_access sa ON s.session_id = sa.session_id
    WHERE sa.user_id = $1 AND s.is_active = true
  `, [userId]);
}
```

## API Protection Patterns

### Middleware Pattern
```javascript
// middleware/permissions.js
const { isAdmin, hasSessionAccess } = require('/opt/nodejs/permissions');

async function requireAdmin(user) {
  if (!isAdmin(user)) {
    throw new Error('Forbidden: Admin access required');
  }
}

async function requireSessionAccess(db, user, sessionId) {
  const hasAccess = await hasSessionAccess(db, user.user_id, sessionId);
  if (!hasAccess) {
    throw new Error('Forbidden: No access to this session');
  }
}

module.exports = { requireAdmin, requireSessionAccess };
```

### API Handler with Permission Checks
```javascript
const { isAdmin, canView } = require('/opt/nodejs/permissions');

exports.handler = async (event) => {
  const user = event.requestContext.authorizer; // From Cognito
  const db = await pool.connect();
  
  try {
    // Route: GET /overlays
    if (event.httpMethod === 'GET' && event.path === '/overlays') {
      // Anyone can list (but see filtering below)
      const overlays = await db.query('SELECT * FROM overlays');
      return { statusCode: 200, body: JSON.stringify(overlays.rows) };
    }
    
    // Route: POST /overlays (admin only)
    if (event.httpMethod === 'POST' && event.path === '/overlays') {
      if (!isAdmin(user)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden: Admin access required' })
        };
      }
      
      // Create overlay
      const data = JSON.parse(event.body);
      const result = await db.query(
        'INSERT INTO overlays (name, template) VALUES ($1, $2) RETURNING *',
        [data.name, data.template]
      );
      return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
    }
    
    // Route: GET /submissions/:id
    if (event.httpMethod === 'GET' && event.path.startsWith('/submissions/')) {
      const submissionId = event.pathParameters.id;
      
      // Get submission
      const result = await db.query(
        'SELECT * FROM submissions WHERE submission_id = $1',
        [submissionId]
      );
      
      if (result.rows.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      }
      
      const submission = result.rows[0];
      
      // Check permission
      if (!canView(user, submission)) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Forbidden: Cannot view this submission' })
        };
      }
      
      return { statusCode: 200, body: JSON.stringify(submission) };
    }
    
  } finally {
    db.release();
  }
};
```

## Database Filtering Patterns

### Filter by Role
```javascript
// Get submissions based on role
async function getSubmissions(db, user) {
  if (isAdmin(user)) {
    // Admin sees all submissions
    return db.query('SELECT * FROM submissions ORDER BY created_at DESC');
  }
  
  // Analyst sees only own submissions
  return db.query(
    'SELECT * FROM submissions WHERE created_by = $1 ORDER BY created_at DESC',
    [user.user_id]
  );
}
```

### Filter by Session Access
```javascript
// Get submissions from accessible sessions
async function getSessionSubmissions(db, user, sessionId) {
  // Verify session access first
  const hasAccess = await hasSessionAccess(db, user.user_id, sessionId);
  
  if (!hasAccess) {
    throw new Error('Forbidden: No access to this session');
  }
  
  if (isAdmin(user)) {
    // Admin sees all submissions in session
    return db.query(
      'SELECT * FROM submissions WHERE session_id = $1',
      [sessionId]
    );
  }
  
  // Analyst sees only own submissions in session
  return db.query(
    'SELECT * FROM submissions WHERE session_id = $1 AND created_by = $2',
    [sessionId, user.user_id]
  );
}
```

### Filter Notes by User
```javascript
// Get notes based on role
async function getNotes(db, user, submissionId) {
  // Verify submission access first
  const submission = await db.query(
    'SELECT * FROM submissions WHERE submission_id = $1',
    [submissionId]
  );
  
  if (submission.rows.length === 0) {
    throw new Error('Submission not found');
  }
  
  if (!canView(user, submission.rows[0])) {
    throw new Error('Forbidden: Cannot view this submission');
  }
  
  if (isAdmin(user)) {
    // Admin sees all notes on submission
    return db.query(
      'SELECT * FROM user_notes WHERE submission_id = $1',
      [submissionId]
    );
  }
  
  // Analyst sees only own notes
  return db.query(
    'SELECT * FROM user_notes WHERE submission_id = $1 AND created_by = $2',
    [submissionId, user.user_id]
  );
}
```

## Frontend Permission Patterns

### Conditional Rendering
```javascript
// React component
import { useUser } from './hooks/useUser';

function SessionDetail({ session }) {
  const { user, isAdmin } = useUser();
  
  return (
    <div>
      <h1>{session.name}</h1>
      
      {/* Show invite button only to admins */}
      {isAdmin && (
        <button onClick={handleInvite}>Invite Analyst</button>
      )}
      
      {/* Show edit button only to admins */}
      {isAdmin && (
        <button onClick={handleEdit}>Edit Criteria</button>
      )}
      
      {/* Everyone can submit */}
      <button onClick={handleSubmit}>Submit Document</button>
    </div>
  );
}
```

### Protected Routes
```javascript
// ProtectedRoute component
function ProtectedRoute({ children, requireAdmin }) {
  const { user, isAdmin } = useUser();
  
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}

// Usage in routes
<Route path="/admin" element={
  <ProtectedRoute requireAdmin>
    <AdminDashboard />
  </ProtectedRoute>
} />
```

### Role-Based Navigation
```javascript
function Navigation() {
  const { isAdmin } = useUser();
  
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/my-analyses">My Analyses</Link>
      
      {isAdmin && (
        <>
          <Link to="/create-session">Create Session</Link>
          <Link to="/manage-users">Manage Users</Link>
          <Link to="/analytics">Analytics</Link>
        </>
      )}
    </nav>
  );
}
```

## Permission Testing Patterns

### Unit Tests for Permission Functions
```javascript
// permissions.test.js
const { isAdmin, canView, canEdit } = require('./permissions');

describe('Permission Functions', () => {
  const admin = { user_id: '1', user_role: 'admin' };
  const analyst = { user_id: '2', user_role: 'analyst' };
  const resource = { id: '123', created_by: '2' };
  
  test('isAdmin returns true for admin', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(analyst)).toBe(false);
  });
  
  test('canView allows admin to view all', () => {
    expect(canView(admin, resource)).toBe(true);
  });
  
  test('canView allows user to view own resources', () => {
    expect(canView(analyst, resource)).toBe(true);
  });
  
  test('canView denies user viewing others resources', () => {
    const otherResource = { id: '456', created_by: '999' };
    expect(canView(analyst, otherResource)).toBe(false);
  });
  
  test('canEdit allows only admin', () => {
    expect(canEdit(admin)).toBe(true);
    expect(canEdit(analyst)).toBe(false);
  });
});
```

### Integration Tests for API Endpoints
```javascript
// api.test.js
describe('API Permissions', () => {
  test('POST /overlays returns 403 for non-admin', async () => {
    const response = await request(app)
      .post('/overlays')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ name: 'Test Overlay' });
    
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Admin access required');
  });
  
  test('POST /overlays succeeds for admin', async () => {
    const response = await request(app)
      .post('/overlays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Overlay' });
    
    expect(response.status).toBe(201);
  });
  
  test('GET /submissions returns only own for analyst', async () => {
    const response = await request(app)
      .get('/submissions')
      .set('Authorization', `Bearer ${analystToken}`);
    
    expect(response.status).toBe(200);
    const submissions = response.body;
    
    // Verify all submissions belong to analyst
    submissions.forEach(sub => {
      expect(sub.created_by).toBe(analystUserId);
    });
  });
  
  test('GET /submissions returns all for admin', async () => {
    const response = await request(app)
      .get('/submissions')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(200);
    const submissions = response.body;
    
    // Should include submissions from multiple users
    const creators = [...new Set(submissions.map(s => s.created_by))];
    expect(creators.length).toBeGreaterThan(1);
  });
});
```

### Manual Testing Checklist
```markdown
## Admin Tests
- [ ] Admin can create/edit/delete overlays
- [ ] Admin can create/edit/delete sessions
- [ ] Admin can invite analysts
- [ ] Admin can view all submissions
- [ ] Admin can view all notes
- [ ] Admin can access analytics

## Analyst Tests
- [ ] Analyst sees only assigned sessions
- [ ] Analyst can submit to assigned sessions
- [ ] Analyst can view own submissions only
- [ ] Analyst can add notes to own submissions
- [ ] Analyst sees only own notes
- [ ] Analyst cannot create/edit overlays (403)
- [ ] Analyst cannot create/edit sessions (403)
- [ ] Analyst cannot invite others (403)
- [ ] Analyst cannot view unassigned sessions (404/403)
- [ ] Analyst cannot view others' submissions (403)

## Data Isolation Tests
- [ ] Query DB as admin: COUNT(*) FROM submissions
- [ ] Query DB as analyst: COUNT(*) FROM submissions WHERE created_by = analyst_id
- [ ] Verify admin count >= analyst count
- [ ] Verify analyst sees exact number of own submissions
```

## Common Permission Patterns

### Pattern 1: Owner-Only Access
```javascript
// Only owner can modify
async function updateResource(db, user, resourceId, updates) {
  const resource = await db.query(
    'SELECT * FROM resources WHERE resource_id = $1',
    [resourceId]
  );
  
  if (resource.rows.length === 0) {
    throw new Error('Not found');
  }
  
  if (!ownsResource(user, resource.rows[0])) {
    throw new Error('Forbidden: You can only modify your own resources');
  }
  
  return db.query(
    'UPDATE resources SET name = $1 WHERE resource_id = $2 RETURNING *',
    [updates.name, resourceId]
  );
}
```

### Pattern 2: Admin or Owner Access
```javascript
// Admin or owner can view
async function getResource(db, user, resourceId) {
  const resource = await db.query(
    'SELECT * FROM resources WHERE resource_id = $1',
    [resourceId]
  );
  
  if (resource.rows.length === 0) {
    throw new Error('Not found');
  }
  
  if (!canView(user, resource.rows[0])) {
    throw new Error('Forbidden: Cannot view this resource');
  }
  
  return resource.rows[0];
}
```

### Pattern 3: Team/Project-Based Access
```javascript
// User must be member of project
async function hasProjectAccess(db, userId, projectId) {
  const result = await db.query(
    'SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2',
    [userId, projectId]
  );
  
  return result.rows.length > 0;
}

async function getProjectData(db, user, projectId) {
  if (!await hasProjectAccess(db, user.user_id, projectId)) {
    throw new Error('Forbidden: Not a member of this project');
  }
  
  return db.query(
    'SELECT * FROM project_data WHERE project_id = $1',
    [projectId]
  );
}
```

### Pattern 4: Hierarchical Permissions
```javascript
// Roles with hierarchy: admin > manager > user
const ROLE_HIERARCHY = {
  admin: 3,
  manager: 2,
  user: 1
};

function hasRoleLevel(user, requiredLevel) {
  const userLevel = ROLE_HIERARCHY[user.user_role] || 0;
  const required = ROLE_HIERARCHY[requiredLevel] || 0;
  return userLevel >= required;
}

// Example usage
function canApprove(user) {
  return hasRoleLevel(user, 'manager'); // manager or admin can approve
}

function canConfigureSystem(user) {
  return hasRoleLevel(user, 'admin'); // only admin
}
```

## Security Best Practices

### 1. Never Trust Frontend
**Frontend hiding is UX, not security:**
```javascript
// ❌ Bad: Only hiding button
<button style={{ display: isAdmin ? 'block' : 'none' }}>Delete</button>

// ✅ Good: Hide button AND check permission in API
// Frontend:
{isAdmin && <button onClick={handleDelete}>Delete</button>}

// Backend:
if (!isAdmin(user)) {
  return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
}
```

### 2. Check Permissions on Every Request
**Don't cache permission decisions:**
```javascript
// ❌ Bad: Check once and cache
const isAdmin = checkIsAdmin(user); // Cached for session

// ✅ Good: Check every time
if (!isAdmin(user)) { ... } // Fresh check each request
```

### 3. Fail Closed, Not Open
**Default to denying access:**
```javascript
// ❌ Bad: Allow if any condition true
if (isAdmin || ownsResource || isMember) {
  allow();
}

// ✅ Good: Explicit conditions
if (isAdmin(user)) {
  allow();
} else if (ownsResource(user, resource)) {
  allow();
} else {
  deny();
}
```

### 4. Log Permission Denials
**Track attempted unauthorized access:**
```javascript
if (!isAdmin(user)) {
  console.log(JSON.stringify({
    level: 'WARNING',
    event: 'permission_denied',
    user_id: user.user_id,
    user_role: user.user_role,
    action: 'create_overlay',
    timestamp: new Date().toISOString()
  }));
  
  return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
}
```

### 5. Use Database Constraints
**Enforce ownership at DB level:**
```sql
-- Add check constraint
ALTER TABLE submissions 
ADD CONSTRAINT check_owner_or_admin 
CHECK (
  created_by IN (SELECT user_id FROM users WHERE user_role = 'admin')
  OR created_by = current_user_id() -- Assuming row-level security
);
```

## Quick Reference

### Permission Function Checklist
When implementing new permission:
- [ ] Create `canDoAction(user, resource)` function
- [ ] Handle admin special case
- [ ] Handle owner special case
- [ ] Handle team/project access
- [ ] Return boolean (true/false)
- [ ] Write unit tests

### API Endpoint Checklist
When protecting endpoint:
- [ ] Extract user from auth context
- [ ] Check permission before processing
- [ ] Return 403 if unauthorized
- [ ] Filter query results by permission
- [ ] Log permission denials
- [ ] Write integration tests

### Frontend Component Checklist
When showing role-based UI:
- [ ] Conditionally render based on role
- [ ] Hide sensitive actions from non-admins
- [ ] Don't rely on hiding for security
- [ ] Test with different roles
- [ ] Verify backend enforces permissions

---

**Remember:** Permissions are about trust boundaries. Never trust the frontend, always verify at the API layer, and use database filtering as defense in depth!
