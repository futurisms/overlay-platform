# Next Session Continuation Prompt

Use this prompt when starting a fresh Claude session to continue implementation:

---

## Continuation Prompt

I'm continuing work on the Overlay Platform - an AI-powered document analysis system built with AWS CDK, Lambda, Step Functions, Aurora PostgreSQL, and Next.js.

**Current Status**: Backend API implementation is 37.5% complete (3 out of 8 Lambda CRUD handlers done).

**Completed Work**:
- ✅ All 6 AI agent Lambda functions deployed and working (structure-validator, content-analyzer, grammar-checker, orchestrator, clarification, scoring)
- ✅ Database layer complete (db-utils.js v2.0.0, llm-client.js v2.3.0)
- ✅ Aurora PostgreSQL database deployed with full schema
- ✅ Frontend Next.js app displaying real AI analysis results
- ✅ 3 CRUD handlers implemented: organizations-handler, overlays-crud-handler, sessions-crud-handler

**Remaining Work**:
- ❌ 5 CRUD handlers to implement: submissions-crud-handler, users-handler, invitations-handler, answers-handler, analytics-handler
- ❌ Update lib/compute-stack.ts to add all 8 Lambda functions
- ❌ Configure API Gateway routes
- ❌ Deploy OverlayComputeStack
- ❌ Create test scripts

**Please read these files for context**:
1. [CLAUDE.md](CLAUDE.md) - Overall project status and architecture
2. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - Detailed handler patterns and examples
3. [lambda/functions/organizations-handler/index.js](lambda/functions/organizations-handler/index.js) - Reference implementation
4. [lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js) - Shows loading related data
5. [lambda/functions/sessions-crud-handler/index.js](lambda/functions/sessions-crud-handler/index.js) - Shows special routes

**Task**: Continue implementing the 5 remaining Lambda handlers following the established pattern. Start with submissions-crud-handler (highest priority).

---

## Step-by-Step Implementation Plan

### Step 1: Implement submissions-crud-handler
**Priority**: HIGH - This is the core feature connecting frontend uploads to AI analysis

**File to create**: `lambda/functions/submissions-crud-handler/index.js`

**Routes to implement**:
- `GET /submissions` - List user's submissions
- `GET /submissions/{id}` - Get submission with metadata
- `GET /submissions/{id}/analysis` - Get full AI analysis results
- `POST /submissions` - Upload document and create submission
- `PUT /submissions/{id}` - Update submission metadata
- `DELETE /submissions/{id}` - Delete submission

**Database tables involved**:
```sql
document_submissions (submission_id, session_id, overlay_id, document_name, s3_bucket, s3_key, status, ai_analysis_status, submitted_by, submitted_at)
ai_agent_results (result_id, submission_id, agent_name, result_data, status, execution_time_ms)
clarification_questions (question_id, submission_id, question_text, priority, created_at)
clarification_answers (answer_id, question_id, answer_text, answered_by, answered_at)
evaluation_responses (response_id, submission_id, criteria_id, score, reviewer_id)
```

**Key implementation notes**:
1. POST handler needs to:
   - Accept document content (base64 or multipart)
   - Upload to S3 bucket (use environment variable DOCUMENTS_BUCKET)
   - Create submission record with status='submitted', ai_analysis_status='pending'
   - Trigger Step Functions workflow (use environment variable ORCHESTRATOR_STATE_MACHINE_ARN)
   - Return submission_id immediately

2. GET /submissions/{id}/analysis needs to:
   - Query ai_agent_results table for all agent outputs
   - Aggregate results by agent_name
   - Include structure, content, grammar, scoring, clarification results
   - Return status if analysis still pending/processing

3. Use this S3 upload pattern:
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function uploadToS3(content, key) {
  await s3.putObject({
    Bucket: process.env.DOCUMENTS_BUCKET,
    Key: key,
    Body: Buffer.from(content, 'base64'),
    ContentType: 'application/pdf'
  }).promise();
}
```

4. Use this Step Functions trigger pattern:
```javascript
const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();

async function triggerAIWorkflow(submissionId, s3Bucket, s3Key) {
  await stepfunctions.startExecution({
    stateMachineArn: process.env.ORCHESTRATOR_STATE_MACHINE_ARN,
    input: JSON.stringify({ submissionId, s3Bucket, s3Key })
  }).promise();
}
```

**Expected file structure**:
```javascript
const { createDbConnection } = require('/opt/nodejs/db-utils');
const AWS = require('aws-sdk');

