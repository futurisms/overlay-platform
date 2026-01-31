/**
 * Submissions CRUD Handler
 * Document submission management with S3 upload and AI workflow integration
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log('Submissions Handler:', JSON.stringify(event));

  const { httpMethod, path, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Handle special routes
    if (path.includes('/analysis')) {
      return await handleGetAnalysis(dbClient, pathParameters, userId);
    }
    if (path.includes('/feedback')) {
      return await handleGetFeedback(dbClient, pathParameters, userId);
    }
    if (path.includes('/download')) {
      return await handleDownload(dbClient, pathParameters, userId);
    }

    // Standard CRUD routes
    switch (httpMethod) {
      case 'GET':
        return await handleGet(dbClient, pathParameters, userId);
      case 'POST':
        return await handleCreate(dbClient, requestBody, userId);
      case 'PUT':
        return await handleUpdate(dbClient, pathParameters, userId, requestBody);
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
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (submissionId) {
    // Get specific submission
    const query = `
      SELECT s.submission_id, s.overlay_id, s.session_id, s.document_name,
             s.file_size, s.content_type, s.status, s.ai_analysis_status,
             s.submitted_at, s.ai_analysis_completed_at, s.submitted_by,
             u.first_name || ' ' || u.last_name as submitted_by_name,
             o.name as overlay_name
      FROM document_submissions s
      LEFT JOIN users u ON s.submitted_by = u.user_id
      LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
      WHERE s.submission_id = $1
    `;
    const result = await dbClient.query(query, [submissionId]);

    if (result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
  } else {
    // List user's submissions
    const query = `
      SELECT s.submission_id, s.document_name, s.status, s.ai_analysis_status,
             s.submitted_at, s.file_size,
             o.name as overlay_name,
             rs.name as session_name
      FROM document_submissions s
      LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
      LEFT JOIN review_sessions rs ON s.session_id = rs.session_id
      WHERE s.submitted_by = $1
      ORDER BY s.submitted_at DESC
    `;
    const result = await dbClient.query(query, [userId]);

    return { statusCode: 200, body: JSON.stringify({ submissions: result.rows, total: result.rows.length }) };
  }
}

async function handleCreate(dbClient, requestBody, userId) {
  const { overlay_id, session_id, document_name, document_content } = JSON.parse(requestBody);

  if (!overlay_id || !document_name || !document_content) {
    return { statusCode: 400, body: JSON.stringify({ error: 'overlay_id, document_name, and document_content required' }) };
  }

  // Upload document to S3
  const timestamp = Date.now();
  const s3Key = `submissions/${userId}/${timestamp}-${document_name}`;
  const s3Bucket = process.env.DOCUMENT_BUCKET || process.env.DOCUMENTS_BUCKET;
  const documentBuffer = Buffer.from(document_content, 'base64');
  const fileSize = documentBuffer.length;

  try {
    const putCommand = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: documentBuffer,
      ContentType: 'application/pdf',
    });
    await s3Client.send(putCommand);
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to upload document', details: error.message }),
    };
  }

  // Create submission record
  const submissionQuery = `
    INSERT INTO document_submissions
    (session_id, overlay_id, document_name, s3_bucket, s3_key, file_size, content_type, submitted_by, status, ai_analysis_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted', 'pending')
    RETURNING submission_id, document_name, status, ai_analysis_status, submitted_at
  `;
  const submissionResult = await dbClient.query(submissionQuery, [
    session_id || null,
    overlay_id,
    document_name,
    s3Bucket,
    s3Key,
    fileSize,
    'application/pdf',
    userId,
  ]);

  const submission = submissionResult.rows[0];

  // Trigger AI workflow (Step Functions)
  if (process.env.WORKFLOW_STATE_MACHINE_ARN) {
    try {
      const startCommand = new StartExecutionCommand({
        stateMachineArn: process.env.WORKFLOW_STATE_MACHINE_ARN,
        input: JSON.stringify({
          documentId: submission.submission_id, // State machine expects documentId
          submissionId: submission.submission_id, // Also pass submissionId for compatibility
          s3Bucket: s3Bucket,
          s3Key: s3Key,
          overlayId: overlay_id,
          uploadedAt: new Date().toISOString(),
        }),
      });
      await sfnClient.send(startCommand);
      console.log(`Started AI workflow for submission ${submission.submission_id}`);
    } catch (error) {
      console.error('Failed to start workflow:', error);
      // Don't fail the request if workflow fails
    }
  }

  console.log(`Submission created: ${submission.submission_id}`);
  return { statusCode: 201, body: JSON.stringify(submission) };
}

async function handleUpdate(dbClient, pathParameters, userId, requestBody) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;
  if (!submissionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  const { status, ai_analysis_status } = JSON.parse(requestBody);

  const query = `
    UPDATE document_submissions
    SET status = COALESCE($2, status),
        ai_analysis_status = COALESCE($3, ai_analysis_status),
        ai_analysis_completed_at = CASE
          WHEN $3 = 'completed' THEN CURRENT_TIMESTAMP
          ELSE ai_analysis_completed_at
        END
    WHERE submission_id = $1
    RETURNING submission_id, document_name, status, ai_analysis_status
  `;
  const result = await dbClient.query(query, [submissionId, status || null, ai_analysis_status || null]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;
  if (!submissionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Hard delete for submissions (could be soft delete if preferred)
  const query = `
    DELETE FROM document_submissions
    WHERE submission_id = $1
    RETURNING submission_id
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Submission deleted', submission_id: submissionId }) };
}

async function handleGetAnalysis(dbClient, pathParameters, userId) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  // Get submission status first
  const submissionQuery = `
    SELECT submission_id, ai_analysis_status, ai_analysis_completed_at
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const submissionResult = await dbClient.query(submissionQuery, [submissionId]);

  if (submissionResult.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = submissionResult.rows[0];

  // If analysis is not complete, return status
  if (submission.ai_analysis_status !== 'completed') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: submission.ai_analysis_status,
        message: 'Analysis in progress',
        submission_id: submissionId,
      }),
    };
  }

  // Get all AI agent results
  const agentResultsQuery = `
    SELECT agent_name, result_data, status, execution_time_ms, created_at
    FROM ai_agent_results
    WHERE submission_id = $1
    ORDER BY created_at
  `;
  const agentResults = await dbClient.query(agentResultsQuery, [submissionId]);

  // Get clarification questions
  const questionsQuery = `
    SELECT question_id, question_text, question_type, priority, status
    FROM clarification_questions
    WHERE submission_id = $1
    ORDER BY priority DESC, created_at
  `;
  const questionsResult = await dbClient.query(questionsQuery, [submissionId]);

  // Get answers
  const answersQuery = `
    SELECT a.answer_id, a.question_id, a.answer_text, a.answered_at,
           u.first_name || ' ' || u.last_name as answered_by_name
    FROM clarification_answers a
    LEFT JOIN users u ON a.answered_by = u.user_id
    WHERE a.submission_id = $1
  `;
  const answersResult = await dbClient.query(answersQuery, [submissionId]);

  // Aggregate results by agent
  const analysis = {
    submission_id: submissionId,
    status: submission.ai_analysis_status,
    completed_at: submission.ai_analysis_completed_at,
    agents: {},
    questions: questionsResult.rows,
    answers: answersResult.rows,
  };

  agentResults.rows.forEach(row => {
    analysis.agents[row.agent_name] = {
      result: row.result_data,
      status: row.status,
      execution_time_ms: row.execution_time_ms,
      timestamp: row.created_at,
    };
  });

  // Extract specific agent data for easier access
  analysis.structure = analysis.agents['structure-validator']?.result;
  analysis.content = analysis.agents['content-analyzer']?.result;
  analysis.grammar = analysis.agents['grammar-checker']?.result;
  analysis.scoring = analysis.agents['scoring']?.result;
  analysis.clarification = analysis.agents['clarification']?.result;

  return { statusCode: 200, body: JSON.stringify(analysis) };
}

async function handleGetFeedback(dbClient, pathParameters, userId) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (!submissionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Get AI analysis results from feedback_reports table
  const scoringQuery = `
    SELECT report_id, title, content, created_at
    FROM feedback_reports
    WHERE submission_id = $1 AND report_type = 'comment'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const scoringResult = await dbClient.query(scoringQuery, [submissionId]);

  if (scoringResult.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: 'Feedback not found',
        message: 'Analysis may not be complete or no feedback has been generated yet'
      })
    };
  }

  // Parse the JSON content from feedback_reports
  const feedbackContent = typeof scoringResult.rows[0].content === 'string'
    ? JSON.parse(scoringResult.rows[0].content)
    : scoringResult.rows[0].content;

  const scoringData = {
    overall_score: feedbackContent.scores?.average || feedbackContent.scores?.finalScore || null,
    strengths: feedbackContent.strengths || [],
    weaknesses: feedbackContent.weaknesses || [],
    recommendations: feedbackContent.recommendations || [],
    detailed_feedback: feedbackContent.summary || ''
  };

  // Get evaluation responses (criterion scores)
  const scoresQuery = `
    SELECT
      er.response_id,
      er.criteria_id as criterion_id,
      ec.name as criterion_name,
      ec.description as criterion_description,
      ec.criterion_type,
      ec.weight,
      er.response_value,
      er.score,
      er.created_at
    FROM evaluation_responses er
    JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
    WHERE er.submission_id = $1
    ORDER BY ec.display_order, ec.name
  `;
  const scoresResult = await dbClient.query(scoresQuery, [submissionId]);

  // Build complete feedback response
  const completeFeedback = {
    submission_id: submissionId,
    overall_score: scoringData?.overall_score || null,
    strengths: scoringData?.strengths || [],
    weaknesses: scoringData?.weaknesses || [],
    recommendations: scoringData?.recommendations || [],
    detailed_feedback: scoringData?.detailed_feedback || '',
    criterion_scores: scoresResult.rows.map(row => ({
      criterion_id: row.criterion_id,
      criterion_name: row.criterion_name,
      criterion_description: row.criterion_description,
      criterion_type: row.criterion_type,
      weight: row.weight,
      response_value: row.response_value,
      score: row.score,
      evaluated_at: row.created_at
    })),
    generated_at: scoringResult.rows[0].created_at,
    generated_by: 'scoring'
  };

  return { statusCode: 200, body: JSON.stringify(completeFeedback) };
}

async function handleDownload(dbClient, pathParameters, userId) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (!submissionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Get submission metadata
  const query = `
    SELECT
      ds.submission_id,
      ds.document_name,
      ds.submitted_at,
      u.first_name || ' ' || u.last_name as submitted_by_name,
      u.email as submitted_by_email,
      o.name as overlay_name
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    LEFT JOIN overlays o ON ds.overlay_id = o.overlay_id
    WHERE ds.submission_id = $1
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const data = result.rows[0];

  // Get AI analysis results from feedback_reports table
  const scoringQuery = `
    SELECT report_id, title, content, created_at
    FROM feedback_reports
    WHERE submission_id = $1 AND report_type = 'comment'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const scoringResult = await dbClient.query(scoringQuery, [submissionId]);

  if (scoringResult.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: 'Feedback not found',
        message: 'Analysis may not be complete or no feedback has been generated yet'
      })
    };
  }

  // Parse the JSON content from feedback_reports
  const feedbackContent = typeof scoringResult.rows[0].content === 'string'
    ? JSON.parse(scoringResult.rows[0].content)
    : scoringResult.rows[0].content;

  const scoringData = {
    overall_score: feedbackContent.scores?.average || feedbackContent.scores?.finalScore || null,
    strengths: feedbackContent.strengths || [],
    weaknesses: feedbackContent.weaknesses || [],
    recommendations: feedbackContent.recommendations || [],
    detailed_feedback: feedbackContent.summary || ''
  };

  // Get criterion scores
  const scoresQuery = `
    SELECT
      ec.name as criterion_name,
      ec.weight,
      er.score,
      er.feedback
    FROM evaluation_responses er
    JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
    WHERE er.submission_id = $1
    ORDER BY ec.display_order
  `;
  const scoresResult = await dbClient.query(scoresQuery, [submissionId]);

  // Return structured data for frontend PDF generation
  const downloadData = {
    submission_id: submissionId,
    document_name: data.document_name,
    overlay_name: data.overlay_name,
    submitted_by: data.submitted_by_name,
    submitted_by_email: data.submitted_by_email,
    submitted_at: data.submitted_at,
    overall_score: scoringData?.overall_score || null,
    strengths: scoringData?.strengths || [],
    weaknesses: scoringData?.weaknesses || [],
    recommendations: scoringData?.recommendations || [],
    detailed_feedback: scoringData?.detailed_feedback || '',
    criterion_scores: scoresResult.rows,
    generated_at: scoringResult.rows[0].completed_at
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="feedback-${submissionId}.json"`
    },
    body: JSON.stringify(downloadData)
  };
}
