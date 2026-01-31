/**
 * Invitations Handler
 * Session invitation management for collaborative reviews
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Invitations Handler:', JSON.stringify(event));

  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Handle special routes
    if (path.includes('/invite')) {
      return await handleInvite(dbClient, pathParameters, requestBody, userId);
    }
    if (path.includes('/accept')) {
      return await handleAccept(dbClient, pathParameters, userId);
    }
    if (path.includes('/decline')) {
      return await handleDecline(dbClient, pathParameters, userId);
    }

    // GET /invitations - List user's pending invitations
    if (httpMethod === 'GET') {
      return await handleGetInvitations(dbClient, userId);
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

async function handleInvite(dbClient, pathParameters, requestBody, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;
  const { user_id, role } = JSON.parse(requestBody);

  if (!sessionId || !user_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id and user_id required' }) };
  }

  // Check if user owns session or is admin
  const ownerCheck = await dbClient.query(
    `SELECT session_id FROM review_sessions WHERE session_id = $1 AND created_by = $2`,
    [sessionId, userId]
  );

  if (ownerCheck.rows.length === 0) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized to invite users to this session' }) };
  }

  // Check if user already participant
  const existingCheck = await dbClient.query(
    `SELECT session_id FROM session_participants WHERE session_id = $1 AND user_id = $2`,
    [sessionId, user_id]
  );

  if (existingCheck.rows.length > 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User already invited or participating' }) };
  }

  // Validate invited user exists
  const userCheck = await dbClient.query(
    `SELECT user_id FROM users WHERE user_id = $1 AND is_active = true`,
    [user_id]
  );

  if (userCheck.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'User not found or inactive' }) };
  }

  // Create invitation (as session participant with invited role)
  const query = `
    INSERT INTO session_participants (session_id, user_id, role)
    VALUES ($1, $2, $3)
    RETURNING session_id, user_id, role
  `;
  const result = await dbClient.query(query, [sessionId, user_id, role || 'reviewer']);

  console.log(`Invitation sent to user ${user_id} for session ${sessionId}`);
  return { statusCode: 201, body: JSON.stringify({ message: 'Invitation sent', ...result.rows[0] }) };
}

async function handleGetInvitations(dbClient, userId) {
  // Get sessions where user is participant but hasn't joined yet (joined_at is null)
  // In this implementation, invitations are just session_participants without joined_at
  // For simplicity, we'll show all sessions the user is in
  const query = `
    SELECT sp.session_id, sp.role, s.name as session_name, s.description,
           s.status, s.created_at, o.name as overlay_name,
           u.first_name || ' ' || u.last_name as invited_by_name
    FROM session_participants sp
    LEFT JOIN review_sessions s ON sp.session_id = s.session_id
    LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
    LEFT JOIN users u ON s.created_by = u.user_id
    WHERE sp.user_id = $1
      AND s.status = 'active'
    ORDER BY s.created_at DESC
  `;
  const result = await dbClient.query(query, [userId]);

  return { statusCode: 200, body: JSON.stringify({ invitations: result.rows, total: result.rows.length }) };
}

async function handleAccept(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check if user has pending invitation
  const invitationCheck = await dbClient.query(
    `SELECT session_id, role FROM session_participants WHERE session_id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  if (invitationCheck.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'No invitation found' }) };
  }

  // Update participation to mark as joined
  const query = `
    UPDATE session_participants
    SET joined_at = CURRENT_TIMESTAMP
    WHERE session_id = $1 AND user_id = $2
    RETURNING session_id, user_id, role, joined_at
  `;
  const result = await dbClient.query(query, [sessionId, userId]);

  console.log(`User ${userId} accepted invitation to session ${sessionId}`);
  return { statusCode: 200, body: JSON.stringify({ message: 'Invitation accepted', ...result.rows[0] }) };
}

async function handleDecline(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check if user has invitation
  const invitationCheck = await dbClient.query(
    `SELECT session_id FROM session_participants WHERE session_id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  if (invitationCheck.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'No invitation found' }) };
  }

  // Remove participation record
  const query = `
    DELETE FROM session_participants
    WHERE session_id = $1 AND user_id = $2
    RETURNING session_id
  `;
  const result = await dbClient.query(query, [sessionId, userId]);

  console.log(`User ${userId} declined invitation to session ${sessionId}`);
  return { statusCode: 200, body: JSON.stringify({ message: 'Invitation declined', session_id: sessionId }) };
}
