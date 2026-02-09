# Vercel Production Deployment Guide

**Project:** Overlay Platform
**Repository:** https://github.com/futurisms/overlay-platform
**Date:** February 9, 2026
**Status:** Ready for Production Deployment

---

## ✅ Pre-Deployment Checklist (COMPLETE)

- ✅ GitHub repository updated (commit: `180556a`)
- ✅ Projects feature implemented and deployed to backend
- ✅ API Gateway CORS configured for Vercel (`https://*.vercel.app`)
- ✅ Backend API deployed and operational
- ✅ Environment variables prepared
- ✅ TypeScript compilation verified (no errors)
- ✅ Database migrations applied successfully

**Backend API Endpoint:** `https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/`

---

## 🚀 Vercel Deployment Steps

### Step 1: Access Vercel Dashboard

1. Go to: **https://vercel.com/dashboard**
2. Sign in with your GitHub account
3. Ensure you're logged in as the repository owner (`futurisms`)

---

### Step 2: Import GitHub Repository

1. Click **"Add New..."** button (top right)
2. Select **"Project"** from dropdown
3. In the import screen:
   - Look for **"futurisms/overlay-platform"**
   - If not visible, click **"Adjust GitHub App Permissions"**
   - Grant Vercel access to the `overlay-platform` repository
4. Click **"Import"** next to `overlay-platform`

---

### Step 3: Configure Project Settings

**Framework Preset:**
- Vercel should auto-detect: **Next.js**
- If not, manually select **Next.js** from dropdown

**Root Directory:**
```
frontend
```
⚠️ **CRITICAL:** Must set root directory to `frontend` (not project root)

**Build Command:**
```bash
npm run build
```
*(Should be auto-populated)*

**Output Directory:**
```
.next
```
*(Should be auto-populated)*

**Install Command:**
```bash
npm install
```
*(Should be auto-populated)*

---

### Step 4: Add Environment Variables

Click **"Environment Variables"** section and add the following:

#### Required Variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production` | Production, Preview, Development |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `eu-west-1_lC25xZ8s6` | Production, Preview, Development |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `4e45pdiobcm8qo3ehvi1bcmo2s` | Production, Preview, Development |
| `NEXT_PUBLIC_COGNITO_REGION` | `eu-west-1` | Production, Preview, Development |

**How to Add Each Variable:**
1. Enter **Name** (e.g., `NEXT_PUBLIC_API_BASE_URL`)
2. Enter **Value** (copy exact value from table above)
3. Select **All Environments** (Production, Preview, Development)
4. Click **"Add"**
5. Repeat for all 4 variables

⚠️ **CRITICAL:** Variable name must be `NEXT_PUBLIC_API_BASE_URL` (not `NEXT_PUBLIC_API_URL`).
This matches the codebase expectation in api-client.ts and auth.ts.

⚠️ **IMPORTANT:**
- All variable names start with `NEXT_PUBLIC_` (required for Next.js client-side access)
- Values must be exact (no extra spaces or quotes)
- Apply to ALL environments (Production, Preview, Development)

---

### Step 5: Deploy

1. Review all settings:
   - ✅ Root Directory: `frontend`
   - ✅ Framework: Next.js
   - ✅ 4 Environment Variables added
2. Click **"Deploy"** button
3. Wait for build to complete (typically 2-5 minutes)

**Build Process:**
```
1. Cloning repository
2. Installing dependencies (npm install)
3. Building application (npm run build)
4. Optimizing output
5. Deploying to Vercel CDN
```

---

### Step 6: Verify Deployment

Once deployment completes, Vercel will provide:
- **Production URL:** `https://overlay-platform-XXXXX.vercel.app`
- **Deployment Status:** Ready

**Immediate Checks:**
1. Click the deployment URL
2. Verify page loads without errors
3. Check browser console (F12) for errors

---

## 🧪 Post-Deployment Testing

### Critical Test Cases:

#### 1. Test Login Flow
1. Navigate to: `https://your-app.vercel.app/login`
2. Enter credentials:
   - Email: `admin@example.com`
   - Password: `TestPassword123!`
3. **Expected:** Successful login, redirect to dashboard
4. **Check:** No CORS errors in browser console

#### 2. Test Dashboard Load
1. After login, verify dashboard displays
2. **Expected:** Session cards load, no API errors
3. **Check:** Project filter dropdown appears (if sessions exist with projects)

#### 3. Test API Connectivity
1. Open browser DevTools (F12) → Network tab
2. Refresh dashboard
3. Look for API calls to:
   - `https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions`
   - `https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays`
4. **Expected:** Status 200 (success)
5. **Check:** No CORS errors

#### 4. Test Projects Feature
1. Click **"Create Analysis Session"**
2. Fill in session details
3. Enter a project name (e.g., "Q1 2026 Reviews")
4. Submit form
5. **Expected:** Session created, shows project badge
6. **Test Filter:** Select project from filter dropdown
7. **Expected:** Only sessions from that project show

#### 5. Test Authentication Persistence
1. Refresh the page (F5)
2. **Expected:** Still logged in (no redirect to login)
3. Navigate to different pages
4. **Expected:** JWT token persists, no re-authentication needed

