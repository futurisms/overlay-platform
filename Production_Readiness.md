---
name: production-readiness
description: Pre-deployment verification to catch issues that only appear in production. Use BEFORE deploying any full-stack application from localhost to a production environment (Vercel, Netlify, CloudFront + AWS). Covers the localhost-to-production gap (CORS, auth, environment variables), systematic endpoint testing, cross-origin verification, frontend deployment checks, and a go-live checklist. Prevents the #1 deployment failure pattern where everything works locally but breaks in production. Essential for first-time production deployments and new project launches.
---

# Production Readiness

Systematic pre-deployment verification to catch issues that only appear in production.

## Why This Skill Exists

**The #1 deployment failure pattern:**
1. Build app on localhost → everything works ✅
2. Deploy to production → everything breaks ❌
3. Spend days fixing CORS, auth, environment issues one at a time

**Root cause:** Localhost hides production reality:
- Next.js dev proxy makes API calls same-origin (no CORS needed)
- Environment variables work differently (`.env.local` vs hosting platform)
- Auth flows bypass cross-origin checks
- Browser is less strict with localhost
- You test one endpoint at a time, never all of them

**This skill forces you to verify production readiness BEFORE deploying, not after.**

## Core Principle

**If you haven't tested it the way production will use it, it's not ready.**

Localhost testing ≠ production testing. They are fundamentally different environments.

## The Localhost-to-Production Gap

### What's Different in Production

| Aspect | Localhost | Production |
|--------|-----------|------------|
| CORS | Bypassed by dev proxy | Enforced by browser |
| API calls | Same-origin (proxy) | Cross-origin (different domains) |
| Auth tokens | Work via proxy | Need CORS headers to be readable |
| Env variables | `.env.local` file | Hosting platform config |
| URLs | `localhost:3000` | `your-app.vercel.app` |
| Deployment | Instant (file save) | Build + deploy pipeline |
| Errors | Visible in terminal | Hidden in CloudWatch |
| SSL | Optional (http) | Required (https) |
| Cookies | Same-origin, always work | Need SameSite/Secure flags |

### What Breaks Most Often

**Ranked by frequency from real deployments:**

1. **Lambda responses missing CORS headers** (90% of first-deployment issues)
2. **Environment variables not set in hosting platform**
3. **Auth callback URLs not updated for production domain**
4. **Frontend hardcoded to localhost API URL**
5. **Vercel deploying as Preview instead of Production**
6. **API Gateway CORS not configured for production origin**
7. **Missing endpoints that localhost proxy was masking**
8. **Cookie/session issues due to cross-origin**

## Phase 1: Pre-Deployment Audit (Do This BEFORE Deploying)

### 1.1 Backend API Audit

**List every API endpoint and verify it's production-ready:**

```bash
# List ALL API Gateway endpoints
aws apigateway get-resources --rest-api-id YOUR_API_ID --region YOUR_REGION \
  --query "items[].{Path:path}" --output table

# List ALL Lambda functions
aws lambda list-functions --region YOUR_REGION \
  --query "Functions[?contains(FunctionName, 'YourProject')].FunctionName" --output text

# Cross-reference: every route must have a Lambda, every Lambda must be deployed
```

**For each endpoint, verify:**
```markdown
## Endpoint Audit

| Endpoint | Method | Lambda Exists | CORS in Response | Event Passed to Helpers | Error Responses Have CORS |
|----------|--------|---------------|------------------|------------------------|--------------------------|
| /auth | POST | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| /users | GET | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| /items | GET | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| /items | POST | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| /items/:id | GET | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
[add ALL endpoints]
```

### 1.2 CORS Audit (THE MOST CRITICAL CHECK)

CORS requires TWO configurations. Both must be present:

**Part 1: API Gateway preflight (OPTIONS)**
```bash
# Verify CORS is configured in CDK
grep -n "defaultCorsPreflightOptions\|allowOrigins\|CORS" lib/*.ts
```

**Part 2: Lambda response headers (EVERY handler)**
```bash
# Check EVERY Lambda handler has CORS headers
for f in $(find lambda/functions -name "*.js" -not -path "*/node_modules/*"); do
  RETURNS=$(grep -c "statusCode" "$f")
  CORS=$(grep -c "getCorsHeaders\|Access-Control-Allow-Origin" "$f")
  if [ "$RETURNS" -gt 0 ] && [ "$CORS" -eq 0 ]; then
    echo "❌ MISSING CORS: $f ($RETURNS returns, 0 CORS)"
  elif [ "$RETURNS" -ne "$CORS" ]; then
    echo "⚠️  PARTIAL CORS: $f ($RETURNS returns, $CORS CORS)"
  else
    echo "✅ OK: $f"
  fi
done
```

