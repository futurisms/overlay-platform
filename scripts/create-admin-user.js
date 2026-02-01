#!/usr/bin/env node

/**
 * Create Admin User in Cognito User Pool
 *
 * This script creates an admin user in the Cognito User Pool
 * and adds them to the system_admin group.
 *
 * Usage:
 *   node scripts/create-admin-user.js
 *   node scripts/create-admin-user.js --email admin@example.com
 *   node scripts/create-admin-user.js --email admin@example.com --password "SecurePass456!"
 *
 * Note: The User Pool is configured with email as the sign-in alias.
 *       Username will default to the email if not explicitly provided.
 */

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

// Configuration
const REGION = 'eu-west-1';
const USER_POOL_ID = 'eu-west-1_lC25xZ8s6'; // From deployment outputs

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const email = getArg('--email') || 'admin@example.com';
// Since the User Pool is configured with email as sign-in alias, username must be an email
const username = getArg('--username') || email;
const tempPassword = getArg('--password') || 'TempPass123!';
const givenName = getArg('--given-name') || 'Admin';
const familyName = getArg('--family-name') || 'User';

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

async function createAdminUser() {
  console.log('Creating admin user in Cognito User Pool...\n');
  console.log(`User Pool ID: ${USER_POOL_ID}`);
  console.log(`Region: ${REGION}`);
  console.log(`Email: ${email}`);
  console.log(`Username: ${username}`);
  console.log(`Given Name: ${givenName}`);
  console.log(`Family Name: ${familyName}\n`);

  try {
    // Step 1: Create user
    console.log('Step 1: Creating user...');
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
        {
          Name: 'given_name',
          Value: givenName,
        },
        {
          Name: 'family_name',
          Value: familyName,
        },
      ],
      TemporaryPassword: tempPassword,
      MessageAction: 'SUPPRESS', // Don't send welcome email
      DesiredDeliveryMediums: ['EMAIL'],
    });

    const createUserResponse = await cognitoClient.send(createUserCommand);
    console.log('✅ User created successfully');
    console.log(`   User Sub: ${createUserResponse.User.Attributes.find(attr => attr.Name === 'sub')?.Value}`);
    console.log(`   User Status: ${createUserResponse.User.UserStatus}\n`);

    // Step 2: Set permanent password
    console.log('Step 2: Setting permanent password...');
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: tempPassword,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);
    console.log('✅ Password set as permanent\n');

    // Step 3: Add user to system_admin group
    console.log('Step 3: Adding user to system_admin group...');
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: 'system_admin',
    });

    await cognitoClient.send(addToGroupCommand);
    console.log('✅ User added to system_admin group\n');

    // Success summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Admin user created successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Login Credentials:');
    console.log(`  Email/Username: ${username}`);
    console.log(`  Password: ${tempPassword}`);
    console.log(`  Email: ${email}`);
    console.log(`  Group: system_admin\n`);
    console.log('User Details:');
    console.log(`  User Pool ID: ${USER_POOL_ID}`);
    console.log(`  Region: ${REGION}`);
    console.log(`  Email Verified: Yes`);
    console.log(`  Account Status: Active\n`);
    console.log('Next Steps:');
    console.log('  1. Test login via API:');
    console.log('     curl -X POST "https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/auth" \\');
    console.log('       -H "Content-Type: application/json" \\');
    console.log('       -d \'{"action": "login", "email": "' + username + '", "password": "' + tempPassword + '"}\'');
    console.log('\n  2. Change password on first login');
    console.log('  3. Enable MFA (optional)\n');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error creating admin user:\n');

    if (error.name === 'UsernameExistsException') {
      console.error('   User already exists. Try a different username or delete the existing user first.');
      console.error('\n   To delete existing user:');
      console.error(`   aws cognito-idp admin-delete-user --user-pool-id ${USER_POOL_ID} --username ${username} --region ${REGION}\n`);
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
if (require.main === module) {
  createAdminUser().catch(console.error);
}

module.exports = { createAdminUser };
