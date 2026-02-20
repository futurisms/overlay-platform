/**
 * Analysis Failure Handler
 * Triggered by EventBridge when Step Functions execution fails
 * Updates submission status to "failed"
 */

const { Client } = require('pg');

exports.handler = async (event) => {
  console.log('Analysis failure event:', JSON.stringify(event, null, 2));

  try {
    // Extract submission ID from the Step Functions execution input
    const executionInput = event.detail?.input ? JSON.parse(event.detail.input) : null;
    const submissionId = executionInput?.submissionId || executionInput?.documentId;

    if (!submissionId) {
      console.error('No submission ID found in execution input');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No submission ID in execution input' }),
      };
    }

    console.log(`Marking submission ${submissionId} as failed`);

    // Connect to database
    const dbClient = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    });

    await dbClient.connect();

    try {
      // Update submission status to failed
      const result = await dbClient.query(
        `UPDATE document_submissions
         SET ai_analysis_status = 'failed'
         WHERE submission_id = $1
         RETURNING submission_id, document_name, ai_analysis_status`,
        [submissionId]
      );

      if (result.rowCount === 0) {
        console.warn(`No submission found with ID ${submissionId}`);
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Submission not found' }),
        };
      }

      console.log('Updated submission:', result.rows[0]);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Submission marked as failed',
          submission: result.rows[0],
        }),
      };
    } finally {
      await dbClient.end();
    }
  } catch (error) {
    console.error('Error updating submission status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
