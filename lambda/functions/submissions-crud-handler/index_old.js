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
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (submissionId) {
    // Get specific submission with metadata
    const query = `
      SELECT ds.submission_id, ds.session_id, ds.overlay_id, ds.document_name,
             ds.s3_bucket, ds.s3_key, ds.status, ds.ai_analysis_status,
             ds.submitted_at, ds.ai_analysis_completed_at,
             u.first_name || ' ' || u.last_name as submitted_by_name,
             o.name as overlay_name,
             s.name as session_name
      FROM document_submissions ds
      LEFT JOIN users u ON ds.submitted_by = u.user_id
      LEFT JOIN overlays o ON ds.overlay_id = o.overlay_id
      LEFT JOIN review_sessions s ON ds.session_id = s.session_id
      WHERE ds.submission_id = $1
    `;
    const result = await dbClient.query(query, [submissionId]);

    if (result.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Submission not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
  } else {
    // List user's submissions
    const query = `
      SELECT ds.submission_id, ds.document_name, ds.status, ds.ai_analysis_status,
             ds.submitted_at, o.name as overlay_name, s.name as session_name,
             (SELECT AVG(score) FROM evaluation_responses WHERE submission_id = ds.submission_id) as avg_score
      FROM document_submissions ds
      LEFT JOIN overlays o ON ds.overlay_id = o.overlay_id
      LEFT JOIN review_sessions s ON ds.session_id = s.session_id
      WHERE ds.submitted_by = $1
      ORDER BY ds.submitted_at DESC
    `;
    const result = await dbClient.query(query, [userId]);

    return { statusCode: 200, body: JSON.stringify({ submissions: result.rows, total: result.rows.length }) };
  }
}

async function handleCreate(dbClient, requestBody, userId) {
  const { session_id, overlay_id, document_name, document_content } = JSON.parse(requestBody);

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
      Metadata: {
        submittedBy: userId,
        overlayId: overlay_id,
        uploadedAt: new Date().toISOString(),
      },
    });
    await s3Client.send(putCommand);
    console.log(`Document uploaded to S3: ${s3Key} (${fileSize} bytes)`);
  } catch (s3Error) {
    console.error('S3 upload error:', s3Error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to upload document', details: s3Error.message }) };
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

  // Trigger Step Functions AI workflow
  if (process.env.ORCHESTRATOR_STATE_MACHINE_ARN) {
    try {
      const startCommand = new StartExecutionCommand({
        stateMachineArn: process.env.ORCHESTRATOR_STATE_MACHINE_ARN,
        input: JSON.stringify({
          submissionId: submission.submission_id,
          s3Bucket: s3Bucket,
          s3Key: s3Key,
          overlayId: overlay_id,
        }),
        name: `submission-${submission.submission_id}-${timestamp}`,
      });
      await sfnClient.send(startCommand);
      console.log(`Step Functions workflow triggered for submission: ${submission.submission_id}`);
    } catch (sfnError) {
      console.error('Step Functions trigger error:', sfnError);
      // Don't fail the request, just log the error
    }
  }

  console.log(`Submission created: ${submission.submission_id}`);
  return { statusCode: 201, body: JSON.stringify(submission) };
}

async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
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
    SELECT question_id, question_text, priority, created_at
    FROM clarification_questions
    WHERE submission_id = $1
    ORDER BY priority DESC, created_at
  `;
  const questionsResult = await dbClient.query(questionsQuery, [submissionId]);

  // Get clarification answers
  const answersQuery = `
    SELECT answer_id, question_id, answer_text, answered_by, answered_at
    FROM clarification_answers
    WHERE submission_id = $1
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
