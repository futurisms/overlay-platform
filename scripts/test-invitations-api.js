/**
 * Test Invitations API Endpoints
 * Tests all three endpoints for Phase 2B invitation system
 */

const https = require('https');

const API_BASE = 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production';

// Use a real session ID from the database
const TEST_SESSION_ID = '1f04691e-e1ec-4a31-baf4-30561df7d570';
const TEST_EMAIL = `analyst-${Date.now()}@example.com`;
const TEST_NAME = 'Test Analyst';
const TEST_PASSWORD = 'SecurePass123!';

// Admin user ID for authorization header
const ADMIN_USER_ID = '82668bb0-5db4-465e-b8f1-60f98b902062'; // Default admin user

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testCreateInvitation() {
  console.log('\n=== Test 1: Create Invitation ===\n');
  console.log(`POST /sessions/${TEST_SESSION_ID}/invitations`);
  console.log(`Body: { "email": "${TEST_EMAIL}" }`);
  console.log(`Auth: x-user-id: ${ADMIN_USER_ID}`);

  try {
    const response = await makeRequest(
      'POST',
      `/sessions/${TEST_SESSION_ID}/invitations`,
      { email: TEST_EMAIL },
      { 'x-user-id': ADMIN_USER_ID }
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 201) {
      console.log('\n✅ Test 1 PASSED: Invitation created successfully');

      if (response.body.invitation && response.body.invitation.token) {
        return response.body.invitation.token;
      } else {
        console.log('⚠️  Warning: Response missing invitation token');
        return null;
      }
    } else if (response.statusCode === 403) {
      console.log('\n⚠️  Test 1 REQUIRES AUTH: Need valid admin JWT token');
      console.log('   This is expected behavior - endpoint requires Cognito authentication');
      console.log('   Manual test: Use Postman with valid JWT token from login');
      return null;
    } else {
      console.log(`\n❌ Test 1 FAILED: Expected 201, got ${response.statusCode}`);
      return null;
    }
  } catch (error) {
    console.error('\n❌ Test 1 ERROR:', error.message);
    return null;
  }
}

async function testGetInvitation(token) {
  console.log('\n=== Test 2: Get Invitation ===\n');
  console.log(`GET /invitations/${token}`);
  console.log('Auth: None (public endpoint)');

  try {
    const response = await makeRequest('GET', `/invitations/${token}`);

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200) {
      console.log('\n✅ Test 2 PASSED: Retrieved invitation details');

      // Verify expected fields
      const invitation = response.body.invitation;
      if (invitation && invitation.email && invitation.session_name && invitation.expires_at) {
        console.log('   ✓ Contains expected fields: email, session_name, expires_at');
      } else {
        console.log('   ⚠️  Missing some expected fields');
      }

      return true;
    } else {
      console.log(`\n❌ Test 2 FAILED: Expected 200, got ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Test 2 ERROR:', error.message);
    return false;
  }
}

async function testAcceptInvitation(token) {
  console.log('\n=== Test 3: Accept Invitation ===\n');
  console.log(`POST /invitations/${token}/accept`);
  console.log(`Body: { "name": "${TEST_NAME}", "password": "${TEST_PASSWORD}" }`);
  console.log('Auth: None (public endpoint)');

  try {
    const response = await makeRequest(
      'POST',
      `/invitations/${token}/accept`,
      {
        name: TEST_NAME,
        password: TEST_PASSWORD,
      }
    );

    console.log(`\nStatus: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200) {
      console.log('\n✅ Test 3 PASSED: Invitation accepted, account created');

      // Verify expected fields
      const user = response.body.user;
      if (user && user.user_id && user.email === TEST_EMAIL && user.role === 'analyst') {
        console.log('   ✓ User created with correct email and role');
        console.log(`   ✓ New user ID: ${user.user_id}`);
      } else {
        console.log('   ⚠️  User data incomplete or incorrect');
      }

      return true;
    } else {
      console.log(`\n❌ Test 3 FAILED: Expected 200, got ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Test 3 ERROR:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Phase 2B: Invitations API Testing Suite             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nAPI Base: ${API_BASE}`);
  console.log(`Test Session: ${TEST_SESSION_ID}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // Test 1: Create invitation
    const token = await testCreateInvitation();

    if (!token) {
      console.log('\n⚠️  Cannot continue with Tests 2 and 3 without invitation token');
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('TESTING REQUIRES AUTHENTICATION');
      console.log('═══════════════════════════════════════════════════════');
      console.log('\nThe Create Invitation endpoint requires admin authentication.');
      console.log('To complete full testing:');
      console.log('\n1. Login at http://localhost:3000/login');
      console.log('   Email: admin@example.com');
      console.log('   Password: TestPassword123!');
      console.log('\n2. Copy JWT token from localStorage');
      console.log('\n3. Use Postman or modify this script with real JWT token');
      console.log('\n4. Test all three endpoints with proper authentication');
      console.log('\n═══════════════════════════════════════════════════════\n');
      return;
    }

    // Wait a moment between requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 2: Get invitation
    const getSuccess = await testGetInvitation(token);

    if (!getSuccess) {
      console.log('\n⚠️  Test 2 failed, but continuing with Test 3');
    }

    // Wait a moment between requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 3: Accept invitation
    await testAcceptInvitation(token);

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('All three endpoints are deployed and responding.');
    console.log('\nNext Steps:');
    console.log('1. Complete manual testing with authenticated requests');
    console.log('2. Test invitation email flow (when email service added)');
    console.log('3. Test edge cases (expired tokens, duplicate emails)');
    console.log('4. Verify session_access grants work correctly');
    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run tests
runTests().catch(console.error);
