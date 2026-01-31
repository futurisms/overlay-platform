/**
 * Sessions CRUD Handler
 * Full CRUD operations for collaborative review sessions
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Sessions Handler:', JSON.stringify(event));

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
    if (path.includes('/report')) {
      return await handleGetSessionReport(dbClient, pathParameters, userId);
    }
    if (path.includes('/export')) {
      return await handleExportSession(dbClient, pathParameters, userId);
    }

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
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (sessionId) {
    // Get specific session with participants
    const sessionQuery = `
      SELECT s.session_id, s.overlay_id, s.name, s.description, s.status,
             s.created_by, s.created_at, s.updated_at,
             o.name as overlay_name
      FROM review_sessions s
      LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
      WHERE s.session_id = $1
    `;
    const sessionResult = await dbClient.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
    }

    // Get participants
    const participantsQuery = `
      SELECT sp.user_id, sp.role, sp.joined_at,
             u.first_name, u.last_name, u.email
      FROM session_participants sp
      LEFT JOIN users u ON sp.user_id = u.user_id
      WHERE sp.session_id = $1
    `;
    const participantsResult = await dbClient.query(participantsQuery, [sessionId]);

    const session = sessionResult.rows[0];
    session.participants = participantsResult.rows;

    return { statusCode: 200, body: JSON.stringify(session) };
  } else {
    // List user's sessions (excluding archived)
    const query = `
      SELECT DISTINCT s.session_id, s.name, s.description, s.status,
             s.created_at, o.name as overlay_name,
             (SELECT COUNT(*) FROM session_participants WHERE session_id = s.session_id) as participant_count,
             (SELECT COUNT(*) FROM document_submissions WHERE session_id = s.session_id) as submission_count
      FROM review_sessions s
      LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
      LEFT JOIN session_participants sp ON s.session_id = sp.session_id
      WHERE (sp.user_id = $1 OR s.created_by = $1) AND s.status != 'archived'
      ORDER BY s.created_at DESC
    `;
    const result = await dbClient.query(query, [userId]);

    return { statusCode: 200, body: JSON.stringify({ sessions: result.rows, total: result.rows.length }) };
  }
}

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

async function handleGetSessionSubmissions(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

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

async function handleCreate(dbClient, requestBody, userId) {
  const { overlay_id, name, description } = JSON.parse(requestBody);

  if (!overlay_id || !name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'overlay_id and name required' }) };
  }

  // Get current user's organization
  const orgQuery = await dbClient.query('SELECT organization_id FROM users WHERE user_id = $1', [userId]);
  const orgId = orgQuery.rows[0]?.organization_id;

  if (!orgId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'User organization not found' }) };
  }

  // Create session
  const sessionQuery = `
    INSERT INTO review_sessions (organization_id, overlay_id, name, description, status, created_by)
    VALUES ($1, $2, $3, $4, 'active', $5)
    RETURNING session_id, organization_id, overlay_id, name, description, status, created_at
  `;
  const sessionResult = await dbClient.query(sessionQuery, [orgId, overlay_id, name, description || null, userId]);
  const session = sessionResult.rows[0];

  // Add creator as owner
  await dbClient.query(
    `INSERT INTO session_participants (session_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [session.session_id, userId]
  );

  console.log(`Session created: ${session.session_id}`);
  return { statusCode: 201, body: JSON.stringify(session) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  const { name, description, status } = JSON.parse(requestBody);

  const query = `
    UPDATE review_sessions
    SET name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
    RETURNING session_id, name, description, status, updated_at
  `;
  const result = await dbClient.query(query, [sessionId, name || null, description || null, status || null]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  const query = `
    UPDATE review_sessions SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
    RETURNING session_id
  `;
  const result = await dbClient.query(query, [sessionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Session archived', session_id: sessionId }) };
}

async function handleGetSessionReport(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Get session details
  const sessionQuery = `
    SELECT s.session_id, s.name, s.description, s.overlay_id, s.created_at,
           o.name as overlay_name,
           u.first_name || ' ' || u.last_name as created_by_name
    FROM review_sessions s
    LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
    LEFT JOIN users u ON s.created_by = u.user_id
    WHERE s.session_id = $1
  `;
  const sessionResult = await dbClient.query(sessionQuery, [sessionId]);

  if (sessionResult.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Session not found' }) };
  }

  // Get submission statistics
  const statsQuery = `
    SELECT
      COUNT(*) as total_submissions,
      COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
      COUNT(*) FILTER (WHERE status = 'in_review') as in_review_count,
      COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
      COUNT(*) FILTER (WHERE ai_analysis_status = 'completed') as completed_analysis,
      COUNT(*) FILTER (WHERE ai_analysis_status = 'pending') as pending_analysis,
      COUNT(*) FILTER (WHERE ai_analysis_status = 'processing') as processing_analysis,
      COUNT(*) FILTER (WHERE ai_analysis_status = 'failed') as failed_analysis
    FROM document_submissions
    WHERE session_id = $1
  `;
  const statsResult = await dbClient.query(statsQuery, [sessionId]);
  const stats = statsResult.rows[0];

  // Get average score from AI agent results (scoring agent)
  const scoreQuery = `
    SELECT
      AVG((aar.result->>'overall_score')::numeric) as average_score,
      MIN((aar.result->>'overall_score')::numeric) as min_score,
      MAX((aar.result->>'overall_score')::numeric) as max_score
    FROM ai_agent_results aar
    JOIN document_submissions ds ON aar.submission_id = ds.submission_id
    WHERE ds.session_id = $1
      AND aar.agent_name = 'scoring'
      AND aar.status = 'completed'
  `;
  const scoreResult = await dbClient.query(scoreQuery, [sessionId]);
  const scores = scoreResult.rows[0];

  // Get participants count
  const participantsQuery = `
    SELECT COUNT(*) as total_participants
    FROM session_participants
    WHERE session_id = $1 AND status = 'active'
  `;
  const participantsResult = await dbClient.query(participantsQuery, [sessionId]);

  // Get top issues/weaknesses from AI agent results
  const issuesQuery = `
    SELECT
      jsonb_array_elements_text(aar.result->'weaknesses') as weakness,
      COUNT(*) as frequency
    FROM ai_agent_results aar
    JOIN document_submissions ds ON aar.submission_id = ds.submission_id
    WHERE ds.session_id = $1
      AND aar.agent_name = 'scoring'
      AND aar.status = 'completed'
    GROUP BY weakness
    ORDER BY frequency DESC
    LIMIT 5
  `;
  const issuesResult = await dbClient.query(issuesQuery, [sessionId]);

  // Calculate participation rate
  const totalParticipants = parseInt(participantsResult.rows[0].total_participants);
  const totalSubmissions = parseInt(stats.total_submissions);
  const participationRate = totalParticipants > 0 ? (totalSubmissions / totalParticipants) * 100 : 0;

  // Build report
  const report = {
    session_id: sessionId,
    session_name: sessionResult.rows[0].name,
    overlay_name: sessionResult.rows[0].overlay_name,
    created_by: sessionResult.rows[0].created_by_name,
    created_at: sessionResult.rows[0].created_at,
    
    statistics: {
      total_submissions: parseInt(stats.total_submissions),
      total_participants: totalParticipants,
      participation_rate: Math.round(participationRate * 10) / 10,
      
      status_breakdown: {
        submitted: parseInt(stats.submitted_count),
        in_review: parseInt(stats.in_review_count),
        approved: parseInt(stats.approved_count),
        rejected: parseInt(stats.rejected_count)
      },
      
      analysis_breakdown: {
        completed: parseInt(stats.completed_analysis),
        pending: parseInt(stats.pending_analysis),
        processing: parseInt(stats.processing_analysis),
        failed: parseInt(stats.failed_analysis)
      },
      
      completion_rate: totalSubmissions > 0
        ? Math.round((parseInt(stats.completed_analysis) / totalSubmissions) * 1000) / 10
        : 0
    },
    
    scores: {
      average_score: scores.average_score ? Math.round(parseFloat(scores.average_score) * 10) / 10 : null,
      min_score: scores.min_score ? parseFloat(scores.min_score) : null,
      max_score: scores.max_score ? parseFloat(scores.max_score) : null
    },
    
    top_issues: issuesResult.rows.map(row => ({
      issue: row.weakness,
      frequency: parseInt(row.frequency)
    }))
  };

  return { statusCode: 200, body: JSON.stringify(report) };
}

async function handleExportSession(dbClient, pathParameters, userId) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Get all submissions with scores from AI agent results
  const query = `
    SELECT
      ds.submission_id,
      ds.document_name,
      ds.status,
      ds.ai_analysis_status,
      ds.submitted_at,
      u.first_name || ' ' || u.last_name as submitted_by,
      u.email as submitted_by_email,
      aar.result->>'overall_score' as overall_score,
      (
        SELECT STRING_AGG(elem::text, '; ')
        FROM jsonb_array_elements_text(aar.result->'strengths') elem
      ) as strengths,
      (
        SELECT STRING_AGG(elem::text, '; ')
        FROM jsonb_array_elements_text(aar.result->'weaknesses') elem
      ) as weaknesses
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    LEFT JOIN ai_agent_results aar ON ds.submission_id = aar.submission_id
      AND aar.agent_name = 'scoring'
      AND aar.status = 'completed'
    WHERE ds.session_id = $1
    ORDER BY ds.submitted_at DESC
  `;
  const result = await dbClient.query(query, [sessionId]);

  // Generate CSV
  const headers = [
    'Submission ID',
    'Document Name',
    'Submitted By',
    'Email',
    'Status',
    'Analysis Status',
    'Overall Score',
    'Submitted At',
    'Strengths',
    'Weaknesses'
  ];

  const csvRows = [headers.join(',')];

  result.rows.forEach(row => {
    const csvRow = [
      row.submission_id,
      `"${row.document_name}"`,
      `"${row.submitted_by || 'N/A'}"`,
      `"${row.submitted_by_email || 'N/A'}"`,
      row.status,
      row.ai_analysis_status,
      row.overall_score || 'N/A',
      row.submitted_at ? new Date(row.submitted_at).toISOString() : 'N/A',
      `"${row.strengths || 'N/A'}"`,
      `"${row.weaknesses || 'N/A'}"`
    ];
    csvRows.push(csvRow.join(','));
  });

  const csv = csvRows.join('\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="session-${sessionId}-export.csv"`
    },
    body: csv
  };
}
