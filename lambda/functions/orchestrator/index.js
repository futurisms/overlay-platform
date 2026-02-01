/**
 * Orchestrator Agent
 * Uses Claude Sonnet to coordinate the workflow and determine next steps
 */

const { getClaudeClient } = require('/opt/nodejs/llm-client');
const { createDbConnection, getOverlayById } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Orchestrator started:', JSON.stringify(event));

  const { documentId, s3Key, s3Bucket, overlayId, structureValidation, contentAnalysis, grammarCheck } = event;
  let dbClient = null;

  try {
    // Connect to database and load overlay for context
    dbClient = await createDbConnection();
    const overlay = await getOverlayById(dbClient, overlayId);

    // Get Claude client from common layer
    const claude = await getClaudeClient();

    // Synthesize all parallel analysis results
    const structureScore = structureValidation.score || 0;
    const contentScore = contentAnalysis.score || 0;
    const grammarScore = grammarCheck.score || 0;
    const averageScore = Math.round((structureScore + contentScore + grammarScore) / 3);

    const structureIssues = structureValidation.issues?.length || 0;
    const contentFindings = contentAnalysis.findings?.length || 0;
    const grammarErrors = grammarCheck.errors?.length || 0;

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

    // Build orchestration prompt
    const prompt = `You are a workflow orchestrator. Analyze the following document review results and determine the next steps.${contextSection}

ANALYSIS RESULTS:

Structure Validation (Score: ${structureScore}/100):
- Compliant: ${structureValidation.isCompliant}
- Issues: ${structureIssues}
- Feedback: ${structureValidation.feedback}

Content Analysis (Score: ${contentScore}/100):
- Findings: ${contentFindings}
- Summary: ${contentAnalysis.summary || 'No summary'}

Grammar Check (Score: ${grammarScore}/100):
- Errors: ${grammarErrors}
- Summary: ${grammarCheck.summary || 'No summary'}

Average Score: ${averageScore}/100

Based on these results, respond in JSON format:
{
  "needsClarification": true or false,
  "clarificationQuestions": [
    {
      "question": "specific question to ask",
      "category": "structure|content|grammar|general",
      "priority": "high|medium|low",
      "reasoning": "why this question is needed"
    }
  ],
  "proceedToScoring": true or false,
  "recommendations": ["recommendation 1", "recommendation 2"],
  "summary": "overall orchestration decision summary"
}

Rules:
- Request clarification if average score < 70 or if there are critical structural issues
- Request clarification if there are high-severity errors that are ambiguous
- Otherwise, proceed directly to scoring`;

    console.log('Invoking Claude for orchestration decision...');
    const llmResponse = await claude.sendMessage(prompt, {
      model: process.env.MODEL_ID,
      max_tokens: 4096,
    });

    // Extract response components (LLM client v2.4.0 returns object)
    const response = llmResponse.text;
    const { input_tokens, output_tokens } = llmResponse.usage;
    const model_used = llmResponse.model;

    console.log('Claude response received');
    console.log(`Token usage: ${input_tokens} input, ${output_tokens} output`);

    // Parse JSON from response
    let orchestrationResult;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      orchestrationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        needsClarification: averageScore < 70,
        clarificationQuestions: [],
        proceedToScoring: averageScore >= 70,
        recommendations: [],
        summary: response,
      };
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback:', parseError);
      orchestrationResult = {
        needsClarification: averageScore < 70,
        clarificationQuestions: [],
        proceedToScoring: averageScore >= 70,
        recommendations: [],
        summary: response,
      };
    }

    // Store feedback report with token usage
    try {
      const submissionId = event.submissionId;
      if (submissionId) {
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
          'orchestration',
          JSON.stringify(orchestrationResult),
          input_tokens,
          output_tokens,
          model_used,
        ]);
        console.log('Feedback report stored with token usage');
      }
    } catch (dbError) {
      console.error('Failed to store feedback report:', dbError);
      // Don't fail the whole operation if DB write fails
    }

    console.log(`Orchestration complete: clarification=${orchestrationResult.needsClarification}, proceed=${orchestrationResult.proceedToScoring}`);

    return {
      documentId,
      s3Key,
      s3Bucket,
      overlayId,
      structureValidation,
      contentAnalysis,
      grammarCheck,
      orchestration: {
        needsClarification: orchestrationResult.needsClarification,
        clarificationQuestions: orchestrationResult.clarificationQuestions || [],
        proceedToScoring: orchestrationResult.proceedToScoring,
        recommendations: orchestrationResult.recommendations || [],
        summary: orchestrationResult.summary,
        averageScore,
        agent: 'orchestrator',
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('Orchestration failed:', error);
    console.error('Error stack:', error.stack);
    throw error;
  } finally {
    if (dbClient) await dbClient.end();
  }
};
