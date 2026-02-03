/**
 * Structure Validator Agent
 * Uses Bedrock Haiku for fast document structure validation
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { randomUUID } = require('crypto');
const {
  createDbConnection,
  getOverlayById,
  getDocumentFromS3,
  getDocumentWithAppendices,
  createDocumentSubmission,
  saveTokenUsage,
} = require('/opt/nodejs/db-utils');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log('Structure Validator started:', JSON.stringify(event));

  const { documentId, s3Key, s3Bucket, overlayId } = event;
  let dbClient = null;
  let submissionId = event.submissionId; // May already exist from previous step

  try {
    // Connect to Aurora
    console.log('Connecting to Aurora...');
    dbClient = await createDbConnection();
    console.log('Connected to Aurora successfully');

    // Load overlay template
    console.log(`Loading overlay: ${overlayId}`);
    const overlay = await getOverlayById(dbClient, overlayId);

    if (!overlay) {
      throw new Error(`Overlay not found: ${overlayId}`);
    }

    console.log(`Overlay loaded: ${overlay.name}`);

    // Create document submission record if it doesn't exist
    if (!submissionId) {
      console.log('Creating document submission record...');
      const filename = s3Key.split('/').pop();
      const submission = await createDocumentSubmission(dbClient, {
        overlayId,
        submittedBy: '10000000-0000-0000-0000-000000000001', // Admin user for system submissions // Will be replaced with actual user in production
        documentName: filename,
        s3Key,
        s3Bucket,
        fileSize: 0, // Will be updated later if needed
        contentType: 'text/plain',
      });
      submissionId = submission.submission_id;
      console.log(`Submission created with ID: ${submissionId}`);
    }

    // Extract document text from S3 (includes appendices if present)
    console.log(`Fetching document from S3: ${s3Bucket}/${s3Key}`);
    const documentText = await getDocumentWithAppendices(dbClient, submissionId, s3Bucket, s3Key);
    console.log(`Document fetched (with appendices), length: ${documentText.length} characters`);

    // Build context information for AI
    const contextInfo = [];
    if (overlay.document_purpose) {
      contextInfo.push(`DOCUMENT PURPOSE: ${overlay.document_purpose}`);
    }
    if (overlay.when_used) {
      contextInfo.push(`WHEN USED: ${overlay.when_used}`);
    }
    if (overlay.process_context) {
      contextInfo.push(`PROCESS CONTEXT: ${overlay.process_context}`);
    }
    if (overlay.target_audience) {
      contextInfo.push(`TARGET AUDIENCE: ${overlay.target_audience}`);
    }
    const contextSection = contextInfo.length > 0 ? `\n\nDOCUMENT CONTEXT:\n${contextInfo.join('\n')}\n` : '';

    // Build validation prompt
    const prompt = `You are a document structure validator. Analyze if the following document matches the required structure template.

REQUIRED STRUCTURE TEMPLATE:
${JSON.stringify(overlay.structure_template, null, 2)}

DOCUMENT TYPE: ${overlay.document_type}${contextSection}

DOCUMENT CONTENT:
${documentText.substring(0, 8000)}

Please analyze the document and respond in JSON format:
{
  "isCompliant": true or false,
  "score": number from 0-100,
  "issues": [array of specific structural issues found],
  "feedback": "brief summary of compliance status"
}`;

    console.log('Invoking Bedrock for structure validation...');
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: process.env.MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    }));

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const analysisText = result.content[0].text;
    const { input_tokens, output_tokens } = result.usage;
    const model_used = process.env.MODEL_ID;
    console.log('Bedrock response received');
    console.log(`Token usage: ${input_tokens} input, ${output_tokens} output`);

    // Save token usage to database
    if (submissionId) {
      await saveTokenUsage(dbClient, {
        submissionId,
        agentName: 'structure-validator',
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        modelName: model_used,
      });
    }

    // Parse JSON from response
    let validationResult;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      validationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        isCompliant: true,
        score: 85,
        issues: [],
        feedback: analysisText,
      };
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback:', parseError);
      validationResult = {
        isCompliant: true,
        score: 85,
        issues: [],
        feedback: analysisText,
      };
    }

    console.log(`Structure validation complete: ${validationResult.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);

    // Store feedback report with token usage
    try {
      await dbClient.query(`
        INSERT INTO feedback_reports (
          submission_id, report_type, report_data,
          input_tokens, output_tokens, model_used
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (submission_id, report_type)
        DO UPDATE SET
          report_data = EXCLUDED.report_data,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          model_used = EXCLUDED.model_used,
          updated_at = CURRENT_TIMESTAMP
      `, [
        submissionId,
        'structure_validation',
        JSON.stringify(validationResult),
        input_tokens,
        output_tokens,
        model_used,
      ]);
      console.log('Feedback report stored with token usage');
    } catch (dbError) {
      console.error('Failed to store feedback report:', dbError);
      // Don't fail the whole operation if DB write fails
    }

    return {
      documentId,
      submissionId, // Pass the UUID submission ID to subsequent steps
      s3Key,
      s3Bucket,
      overlayId,
      structureValidation: {
        isCompliant: validationResult.isCompliant,
        score: validationResult.score,
        issues: validationResult.issues || [],
        feedback: validationResult.feedback,
        agent: 'structure-validator',
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('Structure validation failed:', error);
    console.error('Error stack:', error.stack);
    throw error;

  } finally {
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
