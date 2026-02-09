# Test Remove Participant Feature - Systematic Verification

## Purpose
Systematically verify each layer to find where remove participant functionality fails.

## Prerequisites
1. Backend deployed with path parsing fix ✅
2. Frontend logging added ✅
3. Proxy logging enhanced ✅

## Test Procedure

### Step 1: Restart Proxy Server (REQUIRED)

**Terminal 1** (keep running):
```bash
cd frontend
node proxy-server.js
```

**Expected output:**
```
🔄 CORS Proxy Server running on http://localhost:3001
   Proxying API Gateway: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
   Proxying Cognito: https://cognito-idp.eu-west-1.amazonaws.com/
   Allowing origin: http://localhost:3000
```

**Watch this terminal** - it will show DELETE request logs.

### Step 2: Open Browser with DevTools

1. Open http://localhost:3000
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Click **Clear console** (🚫 icon)
5. Go to **Network** tab
6. Check "Preserve log"

### Step 3: Navigate to Session with Multiple Participants

1. Login as admin (admin@example.com / TestPassword123!)
2. Go to Dashboard
3. Click on a session that has 2+ participants
4. Wait for page to load completely

### Step 4: Attempt to Remove Participant

1. In Console tab, click "Clear" again
2. Scroll to "Session Participants" section
3. Find a participant (NOT yourself)
4. Click the **X button**
5. Professional dialog should appear
6. Click **"Remove Participant"** button

### Step 5: Observe Console Output

**You should see this in Browser Console:**

```
=== REMOVE PARTICIPANT DEBUG ===
1. Participant to remove: {userId: "...", firstName: "...", lastName: "..."}
2. Session ID: "..."
3. URL will be: /sessions/{sessionId}/participants/{userId}
4. Has auth token: true
5. Calling API...
6. API Response: {data: {...}, status: 200}
7. Response status: 200
8. Response error: undefined
9. Response data: {success: true, message: "..."}
11. Success - refreshing session data...
12. Session data refreshed
13. Dialog closed
=== END REMOVE PARTICIPANT DEBUG ===
```

### Step 6: Check Network Tab

1. Look for a DELETE request to `/sessions/{id}/participants/{id}`
2. Click on it
3. Check:
   - **Status code** (should be 200)
   - **Response** tab - should show `{"success":true,"message":"..."}`
   - **Headers** tab - verify Authorization header present

### Step 7: Check Proxy Terminal

**You should see in proxy terminal:**

```
>>> DELETE /sessions/3cd2ae9b-4046-449c-aa3b-2f959cfe7191/participants/user-id-here
>>> DELETE REQUEST DETECTED <<<
>>> Headers: {
  "authorization": "Bearer eyJ...",
  "content-type": "application/json",
  ...
}
>>> DELETE Response Status: 200
```

### Step 8: Check Lambda Logs (CloudWatch)

**In a third terminal:**
```bash
aws logs tail /aws/lambda/overlay-api-sessions --follow --region eu-west-1
```

**Expected output:**
```
Sessions Handler: {"httpMethod":"DELETE","path":"/production/sessions/{id}/participants/{id}",...}
Participant {userId} removed from session {sessionId} by admin {adminId}
```

## Troubleshooting Guide

### If Console Shows "ABOUT TO CALL API" but NO Response

**Problem:** Request blocked or network error

**Check:**
1. Network tab - is there a FAILED request?
2. Console - any CORS errors?
3. Proxy terminal - did it receive the request?

**Solution:** Restart proxy server

---

### If Console Shows Error "403 Forbidden"

**Problem:** Admin permission check failing

**Check:**
1. Response tab - what's the error message?
2. Verify you're logged in as admin
3. Check localStorage: `localStorage.getItem('auth_token')`

**Solution:** Re-login as admin

---

### If Console Shows Error "400 Bad Request"

**Problem:** Path parsing still failing

**Check:**
1. Response tab - error should say "Invalid path format"
2. CloudWatch logs - should show `Invalid path format:` with debug info

**Solution:** Backend path parsing needs further fix

---

### If Status 200 but Participant NOT Removed

**Problem:** Database update failing silently

**Check:**
1. Console log #9 - is response.data showing success?
2. Console log #11-12 - did session refresh?
3. CloudWatch - any errors after "removed from session" log?

**Solution:** Check permissions.js revokeSessionAccess function

---

### If No Console Logs AT ALL

**Problem:** handleRemoveParticipant not being called

**Check:**
1. Is dialog appearing?
2. Did you click "Remove Participant" button?
3. Check if button has onClick handler

**Solution:** Frontend event binding issue

---

## Expected Behavior (Success Case)

✅ **Browser Console:**
- All 13 debug logs appear
- Status: 200
- No errors

✅ **Browser Network Tab:**
- DELETE request sent
- Status: 200 OK
- Response: `{"success": true, "message": "..."}`

✅ **Proxy Terminal:**
- DELETE request logged
- Status: 200

✅ **Visual Result:**
- Green success toast appears
- Dialog closes
- Participant removed from list
- Count decreased by 1

✅ **CloudWatch Logs:**
- "Participant ... removed from session ..." logged
- No errors

---

## Report Template

After testing, report the following:

```
TEST RESULTS - Remove Participant

Browser Console:
- Step 1 (Participant data): [YES/NO/ERROR]
- Step 5 (API call made): [YES/NO]
- Step 6 (Response received): [YES/NO]
- Step 7 (Status code): [200/400/403/500]
- Step 9 (Success data): [YES/NO]
- Step 12 (Refresh complete): [YES/NO]

Network Tab:
- DELETE request visible: [YES/NO]
- Status code: [___]
- Response body: [paste here]

Proxy Terminal:
- DELETE logged: [YES/NO]
- Status from backend: [___]

Visual Result:
- Toast appeared: [YES/NO]
- Participant removed: [YES/NO]
- Count decreased: [YES/NO]

CloudWatch Logs:
- Backend received request: [YES/NO]
- "Participant removed" logged: [YES/NO]
- Any errors: [paste here]
```

---

**After completing all steps, paste your test results using the template above.**
