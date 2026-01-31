/**
 * Grammar Checker Agent
 * Uses Bedrock Haiku for fast grammar and writing quality checks
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { getDocumentFromS3, getDocumentWithAppendices, createDbConnection, getOverlayById } = require('/opt/nodejs/db-utils');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log('Grammar Checker started:', JSON.stringify(event));

  const { documentId, submissionId, s3Key, s3Bucket, overlayId, structureValidation, contentAnalysis } = event;
  let dbClient = null;

  try {
    // Connect to database and load overlay for context
    dbClient = await createDbConnection();
    const overlay = await getOverlayById(dbClient, overlayId);

    // Extract document text from S3 (includes appendices if present)
    console.log(`Fetching document from S3: ${s3Bucket}/${s3Key}`);
    const documentText = await getDocumentWithAppendices(dbClient, submissionId, s3Bucket, s3Key);
    console.log(`Document fetched (with appendices), length: ${documentText.length} characters`);

    // Build context information for AI
    const contextInfo = [];
    if (overlay?.document_purpose) {
      contextInfo.push(`DOCUMENT PURPOSE: ${overlay.document_purpose}`);
    }
    if (overlay?.when_used) {
      contextInfo.push(`WHEN USED: ${overlay.when_used}`);
    }
    if (overlay?.process_context) {
      contextInfo.push(`PROCESS CONTEXT: ${overlay.process_context}`);
    }
    if (overlay?.target_audience) {
      contextInfo.push(`TARGET AUDIENCE: ${overlay.target_audience}`);
    }
    const contextSection = contextInfo.length > 0 ? `\n\nDOCUMENT CONTEXT:\n${contextInfo.join('\n')}\n` : '';

    // Build grammar check prompt
    const prompt = `You are a grammar and writing quality checker. Review the following document for grammar, spelling, punctuation, and writing quality issues.${contextSection}

DOCUMENT CONTENT:
${documentText.substring(0, 10000)}

Please analyze the document and respond in JSON format:
{
  "overallScore": number from 0-100,
  "errors": [
    {
      "type": "grammar|spelling|punctuation",
      "severity": "high|medium|low",
      "issue": "description of the issue",
      "suggestion": "how to fix it"
    }
  ],
  "warnings": [
    {
      "type": "style|clarity|consistency",
      "issue": "description of the warning",
      "suggestion": "how to improve"
    }
  ],
  "summary": "overall writing quality summary"
}`;

    console.log('Invoking Bedrock for grammar check...');
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: process.env.MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
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

    // Parse JSON from response
    let grammarResult;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      grammarResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        overallScore: 90,
        errors: [],
        warnings: [],
        summary: analysisText,
      };
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback:', parseError);
      grammarResult = {
        overallScore: 90,
        errors: [],
        warnings: [],
        summary: analysisText,
      };
    }

    console.log(`Grammar check complete, score: ${grammarResult.overallScore}`);

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
        'grammar_check',
        JSON.stringify(grammarResult),
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
      s3Key,
      s3Bucket,
      overlayId,
      structureValidation,
      contentAnalysis,
      grammarCheck: {
        score: grammarResult.overallScore,
        errors: grammarResult.errors || [],
        warnings: grammarResult.warnings || [],
        summary: grammarResult.summary,
        agent: 'grammar-checker',
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('Grammar check failed:', error);
    console.error('Error stack:', error.stack);
    throw error;
  } finally {
    if (dbClient) await dbClient.end();
  }
};
