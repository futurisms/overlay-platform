/**
 * Submissions CRUD Handler
 * Document submission management with S3 upload and AI workflow integration
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');
const { getCorsHeaders } = require('/opt/nodejs/cors');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const { canViewSubmission } = require('/opt/nodejs/permissions');

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
    if (path.includes('/content')) {
      return await handleGetContent(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/analysis')) {
      return await handleGetAnalysis(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/feedback')) {
      return await handleGetFeedback(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/download-appendix')) {
      return await handleDownloadAppendix(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/download-file')) {
      return await handleDownloadFile(dbClient, pathParameters, userId, event);
    }
    if (path.includes('/download')) {
      return await handleDownload(dbClient, pathParameters, userId, event);
    }

    // Standard CRUD routes
    switch (httpMethod) {
      case 'GET':
        return await handleGet(dbClient, pathParameters, userId, event);
      case 'POST':
        return await handleCreate(dbClient, requestBody, userId, event);
      case 'PUT':
        return await handleUpdate(dbClient, pathParameters, userId, requestBody, event);
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
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (submissionId) {
    // Get specific submission
    const query = `
      SELECT s.submission_id, s.overlay_id, s.session_id, s.document_name,
             s.file_size, s.content_type, s.status, s.ai_analysis_status,
             s.submitted_at, s.ai_analysis_completed_at, s.submitted_by,
             s.s3_key, s.s3_bucket, s.appendix_files,
             u.first_name || ' ' || u.last_name as submitted_by_name,
             o.name as overlay_name
      FROM document_submissions s
      LEFT JOIN users u ON s.submitted_by = u.user_id
      LEFT JOIN overlays o ON s.overlay_id = o.overlay_id
      WHERE s.submission_id = $1
    `;
    const result = await dbClient.query(query, [submissionId]);

    if (result.rows.length === 0) {
      return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
    }

    const submission = result.rows[0];

    // Check if user has permission to view this submission
    const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
    const user = userQuery.rows[0];

    if (!user) {
      return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
    }

    if (!canViewSubmission(user, submission)) {
      return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only view your own submissions' }) };
    }

    // Ensure appendix_files is always an array (backward compatibility)
    submission.appendix_files = submission.appendix_files || [];

    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(submission) };
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

    return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ submissions: result.rows, total: result.rows.length }) };
  }
}

/**
 * Get submission content (main document + appendices text)
 * GET /submissions/{id}/content
 */
