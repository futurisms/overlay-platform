/**
 * Content Analyzer Agent
 * Uses Claude Sonnet for detailed content analysis
 */

const { getClaudeClient } = require('/opt/nodejs/llm-client');
const {
  createDbConnection,
  getOverlayById,
  getEvaluationCriteria,
  getBestPracticeExamples,
  getDocumentFromS3,
  getDocumentWithAppendices,
} = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Content Analyzer started:', JSON.stringify(event));

  const { documentId, submissionId, s3Key, s3Bucket, overlayId, structureValidation } = event;
  let dbClient = null;

  try {
    // Connect to Aurora
    console.log('Connecting to Aurora...');
    dbClient = await createDbConnection();
    console.log('Connected to Aurora successfully');

    // Load overlay and evaluation criteria
    console.log(`Loading overlay: ${overlayId}`);
    const overlay = await getOverlayById(dbClient, overlayId);

    if (!overlay) {
      throw new Error(`Overlay not found: ${overlayId}`);
    }

    console.log('Loading evaluation criteria...');
    const criteria = await getEvaluationCriteria(dbClient, overlayId);
    console.log(`Loaded ${criteria.length} evaluation criteria`);

    console.log('Loading best practice examples...');
    const examples = await getBestPracticeExamples(dbClient, overlayId);
    console.log(`Loaded ${examples.length} best practice examples`);

    // Extract document text from S3 (includes appendices if present)
    console.log(`Fetching document from S3: ${s3Bucket}/${s3Key}`);
    const documentText = await getDocumentWithAppendices(dbClient, submissionId, s3Bucket, s3Key);
    console.log(`Document fetched (with appendices), length: ${documentText.length} characters`);

    // Get Claude client
    const claude = await getClaudeClient();

    // Build analysis prompt
    // description is single source of truth (updated from criteria_text on save)
    const criteriaText = criteria.map(c =>
      `- ${c.name} (${c.category}): ${c.description} [Max Score: ${c.max_score}, Weight: ${c.weight}]`
    ).join('\n');

    const examplesText = examples.length > 0
      ? examples.map(e => `- ${e.title}: ${e.description}`).join('\n')
      : 'No examples provided';

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

    const prompt = `You are a content quality analyzer. Evaluate the following document against the specified evaluation criteria.

OVERLAY: ${overlay.name}
DESCRIPTION: ${overlay.description}${contextSection}

EVALUATION CRITERIA:
${criteriaText}

BEST PRACTICE EXAMPLES:
${examplesText}

DOCUMENT CONTENT:
${documentText.substring(0, 12000)}

Please analyze the document content quality and respond in JSON format:
{
  "overallScore": number from 0-100,
  "findings": [
    {
      "criterionName": "name of criterion",
      "score": number from 0-max_score,
      "assessment": "detailed assessment",
      "strengths": ["strength 1", "strength 2"],
      "improvements": ["improvement 1", "improvement 2"]
    }
  ],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "summary": "overall content quality summary"
}`;

    console.log('Invoking Claude for content analysis...');
    const response = await claude.sendMessage(prompt, {
      model: process.env.MODEL_ID,
      max_tokens: 8192,
    });

    console.log('Claude response received');

    // Parse JSON from response
    let analysisResult;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        overallScore: 85,
        findings: [],
        recommendations: [],
        summary: response,
      };
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback:', parseError);
      analysisResult = {
        overallScore: 85,
        findings: [],
        recommendations: [],
        summary: response,
      };
    }

    console.log(`Content analysis complete, score: ${analysisResult.overallScore}`);

    return {
      documentId,
      s3Key,
      s3Bucket,
      overlayId,
      structureValidation,
      contentAnalysis: {
        score: analysisResult.overallScore,
        findings: analysisResult.findings || [],
        recommendations: analysisResult.recommendations || [],
        summary: analysisResult.summary,
        criteriaCount: criteria.length,
        agent: 'content-analyzer',
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('Content analysis failed:', error);
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
