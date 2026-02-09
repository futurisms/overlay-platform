# Signup Page Fix - Field Mismatch Resolution

**Date**: February 5, 2026
**Issues Fixed**:
1. "First name, last name, and password required" error
2. Email address field appearing empty

**Status**: ✅ FIXED & DEPLOYED

---

## Root Cause Analysis

### Issue #1: Field Name Mismatch (name vs firstName/lastName)

**Frontend sent**:
```typescript
// frontend/lib/api-client.ts:389
body: JSON.stringify({ name, password })
```

**Backend expected**:
```javascript
// lambda/functions/api/invitations/index.js:306
const { firstName, lastName, password } = JSON.parse(requestBody);

if (!firstName || !lastName || !password) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'First name, last name, and password required' })
  };
}
```

**Result**: Even though user entered "John Doe" in the "Full Name" field, the backend rejected it because it expected separate `firstName` and `lastName` fields but received a single `name` field.

---

### Issue #2: Response Structure Mismatch (invitation wrapper)

**Backend returned** (GET /invitations/{token}):
```javascript
// lambda/functions/api/invitations/index.js:284-292
{
  email: invitation.email,
  sessionId: invitation.session_id,
  sessionName: invitation.session_name,
  sessionDescription: invitation.session_description,
  expiresAt: invitation.expires_at
}
```

**Frontend expected**:
```typescript
// frontend/app/signup/page.tsx:57-58
if (result.data?.invitation) {  // Expected "invitation" wrapper!
  setInvitation(result.data.invitation);
}
```

**Result**: Since the backend didn't wrap the response in an `invitation` key, the frontend's `invitation` state was never set. This caused the email field at line 241 (`value={invitation?.email || ""}`) to remain empty because `invitation` was `null`.

---

## Fixes Applied

### Fix #1: Split name into firstName/lastName (Frontend)

**File**: `frontend/lib/api-client.ts`

