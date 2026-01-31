/**
 * Clarification Agent
 * Uses Claude Sonnet for intelligent Q&A and clarification
 */

const { getClaudeClient } = require('/opt/nodejs/llm-client');
const {
  createDbConnection,
  saveClarificationQuestions,
  getOverlayById,
} = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Clarification started:', JSON.stringify(event));

  const {
    documentId,
    submissionId, // UUID from structure validator
    s3Key,
    s3Bucket,
    overlayId,
    structureValidation,
    contentAnalysis,
    grammarCheck,
    orchestration,
  } = event;

  let dbClient = null;

  try {
    // Check if clarification is actually needed
    if (!orchestration.needsClarification) {
      console.log('No clarification needed, skipping...');
      return {
        documentId,
        s3Key,
        s3Bucket,
        overlayId,
        structureValidation,
        contentAnalysis,
        grammarCheck,
        orchestration,
        clarification: {
          questionsGenerated: 0,
          questions: [],
          agent: 'clarification',
          skipped: true,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Connect to Aurora
    console.log('Connecting to Aurora...');
    dbClient = await createDbConnection();
    console.log('Connected to Aurora successfully');

    // Load overlay for context
    const overlay = await getOverlayById(dbClient, overlayId);

    // Get Claude client
    const claude = await getClaudeClient();

    // Generate clarification questions if orchestrator didn't provide specific ones
    let questionsToSave = orchestration.clarificationQuestions || [];

    if (questionsToSave.length === 0) {
      console.log('No specific questions from orchestrator, generating questions...');

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

      const prompt = `Based on the analysis results, generate targeted clarification questions for the document reviewer.${contextSection}

ANALYSIS SUMMARY:
- Structure Score: ${structureValidation.score}/100
- Content Score: ${contentAnalysis.score}/100
- Grammar Score: ${grammarCheck.score}/100
- Average: ${orchestration.averageScore}/100

KEY ISSUES:
${JSON.stringify({
  structureIssues: structureValidation.issues,
  contentFindings: contentAnalysis.findings?.slice(0, 5),
  grammarErrors: grammarCheck.errors?.slice(0, 5),
}, null, 2)}

Generate 3-5 targeted questions in JSON format:
{
  "questions": [
    {
      "question": "specific question",
      "category": "structure|content|grammar|general",
      "priority": "high|medium|low"
    }
  ]
}`;

      const llmResponse = await claude.sendMessage(prompt, {
        model: process.env.MODEL_ID,
        max_tokens: 3072,
      });

      // Extract response components (LLM client v2.4.0 returns object)
      const response = llmResponse.text;
      const { input_tokens, output_tokens } = llmResponse.usage;
      const model_used = llmResponse.model;

      console.log(`Token usage: ${input_tokens} input, ${output_tokens} output`);

      // Parse questions from response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [] };
        questionsToSave = parsed.questions || [];
      } catch (parseError) {
        console.warn('Failed to parse questions, using empty array:', parseError);
      }

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
          'clarification',
          JSON.stringify({ questions: questionsToSave }),
          input_tokens,
          output_tokens,
          model_used,
        ]);
        console.log('Feedback report stored with token usage');
      } catch (dbError) {
        console.error('Failed to store feedback report:', dbError);
        // Don't fail the whole operation if DB write fails
      }
    }

    console.log(`Saving ${questionsToSave.length} clarification questions to database...`);

    // Save questions to Aurora
    const savedQuestions = await saveClarificationQuestions(dbClient, {
      submissionId, // Use UUID from structure validator
      questions: questionsToSave,
    });

    console.log(`Saved ${savedQuestions.length} clarification questions`);

    return {
      documentId,
      s3Key,
      s3Bucket,
      overlayId,
      structureValidation,
      contentAnalysis,
      grammarCheck,
      orchestration,
      clarification: {
        questionsGenerated: savedQuestions.length,
        questions: savedQuestions,
        agent: 'clarification',
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('Clarification failed:', error);
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
