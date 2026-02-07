/**
 * Admin Dashboard Handler
 * Admin-only endpoints for monitoring all submissions and costs
 *
 * Endpoints:
 * - GET /admin/submissions - All submissions with token usage and costs
 * - GET /admin/analytics - Dashboard summary statistics
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { isAdmin } = require('/opt/nodejs/permissions');

// Claude Sonnet 4.5 pricing (per 1K tokens)
const PRICING = {
  INPUT_COST_PER_1K: 0.003,
  OUTPUT_COST_PER_1K: 0.015,
};

exports.handler = async (event) => {
  console.log('Admin Handler:', JSON.stringify(event));

  const { httpMethod, path, queryStringParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Check admin permission
    const userQuery = await dbClient.query(
      'SELECT user_role FROM users WHERE user_id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    if (!isAdmin(userQuery.rows[0])) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    // Route to appropriate handler
    if (httpMethod === 'GET') {
      if (path.includes('/analytics')) {
        return await handleGetAnalytics(dbClient, queryStringParameters);
      } else if (path.includes('/submissions')) {
        return await handleGetSubmissions(dbClient, queryStringParameters);
      }
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (error) {
    console.error('Admin Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

/**
 * GET /admin/submissions
 * Returns all submissions with token usage and costs
 */
async function handleGetSubmissions(dbClient, queryParams) {
  console.log('handleGetSubmissions - Query params:', queryParams);

  // Parse query parameters
  const dateFrom = queryParams?.date_from;
  const dateTo = queryParams?.date_to;
  const sessionId = queryParams?.session_id;
  const submittedBy = queryParams?.user_id;
  const sortBy = queryParams?.sort_by || 'date'; // 'cost', 'date', 'tokens'
  const sortOrder = queryParams?.sort_order || 'desc'; // 'asc', 'desc'
  const limit = Math.min(parseInt(queryParams?.limit || '50'), 500);
  const offset = parseInt(queryParams?.offset || '0');

  // Build WHERE clause
  const whereClauses = ['1=1'];
  const params = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClauses.push(`ds.submitted_at >= $${paramIndex}::TIMESTAMP`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClauses.push(`ds.submitted_at <= $${paramIndex}::TIMESTAMP`);
    params.push(dateTo);
    paramIndex++;
  }

  if (sessionId) {
    whereClauses.push(`ds.session_id = $${paramIndex}`);
    params.push(sessionId);
    paramIndex++;
  }

  if (submittedBy) {
    whereClauses.push(`ds.submitted_by = $${paramIndex}`);
    params.push(submittedBy);
    paramIndex++;
  }

  // Determine sort column
  let orderByColumn;
  switch (sortBy) {
    case 'cost':
      orderByColumn = 'cost_usd';
      break;
    case 'tokens':
      orderByColumn = 'total_tokens';
      break;
    case 'date':
    default:
      orderByColumn = 'ds.submitted_at';
  }

  // Build main query
  const submissionsQuery = `
    SELECT
      ds.submission_id,
      ds.document_name,
      ds.submitted_by,
      u.first_name || ' ' || u.last_name as submitted_by_name,
      u.email as submitted_by_email,
      ds.session_id,
      rs.name as session_name,
      o.name as overlay_name,
      ds.submitted_at,
      ds.ai_analysis_status,
      COALESCE(vtu.total_tokens, 0) as total_tokens,
      COALESCE(vtu.total_input_tokens, 0) as input_tokens,
      COALESCE(vtu.total_output_tokens, 0) as output_tokens,
      COALESCE(vtu.agent_calls, 0) as agent_calls,
      vtu.agents_used,
      ROUND(
        (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
        (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0),
        4
      ) as cost_usd
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    LEFT JOIN review_sessions rs ON ds.session_id = rs.session_id
    LEFT JOIN overlays o ON ds.overlay_id = o.overlay_id
    LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${orderByColumn} ${sortOrder.toUpperCase()}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  console.log('Submissions query:', submissionsQuery);
  console.log('Query params:', params);

  const submissionsResult = await dbClient.query(submissionsQuery, params);

  // Get total count (without limit/offset)
  const countQuery = `
    SELECT COUNT(*) as total
    FROM document_submissions ds
    WHERE ${whereClauses.join(' AND ')}
  `;

  const countResult = await dbClient.query(
    countQuery,
    params.slice(0, params.length - 2) // Remove limit and offset
  );

  const total = parseInt(countResult.rows[0]?.total || '0');

  // Calculate summary statistics
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT ds.submission_id) as total_submissions,
      SUM(COALESCE(vtu.total_tokens, 0)) as total_tokens,
      ROUND(
        SUM(
          (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
          (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
        ),
        2
      ) as total_cost_usd,
      ROUND(
        AVG(COALESCE(vtu.total_tokens, 0))
      ) as avg_tokens_per_submission,
      ROUND(
        AVG(
          (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
          (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
        ),
        4
      ) as avg_cost_per_submission
    FROM document_submissions ds
    LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
    WHERE ${whereClauses.join(' AND ')}
  `;

  const summaryResult = await dbClient.query(
    summaryQuery,
    params.slice(0, params.length - 2)
  );

  const summary = summaryResult.rows[0] || {
    total_submissions: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    avg_tokens_per_submission: 0,
    avg_cost_per_submission: 0,
  };

  return {
    statusCode: 200,
    body: JSON.stringify({
      submissions: submissionsResult.rows,
      total: total,
      limit: limit,
      offset: offset,
      summary: {
        total_submissions: parseInt(summary.total_submissions || '0'),
        total_tokens: parseInt(summary.total_tokens || '0'),
        total_cost_usd: parseFloat(summary.total_cost_usd || '0'),
        avg_tokens_per_submission: parseInt(summary.avg_tokens_per_submission || '0'),
        avg_cost_per_submission: parseFloat(summary.avg_cost_per_submission || '0'),
      },
    }),
  };
}