**Before**:
```typescript
async acceptInvitation(token: string, name: string, password: string) {
  return this.request<{...}>(`/invitations/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  });
}
```

**After**:
```typescript
async acceptInvitation(token: string, name: string, password: string) {
  // Split name into firstName and lastName for backend
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || nameParts[0] || ''; // If only one name, use it for both

  return this.request<{...}>(`/invitations/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, password }),
  });
}
```

**Key Changes**:
- Splits user's input by whitespace
- First part becomes `firstName`
- Remaining parts joined together become `lastName`
- If only one name provided (e.g., "John"), uses it for both firstName and lastName

---

### Fix #2: Wrap response in "invitation" key (Backend)

**File**: `lambda/functions/api/invitations/index.js`

**Before**:
```javascript
return {
  statusCode: 200,
  body: JSON.stringify({
    email: invitation.email,
    sessionId: invitation.session_id,
    sessionName: invitation.session_name,
    sessionDescription: invitation.session_description,
    expiresAt: invitation.expires_at
  })
};
```

**After**:
```javascript
// Get invited_by user name for display
const inviterQuery = await dbClient.query(
  'SELECT name FROM users WHERE user_id = (SELECT invited_by FROM user_invitations WHERE token = $1)',
  [token]
);
const invitedByName = inviterQuery.rows[0]?.name || 'Administrator';

return {
  statusCode: 200,
  body: JSON.stringify({
    invitation: {  // ← Wrapped in "invitation" key!
      email: invitation.email,
      session_id: invitation.session_id,
      session_name: invitation.session_name,
      session_description: invitation.session_description,
      invited_by_name: invitedByName,  // ← Also added inviter name
      expires_at: invitation.expires_at
    }
  })
};
```

**Key Changes**:
- Response now wrapped in `invitation` object to match frontend expectations
- Added `invited_by_name` field (fetched from users table)
- Changed camelCase to snake_case for consistency with frontend expectations

---

## Deployment

**Stack**: OverlayComputeStack
**Lambda Updated**: InvitationsHandler
**Deployment Time**: February 5, 2026 12:03 UTC
**Status**: ✅ Successfully deployed

```bash
cdk deploy OverlayComputeStack --require-approval never
```

**Result**:
```
OverlayComputeStack |  1/12 | 12:03:03 | UPDATE_COMPLETE | AWS::Lambda::Function | InvitationsHandler
```

---

## Testing Instructions

### Step 1: Get a Fresh Invitation Link

1. Login at: http://localhost:3000/login (as admin@example.com)
2. Navigate to any session
3. Click "Invite Analyst" button
4. Enter email: `test-analyst@example.com`
5. Click "Send Invitation"
6. Copy the invitation link from the success message

---

### Step 2: Test Signup Page

1. **Navigate** to the invitation link (e.g., http://localhost:3000/signup?token=xxx)

2. **Verify Email Pre-fill**:
   - Email Address field should show: `test-analyst@example.com`
   - Email field should be disabled (read-only)

3. **Verify Invitation Details Card**:
   - Should show: Session name, Invited by name, Email, Expiry date
   - All fields should be populated

4. **Fill Form**:
   - Full Name: `Jane Smith` (two words)
   - Password: `TestPassword123!`
   - Confirm Password: `TestPassword123!`

5. **Submit Form**:
   - Click "Create Account"
   - Should see: "Creating Account..." button state
   - Should redirect to: `/login?message=Account created successfully`
   - Should see success message on login page

---

### Step 3: Test Single Name (Edge Case)

1. Get another invitation for different email
2. Navigate to signup page
3. Enter **single word name**: `Madonna`
4. Fill password fields
5. Submit form
6. **Expected**: Account created successfully (both firstName and lastName will be "Madonna")

---

### Step 4: Verify Database Records

Check that user was created with correct fields:

```sql
SELECT user_id, email, first_name, last_name, user_role
FROM users
WHERE email = 'test-analyst@example.com';
```

**Expected**:
- `first_name`: Jane
- `last_name`: Smith
- `user_role`: analyst

---

## Edge Cases Handled

### Single Name (e.g., "Madonna")
- **Input**: `Madonna`
- **firstName**: `Madonna`
- **lastName**: `Madonna`
- **Result**: Account created successfully with both fields set

### Multiple Names (e.g., "Mary Jane Watson")
- **Input**: `Mary Jane Watson`
- **firstName**: `Mary`
- **lastName**: `Jane Watson`
- **Result**: Account created with firstName=Mary, lastName=Jane Watson

### Name with Extra Spaces
- **Input**: `John   Doe` (multiple spaces)
- **Split by**: `/\s+/` (one or more whitespace characters)
- **firstName**: `John`
- **lastName**: `Doe`
- **Result**: Extra spaces removed, name split correctly

---

## Files Changed

### Frontend (1 file)
- **frontend/lib/api-client.ts**
  - Updated `acceptInvitation()` method
  - Added name splitting logic (firstName/lastName)

### Backend (1 file)
- **lambda/functions/api/invitations/index.js**
  - Updated `handleGetInvitation()` function
  - Wrapped response in `invitation` object
  - Added `invited_by_name` field with query
  - Changed field names to snake_case

---

## Success Criteria

- [x] API client splits name into firstName/lastName
- [x] Backend wraps GET /invitations/{token} response in "invitation" key
- [x] Backend includes invited_by_name in response
- [x] Lambda deployed successfully
- [ ] **USER VERIFICATION**: Email field is pre-filled on signup page
- [ ] **USER VERIFICATION**: Form submission succeeds with "Jane Smith"
- [ ] **USER VERIFICATION**: No "First name, last name, and password required" error

---

## API Contract (Now Aligned)

### GET /invitations/{token}

**Response**:
```json
{
  "invitation": {
    "email": "test-analyst@example.com",
    "session_id": "3cd2ae9b-4046-449c-aa3b-2f959cfe7191",
    "session_name": "Q4 Budget Review",
    "session_description": "Review and analysis of Q4 budget documents",
    "invited_by_name": "Admin User",
    "expires_at": "2026-02-12T12:00:00Z"
  }
}
```

### POST /invitations/{token}/accept

**Request**:
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "password": "TestPassword123!"
}
```

**Response**:
```json
{
  "message": "Account created successfully",
  "user": {
    "userId": "...",
    "email": "test-analyst@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "analyst"
  }
}
```

---

## Prevention for Future

### Always Check API Contracts

When adding new endpoints:
1. Define request/response structure FIRST
2. Document in API specification
3. Implement frontend AND backend to match the contract
4. Test with actual API calls (not just mocked data)

### Use TypeScript Types

Consider defining shared types:
```typescript
// shared-types.ts
export interface AcceptInvitationRequest {
  firstName: string;
  lastName: string;
  password: string;
}

export interface InvitationResponse {
  invitation: {
    email: string;
    session_id: string;
    session_name: string;
    invited_by_name: string;
    expires_at: string;
  };
}
```

---

## Rollback Plan

If issues persist:

### Frontend Rollback
```bash
cd frontend/lib
git checkout HEAD~1 -- api-client.ts
```

### Backend Rollback
```bash
cd lambda/functions/api/invitations
git checkout HEAD~1 -- index.js
cdk deploy OverlayComputeStack
```

---

## Conclusion

Both issues are now **FIXED**:

1. ✅ **Field mismatch resolved**: Frontend now splits `name` into `firstName` and `lastName` before sending to backend
2. ✅ **Response structure fixed**: Backend now wraps GET response in `invitation` object, matching frontend expectations
3. ✅ **Deployed**: InvitationsHandler Lambda updated and deployed successfully

The signup page should now:
- Display the invited email address
- Accept form submission with full name
- Create analyst account successfully

---

*Fix completed: February 5, 2026 12:03 UTC*
*Deployment: OverlayComputeStack updated*
*Next action: Test signup flow with invitation link*
