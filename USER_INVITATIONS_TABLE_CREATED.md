# user_invitations Table Created - February 5, 2026

## Problem Resolved

The `user_invitations` table was missing from the production database, causing the analyst invitation/signup flow to fail.

## Root Cause

- **Migration 011** (session_access): Failed with transaction abort errors (successCount=3, errorCount=8)
- **Migration 012** (user_invitations): Failed with transaction abort errors (successCount=3, errorCount=10)
- Once migration 011 failed, all subsequent statements in 012 were aborted due to PostgreSQL transaction semantics

## Solution Implemented

### Step 1: Disabled Failed Migrations

Renamed the following migration files to `.disabled`:
- `011_create_session_access.sql` (not needed - we use session_participants instead)
- `012_create_user_invitations.sql` (failed original)
- `015_create_missing_tables.sql` (failed repair attempt)
- `016_create_tables_simple.sql` (failed repair attempt)

### Step 2: Created Clean Migration

Created `017_create_user_invitations_clean.sql` with:
- CREATE TABLE IF NOT EXISTS user_invitations
- 5 indexes (email, token, session_id, expires_at, invited_by)
- Verification block to ensure table creation

### Step 3: Deployed and Executed

```bash
# Deployed OrchestrationStack with updated migrations
cdk deploy OverlayOrchestrationStack --require-approval never

# Ran migration Lambda
aws lambda invoke \
  --function-name overlay-database-migration \
  --cli-binary-format raw-in-base64-out \
  migration-response.json
```

### Step 4: Verification

Migration 017 results:
```json
{
  "fileName": "017_create_user_invitations_clean.sql",
  "successCount": 8,
  "errorCount": 0,
  "errors": []
}
```

✅ **SUCCESS**: Table created with all columns and indexes

## Table Schema

```sql
CREATE TABLE user_invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(user_id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_session_unique UNIQUE(email, session_id)
);
```

### Indexes Created

1. `idx_invitations_email` ON user_invitations(email)
2. `idx_invitations_token` ON user_invitations(token)
3. `idx_invitations_session` ON user_invitations(session_id)
4. `idx_invitations_expires` ON user_invitations(expires_at)
5. `idx_invitations_invited_by` ON user_invitations(invited_by)

## Impact

The following endpoints now have all required tables:

1. **POST /sessions/{sessionId}/invitations**
   - Creates invitation record in user_invitations ✅
   - Checks/creates access in session_participants ✅

2. **GET /invitations/{token}**
   - Retrieves invitation from user_invitations ✅
   - Joins with review_sessions for session details ✅

3. **POST /invitations/{token}/accept**
   - Reads invitation from user_invitations ✅
   - Creates new user in users table ✅
   - Creates access in session_participants ✅
   - Updates accepted_at/accepted_by in user_invitations ✅

## Database Status

- **Total Tables**: 25
- **Total Indexes**: 155
- **Organizations**: 17
- **Users**: 15
- **Overlays**: 21
- **Evaluation Criteria**: 2,366

## Next Steps

1. Test complete signup flow:
   - Admin creates invitation
   - Load signup page with token
   - Submit signup form
   - Verify analyst can login
   - Verify analyst can access assigned session

2. Clean up disabled migration files after confirming everything works

## Files Changed

### Disabled (Renamed to .disabled)
- `lambda/functions/database-migration/migrations/011_create_session_access.sql`
- `lambda/functions/database-migration/migrations/012_create_user_invitations.sql`
- `lambda/functions/database-migration/migrations/015_create_missing_tables.sql`
- `lambda/functions/database-migration/migrations/016_create_tables_simple.sql`

### Created
- `lambda/functions/database-migration/migrations/017_create_user_invitations_clean.sql`

### Deployed
- OverlayStorageStack (contains DatabaseMigrationFunction with updated migrations directory)

---

**Status**: ✅ READY FOR TESTING
**Date**: February 5, 2026 12:48 UTC
**Deployment**: Production