async function handleGetContent(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Get submission metadata
  const query = `
    SELECT s.submission_id, s.document_name, s.s3_bucket, s.s3_key, s.appendix_files, s.submitted_by
    FROM document_submissions s
    WHERE s.submission_id = $1
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = result.rows[0];

  // Check if user has permission to view this submission
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only view your own submissions' }) };
  }
  const { document_name, s3_bucket, s3_key, appendix_files } = submission;

  try {
    // Import S3 utilities
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({ region: process.env.AWS_REGION });

    // Helper function to extract text from S3
    const getTextFromS3 = async (bucket, key) => {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3Client.send(command);
      const stream = response.Body;

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Detect file type and extract text
      const fileExtension = key.split('.').pop().toLowerCase();

      if (fileExtension === 'docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } else if (fileExtension === 'pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text;
      } else {
        return buffer.toString('utf-8');
      }
    };

    // 1. Get main document content
    console.log(`[Content] Fetching main document: ${s3_key}`);
    const mainDocumentText = await getTextFromS3(s3_bucket, s3_key);
    console.log(`[Content] Main document extracted: ${mainDocumentText.length} characters`);

    // 2. Get appendices content
    const appendicesArray = appendix_files || [];
    const appendicesContent = [];

    if (appendicesArray.length > 0) {
      console.log(`[Content] Fetching ${appendicesArray.length} appendices`);

      for (const appendix of appendicesArray) {
        try {
          const appendixText = await getTextFromS3(s3_bucket, appendix.s3_key);
          console.log(`[Content] Appendix ${appendix.upload_order} extracted: ${appendixText.length} characters`);

          appendicesContent.push({
            fileName: appendix.file_name,
            text: appendixText,
            uploadOrder: appendix.upload_order,
          });
        } catch (error) {
          console.error(`[Content] Error extracting appendix ${appendix.upload_order}:`, error);
          appendicesContent.push({
            fileName: appendix.file_name,
            text: '',
            uploadOrder: appendix.upload_order,
            error: 'Failed to extract content',
          });
        }
      }

      // Sort by upload order
      appendicesContent.sort((a, b) => a.uploadOrder - b.uploadOrder);
    }

    // Return structured response
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        submission_id: submissionId,
        main_document: {
          name: document_name,
          text: mainDocumentText,
        },
        appendices: appendicesContent,
      }),
    };

  } catch (error) {
    console.error('[Content] Error fetching content:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Failed to fetch submission content', details: error.message }),
    };
  }
}

async function handleCreate(dbClient, requestBody, userId, event) {
  const { overlay_id, session_id, document_name, document_content, is_pasted_text, appendices } = JSON.parse(requestBody);

  if (!overlay_id || !document_name || !document_content) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'overlay_id, document_name, and document_content required' }) };
  }

  // Validate appendices structure if provided (frontend sends base64 content)
  const appendicesArray = appendices || [];
  if (appendicesArray.length > 0) {
    for (const appendix of appendicesArray) {
      if (!appendix.file_name || !appendix.file_content || !appendix.file_size || typeof appendix.upload_order !== 'number') {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Invalid appendix structure. Required: file_name, file_content (base64), file_size, upload_order' }) };
      }
      // Validate PDF format
      if (!appendix.file_name.toLowerCase().endsWith('.pdf')) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: `Appendix "${appendix.file_name}" must be a PDF file` }) };
      }
      // Validate max size (5MB)
      if (appendix.file_size > 5 * 1024 * 1024) {
        return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: `Appendix "${appendix.file_name}" exceeds 5MB limit` }) };
      }
    }
    console.log(`Creating submission with ${appendicesArray.length} appendices`);
  }

  // Upload main document to S3
  const timestamp = Date.now();
  const s3Key = `submissions/${userId}/${timestamp}-${document_name}`;
  const s3Bucket = process.env.DOCUMENT_BUCKET || process.env.DOCUMENTS_BUCKET;
  const documentBuffer = Buffer.from(document_content, 'base64');
  const fileSize = documentBuffer.length;

  // Determine content type based on whether this is pasted text or uploaded file
  let contentType = 'application/pdf'; // Default
  if (is_pasted_text) {
    contentType = 'text/plain';
  } else if (document_name.toLowerCase().endsWith('.docx')) {
    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (document_name.toLowerCase().endsWith('.doc')) {
    contentType = 'application/msword';
  } else if (document_name.toLowerCase().endsWith('.txt')) {
    contentType = 'text/plain';
  }

  console.log(`Uploading ${is_pasted_text ? 'pasted text' : 'file'} to S3: ${s3Key} (${fileSize} bytes, ${contentType})`);

  try {
    const putCommand = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: documentBuffer,
      ContentType: contentType,
    });
    await s3Client.send(putCommand);
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Failed to upload document', details: error.message }),
    };
  }

  // Upload appendices to S3 if provided
  const appendixMetadata = [];
  if (appendicesArray.length > 0) {
    console.log(`Uploading ${appendicesArray.length} appendices to S3...`);

    // Create a submission ID folder for appendices (use timestamp-based unique ID)
    const submissionFolder = `submissions/${userId}/${timestamp}`;

    for (const appendix of appendicesArray) {
      const appendixS3Key = `${submissionFolder}/appendix-${appendix.upload_order}.pdf`;
      const appendixBuffer = Buffer.from(appendix.file_content, 'base64');

      try {
        const appendixPutCommand = new PutObjectCommand({
          Bucket: s3Bucket,
          Key: appendixS3Key,
          Body: appendixBuffer,
          ContentType: 'application/pdf',
        });
        await s3Client.send(appendixPutCommand);

        // Store metadata for database
        appendixMetadata.push({
          file_name: appendix.file_name,
          s3_key: appendixS3Key,
          file_size: appendix.file_size,
          upload_order: appendix.upload_order,
        });

        console.log(`Uploaded appendix ${appendix.upload_order}: ${appendixS3Key}`);
      } catch (error) {
        console.error(`Failed to upload appendix ${appendix.upload_order}:`, error);
        return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: `Failed to upload appendix "${appendix.file_name}"`, details: error.message }),
        };
      }
    }
    console.log(`All ${appendixMetadata.length} appendices uploaded successfully`);
  }

  // Create submission record
  const submissionQuery = `
    INSERT INTO document_submissions
    (session_id, overlay_id, document_name, s3_bucket, s3_key, file_size, content_type, submitted_by, status, ai_analysis_status, appendix_files)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted', 'pending', $9)
    RETURNING submission_id, document_name, status, ai_analysis_status, submitted_at, appendix_files
  `;
  const submissionResult = await dbClient.query(submissionQuery, [
    session_id || null,
    overlay_id,
    document_name,
    s3Bucket,
    s3Key,
    fileSize,
    contentType,
    userId,
    JSON.stringify(appendixMetadata),
  ]);

  const submission = submissionResult.rows[0];

  // Trigger AI workflow (Step Functions)
  if (process.env.WORKFLOW_STATE_MACHINE_ARN) {
    try {
      const startCommand = new StartExecutionCommand({
        stateMachineArn: process.env.WORKFLOW_STATE_MACHINE_ARN,
        input: JSON.stringify({
          documentId: submission.submission_id,  // Required by Step Functions state machine
          submissionId: submission.submission_id,
          s3Bucket: s3Bucket,
          s3Key: s3Key,
          overlayId: overlay_id,
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
  return { statusCode: 201, headers: getCorsHeaders(event), body: JSON.stringify(submission) };
}

async function handleUpdate(dbClient, pathParameters, userId, requestBody, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;
  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Check if user has permission to update this submission
  const checkQuery = `
    SELECT submission_id, submitted_by
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const checkResult = await dbClient.query(checkQuery, [submissionId]);

  if (checkResult.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = checkResult.rows[0];

  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only update your own submissions' }) };
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
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(result.rows[0]) };
}

