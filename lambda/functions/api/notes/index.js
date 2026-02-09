/**
 * Notes CRUD Handler
 * Full CRUD operations for user notes from review sessions
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { getCorsHeaders } = require('/opt/nodejs/cors');

exports.handler = async (event) => {
  console.log('Notes Handler:', JSON.stringify(event));

  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
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
  const noteId = pathParameters?.noteId || pathParameters?.id;

  if (noteId) {
    // Get specific note
    const query = `
      SELECT note_id, user_id, session_id, title, content, ai_summary,
             created_at, updated_at
      FROM user_notes
      WHERE note_id = $1
    `;
    const result = await dbClient.query(query, [noteId]);

    if (result.rows.length === 0) {
      return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Note not found' }) };
    }

    const note = result.rows[0];

    // Verify note belongs to user
    if (note.user_id !== userId) {
      return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Access denied' }) };
    }

    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(note) };
  } else {
    // List user's notes sorted by created_at DESC
    const query = `
      SELECT note_id, session_id, title,
             SUBSTRING(content, 1, 100) as content_preview,
             created_at
      FROM user_notes
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await dbClient.query(query, [userId]);

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        notes: result.rows,
        total: result.rows.length
      })
    };
  }
}

async function handleCreate(dbClient, requestBody, userId, event) {
  const { title, content, session_id } = JSON.parse(requestBody);

  // Validate required fields
  if (!title || !content) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'title and content are required' }) };
  }

  // Validate title length
  if (title.length > 255) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'title must be 255 characters or less' }) };
  }

  // If session_id provided, verify it exists
  if (session_id) {
    const sessionCheck = await dbClient.query(
      'SELECT session_id FROM review_sessions WHERE session_id = $1',
      [session_id]
    );
    if (sessionCheck.rows.length === 0) {
      return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Invalid session_id' }) };
    }
  }

  // Create note
  const query = `
    INSERT INTO user_notes (user_id, session_id, title, content)
    VALUES ($1, $2, $3, $4)
    RETURNING note_id, created_at
  `;
  const result = await dbClient.query(query, [
    userId,
    session_id || null,
    title,
    content
  ]);

  const note = result.rows[0];
  console.log(`Note created: ${note.note_id} by user ${userId}`);

  return {
      statusCode: 201,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
      note_id: note.note_id,
      created_at: note.created_at
    })
  };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId, event) {
  const noteId = pathParameters?.noteId || pathParameters?.id;

  if (!noteId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Note ID required' }) };
  }

  const { title, content, ai_summary } = JSON.parse(requestBody);

  // Must provide at least one field to update
  if (!title && !content && !ai_summary) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'No fields to update' }) };
  }

  // Validate title length if provided
  if (title && title.length > 255) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'title must be 255 characters or less' }) };
  }

  // Verify note exists and belongs to user
  const ownershipCheck = await dbClient.query(
    'SELECT user_id FROM user_notes WHERE note_id = $1',
    [noteId]
  );

  if (ownershipCheck.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Note not found' }) };
  }

  if (ownershipCheck.rows[0].user_id !== userId) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Access denied' }) };
  }

  // Update note
  const query = `
    UPDATE user_notes
    SET title = COALESCE($2, title),
        content = COALESCE($3, content),
        ai_summary = COALESCE($4, ai_summary)
    WHERE note_id = $1
    RETURNING note_id, updated_at
  `;
  const result = await dbClient.query(query, [
    noteId,
    title || null,
    content || null,
    ai_summary || null
  ]);

  console.log(`Note updated: ${noteId} by user ${userId}`);

  return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
      note_id: result.rows[0].note_id,
      updated_at: result.rows[0].updated_at
    })
  };
}

async function handleDelete(dbClient, pathParameters, userId, event) {
  const noteId = pathParameters?.noteId || pathParameters?.id;

  if (!noteId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Note ID required' }) };
  }

  // Verify note exists and belongs to user
  const ownershipCheck = await dbClient.query(
    'SELECT user_id FROM user_notes WHERE note_id = $1',
    [noteId]
  );

  if (ownershipCheck.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Note not found' }) };
  }

  if (ownershipCheck.rows[0].user_id !== userId) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Access denied' }) };
  }

  // Delete note
  const query = 'DELETE FROM user_notes WHERE note_id = $1';
  await dbClient.query(query, [noteId]);

  console.log(`Note deleted: ${noteId} by user ${userId}`);

  return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ success: true, note_id: noteId })
  };
}
