# Analyst Role Design - Complete Specification

**Date:** 2026-02-03 (Final Version)
**Type:** Simple Enhancement with Session Access + Invitations + Notes Filtering
**Goal:** Allow external analysts to use platform with controlled access
**Effort:** 16-21 hours (2-3 days)

---

## Executive Summary

Add a comprehensive two-role system with session-based access control, user invitations, and notes filtering to existing single-org platform:
- **Admin** (existing user) - Full control + manage session access + view all notes
- **Analyst** (new role) - Access assigned sessions only, view own notes only

**Key Features:**
- ✅ **Session-based access control** - Analysts only see assigned sessions
- ✅ **Token-based invitations** - Email invite with signup link (7-day expiration)
- ✅ **Notes filtering** - Analysts see only their own notes, admins see all
- ✅ **Token usage tracking** - Monitor Claude API costs per analyst (Migration 009 OPERATIONAL)
- ✅ **Permanent passwords** - AWS Cognito authentication with forgot password flow

**Scope:** Minimal changes to existing codebase + 4 new tables
**Target Users:** External analysts, QA team, pilot users, contractors

---

## Requirements

### What Analysts CAN Do
- ✅ Accept invitation via email link (7-day expiration)
- ✅ Sign up with name + password
- ✅ Login with permanent password (AWS Cognito)
- ✅ Use "Forgot password" flow (built into Cognito)
- ✅ **View ONLY assigned sessions** (not all sessions)
- ✅ Submit documents to assigned sessions
- ✅ View their own submissions
- ✅ View their own AI results
- ✅ **Add notes to their own submissions**
- ✅ **View only their own notes** (filtered by created_by)
- ✅ Download their own results
- ✅ View their own token usage

### What Analysts CANNOT Do
- ❌ Create overlays
- ❌ Edit evaluation criteria
- ❌ Create sessions
- ❌ Delete sessions
- ❌ **View sessions they're not assigned to**
- ❌ View other users' submissions
- ❌ **View other users' notes** (even on same submission)
- ❌ View other analysts' token usage
- ❌ Edit any settings
- ❌ Invite other users
- ❌ Delete other users' submissions
- ❌ See admin's notes

### What Admin CAN Do
- ✅ Everything (unchanged from current system)
- ✅ **Invite analysts by email to specific sessions**
- ✅ Create analyst accounts (or existing users get access)
- ✅ View all submissions (including analysts')
- ✅ Delete any submission
- ✅ **Assign analysts to specific sessions**
- ✅ **Revoke session access from analysts**
- ✅ **View who has access to each session**
- ✅ **View ALL notes on all submissions** (including analysts' notes)
- ✅ **Add notes visible to everyone**
- ✅ **View token usage for all analysts**
- ✅ Monitor Claude API costs

---

## Database Changes

### 1. Add Role to Users Table

```sql
-- Migration: 010_add_user_role.sql
ALTER TABLE users
  ADD COLUMN user_role VARCHAR(50) DEFAULT 'admin';

-- Update existing admin
UPDATE users
SET user_role = 'admin'
WHERE email = 'admin@example.com';

-- Constraint
ALTER TABLE users
  ADD CONSTRAINT valid_user_role CHECK (user_role IN ('admin', 'analyst'));

-- Index
CREATE INDEX idx_users_role ON users(user_role);

COMMENT ON COLUMN users.user_role IS 'User role: admin (full access) or analyst (session-based access)';
```

---

### 2. Add Session Access Table

```sql
-- Migration: 011_add_session_access.sql
CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Audit trail
  granted_by UUID REFERENCES users(user_id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate access grants
  CONSTRAINT session_user_unique UNIQUE(session_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_session_access_session ON session_access(session_id);
CREATE INDEX idx_session_access_user ON session_access(user_id);
CREATE INDEX idx_session_access_granted_by ON session_access(granted_by);

COMMENT ON TABLE session_access IS 'Controls which analysts can access which sessions';
COMMENT ON COLUMN session_access.granted_by IS 'Admin who granted access';
```

**Why This Table:**
- Controls which analysts can access which sessions
- Admins always have access (enforced in code, not database)
- Simple many-to-many relationship
- Audit trail (who granted access and when)

---

### 3. Add User Invitations Table (NEW)

```sql
-- Migration: 012_add_user_invitations.sql
CREATE TABLE user_invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Invitation details
  email VARCHAR(255) NOT NULL,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,

  -- Token for secure signup link
  token VARCHAR(64) NOT NULL UNIQUE,

  -- Invitation status
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(user_id),

  -- Audit trail
  invited_by UUID NOT NULL REFERENCES users(user_id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate invitations
  CONSTRAINT email_session_unique UNIQUE(email, session_id)
);

-- Indexes
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_session ON user_invitations(session_id);
CREATE INDEX idx_user_invitations_expires ON user_invitations(expires_at);

COMMENT ON TABLE user_invitations IS 'Token-based invitations for analysts to join sessions';
COMMENT ON COLUMN user_invitations.token IS 'URL-safe random token for invitation link';
COMMENT ON COLUMN user_invitations.expires_at IS 'Invitation expires after 7 days';
```

**Why This Table:**
- Secure invitation system with expiring tokens
- Email-based invitations (no pre-created accounts needed)
- Links email to session access automatically
- Tracks invitation acceptance for audit
- Prevents duplicate invitations per email+session

---

### 4. Update User Notes Table (Existing)

```sql
-- user_notes table already exists from v1.2
-- Add index for filtering by created_by (performance optimization)

-- Migration: 013_add_notes_index.sql
CREATE INDEX idx_user_notes_created_by ON user_notes(created_by);

COMMENT ON COLUMN user_notes.created_by IS 'User who created the note (analysts see only their own)';
```

**Why Index:**
- Analysts will filter notes by `created_by = their_user_id`
- Admin queries for all notes don't need this index
- Improves query performance for analysts

---

### 5. Token Usage Table (OPERATIONAL)

```sql
-- Migration: 009_create_token_usage_table.sql (ALREADY APPLIED)
-- Table exists and is tracking tokens successfully

CREATE TABLE IF NOT EXISTS token_usage (
  token_usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
  agent_name VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  model_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_submission_id ON token_usage(submission_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_name ON token_usage(agent_name);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at DESC);

-- Summary view
CREATE OR REPLACE VIEW v_token_usage_summary AS
SELECT
  submission_id,
  COUNT(*) as agent_calls,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  ARRAY_AGG(DISTINCT agent_name ORDER BY agent_name) as agents_used,
  MAX(created_at) as last_agent_call
FROM token_usage
GROUP BY submission_id;
```

**Status:** ✅ OPERATIONAL (verified with submission ccca1d00-6a91-414e-b656-15cfb6ba2ae9)
**Cost per submission:** ~$0.13 (20,380 tokens average)

---

## Permission Logic

### Backend Permission Helper

```javascript
// lambda/layers/common/nodejs/permissions.js

/**
 * Check if user is admin
 */
function isAdmin(user) {
  return user.user_role === 'admin';
}

/**
 * Check if user can edit overlays/criteria/sessions
 */
function canEdit(user) {
  return isAdmin(user);
}

/**
 * Check if user can access a specific session
 * Admins can access all sessions
 * Analysts can only access sessions they're assigned to
 */
async function canAccessSession(dbClient, user, sessionId) {
  // Admins can access any session
  if (isAdmin(user)) {
    return true;
  }

  // Analysts must have explicit access
  const query = `
    SELECT 1 FROM session_access
    WHERE session_id = $1 AND user_id = $2
  `;
  const result = await dbClient.query(query, [sessionId, user.user_id]);

  return result.rows.length > 0;
}

/**
 * Get all sessions accessible to user
 * Admins get all sessions
 * Analysts get only assigned sessions
 */
async function getAccessibleSessions(dbClient, user) {
  if (isAdmin(user)) {
    // Admin sees all sessions
    const query = `
      SELECT * FROM review_sessions
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return await dbClient.query(query);
  } else {
    // Analyst sees only assigned sessions
    const query = `
      SELECT rs.*
      FROM review_sessions rs
      INNER JOIN session_access sa ON rs.session_id = sa.session_id
      WHERE sa.user_id = $1
        AND rs.deleted_at IS NULL
      ORDER BY rs.created_at DESC
    `;
    return await dbClient.query(query, [user.user_id]);
  }
}