async function handleDelete(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;
  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Check if user has permission to delete this submission
  const checkQuery = `
    SELECT submission_id, submitted_by
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const checkResult = await dbClient.query(checkQuery, [submissionId]);

  if (checkResult.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = checkResult.rows[0];

  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only delete your own submissions' }) };
  }

  // Hard delete for submissions (could be soft delete if preferred)
  const query = `
    DELETE FROM document_submissions
    WHERE submission_id = $1
    RETURNING submission_id
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify({ message: 'Submission deleted', submission_id: submissionId }) };
}

async function handleGetAnalysis(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  // Get submission status first
  const submissionQuery = `
    SELECT submission_id, ai_analysis_status, ai_analysis_completed_at, submitted_by
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const submissionResult = await dbClient.query(submissionQuery, [submissionId]);

  if (submissionResult.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = submissionResult.rows[0];

  // Check if user has permission to view this submission
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only view your own submissions' }) };
  }

  // If analysis is not complete, return status
  if (submission.ai_analysis_status !== 'completed') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
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

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(analysis) };
}

async function handleGetFeedback(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Check if user has permission to view this submission
  const submissionQuery = `
    SELECT submission_id, submitted_by
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const submissionResult = await dbClient.query(submissionQuery, [submissionId]);

  if (submissionResult.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = submissionResult.rows[0];

  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only view your own submissions' }) };
  }

  // Get AI analysis results (scoring agent saves to feedback_reports)
  const scoringQuery = `
    SELECT report_id, content, title, severity, created_at
    FROM feedback_reports
    WHERE submission_id = $1 AND report_type = 'comment'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const scoringResult = await dbClient.query(scoringQuery, [submissionId]);

  if (scoringResult.rows.length === 0) {
    return {
      statusCode: 404,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Feedback not found',
        message: 'Analysis may not be complete or no feedback has been generated yet'
      })
    };
  }

  // Parse the JSON content from feedback_reports
  const feedbackContent = JSON.parse(scoringResult.rows[0].content);
  const scoringData = {
    overall_score: feedbackContent.scores?.average || feedbackContent.overall_score || null,
    strengths: feedbackContent.strengths || [],
    weaknesses: feedbackContent.weaknesses || [],
    recommendations: feedbackContent.recommendations || [],
    detailed_feedback: feedbackContent.summary || feedbackContent.detailed_feedback || '',
  };

  // Get evaluation responses (criterion scores)
  const scoresQuery = `
    SELECT
      er.response_id,
      er.criteria_id,
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
      criterion_id: row.criteria_id,
      criterion_name: row.criterion_name,
      criterion_description: row.criterion_description,
      criterion_type: row.criterion_type,
      weight: row.weight,
      response_value: row.response_value,
      score: row.score,
      evaluated_at: row.created_at
    })),
    generated_at: scoringResult.rows[0].created_at,
    generated_by: 'ai-scoring-agent'
  };

  return { statusCode: 200, headers: getCorsHeaders(event), body: JSON.stringify(completeFeedback) };
}

