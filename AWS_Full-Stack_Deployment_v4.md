---
name: aws-fullstack-deployment
description: Proven patterns for deploying serverless full-stack applications on AWS using CDK, Lambda, API Gateway, RDS Aurora, and Cognito. Covers CORS two-part system, Cognito-PostgreSQL user synchronisation, multi-service transaction rollback, Lambda variable scoping, CDK environment variable management, invitation/signup flows, password policy alignment, and production readiness. Use when deploying Lambda functions, creating CDK stacks, setting up API routes, configuring databases, managing Cognito users, or handling environment variables. Essential for AWS serverless deployments.
---

# AWS Full-Stack Deployment

Proven patterns from real serverless applications deployed on AWS.

## Stack Architecture Overview

Typical full-stack serverless application consists of:
- **Storage Stack**: VPC, RDS Aurora, S3, DynamoDB, Secrets Manager
- **Auth Stack**: Cognito User Pool, User Groups
- **Compute Stack**: Lambda functions, Lambda Layers, API handlers
- **Orchestration Stack**: API Gateway, Step Functions, SQS, EventBridge

## Core Principles

### 1. Stack Separation
**Separate stacks by lifecycle and dependency:**
- Storage resources change rarely → StorageStack
- Auth resources independent → AuthStack
- Compute resources change frequently → ComputeStack
- Orchestration ties everything together → OrchestrationStack

### 2. Environment Variables Pattern
**Pass configuration, never hardcode:**
```typescript
environment: {
  DB_HOST: props.dbEndpoint,
  DB_PORT: '5432',
  DB_NAME: 'my_production',
  FRONTEND_URL: 'https://your-app.vercel.app', // ⚠️ NEVER localhost in CDK
  NODE_ENV: 'production'
}
```

**Never:**
- Hardcode connection strings
- Commit secrets to code
- Use different patterns across Lambdas
- Leave `localhost` URLs in CDK stack files (see Issue 10)

### 3. Lambda Layer for Shared Code
**Common utilities in layer, not duplicated:**
```
lambda/layers/common/
└── nodejs/
    ├── db-utils.js
    ├── permissions.js
    ├── api-response.js
    ├── cors.js          ⭐ Shared CORS utility
    └── package.json
```

---

## ⚠️ CRITICAL: CORS Configuration (Two-Part System)

**THIS IS THE #1 DEPLOYMENT GOTCHA FOR CROSS-ORIGIN APPS.**

### Why Localhost Hides CORS Issues
- Next.js dev proxy makes API calls same-origin — no CORS needed
- Everything works locally, then breaks on Vercel/Netlify/CloudFront
- You CANNOT detect this problem during local development

### Part 1: API Gateway Preflight (OPTIONS)
```typescript
defaultCorsPreflightOptions: {
  allowOrigins: [
    'http://localhost:3000',
    'https://your-app.vercel.app',
  ],
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
  maxAge: Duration.seconds(3600),
}
```

### Part 2: Lambda Response Headers (THE PART EVERYONE FORGETS)
**Every Lambda function must return CORS headers in EVERY response (including errors).**

```javascript
// lambda/shared/cors.js
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://your-app.vercel.app',
];

const getCorsHeaders = (event) => {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };
};

module.exports = { getCorsHeaders, ALLOWED_ORIGINS };
```

### CORS Debugging Decision Tree
```
Browser shows CORS error
│
├─ OPTIONS request fails?
│  └─ Fix API Gateway CORS config (CDK)
│
├─ OPTIONS succeeds but actual request fails?
│  └─ Lambda response missing CORS headers ← USUALLY THIS
│
├─ Works on localhost but not production?
│  └─ Next.js dev proxy was hiding CORS issues
│
└─ Works on some endpoints but not others?
   └─ Some Lambda handlers missing CORS headers
```

---

## ⚠️ CRITICAL: Variable Scoping in Lambda Handlers

**THE #2 DEPLOYMENT BUG. Caused 100% signup failure rate and 500 errors on all endpoints.**

### The Pattern That Breaks

When Lambda handlers have helper functions, variables declared inside `try` blocks are NOT accessible outside them:

