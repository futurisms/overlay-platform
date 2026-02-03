/**
 * Invitations API Handler
 * Token-based invitation system for analyst onboarding
 *
 * Endpoints:
 * - POST /sessions/{sessionId}/invitations - Create invitation
 * - GET /invitations/{token} - Get invitation details
 * - POST /invitations/{token}/accept - Accept invitation and create account
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { isAdmin } = require('/opt/nodejs/permissions');
const crypto = require('crypto');

/**
 * Generate secure random token for invitation
 * Uses crypto.randomBytes for cryptographically strong random values
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('base64url');
}

exports.handler = async (event) => {
  console.log('Invitations Handler:', JSON.stringify(event));

  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Route: POST /sessions/{sessionId}/invitations
    if (httpMethod === 'POST' && path.includes('/sessions/') && path.endsWith('/invitations')) {
      return await handleCreateInvitation(dbClient, pathParameters, requestBody, userId);
    }

    // Route: GET /invitations/{token}
    if (httpMethod === 'GET' && path.includes('/invitations/')) {
      const token = pathParameters?.token || pathParameters?.id;
      return await handleGetInvitation(dbClient, token);
    }

    // Route: POST /invitations/{token}/accept
    if (httpMethod === 'POST' && path.includes('/invitations/') && path.endsWith('/accept')) {
      const token = pathParameters?.token || pathParameters?.id;
      return await handleAcceptInvitation(dbClient, token, requestBody);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

/**
 * POST /sessions/{sessionId}/invitations
 * Create invitation for analyst to join session
 * Admin only
 */