async function handleDownloadFile(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Get submission S3 details
  const query = `
    SELECT s3_bucket, s3_key, document_name, submitted_by
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = result.rows[0];

  // Check if user has permission to view this submission
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only download your own submissions' }) };
  }

  const { s3_bucket, s3_key, document_name } = submission;

  // Generate presigned URL (valid for 15 minutes)
  const command = new GetObjectCommand({
    Bucket: s3_bucket,
    Key: s3_key,
    ResponseContentDisposition: `attachment; filename="${document_name}"`,
  });

  try {
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        download_url: presignedUrl,
        file_name: document_name,
        expires_in: 900
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Failed to generate download URL' }) };
  }
}

async function handleDownloadAppendix(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;
  const appendixOrder = pathParameters?.order;

  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  if (!appendixOrder) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Appendix order required' }) };
  }

  // Get submission S3 bucket and appendix files
  const query = `
    SELECT s3_bucket, appendix_files, submitted_by
    FROM document_submissions
    WHERE submission_id = $1
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const submission = result.rows[0];

  // Check if user has permission to view this submission
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, submission)) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only download your own submissions' }) };
  }

  const { s3_bucket, appendix_files } = submission;
  const appendices = appendix_files || [];

  // Find appendix by order
  const appendix = appendices.find(a => a.upload_order === parseInt(appendixOrder));

  if (!appendix) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Appendix not found' }) };
  }

  // Generate presigned URL (valid for 15 minutes)
  const command = new GetObjectCommand({
    Bucket: s3_bucket,
    Key: appendix.s3_key,
    ResponseContentDisposition: `attachment; filename="${appendix.file_name}"`,
  });

  try {
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        download_url: presignedUrl,
        file_name: appendix.file_name,
        expires_in: 900
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return { statusCode: 500, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Failed to generate download URL' }) };
  }
}

async function handleDownload(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.submissionId || pathParameters?.id;

  if (!submissionId) {
    return { statusCode: 400, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission ID required' }) };
  }

  // Get submission and feedback data
  const query = `
    SELECT
      ds.submission_id,
      ds.document_name,
      ds.submitted_at,
      ds.submitted_by,
      u.first_name || ' ' || u.last_name as submitted_by_name,
      u.email as submitted_by_email,
      o.name as overlay_name,
      fr.overall_score,
      fr.strengths,
      fr.weaknesses,
      fr.recommendations,
      fr.detailed_feedback
    FROM document_submissions ds
    LEFT JOIN users u ON ds.submitted_by = u.user_id
    LEFT JOIN overlays o ON ds.overlay_id = o.overlay_id
    LEFT JOIN feedback_reports fr ON ds.submission_id = fr.submission_id
    WHERE ds.submission_id = $1
  `;
  const result = await dbClient.query(query, [submissionId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Submission not found' }) };
  }

  const data = result.rows[0];

  // Check if user has permission to view this submission
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return { statusCode: 404, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'User not found' }) };
  }

  if (!canViewSubmission(user, { submitted_by: data.submitted_by })) {
    return { statusCode: 403, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Forbidden: You can only download your own submissions' }) };
  }

  // Get criterion scores
  const scoresQuery = `
    SELECT
      ec.name as criterion_name,
      ec.weight,
      er.score,
      er.feedback
    FROM evaluation_responses er
    JOIN evaluation_criteria ec ON er.criterion_id = ec.criteria_id
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
    overall_score: data.overall_score,
    strengths: data.strengths || [],
    weaknesses: data.weaknesses || [],
    recommendations: data.recommendations || [],
    detailed_feedback: data.detailed_feedback,
    criterion_scores: scoresResult.rows,
    generated_at: new Date().toISOString()
  };

  return {
    statusCode: 200,
    headers: {
        ...getCorsHeaders(event),
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="feedback-${submissionId
      }.json"`
    },
    body: JSON.stringify(downloadData)
  };
}
