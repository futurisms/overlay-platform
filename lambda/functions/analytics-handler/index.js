/**
 * Analytics Handler
 * Platform analytics and reporting with organization scoping
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { getCorsHeaders } = require('/opt/nodejs/cors');

exports.handler = async (event) => {
  console.log('Analytics Handler:', JSON.stringify(event));

  const { httpMethod, path, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    if (httpMethod !== 'GET') {
      return { statusCode: 405, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Route based on path
    if (path.includes('/overview')) {
      return await handleOverview(dbClient, userId, event);
    }
    if (path.includes('/submissions')) {
      return await handleSubmissionsAnalytics(dbClient, userId, event);
    }
    if (path.includes('/users')) {
      return await handleUsersAnalytics(dbClient, userId, event);
    }

    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Analytics endpoint not found' }) };
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: error.message }) };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

async function handleOverview(dbClient, userId, event) {
  // Dashboard summary metrics scoped to user's organization
  const query = `
    SELECT
      (SELECT COUNT(*) FROM document_submissions ds
       JOIN users u ON ds.submitted_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)) as total_submissions,
      (SELECT COUNT(*) FROM review_sessions rs
       JOIN users u ON rs.created_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)) as total_sessions,
      (SELECT COUNT(*) FROM users u
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
         AND u.is_active = true) as total_users,
      (SELECT COUNT(*) FROM overlays o
       JOIN users u ON o.created_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
         AND o.is_active = true) as total_overlays,
      (SELECT AVG(score) FROM evaluation_responses er
       JOIN document_submissions ds ON er.submission_id = ds.submission_id
       JOIN users u ON ds.submitted_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)) as avg_score,
      (SELECT COUNT(*) FROM document_submissions ds
       JOIN users u ON ds.submitted_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
         AND ds.ai_analysis_status = 'completed') as completed_analyses,
      (SELECT COUNT(*) FROM document_submissions ds
       JOIN users u ON ds.submitted_by = u.user_id
       WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
         AND ds.ai_analysis_status = 'pending') as pending_analyses
  `;
  const result = await dbClient.query(query, [userId]);

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(result.rows[0]) };
}

async function handleSubmissionsAnalytics(dbClient, userId, event) {
  // Submission statistics over time
  const query = `
    SELECT
      DATE(ds.submitted_at) as date,
      COUNT(*) as submission_count,
      COUNT(CASE WHEN ds.ai_analysis_status = 'completed' THEN 1 END) as completed_count,
      AVG(er.score) as avg_score
    FROM document_submissions ds
    LEFT JOIN evaluation_responses er ON ds.submission_id = er.submission_id
    JOIN users u ON ds.submitted_by = u.user_id
    WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
      AND ds.submitted_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(ds.submitted_at)
    ORDER BY DATE(ds.submitted_at) DESC
  `;
  const result = await dbClient.query(query, [userId]);

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ daily_stats: result.rows, total: result.rows.length }) };
}

async function handleUsersAnalytics(dbClient, userId, event) {
  // User activity metrics
  const query = `
    SELECT
      u.user_id,
      u.first_name || ' ' || u.last_name as user_name,
      u.email,
      COALESCE(
        json_agg(DISTINCT ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL),
        '[]'
      ) as roles,
      COUNT(DISTINCT ds.submission_id) as submission_count,
      COUNT(DISTINCT rs.session_id) as session_count,
      COUNT(DISTINCT er.response_id) as review_count,
      MAX(ds.submitted_at) as last_submission_date,
      AVG(er.score) as avg_score_given
    FROM users u
    LEFT JOIN user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN document_submissions ds ON u.user_id = ds.submitted_by
    LEFT JOIN review_sessions rs ON u.user_id = rs.created_by
    LEFT JOIN evaluation_responses er ON u.user_id = er.reviewed_by
    WHERE u.organization_id = (SELECT organization_id FROM users WHERE user_id = $1)
      AND u.is_active = true
    GROUP BY u.user_id, u.first_name, u.last_name, u.email
    ORDER BY submission_count DESC, review_count DESC
  `;
  const result = await dbClient.query(query, [userId]);

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ user_stats: result.rows, total: result.rows.length }) };
}
