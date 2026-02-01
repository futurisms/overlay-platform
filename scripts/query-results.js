#!/usr/bin/env node

/**
 * Query Results Script
 *
 * This script invokes the query-results Lambda function to retrieve
 * document processing results from the Aurora database.
 *
 * Usage:
 *   node scripts/query-results.js                    # Last 10 documents
 *   node scripts/query-results.js --document-id <id> # Specific document
 *   npm run query:results
 *   npm run query:results -- --document-id doc-1234567890
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// Configuration
const REGION = 'eu-west-1';
const FUNCTION_NAME = 'overlay-query-results';

const lambdaClient = new LambdaClient({ region: REGION });

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const documentId = getArg('--document-id');

// Helper functions for formatted output
function printSection(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(title);
  console.log('═'.repeat(70) + '\n');
}

function printSuccess(message) {
  console.log(`✅ ${message}`);
}

function printError(message) {
  console.log(`❌ ${message}`);
}

function printInfo(message) {
  console.log(`ℹ️  ${message}`);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Display document summary
 */
function displayDocumentSummary(doc) {
  console.log(`Document ID: ${doc.documentId}`);
  console.log(`Filename: ${doc.filename}`);
  console.log(`Status: ${doc.status}`);
  console.log(`AI Analysis Status: ${doc.aiAnalysisStatus || 'N/A'}`);
  console.log(`Submission Date: ${formatDate(doc.submissionDate)}`);
  console.log(`Processing Duration: ${doc.processingDuration || 'N/A'}`);
  console.log(`S3 Key: ${doc.s3Key || 'N/A'}`);
  console.log(`File Size: ${doc.fileSize ? (doc.fileSize / 1024).toFixed(2) + ' KB' : 'N/A'}`);
}

/**
 * Display criterion scores
 */
function displayCriterionScores(scores) {
  if (scores.length === 0) {
    console.log('No criterion scores available yet.');
    return;
  }

  console.log('\nCriterion Scores:');
  console.log('─'.repeat(70));

  scores.forEach((score, index) => {
    console.log(`\n${index + 1}. ${score.criterionName}`);
    console.log(`   Score: ${score.score}/${score.maxScore} (${score.percentage})`);
    if (score.reasoning) {
      console.log(`   Reasoning: ${score.reasoning.substring(0, 200)}${score.reasoning.length > 200 ? '...' : ''}`);
    }
    console.log(`   Evaluated: ${formatDate(score.evaluatedAt)}`);
  });
}

/**
 * Display feedback
 */
function displayFeedback(feedback) {
  if (!feedback.overallAssessment && !feedback.reportId) {
    console.log('\nNo feedback report available yet.');
    console.log('Note: AI agents are currently using placeholder code.');
    console.log('Full analysis results will be available once implemented.');
    return;
  }

  console.log('\nFeedback Report:');
  console.log('─'.repeat(70));

  if (feedback.reportId) {
    console.log(`\nReport ID: ${feedback.reportId}`);
    console.log(`Title: ${feedback.title || 'N/A'}`);
    console.log(`Type: ${feedback.reportType || 'N/A'}`);
    console.log(`Severity: ${feedback.severity || 'N/A'}`);
    console.log(`Status: ${feedback.reportStatus || 'N/A'}`);
  }

  if (feedback.overallAssessment) {
    console.log('\nContent:');
    console.log(feedback.overallAssessment);
  }

  if (feedback.generatedAt) {
    console.log(`\nGenerated: ${formatDate(feedback.generatedAt)}`);
  }
}

/**
 * Display multiple documents (summary list)
 */
function displayDocumentList(documents) {
  console.log(`\nShowing ${documents.length} most recent document(s):\n`);

  documents.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.filename}`);
    console.log(`   Document ID: ${doc.documentId}`);
    console.log(`   Status: ${doc.status}`);
    console.log(`   AI Status: ${doc.aiAnalysisStatus || 'N/A'}`);
    console.log(`   Submitted: ${formatDate(doc.submissionDate)}`);
    console.log(`   Size: ${doc.fileSize ? (doc.fileSize / 1024).toFixed(2) + ' KB' : 'N/A'}`);
    console.log('');
  });

  console.log('To view detailed results for a specific document, run:');
  console.log(`  npm run query:results -- --document-id <document_id>`);
}

/**
 * Invoke Lambda function
 */
async function queryResults() {
  printSection('Overlay Platform - Query Results');

  console.log(`Function: ${FUNCTION_NAME}`);
  console.log(`Region: ${REGION}`);
  if (documentId) {
    console.log(`Document ID: ${documentId}`);
  } else {
    console.log('Query: Last 10 documents');
  }

  try {
    // Prepare Lambda payload
    const payload = documentId ? { documentId } : {};

    // Invoke Lambda
    console.log('\nInvoking Lambda function...');
    const command = new InvokeCommand({
      FunctionName: FUNCTION_NAME,
      Payload: JSON.stringify(payload),
    });

    const response = await lambdaClient.send(command);

    // Parse response
    const responsePayload = JSON.parse(Buffer.from(response.Payload).toString());
    console.log(`Lambda Status Code: ${response.StatusCode}`);

    if (response.FunctionError) {
      printError('Lambda function returned an error');
      console.log('\nError Details:');
      console.log(JSON.stringify(responsePayload, null, 2));
      process.exit(1);
    }

    // Check response status
    if (responsePayload.statusCode !== 200) {
      printError(`Query failed with status ${responsePayload.statusCode}`);
      console.log('\nResponse:');
      console.log(JSON.stringify(responsePayload.body, null, 2));
      process.exit(1);
    }

    printSuccess('Query completed successfully');

    const result = responsePayload.body;
    const documents = result.documents;

    if (documents.length === 0) {
      printInfo('No documents found');
      process.exit(0);
    }

    // Display results
    if (documentId) {
      // Single document - detailed view
      printSection('Document Details');
      const doc = documents[0];
      displayDocumentSummary(doc);
      displayCriterionScores(doc.criterionScores);
      displayFeedback(doc.feedback);
    } else {
      // Multiple documents - summary list
      printSection('Recent Documents');
      displayDocumentList(documents);
    }

    console.log('\n' + '═'.repeat(70) + '\n');
    printSuccess('Query completed');

  } catch (error) {
    printError('Failed to query results');
    console.log(`\nError: ${error.message}`);

    if (error.name === 'ResourceNotFoundException') {
      console.log(`\nThe Lambda function '${FUNCTION_NAME}' was not found.`);
      console.log('Make sure the ComputeStack has been deployed:');
      console.log('  npx cdk deploy OverlayComputeStack');
    } else if (error.name === 'AccessDeniedException') {
      console.log('\nAccess denied. Check IAM permissions for Lambda:Invoke');
    } else {
      console.log(`\nError Type: ${error.name}`);
      console.log(`Stack: ${error.stack}`);
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  queryResults().catch(console.error);
}

module.exports = { queryResults };