/**
 * GET /admin/analytics
 * Returns dashboard summary statistics and charts data
 */
async function handleGetAnalytics(dbClient, queryParams) {
  console.log('handleGetAnalytics - Query params:', queryParams);

  const period = queryParams?.period || '30d'; // '7d', '30d', '90d', 'all'

  // Calculate date threshold based on period
  let dateThreshold;
  switch (period) {
    case '7d':
      dateThreshold = "NOW() - INTERVAL '7 days'";
      break;
    case '90d':
      dateThreshold = "NOW() - INTERVAL '90 days'";
      break;
    case 'all':
      dateThreshold = "'1970-01-01'::TIMESTAMP";
      break;
    case '30d':
    default:
      dateThreshold = "NOW() - INTERVAL '30 days'";
  }

  // Overall summary
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT ds.submission_id) as total_submissions,
      SUM(
        (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
        (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
      ) as total_cost_usd,
      SUM(COALESCE(vtu.total_tokens, 0)) as total_tokens,
      AVG(
        (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
        (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
      ) as avg_cost_per_submission,
      COUNT(DISTINCT CASE WHEN ds.ai_analysis_status = 'completed' THEN ds.submission_id END) as completed_submissions,
      COUNT(DISTINCT CASE WHEN ds.ai_analysis_status IN ('pending', 'in_progress') THEN ds.submission_id END) as pending_submissions
    FROM document_submissions ds
    LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
    WHERE ds.submitted_at >= ${dateThreshold}
  `;

  const summaryResult = await dbClient.query(summaryQuery);
  const summary = summaryResult.rows[0];

  // Daily statistics
  const dailyStatsQuery = `
    SELECT
      DATE(ds.submitted_at) as date,
      COUNT(DISTINCT ds.submission_id) as submissions,
      SUM(COALESCE(vtu.total_tokens, 0)) as total_tokens,
      ROUND(
        SUM(
          (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
          (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
        ),
        2
      ) as cost_usd
    FROM document_submissions ds
    LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
    WHERE ds.submitted_at >= ${dateThreshold}
    GROUP BY DATE(ds.submitted_at)
    ORDER BY date DESC
  `;

  const dailyStatsResult = await dbClient.query(dailyStatsQuery);

  // Top users by cost
  const topUsersQuery = `
    SELECT
      u.user_id,
      u.email,
      u.first_name || ' ' || u.last_name as name,
      COUNT(DISTINCT ds.submission_id) as submissions,
      ROUND(
        SUM(
          (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
          (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
        ),
        2
      ) as total_cost_usd
    FROM users u
    INNER JOIN document_submissions ds ON u.user_id = ds.submitted_by
    LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
    WHERE ds.submitted_at >= ${dateThreshold}
    GROUP BY u.user_id, u.email, u.first_name, u.last_name
    ORDER BY total_cost_usd DESC
    LIMIT 10
  `;

  const topUsersResult = await dbClient.query(topUsersQuery);

  // Top sessions by cost
  const topSessionsQuery = `
    SELECT
      rs.session_id,
      rs.name,
      COUNT(DISTINCT ds.submission_id) as submissions,
      ROUND(
        SUM(
          (COALESCE(vtu.total_input_tokens, 0) * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
          (COALESCE(vtu.total_output_tokens, 0) * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
        ),
        2
      ) as total_cost_usd
    FROM review_sessions rs
    INNER JOIN document_submissions ds ON rs.session_id = ds.session_id
    LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
    WHERE ds.submitted_at >= ${dateThreshold}
    GROUP BY rs.session_id, rs.name
    ORDER BY total_cost_usd DESC
    LIMIT 10
  `;

  const topSessionsResult = await dbClient.query(topSessionsQuery);

  // Agent breakdown
  const agentBreakdownQuery = `
    SELECT
      agent_name,
      COUNT(*) as calls,
      ROUND(AVG(total_tokens)) as avg_tokens,
      ROUND(
        SUM(
          (input_tokens * ${PRICING.INPUT_COST_PER_1K} / 1000.0) +
          (output_tokens * ${PRICING.OUTPUT_COST_PER_1K} / 1000.0)
        ),
        2
      ) as total_cost_usd
    FROM token_usage tu
    WHERE tu.created_at >= ${dateThreshold}
    GROUP BY agent_name
    ORDER BY total_cost_usd DESC
  `;

  const agentBreakdownResult = await dbClient.query(agentBreakdownQuery);

  return {
    statusCode: 200,
    body: JSON.stringify({
      summary: {
        total_submissions: parseInt(summary.total_submissions || '0'),
        total_cost_usd: parseFloat(summary.total_cost_usd || '0').toFixed(2),
        total_tokens: parseInt(summary.total_tokens || '0'),
        avg_cost_per_submission: parseFloat(summary.avg_cost_per_submission || '0').toFixed(4),
        completed_submissions: parseInt(summary.completed_submissions || '0'),
        pending_submissions: parseInt(summary.pending_submissions || '0'),
      },
      daily_stats: dailyStatsResult.rows.map(row => ({
        date: row.date,
        submissions: parseInt(row.submissions || '0'),
        total_tokens: parseInt(row.total_tokens || '0'),
        cost_usd: parseFloat(row.cost_usd || '0'),
      })),
      top_users: topUsersResult.rows.map(row => ({
        user_id: row.user_id,
        email: row.email,
        name: row.name,
        submissions: parseInt(row.submissions || '0'),
        total_cost_usd: parseFloat(row.total_cost_usd || '0'),
      })),
      top_sessions: topSessionsResult.rows.map(row => ({
        session_id: row.session_id,
        name: row.name,
        submissions: parseInt(row.submissions || '0'),
        total_cost_usd: parseFloat(row.total_cost_usd || '0'),
      })),
      agent_breakdown: agentBreakdownResult.rows.map(row => ({
        agent_name: row.agent_name,
        calls: parseInt(row.calls || '0'),
        avg_tokens: parseInt(row.avg_tokens || '0'),
        total_cost_usd: parseFloat(row.total_cost_usd || '0'),
      })),
    }),
  };
}
