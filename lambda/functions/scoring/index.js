/**
 * Scoring Agent
 * Uses Claude Sonnet to calculate final scores and generate comprehensive feedback
 */

const { getClaudeClient } = require('/opt/nodejs/llm-client');
const {
  createDbConnection,
  getEvaluationCriteria,
  saveFeedbackReport,
  saveCriterionScores,
  updateSubmissionStatus,
  getOverlayById,
} = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Scoring started:', JSON.stringify(event));

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
    clarification,
  } = event;

  let dbClient = null;

  try {
    // Connect to Aurora
    console.log('Connecting to Aurora...');
    dbClient = await createDbConnection();
    console.log('Connected to Aurora successfully');

    // Load overlay and evaluation criteria
    console.log('Loading overlay and evaluation criteria...');
    const overlay = await getOverlayById(dbClient, overlayId);
    const criteria = await getEvaluationCriteria(dbClient, overlayId);
    console.log(`Loaded ${criteria.length} evaluation criteria`);

    // Get Claude client
    const claude = await getClaudeClient();

    // Prepare analysis results for scoring
    const structureScore = structureValidation.score || 0;
    const contentScore = contentAnalysis.score || 0;
    const grammarScore = grammarCheck.score || 0;
    const averageScore = orchestration.averageScore || Math.round((structureScore + contentScore + grammarScore) / 3);

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

    // Build comprehensive scoring prompt
    // description is single source of truth (updated from criteria_text on save)
    const criteriaText = criteria.map(c =>
      `- ${c.name} (${c.category}): ${c.description} [Max: ${c.max_score}, Weight: ${c.weight}, Method: ${c.evaluation_method}]`
    ).join('\n');

    const prompt = `You are a document scoring agent. Score each evaluation criterion based on the analysis results and generate comprehensive feedback.${contextSection}

EVALUATION CRITERIA:
${criteriaText}

ANALYSIS RESULTS:

Structure Validation (${structureScore}/100):
${JSON.stringify(structureValidation, null, 2)}

Content Analysis (${contentScore}/100):
${JSON.stringify(contentAnalysis, null, 2)}

Grammar Check (${grammarScore}/100):
${JSON.stringify(grammarCheck, null, 2)}

Orchestration Summary:
${orchestration.summary}

Respond in JSON format:
{
  "criterionScores": [
    {
      "criterionId": "criterion_id from above list",
      "criterionName": "criterion name",
      "score": number from 0 to max_score,
      "reasoning": "detailed reasoning for this score"
    }
  ],
  "overallFeedback": {
    "title": "brief title for the feedback report",
    "content": "comprehensive feedback covering strengths, weaknesses, and recommendations",
    "severity": "low|medium|high|critical",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
  }
}`;

    console.log('Invoking Claude for final scoring...');
    const response = await claude.sendMessage(prompt, {
      model: process.env.MODEL_ID,
      max_tokens: 8192,
    });

    console.log('Claude response received');

    // Parse JSON from response
    let scoringResult;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      scoringResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        criterionScores: [],
        overallFeedback: {
          title: 'Document Analysis Complete',
          content: response,
          severity: 'low',
          strengths: [],
          weaknesses: [],
          recommendations: [],
        },
      };
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using fallback:', parseError);
      scoringResult = {
        criterionScores: [],
        overallFeedback: {
          title: 'Document Analysis Complete',
          content: response,
          severity: 'low',
          strengths: [],
          weaknesses: [],
          recommendations: [],
        },
      };
    }

    // Map criterion names to IDs
    const criteriaMap = {};
    criteria.forEach(c => {
      criteriaMap[c.name] = c.criterion_id;
    });

    // Helper function to validate UUID format
    const isValidUUID = (uuid) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    };

    const scoresForDb = scoringResult.criterionScores.map(s => ({
      criterionId: criteriaMap[s.criterionName] || s.criterionId,
      score: s.score,
      reasoning: s.reasoning,
      evaluatedBy: 'ai-agent',
    })).filter(s => s.criterionId && isValidUUID(s.criterionId)); // Only include scores with valid UUID criterion IDs

    console.log(`Saving ${scoresForDb.length} criterion scores to database (filtered from ${scoringResult.criterionScores.length} AI-generated scores)...`);

    // Save criterion scores to Aurora
    const savedScores = await saveCriterionScores(dbClient, {
      submissionId, // Use UUID from structure validator
      scores: scoresForDb,
    });

    console.log(`Saved ${savedScores.length} criterion scores`);

    // Save comprehensive feedback report
    console.log('Saving feedback report to database...');
    const feedbackReport = await saveFeedbackReport(dbClient, {
      submissionId, // Use UUID from structure validator
      reportType: 'comment', // AI-generated analysis report
      title: scoringResult.overallFeedback.title,
      content: JSON.stringify({
        summary: scoringResult.overallFeedback.content,
        strengths: scoringResult.overallFeedback.strengths,
        weaknesses: scoringResult.overallFeedback.weaknesses,
        recommendations: scoringResult.overallFeedback.recommendations,
        scores: {
          structure: structureScore,
          content: contentScore,
          grammar: grammarScore,
          average: averageScore,
        },
      }, null, 2),
      severity: scoringResult.overallFeedback.severity,
    });

    console.log(`Feedback report saved with ID: ${feedbackReport.report_id}`);

    // Update submission status to completed
    console.log('Updating submission status...');
    await updateSubmissionStatus(dbClient, submissionId, 'approved', 'completed');
    console.log('Submission status updated to completed');

    // Calculate final weighted score
    let finalScore = averageScore;
    if (savedScores.length > 0 && criteria.length > 0) {
      let totalWeightedScore = 0;
      let totalWeight = 0;

      savedScores.forEach(saved => {
        const criterion = criteria.find(c => c.criterion_id === saved.criterion_id);
        if (criterion) {
          const normalizedScore = (saved.score / criterion.max_score) * 100;
          totalWeightedScore += normalizedScore * criterion.weight;
          totalWeight += criterion.weight;
        }
      });

      if (totalWeight > 0) {
        finalScore = Math.round(totalWeightedScore / totalWeight);
      }
    }

    console.log(`Scoring complete, final score: ${finalScore}`);

    return {
      documentId,
      s3Key,
      s3Bucket,
      overlayId,
      finalScore,
      scoring: {
        structureScore,
        contentScore,
        grammarScore,
        finalScore,
        criteriaScored: savedScores.length,
        reportId: feedbackReport.report_id,
        feedback: scoringResult.overallFeedback.content,
        strengths: scoringResult.overallFeedback.strengths,
        weaknesses: scoringResult.overallFeedback.weaknesses,
        recommendations: scoringResult.overallFeedback.recommendations,
        agent: 'scoring',
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
      allResults: {
        structureValidation,
        contentAnalysis,
        grammarCheck,
        orchestration,
        clarification,
      },
    };

  } catch (error) {
    console.error('Scoring failed:', error);
    console.error('Error stack:', error.stack);

    // Try to update submission status to failed
    if (dbClient && submissionId) {
      try {
        await updateSubmissionStatus(dbClient, submissionId, 'rejected', 'failed');
        console.log('Submission status updated to failed');
      } catch (updateError) {
        console.error('Failed to update submission status:', updateError);
      }
    }

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
