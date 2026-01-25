/**
 * Database Utilities
 * Helper functions for Aurora PostgreSQL operations
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });
let dbCredentials = null;

/**
 * Get Aurora credentials from Secrets Manager
 */
async function getAuroraCredentials() {
  if (dbCredentials) {
    return dbCredentials;
  }

  const command = new GetSecretValueCommand({
    SecretId: process.env.AURORA_SECRET_ARN,
  });

  const response = await secretsManager.send(command);
  dbCredentials = JSON.parse(response.SecretString);
  return dbCredentials;
}

/**
 * Create database connection
 */
async function createDbConnection() {
  const credentials = await getAuroraCredentials();

  const client = new Client({
    host: credentials.host,
    port: credentials.port,
    database: credentials.dbname,
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  return client;
}

/**
 * Get overlay by ID
 */
async function getOverlayById(client, overlayId) {
  const query = `
    SELECT
      overlay_id,
      name,
      description,
      document_type,
      configuration,
      created_by,
      created_at,
      updated_at,
      is_active,
      document_purpose,
      when_used,
      process_context,
      target_audience
    FROM overlays
    WHERE overlay_id = $1 AND is_active = true
  `;

  const result = await client.query(query, [overlayId]);
  const overlay = result.rows[0] || null;

  // Parse configuration JSONB for easier access
  if (overlay && overlay.configuration) {
    overlay.structure_template = overlay.configuration.structure_template || {};
  }

  return overlay;
}

/**
 * Get evaluation criteria for an overlay
 */
async function getEvaluationCriteria(client, overlayId) {
  const query = `
    SELECT
      criteria_id AS criterion_id,
      overlay_id,
      name,
      description,
      criterion_type,
      weight,
      is_required,
      display_order,
      validation_rules
    FROM evaluation_criteria
    WHERE overlay_id = $1
    ORDER BY display_order, name
  `;

  const result = await client.query(query, [overlayId]);

  // Add default values for fields used by AI agents
  return result.rows.map(row => ({
    ...row,
    category: row.criterion_type || 'general',
    max_score: 100, // Default max score
    evaluation_method: 'ai_analysis',
  }));
}

/**
 * Get best practice examples for an overlay
 * Note: This table doesn't exist in the schema yet, returning empty array
 */
async function getBestPracticeExamples(client, overlayId) {
  // TODO: Implement when best_practice_examples table is added to schema
  return [];
}

/**
 * Create document submission record
 */
async function createDocumentSubmission(client, submissionData) {
  const {
    overlayId,
    submittedBy,
    documentName,
    s3Key,
    s3Bucket,
    fileSize,
    contentType,
  } = submissionData;

  const query = `
    INSERT INTO document_submissions (
      overlay_id,
      submitted_by,
      document_name,
      s3_key,
      s3_bucket,
      file_size,
      content_type,
      status,
      ai_analysis_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted', 'pending')
    RETURNING submission_id, submitted_at
  `;

  const result = await client.query(query, [
    overlayId,
    submittedBy,
    documentName,
    s3Key,
    s3Bucket,
    fileSize,
    contentType,
  ]);

  return result.rows[0];
}

/**
 * Update submission status
 */
async function updateSubmissionStatus(client, submissionId, status, aiAnalysisStatus = null) {
  console.log(`[updateSubmissionStatus] Updating submission ${submissionId}: status=${status}, aiAnalysisStatus=${aiAnalysisStatus}`);

  const query = `
    UPDATE document_submissions
    SET
      status = $2,
      ai_analysis_status = COALESCE($3, ai_analysis_status),
      ai_analysis_completed_at = CASE
        WHEN $3 = 'completed' THEN CURRENT_TIMESTAMP
        ELSE ai_analysis_completed_at
      END
    WHERE submission_id = $1
    RETURNING submission_id, status, ai_analysis_status
  `;

  const result = await client.query(query, [submissionId, status, aiAnalysisStatus]);

  if (result.rowCount === 0) {
    console.error(`[updateSubmissionStatus] No rows updated for submission ${submissionId}`);
    throw new Error(`Submission not found: ${submissionId}`);
  }

  console.log(`[updateSubmissionStatus] Successfully updated submission ${submissionId}: ${JSON.stringify(result.rows[0])}`);
  return result.rows[0];
}

/**
 * Save feedback report
 * Note: created_by must be a valid user_id UUID. Using system user.
 */
async function saveFeedbackReport(client, reportData) {
  const {
    submissionId,
    reportType,
    title,
    content,
    severity,
  } = reportData;

  // Get or create a system user for AI-generated reports
  const systemUserId = await getSystemUserId(client);

  const query = `
    INSERT INTO feedback_reports (
      submission_id,
      created_by,
      report_type,
      title,
      content,
      severity,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'open')
    RETURNING report_id, created_at
  `;

  const result = await client.query(query, [
    submissionId,
    systemUserId,
    reportType || 'comment',
    title,
    content,
    severity || 'low',
  ]);

  return result.rows[0];
}

/**
 * Get or create system user for AI-generated content
 */
async function getSystemUserId(client) {
  // Try to get existing system user
  const query = `SELECT user_id FROM users WHERE email = 'system@overlay.ai' LIMIT 1`;
  const result = await client.query(query);

  if (result.rows.length > 0) {
    return result.rows[0].user_id;
  }

  // Use admin user as fallback for AI-generated content
  // In production, system user should be created during migration
  return '10000000-0000-0000-0000-000000000001';
}

/**
 * Save criterion scores
 * Uses evaluation_responses table instead of criterion_scores
 */
async function saveCriterionScores(client, scoresData) {
  const {
    submissionId,
    scores, // Array of {criterionId, score, reasoning}
  } = scoresData;

  if (!scores || scores.length === 0) {
    return [];
  }

  const savedScores = [];

  // Insert each score individually to handle conflicts
  for (const score of scores) {
    const query = `
      INSERT INTO evaluation_responses (
        submission_id,
        criteria_id,
        response_value,
        score,
        is_ai_generated
      ) VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (submission_id, criteria_id)
      DO UPDATE SET
        response_value = EXCLUDED.response_value,
        score = EXCLUDED.score,
        updated_at = CURRENT_TIMESTAMP
      RETURNING response_id AS score_id, criteria_id AS criterion_id, score, created_at AS evaluated_at
    `;

    const responseValue = {
      reasoning: score.reasoning || '',
      evaluatedBy: 'ai-agent',
    };

    const result = await client.query(query, [
      submissionId,
      score.criterionId,
      JSON.stringify(responseValue),
      score.score,
    ]);

    savedScores.push(result.rows[0]);
  }

  return savedScores;
}

/**
 * Get document from S3 and extract text based on file type
 * Supports .docx, .pdf, and plain text files
 */
async function getDocumentFromS3(s3Bucket, s3Key) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;

  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Detect file type from S3 key
  const fileExtension = s3Key.split('.').pop().toLowerCase();

  try {
    if (fileExtension === 'docx') {
      // Extract text from .docx using mammoth
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      console.log(`Extracted ${result.value.length} characters from .docx file`);
      return result.value;
    } else if (fileExtension === 'pdf') {
      // Extract text from PDF using pdf-parse
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      console.log(`Extracted ${data.text.length} characters from PDF file`);
      return data.text;
    } else {
      // Plain text file
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error(`Error extracting text from ${fileExtension} file:`, error);
    // Fallback to plain text
    return buffer.toString('utf-8');
  }
}

/**
 * Save clarification questions
 * Note: clarification_questions table doesn't exist in schema
 * Storing as feedback_reports with type 'suggestion' instead
 */
async function saveClarificationQuestions(client, questionsData) {
  const {
    submissionId,
    questions, // Array of {question, category, priority}
  } = questionsData;

  if (!questions || questions.length === 0) {
    return [];
  }

  // Get system user for AI-generated questions
  const systemUserId = await getSystemUserId(client);

  if (!systemUserId) {
    console.warn('No system user found, skipping clarification questions');
    return [];
  }

  const savedQuestions = [];

  // Save each question as a feedback report
  for (const q of questions) {
    const query = `
      INSERT INTO feedback_reports (
        submission_id,
        created_by,
        report_type,
        title,
        content,
        severity,
        status
      ) VALUES ($1, $2, 'suggestion', $3, $4, $5, 'open')
      RETURNING report_id AS question_id, title AS question, severity AS category, created_at
    `;

    const title = `Clarification needed: ${q.category || 'general'}`;
    const severity = q.priority === 'high' ? 'high' : q.priority === 'low' ? 'low' : 'medium';

    const result = await client.query(query, [
      submissionId,
      systemUserId,
      title,
      q.question,
      severity,
    ]);

    savedQuestions.push(result.rows[0]);
  }

  return savedQuestions;
}

module.exports = {
  createDbConnection,
  getOverlayById,
  getEvaluationCriteria,
  getBestPracticeExamples,
  createDocumentSubmission,
  updateSubmissionStatus,
  saveFeedbackReport,
  saveCriterionScores,
  getDocumentFromS3,
  saveClarificationQuestions,
};