```javascript
// ❌ WRONG — const is block-scoped to the try block
exports.handler = async (event) => {
  try {
    const response = await someService.send(command);
    const importantId = response.Id;  // Block-scoped!
  } catch (error) {
    // importantId NOT accessible here
  }
  
  // importantId NOT accessible here — ReferenceError!
  await db.query('INSERT ... VALUES ($1)', [importantId]);
};

// ✅ CORRECT — declare with let at function scope
exports.handler = async (event) => {
  let importantId = null;  // Function-scoped
  
  try {
    const response = await someService.send(command);
    importantId = response.Id;  // Assignment, not declaration
  } catch (error) {
    // importantId accessible (may be null)
  }
  
  // importantId accessible here
  if (importantId) {
    await db.query('INSERT ... VALUES ($1)', [importantId]);
  }
};
```

### The `event` Parameter Bug

When adding CORS to existing handlers, it's easy to add `getCorsHeaders(event)` inside helper functions that don't receive `event`:

```javascript
// ❌ WRONG — event not passed to helper
exports.handler = async (event) => {
  return await handleGet(dbClient, userId);
};
async function handleGet(dbClient, userId) {
  return { statusCode: 200, headers: getCorsHeaders(event) }; // 💥 event is undefined!
}

// ✅ CORRECT — event passed as parameter
exports.handler = async (event) => {
  return await handleGet(dbClient, userId, event);
};
async function handleGet(dbClient, userId, event) {
  return { statusCode: 200, headers: getCorsHeaders(event) }; // ✅ works
}
```

### Rule: After modifying ANY Lambda handler
1. Search for all variables used outside their declaration block
2. Verify every helper function that uses `event` receives it as a parameter
3. Test with `curl` AFTER deploying — not just locally

---

## ⚠️ CRITICAL: Cognito + PostgreSQL User Synchronisation

**THE #3 DEPLOYMENT BUG. Caused all analyst signups to fail silently.**

### The Problem
When creating users, you have TWO identity stores (Cognito and PostgreSQL). They MUST use the same user_id. If they don't, authentication works (Cognito) but data access fails (database lookup by JWT sub returns nothing).

### The Rule
**ALWAYS create Cognito user FIRST, extract the `sub` (Username), then use it as the PostgreSQL `user_id`.**

```javascript
// ✅ CORRECT PATTERN
let cognitoUserId = null;  // Declare at function scope

try {
  const createUserResponse = await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId: userPoolId,
    Username: email,
    UserAttributes: [{ Name: 'email', Value: email }],
    MessageAction: 'SUPPRESS',
  }));
  
  cognitoUserId = createUserResponse.User.Username;  // This IS the Cognito sub
  
  // Set permanent password
  await cognitoClient.send(new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username: email,
    Password: password,
    Permanent: true,
  }));
  
} catch (cognitoError) {
  if (cognitoError.name === 'UsernameExistsException') {
    // Recover orphaned user from previous failed attempt
    const existingUser = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: email,
    }));
    cognitoUserId = existingUser.Username;
    
    // Update their password
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    }));
  } else if (cognitoError.name === 'InvalidPasswordException') {
    return { statusCode: 400, headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Password does not meet requirements' }) };
  } else {
    throw cognitoError;
  }
}

// Use Cognito sub as PostgreSQL user_id
const userResult = await dbClient.query(
  `INSERT INTO users (user_id, email, ...) VALUES ($1, $2, ...)
   ON CONFLICT (email, organization_id) DO UPDATE SET
     user_id = EXCLUDED.user_id, is_active = true
   RETURNING user_id, email`,
  [cognitoUserId, email, ...]  // ← Cognito sub as user_id
);
```

### Why This Matters (Auth Flow)
```
1. User signs up → Cognito creates user with sub = "abc-123"
2. Database INSERT uses user_id = "abc-123" (MUST MATCH)
3. User logs in → Cognito returns JWT with sub = "abc-123"
4. Backend queries: SELECT * FROM users WHERE user_id = "abc-123"
5. If user_id doesn't match sub → authentication fails silently
```