/**
 * Get notes for submission (FILTERED BY ROLE)
 * Admins see all notes
 * Analysts see only their own notes
 */
async function getSubmissionNotes(dbClient, user, submissionId) {
  let query;
  let params;

  if (isAdmin(user)) {
    // Admin sees all notes
    query = `
      SELECT
        un.note_id,
        un.submission_id,
        un.note_text,
        un.created_by,
        un.created_at,
        un.updated_at,
        u.email as created_by_email,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM user_notes un
      JOIN users u ON un.created_by = u.user_id
      WHERE un.submission_id = $1
        AND un.deleted_at IS NULL
      ORDER BY un.created_at DESC
    `;
    params = [submissionId];
  } else {
    // Analyst sees only own notes
    query = `
      SELECT
        un.note_id,
        un.submission_id,
        un.note_text,
        un.created_by,
        un.created_at,
        un.updated_at,
        u.email as created_by_email,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM user_notes un
      JOIN users u ON un.created_by = u.user_id
      WHERE un.submission_id = $1
        AND un.created_by = $2
        AND un.deleted_at IS NULL
      ORDER BY un.created_at DESC
    `;
    params = [submissionId, user.user_id];
  }

  const result = await dbClient.query(query, params);
  return result.rows;
}

/**
 * Grant session access to user (admin only)
 */
async function grantSessionAccess(dbClient, adminUser, userId, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can grant session access');
  }

  const query = `
    INSERT INTO session_access (session_id, user_id, granted_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (session_id, user_id) DO NOTHING
    RETURNING access_id
  `;

  return await dbClient.query(query, [sessionId, userId, adminUser.user_id]);
}

/**
 * Revoke session access from user (admin only)
 */
async function revokeSessionAccess(dbClient, adminUser, userId, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can revoke session access');
  }

  const query = `
    DELETE FROM session_access
    WHERE session_id = $1 AND user_id = $2
  `;

  return await dbClient.query(query, [sessionId, userId]);
}

/**
 * Check if user can view submission
 */
function canViewSubmission(user, submission) {
  // Admins can view all
  if (isAdmin(user)) return true;

  // Analysts can only view their own
  return submission.submitted_by === user.user_id;
}

/**
 * Check if user can delete submission
 */
function canDeleteSubmission(user, submission) {
  // Admins can delete any
  if (isAdmin(user)) return true;

  // Analysts can delete their own (before AI processing)
  if (submission.submitted_by === user.user_id) {
    return submission.ai_analysis_status === 'pending';
  }

  return false;
}

/**
 * Check if user can add note to submission
 */
async function canAddNote(dbClient, user, submissionId) {
  // Admins can add notes to any submission
  if (isAdmin(user)) return true;

  // Analysts can only add notes to their own submissions
  const query = `
    SELECT 1 FROM document_submissions
    WHERE submission_id = $1 AND submitted_by = $2
  `;
  const result = await dbClient.query(query, [submissionId, user.user_id]);
  return result.rows.length > 0;
}

