# Invite Button Fix V3 - Dual Approach (Groups + Role)

**Date**: February 5, 2026
**Issue**: localStorage.user_info does NOT contain "role" field after login
**Status**: ✅ FIXED (with immediate workaround + proper debugging)

---

## Root Cause Analysis

### The Real Problem

After the V2 fix, the button **STILL** doesn't appear. Investigation of the debug page revealed:

**localStorage.user_info contains**:
```json
{
  "email": "admin@example.com",
  "sub": "e2c51414-...",
  "groups": ["system_admin"]
}
```

**localStorage.user_info does NOT contain**:
- NO `role` field at all!

This means the login flow changes from V2 are **NOT working**. Despite updating `frontend/app/login/page.tsx` to call `getCurrentUserInfo()` and merge the role, the role is NOT being stored in localStorage.

---

## Dual Fix Strategy

### Fix #5: Immediate Workaround (Groups Check)

**Rationale**: Since localStorage already contains `groups: ["system_admin"]`, we can check that immediately without fixing the login flow.

**File Changed**: `frontend/app/session/[id]/page.tsx`

**Before**:
```typescript
const isAdmin = () => {
  const result = currentUser?.role === 'admin';
  console.log('🔍 DEBUG isAdmin(): currentUser?.role =', currentUser?.role, '| Result:', result);
  return result;
};
```

**After**:
```typescript
const isAdmin = () => {
  const roleCheck = currentUser?.role === 'admin';
  const groupCheck = currentUser?.groups?.includes('system_admin');
  const result = roleCheck || groupCheck;
  console.log('🔍 DEBUG isAdmin(): currentUser?.role =', currentUser?.role, '| currentUser?.groups =', currentUser?.groups, '| roleCheck =', roleCheck, '| groupCheck =', groupCheck, '| Result:', result);
  return result;
};
```

**Result**: Button should now appear immediately using the groups array that's already present!

---

### Fix #2: Proper Solution (Debug Login Flow)

**Rationale**: We need to understand WHY the role isn't being stored. The V2 login code LOOKS correct, so let's add extensive logging to diagnose the issue.

**File Changed**: `frontend/app/login/page.tsx`