**Part 3: Event parameter passed to ALL helper functions**
```bash
# Check for the event scope bug
for f in $(find lambda/functions -name "*.js" -not -path "*/node_modules/*"); do
  # Find functions that use getCorsHeaders but might not have event param
  HELPERS=$(grep -n "async function\|function " "$f" | grep -v "exports.handler\|getCorsHeaders")
  while IFS= read -r line; do
    FUNC_NAME=$(echo "$line" | grep -oP "function \K\w+")
    LINE_NUM=$(echo "$line" | cut -d: -f1)
    if [ ! -z "$FUNC_NAME" ]; then
      # Check if function uses getCorsHeaders
      USES_CORS=$(sed -n "${LINE_NUM},\$p" "$f" | head -50 | grep -c "getCorsHeaders(event)")
      HAS_EVENT=$(echo "$line" | grep -c "event")
      if [ "$USES_CORS" -gt 0 ] && [ "$HAS_EVENT" -eq 0 ]; then
        echo "❌ BUG in $f: function $FUNC_NAME uses getCorsHeaders(event) but doesn't have event parameter"
      fi
    fi
  done <<< "$HELPERS"
done
```

**ALL checks must show ✅ before proceeding.**

### 1.3 Frontend Audit

```bash
# Check for hardcoded localhost URLs
grep -rn "localhost\|127.0.0.1" frontend/ --include="*.ts" --include="*.tsx" --include="*.js" \
  | grep -v node_modules | grep -v ".next" | grep -v ".env"
# Should find NOTHING (all URLs should use environment variables)

# Check environment variable usage
grep -rn "NEXT_PUBLIC_" frontend/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
# Every API URL should use NEXT_PUBLIC_API_BASE_URL or similar

# Check .env.local vs .env.production
cat frontend/.env.local 2>/dev/null
cat frontend/.env.production 2>/dev/null
```

### 1.4 Auth Audit

```bash
# Check Cognito callback URLs include production domain
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --region YOUR_REGION \
  --query "{CallbackURLs: UserPoolClient.CallbackURLs, LogoutURLs: UserPoolClient.LogoutURLs}"

# Must include BOTH localhost AND production URLs

# Check auth flows are enabled
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --region YOUR_REGION \
  --query "UserPoolClient.ExplicitAuthFlows"
```

### 1.5 CDK/Infrastructure Audit

```bash
# Verify API Gateway CORS allows production origin
grep -A5 "allowOrigins" lib/*.ts
# Must include your production URL (e.g., https://your-app.vercel.app)

# Verify all environment variables passed to Lambdas
grep -A10 "environment:" lib/*.ts | grep -v "//"
```

## Phase 2: Simulated Production Test (BEFORE Deploying Frontend)

**Test your deployed backend AS IF you were the production frontend.**

### 2.1 Get Auth Token
```bash
export API_URL="https://YOUR-API-ID.execute-api.REGION.amazonaws.com/production"
export PROD_ORIGIN="https://your-app.vercel.app"

TOKEN=$(curl -s -X POST "$API_URL/auth" \
  -H "Content-Type: application/json" \
  -H "Origin: $PROD_ORIGIN" \
  -d '{"action":"login","email":"admin@example.com","password":"YOUR_PASSWORD"}' | jq -r '.idToken')

echo "Token: ${TOKEN:0:50}..."
# If this fails, auth endpoint has issues
```

### 2.2 Test EVERY Endpoint (OPTIONS + GET + CORS)
```bash
# Define ALL your endpoints
ENDPOINTS=(
  "me"
  "sessions"
  "overlays"
  "submissions"
  "submissions/SOME_REAL_ID"
  "submissions/SOME_REAL_ID/content"
  "submissions/SOME_REAL_ID/answers"
  "submissions/SOME_REAL_ID/feedback"
  "admin/analytics?period=30"
  "admin/submissions"
)

echo "========================================"
echo "PRODUCTION READINESS - ENDPOINT TESTS"
echo "========================================"

ALL_PASS=true

for endpoint in "${ENDPOINTS[@]}"; do
  # Test OPTIONS preflight
  OPTIONS_CORS=$(curl -s -D - -o /dev/null -X OPTIONS "$API_URL/$endpoint" \
    -H "Origin: $PROD_ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    2>&1 | grep -ci "access-control-allow-origin")

  # Test actual GET request
  RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/$endpoint" \
    -H "Origin: $PROD_ORIGIN" \
    -H "Authorization: Bearer $TOKEN")
  STATUS=$(echo "$RESPONSE" | tail -1)

  # Test CORS on actual response
  GET_CORS=$(curl -s -D - -o /dev/null "$API_URL/$endpoint" \
    -H "Origin: $PROD_ORIGIN" \
    -H "Authorization: Bearer $TOKEN" \
    2>&1 | grep -ci "access-control-allow-origin")

  # Report
  OPT_ICON=$([ "$OPTIONS_CORS" -gt 0 ] && echo "✅" || echo "❌")
  GET_ICON=$([ "$STATUS" = "200" ] && echo "✅" || echo "❌")
  CORS_ICON=$([ "$GET_CORS" -gt 0 ] && echo "✅" || echo "❌")

  echo "/$endpoint"
  echo "  OPTIONS CORS: $OPT_ICON | GET Status: $GET_ICON ($STATUS) | Response CORS: $CORS_ICON"

  if [ "$OPTIONS_CORS" -eq 0 ] || [ "$STATUS" != "200" ] || [ "$GET_CORS" -eq 0 ]; then
    ALL_PASS=false
  fi
done

echo ""
if [ "$ALL_PASS" = true ]; then
  echo "✅ ALL ENDPOINTS PASS - Ready for production frontend deployment"
else
  echo "❌ SOME ENDPOINTS FAILED - Fix before deploying frontend"
fi
```