/**
 * Check if user can edit/delete note
 */
function canEditNote(user, note) {
  // Admins can edit any note
  if (isAdmin(user)) return true;

  // Analysts can only edit their own notes
  return note.created_by === user.user_id;
}

module.exports = {
  isAdmin,
  canEdit,
  canAccessSession,
  getAccessibleSessions,
  getSubmissionNotes,
  grantSessionAccess,
  revokeSessionAccess,
  canViewSubmission,
  canDeleteSubmission,
  canAddNote,
  canEditNote
};
```

---

## Invitation System Design

### Invitation Token Generation

```javascript
// lambda/layers/common/nodejs/invitation-utils.js

const crypto = require('crypto');

/**
 * Generate secure URL-safe token for invitation
 * @returns {string} 64-character URL-safe token
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create invitation and send email
 * @param {Object} dbClient - Database client
 * @param {Object} adminUser - Admin creating invitation
 * @param {string} email - Analyst email
 * @param {string} sessionId - Session to grant access to
 * @returns {Promise<Object>} - Invitation record
 */
async function createInvitation(dbClient, adminUser, email, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can create invitations');
  }

  // Check if user already exists
  const userQuery = `SELECT user_id FROM users WHERE email = $1`;
  const userResult = await dbClient.query(userQuery, [email]);
  const existingUser = userResult.rows[0];

  if (existingUser) {
    // User exists - just grant session access
    await grantSessionAccess(dbClient, adminUser, existingUser.user_id, sessionId);

    return {
      existing_user: true,
      user_id: existingUser.user_id,
      message: 'User already exists - session access granted'
    };
  }

  // User doesn't exist - create invitation
  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const query = `
    INSERT INTO user_invitations (
      email,
      session_id,
      token,
      expires_at,
      invited_by
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email, session_id)
    DO UPDATE SET
      token = EXCLUDED.token,
      expires_at = EXCLUDED.expires_at,
      invited_at = NOW(),
      accepted_at = NULL,
      accepted_by = NULL
    RETURNING invitation_id, token, expires_at
  `;

  const result = await dbClient.query(query, [
    email,
    sessionId,
    token,
    expiresAt,
    adminUser.user_id
  ]);

  const invitation = result.rows[0];

  // Send invitation email
  await sendInvitationEmail(email, token, sessionId);

  return {
    existing_user: false,
    invitation_id: invitation.invitation_id,
    token: invitation.token,
    expires_at: invitation.expires_at,
    invitation_url: `${process.env.FRONTEND_URL}/signup?token=${token}`
  };
}

/**
 * Verify invitation token
 * @param {Object} dbClient - Database client
 * @param {string} token - Invitation token
 * @returns {Promise<Object>} - Invitation details
 */
async function verifyInvitationToken(dbClient, token) {
  const query = `
    SELECT
      ui.invitation_id,
      ui.email,
      ui.session_id,
      ui.expires_at,
      ui.accepted_at,
      rs.name as session_name
    FROM user_invitations ui
    JOIN review_sessions rs ON ui.session_id = rs.session_id
    WHERE ui.token = $1
  `;

  const result = await dbClient.query(query, [token]);

  if (result.rows.length === 0) {
    throw new Error('Invalid invitation token');
  }

  const invitation = result.rows[0];

  if (invitation.accepted_at) {
    throw new Error('Invitation already accepted');
  }

  if (new Date() > new Date(invitation.expires_at)) {
    throw new Error('Invitation expired');
  }

  return invitation;
}

/**
 * Accept invitation (called after user signs up)
 * @param {Object} dbClient - Database client
 * @param {string} token - Invitation token
 * @param {string} userId - New user ID
 */
async function acceptInvitation(dbClient, token, userId) {
  const invitation = await verifyInvitationToken(dbClient, token);

  // Mark invitation as accepted
  const updateQuery = `
    UPDATE user_invitations
    SET accepted_at = NOW(), accepted_by = $1
    WHERE token = $2
  `;
  await dbClient.query(updateQuery, [userId, token]);

  // Grant session access
  const accessQuery = `
    INSERT INTO session_access (session_id, user_id, granted_by)
    SELECT session_id, $1, invited_by
    FROM user_invitations
    WHERE token = $2
    ON CONFLICT (session_id, user_id) DO NOTHING
  `;
  await dbClient.query(accessQuery, [userId, token]);
}

/**
 * Send invitation email (HTML template)
 */
async function sendInvitationEmail(email, token, sessionId) {
  const invitationUrl = `${process.env.FRONTEND_URL}/signup?token=${token}`;

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Invited to Overlay Platform</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>You've been invited to join Overlay Platform as an analyst. You'll have access to submit documents and receive AI-powered feedback.</p>
          <p>Click the button below to create your account:</p>
          <a href="${invitationUrl}" class="button">Accept Invitation</a>
          <p>Or copy this link: ${invitationUrl}</p>
          <p><strong>This invitation expires in 7 days.</strong></p>
          <p>If you have any questions, contact your administrator.</p>
        </div>
        <div class="footer">
          <p>Overlay Platform - AI Document Analysis</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // TODO: Integrate with AWS SES or SendGrid
  console.log(`[Invitation] Would send email to ${email}:`, invitationUrl);

  // For now, log the invitation URL to CloudWatch
  console.log(`[Invitation URL] ${invitationUrl}`);
}

module.exports = {
  generateInvitationToken,
  createInvitation,
  verifyInvitationToken,
  acceptInvitation,
  sendInvitationEmail
};
```

---

## API Changes

### 1. Session Invitations Handler (NEW)

```javascript
// lambda/functions/api/session-invitations/index.js

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { isAdmin } = require('/opt/nodejs/permissions');
const { createInvitation, verifyInvitationToken, acceptInvitation } = require('/opt/nodejs/invitation-utils');
const { validateAuth } = require('/opt/nodejs/auth-utils');

