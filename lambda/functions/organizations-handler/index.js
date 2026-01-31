/**
 * Organizations Handler
 * CRUD operations for organizations
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Organizations Handler:', JSON.stringify(event));

  const { httpMethod, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001'; // Admin fallback

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Route based on HTTP method
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
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
};

/**
 * GET /organizations or /organizations/{id}
 */
async function handleGet(dbClient, pathParameters, userId) {
  const orgId = pathParameters?.organizationId || pathParameters?.id;

  if (orgId) {
    // Get specific organization
    const query = `
      SELECT
        organization_id,
        name,
        domain,
        subscription_tier,
        max_users,
        max_overlays,
        settings,
        created_at,
        updated_at,
        is_active
      FROM organizations
      WHERE organization_id = $1
    `;

    const result = await dbClient.query(query, [orgId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Organization not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows[0]),
    };
  } else {
    // List all organizations (with user access check)
    const query = `
      SELECT DISTINCT
        o.organization_id,
        o.name,
        o.domain,
        o.subscription_tier,
        o.max_users,
        o.max_overlays,
        o.settings,
        o.created_at,
        o.updated_at,
        o.is_active,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.organization_id) as member_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.organization_id
      WHERE o.is_active = true
        AND (u.user_id = $1 OR $1 = '10000000-0000-0000-0000-000000000001')
      ORDER BY o.created_at DESC
    `;

    const result = await dbClient.query(query, [userId]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        organizations: result.rows,
        total: result.rows.length,
      }),
    };
  }
}

/**
 * POST /organizations
 */
async function handleCreate(dbClient, requestBody, userId) {
  const data = JSON.parse(requestBody);

  const { name, domain, subscription_tier, max_users, max_overlays, settings } = data;

  if (!name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Organization name is required' }),
    };
  }

  const query = `
    INSERT INTO organizations (
      name,
      domain,
      subscription_tier,
      max_users,
      max_overlays,
      settings,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, true)
    RETURNING organization_id, name, domain, subscription_tier, max_users, max_overlays, settings, created_at, is_active
  `;

  const result = await dbClient.query(query, [
    name,
    domain || null,
    subscription_tier || 'free',
    max_users || 10,
    max_overlays || 5,
    settings ? JSON.stringify(settings) : '{}',
  ]);

  console.log(`Organization created: ${result.rows[0].organization_id}`);

  return {
    statusCode: 201,
    body: JSON.stringify(result.rows[0]),
  };
}

/**
 * PUT /organizations/{id}
 */
async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const orgId = pathParameters?.organizationId || pathParameters?.id;

  if (!orgId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Organization ID is required' }),
    };
  }

  const data = JSON.parse(requestBody);
  const { name, domain, subscription_tier, max_users, max_overlays, settings, is_active } = data;

  // Check if organization exists
  const checkQuery = 'SELECT organization_id FROM organizations WHERE organization_id = $1';
  const checkResult = await dbClient.query(checkQuery, [orgId]);

  if (checkResult.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Organization not found' }),
    };
  }

  const query = `
    UPDATE organizations
    SET
      name = COALESCE($2, name),
      domain = COALESCE($3, domain),
      subscription_tier = COALESCE($4, subscription_tier),
      max_users = COALESCE($5, max_users),
      max_overlays = COALESCE($6, max_overlays),
      settings = COALESCE($7, settings),
      is_active = COALESCE($8, is_active),
      updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = $1
    RETURNING organization_id, name, domain, subscription_tier, max_users, max_overlays, settings, created_at, updated_at, is_active
  `;

  const result = await dbClient.query(query, [
    orgId,
    name || null,
    domain || null,
    subscription_tier || null,
    max_users !== undefined ? max_users : null,
    max_overlays !== undefined ? max_overlays : null,
    settings ? JSON.stringify(settings) : null,
    is_active !== undefined ? is_active : null,
  ]);

  console.log(`Organization updated: ${orgId}`);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows[0]),
  };
}

/**
 * DELETE /organizations/{id}
 */
async function handleDelete(dbClient, pathParameters, userId) {
  const orgId = pathParameters?.organizationId || pathParameters?.id;

  if (!orgId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Organization ID is required' }),
    };
  }

  // Check if organization exists
  const checkQuery = 'SELECT organization_id FROM organizations WHERE organization_id = $1';
  const checkResult = await dbClient.query(checkQuery, [orgId]);

  if (checkResult.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Organization not found' }),
    };
  }

  // Soft delete
  const query = `
    UPDATE organizations
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = $1
    RETURNING organization_id
  `;

  await dbClient.query(query, [orgId]);

  console.log(`Organization deleted: ${orgId}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Organization deleted successfully', organization_id: orgId }),
  };
}
