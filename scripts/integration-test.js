#!/usr/bin/env node

/**
 * Integration Test Suite - v1.2
 * Validates all 9 critical bug fixes from v1.2 release
 * Run after every deployment to ensure no regressions
 *
 * Usage:
 *   export AUTH_TOKEN='your-token'
 *   node scripts/integration-test.js
 */

const https = require('https');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Test tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

// Test data
let testSessionId = null;
let testOverlayId = null;
let testSubmissionId = null;

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Helper functions
function logInfo(msg) {
  console.log(`${colors.blue}ℹ ${colors.reset}${msg}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function logError(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function logWarning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function testStart(name) {
  testsRun++;
  console.log('');
  logInfo(`Test ${testsRun}: ${name}`);
}

function testPass(msg) {
  testsPassed++;
  logSuccess(`PASS: ${msg}`);
}

function testFail(msg) {
  testsFailed++;
  failures.push(`Test ${testsRun}: ${msg}`);
  logError(`FAIL: ${msg}`);
}

// API helper
function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function test1_ScoreCalculationAccuracy() {
  testStart('Score Calculation Accuracy - List vs Detail Match');

  try {
    // Get sessions
    const { data: sessions } = await apiRequest('GET', '/sessions');
    if (!sessions.sessions || sessions.sessions.length === 0) {
      testFail('No sessions found to test');
      return;
    }

    testSessionId = sessions.sessions[0].session_id;

    // Get session detail
    const { data: sessionDetail } = await apiRequest('GET', `/sessions/${testSessionId}`);

    if (!sessionDetail.submissions || sessionDetail.submissions.length === 0) {
      logWarning('No submissions found - skipping score test');
      return;
    }

    const detailScore = sessionDetail.submissions[0].overall_score;
    testSubmissionId = sessionDetail.submissions[0].submission_id;

    // Get submissions list
    const { data: submissionsList } = await apiRequest('GET', `/sessions/${testSessionId}/submissions`);
    const listScore = submissionsList.submissions[0].overall_score;

    if (detailScore === listScore) {
      testPass(`Scores match (List: ${listScore}, Detail: ${detailScore})`);
    } else {
      testFail(`Score mismatch - List: ${listScore}, Detail: ${detailScore}`);
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test2_SubmissionsListVisibility() {
  testStart('Submissions List Visibility - Array Present and Accurate');

  try {
    if (!testSessionId) {
      testFail('No test session ID available');
      return;
    }

    const { data: sessionDetail } = await apiRequest('GET', `/sessions/${testSessionId}`);

    if (!sessionDetail.submissions) {
      testFail('Submissions array missing from response');
      return;
    }

    const submissionCount = sessionDetail.submission_count || 0;
    const actualCount = sessionDetail.submissions.length;

    if (submissionCount === actualCount) {
      testPass(`Submissions array present with correct count (${submissionCount})`);
    } else {
      testFail(`Count mismatch - Header: ${submissionCount}, Actual: ${actualCount}`);
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test3_CriteriaPersistence() {
  testStart('Criteria Persistence - Save and Verify in Database');

  try {
    const timestamp = Date.now();

    // Create overlay
    const { data: createResp } = await apiRequest('POST', '/overlays', {
      name: `Test Overlay ${timestamp}`,
      description: 'Integration test overlay',
      document_type: 'test',
    });

    testOverlayId = createResp.overlay_id;

    if (!testOverlayId) {
      testFail('Failed to create test overlay');
      return;
    }

    logInfo(`Created test overlay: ${testOverlayId}`);

    // Add criterion
    await apiRequest('PUT', `/overlays/${testOverlayId}`, {
      name: `Test Overlay ${timestamp}`,
      criteria: [
        {
          name: 'Test Criterion',
          description: 'Integration test criterion',
          weight: 0.2,
          max_score: 100,
          category: 'test',
        },
      ],
    });

    // Wait for database write
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify
    const { data: overlayDetail } = await apiRequest('GET', `/overlays/${testOverlayId}`);

    if (overlayDetail.criteria && overlayDetail.criteria.some(c => c.name === 'Test Criterion')) {
      testPass('Criterion persisted successfully');
    } else {
      testFail('Criterion not found after save');
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test4_FieldNameConsistency() {
  testStart('Field Name Consistency - overall_score vs avg_score');

  try {
    if (!testSessionId) {
      testFail('No test session ID available');
      return;
    }

    const { data: submissionsList } = await apiRequest('GET', `/sessions/${testSessionId}/submissions`);
    const responseText = JSON.stringify(submissionsList);

    if (responseText.includes('overall_score')) {
      if (responseText.includes('avg_score')) {
        testFail("Old field name 'avg_score' still present");
      } else {
        testPass("Uses correct field name 'overall_score'");
      }
    } else {
      testFail("Field 'overall_score' not found in response");
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test5_StatusFiltering() {
  testStart('Status Filtering - Only Active Sessions Returned');

  try {
    const { data: sessions } = await apiRequest('GET', '/sessions');

    if (!sessions.sessions) {
      testFail('No sessions in response');
      return;
    }

    const archivedCount = sessions.sessions.filter(s => s.status === 'archived').length;
    const totalSessions = sessions.sessions.length;

    if (archivedCount === 0) {
      testPass(`No archived sessions in list (${totalSessions} active sessions)`);
    } else {
      testFail(`Found ${archivedCount} archived sessions (should be 0)`);
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test6_JSONBPathSafety() {
  testStart('JSONB Path Safety - COALESCE Fallback Works');

  try {
    if (!testSessionId) {
      testFail('No test session ID available');
      return;
    }

    const { statusCode } = await apiRequest('GET', `/sessions/${testSessionId}/submissions`);

    if (statusCode === 200) {
      testPass('Submissions endpoint returns 200 (COALESCE working)');
    } else {
      testFail(`Submissions endpoint returned ${statusCode} (COALESCE may be broken)`);
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test7_CompleteResponsePayloads() {
  testStart('Complete Response Payloads - All Required Fields Present');

  try {
    if (!testSessionId) {
      testFail('No test session ID available');
      return;
    }

    const { data: sessionDetail } = await apiRequest('GET', `/sessions/${testSessionId}`);
    const missingFields = [];

    // Check required fields
    if (!sessionDetail.session_id) missingFields.push('session_id');
    if (!sessionDetail.name) missingFields.push('name');
    if (!sessionDetail.participants) missingFields.push('participants');
    if (!sessionDetail.submissions) missingFields.push('submissions');
    if (sessionDetail.submission_count === undefined) missingFields.push('submission_count');

    if (missingFields.length === 0) {
      testPass('All required fields present');
    } else {
      testFail(`Missing fields: ${missingFields.join(', ')}`);
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test8_PostgreSQLTypeCasting() {
  testStart('PostgreSQL Type Casting - ::jsonb Cast Working');

  try {
    if (!testSessionId) {
      testFail('No test session ID available');
      return;
    }

    const { statusCode: sessionCode } = await apiRequest('GET', `/sessions/${testSessionId}`);
    const { statusCode: submissionsCode } = await apiRequest('GET', `/sessions/${testSessionId}/submissions`);

    if (sessionCode === 200 && submissionsCode === 200) {
      testPass('Both endpoints return 200 (no SQL operator errors)');
    } else {
      testFail(`Error codes - Session: ${sessionCode}, Submissions: ${submissionsCode}`);
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

async function test9_StatusFieldPresence() {
  testStart('Status Field Presence - is_active Field Returned');

  try {
    if (!testOverlayId) {
      logWarning('No test overlay - using first available overlay');
      const { data: overlays } = await apiRequest('GET', '/overlays');
      if (overlays.overlays && overlays.overlays.length > 0) {
        testOverlayId = overlays.overlays[0].overlay_id;
      }
    }

    if (!testOverlayId) {
      testFail('No overlay available to test');
      return;
    }

    const { data: overlayDetail } = await apiRequest('GET', `/overlays/${testOverlayId}`);

    if (overlayDetail.criteria && overlayDetail.criteria.some(c => c.is_active === true)) {
      testPass('Criteria include is_active field');
    } else {
      testFail('is_active field missing or false');
    }
  } catch (error) {
    testFail(`Error: ${error.message}`);
  }
}

// Main execution
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Integration Test Suite - v1.2 Bug Verification         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  logInfo(`API Base URL: ${API_BASE_URL}`);
  logInfo(`Starting tests at ${new Date().toISOString()}`);
  console.log('');

  // Check auth token
  if (!AUTH_TOKEN) {
    logError('AUTH_TOKEN not set. Please set it with:');
    console.log('  export AUTH_TOKEN=\'your-token-here\'');
    console.log('  # or on Windows:');
    console.log('  set AUTH_TOKEN=your-token-here');
    process.exit(1);
  }

  // Run all tests
  await test1_ScoreCalculationAccuracy();
  await test2_SubmissionsListVisibility();
  await test3_CriteriaPersistence();
  await test4_FieldNameConsistency();
  await test5_StatusFiltering();
  await test6_JSONBPathSafety();
  await test7_CompleteResponsePayloads();
  await test8_PostgreSQLTypeCasting();
  await test9_StatusFieldPresence();

  // Results summary
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      Test Results Summary                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  logInfo(`Tests Run:    ${testsRun}`);
  logSuccess(`Tests Passed: ${testsPassed}`);
  if (testsFailed > 0) {
    logError(`Tests Failed: ${testsFailed}`);
  } else {
    logSuccess(`Tests Failed: ${testsFailed}`);
  }

  console.log('');

  if (testsFailed > 0) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         FAILURES                               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    failures.forEach(failure => logError(failure));
    console.log('');
  }

  // Calculate pass rate
  const passRate = ((testsPassed / testsRun) * 100).toFixed(1);

  console.log('');
  console.log(`Pass Rate: ${passRate}%`);
  console.log('');

  if (testsFailed === 0) {
    logSuccess('✓ ALL TESTS PASSED - Platform is stable');
    console.log('');
    logInfo('Next steps:');
    console.log('  - All v1.2 bug fixes verified working');
    console.log('  - Platform ready for normal operations');
    console.log('  - Create Q12-Q18 sessions as needed');
    process.exit(0);
  } else {
    logError('✗ TESTS FAILED - Platform may have issues');
    console.log('');
    logInfo('Action required:');
    console.log('  - Check CloudWatch logs for errors');
    console.log('  - Review CRITICAL_INTEGRATION_POINTS.md');
    console.log('  - Consider rollback if severity is CRITICAL');
    console.log('  - Run manual verification from TESTING_CHECKLIST.md');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