/**
 * POST /sessions/{sessionId}/invitations
 * Admin invites analyst to session
 */
async function handleCreate(dbClient, user, pathParameters, requestBody) {
  if (!isAdmin(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Only admins can invite analysts' })
    };
  }

  const { sessionId } = pathParameters;
  const { email } = requestBody;

  if (!email || !email.includes('@')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Valid email required' })
    };
  }

  try {
    const result = await createInvitation(dbClient, user, email, sessionId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...result
      })
    };
  } catch (error) {
    console.error('Error creating invitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * GET /invitations/{token}
 * Verify invitation token (public endpoint)
 */
async function handleVerify(dbClient, pathParameters) {
  const { token } = pathParameters;

  try {
    const invitation = await verifyInvitationToken(dbClient, token);

    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        email: invitation.email,
        session_name: invitation.session_name,
        expires_at: invitation.expires_at
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        valid: false,
        error: error.message
      })
    };
  }
}

/**
 * POST /invitations/{token}/accept
 * Accept invitation (called after signup)
 */
async function handleAccept(dbClient, pathParameters, requestBody) {
  const { token } = pathParameters;
  const { user_id } = requestBody;

  try {
    await acceptInvitation(dbClient, token, user_id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invitation accepted, session access granted'
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
}

exports.handler = async (event) => {
  const dbClient = await createDbConnection();

  try {
    const { httpMethod, pathParameters, body, path } = event;
    const requestBody = body ? JSON.parse(body) : {};

    let response;

    if (httpMethod === 'POST' && path.includes('/invitations') && !path.includes('/accept')) {
      // Create invitation
      const user = await validateAuth(event);
      response = await handleCreate(dbClient, user, pathParameters, requestBody);
    } else if (httpMethod === 'GET' && path.includes('/invitations/')) {
      // Verify token (public endpoint)
      response = await handleVerify(dbClient, pathParameters);
    } else if (httpMethod === 'POST' && path.includes('/accept')) {
      // Accept invitation
      response = await handleAccept(dbClient, pathParameters, requestBody);
    }

    return response;
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  } finally {
    await dbClient.end();
  }
};
```

---

### 2. Notes Handler (UPDATE for Filtering)

```javascript
// lambda/functions/api/notes/index.js

const { getSubmissionNotes, canAddNote, canEditNote } = require('/opt/nodejs/permissions');

/**
 * GET /submissions/{submissionId}/notes
 * Get notes for submission (FILTERED BY ROLE)
 */
async function handleList(dbClient, user, pathParameters) {
  const { submissionId } = pathParameters;

  // Get notes (automatically filtered by role)
  const notes = await getSubmissionNotes(dbClient, user, submissionId);

  return {
    statusCode: 200,
    body: JSON.stringify({ notes })
  };
}

/**
 * POST /submissions/{submissionId}/notes
 * Add note to submission
 */
async function handleCreate(dbClient, user, pathParameters, requestBody) {
  const { submissionId } = pathParameters;
  const { note_text } = requestBody;

  // Check if user can add note
  const canAdd = await canAddNote(dbClient, user, submissionId);
  if (!canAdd) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'You can only add notes to your own submissions' })
    };
  }

  const query = `
    INSERT INTO user_notes (submission_id, note_text, created_by)
    VALUES ($1, $2, $3)
    RETURNING note_id, created_at
  `;

  const result = await dbClient.query(query, [submissionId, note_text, user.user_id]);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      note: result.rows[0]
    })
  };
}

/**
 * DELETE /notes/{noteId}
 * Delete note (soft delete)
 */
async function handleDelete(dbClient, user, pathParameters) {
  const { noteId } = pathParameters;

  // Get note to check ownership
  const noteQuery = `SELECT * FROM user_notes WHERE note_id = $1 AND deleted_at IS NULL`;
  const noteResult = await dbClient.query(noteQuery, [noteId]);

  if (noteResult.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Note not found' })
    };
  }

  const note = noteResult.rows[0];

  // Check permission
  if (!canEditNote(user, note)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'You can only delete your own notes' })
    };
  }

  // Soft delete
  const deleteQuery = `
    UPDATE user_notes
    SET deleted_at = NOW()
    WHERE note_id = $1
  `;
  await dbClient.query(deleteQuery, [noteId]);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

exports.handler = async (event) => {
  const dbClient = await createDbConnection();
  const user = await validateAuth(event);

  try {
    const { httpMethod, pathParameters, body } = event;
    const requestBody = body ? JSON.parse(body) : {};

    let response;

    if (httpMethod === 'GET') {
      response = await handleList(dbClient, user, pathParameters);
    } else if (httpMethod === 'POST') {
      response = await handleCreate(dbClient, user, pathParameters, requestBody);
    } else if (httpMethod === 'DELETE') {
      response = await handleDelete(dbClient, user, pathParameters);
    }

    return response;
  } finally {
    await dbClient.end();
  }
};
```

---

### 3. API Gateway Routes

```javascript
// Add to CDK stack

// Session invitations
api.addRoute('POST /sessions/{sessionId}/invitations', sessionInvitationsHandler);
api.addRoute('GET /invitations/{token}', sessionInvitationsHandler);
api.addRoute('POST /invitations/{token}/accept', sessionInvitationsHandler);

// Session access management
api.addRoute('POST /sessions/{sessionId}/access', sessionAccessHandler);
api.addRoute('DELETE /sessions/{sessionId}/access/{userId}', sessionAccessHandler);
api.addRoute('GET /sessions/{sessionId}/access', sessionAccessHandler);

