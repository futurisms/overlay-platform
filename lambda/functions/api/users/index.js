/**
 * Users API Handler
 * Handles user-related endpoints
 */

const { Client } = require('pg');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Helper: Create response
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// Helper: Get user ID from event
function getUserId(event) {
  // Try x-user-id header first (for testing)
  if (event.headers['x-user-id']) {
    return event.headers['x-user-id'];
  }

  // Get from Cognito authorizer context
  if (event.requestContext?.authorizer?.claims?.sub) {
    return event.requestContext.authorizer.claims.sub;
  }

  return null;
}

/**
 * Get Current User Info
 * GET /users/me
 */
async function handleGetCurrentUser(dbClient, userId) {
  if (!userId) {
    return response(401, { error: 'Unauthorized: No user ID found' });
  }

  try {
    const result = await dbClient.query(
      `SELECT user_id, email, first_name, last_name, user_role as role, created_at
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return response(404, { error: 'User not found' });
    }

    const user = result.rows[0];
    // Concatenate first_name and last_name for the name field
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

    return response(200, {
      user: {
        user_id: user.user_id,
        email: user.email,
        name: fullName,
        role: user.role,  // This will be the user_role value ('admin' or 'analyst')
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return response(500, { error: 'Failed to fetch user information' });
  }
}

/**
 * Main Lambda Handler
 */
exports.handler = async (event) => {
  console.log('Users API Event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const path = event.path;
  const pathParameters = event.pathParameters || {};

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return response(200, { message: 'OK' });
  }

  // Create database client
  const dbClient = new Client(dbConfig);

  try {
    await dbClient.connect();

    const userId = getUserId(event);

    // Route requests
    if (method === 'GET' && path.endsWith('/users/me')) {
      return await handleGetCurrentUser(dbClient, userId);
    }

    // Unknown route
    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    return response(500, { error: 'Internal server error' });
  } finally {
    await dbClient.end();
  }
};
