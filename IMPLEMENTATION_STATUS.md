# Implementation Status - Backend API Handlers

## Overview
This document tracks the implementation status of all 8 backend API Lambda handlers for the Overlay Platform.

**Status: 3/8 Complete (37.5%)**

## Completed Handlers

### 1. organizations-handler ✅
**File**: [lambda/functions/organizations-handler/index.js](lambda/functions/organizations-handler/index.js)

**Routes**:
- `GET /organizations` - List all organizations (with user access filtering)
- `GET /organizations/{id}` - Get specific organization
- `POST /organizations` - Create new organization
- `PUT /organizations/{id}` - Update organization
- `DELETE /organizations/{id}` - Soft delete organization

**Database Tables**:
- `organizations` (organization_id, name, description, settings, created_at, updated_at, is_active)

**Key Features**:
- User access control filtering (only shows orgs user belongs to)
- Admin override (user ID `10000000-0000-0000-0000-000000000001` sees all)
- Soft delete pattern (sets `is_active = false`)
- Member count aggregation in list view
- JSON settings field support

**Code Example - List with Access Control**:
```javascript
async function handleGet(dbClient, pathParameters, userId) {
  const orgId = pathParameters?.id;

  if (!orgId) {
    // List organizations with access control
    const query = `
      SELECT DISTINCT
        o.organization_id, o.name, o.description, o.settings,
        o.created_at, o.updated_at, o.is_active,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.organization_id) as member_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.organization_id
      WHERE o.is_active = true
        AND (u.user_id = $1 OR $1 = '10000000-0000-0000-0000-000000000001')
      ORDER BY o.created_at DESC
    `;
    const result = await dbClient.query(query, [userId]);
    return { statusCode: 200, body: JSON.stringify({ organizations: result.rows, total: result.rows.length }) };
  }
}
```

---

### 2. overlays-crud-handler ✅
**File**: [lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js)

**Routes**:
- `GET /overlays` - List all overlays with counts
- `GET /overlays/{id}` - Get overlay with evaluation criteria
- `POST /overlays` - Create overlay with criteria
- `PUT /overlays/{id}` - Update overlay
- `DELETE /overlays/{id}` - Soft delete overlay

**Database Tables**:
- `overlays` (overlay_id, name, description, document_type, configuration, created_by, is_active)
- `evaluation_criteria` (criteria_id, overlay_id, name, description, criterion_type, weight, is_required, display_order)

**Key Features**:
- Loads related evaluation criteria when fetching single overlay
- Creates overlay and multiple criteria in single API call
- Counts criteria and submissions in list view
- JSON configuration field support
- Ordered criteria results (by display_order, then name)