### 2.3 Test POST Endpoints
```bash
# Test auth
echo "--- POST /auth ---"
curl -s -w "\nStatus: %{http_code}" -X POST "$API_URL/auth" \
  -H "Content-Type: application/json" \
  -H "Origin: $PROD_ORIGIN" \
  -d '{"action":"login","email":"admin@example.com","password":"YOUR_PASSWORD"}'

# Test any other POST endpoints with sample data
# echo "--- POST /sessions ---"
# curl -s -w "\nStatus: %{http_code}" -X POST "$API_URL/sessions" \
#   -H "Content-Type: application/json" \
#   -H "Origin: $PROD_ORIGIN" \
#   -H "Authorization: Bearer $TOKEN" \
#   -d '{"name":"Test Session"}'
```

## Phase 3: Frontend Deployment Verification

### 3.1 Hosting Platform Configuration
```markdown
## Hosting Platform Checklist

Environment Variables Set:
- [ ] NEXT_PUBLIC_API_BASE_URL = https://your-api.execute-api.region.amazonaws.com/production
- [ ] Any other NEXT_PUBLIC_ variables

Build Settings:
- [ ] Build command correct (e.g., npm run build)
- [ ] Output directory correct (e.g., .next)
- [ ] Node.js version matches local

Deployment Type:
- [ ] Production deployment (NOT Preview)
- [ ] Production branch matches Git branch (main vs master)
- [ ] Custom domain configured (if applicable)
```

### 3.2 Post-Frontend-Deploy Verification
```markdown
## Browser Testing (Use Incognito!)

Login Flow:
- [ ] Login page loads
- [ ] Can enter credentials
- [ ] Login succeeds
- [ ] Redirects to dashboard
- [ ] Token stored correctly

Dashboard:
- [ ] Main dashboard loads all data
- [ ] No CORS errors in Network tab
- [ ] No errors in Console tab
- [ ] All API calls return 200

Admin Dashboard:
- [ ] Admin page loads
- [ ] Analytics data loads
- [ ] Submissions list loads

Detail Pages:
- [ ] Session detail loads
- [ ] Submission detail loads
- [ ] Original submission content loads
- [ ] Feedback/analysis loads
- [ ] File download works

User Flows:
- [ ] Create new session
- [ ] Upload document
- [ ] View analysis results
- [ ] Navigate between pages
- [ ] Logout works
- [ ] Login again works

Multi-Browser:
- [ ] Chrome works
- [ ] Firefox works
- [ ] Safari works (if applicable)
- [ ] Mobile browser works
```

## Phase 4: Production Monitoring Setup

### 4.1 Verify Logging
```bash
# Check all Lambda functions have log groups
aws logs describe-log-groups --region YOUR_REGION \
  --query "logGroups[?contains(logGroupName, 'YourProject')].logGroupName" --output text

# Verify recent logs exist (functions are actually being invoked)
for LOG_GROUP in $(aws logs describe-log-groups --region YOUR_REGION \
  --query "logGroups[?contains(logGroupName, 'YourProject')].logGroupName" --output text); do
  LATEST=$(aws logs describe-log-streams --region YOUR_REGION \
    --log-group-name "$LOG_GROUP" --order-by LastEventTime --descending --limit 1 \
    --query "logStreams[0].lastEventTimestamp" --output text 2>/dev/null)
  echo "$LOG_GROUP: Last event at $LATEST"
done
```

### 4.2 Error Monitoring
```bash
# Check for recent errors across all functions
for LOG_GROUP in $(aws logs describe-log-groups --region YOUR_REGION \
  --query "logGroups[?contains(logGroupName, 'YourProject')].logGroupName" --output text); do
  ERRORS=$(aws logs filter-log-events --region YOUR_REGION \
    --log-group-name "$LOG_GROUP" \
    --filter-pattern "ERROR" \
    --start-time $(date -d '1 hour ago' +%s000) \
    --query "events | length(@)" --output text 2>/dev/null)
  if [ "$ERRORS" -gt 0 ]; then
    echo "⚠️  $LOG_GROUP: $ERRORS errors in last hour"
  else
    echo "✅ $LOG_GROUP: No errors"
  fi
done
```