### Required IAM Permissions for User Management
```typescript
handler.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'cognito-idp:AdminCreateUser',
    'cognito-idp:AdminSetUserPassword',
    'cognito-idp:AdminAddUserToGroup',
    'cognito-idp:AdminGetUser',      // For looking up existing users
    'cognito-idp:AdminDeleteUser',    // For rollback on failure
  ],
  resources: [props.userPool.userPoolArn],
}));
```

---

## Multi-Service Transaction Pattern (Cognito + Database)

### The Problem
Cognito and PostgreSQL are separate services. There's no distributed transaction. If step 2 fails after step 1 succeeds, you get orphaned data.

### The Pattern: Rollback on Failure

```javascript
let cognitoUserId = null;
let cognitoUserCreated = false;

// Step 1: Create Cognito user
try {
  const response = await cognitoClient.send(createUserCommand);
  cognitoUserId = response.User.Username;
  cognitoUserCreated = true;
} catch (error) {
  // Handle UsernameExistsException (recovery) or return error
}

// Step 2: Database operations (wrapped for rollback)
try {
  await dbClient.query('INSERT INTO users (user_id, ...) VALUES ($1, ...)', [cognitoUserId, ...]);
  await dbClient.query('INSERT INTO session_participants ...', [cognitoUserId, ...]);
  await dbClient.query('UPDATE invitations SET accepted_at = NOW() ...');
  
  return { statusCode: 200, ... };
  
} catch (dbError) {
  console.error('Database failed, rolling back Cognito user:', dbError);
  
  if (cognitoUserCreated && cognitoUserId) {
    try {
      await cognitoClient.send(new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: email,
      }));
      console.log('Rolled back Cognito user');
    } catch (rollbackError) {
      console.error('Rollback failed — orphaned Cognito user:', rollbackError);
    }
  }
  
  return { statusCode: 500, headers: getCorsHeaders(event),
    body: JSON.stringify({ error: 'Account creation failed. Please try again.' }) };
}
```

### Make Database Operations Idempotent
Use `ON CONFLICT` so retries don't fail on duplicate entries:

```sql
-- Users: upsert by email + org
INSERT INTO users (user_id, email, organization_id, ...)
VALUES ($1, $2, $3, ...)
ON CONFLICT (email, organization_id) DO UPDATE SET
  user_id = EXCLUDED.user_id, is_active = true
RETURNING user_id, email;

-- Session participants: upsert by user + session
INSERT INTO session_participants (user_id, session_id, role)
VALUES ($1, $2, 'reviewer')
ON CONFLICT (user_id, session_id) DO UPDATE SET
  role = EXCLUDED.role
RETURNING user_id, session_id;
```

---

## Password Policy Alignment

**Frontend validation MUST match Cognito policy exactly. If they differ, users pass frontend validation but Cognito rejects them → 500 error.**

### Check Your Cognito Policy First
```bash
aws cognito-idp describe-user-pool --user-pool-id YOUR_POOL_ID --region YOUR_REGION \
  --query "UserPool.Policies.PasswordPolicy"
```

### Match in Frontend
```typescript
const validatePassword = (password: string): string | null => {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Z]/.test(password)) return "Must contain uppercase letter";
  if (!/[a-z]/.test(password)) return "Must contain lowercase letter";
  if (!/[0-9]/.test(password)) return "Must contain a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Must contain special character";
  return null;
};
```

### Handle Cognito Password Rejection Gracefully
```javascript
if (error.name === 'InvalidPasswordException') {
  return {
    statusCode: 400,  // Client error, NOT 500
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      error: 'Password does not meet requirements',
      details: 'Minimum 12 characters with uppercase, lowercase, number, and special character',
    }),
  };
}
```

---

## CDK Environment Variables — The Localhost Trap

**CDK files often contain `FRONTEND_URL: 'http://localhost:3000'` with a TODO comment that never gets updated. This causes Lambda-generated URLs (invitation links, email links, redirects) to point to localhost in production.**

### Audit Script
```bash
# Find ALL localhost references in CDK and Lambda
grep -rn "localhost" lib/ lambda/ --include="*.ts" --include="*.js" \
  | grep -v node_modules | grep -v ".next" | grep -v test

# Check Lambda environment variables in AWS
aws lambda list-functions --region YOUR_REGION \
  --query "Functions[].{Name:FunctionName,Env:Environment.Variables}" \
  --output json | grep -i "localhost\|FRONTEND_URL"
```