async function handleCreateInvitation(dbClient, pathParameters, requestBody, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check permissions - only admins can create invitations
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!isAdmin(user)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden: Only admins can invite analysts' })
    };
  }

  // Parse request body
  const { email } = JSON.parse(requestBody);

  if (!email || !email.includes('@')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Valid email address required' })
    };
  }

  // Verify session exists
  const sessionQuery = await dbClient.query(
    'SELECT session_id, name FROM review_sessions WHERE session_id = $1 AND is_active = true',
    [sessionId]
  );

  if (sessionQuery.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Session not found' })
    };
  }

  const session = sessionQuery.rows[0];

  // Check if user already exists
  const existingUserQuery = await dbClient.query(
    'SELECT user_id, user_role FROM users WHERE email = $1',
    [email]
  );

  if (existingUserQuery.rows.length > 0) {
    // User exists - check if they already have access
    const existingUserId = existingUserQuery.rows[0].user_id;

    const accessCheck = await dbClient.query(
      'SELECT 1 FROM session_access WHERE user_id = $1 AND session_id = $2',
      [existingUserId, sessionId]
    );

    if (accessCheck.rows.length > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'User already has access to this session',
          existing: true
        })
      };
    }

    // Grant access to existing user
    await dbClient.query(
      'INSERT INTO session_access (user_id, session_id, granted_by) VALUES ($1, $2, $3)',
      [existingUserId, sessionId, userId]
    );

    console.log(`Granted access to existing user: ${email} for session ${sessionId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Access granted to existing user',
        existing: true
      })
    };
  }

  // User doesn't exist - create invitation
  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Check if invitation already exists for this email+session
  const existingInvite = await dbClient.query(
    'SELECT invitation_id, token FROM user_invitations WHERE email = $1 AND session_id = $2 AND accepted_at IS NULL',
    [email, sessionId]
  );

  let invitationId, inviteToken;

  if (existingInvite.rows.length > 0) {
    // Update existing invitation with new token and expiry
    invitationId = existingInvite.rows[0].invitation_id;
    const updateResult = await dbClient.query(
      `UPDATE user_invitations
       SET token = $1, expires_at = $2, invited_by = $3
       WHERE invitation_id = $4
       RETURNING token`,
      [token, expiresAt, userId, invitationId]
    );
    inviteToken = updateResult.rows[0].token;

    console.log(`Updated existing invitation: ${invitationId} for ${email}`);
  } else {
    // Create new invitation
    const insertResult = await dbClient.query(
      `INSERT INTO user_invitations
       (email, session_id, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING invitation_id, token`,
      [email, sessionId, userId, token, expiresAt]
    );
    invitationId = insertResult.rows[0].invitation_id;
    inviteToken = insertResult.rows[0].token;

    console.log(`Created new invitation: ${invitationId} for ${email}`);
  }

  // Generate invitation link
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const inviteLink = `${frontendUrl}/signup?token=${inviteToken}`;

  console.log('Invitation created:', {
    invitationId,
    email,
    sessionName: session.name,
    expiresAt
  });

  // TODO: Send invitation email via SES
  // Email should include: inviteLink, session name, expiry date

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: 'Invitation created successfully',
      invitationId,
      inviteLink, // Include for testing (remove in production or protect endpoint)
      expiresAt: expiresAt.toISOString(),
      sessionName: session.name
    })
  };
}

/**
 * GET /invitations/{token}
 * Get invitation details for signup page
 * Public endpoint (no auth required)
 */
async function handleGetInvitation(dbClient, token) {
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invitation token required' }) };
  }

  const query = `
    SELECT
      i.invitation_id,
      i.email,
      i.expires_at,
      i.accepted_at,
      s.session_id,
      s.name as session_name,
      s.description as session_description
    FROM user_invitations i
    JOIN review_sessions s ON i.session_id = s.session_id
    WHERE i.token = $1
  `;

  const result = await dbClient.query(query, [token]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Invitation not found' })
    };
  }

  const invitation = result.rows[0];

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Invitation expired',
        expired: true
      })
    };
  }

  // Check if already accepted
  if (invitation.accepted_at) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Invitation already accepted',
        accepted: true
      })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      email: invitation.email,
      sessionId: invitation.session_id,
      sessionName: invitation.session_name,
      sessionDescription: invitation.session_description,
      expiresAt: invitation.expires_at
    })
  };
}

/**
 * POST /invitations/{token}/accept
 * Accept invitation and create analyst account
 * Public endpoint (no auth required)
 */
async function handleAcceptInvitation(dbClient, token, requestBody) {
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invitation token required' }) };
  }

  const { firstName, lastName, password } = JSON.parse(requestBody);

  if (!firstName || !lastName || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'First name, last name, and password required' })
    };
  }

  // Validate password strength (minimum requirements)
  if (password.length < 8) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Password must be at least 8 characters' })
    };
  }

  // Get invitation
  const inviteQuery = `
    SELECT
      i.invitation_id,
      i.email,
      i.session_id,
      i.invited_by,
      i.expires_at,
      i.accepted_at
    FROM user_invitations i
    WHERE i.token = $1
  `;

  const inviteResult = await dbClient.query(inviteQuery, [token]);

  if (inviteResult.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Invitation not found' })
    };
  }

  const invitation = inviteResult.rows[0];

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invitation expired' })
    };
  }

  // Check if already accepted
  if (invitation.accepted_at) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invitation already accepted' })
    };
  }

  // Check if user already exists (shouldn't happen if invitation flow is followed)
  const existingUserCheck = await dbClient.query(
    'SELECT user_id FROM users WHERE email = $1',
    [invitation.email]
  );

  if (existingUserCheck.rows.length > 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'User with this email already exists',
        message: 'Please login instead'
      })
    };
  }

  // TODO: Create Cognito user with analyst role
  // For now, create database user record only
  // In production, integrate with Cognito User Pool

  // Get organization from invited_by user
  const adminQuery = await dbClient.query(
    'SELECT organization_id FROM users WHERE user_id = $1',
    [invitation.invited_by]
  );

  const organizationId = adminQuery.rows[0]?.organization_id;

  if (!organizationId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to determine organization' })
    };
  }

  // Create user account (analyst role)
  const userResult = await dbClient.query(
    `INSERT INTO users (
      email,
      first_name,
      last_name,
      user_role,
      organization_id
    ) VALUES ($1, $2, $3, 'analyst', $4)
    RETURNING user_id, email, first_name, last_name, user_role`,
    [invitation.email, firstName, lastName, organizationId]
  );

  const newUser = userResult.rows[0];

  // Grant session access
  await dbClient.query(
    `INSERT INTO session_access (user_id, session_id, granted_by)
     VALUES ($1, $2, $3)`,
    [newUser.user_id, invitation.session_id, invitation.invited_by]
  );

  // Mark invitation as accepted
  await dbClient.query(
    `UPDATE user_invitations
     SET accepted_at = CURRENT_TIMESTAMP, accepted_by = $1
     WHERE invitation_id = $2`,
    [newUser.user_id, invitation.invitation_id]
  );

  console.log('Invitation accepted:', {
    userId: newUser.user_id,
    email: newUser.email,
    sessionId: invitation.session_id
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Account created successfully',
      user: {
        userId: newUser.user_id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.user_role
      }
    })
  };
}
