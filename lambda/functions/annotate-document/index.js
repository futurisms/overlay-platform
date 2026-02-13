/**
 * Annotate Document Handler
 * Generates AI-powered annotated documents with recommendations woven into the original text
 *
 * GET /submissions/{id}/annotate - Generate annotated document for a submission
 */

const { createDbConnection, getDocumentWithAppendices, saveTokenUsage } = require('/opt/nodejs/db-utils');
const { getCorsHeaders } = require('/opt/nodejs/cors');
const { getClaudeClient } = require('/opt/nodejs/llm-client');
const { canViewSubmission } = require('/opt/nodejs/permissions');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-west-1' });

exports.handler = async (event) => {
  console.log('Annotate Document Handler:', JSON.stringify(event));

  // Check if this is a background worker invocation
  const isWorker = event.isWorker === true;

  if (isWorker) {
    // This is a background worker invocation - do the actual processing
    console.log('[Annotate] Worker mode: processing annotation generation');
    return await processAnnotationGeneration(event);
  }

  // This is a normal API Gateway request
  const { httpMethod, pathParameters, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    if (httpMethod === 'GET') {
      return await handleGetAnnotation(dbClient, pathParameters, userId, event);
    } else {
      return { statusCode: 405, headers: getCorsHeaders(event), body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

/**
 * Generate annotated document
 * GET /submissions/{id}/annotate
 */
async function handleGetAnnotation(dbClient, pathParameters, userId, event) {
  const submissionId = pathParameters?.id || pathParameters?.submissionId;

  if (!submissionId) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Submission ID required' })
    };
  }

  console.log(`[Annotate] Generating annotation for submission: ${submissionId}`);

  // 1. Check if annotation already exists or is generating
  console.log('[Annotate] Checking for existing annotation...');
  const existingAnnotationQuery = `
    SELECT annotation_id, annotated_json, model_used, input_tokens, output_tokens,
           generation_time_ms, created_at, generation_status
    FROM document_annotations
    WHERE submission_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const existingResult = await dbClient.query(existingAnnotationQuery, [submissionId]);

  if (existingResult.rows.length > 0) {
    const annotation = existingResult.rows[0];

    // If currently generating, return status
    if (annotation.generation_status === 'generating') {
      console.log('[Annotate] Annotation is currently being generated');
      return {
        statusCode: 202, // Accepted - processing
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          status: 'generating',
          message: 'Annotation is being generated. Poll this endpoint to check status.'
        })
      };
    }

    // If completed, return cached result
    if (annotation.generation_status === 'completed') {
      console.log('[Annotate] Found existing annotation, returning cached result');
      return {
        statusCode: 200,
        headers: getCorsHeaders(event),
        body: JSON.stringify({
          ...annotation,
          cached: true,
          status: 'completed'
        })
      };
    }

    // If failed, allow regeneration (continue to generate new one)
    if (annotation.generation_status === 'failed') {
      console.log('[Annotate] Previous generation failed, attempting new generation');
      // Continue to generation logic below
    }
  }

  // 2. Fetch submission details
  console.log('[Annotate] Fetching submission details...');
  const submissionQuery = `
    SELECT ds.submission_id, ds.document_name, ds.s3_bucket, ds.s3_key,
           ds.submitted_by, ds.ai_analysis_status, ds.session_id
    FROM document_submissions ds
    WHERE ds.submission_id = $1
  `;
  const submissionResult = await dbClient.query(submissionQuery, [submissionId]);

  if (submissionResult.rows.length === 0) {
    return {
      statusCode: 404,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Submission not found' })
    };
  }

  const submission = submissionResult.rows[0];

  // 3. Check permissions
  console.log('[Annotate] Checking user permissions...');
  const userQuery = await dbClient.query('SELECT user_id, user_role FROM users WHERE user_id = $1', [userId]);
  const user = userQuery.rows[0];

  if (!user) {
    return {
      statusCode: 404,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'User not found' })
    };
  }

  if (!canViewSubmission(user, submission)) {
    return {
      statusCode: 403,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ error: 'Forbidden: You can only access your own submissions' })
    };
  }

  // 4. Check if AI analysis is completed
  if (submission.ai_analysis_status !== 'completed') {
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Evaluation must complete before generating annotated document',
        ai_analysis_status: submission.ai_analysis_status
      })
    };
  }

  // 5. Fetch document text (main + appendices)
  console.log('[Annotate] Fetching document text from S3...');
  const documentText = await getDocumentWithAppendices(
    dbClient,
    submissionId,
    submission.s3_bucket,
    submission.s3_key
  );
  console.log(`[Annotate] Document text extracted: ${documentText.length} characters`);

  // 6. Fetch recommendations from feedback_reports
  console.log('[Annotate] Fetching recommendations from feedback...');
  const feedbackQuery = `
    SELECT content
    FROM feedback_reports
    WHERE submission_id = $1 AND report_type = 'comment'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const feedbackResult = await dbClient.query(feedbackQuery, [submissionId]);

  if (feedbackResult.rows.length === 0) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Evaluation must complete before generating annotated document',
        reason: 'No feedback report found'
      })
    };
  }

  const feedbackContent = JSON.parse(feedbackResult.rows[0].content);
  const recommendations = feedbackContent.recommendations || [];
  const strengths = feedbackContent.strengths || [];
  const weaknesses = feedbackContent.weaknesses || [];

  console.log(`[Annotate] Found ${recommendations.length} recommendations, ${strengths.length} strengths, ${weaknesses.length} weaknesses`);

  // 7. Create placeholder annotation with 'generating' status
  console.log('[Annotate] Creating placeholder annotation with generating status...');
  const placeholderQuery = `
    INSERT INTO document_annotations (
      submission_id, annotated_json, model_used,
      input_tokens, output_tokens, generation_time_ms, generation_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING annotation_id
  `;
  const placeholderResult = await dbClient.query(placeholderQuery, [
    submissionId,
    JSON.stringify({ sections: [] }), // Empty placeholder
    'claude-sonnet-4-5-20250929',
    0,
    0,
    0,
    'generating'
  ]);
  const annotationId = placeholderResult.rows[0].annotation_id;
  console.log(`[Annotate] Placeholder annotation created with ID: ${annotationId}`);

  // 8. Invoke Lambda asynchronously to process annotation in background
  console.log('[Annotate] Invoking background worker to generate annotation...');
  const invokeCommand = new InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify({
      isWorker: true,
      submissionId,
      annotationId,
      documentText,
      recommendations,
      strengths,
      weaknesses
    })
  });

  try {
    await lambdaClient.send(invokeCommand);
    console.log('[Annotate] Background worker invoked successfully');
  } catch (invokeError) {
    console.error('[Annotate] Failed to invoke background worker:', invokeError);
    // Update placeholder to failed
    await dbClient.query(
      `UPDATE document_annotations SET generation_status = 'failed' WHERE annotation_id = $1`,
      [annotationId]
    );
    return {
      statusCode: 500,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        error: 'Failed to start annotation generation',
        details: invokeError.message
      })
    };
  }

  // 9. Return 202 Accepted immediately
  return {
    statusCode: 202,
    headers: getCorsHeaders(event),
    body: JSON.stringify({
      status: 'generating',
      message: 'Annotation is being generated. Poll this endpoint to check status.',
      annotation_id: annotationId
    })
  };
}

