/**
 * Answers Handler
 * Clarification answer submission and retrieval
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  console.log('Answers Handler:', JSON.stringify(event));

  const { httpMethod, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub || '10000000-0000-0000-0000-000000000001';

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    // All routes are /submissions/{id}/answers
    const submissionId = pathParameters?.submissionId || pathParameters?.id;

    if (!submissionId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Submission ID required' }) };
    }

    switch (httpMethod) {
      case 'GET':
        return await handleGetAnswers(dbClient, submissionId, userId);
      case 'POST':
        return await handleCreateAnswer(dbClient, submissionId, requestBody, userId);
      default:
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

async function handleGetAnswers(dbClient, submissionId, userId) {
  // Get all questions and answers for a submission
  const query = `
    SELECT q.question_id, q.question_text, q.priority, q.created_at,
           a.answer_id, a.answer_text, a.answered_by, a.answered_at,
           u.first_name || ' ' || u.last_name as answered_by_name
    FROM clarification_questions q
    LEFT JOIN clarification_answers a ON q.question_id = a.question_id
    LEFT JOIN users u ON a.answered_by = u.user_id
    WHERE q.submission_id = $1
    ORDER BY q.priority DESC, q.created_at
  `;
  const result = await dbClient.query(query, [submissionId]);

  // Group by questions
  const questions = result.rows.reduce((acc, row) => {
    const existing = acc.find(q => q.question_id === row.question_id);
    if (existing) {
      if (row.answer_id) {
        existing.answers.push({
          answer_id: row.answer_id,
          answer_text: row.answer_text,
          answered_by: row.answered_by,
          answered_by_name: row.answered_by_name,
          answered_at: row.answered_at,
        });
      }
    } else {
      acc.push({
        question_id: row.question_id,
        question_text: row.question_text,
        priority: row.priority,
        created_at: row.created_at,
        answers: row.answer_id ? [{
          answer_id: row.answer_id,
          answer_text: row.answer_text,
          answered_by: row.answered_by,
          answered_by_name: row.answered_by_name,
          answered_at: row.answered_at,
        }] : [],
      });
    }
    return acc;
  }, []);

  return { statusCode: 200, body: JSON.stringify({ questions, total: questions.length }) };
}

async function handleCreateAnswer(dbClient, submissionId, requestBody, userId) {
  const { question_id, answer_text } = JSON.parse(requestBody);

  if (!question_id || !answer_text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'question_id and answer_text required' }) };
  }

  // Validate question belongs to submission
  const questionCheck = await dbClient.query(
    `SELECT question_id FROM clarification_questions WHERE question_id = $1 AND submission_id = $2`,
    [question_id, submissionId]
  );

  if (questionCheck.rows.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid question for this submission' }) };
  }

  // Insert or update answer (upsert pattern)
  const query = `
    INSERT INTO clarification_answers (question_id, submission_id, answer_text, answered_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (question_id, answered_by)
    DO UPDATE SET answer_text = $3, answered_at = CURRENT_TIMESTAMP
    RETURNING answer_id, question_id, answer_text, answered_by, answered_at
  `;
  const result = await dbClient.query(query, [question_id, submissionId, answer_text, userId]);

  console.log(`Answer submitted for question ${question_id} by user ${userId}`);
  return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
}