**Code Example - Create with Related Data**:
```javascript
async function handleCreate(dbClient, requestBody, userId) {
  const { name, description, document_type, configuration, criteria } = JSON.parse(requestBody);

  // Create overlay
  const overlayQuery = `
    INSERT INTO overlays (name, description, document_type, configuration, created_by, is_active)
    VALUES ($1, $2, $3, $4, $5, true)
    RETURNING overlay_id, name, description, document_type, created_at
  `;
  const overlayResult = await dbClient.query(overlayQuery, [
    name, description || null, document_type,
    configuration ? JSON.stringify(configuration) : null, userId
  ]);
  const overlay = overlayResult.rows[0];

  // Create criteria if provided
  if (criteria && criteria.length > 0) {
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      await dbClient.query(
        `INSERT INTO evaluation_criteria
         (overlay_id, name, description, criterion_type, weight, is_required, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [overlay.overlay_id, c.name, c.description, c.criterion_type || 'general',
         c.weight || 1, c.is_required || false, i]
      );
    }
  }

  return { statusCode: 201, body: JSON.stringify(overlay) };
}
```

**Code Example - Get with Related Data**:
```javascript
async function handleGet(dbClient, pathParameters, userId) {
  const overlayId = pathParameters?.id;

  if (overlayId) {
    // Get overlay
    const overlayQuery = `
      SELECT overlay_id, name, description, document_type,
             configuration, created_by, created_at, updated_at, is_active
      FROM overlays WHERE overlay_id = $1 AND is_active = true
    `;
    const overlayResult = await dbClient.query(overlayQuery, [overlayId]);

    if (overlayResult.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Overlay not found' }) };
    }

    // Get evaluation criteria
    const criteriaQuery = `
      SELECT criteria_id, name, description, criterion_type, weight,
             is_required, display_order, validation_rules
      FROM evaluation_criteria WHERE overlay_id = $1
      ORDER BY display_order, name
    `;
    const criteriaResult = await dbClient.query(criteriaQuery, [overlayId]);

    const overlay = overlayResult.rows[0];
    overlay.criteria = criteriaResult.rows;
    return { statusCode: 200, body: JSON.stringify(overlay) };
  }
}
```

---

### 3. sessions-crud-handler ✅
**File**: [lambda/functions/sessions-crud-handler/index.js](lambda/functions/sessions-crud-handler/index.js)

**Routes**:
- `GET /sessions` - List user's sessions
- `GET /sessions/available` - List sessions user can join
- `GET /sessions/{id}` - Get session with participants
- `GET /sessions/{id}/submissions` - Get submissions for session
- `POST /sessions` - Create new session
- `PUT /sessions/{id}` - Update session
- `DELETE /sessions/{id}` - Archive session

**Database Tables**:
- `review_sessions` (session_id, overlay_id, name, description, status, created_by)
- `session_participants` (session_id, user_id, role, joined_at)
- `document_submissions` (submission_id, session_id, document_name, status, submitted_by)
- `evaluation_responses` (response_id, submission_id, score)

**Key Features**:
- Special route handling (`/available`, `/submissions`)
- Loads participants with user details
- Creates session and adds creator as owner in single call
- Aggregated submission data with average scores
- Status filtering (active/archived)

**Code Example - Special Routes**:
```javascript
exports.handler = async (event) => {
  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;
  try {
    dbClient = await createDbConnection();

    // Handle special routes
    if (path.endsWith('/available')) {
      return await handleGetAvailable(dbClient, userId);
    }
    if (path.includes('/submissions')) {
      return await handleGetSessionSubmissions(dbClient, pathParameters, userId);
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
```

**Code Example - Available Sessions**:
```javascript
async function handleGetAvailable(dbClient, userId) {
  const query = `
    SELECT s.session_id, s.name, s.description, s.status,
           s.created_at, o.name as overlay_name,
           u.first_name || ' ' || u.last_name as created_by_name
    FROM review_sessions s
    LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
    LEFT JOIN users u ON s.created_by = u.user_id
    WHERE s.status = 'active'
      AND s.session_id NOT IN (
        SELECT session_id FROM session_participants WHERE user_id = $1
      )
    ORDER BY s.created_at DESC
  `;
  const result = await dbClient.query(query, [userId]);
  return { statusCode: 200, body: JSON.stringify({ sessions: result.rows, total: result.rows.length }) };
}
```

**Code Example - Session Submissions with Aggregation**:
```javascript
async function handleGetSessionSubmissions(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.id;

  const query = `
    SELECT ds.submission_id, ds.document_name, ds.status, ds.ai_analysis_status,
           ds.submitted_at, u.first_name || ' ' || u.last_name as submitted_by_name,
           (SELECT AVG(score) FROM evaluation_responses WHERE submission_id = ds.submission_id) as avg_score
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    WHERE ds.session_id = $1
    ORDER BY ds.submitted_at DESC
  `;
  const result = await dbClient.query(query, [sessionId]);
  return { statusCode: 200, body: JSON.stringify({ submissions: result.rows, total: result.rows.length }) };
}
```

---

## Remaining Handlers (Not Yet Implemented)

### 4. submissions-crud-handler ❌
**Priority**: HIGH

**Routes to Implement**:
- `GET /submissions` - List user's submissions
- `GET /submissions/{id}` - Get submission with full analysis
- `GET /submissions/{id}/analysis` - Get AI analysis results
- `POST /submissions` - Upload document and create submission
- `PUT /submissions/{id}` - Update submission metadata
- `DELETE /submissions/{id}` - Delete submission

**Database Tables**:
- `document_submissions` - Main submission record
- `ai_agent_results` - Raw AI analysis output
- `evaluation_responses` - Reviewer scores
- `clarification_questions` - AI-generated questions
- `clarification_answers` - User responses

**Key Implementation Points**:
- S3 upload integration for document files
- Step Functions workflow trigger for AI analysis
- Poll AI analysis status (pending/processing/completed/failed)
- Aggregate all AI agent results into single response
- Load related questions and answers

**Database Schema**:
```sql
CREATE TABLE document_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES review_sessions(session_id),
  overlay_id UUID REFERENCES overlays(overlay_id),
  document_name TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  ai_analysis_status TEXT DEFAULT 'pending',
  submitted_by UUID REFERENCES users(user_id),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Suggested Implementation Pattern**:
```javascript
async function handleCreate(dbClient, requestBody, userId) {
  const { session_id, overlay_id, document_name, document_content } = JSON.parse(requestBody);

  // 1. Upload document to S3
  const s3Key = `submissions/${userId}/${Date.now()}-${document_name}`;
  // await uploadToS3(document_content, s3Key);

  // 2. Create submission record
  const submissionQuery = `
    INSERT INTO document_submissions
    (session_id, overlay_id, document_name, s3_bucket, s3_key, submitted_by, status, ai_analysis_status)
    VALUES ($1, $2, $3, $4, $5, $6, 'submitted', 'pending')
    RETURNING submission_id, document_name, status, ai_analysis_status, submitted_at
  `;
  const result = await dbClient.query(submissionQuery,
    [session_id, overlay_id, document_name, process.env.DOCUMENTS_BUCKET, s3Key, userId]);

  // 3. Trigger Step Functions workflow
  // await triggerAIWorkflow(result.rows[0].submission_id, s3Key);

  return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
}

async function handleGetAnalysis(dbClient, pathParameters, userId) {
  const submissionId = pathParameters?.id;

  // Get all AI agent results
  const query = `
    SELECT agent_name, result_data, status, execution_time_ms
    FROM ai_agent_results
    WHERE submission_id = $1
    ORDER BY created_at
  `;
  const result = await dbClient.query(query, [submissionId]);

  // Aggregate results
  const analysis = {
    structure: result.rows.find(r => r.agent_name === 'structure-validator')?.result_data,
    content: result.rows.find(r => r.agent_name === 'content-analyzer')?.result_data,
    grammar: result.rows.find(r => r.agent_name === 'grammar-checker')?.result_data,
    scoring: result.rows.find(r => r.agent_name === 'scoring')?.result_data,
    clarification: result.rows.find(r => r.agent_name === 'clarification')?.result_data
  };

  return { statusCode: 200, body: JSON.stringify(analysis) };
}
```

---

### 5. users-handler ❌
**Priority**: HIGH

**Routes to Implement**:
- `GET /users` - List users in organization
- `GET /users/{id}` - Get user profile
- `POST /users` - Create user
- `PUT /users/{id}` - Update user profile
- `DELETE /users/{id}` - Deactivate user

**Database Tables**:
- `users` (user_id, organization_id, email, first_name, last_name, role, is_active)

**Database Schema**:
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(organization_id),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Implementation Points**:
- Organization-scoped user listing
- Role validation (Admin, Reviewer, Viewer)
- Cognito integration for authentication
- Email uniqueness validation

---

### 6. invitations-handler ❌
**Priority**: MEDIUM

**Routes to Implement**:
- `POST /sessions/{id}/invite` - Invite user to session
- `GET /invitations` - List user's pending invitations
- `POST /invitations/{id}/accept` - Accept invitation
- `POST /invitations/{id}/decline` - Decline invitation

**Database Tables**:
- `session_participants` (session_id, user_id, role, joined_at)

**Key Implementation Points**:
- Check user permissions to invite
- Prevent duplicate invitations
- Add participant on acceptance
- Notification system (email/in-app)

---

### 7. answers-handler ❌
**Priority**: MEDIUM

**Routes to Implement**:
- `GET /submissions/{id}/answers` - Get answers for submission
- `POST /submissions/{id}/answers` - Submit answer to question

**Database Tables**:
- `clarification_questions` (question_id, submission_id, question_text, priority)
- `clarification_answers` (answer_id, question_id, answer_text, answered_by)

**Database Schema**:
```sql
CREATE TABLE clarification_answers (
  answer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES clarification_questions(question_id),
  submission_id UUID REFERENCES document_submissions(submission_id),
  answer_text TEXT NOT NULL,
  answered_by UUID REFERENCES users(user_id),
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Implementation Points**:
- Validate question belongs to submission
- Track who answered each question
- Support updating existing answers

---

### 8. analytics-handler ❌
**Priority**: LOW

**Routes to Implement**:
- `GET /analytics/overview` - Dashboard metrics
- `GET /analytics/submissions` - Submission statistics
- `GET /analytics/users` - User activity metrics

**Key Implementation Points**:
- Organization-scoped analytics
- Time-based aggregations (daily/weekly/monthly)
- Performance metrics (avg scores, completion rates)
- User activity tracking

**Suggested Metrics**:
```javascript
async function handleOverview(dbClient, userId) {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM document_submissions WHERE submitted_by = $1) as total_submissions,
      (SELECT COUNT(*) FROM review_sessions WHERE created_by = $1) as sessions_created,
      (SELECT AVG(score) FROM evaluation_responses er
       JOIN document_submissions ds ON er.submission_id = ds.submission_id
       WHERE ds.submitted_by = $1) as avg_score,
      (SELECT COUNT(*) FROM document_submissions
       WHERE submitted_by = $1 AND ai_analysis_status = 'completed') as completed_analyses
  `;
  const result = await dbClient.query(query, [userId]);
  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}
```

---

## Standard Implementation Pattern

All handlers follow this structure:

```javascript
const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Handler:', JSON.stringify(event));

  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Handle special routes if needed
    if (path.endsWith('/special-route')) {
      return await handleSpecialRoute(dbClient, pathParameters, userId);
    }

    // Standard CRUD routing
    switch (httpMethod) {
      case 'GET':
        return await handleGet(dbClient, pathParameters, userId);
      case 'POST':
        return await handleCreate(dbClient, requestBody, userId);
      case 'PUT':
        return await handleUpdate(dbClient, pathParameters, requestBody, userId);
      case 'DELETE':
        return await handleDelete(dbClient, pathParameters, userId);
      default:
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

async function handleGet(dbClient, pathParameters, userId) {
  const id = pathParameters?.id;

  if (id) {
    // Get single record
    const query = `SELECT * FROM table_name WHERE id = $1`;
    const result = await dbClient.query(query, [id]);

    if (result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
  } else {
    // List records with access control
    const query = `SELECT * FROM table_name WHERE user_id = $1 ORDER BY created_at DESC`;
    const result = await dbClient.query(query, [userId]);
    return { statusCode: 200, body: JSON.stringify({ items: result.rows, total: result.rows.length }) };
  }
}

async function handleCreate(dbClient, requestBody, userId) {
  const { field1, field2 } = JSON.parse(requestBody);

  if (!field1) {
    return { statusCode: 400, body: JSON.stringify({ error: 'field1 required' }) };
  }

  const query = `
    INSERT INTO table_name (field1, field2, user_id)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await dbClient.query(query, [field1, field2, userId]);

  console.log(`Record created: ${result.rows[0].id}`);
  return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const id = pathParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'ID required' }) };
  }

  const { field1, field2 } = JSON.parse(requestBody);

  const query = `
    UPDATE table_name
    SET field1 = COALESCE($2, field1),
        field2 = COALESCE($3, field2),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  const result = await dbClient.query(query, [id, field1 || null, field2 || null]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId) {
  const id = pathParameters?.id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'ID required' }) };
  }

  // Soft delete
  const query = `
    UPDATE table_name SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id
  `;
  const result = await dbClient.query(query, [id]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Deleted', id: id }) };
}
```

## Security Considerations

All handlers must implement:
1. **Parameterized Queries**: Always use `$1, $2` placeholders to prevent SQL injection
2. **User Authentication**: Extract user ID from `requestContext.authorizer.claims.sub`
3. **Access Control**: Filter data by user ID or organization membership
4. **Input Validation**: Validate required fields before database operations
5. **Error Handling**: Never expose raw database errors to clients
6. **Soft Deletes**: Use `is_active` flags instead of hard deletes where appropriate

## Next Steps

1. Implement submissions-crud-handler (highest priority)
2. Implement users-handler
3. Implement invitations-handler
4. Implement answers-handler
5. Implement analytics-handler
6. Update lib/compute-stack.ts with all 8 Lambda functions
7. Configure API Gateway routes
8. Deploy OverlayComputeStack
9. Create test scripts
10. Update frontend to use real APIs