exports.handler = async (event) => {
  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;
  try {
    dbClient = await createDbConnection();

    // Special route: GET /submissions/{id}/analysis
    if (path.includes('/analysis')) {
      return await handleGetAnalysis(dbClient, pathParameters, userId);
    }

    // Standard CRUD routes
    switch (httpMethod) {
      case 'GET': return await handleGet(dbClient, pathParameters, userId);
      case 'POST': return await handleCreate(dbClient, requestBody, userId);
      case 'PUT': return await handleUpdate(dbClient, pathParameters, requestBody, userId);
      case 'DELETE': return await handleDelete(dbClient, pathParameters, userId);
      default: return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

async function handleGet(dbClient, pathParameters, userId) { /* ... */ }
async function handleCreate(dbClient, requestBody, userId) { /* ... */ }
async function handleUpdate(dbClient, pathParameters, requestBody, userId) { /* ... */ }
async function handleDelete(dbClient, pathParameters, userId) { /* ... */ }
async function handleGetAnalysis(dbClient, pathParameters, userId) { /* ... */ }
```

---

### Step 2: Implement users-handler
**Priority**: HIGH - Needed for user management

**File to create**: `lambda/functions/users-handler/index.js`

**Routes to implement**:
- `GET /users` - List users in organization
- `GET /users/{id}` - Get user profile
- `POST /users` - Create user
- `PUT /users/{id}` - Update user profile
- `DELETE /users/{id}` - Deactivate user

**Database tables involved**:
```sql
users (user_id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at)
organizations (organization_id, name)
```

**Key implementation notes**:
1. List users should be scoped to user's organization:
```sql
SELECT u.user_id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at
FROM users u
WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
  AND u.is_active = true
ORDER BY u.last_name, u.first_name
```

2. Validate role is one of: 'Admin', 'Reviewer', 'Viewer'

3. Ensure email uniqueness when creating/updating users

4. Integration point for Cognito user pool (future work, not needed now)

---

### Step 3: Implement invitations-handler
**Priority**: MEDIUM - Enables collaborative sessions

**File to create**: `lambda/functions/invitations-handler/index.js`

**Routes to implement**:
- `POST /sessions/{id}/invite` - Invite user to session
- `GET /invitations` - List user's pending invitations
- `POST /invitations/{id}/accept` - Accept invitation and join session
- `POST /invitations/{id}/decline` - Decline invitation

**Database tables involved**:
```sql
review_sessions (session_id, name, created_by)
session_participants (session_id, user_id, role, joined_at)
users (user_id, email, first_name, last_name)
```

**Key implementation notes**:
1. Invitation is represented by adding record to session_participants with role='invited'
2. Acceptance updates role to 'reviewer' and sets joined_at timestamp
3. Check user has permission to invite (must be session owner or admin)
4. Prevent duplicate invitations

**Suggested pattern**:
```javascript
async function handleInvite(dbClient, pathParameters, requestBody, userId) {
  const sessionId = pathParameters?.id;
  const { user_id, role } = JSON.parse(requestBody);

  // Check if user owns session
  const ownerCheck = await dbClient.query(
    'SELECT session_id FROM review_sessions WHERE session_id = $1 AND created_by = $2',
    [sessionId, userId]
  );
  if (ownerCheck.rows.length === 0) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized to invite' }) };
  }

  // Check if already participant
  const existingCheck = await dbClient.query(
    'SELECT session_id FROM session_participants WHERE session_id = $1 AND user_id = $2',
    [sessionId, user_id]
  );
  if (existingCheck.rows.length > 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User already invited or participating' }) };
  }

  // Create invitation
  await dbClient.query(
    'INSERT INTO session_participants (session_id, user_id, role) VALUES ($1, $2, $3)',
    [sessionId, user_id, role || 'reviewer']
  );

  return { statusCode: 201, body: JSON.stringify({ message: 'Invitation sent' }) };
}
```

---

### Step 4: Implement answers-handler
**Priority**: MEDIUM - Enables clarification workflow

**File to create**: `lambda/functions/answers-handler/index.js`

**Routes to implement**:
- `GET /submissions/{id}/answers` - Get all answers for submission
- `POST /submissions/{id}/answers` - Submit answer to clarification question

**Database tables involved**:
```sql
clarification_questions (question_id, submission_id, question_text, priority, created_at)
clarification_answers (answer_id, question_id, submission_id, answer_text, answered_by, answered_at)
```

**Key implementation notes**:
1. When posting answer, validate question_id belongs to the submission_id
2. Allow updating existing answers (upsert pattern)
3. Track who answered with answered_by user_id

**Suggested answer submission pattern**:
```javascript
async function handleCreateAnswer(dbClient, pathParameters, requestBody, userId) {
  const submissionId = pathParameters?.id;
  const { question_id, answer_text } = JSON.parse(requestBody);

  // Validate question belongs to submission
  const questionCheck = await dbClient.query(
    'SELECT question_id FROM clarification_questions WHERE question_id = $1 AND submission_id = $2',
    [question_id, submissionId]
  );
  if (questionCheck.rows.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid question for this submission' }) };
  }

  // Insert or update answer
  const query = `
    INSERT INTO clarification_answers (question_id, submission_id, answer_text, answered_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (question_id)
    DO UPDATE SET answer_text = $3, answered_by = $4, answered_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await dbClient.query(query, [question_id, submissionId, answer_text, userId]);

  return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
}
```

---

### Step 5: Implement analytics-handler
**Priority**: LOW - Nice to have for dashboards

**File to create**: `lambda/functions/analytics-handler/index.js`

**Routes to implement**:
- `GET /analytics/overview` - Dashboard summary metrics
- `GET /analytics/submissions` - Submission statistics over time
- `GET /analytics/users` - User activity metrics

**Key implementation notes**:
1. All queries should be scoped to user's organization
2. Use aggregation functions (COUNT, AVG, etc.)
3. Support date range filtering via query parameters

**Suggested overview query**:
```javascript
async function handleOverview(dbClient, userId) {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM document_submissions ds
       JOIN users u ON ds.submitted_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)) as total_submissions,
      (SELECT COUNT(*) FROM review_sessions rs
       JOIN users u ON rs.created_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)) as total_sessions,
      (SELECT AVG(score) FROM evaluation_responses er
       JOIN document_submissions ds ON er.submission_id = ds.submission_id
       JOIN users u ON ds.submitted_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)) as avg_score
  `;
  const result = await dbClient.query(query, [userId]);
  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}
```

---

### Step 6: Update lib/compute-stack.ts
After all handlers are implemented, update the CDK stack:

**File to modify**: `lib/compute-stack.ts`

**Add Lambda functions** (example for one handler):
```typescript
// Import at top
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

// In constructor, after getting VPC and layer references:

// Organizations Handler
const organizationsHandler = new lambda.Function(this, 'OrganizationsHandler', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/functions/organizations-handler'),
  layers: [commonLayer],
  vpc: vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [dbSecurityGroup],
  environment: {
    DB_SECRET_ARN: dbSecret.secretArn,
    DB_CLUSTER_ARN: dbCluster.clusterArn,
  },
  timeout: cdk.Duration.seconds(30),
});

// Grant permissions
dbSecret.grantRead(organizationsHandler);
dbCluster.grantDataApiAccess(organizationsHandler);

// Repeat for all 8 handlers...
```

**Add API Gateway**:
```typescript
// Create REST API
const api = new apigateway.RestApi(this, 'OverlayApi', {
  restApiName: 'Overlay Platform API',
  description: 'API for Overlay Platform',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
});

// Add resources and methods
const organizations = api.root.addResource('organizations');
organizations.addMethod('GET', new apigateway.LambdaIntegration(organizationsHandler));
organizations.addMethod('POST', new apigateway.LambdaIntegration(organizationsHandler));

const organizationById = organizations.addResource('{id}');
organizationById.addMethod('GET', new apigateway.LambdaIntegration(organizationsHandler));
organizationById.addMethod('PUT', new apigateway.LambdaIntegration(organizationsHandler));
organizationById.addMethod('DELETE', new apigateway.LambdaIntegration(organizationsHandler));

// Repeat for all resources (overlays, sessions, submissions, users, etc.)
```

---

### Step 7: Deploy
```bash
cd c:\Projects\overlay-platform
cdk deploy OverlayComputeStack
```

---

### Step 8: Create test scripts
**File to create**: `scripts/test-api-endpoints.js`

Test each endpoint with sample data and verify responses.

---

## Files to Read for Context

In order of importance:

1. **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Complete patterns and examples for all handlers
2. **[CLAUDE.md](CLAUDE.md)** - Overall project status and next steps
3. **[lambda/functions/organizations-handler/index.js](lambda/functions/organizations-handler/index.js)** - Basic CRUD pattern
4. **[lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js)** - Loading related data pattern
5. **[lambda/functions/sessions-crud-handler/index.js](lambda/functions/sessions-crud-handler/index.js)** - Special routes pattern
6. **[lambda/layers/common/nodejs/db-utils.js](lambda/layers/common/nodejs/db-utils.js)** - Database connection utility
7. **[lib/orchestration-stack.ts](lib/orchestration-stack.ts)** - Reference for CDK patterns
8. **[BACKEND_API_IMPLEMENTATION.md](BACKEND_API_IMPLEMENTATION.md)** - Original implementation plan

## Important Notes

- All handlers use the same db-utils.js layer for database connections
- User ID comes from `requestContext.authorizer.claims.sub` (Cognito JWT)
- Always use parameterized SQL queries ($1, $2, etc.) to prevent SQL injection
- Follow soft delete pattern (set is_active=false) instead of hard deletes
- Return proper HTTP status codes (200, 201, 400, 404, 500)
- Always close database connections in finally block
- Log errors with console.error but don't expose raw errors to clients

## Success Criteria

When this phase is complete, you should have:
- ✅ 8 Lambda handler files created and implemented
- ✅ lib/compute-stack.ts updated with all Lambda functions and API Gateway
- ✅ Successful CDK deployment
- ✅ Test scripts confirming all endpoints work
- ✅ Frontend able to call real APIs (no more sample data)

---

**Ready to start? Begin with Step 1: Implement submissions-crud-handler**
