# Final Debug Instructions - Criteria Not Displaying

**Status:** API requires authentication, need to test in browser

---

## API Test Result

**Direct API call without auth:**
```
curl https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays/4eadcbc9-102b-428a-a850-8f2c3bbb0142

Response: {"message":"Unauthorized"}
```

**Conclusion:** API requires JWT authentication token from Cognito login.

---

## Step 1: Test API in Browser (With Auth)

**You need to test this in your browser where you're logged in:**

1. **Open http://localhost:3000 and login**
   - Email: admin@example.com
   - Password: TestPassword123!

2. **Open Browser DevTools**
   - Press F12
   - Go to **Network** tab
   - Clear network log (trash icon)

3. **Navigate to a session page**
   - Click on any session from dashboard
   - Wait for page to load

4. **Find the API call:**
   - Look for GET request to `/overlays/...`
   - Should be URL like: `http://localhost:3001/overlays/4eadcbc9-102b-428a-a850-8f2c3bbb0142`
   - Click on the request

5. **Check Response tab:**
   - Look for `criteria` array in the JSON
   - Copy the full response and paste here

**Key questions:**
- ✅ Does the response have a `criteria` array?
- ✅ Is the array empty `[]` or does it have items?
- ✅ If it has items, do they have `criteria_id` field? (not `criterion_id`)

---

## Step 2: Check Console for JavaScript Errors

**In the same DevTools:**

1. **Go to Console tab**
2. **Look for errors (red text)**

**Common errors to look for:**
- "Cannot read property 'criteria_id' of undefined"
- "Cannot read property 'criterion_id' of undefined"
- Any React rendering errors
- Any type errors

**Copy any errors you see**

---

## Step 3: Check React Component State (Advanced)

**If you have React Developer Tools installed:**

1. **Open React DevTools tab**
2. **Find the component:**
   - Look for `SessionDetailPage` or similar
3. **Inspect state:**
   - Find `overlay` in state
   - Expand `overlay.criteria`
   - Check what's in the array

**Screenshot or describe what you see**

---

## Possible Issues

### Issue A: API Returns Empty Criteria Array

**Symptom:** Response has `"criteria": []`

**Cause:** Database has no criteria for this overlay_id

**Check:**
```sql
SELECT COUNT(*)
FROM evaluation_criteria
WHERE overlay_id = '4eadcbc9-102b-428a-a850-8f2c3bbb0142';
```

**Fix:** Use a different overlay that definitely has criteria, or check database

---

### Issue B: API Returns Criteria with Wrong Field Name

**Symptom:** Response has `criterion_id` instead of `criteria_id`

**Cause:** Deployment didn't work, still running old code

**Check:**
- API response in Network tab shows field name
- Compare to what we expect from commit b1bd519

**Fix:** Redeploy OverlayComputeStack

---

### Issue C: Frontend Not Rendering Criteria

**Symptom:**
- API returns criteria with `criteria_id` ✅
- But frontend shows "No criteria found"

**Cause:** Frontend code issue or React not re-rendering

**Check:**
- Console errors
- React component state in React DevTools
- Any conditional rendering logic issues

**Fix:** Check frontend rendering code

---

### Issue D: Cache Issue

**Symptom:** Everything looks right but still not working

**Cause:** Browser cache or Next.js cache

**Fix:**
1. Hard refresh: Ctrl+Shift+R
2. Clear browser cache completely
3. Close all browser tabs and restart browser
4. Clear Next.js cache: `rm -rf frontend/.next`
5. Restart dev server

---

## What to Report Back

**Please provide:**

1. **Network tab - API Response:**
   - URL of the request
   - Full JSON response (especially the `criteria` array)
   - Field names in criteria objects

2. **Console tab - Errors:**
   - Any red errors
   - Any warnings related to criteria

3. **What you see on screen:**
   - Is "Evaluation Criteria" section visible?
   - Does it show "No criteria found" or completely empty?
   - Any error messages?

---

## Quick Rollback Plan (If Needed)

**If we can't fix in next 10 minutes:**

```bash
# 1. Revert frontend changes
git revert 8bf37ca

# 2. Revert backend field name change
git revert b1bd519

# 3. Redeploy backend
cdk deploy OverlayComputeStack --require-approval never

# 4. Restart frontend
cd frontend
rm -rf .next
npm run dev
```

**This will:**
- ✅ Restore to using `criterion_id` everywhere (consistent but wrong)
- ✅ Edit Criteria save bug will return (known issue)
- ✅ But at least criteria will display again

---

**Status:** Awaiting your browser test results to determine next action