// Notes (already exist, update handler to filter)
api.addRoute('GET /submissions/{submissionId}/notes', notesHandler);
api.addRoute('POST /submissions/{submissionId}/notes', notesHandler);
api.addRoute('DELETE /notes/{noteId}', notesHandler);
```

---

## Token Usage Tracking Integration

### Status
✅ **OPERATIONAL** (Migration 009 applied and verified)

### Implementation
Token tracking is already implemented in all 6 AI agents:
- structure-validator
- content-analyzer
- grammar-checker
- orchestrator
- scoring
- clarification

### Cost Analysis

**Per Submission Average (Verified):**
- Input tokens: 14,962
- Output tokens: 5,418
- Total tokens: 20,380
- **Estimated cost: $0.1262 per submission**

**Monthly Projections:**
- 100 submissions/month: ~$13
- 500 submissions/month: ~$63
- 1,000 submissions/month: ~$126

### Analyst Token Usage View

Add to analyst dashboard:

```javascript
// Get analyst's token usage
async function getAnalystTokenUsage(dbClient, userId, days = 30) {
  const query = `
    SELECT
      DATE(tu.created_at) as date,
      COUNT(DISTINCT tu.submission_id) as submissions,
      SUM(tu.input_tokens) as total_input,
      SUM(tu.output_tokens) as total_output,
      SUM(tu.total_tokens) as total_tokens,
      -- Cost estimation (Sonnet 4.5 pricing)
      ROUND((SUM(tu.input_tokens) * 0.003 / 1000.0) +
            (SUM(tu.output_tokens) * 0.015 / 1000.0), 4) as estimated_cost_usd
    FROM token_usage tu
    JOIN document_submissions ds ON tu.submission_id = ds.submission_id
    WHERE ds.submitted_by = $1
      AND tu.created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(tu.created_at)
    ORDER BY date DESC
  `;

  const result = await dbClient.query(query, [userId]);
  return result.rows;
}
```

### Admin Token Usage View

```javascript
// Get all token usage with analyst breakdown
async function getAllTokenUsage(dbClient, days = 30) {
  const query = `
    SELECT
      u.email,
      u.first_name || ' ' || u.last_name as analyst_name,
      COUNT(DISTINCT tu.submission_id) as submissions,
      SUM(tu.total_tokens) as total_tokens,
      ROUND((SUM(tu.input_tokens) * 0.003 / 1000.0) +
            (SUM(tu.output_tokens) * 0.015 / 1000.0), 2) as estimated_cost_usd
    FROM token_usage tu
    JOIN document_submissions ds ON tu.submission_id = ds.submission_id
    JOIN users u ON ds.submitted_by = u.user_id
    WHERE tu.created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY u.user_id, u.email, u.first_name, u.last_name
    ORDER BY total_tokens DESC
  `;

  const result = await dbClient.query(query);
  return result.rows;
}
```

---

## Permission Matrix

| Action | Admin | Analyst |
|--------|-------|---------|
| **Authentication** |
| Login | ✅ | ✅ |
| Forgot Password | ✅ | ✅ |
| Accept Invitation | N/A | ✅ |
| **Sessions** |
| View All Sessions | ✅ | ❌ |
| View Assigned Sessions | ✅ | ✅ |
| Create Session | ✅ | ❌ |
| Edit Session | ✅ | ❌ |
| Delete Session | ✅ | ❌ |
| **Session Access** |
| Invite Analyst to Session | ✅ | ❌ |
| Assign User to Session | ✅ | ❌ |
| Revoke User from Session | ✅ | ❌ |
| View Access List | ✅ | ❌ |
| **Overlays & Criteria** |
| View Overlays | ✅ | ✅ |
| Create/Edit Overlays | ✅ | ❌ |
| Edit Criteria | ✅ | ❌ |
| **Submissions** |
| Submit to Assigned Session | ✅ | ✅ |
| Submit to Unassigned Session | ✅ | ❌ |
| View Own Submissions | ✅ | ✅ |
| View All Submissions | ✅ | ❌ |
| Delete Own (Pending) | ✅ | ✅ |
| Delete Any | ✅ | ❌ |
| **Results** |
| View Own Results | ✅ | ✅ |
| View All Results | ✅ | ❌ |
| **Notes** |
| View All Notes | ✅ | ❌ |
| View Own Notes | ✅ | ✅ |
| Add Note to Own Submission | ✅ | ✅ |
| Add Note to Any Submission | ✅ | ❌ |
| Edit Own Note | ✅ | ✅ |
| Edit Any Note | ✅ | ❌ |
| Delete Own Note | ✅ | ✅ |
| Delete Any Note | ✅ | ❌ |
| **Token Usage** |
| View Own Token Usage | ✅ | ✅ |
| View All Token Usage | ✅ | ❌ |
| View Cost Analytics | ✅ | ❌ |

---

## Implementation Timeline

### Phase 1: Database (30 minutes)

**Tasks:**
1. Create migration 010_add_user_role.sql
2. Create migration 011_add_session_access.sql
3. Create migration 012_add_user_invitations.sql
4. Create migration 013_add_notes_index.sql
5. Deploy migrations to production

**Note:** Migration 009 (token_usage) already applied ✅

---

### Phase 2: Backend - Invitations (5-7 hours)

**Tasks:**
1. Create invitation-utils.js (token generation, email sending)
2. Create session-invitations handler (invite, verify, accept)
3. Update permissions.js (notes filtering functions)
4. Update notes handler (implement role-based filtering)
5. Add API Gateway routes
6. Test invitation flow

**Files to Create:**
- `lambda/layers/common/nodejs/invitation-utils.js` (NEW)
- `lambda/functions/api/session-invitations/index.js` (NEW)

**Files to Modify:**
- `lambda/layers/common/nodejs/permissions.js` (add notes filtering)
- `lambda/functions/api/notes/index.js` (implement filtering)

---

### Phase 3: Backend - Session Access (3-4 hours)

**Tasks:**
1. Update sessions handler (filter by accessible sessions)
2. Update submissions handler (check session access)
3. Create session-access handler (grant/revoke/list)
4. Update auth handler (include role in JWT)
5. Test with Postman/curl

**Files to Create:**
- `lambda/functions/api/session-access/index.js` (NEW)

**Files to Modify:**
- `lambda/functions/api/sessions/index.js` (filter by access)
- `lambda/functions/api/submissions/index.js` (check session access)

---

### Phase 4: Frontend (3-4 hours)

**Tasks:**
1. Create invitation form component
2. Create signup page for invited analysts
3. Create SessionAccessManager component
4. Update notes display (shows filtered notes)
5. Add token usage dashboard widget
6. Update API client with new methods

**Files to Create:**
- `frontend/components/invitation-form.tsx` (NEW)
- `frontend/app/signup/page.tsx` (NEW)
- `frontend/components/session-access-manager.tsx` (NEW)
- `frontend/components/token-usage-widget.tsx` (NEW)

**Files to Modify:**
- `frontend/lib/api-client.ts` (add invitation + notes methods)
- `frontend/app/session/[id]/page.tsx` (add invite button)
- `frontend/app/submission/[id]/page.tsx` (filtered notes display)
- `frontend/app/dashboard/page.tsx` (add token usage widget)

---

### Phase 5: Testing (2-3 hours)

**Test Cases:**

**As Admin:**
- ✅ Can invite analyst to session
- ✅ Can view all sessions
- ✅ Can assign analyst to session manually
- ✅ Can revoke analyst from session
- ✅ Can view access list
- ✅ Can view all notes (including analysts')
- ✅ Can view all token usage

**As Analyst:**
- ✅ Can accept invitation via email link
- ✅ Can sign up with name + password
- ✅ Can login with permanent password
- ✅ Can use forgot password flow
- ✅ Dashboard shows only assigned sessions
- ✅ Can submit to assigned session
- ✅ Can view only own notes
- ✅ Can add note to own submission
- ❌ Cannot see admin's or other analysts' notes
- ❌ Cannot see unassigned sessions
- ❌ Cannot submit to unassigned session
- ❌ Cannot view others' submissions
- ✅ Can view own token usage

**Security Tests:**
- Try analyst accessing unassigned session via API → 403
- Try analyst viewing other analyst's notes → API returns 0 notes
- Try analyst calling invite endpoint → 403
- Verify notes filtering works correctly
- Try expired invitation token → 400 error

---

### Phase 6: Documentation (1 hour)

**Update CLAUDE.md:**
- User roles section
- Invitation system
- Notes filtering behavior
- Token tracking status
- Session access control

**Create User Guide:**
- How to invite analysts
- How analysts accept invitations
- What analysts can see
- Notes visibility rules
- Token usage monitoring

---

## Total Effort Estimate

| Phase | Time | Complexity |
|-------|------|------------|
| 1. Database | 30 min | Low |
| 2. Backend - Invitations | 5-7 hours | High |
| 3. Backend - Session Access | 3-4 hours | Medium |
| 4. Frontend | 3-4 hours | Medium |
| 5. Testing | 2-3 hours | Medium |
| 6. Documentation | 1 hour | Low |
| **TOTAL** | **16-21 hours** | **Medium-High** |

**Single developer:** 2-3 days

---

## User Flows

### FLOW 1: Admin Invites Analyst to Session

```
1. Admin navigates to session detail page
   URL: /session/{sessionId}
   ↓