### Rule
Before any production deployment:
1. Search for `localhost` in `lib/*.ts` (CDK stacks)
2. Search for `localhost` in `lambda/` (handler code)
3. Verify deployed Lambda env vars match production URLs

---

## Cognito Authentication Patterns

### Backend Handles Cognito (Recommended)
```javascript
// Frontend sends simple JSON to YOUR API
const response = await fetch(`${API_BASE_URL}/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'login', email, password }),
});

// Backend Lambda uses AdminInitiateAuthCommand
const command = new AdminInitiateAuthCommand({
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID,
  AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
  AuthParameters: { USERNAME: email, PASSWORD: password },
});
```

### Enable Auth Flows
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --region YOUR_REGION \
  --explicit-auth-flows ALLOW_ADMIN_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

### Update Callback URLs for Production
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --callback-urls "http://localhost:3000/auth/callback" "https://your-app.vercel.app/auth/callback" \
  --logout-urls "http://localhost:3000" "https://your-app.vercel.app"
```

---

## Lambda Function Patterns

### Standard Function Structure
```typescript
const myFunction = new lambda.Function(this, 'MyFunctionName', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/functions/my-function'),
  layers: [commonLayer],
  environment: {
    DB_HOST: props.dbEndpoint,
    FRONTEND_URL: 'https://your-app.vercel.app', // NEVER localhost
  },
  timeout: Duration.seconds(30),
  memorySize: 256,
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
});
```

### Function Sizing Guidelines
| Type | Memory | Timeout | Why |
|------|--------|---------|-----|
| API Handlers | 256-512 MB | 30s | Quick response |
| AI/ML Processing | 1024-3072 MB | 300s | Claude API calls can be slow |
| Data Processing | 512-1024 MB | 60-180s | DB queries, transforms |
| Scheduled Jobs | 512-1024 MB | 300-900s | Batch operations |

---

## Database Connection Patterns

### Connection Pooling (Critical)
```javascript
const { Pool } = require('pg');

// Create pool OUTSIDE handler (reused across invocations)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 5,  // Limit per Lambda
  idleTimeoutMillis: 30000
});
```

---

## Frontend Deployment (Vercel/Netlify)

### Production vs Preview
- **Preview deployments** require Vercel login to access
- **Production deployments** are public
- Check Settings → Git → Production Branch matches your branch

### Environment Variables
Set in Vercel Dashboard:
```
NEXT_PUBLIC_API_BASE_URL=https://api-id.execute-api.region.amazonaws.com/production
```

### Frontend Auth — Use Relative Paths for Redirects
```typescript
// ✅ Works on any domain
router.push("/login?message=Account created successfully");

// ❌ Breaks when deployed
router.push("http://localhost:3000/login");
```

---

## Common Issues & Solutions (Ranked by Frequency)

### Issue 1: CORS — "Failed to fetch" (90% of first deployments)
**Root cause:** Lambda responses missing `Access-Control-Allow-Origin`.
**Fix:** Shared CORS utility in every handler, every return statement.

### Issue 2: Variable Scope — "X is not defined" (50% of CORS retrofits)
**Root cause:** `const` inside `try` block used outside it, or `event` not passed to helpers.
**Fix:** Declare with `let` at function scope. Pass `event` to every helper.

### Issue 3: Cognito/DB User Mismatch — Silent auth failure
**Root cause:** Cognito `sub` ≠ PostgreSQL `user_id`.
**Fix:** Always extract `createUserResponse.User.Username` and use as `user_id`.

### Issue 4: Orphaned Cognito Users — "UsernameExistsException"
**Root cause:** Cognito user created, then database INSERT fails.
**Fix:** Handle `UsernameExistsException` by looking up existing user. Add rollback.

### Issue 5: Password Policy Mismatch — 500 on signup
**Root cause:** Frontend validates 8 chars, Cognito requires 12.
**Fix:** Match frontend validation to Cognito policy. Return 400 not 500.

