/**
 * Overlays CRUD Handler
 * Full CRUD operations for overlays with evaluation criteria
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { getCorsHeaders } = require('/opt/nodejs/cors');
const { canEdit } = require('/opt/nodejs/permissions');

exports.handler = async (event) => {
  console.log('Overlays Handler:', JSON.stringify(event));

  const { httpMethod, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    switch (httpMethod) {
      case 'GET':
        return await handleGet(dbClient, pathParameters, userId, event);
      case 'POST':
        return await handleCreate(dbClient, requestBody, userId, event);
      case 'PUT':
        return await handleUpdate(dbClient, pathParameters, requestBody, userId, event);
      case 'DELETE':
        return await handleDelete(dbClient, pathParameters, userId, event);
      default:
        return { statusCode: 405, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: error.message }) };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

async function handleGet(dbClient, pathParameters, userId, event) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;

  if (overlayId) {
    // Get specific overlay with criteria
    const overlayQuery = `
      SELECT
        overlay_id, name, description, document_type,
        configuration, created_by, created_at, updated_at, is_active
      FROM overlays
      WHERE overlay_id = $1 AND is_active = true
    `;
    const overlayResult = await dbClient.query(overlayQuery, [overlayId]);

    if (overlayResult.rows.length === 0) {
      return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Overlay not found' }) };
    }

    // Get evaluation criteria
    const criteriaQuery = `
      SELECT criteria_id, name, description, criterion_type, weight,
             is_required, display_order, validation_rules, criteria_text, max_score
      FROM evaluation_criteria
      WHERE overlay_id = $1
      ORDER BY display_order, name
    `;
    const criteriaResult = await dbClient.query(criteriaQuery, [overlayId]);

    const overlay = overlayResult.rows[0];
    // Map database fields to frontend-expected fields
    overlay.criteria = criteriaResult.rows.map(c => ({
      criteria_id: c.criteria_id,    // Use consistent criteria_id field name
      name: c.name,
      description: c.description,
      category: c.criterion_type,    // Map criterion_type to category
      weight: c.weight / 100,        // Convert to 0-1 range
      max_score: c.max_score || c.weight,  // Use max_score if available, fallback to weight
      is_required: c.is_required,
      is_active: true,               // All criteria are active (no is_active column in DB)
      display_order: c.display_order,
      validation_rules: c.validation_rules,
      criteria_text: c.criteria_text || '',  // Include detailed criteria text
    }));

    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(overlay) };
  } else {
    // List all overlays
    const query = `
      SELECT
        o.overlay_id, o.name, o.description, o.document_type,
        o.created_at, o.updated_at,
        (SELECT COUNT(*) FROM evaluation_criteria WHERE overlay_id = o.overlay_id) as criteria_count,
        (SELECT COUNT(*) FROM document_submissions WHERE overlay_id = o.overlay_id) as submission_count
      FROM overlays o
      WHERE o.is_active = true
      ORDER BY o.created_at DESC
    `;
    const result = await dbClient.query(query);

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ overlays: result.rows, total: result.rows.length }),
    };
  }
}

async function handleCreate(dbClient, requestBody, userId, event) {
  const { name, description, document_type, configuration, criteria } = JSON.parse(requestBody);

  if (!name || !document_type) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Name and document_type required' }) };
  }

  // Check permissions - only admins can create overlays
  const userQuery = await dbClient.query('SELECT user_id, user_role, organization_id FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canEdit(user)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: Only admins can create overlays' }) };
  }

  // Get current user's organization
  const orgId = user.organization_id;

  if (!orgId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User organization not found' }) };
  }

  // Create overlay
  const overlayQuery = `
    INSERT INTO overlays (organization_id, name, description, document_type, configuration, created_by, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    RETURNING overlay_id, organization_id, name, description, document_type, created_at
  `;
  const overlayResult = await dbClient.query(overlayQuery, [
    orgId,
    name,
    description || null,
    document_type,
    configuration ? JSON.stringify(configuration) : '{}',
    userId,
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
        [overlay.overlay_id, c.name, c.description, c.criterion_type || 'general', c.weight || 1, c.is_required || false, i]
      );
    }
  }

  console.log(`Overlay created: ${overlay.overlay_id}`);
  return { statusCode: 201, headers: getCorsHeaders(event), body: JSON.stringify(overlay) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId, event) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;
  if (!overlayId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Overlay ID required' }) };
  }

  // Check permissions - only admins can edit overlays
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canEdit(user)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: Only admins can edit overlays' }) };
  }

  const { name, description, document_type, configuration, is_active, criteria } = JSON.parse(requestBody);

  // Update overlay metadata
  const query = `
    UPDATE overlays
    SET name = COALESCE($2, name),
        description = COALESCE($3, description),
        document_type = COALESCE($4, document_type),
        configuration = COALESCE($5, configuration),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE overlay_id = $1
    RETURNING overlay_id, name, description, document_type, is_active, updated_at
  `;
  const result = await dbClient.query(query, [
    overlayId,
    name || null,
    description || null,
    document_type || null,
    configuration ? JSON.stringify(configuration) : null,
    is_active !== undefined ? is_active : null,
  ]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Overlay not found' }) };
  }

  // Handle criteria updates if provided
  if (criteria !== undefined && Array.isArray(criteria)) {
    console.log(`Updating criteria for overlay ${overlayId}, received ${criteria.length} criteria`);

    // Process each criterion - UPDATE if criteria_id provided, INSERT if not
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];

      // Check if criteria_id is provided (indicates UPDATE of existing criterion)
      if (c.criteria_id) {
        // UPDATE existing criterion - update criteria_text, description, and max_score
        // Copies criteria_text to description to maintain single source of truth
        // This preserves foreign key relationships with evaluation_responses
        const updateQuery = `
          UPDATE evaluation_criteria
          SET criteria_text = COALESCE($2, criteria_text),
              description = COALESCE($2, description),
              max_score = COALESCE($3, max_score),
              updated_at = CURRENT_TIMESTAMP
          WHERE criteria_id = $1 AND overlay_id = $4
        `;

        const result = await dbClient.query(updateQuery, [
          c.criteria_id,
          c.criteria_text !== undefined ? c.criteria_text : null,
          c.max_score !== undefined ? c.max_score : null,
          overlayId
        ]);

        if (result.rowCount === 0) {
          console.warn(`Criterion ${c.criteria_id} not found for overlay ${overlayId}`);
        } else {
          console.log(`  - Updated criterion: ${c.criteria_id} (criteria_text: ${c.criteria_text !== undefined ? 'updated' : 'unchanged'}, max_score: ${c.max_score !== undefined ? c.max_score : 'unchanged'})`);
        }
      } else {
        // INSERT new criterion (if criteria_id not provided)
        // Map frontend fields to database schema
        // Frontend sends: { name, description, category, weight (0-1), max_score }
        // Database expects: { name, description, criterion_type, weight (max score) }
        const criterionType = c.criterion_type || c.category || 'text';
        const weightValue = c.max_score !== undefined ? c.max_score :
                            (c.weight !== undefined && c.weight <= 1 ? c.weight * 100 : c.weight || 10);

        const insertQuery = `
          INSERT INTO evaluation_criteria
          (overlay_id, name, description, criterion_type, weight, is_required, display_order, criteria_text, max_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING criteria_id
        `;

        const result = await dbClient.query(insertQuery, [
          overlayId,
          c.name,
          c.description || null,
          criterionType,
          weightValue,
          c.is_required !== undefined ? c.is_required : false,
          c.display_order !== undefined ? c.display_order : i,
          c.criteria_text || null,
          c.max_score !== undefined ? c.max_score : weightValue,
        ]);

        console.log(`  - Inserted new criterion: ${c.name} (id: ${result.rows[0].criteria_id}, type: ${criterionType}, weight: ${weightValue})`);
      }
    }

    console.log(`Successfully processed ${criteria.length} criteria for overlay ${overlayId}`);
  }

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId, event) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;
  if (!overlayId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Overlay ID required' }) };
  }

  // Check permissions - only admins can delete overlays
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canEdit(user)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: Only admins can delete overlays' }) };
  }

  const query = `
    UPDATE overlays SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE overlay_id = $1
    RETURNING overlay_id
  `;
  const result = await dbClient.query(query, [overlayId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Overlay not found' }) };
  }

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ message: 'Overlay deleted', overlay_id: overlayId }) };
}
