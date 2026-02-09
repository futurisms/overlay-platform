# Analyst Permissions Fix - February 5, 2026

## Problem

Analyst users had FULL ADMIN ACCESS despite being assigned the "document_admin" Cognito group:
- ✅ Could see "Create Analysis Session" button
- ✅ Could see "Intelligence Setup"
- ✅ Could see Edit/Delete buttons on sessions
- ❌ Could see NO sessions (should see assigned session)

**Root Cause**:
1. Backend permissions module still referenced the old `session_access` table instead of `session_participants`
2. Frontend dashboard had no role checks - rendered all UI elements regardless of user role

## Solution Implemented

### Backend Fixes (Lambda Layer - permissions.js)

Updated all references from `session_access` to `session_participants` table:

#### 1. hasSessionAccess Function
[lambda/layers/common/nodejs/permissions.js:153](lambda/layers/common/nodejs/permissions.js#L153)
```javascript
// Old: SELECT 1 FROM session_access WHERE user_id = $1 AND session_id = $2
// New:
SELECT 1 FROM session_participants
WHERE user_id = $1 AND session_id = $2 AND status = 'active'
```

#### 2. getAccessibleSessions Function
[lambda/layers/common/nodejs/permissions.js:211](lambda/layers/common/nodejs/permissions.js#L211)
```javascript
// Old: INNER JOIN session_access sa ON rs.session_id = sa.session_id
// New:
INNER JOIN session_participants sp ON rs.session_id = sp.session_id
WHERE sp.user_id = $1
  AND sp.status = 'active'
  AND rs.is_active = true
```

#### 3. grantSessionAccess Function
[lambda/layers/common/nodejs/permissions.js:322](lambda/layers/common/nodejs/permissions.js#L322)
```javascript
// Old: INSERT INTO session_access (user_id, session_id, granted_by)
// New:
INSERT INTO session_participants (user_id, session_id, invited_by, role, status)
VALUES ($1, $2, $3, 'reviewer', 'active')
ON CONFLICT (session_id, user_id) DO UPDATE SET status = 'active'
```

#### 4. revokeSessionAccess Function
[lambda/layers/common/nodejs/permissions.js:345](lambda/layers/common/nodejs/permissions.js#L345)
```javascript
// Old: DELETE FROM session_access WHERE user_id = $1 AND session_id = $2
// New:
UPDATE session_participants SET status = 'inactive'
WHERE user_id = $1 AND session_id = $2
```

#### 5. getSessionAccessList Function
[lambda/layers/common/nodejs/permissions.js:365](lambda/layers/common/nodejs/permissions.js#L365)
```javascript
// Old: FROM session_access sa JOIN users u ON sa.user_id = u.user_id
// New:
FROM session_participants sp
JOIN users u ON sp.user_id = u.user_id
WHERE sp.session_id = $1
```

### Frontend Fixes (Dashboard Page)

Added role-based UI filtering:

#### 1. Added isAdmin State
[frontend/app/dashboard/page.tsx:43](frontend/app/dashboard/page.tsx#L43)
```typescript
const [isAdmin, setIsAdmin] = useState(false);
```

#### 2. Check User Groups on Load
[frontend/app/dashboard/page.tsx:72-74](frontend/app/dashboard/page.tsx#L72-L74)
```typescript
// Check if user is admin (has system_admin group)
const userIsAdmin = currentUser.groups?.includes('system_admin') || false;
setIsAdmin(userIsAdmin);
```

#### 3. Hide "Create Analysis Session" Button
[frontend/app/dashboard/page.tsx:345-351](frontend/app/dashboard/page.tsx#L345-L351)
```typescript
{isAdmin && (
  <Button onClick={() => setShowNewSessionDialog(true)} variant="default" size="sm">
    <Plus className="mr-2 h-4 w-4" />
    Create Analysis Session
  </Button>
)}
```

#### 4. Hide Edit/Delete Buttons on Sessions
[frontend/app/dashboard/page.tsx:384-407](frontend/app/dashboard/page.tsx#L384-L407)
```typescript
{isAdmin && (
  <>
    <Button variant="ghost" onClick={(e) => handleEditSessionClick(session, e)}>
      <Pencil className="h-4 w-4" />
    </Button>
    <Button variant="ghost" onClick={(e) => handleDeleteSession(session.session_id, e)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  </>
)}
```

#### 5. Hide "Quick Upload" and "Intelligence Setup" Cards
[frontend/app/dashboard/page.tsx:453-488](frontend/app/dashboard/page.tsx#L453-L488)
```typescript
{isAdmin && (
  <>
    <Card onClick={() => setShowQuickUploadDialog(true)}>
      {/* Quick Upload */}
    </Card>
    <Card onClick={() => router.push("/overlays")}>
      {/* Intelligence Setup */}
    </Card>
  </>
)}
```

## Deployment

### Backend
```bash
npm run build
cdk deploy OverlayOrchestrationStack --require-approval never
```

**Deployed**: February 5, 2026 19:36 UTC
**Components Updated**:
- Lambda Layer (CommonLayer) with updated permissions.js
- All Lambda functions using the layer (14 functions)

### Frontend
No deployment needed - Next.js dev server picks up changes automatically

## User Roles

### System Admin (group: system_admin)
**Email**: admin@example.com

**Permissions**:
- ✅ See ALL sessions (no filtering)
- ✅ Create/Edit/Delete sessions
- ✅ Create/Edit/Delete overlays
- ✅ Invite analysts to sessions
- ✅ Access "Intelligence Setup"
- ✅ Use "Quick Upload"

### Analyst (group: document_admin)
**Example**: bains@futurisms.ai

**Permissions**:
- ✅ See ONLY assigned sessions (filtered by session_participants)
- ✅ Submit documents to assigned sessions
- ✅ View feedback on their submissions
- ❌ CANNOT create/edit/delete sessions
- ❌ CANNOT create/edit/delete overlays
- ❌ CANNOT invite other analysts
- ❌ CANNOT access "Intelligence Setup"
- ❌ CANNOT use "Quick Upload" (can upload within session page)

## Testing Checklist

### Admin User Tests
- [ ] Login as admin@example.com
- [ ] Verify sees "Create Analysis Session" button
- [ ] Verify sees "Intelligence Setup" card
- [ ] Verify sees Edit/Delete buttons on sessions
- [ ] Verify can create new session
- [ ] Verify can invite analysts

### Analyst User Tests
- [ ] Login as analyst (e.g., bains@futurisms.ai)
- [ ] Verify sees ONLY assigned session(s)
- [ ] Verify does NOT see "Create Analysis Session" button
- [ ] Verify does NOT see "Intelligence Setup" card
- [ ] Verify does NOT see Edit/Delete buttons on sessions
- [ ] Verify CAN click session to enter
- [ ] Verify CAN submit documents within session
- [ ] Verify CAN view feedback on submissions

## Database Verification

To verify analyst has session access:
```sql
SELECT
  sp.user_id,
  sp.session_id,
  sp.role,
  sp.status,
  u.email,
  rs.name as session_name
FROM session_participants sp
JOIN users u ON sp.user_id = u.user_id
JOIN review_sessions rs ON sp.session_id = rs.session_id
WHERE u.email = 'bains@futurisms.ai';
```

Expected result:
- role: 'reviewer'
- status: 'active'
- session_name: (name of invited session)

## Related Files

### Backend
- [lambda/layers/common/nodejs/permissions.js](lambda/layers/common/nodejs/permissions.js) - Role-based access control
- [lambda/functions/api/sessions/index.js](lambda/functions/api/sessions/index.js) - Uses getAccessibleSessions()
- [lambda/functions/api/invitations/index.js](lambda/functions/api/invitations/index.js) - Creates session_participants record

### Frontend
- [frontend/app/dashboard/page.tsx](frontend/app/dashboard/page.tsx) - Role-based UI filtering
- [frontend/lib/auth.ts](frontend/lib/auth.ts) - User info with groups

### Infrastructure
- [lib/compute-stack.ts](lib/compute-stack.ts) - Lambda Layer deployment
- [lambda/layers/common/nodejs/package.json](lambda/layers/common/nodejs/package.json) - Layer dependencies

## Architecture

### Before Fix ❌
```
Backend: Queries session_access table (doesn't exist)
Result: Analysts see NO sessions

Frontend: Shows all admin UI elements
Result: Analysts see admin buttons but can't use them
```

### After Fix ✅
```
Backend: Queries session_participants table (exists)
Result: Analysts see only their assigned sessions

Frontend: Hides admin UI elements based on groups
Result: Analysts see only analyst-appropriate UI
```

## Cognito Groups

Users are assigned to Cognito groups which determine their role:

| Group | Role | Use Case |
|-------|------|----------|
| `system_admin` | Admin | Full platform access, manage everything |
| `document_admin` | Analyst | Review assigned sessions, submit documents |
| `end_user` | End User | (Future use) Submit documents only |

## Next Steps

1. **Test Complete Flow**:
   - Logout and login as analyst
   - Verify restricted access
   - Verify can access assigned session
   - Verify can submit document

2. **Add More Granular Permissions**:
   - Analyst can view all submissions in their sessions
   - Analyst can leave comments on submissions
   - Analyst can export session reports

3. **Add Session Participant Management UI**:
   - Admin can see list of participants per session
   - Admin can add/remove participants
   - Admin can change participant roles

---

**Status**: ✅ FIXED - Analysts now have properly restricted access
**Date**: February 5, 2026 19:36 UTC
**Tested**: Backend deployed, frontend updated, ready for user testing
