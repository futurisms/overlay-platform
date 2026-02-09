/**
 * Sessions CRUD Handler
 * Full CRUD operations for collaborative review sessions
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { getCorsHeaders } = require('/opt/nodejs/cors');
const { canEdit, hasSessionAccess, getAccessibleSessions, revokeSessionAccess } = require('/opt/nodejs/permissions');

exports.handler = async (event) => {
  console.log('Sessions Handler:', JSON.stringify(event));

  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Handle special routes
    if (path.endsWith('/available')) {
      return await handleGetAvailable(dbClient, userId, event);
    }
    if (path.includes('/submissions')) {
      return await handleGetSessionSubmissions(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/report')) {
      return await handleGetSessionReport(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/export')) {
      return await handleExportSession(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/participants/') && httpMethod === 'DELETE') {
      return await handleRemoveParticipant(dbClient, path, userId, event);
    }

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
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (sessionId) {
    // Check if user has access to this session
    const hasAccess = await hasSessionAccess(dbClient, userId, sessionId);
    if (!hasAccess) {
      return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: No access to this session' }) };
    }

    // Get specific session with participants
    const sessionQuery = `
      SELECT s.session_id, s.overlay_id, s.name, s.description, s.status,
             s.project_name, s.created_by, s.created_at, s.updated_at,
             o.name as overlay_name
      FROM review_sessions s
      LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
      WHERE s.session_id = $1
    `;
    const sessionResult = await dbClient.query(sessionQuery, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session not found' }) };
    }

    // Get user role to determine filtering
    const userQuery = await dbClient.query('SELECT user_role FROM users WHERE user_id = $1', [userId]);
    const userRole = userQuery.rows[0]?.user_role;

    // Get participants (only active ones)
    const participantsQuery = `
      SELECT sp.user_id, sp.role, sp.joined_at,
             u.first_name, u.last_name, u.email
      FROM session_participants sp
      LEFT JOIN users u ON sp.user_id = u.user_id
      WHERE sp.session_id = $1
        AND sp.status = 'active'
    `;
    const participantsResult = await dbClient.query(participantsQuery, [sessionId]);

    // Get submissions with scores (filtered by role)
    let submissionsQuery = `
      SELECT ds.submission_id, ds.document_name, ds.status, ds.ai_analysis_status,
             ds.submitted_at, u.first_name || ' ' || u.last_name as submitted_by_name,
             (
               SELECT ROUND(COALESCE(
                 (content::jsonb->'scores'->>'average')::numeric,
                 (content::jsonb->>'overall_score')::numeric
               ), 0)
               FROM feedback_reports
               WHERE submission_id = ds.submission_id
               AND report_type = 'comment'
               ORDER BY created_at DESC
               LIMIT 1
             ) as overall_score
      FROM document_submissions ds
      LEFT JOIN users u ON ds.submitted_by = u.user_id
      WHERE ds.session_id = $1
    `;

    const submissionsParams = [sessionId];

    // Analysts can only see their own submissions
    if (userRole === 'analyst') {
      submissionsQuery += ' AND ds.submitted_by = $2';
      submissionsParams.push(userId);
    }

    submissionsQuery += ' ORDER BY ds.submitted_at DESC';

    const submissionsResult = await dbClient.query(submissionsQuery, submissionsParams);

    const session = sessionResult.rows[0];
    session.participants = participantsResult.rows;
    session.submissions = submissionsResult.rows;
    session.submission_count = submissionsResult.rows.length;

    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(session) };
  } else {
    // List user's accessible sessions (admins see all, analysts see assigned)
    console.log('='.repeat(70));
    console.log('DEBUG: Fetching accessible sessions');
    console.log('User ID:', userId);

    const sessions = await getAccessibleSessions(dbClient, userId);

    console.log('Sessions returned:', sessions.length);
    console.log('Sessions data:', JSON.stringify(sessions, null, 2));
    console.log('='.repeat(70));

    // Add participant and submission counts
    for (const session of sessions) {
      const countsQuery = `
        SELECT
          (SELECT COUNT(*) FROM session_participants WHERE session_id = $1 AND status = 'active') as participant_count,
          (SELECT COUNT(*) FROM document_submissions WHERE session_id = $1) as submission_count
      `;
      const countsResult = await dbClient.query(countsQuery, [session.session_id]);
      session.participant_count = parseInt(countsResult.rows[0].participant_count);
      session.submission_count = parseInt(countsResult.rows[0].submission_count);
    }

    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ sessions, total: sessions.length }) };
  }
}

async function handleGetAvailable(dbClient, userId, event) {
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

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ sessions: result.rows, total: result.rows.length }) };
}

async function handleGetSessionSubmissions(dbClient, pathParameters, userId, event) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  // Check if user has access to this session
  const hasAccess = await hasSessionAccess(dbClient, userId, sessionId);
  if (!hasAccess) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: No access to this session' }) };
  }

  // Get user role to determine filtering
  const userQuery = await dbClient.query('SELECT user_role FROM users WHERE user_id = $1', [userId]);
  const userRole = userQuery.rows[0]?.user_role;

  // Build query with role-based filtering
  let query = `
    SELECT ds.submission_id, ds.document_name, ds.status, ds.ai_analysis_status,
           ds.submitted_at, u.first_name || ' ' || u.last_name as submitted_by_name,
           (
             SELECT ROUND(COALESCE(
               (content::jsonb->'scores'->>'average')::numeric,
               (content::jsonb->>'overall_score')::numeric
             ), 0)
             FROM feedback_reports
             WHERE submission_id = ds.submission_id
             AND report_type = 'comment'
             ORDER BY created_at DESC
             LIMIT 1
           ) as overall_score
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    WHERE ds.session_id = $1
  `;

  const params = [sessionId];

  // Analysts can only see their own submissions
  if (userRole === 'analyst') {
    query += ' AND ds.submitted_by = $2';
    params.push(userId);
  }

  query += ' ORDER BY ds.submitted_at DESC';

  const result = await dbClient.query(query, params);

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ submissions: result.rows, total: result.rows.length }) };
}

async function handleCreate(dbClient, requestBody, userId, event) {
  const { overlay_id, name, description, project_name } = JSON.parse(requestBody);

  if (!overlay_id || !name) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'overlay_id and name required' }) };
  }

  // Check permissions - only admins can create sessions
  const userQuery = await dbClient.query('SELECT user_id, user_role, organization_id FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canEdit(user)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: Only admins can create sessions' }) };
  }

  // Get current user's organization
  const orgId = user.organization_id;

  if (!orgId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User organization not found' }) };
  }

  // Create session
  const sessionQuery = `
    INSERT INTO review_sessions (organization_id, overlay_id, name, description, project_name, status, created_by)
    VALUES ($1, $2, $3, $4, $5, 'active', $6)
    RETURNING session_id, organization_id, overlay_id, name, description, project_name, status, created_at
  `;
  const sessionResult = await dbClient.query(sessionQuery, [orgId, overlay_id, name, description || null, project_name || null, userId]);
  const session = sessionResult.rows[0];

  // Add creator as owner
  await dbClient.query(
    `INSERT INTO session_participants (session_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [session.session_id, userId]
  );

  console.log(`Session created: ${session.session_id}`);
  return { statusCode: 201, headers: getCorsHeaders(event), body: JSON.stringify(session) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId, event) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;
  if (!sessionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check permissions - only admins can update sessions
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canEdit(user)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: Only admins can update sessions' }) };
  }

  const { name, description, status, project_name } = JSON.parse(requestBody);

  const query = `
    UPDATE review_sessions
    SET name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        project_name = COALESCE($5, project_name),
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
    RETURNING session_id, name, description, status, project_name, updated_at
  `;
  const result = await dbClient.query(query, [sessionId, name || null, description || null, status || null, project_name || null]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session not found' }) };
  }

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId, event) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;
  if (!sessionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check permissions - only admins can delete sessions
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canEdit(user)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: Only admins can delete sessions' }) };
  }

  const query = `
    UPDATE review_sessions SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
    RETURNING session_id
  `;
  const result = await dbClient.query(query, [sessionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session not found' }) };
  }

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ message: 'Session archived', session_id: sessionId }) };
}

async function handleGetSessionReport(dbClient, pathParameters, userId, event) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check if user has access to this session
  const hasAccess = await hasSessionAccess(dbClient, userId, sessionId);
  if (!hasAccess) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: No access to this session' }) };
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
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session not found' }) };
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

  // Get average score from feedback reports
  const scoreQuery = `
    SELECT
      AVG(fr.overall_score) as average_score,
      MIN(fr.overall_score) as min_score,
      MAX(fr.overall_score) as max_score
    FROM feedback_reports fr
    JOIN document_submissions ds ON fr.submission_id = ds.submission_id
    WHERE ds.session_id = $1
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

  // Get top issues/weaknesses
  const issuesQuery = `
    SELECT
      jsonb_array_elements_text(fr.weaknesses) as weakness,
      COUNT(*) as frequency
    FROM feedback_reports fr
    JOIN document_submissions ds ON fr.submission_id = ds.submission_id
    WHERE ds.session_id = $1
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

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(report) };
}

async function handleExportSession(dbClient, pathParameters, userId, event) {
  const sessionId = pathParameters?.sessionId || pathParameters?.id;

  if (!sessionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Session ID required' }) };
  }

  // Check if user has access to this session
  const hasAccess = await hasSessionAccess(dbClient, userId, sessionId);
  if (!hasAccess) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: No access to this session' }) };
  }

  // Get all submissions with scores
  const query = `
    SELECT
      ds.submission_id,
      ds.document_name,
      ds.status,
      ds.ai_analysis_status,
      ds.submitted_at,
      u.first_name || ' ' || u.last_name as submitted_by,
      u.email as submitted_by_email,
      fr.overall_score,
      ARRAY_TO_STRING(fr.strengths, '; ') as strengths,
      ARRAY_TO_STRING(fr.weaknesses, '; ') as weaknesses
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    LEFT JOIN feedback_reports fr ON ds.submission_id = fr.submission_id
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
        ...getCorsHeaders(event),
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="session-${sessionId
      }-export.csv"`
    },
    body: csv
  };
}

async function handleRemoveParticipant(dbClient, path, userId, event) {
  // Parse path: /production/sessions/{sessionId}/participants/{userIdToRemove}
  // or: /sessions/{sessionId}/participants/{userIdToRemove}
  const pathParts = path.split('/').filter(Boolean);

  // Find the index of 'participants' in the path
  const participantsIndex = pathParts.findIndex(part => part === 'participants');

  if (participantsIndex === -1 || participantsIndex < 2 || participantsIndex + 1 >= pathParts.length) {
    console.log('Invalid path format:', { path, pathParts, participantsIndex });
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Invalid path format' }) };
  }

  // sessionId is the part before 'participants'
  const sessionId = pathParts[participantsIndex - 1];
  // userId is the part after 'participants'
  const userIdToRemove = pathParts[participantsIndex + 1];

  // Check if current user is admin
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (user.user_role !== 'admin') {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Admin access required' }) };
  }

  // Revoke access using existing permission helper
  await revokeSessionAccess(dbClient, user, userIdToRemove, sessionId);

  console.log(`Participant ${userIdToRemove} removed from session ${sessionId} by admin ${userId}`);

  return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
      success: true,
      message: 'Participant access revoked'
    })
  };
}