### Issue 6: CDK localhost URLs — Invitation links go to localhost
**Root cause:** `FRONTEND_URL: 'http://localhost:3000'` in CDK with TODO never done.
**Fix:** Grep for localhost in `lib/*.ts` before every deployment.

### Issue 7: Auth Format Mismatch — 400 Bad Request
**Root cause:** Frontend sending `application/x-amz-json-1.1` to your API.
**Fix:** Frontend sends JSON to your backend; backend handles Cognito.

### Issue 8: Cognito Auth Flow Not Enabled
**Root cause:** `ADMIN_USER_PASSWORD_AUTH` not in ExplicitAuthFlows.
**Fix:** `aws cognito-idp update-user-pool-client --explicit-auth-flows ...`

### Issue 9: Lambda Timeout
**Fix:** `timeout: Duration.seconds(30)` minimum for API handlers.

### Issue 10: Vercel Preview vs Production
**Fix:** Verify Production Branch in Vercel Settings → Git.

---

## Production Deployment Checklist (New Project)

### Backend
- [ ] All Lambda handlers include CORS response headers on EVERY return
- [ ] CORS shared utility created and imported everywhere
- [ ] API Gateway CORS includes production frontend URL
- [ ] All helper functions receive `event` as parameter
- [ ] No `const` declarations inside try blocks that are used outside
- [ ] All Lambda functions have appropriate timeout/memory
- [ ] Database connectivity verified from Lambda
- [ ] Secrets in Secrets Manager (not hardcoded)
- [ ] No `localhost` URLs in CDK stack files (`lib/*.ts`)
- [ ] No `localhost` URLs in Lambda code (`lambda/**/*.js`)

### Auth (Cognito)
- [ ] Auth flows enabled (ADMIN_USER_PASSWORD_AUTH)
- [ ] Callback URLs include production domain
- [ ] Logout URLs include production domain
- [ ] Frontend password validation matches Cognito policy EXACTLY
- [ ] Cognito errors return 400 (not 500) with user-friendly messages
- [ ] Cognito user_id (sub) used as PostgreSQL user_id
- [ ] UsernameExistsException handled (orphan recovery)
- [ ] Database failure triggers Cognito user rollback
- [ ] Database INSERTs use ON CONFLICT for idempotency

### Frontend
- [ ] Environment variables set in hosting platform
- [ ] No hardcoded localhost URLs anywhere
- [ ] Redirects use relative paths (not absolute URLs)
- [ ] Production deployment exists (not just preview)
- [ ] Production branch configured correctly

### CORS (Test All from Production Origin)
- [ ] OPTIONS returns correct Access-Control-Allow-Origin
- [ ] GET responses include Access-Control-Allow-Origin
- [ ] POST responses include Access-Control-Allow-Origin
- [ ] Error responses (400, 500) include Access-Control-Allow-Origin
- [ ] Tested from actual production URL in incognito browser

### End-to-End
- [ ] Login works from incognito browser
- [ ] Dashboard loads without console errors
- [ ] Invitation email contains production URL
- [ ] Signup flow completes (Cognito + DB + session access)
- [ ] New user can login and see assigned sessions
- [ ] All API endpoints return data with CORS headers

---

## Quick Start: Lambda Handler Template

```javascript
const { getCorsHeaders } = require('../../shared/cors');

const respond = (statusCode, body, event) => ({
  statusCode,
  headers: getCorsHeaders(event),
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;

    if (method === 'GET') {
      const data = await handleGet(event);
      return respond(200, data, event);
    }

    if (method === 'POST') {
      const result = await handlePost(event);
      return respond(201, result, event);
    }

    return respond(405, { error: 'Method not allowed' }, event);
  } catch (error) {
    console.error('Handler error:', error);
    return respond(500, { error: error.message }, event);
  }
};

// ✅ Every helper receives event
async function handleGet(event) {
  // ...
}
```

---

**Remember:**
1. CORS is TWO-PART: API Gateway handles OPTIONS, YOUR Lambda handles everything else.
2. Variables declared with `const` inside `try {}` are NOT accessible outside it.
3. Cognito sub MUST equal PostgreSQL user_id — extract it from the response, don't generate a new UUID.
4. Localhost works. Production doesn't. That gap is where all the bugs hide.