## Quick Reference: Go-Live Checklist

**Print this and check off each item before going live:**

### Backend ✅
- [ ] All Lambda functions deployed and responding
- [ ] ALL Lambda responses include CORS headers (every statusCode, every helper function)
- [ ] Event parameter passed to ALL helper functions that use getCorsHeaders
- [ ] API Gateway CORS configured for production origin
- [ ] Database connectivity verified
- [ ] Secrets in Secrets Manager (not hardcoded)
- [ ] CloudWatch logging working

### Auth ✅
- [ ] Auth endpoint returns tokens
- [ ] Cognito callback URLs include production domain
- [ ] Cognito auth flows enabled
- [ ] Frontend auth format matches backend expectations

### Frontend ✅
- [ ] No hardcoded localhost URLs in code
- [ ] Environment variables set in hosting platform
- [ ] Production deployment (not Preview)
- [ ] Production branch configured correctly
- [ ] Build succeeds with production env vars

### CORS (Test from production origin) ✅
- [ ] Every OPTIONS preflight returns Access-Control-Allow-Origin
- [ ] Every GET/POST response returns Access-Control-Allow-Origin
- [ ] Every error response (400, 500) returns Access-Control-Allow-Origin
- [ ] Tested with actual production URL as Origin header

### End-to-End (Incognito browser) ✅
- [ ] Login works
- [ ] Main dashboard loads
- [ ] Admin dashboard loads
- [ ] Detail pages load (submissions, sessions, etc.)
- [ ] All data loads (no empty sections)
- [ ] File downloads work
- [ ] No console errors
- [ ] No network errors

### Monitoring ✅
- [ ] CloudWatch logs being generated
- [ ] No errors in last hour
- [ ] Cost monitoring in place

## When to Use This Skill

**Use this skill:**
- Before EVERY first production deployment of a new project
- When moving from localhost to any hosted environment
- When adding a new frontend domain (e.g., custom domain, staging environment)
- When adding new API endpoints to an existing production app
- After major refactoring that touches API handlers

**Use in combination with:**
- `test-driven-implementation` — for building features correctly
- `aws-fullstack-deployment` — for AWS-specific patterns and CORS details
- `database-migration-management` — for schema changes

## Common Deployment Patterns

### Pattern 1: Vercel + AWS API Gateway (Most Common)
```
Frontend: Vercel (your-app.vercel.app)
    ↓ Cross-origin requests (CORS required!)
Backend: API Gateway (api-id.execute-api.region.amazonaws.com)
    ↓
Lambda Functions (must return CORS headers)
    ↓
Database: RDS Aurora / DynamoDB
```

**Key gotcha:** Vercel and AWS are different domains → browser enforces CORS

### Pattern 2: CloudFront + S3 + API Gateway
```
Frontend: CloudFront (d1234.cloudfront.net)
    ↓ Same or different origin
Backend: API Gateway (can be same CloudFront distribution)
    ↓
Lambda Functions
```

**Key gotcha:** If frontend and API are on same CloudFront distribution, CORS may not be needed. If different domains, same CORS requirements apply.

### Pattern 3: Full AWS (Amplify + API Gateway)
```
Frontend: Amplify (main.d1234.amplifyapp.com)
    ↓ Cross-origin (different domains)
Backend: API Gateway
    ↓
Lambda Functions (must return CORS headers)
```

**Key gotcha:** Even within AWS, different services = different domains = CORS required

## Anti-Patterns to Avoid

### ❌ "It works on localhost so it's ready"
Localhost hides CORS, env var, and auth issues. Always test with production-like settings.

### ❌ "I'll fix production issues after deploying"
This leads to days of whack-a-mole debugging. Verify BEFORE deploying.

### ❌ "I only need to test the endpoint I just changed"
One change can break other endpoints. Test ALL endpoints after any backend change.

### ❌ "CORS is just an API Gateway setting"
CORS is a TWO-PART system: API Gateway (OPTIONS) + Lambda responses (actual requests). Both must be configured.

### ❌ "I'll add CORS to each handler as I build it"
Use a shared CORS utility from day one. Adding CORS retroactively to existing helper functions causes the event scope bug.

### ❌ "The frontend build is the same as development"
Production builds use different env vars, different URLs, and may tree-shake differently. Always verify the production build.

---

**Remember:** Production readiness is not about the code working — it's about the code working **in the production environment**. These are fundamentally different things. Verify both.
