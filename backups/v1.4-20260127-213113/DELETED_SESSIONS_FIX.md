# Fix for Deleted Sessions Reappearing

## Problem
Sessions marked as deleted/archived kept reappearing on the dashboard after refresh.

## Root Cause
The DELETE endpoint in [lambda/functions/sessions-crud-handler/index.js](lambda/functions/sessions-crud-handler/index.js:207-219) correctly sets `status = 'archived'` for deleted sessions:

```javascript
const query = `
  UPDATE review_sessions SET status = 'archived', updated_at = CURRENT_TIMESTAMP
  WHERE session_id = $1
  RETURNING session_id
`;
```

However, the GET endpoint for listing sessions (lines 86-99) was **not filtering out archived sessions**:

```javascript
// Old query (BROKEN)
WHERE sp.user_id = $1 OR s.created_by = $1
```

This meant archived sessions were still included in the results.

## Fix Applied (January 25, 2026, 16:57 UTC)

Updated the sessions list query to exclude archived sessions:

```javascript
// New query (FIXED)
WHERE (sp.user_id = $1 OR s.created_by = $1) AND s.status != 'archived'
```

**File**: [lambda/functions/sessions-crud-handler/index.js](lambda/functions/sessions-crud-handler/index.js:96)

## Deployment

```bash
# Package Lambda function
powershell -Command "Compress-Archive -Path 'lambda\functions\sessions-crud-handler\*' -DestinationPath 'sessions-handler.zip' -Force"

# Deploy to AWS
aws lambda update-function-code --function-name overlay-api-sessions --zip-file fileb://sessions-handler.zip --region eu-west-1

# Verify deployment
aws lambda get-function --function-name overlay-api-sessions --region eu-west-1 --query 'Configuration.LastUpdateStatus'
```

## How It Works Now

1. **Delete Session**: User clicks delete button on dashboard
2. **Frontend**: Calls `DELETE /sessions/{id}`
3. **Backend**: Sets session `status = 'archived'` in database
4. **Frontend**: Removes session from local state immediately
5. **Refresh**: When dashboard refreshes, GET /sessions query excludes archived sessions
6. **Result**: Deleted sessions no longer reappear

## Other Endpoints

The following endpoints were already filtering correctly and didn't need changes:

- **GET /sessions/available**: Already filters by `status = 'active'` only (line 113)
- Sessions with other statuses (pending, completed) are still shown if not archived

## Testing

1. Navigate to dashboard
2. Click delete (trash icon) on any session
3. Confirm deletion
4. Session disappears immediately
5. Refresh the page (F5 or Refresh button)
6. ✅ Deleted session should NOT reappear
7. Check other sessions are still visible

## Database States

Sessions can have the following statuses:
- **active**: Normal working session (shown in lists)
- **pending**: Session not yet started (shown in lists)
- **completed**: Finished session (shown in lists)
- **archived**: Soft-deleted session (filtered out of lists)

Archived sessions remain in the database for data retention but are hidden from all user-facing queries.

## Future Improvements

Consider adding:
1. Hard delete option for admins (permanently remove from database)
2. "View Archived Sessions" page to recover accidentally deleted sessions
3. Auto-archive sessions after X days of inactivity
4. Bulk archive operations
