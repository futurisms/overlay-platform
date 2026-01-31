/**
 * Query Results Lambda Function
 * Queries Aurora database for document processing results from within VPC
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Get Aurora credentials from Secrets Manager
 */
async function getAuroraCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.AURORA_SECRET_ARN,
  });

  const response = await secretsManager.send(command);
  return JSON.parse(response.SecretString);
}

/**
 * Query document submissions with results
 */
async function queryDocumentResults(dbClient, documentId = null) {
  let query;
  let params;

  if (documentId) {
    // Query specific document
    query = `
      SELECT
        ds.submission_id,
        ds.document_name as filename,
        ds.submitted_at as submission_date,
        ds.status,
        ds.ai_analysis_status,
        ds.ai_analysis_completed_at as processing_end_time,
        ds.s3_key,
        ds.file_size,
        fr.report_id,
        fr.title,
        fr.content as overall_assessment,
        fr.report_type,
        fr.severity,
        fr.status as report_status,
        fr.created_at as generated_at
      FROM document_submissions ds
      LEFT JOIN feedback_reports fr ON ds.submission_id = fr.submission_id
      WHERE ds.submission_id = $1::uuid
      ORDER BY ds.submitted_at DESC
    `;
    params = [documentId];
  } else {
    // Query last 10 documents
    query = `
      SELECT
        ds.submission_id,
        ds.document_name as filename,
        ds.submitted_at as submission_date,
        ds.status,
        ds.ai_analysis_status,
        ds.ai_analysis_completed_at as processing_end_time,
        ds.s3_key,
        ds.file_size,
        fr.report_id,
        fr.title,
        fr.content as overall_assessment,
        fr.report_type,
        fr.severity,
        fr.status as report_status,
        fr.created_at as generated_at
      FROM document_submissions ds
      LEFT JOIN feedback_reports fr ON ds.submission_id = fr.submission_id
      ORDER BY ds.submitted_at DESC
      LIMIT 10
    `;
    params = [];
  }

  const result = await dbClient.query(query, params);
  return result.rows;
}

/**
 * Query criterion scores for a document
 */
async function queryCriterionScores(dbClient, submissionId) {
  // Note: criterion_scores table doesn't exist yet - placeholder data will be returned
  // This will be populated once the AI agents start writing actual analysis results
  return [];
}

/**
 * Format results for display
 */
function formatResults(documents, scoresMap) {
  return documents.map(doc => {
    const scores = scoresMap[doc.submission_id] || [];

    // Calculate processing duration
    let processingDuration = null;
    if (doc.submission_date && doc.processing_end_time) {
      const start = new Date(doc.submission_date);
      const end = new Date(doc.processing_end_time);
      processingDuration = ((end - start) / 1000).toFixed(2) + 's';
    }

    return {
      documentId: doc.submission_id,
      filename: doc.filename,
      submissionDate: doc.submission_date,
      status: doc.status,
      aiAnalysisStatus: doc.ai_analysis_status,
      s3Key: doc.s3_key,
      fileSize: doc.file_size,
      processingDuration,
      feedback: {
        reportId: doc.report_id,
        title: doc.title,
        overallAssessment: doc.overall_assessment,
        reportType: doc.report_type,
        severity: doc.severity,
        reportStatus: doc.report_status,
        generatedAt: doc.generated_at,
      },
      criterionScores: scores.map(score => ({
        criterionName: score.criterion_name,
        score: score.score,
        maxScore: score.max_score,
        percentage: score.max_score > 0 ? ((score.score / score.max_score) * 100).toFixed(1) + '%' : 'N/A',
        reasoning: score.reasoning,
        evaluatedAt: score.evaluated_at,
      })),
    };
  });
}

exports.handler = async (event) => {
  console.log('Query Results Lambda started:', JSON.stringify(event));

  const documentId = event.documentId || null;
  let dbClient = null;

  try {
    // Get Aurora credentials
    console.log('Fetching Aurora credentials from Secrets Manager...');
    const credentials = await getAuroraCredentials();

    // Connect to Aurora
    console.log('Connecting to Aurora PostgreSQL...');
    dbClient = new Client({
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false, // Required for Aurora SSL
      },
    });

    await dbClient.connect();
    console.log('Connected to Aurora successfully');

    // Query document results
    console.log(documentId ? `Querying document: ${documentId}` : 'Querying last 10 documents');
    const documents = await queryDocumentResults(dbClient, documentId);

    if (documents.length === 0) {
      return {
        statusCode: 404,
        body: {
          message: documentId
            ? `Document not found: ${documentId}`
            : 'No documents found in database',
          documentId,
        },
      };
    }

    // Query criterion scores for each document
    const scoresMap = {};
    for (const doc of documents) {
      const scores = await queryCriterionScores(dbClient, doc.submission_id);
      scoresMap[doc.submission_id] = scores;
    }

    // Format results
    const formattedResults = formatResults(documents, scoresMap);

    console.log(`Successfully retrieved ${formattedResults.length} document(s)`);

    return {
      statusCode: 200,
      body: {
        count: formattedResults.length,
        documents: formattedResults,
      },
    };

  } catch (error) {
    console.error('Error querying results:', error);

    return {
      statusCode: 500,
      body: {
        error: error.message,
        type: error.name,
        stack: error.stack,
      },
    };

  } finally {
    // Close database connection
    if (dbClient) {
      try {
        await dbClient.end();
        console.log('Database connection closed');
      } catch (closeError) {
        console.error('Error closing database connection:', closeError);
      }
    }
  }
};
