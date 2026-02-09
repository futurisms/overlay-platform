#!/usr/bin/env node

/**
 * Create Cognito user for existing database user
 *
 * This script creates a Cognito user account for a user that already exists
 * in the PostgreSQL database but not in Cognito (due to old signup flow).
 *
 * Usage:
 *   node scripts/create-cognito-user-for-existing.js --email bains@healthfabric.co.uk --password Costa321#
 */

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

// Configuration
const REGION = 'eu-west-1';
const USER_POOL_ID = 'eu-west-1_lC25xZ8s6';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const email = getArg('--email');
const password = getArg('--password');
const givenName = getArg('--given-name') || 'Analyst';
const familyName = getArg('--family-name') || 'User';
const group = getArg('--group') || 'document_admin'; // document_admin for analysts

if (!email || !password) {
  console.error('Error: --email and --password are required\n');
  console.log('Usage:');
  console.log('  node scripts/create-cognito-user-for-existing.js --email bains@healthfabric.co.uk --password Costa321#');
  console.log('\nOptional:');
  console.log('  --given-name "First"');
  console.log('  --family-name "Last"');
  console.log('  --group document_admin (default)\n');
  process.exit(1);
}

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

async function createCognitoUser() {
  console.log('Creating Cognito user for existing database user...\n');
  console.log(`User Pool ID: ${USER_POOL_ID}`);
  console.log(`Region: ${REGION}`);
  console.log(`Email: ${email}`);
  console.log(`Group: ${group}\n`);

  try {
    // Step 1: Create user
    console.log('Step 1: Creating Cognito user...');
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: givenName },
        { Name: 'family_name', Value: familyName },
      ],
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS', // Don't send welcome email
      DesiredDeliveryMediums: ['EMAIL'],
    });

    const createUserResponse = await cognitoClient.send(createUserCommand);
    console.log('✅ User created successfully');
    const userSub = createUserResponse.User.Attributes.find(attr => attr.Name === 'sub')?.Value;
    console.log(`   User Sub: ${userSub}`);
    console.log(`   User Status: ${createUserResponse.User.UserStatus}\n`);

    // Step 2: Set permanent password
    console.log('Step 2: Setting permanent password...');
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);
    console.log('✅ Password set as permanent\n');

    // Step 3: Add user to group
    console.log(`Step 3: Adding user to ${group} group...`);
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: group,
    });

    await cognitoClient.send(addToGroupCommand);
    console.log(`✅ User added to ${group} group\n`);

    // Success summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Cognito user created successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Login Credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Group: ${group}\n`);
    console.log('Next Steps:');
    console.log('  1. User can now login at http://localhost:3000/login');
    console.log('  2. Database record already exists (no action needed)');
    console.log('  3. Session access already granted (if applicable)\n');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error creating Cognito user:\n');

    if (error.name === 'UsernameExistsException') {
      console.error('   User already exists in Cognito. Nothing to do.');
      console.error('   User should be able to login with their existing credentials.\n');
    } else if (error.name === 'InvalidPasswordException') {
      console.error('   Password does not meet requirements:');
      console.error('   - Minimum 12 characters');
      console.error('   - At least one uppercase letter');
      console.error('   - At least one lowercase letter');
      console.error('   - At least one number');
      console.error('   - At least one special character\n');
    } else if (error.name === 'InvalidParameterException') {
      console.error('   Invalid parameter:', error.message);
      console.error('   Check that email format is valid and all required fields are provided.\n');
    } else {
      console.error('   Error:', error.name);
      console.error('   Message:', error.message);
      console.error('\n   Full error:', error);
    }

    process.exit(1);
  }
}

// Run the script
createCognitoUser().catch(console.error);
