/**
 * Users Handler
 * User profile and management with organization scoping
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Users Handler:', JSON.stringify(event));

  const { httpMethod, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

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
  const targetUserId = pathParameters?.userId || pathParameters?.id;

  if (targetUserId) {
    // Get specific user with roles
    const query = `
      SELECT u.user_id, u.organization_id, u.email, u.username, u.first_name, u.last_name,
             u.is_active, u.email_verified, u.last_login_at, u.created_at, u.updated_at,
             o.name as organization_name,
             COALESCE(
               json_agg(
                 json_build_object('role', ur.role_name, 'granted_at', ur.granted_at)
               ) FILTER (WHERE ur.role_name IS NOT NULL),
               '[]'
             ) as roles
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.organization_id
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
      WHERE u.user_id = $1
      GROUP BY u.user_id, o.name
    `;
    const result = await dbClient.query(query, [targetUserId]);

    if (result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
  } else {
    // List users in organization (scoped to current user's org)
    const query = `
      SELECT u.user_id, u.email, u.username, u.first_name, u.last_name,
             u.is_active, u.email_verified, u.created_at,
             COALESCE(
               json_agg(ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL),
               '[]'
             ) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
      WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
        AND u.is_active = true
      GROUP BY u.user_id
      ORDER BY u.last_name, u.first_name
    `;
    const result = await dbClient.query(query, [userId]);

    return { statusCode: 200, body: JSON.stringify({ users: result.rows, total: result.rows.length }) };
  }
}

async function handleCreate(dbClient, requestBody, userId) {
  const { organization_id, email, username, first_name, last_name, password, roles } = JSON.parse(requestBody);

  if (!email || !username || !first_name || !last_name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email, username, first_name, and last_name required' }) };
  }

  // Validate roles if provided
  const validRoles = ['admin', 'manager', 'reviewer', 'submitter', 'viewer'];
  const userRoles = roles || ['viewer']; // Default to viewer if no roles specified

  for (const role of userRoles) {
    if (!validRoles.includes(role)) {
      return { statusCode: 400, body: JSON.stringify({ error: `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}` }) };
    }
  }

  // If organization_id not provided, use current user's organization
  let orgId = organization_id;
  if (!orgId) {
    const orgQuery = await dbClient.query('SELECT organization_id FROM users WHERE user_id = $1', [userId]);
    orgId = orgQuery.rows[0]?.organization_id;
  }

  if (!orgId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'organization_id required' }) };
  }

  // Check if email already exists in the organization
  const emailCheck = await dbClient.query(
    'SELECT user_id FROM users WHERE email = $1 AND organization_id = $2',
    [email, orgId]
  );
  if (emailCheck.rows.length > 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email already exists in this organization' }) };
  }

  // Generate a simple password hash (in production, use proper bcrypt)
  const password_hash = password || 'default_hash_' + Date.now();

  // Insert user
  const userQuery = `
    INSERT INTO users (organization_id, email, username, password_hash, first_name, last_name, is_active, email_verified)
    VALUES ($1, $2, $3, $4, $5, $6, true, false)
    RETURNING user_id, organization_id, email, username, first_name, last_name, is_active, created_at
  `;
  const userResult = await dbClient.query(userQuery, [orgId, email, username, password_hash, first_name, last_name]);
  const newUser = userResult.rows[0];

  // Insert roles
  for (const role of userRoles) {
    await dbClient.query(
      'INSERT INTO user_roles (user_id, role_name, granted_by) VALUES ($1, $2, $3)',
      [newUser.user_id, role, userId]
    );
  }

  // Return user with roles
  const result = { ...newUser, roles: userRoles };
  console.log(`User created: ${newUser.user_id}`);
  return { statusCode: 201, body: JSON.stringify(result) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const targetUserId = pathParameters?.userId || pathParameters?.id;
  if (!targetUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User ID required' }) };
  }

  const { first_name, last_name, email_verified, is_active } = JSON.parse(requestBody);

  const query = `
    UPDATE users
    SET first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        email_verified = COALESCE($4, email_verified),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
    RETURNING user_id, email, username, first_name, last_name, is_active, email_verified, updated_at
  `;
  const result = await dbClient.query(query, [
    targetUserId,
    first_name || null,
    last_name || null,
    email_verified !== undefined ? email_verified : null,
    is_active !== undefined ? is_active : null,
  ]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId) {
  const targetUserId = pathParameters?.userId || pathParameters?.id;
  if (!targetUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User ID required' }) };
  }

  // Soft delete
  const query = `
    UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
    RETURNING user_id
  `;
  const result = await dbClient.query(query, [targetUserId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'User deactivated', user_id: targetUserId }) };
}