---

## 🔧 Troubleshooting

### Issue 1: Build Fails with "Cannot find module"

**Symptom:**
```
Error: Cannot find module 'next'
```

**Solution:**
- Verify Root Directory is set to `frontend`
- Check `package.json` exists in `frontend/` directory
- Re-run deployment

---

### Issue 2: CORS Error on API Calls

**Symptom:**
```
Access to fetch at 'https://wojz5amtrl...' has been blocked by CORS policy
```

**Solution:**
1. Verify Vercel domain in CORS configuration:
   ```typescript
   // In lib/compute-stack.ts
   allowOrigins: [
     'http://localhost:3000',
     'https://*.vercel.app', // Should be present
   ]
   ```
2. If missing, redeploy backend:
   ```bash
   cdk deploy OverlayComputeStack
   ```

---

### Issue 3: Environment Variables Not Working

**Symptom:**
- API calls fail with "undefined" URL
- Console shows: `undefined/sessions`

**Solution:**
1. Go to Vercel Project Settings → Environment Variables
2. Verify all 4 variables are present
3. Check variable names start with `NEXT_PUBLIC_`
4. If missing/incorrect, add them and **redeploy** (required for env vars to take effect)

---

### Issue 4: Login Redirects to Localhost

**Symptom:**
- After login, redirects to `http://localhost:3000`

**Solution:**
1. Update Cognito User Pool Callback URLs:
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id eu-west-1_lC25xZ8s6 \
     --client-id 4e45pdiobcm8qo3ehvi1bcmo2s \
     --callback-urls "https://your-app.vercel.app" \
     --logout-urls "https://your-app.vercel.app/login"
   ```
2. Replace `your-app.vercel.app` with actual Vercel domain

---

### Issue 5: 404 on Page Refresh

**Symptom:**
- Direct URL navigation works
- Refreshing page shows 404

**Solution:**
- This should NOT happen with Next.js on Vercel (auto-configured)
- If it does, check:
  - Root directory is `frontend` (not project root)
  - `.next` directory exists after build
  - No custom `vercel.json` conflicting with Next.js defaults

---

## 📊 Monitoring & Verification

### CloudWatch Logs (Backend)
```bash
# View API Gateway logs
aws logs tail /aws/apigateway/overlay-platform-api --follow

# View Lambda logs
aws logs tail /aws/lambda/overlay-api-sessions --follow
```

### Vercel Logs (Frontend)
1. Go to: **Vercel Dashboard → Your Project → Deployments**
2. Click latest deployment
3. Click **"Functions"** tab → View runtime logs
4. Click **"Build Logs"** → View build output

### Performance Metrics
- Vercel Analytics: Available in project dashboard
- Core Web Vitals: Automatically tracked
- API Gateway Metrics: CloudWatch → API Gateway

---

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ Vercel deployment shows **"Ready"** status
- ✅ Production URL loads without errors
- ✅ Login flow works (admin@example.com)
- ✅ Dashboard displays sessions
- ✅ API calls succeed (200 status)
- ✅ No CORS errors in browser console
- ✅ Project filter dropdown appears (Phase 4 feature)
- ✅ Create/edit session forms include project field
- ✅ Session cards display project badges

---

## 📝 Next Steps After Deployment

1. **Custom Domain (Optional):**
   - Vercel Settings → Domains
   - Add your custom domain (e.g., `overlay.yourdomain.com`)
   - Configure DNS records as instructed

2. **SSL Certificate:**
   - Automatically provisioned by Vercel
   - HTTPS enabled by default

3. **Continuous Deployment:**
   - Vercel automatically deploys on `git push` to `master`
   - Preview deployments for pull requests

4. **Environment-Specific Settings:**
   - Create `development` branch for staging
   - Configure separate environment variables for staging

5. **Update CLAUDE.md:**
   - Document production URL
   - Update deployment instructions
   - Add Vercel-specific notes

---

## 🚨 Important Notes

**Security:**
- ✅ API Gateway CORS restricted to Vercel domains
- ✅ Cognito authentication required for all API calls
- ✅ Environment variables are private (not exposed in client)
- ⚠️ `NEXT_PUBLIC_*` variables are visible in browser (safe for URLs/IDs)

**Cost Monitoring:**
- Vercel: Free tier for hobby projects, $20/month for team
- AWS: Monitor Lambda invocations, API Gateway requests
- Set up billing alerts in AWS

**Backup:**
- GitHub repository is source of truth
- Latest commit: `180556a` (CORS security update)
- Can rollback via Vercel deployment history

---

## 📞 Support

**Vercel Issues:**
- Documentation: https://vercel.com/docs
- Support: https://vercel.com/support

**AWS Issues:**
- Check CloudWatch Logs
- Review API Gateway metrics
- Verify Lambda function permissions

**Repository:**
- GitHub: https://github.com/futurisms/overlay-platform
- Latest commits backed up and verified

---

**🎉 You're ready to deploy to production!**

**Estimated Time:** 10-15 minutes
**Complexity:** Low (straightforward Vercel setup)
**Risk:** Low (backend already deployed and tested)