2. Admin clicks "Invite Analyst" button
   Opens invitation form modal
   ↓
3. Admin enters analyst email
   Email: analyst@example.com
   ↓
4. Admin clicks "Send Invitation"
   API call: POST /sessions/{sessionId}/invitations
   Body: { email: "analyst@example.com" }
   ↓
5. System generates invitation
   - Creates invitation record
   - Generates secure token
   - Sets 7-day expiration
   - Sends email with signup link
   ↓
6. Admin sees confirmation
   "Invitation sent to analyst@example.com"
```

---

### FLOW 2: Analyst Accepts Invitation

```
1. Analyst receives email
   Subject: "You're invited to Overlay Platform"
   Contains: Invitation link with token
   ↓
2. Analyst clicks invitation link
   URL: /signup?token={token}
   ↓
3. Signup page loads
   API call: GET /invitations/{token}
   Verifies token is valid
   ↓
4. Signup form displays
   - Email: analyst@example.com (pre-filled, read-only)
   - Session: "Football Analysis" (shown)
   - First Name: _____
   - Last Name: _____
   - Password: _____
   - Confirm Password: _____
   ↓
5. Analyst fills form and submits
   POST /auth/signup
   Creates Cognito user with role='analyst'
   ↓
6. System accepts invitation
   POST /invitations/{token}/accept
   - Marks invitation as accepted
   - Grants session access
   - Creates session_access record
   ↓
7. Analyst redirected to dashboard
   Shows assigned session immediately
```

---

### FLOW 3: Analyst Submits Document & Adds Note

```
1. Analyst logs in
   Email: analyst@example.com
   Password: AnalystPassword123!
   ↓
2. Dashboard loads
   Shows only assigned sessions:
   - "Football Analysis" ✅
   - Other sessions not visible
   ↓
3. Analyst clicks session
   URL: /session/{sessionId}
   API checks: canAccessSession() → true
   ↓
4. Analyst uploads document
   Submits for AI analysis
   ↓
5. AI processing completes
   Status: completed, Score: 84/100
   ↓