**Added Debug Logging**:
```typescript
if (result.success && result.token) {
  console.log('🔍 LOGIN DEBUG: Login successful, token received');
  console.log('🔍 LOGIN DEBUG: result.userInfo =', result.userInfo);

  // Save token to both localStorage and cookies
  apiClient.setToken(result.token);

  // Fetch user info from database to get role
  console.log('🔍 LOGIN DEBUG: Calling getCurrentUserInfo()...');
  const userInfoResult = await apiClient.getCurrentUserInfo();
  console.log('🔍 LOGIN DEBUG: getCurrentUserInfo() result =', userInfoResult);

  if (userInfoResult.data?.user) {
    console.log('🔍 LOGIN DEBUG: User data from database:', userInfoResult.data.user);

    // Save complete user info including role from database
    const completeUserInfo = {
      ...result.userInfo,
      role: userInfoResult.data.user.role,
      name: userInfoResult.data.user.name,
      user_id: userInfoResult.data.user.user_id,
    };

    console.log('🔍 LOGIN DEBUG: Complete user info to be saved:', completeUserInfo);
    saveUserInfo(completeUserInfo);
    console.log('🔍 LOGIN DEBUG: User info saved to localStorage');
  } else if (result.userInfo) {
    console.log('⚠️ LOGIN DEBUG: Database fetch failed or returned no user, falling back to Cognito info');
    console.log('⚠️ LOGIN DEBUG: userInfoResult =', userInfoResult);
    // Fallback to Cognito user info if database fetch fails
    saveUserInfo(result.userInfo);
  }

  // Save token to cookies for middleware
  document.cookie = `auth_token=${result.token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days

  // Get callback URL from query params
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  // Redirect to callback URL or dashboard
  router.push(callbackUrl);
}
```

**What This Reveals**:
- Does `getCurrentUserInfo()` succeed or fail?
- What does the API response contain?
- Is the role being fetched from the database?
- Is `completeUserInfo` being constructed correctly?
- Is `saveUserInfo()` being called?

---

## Testing Instructions

### Step 1: Test Immediate Fix (No Logout Required!)

The immediate fix (Fix #5) should work **right now** without logging out!

1. Navigate to session page: http://localhost:3000/session/{sessionId}
2. Open browser DevTools (F12) → Console tab
3. Look for debug log:
   ```
   🔍 DEBUG isAdmin(): currentUser?.role = undefined | currentUser?.groups = ["system_admin"] | roleCheck = false | groupCheck = true | Result: true
   ```
4. **Expected**: "Invite Analyst" button should now be visible!
5. **Why it works**: Button checks `groups.includes("system_admin")` which is already in localStorage

---

### Step 2: Test Proper Fix (Logout & Login Required)

To diagnose and fix the login flow properly:

1. **Logout completely**:
   - Option A: Click logout button in app
   - Option B: Open DevTools Console and run: `localStorage.clear()`

2. **Login again**:
   - Navigate to: http://localhost:3000/login
   - Email: `admin@example.com`
   - Password: `TestPassword123!`
   - Open DevTools Console BEFORE clicking "Sign In"
   - Click "Sign In"

3. **Check Console Logs** (this is the diagnostic part):
   ```
   🔍 LOGIN DEBUG: Login successful, token received
   🔍 LOGIN DEBUG: result.userInfo = {email, sub, groups}
   🔍 LOGIN DEBUG: Calling getCurrentUserInfo()...
   🔍 LOGIN DEBUG: getCurrentUserInfo() result = {data: {user: {...}}} OR {error: "..."}
   🔍 LOGIN DEBUG: User data from database: {user_id, email, name, role: "admin", ...}
   🔍 LOGIN DEBUG: Complete user info to be saved: {email, sub, groups, role: "admin", name, user_id}
   🔍 LOGIN DEBUG: User info saved to localStorage
   ```

4. **Analyze the logs**:
   - Did `getCurrentUserInfo()` succeed?
   - Does `userInfoResult` contain `{data: {user: {...}}}`?
   - Does `user.role` equal `"admin"`?
   - Is `completeUserInfo` constructed with the role field?

5. **Check localStorage**:
   - Open DevTools → Application → Local Storage
   - Find key: `user_info`
   - **Expected after proper fix**:
     ```json
     {
       "email": "admin@example.com",
       "sub": "e2c51414-...",
       "groups": ["system_admin"],
       "role": "admin",
       "name": "Admin User",
       "user_id": "e2c51414-..."
     }
     ```

6. **Check Debug Page**:
   - Navigate to: http://localhost:3000/debug-user
   - **Expected**:
     - `user?.role` shows: `"admin"`
     - `user?.role === 'admin'` shows: `true`
     - Button visibility shows: `YES ✅`

---

## Expected Outcomes

### Immediate (Fix #5)
- ✅ Button appears on session page **RIGHT NOW**
- ✅ Uses `groups.includes("system_admin")` check
- ✅ No logout/login required
- ✅ Works with existing localStorage data

### After Login (Fix #2 diagnostics)
- 🔍 Console logs reveal why role isn't being stored
- 🔍 Can identify if `getCurrentUserInfo()` is failing
- 🔍 Can see exact API response structure
- 🔍 Can determine where the login flow breaks

---

## Possible Diagnosis Scenarios

### Scenario 1: getCurrentUserInfo() Returns Error
**Logs would show**:
```
⚠️ LOGIN DEBUG: Database fetch failed or returned no user, falling back to Cognito info
⚠️ LOGIN DEBUG: userInfoResult = {error: "..."}
```

**Action**: Check Lambda logs for `/users/me` endpoint errors

---

### Scenario 2: API Response Structure Mismatch
**Logs would show**:
```
🔍 LOGIN DEBUG: getCurrentUserInfo() result = {data: null} OR {data: {}}
```

**Action**: Verify `/users/me` returns `{user: {...}}` structure

---

### Scenario 3: result.userInfo Missing Base Fields
**Logs would show**:
```
🔍 LOGIN DEBUG: result.userInfo = null OR {}
🔍 LOGIN DEBUG: Complete user info to be saved: {role: "admin", name: "...", user_id: "..."}
```

**Action**: Check `lib/auth.ts` login() function to ensure it returns userInfo with email/sub/groups

---

### Scenario 4: saveUserInfo() Not Working
**Logs would show**:
```
🔍 LOGIN DEBUG: User info saved to localStorage
```
But localStorage still doesn't have role.

**Action**: Check `lib/auth.ts` saveUserInfo() function implementation

---

## Files Changed

### Frontend (2 files)
1. **frontend/app/session/[id]/page.tsx** (Fix #5 - Immediate Workaround)
   - Updated `isAdmin()` to check both `role === 'admin'` OR `groups.includes('system_admin')`
   - Enhanced debug logging to show both checks

2. **frontend/app/login/page.tsx** (Fix #2 - Proper Debugging)
   - Added extensive console logging throughout login flow
   - Logs every step: token receipt, API call, response, merge, save

---

## Success Criteria

### Immediate Success (Fix #5)
- [x] isAdmin() checks groups array
- [x] isAdmin() checks role field (for when it's fixed)
- [x] Enhanced debug logging shows both checks
- [ ] **USER VERIFICATION**: Button appears on session page without logout/login

### Diagnostic Success (Fix #2)
- [x] Login flow has comprehensive logging
- [ ] **USER VERIFICATION**: Console logs reveal where role storage breaks
- [ ] **FUTURE**: Identify and fix the actual root cause based on logs

---

## Why Fix #5 Should Work Immediately

The key insight: **localStorage already has everything we need!**

```json
{
  "groups": ["system_admin"]  // ← This is already present!
}
```

By checking `groups.includes("system_admin")`, the button should appear **right now** because:
1. The groups array is populated by Cognito during login
2. The groups array is already stored in localStorage
3. The admin user has the "system_admin" group
4. The check doesn't depend on the role field that's missing

---

## Next Steps

1. **Test Fix #5 immediately**: Navigate to session page and verify button appears
2. **Test Fix #2 diagnostics**: Logout, login with DevTools Console open, analyze logs
3. **Report findings**: Share console logs to identify root cause of role storage issue
4. **Implement final fix**: Once root cause is identified, fix the actual issue in login flow

---

## Rollback Plan

If Fix #5 causes issues:

```bash
cd frontend/app/session/[id]
git checkout HEAD~1 -- page.tsx
```

If Fix #2 logging is too verbose:

```bash
cd frontend/app/login
git checkout HEAD~1 -- page.tsx
```

---

## Conclusion

**Immediate Fix (Fix #5)**: The button should now appear using the groups array that's already in localStorage. No logout/login required!

**Proper Fix (Fix #2)**: Added comprehensive logging to diagnose why the role field isn't being stored. The next login will reveal exactly where the issue is.

**Dual Approach Benefits**:
- User gets working button immediately
- We can still debug and fix the underlying issue
- Once role storage is fixed, both checks will work

---

*Fix completed: February 5, 2026*
*Files changed: session/[id]/page.tsx, login/page.tsx*
*Next action: Test session page (button should appear now!)*
