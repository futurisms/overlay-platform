/**
 * Overlays CRUD Handler
 * Full CRUD operations for overlays with evaluation criteria
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Overlays Handler:', JSON.stringify(event));

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
  const overlayId = pathParameters?.overlayId || pathParameters?.id;

  if (overlayId) {
    // Get specific overlay with criteria
    const overlayQuery = `
      SELECT
        overlay_id, name, description, document_type,
        document_purpose, when_used, process_context, target_audience,
        configuration, created_by, created_at, updated_at, is_active
      FROM overlays
      WHERE overlay_id = $1 AND is_active = true
    `;
    const overlayResult = await dbClient.query(overlayQuery, [overlayId]);

    if (overlayResult.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Overlay not found' }) };
    }

    // Get evaluation criteria
    const criteriaQuery = `
      SELECT criteria_id, name, description, criterion_type, weight,
             is_required, display_order, validation_rules
      FROM evaluation_criteria
      WHERE overlay_id = $1
      ORDER BY display_order, name
    `;
    const criteriaResult = await dbClient.query(criteriaQuery, [overlayId]);

    const overlay = overlayResult.rows[0];

    // Map database fields to frontend field names
    overlay.criteria = criteriaResult.rows.map(c => ({
      criterion_id: c.criteria_id,  // Map criteria_id -> criterion_id
      name: c.name,
      description: c.description,
      category: c.criterion_type,    // Map criterion_type -> category
      weight: parseFloat(c.weight),
      max_score: 100,                // Frontend expects this, use default
      is_active: true,               // Frontend expects this, use default
      is_required: c.is_required,
      display_order: c.display_order,
      validation_rules: c.validation_rules
    }));

    return { statusCode: 200, body: JSON.stringify(overlay) };
  } else {
    // List all overlays
    const query = `
      SELECT
        o.overlay_id, o.name, o.description, o.document_type,
        o.document_purpose, o.when_used, o.process_context, o.target_audience,
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
      body: JSON.stringify({ overlays: result.rows, total: result.rows.length }),
    };
  }
}

async function handleCreate(dbClient, requestBody, userId) {
  const {
    name, description, document_type, configuration, criteria,
    document_purpose, when_used, process_context, target_audience
  } = JSON.parse(requestBody);

  if (!name || !document_type) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and document_type required' }) };
  }

  // Get current user's organization
  const orgQuery = await dbClient.query('SELECT organization_id FROM users WHERE user_id = $1', [userId]);
  const orgId = orgQuery.rows[0]?.organization_id;

  if (!orgId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User organization not found' }) };
  }

  // Create overlay
  const overlayQuery = `
    INSERT INTO overlays (
      organization_id, name, description, document_type,
      document_purpose, when_used, process_context, target_audience,
      configuration, created_by, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
    RETURNING overlay_id, organization_id, name, description, document_type,
              document_purpose, when_used, process_context, target_audience, created_at
  `;
  const overlayResult = await dbClient.query(overlayQuery, [
    orgId,
    name,
    description || null,
    document_type,
    document_purpose || null,
    when_used || null,
    process_context || null,
    target_audience || null,
    configuration ? JSON.stringify(configuration) : '{}',
    userId,
  ]);

  const overlay = overlayResult.rows[0];

  // Create criteria if provided
  if (criteria && criteria.length > 0) {
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      // Map frontend fields to actual database columns
      // Frontend may use: category, max_score, is_active, criterion_id
      // Database has: criterion_type, weight, is_required, criteria_id
      await dbClient.query(
        `INSERT INTO evaluation_criteria
         (overlay_id, name, description, criterion_type, weight, is_required, display_order, validation_rules)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          overlay.overlay_id,
          c.name,
          c.description || null,
          c.category || c.criterion_type || 'text',
          c.weight || 1.0,
          c.is_required !== undefined ? c.is_required : true,
          i,
          c.validation_rules || '{}'
        ]
      );
    }
  }

  console.log(`Overlay created: ${overlay.overlay_id}`);
  return { statusCode: 201, body: JSON.stringify(overlay) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;
  if (!overlayId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Overlay ID required' }) };
  }

  const {
    name, description, document_type, configuration, is_active,
    document_purpose, when_used, process_context, target_audience, criteria
  } = JSON.parse(requestBody);

  // Update overlay metadata
  const query = `
    UPDATE overlays
    SET name = COALESCE($2, name),
        description = COALESCE($3, description),
        document_type = COALESCE($4, document_type),
        document_purpose = COALESCE($5, document_purpose),
        when_used = COALESCE($6, when_used),
        process_context = COALESCE($7, process_context),
        target_audience = COALESCE($8, target_audience),
        configuration = COALESCE($9, configuration),
        is_active = COALESCE($10, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE overlay_id = $1
    RETURNING overlay_id, name, description, document_type,
              document_purpose, when_used, process_context, target_audience,
              is_active, updated_at
  `;
  const result = await dbClient.query(query, [
    overlayId,
    name || null,
    description || null,
    document_type || null,
    document_purpose || null,
    when_used || null,
    process_context || null,
    target_audience || null,
    configuration ? JSON.stringify(configuration) : null,
    is_active !== undefined ? is_active : null,
  ]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Overlay not found' }) };
  }

  // Update criteria if provided
  if (criteria !== undefined) {
    console.log(`Updating criteria for overlay ${overlayId}: ${criteria.length} criteria provided`);

    // Delete all existing criteria for this overlay
    await dbClient.query(
      'DELETE FROM evaluation_criteria WHERE overlay_id = $1',
      [overlayId]
    );
    console.log('Deleted existing criteria');

    // Insert new criteria
    if (criteria && criteria.length > 0) {
      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];

        // Skip temporary IDs from frontend (they start with "temp-")
        if (c.criterion_id && c.criterion_id.startsWith('temp-')) {
          console.log(`Creating new criterion: ${c.name}`);
        }

        // Map frontend fields to actual database columns
        // Frontend uses: category, max_score, is_active, criterion_id
        // Database has: criterion_type, weight, is_required, criteria_id
        await dbClient.query(
          `INSERT INTO evaluation_criteria
           (overlay_id, name, description, criterion_type, weight, is_required, display_order, validation_rules)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            overlayId,
            c.name,
            c.description || null,
            c.category || c.criterion_type || 'text',
            c.weight || 1.0,
            c.is_required !== undefined ? c.is_required : true,
            i,
            c.validation_rules || '{}'
          ]
        );
      }
      console.log(`Inserted ${criteria.length} new criteria`);
    }
  }

  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;
  if (!overlayId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Overlay ID required' }) };
  }

  const query = `
    UPDATE overlays SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE overlay_id = $1
    RETURNING overlay_id
  `;
  const result = await dbClient.query(query, [overlayId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Overlay not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Overlay deleted', overlay_id: overlayId }) };
}