6. Analyst views results
   URL: /submission/{submissionId}
   ↓
7. Analyst adds note
   Note: "This scoring seems accurate for this type of document"
   POST /submissions/{submissionId}/notes
   ↓
8. Analyst views notes section
   Shows: Own note only
   Does NOT show: Admin's notes or other analysts' notes
```

---

### FLOW 4: Admin Views All Notes

```
1. Admin navigates to submission
   URL: /submission/{submissionId}
   ↓
2. API fetches notes
   GET /submissions/{submissionId}/notes
   isAdmin(user) → true
   Returns ALL notes (no filtering)
   ↓
3. Admin sees all notes
   - Admin's note (created 2 days ago)
   - Analyst 1's note (created yesterday)
   - Analyst 2's note (created today)
   ↓
4. Admin adds new note
   Note: "This submission is excellent"
   All users with access can see admin's note
```

---

### FLOW 5: Existing User Gets Invited

```
1. Admin invites existing user
   Email: existing.analyst@example.com
   POST /sessions/{sessionId}/invitations
   ↓
2. System detects existing user
   Query: SELECT user_id FROM users WHERE email = ...
   Found: user_id = abc-123
   ↓
3. System grants session access immediately
   No invitation email sent
   Just creates session_access record
   ↓
4. Admin sees confirmation
   "User already exists - session access granted"
   ↓
5. Existing user's dashboard updates
   Next time they login, new session appears
```

---

## Cost Monitoring Dashboard

### Admin View

```tsx
// frontend/components/token-usage-dashboard.tsx

