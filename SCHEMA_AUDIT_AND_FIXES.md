# Complete Schema Audit and Comprehensive Fix

**Date**: February 5, 2026
**Purpose**: Audit ALL SQL queries against actual database schema and fix ALL mismatches

---

## ACTUAL DATABASE SCHEMA

### users table (from 000_initial_schema.sql + migration 010)
```sql
- user_id UUID PRIMARY KEY
- organization_id UUID NOT NULL
- email VARCHAR(255) NOT NULL
- username VARCHAR(100) NOT NULL              -- REQUIRED
- password_hash VARCHAR(255) NOT NULL         -- REQUIRED
- first_name VARCHAR(100)                     -- NULLABLE
- last_name VARCHAR(100)                      -- NULLABLE
- is_active BOOLEAN DEFAULT true
- email_verified BOOLEAN DEFAULT false
- last_login_at TIMESTAMPTZ
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
- preferences JSONB
- user_role VARCHAR(50) DEFAULT 'admin'       -- Added by migration 010
```

**Key Points**:
- ❌ NO `name` column (uses first_name + last_name)
- ❌ NO `role` column (uses `user_role`)
- ✅ `username` is REQUIRED
- ✅ `password_hash` is REQUIRED

### session_access table (from migration 011)
```sql
- access_id UUID PRIMARY KEY
- user_id UUID NOT NULL
- session_id UUID NOT NULL
- granted_by UUID NOT NULL
- granted_at TIMESTAMPTZ DEFAULT NOW()
```

✅ TABLE EXISTS

### user_invitations table (from migration 012)
```sql
- invitation_id UUID PRIMARY KEY
- email VARCHAR(255) NOT NULL
- session_id UUID NOT NULL
- invited_by UUID NOT NULL
- token VARCHAR(255) NOT NULL UNIQUE
- expires_at TIMESTAMPTZ NOT NULL
- accepted_at TIMESTAMPTZ
- accepted_by UUID
- created_at TIMESTAMPTZ DEFAULT NOW()
```

✅ TABLE EXISTS

### review_sessions table (from 002_add_review_sessions.sql)
```sql
- session_id UUID PRIMARY KEY
- organization_id UUID NOT NULL
- overlay_id UUID NOT NULL
- name VARCHAR(255) NOT NULL
- description TEXT
- session_type VARCHAR(50)
- status VARCHAR(50)
- ... (other columns)
```

✅ TABLE EXISTS

---

## SQL QUERY AUDIT - lambda/functions/api/invitations/index.js

### Query 1 (Line 80): Check admin permissions ✅ CORRECT
```javascript
SELECT user_id, user_role FROM users WHERE user_id = $1
```
**Status**: ✅ Columns exist

### Query 2 (Line 106): Verify session exists ✅ CORRECT
```javascript
SELECT session_id, name FROM review_sessions WHERE session_id = $1 AND is_active = true
```
**Status**: ❌ WRONG - `is_active` column doesn't exist in review_sessions!
**Fix**: Use `status` column instead

### Query 3 (Line 121): Check existing user ✅ CORRECT
```javascript
SELECT user_id, user_role FROM users WHERE email = $1
```
**Status**: ✅ Columns exist

### Query 4 (Line 130): Check session access ✅ CORRECT
```javascript
SELECT 1 FROM session_access WHERE user_id = $1 AND session_id = $2
```
**Status**: ✅ Table and columns exist

### Query 5 (Line 146): Grant access ✅ CORRECT
```javascript
INSERT INTO session_access (user_id, session_id, granted_by) VALUES ($1, $2, $3)
```
**Status**: ✅ Columns exist

### Query 6 (Line 167): Check existing invitation ✅ CORRECT
```javascript
SELECT invitation_id, token FROM user_invitations WHERE email = $1 AND session_id = $2 AND accepted_at IS NULL
```
**Status**: ✅ Columns exist

### Query 7 (Line 177): Update invitation ✅ CORRECT
```javascript
UPDATE user_invitations SET token = $1, expires_at = $2, invited_by = $3 WHERE invitation_id = $4
```
**Status**: ✅ Columns exist

### Query 8 (Line 189): Create invitation ✅ CORRECT
```javascript
INSERT INTO user_invitations (email, session_id, invited_by, token, expires_at) VALUES ($1, $2, $3, $4, $5)
```
**Status**: ✅ Columns exist

### Query 9 (Line 238-249): Get invitation details ✅ CORRECT
```javascript
SELECT
  i.invitation_id,
  i.email,
  i.expires_at,
  i.accepted_at,
  s.session_id,
  s.name as session_name,
  s.description as session_description
FROM user_invitations i
JOIN review_sessions s ON i.session_id = s.session_id
WHERE i.token = $1
```
**Status**: ✅ All columns exist

### Query 10 (Line 286): Get inviter name ✅ CORRECT (ALREADY FIXED)
```javascript
SELECT first_name, last_name FROM users WHERE user_id = (SELECT invited_by FROM user_invitations WHERE token = $1)
```
**Status**: ✅ Columns exist