/**
 * Process annotation generation in background worker mode
 */
async function processAnnotationGeneration(event) {
  const { submissionId, annotationId, documentText, recommendations, strengths, weaknesses } = event;

  console.log(`[Worker] Starting annotation generation for submission ${submissionId}`);
  console.log(`[Worker] Annotation ID: ${annotationId}`);

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // Build prompt for Claude
    const prompt = buildAnnotationPrompt(documentText, recommendations, strengths, weaknesses);

    // Call Claude API
    console.log('[Worker] Calling Claude API to generate annotation...');
    const startTime = Date.now();

    const claudeClient = await getClaudeClient();
    const response = await claudeClient.sendMessage(prompt, {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      temperature: 0
    });

    const generationTime = Date.now() - startTime;
    console.log(`[Worker] Claude API call completed in ${generationTime}ms`);
    console.log(`[Worker] Token usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`);

    // Parse and validate response
    console.log('[Worker] Parsing Claude response...');
    let annotatedJson;
    try {
      // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
      let jsonText = response.text.trim();
      if (jsonText.startsWith('```')) {
        // Remove opening ```json or ```
        jsonText = jsonText.replace(/^```(?:json)?\s*/i, '');
        // Remove closing ```
        jsonText = jsonText.replace(/\s*```$/i, '');
      }

      annotatedJson = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Worker] Failed to parse Claude response as JSON:', parseError);
      console.error('[Worker] Raw response text:', response.text.substring(0, 500));

      // Update placeholder to 'failed' status
      await dbClient.query(
        `UPDATE document_annotations SET generation_status = 'failed' WHERE annotation_id = $1`,
        [annotationId]
      );

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'AI returned invalid format',
          details: parseError.message
        })
      };
    }

    // Validate structure
    if (!validateAnnotationStructure(annotatedJson)) {
      console.error('[Worker] Invalid annotation structure:', annotatedJson);

      // Update placeholder to 'failed' status
      await dbClient.query(
        `UPDATE document_annotations SET generation_status = 'failed' WHERE annotation_id = $1`,
        [annotationId]
      );

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'AI returned invalid structure'
        })
      };
    }

    // Update placeholder annotation with actual data
    console.log('[Worker] Updating annotation with generated data...');
    const updateQuery = `
      UPDATE document_annotations
      SET annotated_json = $1,
          model_used = $2,
          input_tokens = $3,
          output_tokens = $4,
          generation_time_ms = $5,
          generation_status = 'completed',
          updated_at = NOW()
      WHERE annotation_id = $6
      RETURNING created_at
    `;
    const updateResult = await dbClient.query(updateQuery, [
      JSON.stringify(annotatedJson),
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
      generationTime,
      annotationId
    ]);

    // Save token usage for admin dashboard cost tracking
    console.log('[Worker] Saving token usage to admin dashboard...');
    await saveTokenUsage(dbClient, {
      submissionId,
      agentName: 'annotate-document',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      modelName: response.model,
    });

    console.log(`[Worker] Annotation generation completed successfully for ${submissionId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        annotation_id: annotationId,
        submission_id: submissionId
      })
    };
  } catch (error) {
    console.error('[Worker] Error during annotation generation:', error);

    // Update to failed status
    if (dbClient) {
      await dbClient.query(
        `UPDATE document_annotations SET generation_status = 'failed' WHERE annotation_id = $1`,
        [annotationId]
      );
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  } finally {
    if (dbClient) await dbClient.end();
  }
}

/**
 * Build the prompt for Claude to generate annotations
 */
function buildAnnotationPrompt(documentText, recommendations, strengths, weaknesses) {
  return `You are an expert document analyst. Your task is to create an "annotated document" that merges the original document text with AI-generated evaluation feedback in a readable sandwich format.

# ORIGINAL DOCUMENT TEXT:
${documentText}

# EVALUATION FEEDBACK:

## WEAKNESSES (annotate these in the document):
${weaknesses.map((w, i) => `${i + 1}. ${w}`).join('\n')}

## RECOMMENDATIONS (annotate these in the document):
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## STRENGTHS (for context only — DO NOT annotate these):
${strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

# YOUR TASK:

Create a structured JSON output that represents the annotated document. The output should alternate between:
1. **Text blocks**: Chunks of the original document text (2-3 paragraphs or logical sections)
2. **Annotation blocks**: Relevant WEAKNESSES and RECOMMENDATIONS that apply to that section

# OUTPUT FORMAT:

Return ONLY a valid JSON object with this structure (no markdown, no code blocks):

{
  "sections": [
    {
      "type": "text",
      "content": "Original document text chunk here..."
    },
    {
      "type": "annotations",
      "items": [
        {
          "priority": "high",
          "type": "weakness",
          "text": "The relevant weakness text from the evaluation"
        },
        {
          "priority": "medium",
          "type": "recommendation",
          "text": "The relevant recommendation text from the evaluation"
        }
      ]
    },
    {
      "type": "text",
      "content": "Next chunk of original text..."
    }
  ]
}

# RULES:

1. **Preserve the entire original document** - include ALL text from the original document across all text blocks
2. **Match recommendations to context** - insert annotations where they are most relevant in the document
3. **Priority levels**: Use "high" for critical issues/recommendations, "medium" for important ones, "low" for minor suggestions
4. **Type field**: ONLY use "weakness" or "recommendation" - DO NOT create annotations for strengths
5. **Strengths are context only** - strengths are provided to help you understand what's good about the document, but you should NOT create annotation items for them
6. **Chunking**: Break the document into logical sections (2-3 paragraphs each) before inserting annotations
7. **No duplication**: Each piece of feedback should appear only once, in its most relevant location
8. **General feedback**: If a recommendation is general (applies to the whole document), place it after the introduction or at the end
9. **Return ONLY JSON** - do not wrap in markdown code blocks, just return the raw JSON object

Generate the annotated document now.`;
}

/**
 * Validate annotation structure
 */
function validateAnnotationStructure(annotation) {
  // Check if sections array exists
  if (!annotation.sections || !Array.isArray(annotation.sections)) {
    console.error('[Validate] Missing or invalid sections array');
    return false;
  }

  // Check each section
  for (const section of annotation.sections) {
    if (!section.type) {
      console.error('[Validate] Section missing type field');
      return false;
    }

    if (section.type !== 'text' && section.type !== 'annotations') {
      console.error('[Validate] Invalid section type:', section.type);
      return false;
    }

    if (section.type === 'text') {
      if (!section.content || typeof section.content !== 'string') {
        console.error('[Validate] Text section missing or invalid content');
        return false;
      }
      if (section.content.trim().length === 0) {
        console.error('[Validate] Text section has empty content');
        return false;
      }
    }

    if (section.type === 'annotations') {
      if (!section.items || !Array.isArray(section.items)) {
        console.error('[Validate] Annotations section missing or invalid items array');
        return false;
      }
      for (const item of section.items) {
        if (!item.priority || !item.text) {
          console.error('[Validate] Annotation item missing required fields');
          return false;
        }
      }
    }
  }

  console.log('[Validate] Annotation structure is valid');
  return true;
}