interface TokenUsageByAnalyst {
  email: string;
  analyst_name: string;
  submissions: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export function TokenUsageDashboard() {
  const [usage, setUsage] = useState<TokenUsageByAnalyst[]>([]);
  const [period, setPeriod] = useState(30); // days

  useEffect(() => {
    loadTokenUsage();
  }, [period]);

  async function loadTokenUsage() {
    const response = await apiClient.getTokenUsageByAnalyst({ days: period });
    setUsage(response.data.usage);
  }

  const totalCost = usage.reduce((sum, u) => sum + u.estimated_cost_usd, 0);
  const totalSubmissions = usage.reduce((sum, u) => sum + u.submissions, 0);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Token Usage & Costs</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded">
          <div className="text-sm text-blue-600">Total Submissions</div>
          <div className="text-2xl font-bold">{totalSubmissions}</div>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <div className="text-sm text-green-600">Total Cost</div>
          <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-purple-50 rounded">
          <div className="text-sm text-purple-600">Avg Cost/Submission</div>
          <div className="text-2xl font-bold">
            ${(totalCost / totalSubmissions).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="mb-4">
        <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Usage Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Analyst</th>
            <th className="text-right py-2">Submissions</th>
            <th className="text-right py-2">Total Tokens</th>
            <th className="text-right py-2">Cost</th>
          </tr>
        </thead>
        <tbody>
          {usage.map(u => (
            <tr key={u.email} className="border-b">
              <td className="py-2">
                <div className="font-medium">{u.analyst_name}</div>
                <div className="text-sm text-slate-500">{u.email}</div>
              </td>
              <td className="text-right">{u.submissions}</td>
              <td className="text-right">{u.total_tokens.toLocaleString()}</td>
              <td className="text-right font-medium">${u.estimated_cost_usd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Analyst View

```tsx
// frontend/components/my-token-usage.tsx

export function MyTokenUsage() {
  const [usage, setUsage] = useState([]);

  useEffect(() => {
    loadMyUsage();
  }, []);

  async function loadMyUsage() {
    const response = await apiClient.getMyTokenUsage({ days: 30 });
    setUsage(response.data.usage);
  }

  return (
    <div className="p-4 bg-slate-50 rounded">
      <h3 className="font-medium mb-2">My Token Usage (Last 30 Days)</h3>
      <div className="text-sm text-slate-600">
        You've used {usage.total_tokens?.toLocaleString()} tokens across {usage.submissions} submissions
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Estimated cost: ${usage.estimated_cost_usd}
      </div>
    </div>
  );
}
```

---

## Security Considerations

### Backend Validation
- ✅ Every session view checks `canAccessSession()`
- ✅ Every submission checks session access
- ✅ Every write operation checks `canEdit(user)`
- ✅ Notes filtered by `created_by` for analysts
- ✅ Invitation tokens are cryptographically secure (32 bytes)
- ✅ Invitations expire after 7 days
- ✅ JWT includes user_role
- ✅ session_access table enforces assignments

### Frontend Protection
- ✅ Session list filtered by accessible sessions
- ✅ Admin buttons hidden from analysts
- ✅ Access manager only visible to admins
- ✅ Notes display shows filtered results
- ✅ API calls will fail if bypassed (403)

### Database Integrity
- ✅ Foreign key constraints
- ✅ Unique constraints (email+session, session+user)
- ✅ CASCADE delete (access removed if session deleted)
- ✅ Check constraints (valid roles)
- ✅ Indexes for query performance

---

## What This Does NOT Include

**Out of Scope:**
- ❌ Multiple organizations
- ❌ Organization-level permissions
- ❌ Advanced RBAC beyond sessions
- ❌ Audit logging (can add later)
- ❌ Email service integration (uses console logging for now)
- ❌ Billing/subscriptions
- ❌ Row-Level Security (not needed - single org)
- ❌ SSO/SAML (Cognito only)

**This IS:**
- ✅ Simple two-role system (admin vs analyst)
- ✅ Session-based access control
- ✅ Token-based invitations (email signup)
- ✅ Notes filtering (role-based)
- ✅ Token usage tracking (operational)
- ✅ Permission checks in API
- ✅ Conditional UI rendering

---

## Deployment Checklist

**Before Deployment:**
- [ ] Database migrations tested locally
- [ ] Invitation token generation tested
- [ ] Email template created
- [ ] Backend permission checks tested
- [ ] Session filtering tested
- [ ] Notes filtering tested
- [ ] Frontend invitation flow tested
- [ ] Frontend signup page tested
- [ ] Analyst can only see assigned sessions
- [ ] Analyst can only see own notes
- [ ] Admin can view all notes
- [ ] Token usage dashboard works

**Deployment Steps:**
1. Run migration 010 (user_role)
2. Run migration 011 (session_access)
3. Run migration 012 (user_invitations)
4. Run migration 013 (notes_index)
5. Deploy backend (cdk deploy OverlayComputeStack)
6. Deploy frontend (restart dev server)
7. Test invitation flow
8. Invite test analyst
9. Accept invitation and sign up
10. Test both roles thoroughly
11. Update documentation

**Rollback Plan:**
- Revert migrations (drop new tables/columns)
- Revert backend code
- Revert frontend code

---

## Comparison: This Design vs Full Multi-Tenant

| Feature | This Design | Full Multi-Tenant |
|---------|-------------|-------------------|
| **User Roles** | 2 (admin, analyst) | 3+ (super admin, org admin, user) |
| **Organizations** | 1 (implicit) | Unlimited |
| **Session Access** | ✅ Per-user assignment | ✅ Per-user + per-org |
| **Invitations** | ✅ Token-based email | ✅ + SSO, SAML |
| **Notes Filtering** | ✅ Role-based | ✅ Org + role based |
| **Token Tracking** | ✅ Operational | ✅ Per org tracking |
| **Data Isolation** | Submissions by user | Orgs + Users |
| **User Management** | Email invitations | Invitations, SSO, directories |
| **Implementation** | 16-21 hours | 200-290 hours |
| **Complexity** | Medium | High |
| **Database Changes** | 4 tables | 10+ tables |
| **Use Case** | Small team, controlled access | SaaS, many customers |

---

## Example Data

### Users Table
```
user_id  | email                  | user_role | first_name | last_name
---------|------------------------|-----------|------------|----------
uuid-1   | admin@example.com      | admin     | Admin      | User
uuid-2   | analyst1@example.com   | analyst   | John       | Doe
uuid-3   | analyst2@example.com   | analyst   | Jane       | Smith
```

### Session Access Table
```
access_id | session_id | user_id | granted_by | granted_at
----------|------------|---------|------------|------------
acc-1     | sess-1     | uuid-2  | uuid-1     | 2026-02-03 10:00
acc-2     | sess-1     | uuid-3  | uuid-1     | 2026-02-03 10:01
acc-3     | sess-2     | uuid-2  | uuid-1     | 2026-02-03 11:00
```

### User Invitations Table
```
invitation_id | email               | session_id | token    | expires_at          | accepted_at
--------------|---------------------|------------|----------|---------------------|-------------
inv-1         | new@example.com     | sess-1     | abc123   | 2026-02-10 10:00    | NULL
inv-2         | analyst1@example.com| sess-2     | def456   | 2026-02-09 15:00    | 2026-02-03 16:30
```

### User Notes Table
```
note_id  | submission_id | created_by | note_text                    | created_at
---------|---------------|------------|------------------------------|-------------
note-1   | sub-1         | uuid-1     | "Admin feedback"             | 2026-02-01
note-2   | sub-1         | uuid-2     | "Analyst 1's observation"    | 2026-02-02
note-3   | sub-1         | uuid-3     | "Analyst 2's note"           | 2026-02-03
```

**Note Visibility:**
- Admin (uuid-1) sees: note-1, note-2, note-3 (all)
- Analyst 1 (uuid-2) sees: note-2 (own only)
- Analyst 2 (uuid-3) sees: note-3 (own only)

---

## Token Usage Example Data

### Token Usage Table
```
submission_id | agent_name          | input_tokens | output_tokens | total_tokens | created_at
--------------|---------------------|--------------|---------------|--------------|-------------
sub-1         | structure-validator | 2203         | 64            | 2267         | 11:53:28
sub-1         | content-analyzer    | 4597         | 1785          | 6382         | 11:54:23
sub-1         | grammar-checker     | 2860         | 367           | 3227         | 11:54:33
sub-1         | orchestrator        | 704          | 866           | 1570         | 11:54:54
sub-1         | scoring             | 4598         | 2336          | 6934         | 11:55:47
```

**Total for sub-1:** 20,380 tokens ≈ $0.13

---

## Conclusion

**This design provides:**
- Simple two-role system (16-21 hours vs 200+ for full multi-tenant)
- Session-based access control (admin assigns analysts)
- **Token-based invitations** (email signup with 7-day expiration)
- **Notes filtering** (analysts see only their own notes)
- **Token usage tracking** (operational, verified, $0.13/submission)
- Read-only analysts who can only access assigned sessions
- Admin retains full control + access management + cost monitoring
- Foundation for future enhancements
- Easy to implement and test

**Key Additions:**
1. Invitation system ensures secure analyst onboarding
2. Notes filtering provides proper data privacy
3. Token tracking enables cost monitoring and budgeting
4. Session access control ensures analysts only see assigned work

**Next Steps:**
1. Approve this design
2. Implement Phase 1 (database migrations)
3. Implement Phase 2 (backend - invitations)
4. Implement Phase 3 (backend - session access)
5. Implement Phase 4 (frontend)
6. Test thoroughly (all user flows)
7. Deploy to production
8. Invite test analysts

**Status:** Design Complete - Ready for Implementation

---

**END OF ANALYST ROLE DESIGN**