### Query 11 (Line 324-334): Get invitation for acceptance ✅ CORRECT
```javascript
SELECT
  i.invitation_id,
  i.email,
  i.session_id,
  i.invited_by,
  i.expires_at,
  i.accepted_at
FROM user_invitations i
WHERE i.token = $1
```
**Status**: ✅ All columns exist

### Query 12 (Line 365): Check existing user ✅ CORRECT
```javascript
SELECT user_id FROM users WHERE email = $1
```
**Status**: ✅ Column exists

### Query 13 (Line 385): Get organization ✅ CORRECT
```javascript
SELECT organization_id FROM users WHERE user_id = $1
```
**Status**: ✅ Column exists

### Query 14 (Line 403): INSERT new user ✅ CORRECT (ALREADY FIXED)
```javascript
INSERT INTO users (
  email,
  username,
  password_hash,
  first_name,
  last_name,
  user_role,
  organization_id,
  email_verified,
  is_active
) VALUES ($1, $2, $3, $4, $5, 'analyst', $6, true, true)
```
**Status**: ✅ All required columns included

### Query 15 (Line 422): Grant session access ✅ CORRECT
```javascript
INSERT INTO session_access (user_id, session_id, granted_by) VALUES ($1, $2, $3)
```
**Status**: ✅ Columns exist

### Query 16 (Line 434): Mark invitation accepted ✅ CORRECT
```javascript
UPDATE user_invitations SET accepted_at = CURRENT_TIMESTAMP, accepted_by = $1 WHERE invitation_id = $2
```
**Status**: ✅ Columns exist

---

## SQL QUERY AUDIT - lambda/functions/api/users/index.js

### Query 1 (Line 58): Get current user ✅ CORRECT (ALREADY FIXED)
```javascript
SELECT user_id, email, first_name, last_name, user_role as role, created_at
FROM users
WHERE user_id = $1
```
**Status**: ✅ All columns exist

---

## ISSUES FOUND

### Issue #1: review_sessions.is_active column doesn't exist ❌

**Location**: lambda/functions/api/invitations/index.js:106

**Current Query**:
```javascript
const sessionQuery = await dbClient.query(
  'SELECT session_id, name FROM review_sessions WHERE session_id = $1 AND is_active = true',
  [sessionId]
);
```

**Problem**: `is_active` column doesn't exist in review_sessions table. The table has a `status` column instead.

**Fix**: Change condition to check status:
```javascript
const sessionQuery = await dbClient.query(
  'SELECT session_id, name FROM review_sessions WHERE session_id = $1 AND status != '\''archived'\''',
  [sessionId]
);
```

---

## COMPLETE FIX

### File: lambda/functions/api/invitations/index.js
### Line: 105-108

**Before**:
```javascript
// Verify session exists
const sessionQuery = await dbClient.query(
  'SELECT session_id, name FROM review_sessions WHERE session_id = $1 AND is_active = true',
  [sessionId]
);
```

**After**:
```javascript
// Verify session exists (check status instead of is_active which doesn't exist)
const sessionQuery = await dbClient.query(
  'SELECT session_id, name FROM review_sessions WHERE session_id = $1 AND status NOT IN (' + '\'archived\', \'cancelled\')',
  [sessionId]
);
```

---

## VERIFICATION - Complete Invitation Flow

### Step 1: Create Invitation (POST /sessions/{sessionId}/invitations)
1. ✅ Query users for admin permission check - uses `user_role` column
2. ❌ Query review_sessions - currently checks `is_active` (WRONG!)
3. ✅ Check existing user by email
4. ✅ Check session_access table
5. ✅ INSERT or UPDATE user_invitations

**SQL Queries**: 5 total, 1 wrong

### Step 2: Load Signup Page (GET /invitations/{token})
1. ✅ Query user_invitations joined with review_sessions
2. ✅ Query users for inviter name - uses `first_name, last_name`

**SQL Queries**: 2 total, all correct

### Step 3: Accept Invitation (POST /invitations/{token}/accept)
1. ✅ Query user_invitations for invitation details
2. ✅ Check if user exists
3. ✅ Get organization_id from inviter
4. ✅ INSERT new user - includes all required columns
5. ✅ INSERT into session_access
6. ✅ UPDATE user_invitations to mark accepted

**SQL Queries**: 6 total, all correct

---

## SUMMARY

**Total Queries Audited**: 16
**Queries with Issues**: 1
**Issues Fixed Already**: 3 (username/password_hash, name→first_name/last_name, inviter name)
**Issues Remaining**: 1 (is_active→status in review_sessions)

---

## FILES TO UPDATE

1. ✅ lambda/functions/api/users/index.js - ALREADY FIXED
2. ✅ lambda/functions/api/invitations/index.js (user creation) - ALREADY FIXED
3. ❌ lambda/functions/api/invitations/index.js (session query) - NEEDS FIX

---

## DEPLOYMENT PLAN

1. Fix review_sessions.is_active → status check
2. Deploy OverlayComputeStack
3. Test complete flow:
   - Create invitation
   - Load signup page
   - Submit signup form
   - Verify user created
   - Verify session access granted

---

*Audit completed: February 5, 2026*
*Next action: Fix is_active issue and deploy*
