# Utility Scripts

## Overview

This folder contains utility scripts for managing the Overlay Platform infrastructure.

## Scripts

### Database Management
- **run-migrations.ts** - Automated migration runner that executes SQL files on Aurora
- **invoke-migration-lambda.ts** - Invoke the database migration Lambda function

### User Management
- **create-admin-user.js** - Create an admin user in Cognito User Pool

### Configuration Management
- **seed-llm-config.js** - Populate LLM configuration table for all 6 AI agents

### Testing
- **test-api.js** - Test API endpoints with Cognito authentication

---

# User Management

## Creating an Admin User

The `create-admin-user.js` script creates an admin user in the Cognito User Pool and adds them to the `system_admin` group.

### Quick Start

```bash
# Using npm script (recommended)
npm run create-admin

# Or run directly
node scripts/create-admin-user.js
```

### Custom Parameters

```bash
# Create user with custom email
npm run create-admin -- --email admin@company.com

# Specify all parameters
node scripts/create-admin-user.js \
  --email admin@company.com \
  --password "SecurePass456!" \
  --given-name "John" \
  --family-name "Doe"
```

**Note**: The User Pool is configured with email as the sign-in alias. The username will automatically be set to the email address.

### Default Values

If no parameters are provided, the script uses these defaults:
- **Email**: `admin@example.com`
- **Username**: Same as email (Cognito requirement)
- **Password**: `TempPass123!`
- **Given Name**: `Admin`
- **Family Name**: `User`

### What the Script Does

1. Creates a new user in Cognito User Pool
2. Sets email as verified (no verification email needed)
3. Sets password as permanent (no forced password change)
4. Adds user to `system_admin` group
5. Returns login credentials

### Output Example

```
Creating admin user in Cognito User Pool...

User Pool ID: eu-west-1_lC25xZ8s6
Region: eu-west-1
Email: admin@company.com
Username: admin

Step 1: Creating user...
✅ User created successfully
   User Sub: 12345678-1234-1234-1234-123456789abc
   User Status: FORCE_CHANGE_PASSWORD

Step 2: Setting permanent password...
✅ Password set as permanent

Step 3: Adding user to system_admin group...
✅ User added to system_admin group

═══════════════════════════════════════════════════════════
✅ Admin user created successfully!
═══════════════════════════════════════════════════════════

Login Credentials:
  Email/Username: admin
  Password: TempPass123!
  Email: admin@company.com
  Group: system_admin

User Details:
  User Pool ID: eu-west-1_lC25xZ8s6
  Region: eu-west-1
  Email Verified: Yes
  Account Status: Active
```

### Testing the New User

After creating the user, test authentication:

```bash
# Login via API
curl -X POST "https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/auth" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "login",
    "email": "admin",
    "password": "TempPass123!"
  }'
```

### Troubleshooting

#### User Already Exists

```
❌ Error: UsernameExistsException
   User already exists. Try a different username or delete the existing user first.
```

**Solution**: Delete the existing user and try again:

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin \
  --region eu-west-1
```

#### Invalid Password

```
❌ Error: InvalidPasswordException
   Password does not meet requirements
```

**Solution**: Ensure password meets these requirements:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Invalid Email Format

```
❌ Error: InvalidParameterException
   Invalid parameter: email format is invalid
```

**Solution**: Provide a valid email address (e.g., `admin@example.com`)

#### AWS Credentials Not Configured

```
❌ Error: CredentialsProviderError
   Could not load credentials from any providers
```

**Solution**: Configure AWS credentials:

```bash
# Option 1: AWS CLI configure
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=eu-west-1

# Option 3: Use AWS SSO
aws sso login --profile your-profile
```

### Managing Users

#### List Users

```bash
aws cognito-idp list-users \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --region eu-west-1
```

#### Get User Details

```bash
aws cognito-idp admin-get-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin \
  --region eu-west-1
```

#### List Users in Group

```bash
aws cognito-idp list-users-in-group \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --group-name system_admin \
  --region eu-west-1
```

#### Delete User

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin \
  --region eu-west-1
```

#### Reset Password

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin \
  --password "NewPassword456!" \
  --permanent \
  --region eu-west-1
```

#### Enable/Disable User

```bash
# Disable user
aws cognito-idp admin-disable-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin \
  --region eu-west-1

# Enable user
aws cognito-idp admin-enable-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin \
  --region eu-west-1
```

---

# Configuration Management

## Seeding LLM Configuration

The `seed-llm-config.js` script populates the `overlay-llm-config` DynamoDB table with configuration for all 6 AI agents in the document analysis workflow.

### Quick Start

```bash
# Using npm script (recommended)
npm run seed:llm-config

# Or run directly
node scripts/seed-llm-config.js
```

### What Gets Created

The script seeds configurations for 6 AI agents:

**Bedrock Agents** (Fast, cost-effective):
- **structure_validator**: Claude Haiku v2 (0.3 temp, 4K tokens)
- **grammar_checker**: Claude Haiku v2 (0.2 temp, 4K tokens)

**Claude API Agents** (Advanced reasoning):
- **content_analyzer**: Claude Sonnet 4 (0.5 temp, 8K tokens)
- **orchestrator**: Claude Sonnet 4 (0.5 temp, 8K tokens)
- **clarification**: Claude Sonnet 4 (0.5 temp, 8K tokens)
- **scoring**: Claude Sonnet 4 (0.5 temp, 8K tokens)

### Configuration Format

Each configuration includes:
```json
{
  "configId": "CONFIG#global",
  "version": 1768914558489,
  "agentName": "structure_validator",
  "sortKey": "llm_provider#structure_validator",
  "provider": "bedrock",
  "model": "anthropic.claude-haiku-4-v2",
  "temperature": 0.3,
  "maxTokens": 4000,
  "isActive": "true",
  "retryAttempts": 3,
  "timeout": 120,
  "description": "Fast document structure validation",
  "createdAt": "2026-01-20T13:09:18.489Z",
  "lastModified": 1768914558489,
  "updatedBy": "seed-script"
}
```

### Output Example

```
═══════════════════════════════════════════════════════════
Seeding LLM Configuration Table
═══════════════════════════════════════════════════════════

Table: overlay-llm-config
Region: eu-west-1
Agents: 6

Checking for existing configurations...
✅ No existing configurations found. Starting fresh.

Seeding configurations:

  Seeding structure_validator...
    Provider: bedrock
    Model: anthropic.claude-haiku-4-v2
    Temperature: 0.3
    Max Tokens: 4000
    Sort Key: llm_provider#structure_validator
  ✅ structure_validator seeded successfully

  [... 5 more agents ...]

═══════════════════════════════════════════════════════════
✅ All configurations seeded successfully!
═══════════════════════════════════════════════════════════

Configuration Summary:

Bedrock Agents (2):
  - structure_validator: anthropic.claude-haiku-4-v2
  - grammar_checker: anthropic.claude-haiku-4-v2

Claude API Agents (4):
  - content_analyzer: claude-sonnet-4-20250514
  - orchestrator: claude-sonnet-4-20250514
  - clarification: claude-sonnet-4-20250514
  - scoring: claude-sonnet-4-20250514
```

### Verifying Configurations

```bash
# List all configurations
aws dynamodb scan \
  --table-name overlay-llm-config \
  --region eu-west-1

# Get specific agent config
aws dynamodb scan \
  --table-name overlay-llm-config \
  --region eu-west-1 \
  --filter-expression "agentName = :name" \
  --expression-attribute-values '{":name":{"S":"structure_validator"}}'

# Query active configs using GSI
aws dynamodb query \
  --table-name overlay-llm-config \
  --region eu-west-1 \
  --index-name ActiveConfigIndex \
  --key-condition-expression "isActive = :active" \
  --expression-attribute-values '{":active":{"S":"true"}}'
```

### When to Use This

Run this script:
1. **After deploying OverlayStorageStack** - Table must exist first
2. **Before testing AI agents** - Agents need config to run
3. **After updating model versions** - Re-seed with new models
4. **For different environments** - Seed dev/staging/prod separately

### Troubleshooting

#### Table Not Found

```
❌ Error: Table 'overlay-llm-config' not found.
   Please ensure the OverlayStorageStack has been deployed.
```

**Solution**: Deploy the storage stack first:
```bash
npx cdk deploy OverlayStorageStack
```

#### Access Denied

```
❌ Error: AccessDeniedException
   Access denied. Check IAM permissions for DynamoDB
```

**Solution**: Ensure your IAM user/role has these permissions:
- `dynamodb:PutItem`
- `dynamodb:Scan`

Configure AWS credentials:
```bash
aws configure
```

#### Validation Error

```
❌ Error: ValidationException
   Type mismatch for Index Key
```

**Solution**: This indicates a schema mismatch. The script expects:
- `isActive`: STRING type (for GSI)
- `lastModified`: NUMBER type (for GSI)

This should be handled automatically by the script.

### Re-running the Script

The script can be run multiple times. Each run creates configurations with new version numbers (timestamps), so previous configs are retained. The DynamoDB table uses:
- **Partition Key**: `configId` (always `CONFIG#global`)
- **Sort Key**: `version` (timestamp, unique per run)

To clean up old versions, manually delete items via AWS Console or CLI.

### Customizing Configurations

To modify agent settings, edit the `agentConfigurations` array in [scripts/seed-llm-config.js](scripts/seed-llm-config.js):

```javascript
{
  agentName: 'structure_validator',
  provider: 'bedrock',
  model: 'anthropic.claude-haiku-4-v2',  // Change model
  temperature: 0.3,                       // Adjust temperature
  maxTokens: 4000,                        // Adjust token limit
  // ...
}
```

Then re-run:
```bash
npm run seed:llm-config
```

---

# Database Migrations

## Running Migrations

### Prerequisites

Aurora is deployed in **isolated subnets** with no public internet access for security. To run migrations, you need to connect from within the VPC.

### Option 1: Using AWS Systems Manager Session Manager (Recommended)

1. **Create a Bastion Host** (One-time setup)

```bash
# Create EC2 instance in private subnet
aws ec2 run-instances \
  --image-id ami-0c38b837cd80f13bb \
  --instance-type t3.micro \
  --subnet-id subnet-xxxxx \
  --iam-instance-profile Name=SSMInstanceProfile \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=overlay-bastion}]'
```

2. **Connect via Session Manager**

```bash
# Connect to bastion
aws ssm start-session --target i-xxxxx
```

3. **Install Dependencies on Bastion**

```bash
# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL client
sudo yum install -y postgresql15

# Install Git
sudo yum install -y git
```

4. **Clone Repository and Run Migrations**

```bash
# Clone your repository
git clone https://github.com/yourorg/overlay-platform.git
cd overlay-platform

# Install dependencies
npm install

# Run migrations
npm run migrate
```

### Option 2: Using EC2 Connect or SSH

1. Create an EC2 instance in a **private subnet** (same VPC as Aurora)
2. Ensure the instance has internet access via NAT Gateway
3. Configure security group to allow PostgreSQL (5432) from bastion to Aurora
4. SSH into the instance
5. Follow steps 3-4 from Option 1

### Option 3: VPN Connection

1. Set up AWS Client VPN or Site-to-Site VPN
2. Connect to VPC via VPN
3. Run migrations from your local machine:

```bash
npm run migrate
```

### Option 4: Manual Migration with psql

If you have VPC connectivity (via VPN or bastion):

```bash
# Get Aurora endpoint
export DB_ENDPOINT="overlaystoragestack-auroracluster23d869c0-higkke9k7oro.cluster-chwcq22k4a75.eu-west-1.rds.amazonaws.com"

# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id overlay/aurora/production/credentials \
  --region eu-west-1 \
  --query SecretString \
  --output text > /tmp/credentials.json

# Extract credentials
export DB_USER=$(cat /tmp/credentials.json | jq -r .username)
export DB_PASS=$(cat /tmp/credentials.json | jq -r .password)
export DB_NAME=$(cat /tmp/credentials.json | jq -r .dbname)

# Run migrations
PGPASSWORD=$DB_PASS psql \
  -h $DB_ENDPOINT \
  -U $DB_USER \
  -d $DB_NAME \
  -f migrations/000_initial_schema.sql

PGPASSWORD=$DB_PASS psql \
  -h $DB_ENDPOINT \
  -U $DB_USER \
  -d $DB_NAME \
  -f migrations/001_seed_data.sql

# Clean up credentials
rm /tmp/credentials.json
```

## Quick Setup: Bastion Host with CDK

Add this to your storage stack to create a bastion host automatically:

```typescript
// In storage-stack.ts

// Create bastion host security group
const bastionSG = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
  vpc: this.vpc,
  description: 'Security group for bastion host',
  allowAllOutbound: true,
});

// Create bastion host
const bastion = new ec2.BastionHostLinux(this, 'BastionHost', {
  vpc: this.vpc,
  subnetSelection: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  },
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
});

// Allow bastion to connect to Aurora
auroraSG.addIngressRule(
  ec2.Peer.securityGroupId(bastion.instanceId),
  ec2.Port.tcp(5432),
  'Allow PostgreSQL access from bastion'
);
```

Then deploy and connect:

```bash
# Deploy with bastion
cdk deploy OverlayStorageStack

# Connect via Session Manager
aws ssm start-session --target <bastion-instance-id>

# Run migrations from bastion
cd /tmp
git clone https://github.com/yourorg/overlay-platform.git
cd overlay-platform
npm install
npm run migrate
```

## Verifying Migrations

After running migrations, verify with:

```bash
# Connect to database
psql -h $DB_ENDPOINT -U $DB_USER -d $DB_NAME

# Check tables
\dt

# Check data
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM overlays;

# Exit
\q
```

## Troubleshooting

### Connection Timeout

```
Error: timeout expired
```

**Cause**: Aurora is not accessible from your current location.

**Solution**: Connect from within VPC (bastion host, VPN, or EC2 instance).

### Authentication Failed

```
Error: password authentication failed
```

**Cause**: Incorrect credentials or credentials not retrieved properly.

**Solution**:
1. Verify secret exists: `aws secretsmanager get-secret-value --secret-id overlay/aurora/production/credentials`
2. Check IAM permissions for Secrets Manager access
3. Ensure AWS credentials are configured

### SSL/TLS Issues

```
Error: SSL connection has been closed unexpectedly
```

**Cause**: SSL certificate validation issues.

**Solution**: The script uses `rejectUnauthorized: false` for Aurora's AWS certificates. This is normal for RDS.

### Permission Denied

```
Error: permission denied to create extension
```

**Cause**: User doesn't have superuser privileges.

**Solution**: Extensions are created with IF NOT EXISTS, so this warning can be ignored if extensions already exist.

## Security Best Practices

1. **Never hardcode credentials** - Always use AWS Secrets Manager
2. **Use IAM authentication** for production (optional enhancement)
3. **Restrict bastion access** - Use Session Manager instead of SSH keys
4. **Rotate credentials regularly** - Set up automatic rotation in Secrets Manager
5. **Audit database access** - Enable CloudWatch Logs and CloudTrail

## Cost Optimization

**Bastion Host Costs**:
- t3.micro: ~$7.50/month (if running 24/7)
- **Recommendation**: Stop bastion when not in use, or use Session Manager on-demand

```bash
# Stop bastion to save costs
aws ec2 stop-instances --instance-ids i-xxxxx

# Start when needed
aws ec2 start-instances --instance-ids i-xxxxx
```

## Alternative: AWS Lambda for Migrations

For production, consider deploying migrations via Lambda:

1. Create Lambda function in VPC
2. Grant access to Aurora security group
3. Trigger Lambda to run migrations
4. Use CloudWatch Logs for monitoring

This approach:
- ✅ No bastion host costs
- ✅ Automatic VPC connectivity
- ✅ Audit trail via CloudWatch
- ✅ Can be triggered from CI/CD pipeline

## Next Steps

After successful migration:
1. Verify all 15 tables are created
2. Check seed data is populated
3. Test application connectivity
4. Set up database monitoring
5. Configure backup retention

---

# Testing

## API Testing

The `test-api.js` script tests the deployed API Gateway endpoints by authenticating with Cognito and making authenticated requests.

### Quick Start

```bash
# Using npm script (recommended)
npm run test:api

# Or run directly
node scripts/test-api.js
```

### Custom Credentials

```bash
# Test with different credentials
npm run test:api -- --email your-email@example.com --password YourPassword123!
```

### What Gets Tested

The script performs the following tests:

1. **Authentication** (`POST /auth`)
   - Logs in with Cognito using admin credentials
   - Retrieves JWT ID token (required for API Gateway authorization)
   - Displays user information from ID token

2. **GET /overlays**
   - Lists all overlays from the database
   - Tests Cognito JWT authorization
   - Displays overlay details

3. **GET /sessions**
   - Lists review sessions for the user
   - Tests authenticated endpoint access

4. **POST /overlays**
   - Attempts to create a test overlay
   - Tests write operations with authentication

**Important**: API Gateway's Cognito User Pool authorizer requires the **ID token**, not the access token. The ID token contains user identity claims (email, name, groups) while the access token is used for authorization scopes.

### Output Example

```
══════════════════════════════════════════════════════════════════════
Overlay Platform API Test Suite
══════════════════════════════════════════════════════════════════════

API Base URL: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/
Timestamp: 2026-01-20T13:22:19.857Z

══════════════════════════════════════════════════════════════════════
Step 1: Authenticating with Cognito
══════════════════════════════════════════════════════════════════════

Email: admin@example.com
Password: ************

✅ Authentication successful!

JWT ID Token (first 50 chars): eyJraWQiOiJc...
Token Type: Bearer
Expires In: 3600 seconds

User Info:
  Email: admin@example.com
  Sub: e2c51414-40b1-701b-493d-a6179aadad96
  Groups: system_admin

══════════════════════════════════════════════════════════════════════
Step 2: Testing GET /overlays
══════════════════════════════════════════════════════════════════════

Endpoint: GET https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays
Authorization: Bearer eyJraWQiOiJc...

Status Code: 200
✅ GET /overlays successful

Found 0 overlay(s):

[... continues with other tests ...]

══════════════════════════════════════════════════════════════════════
Test Results Summary
══════════════════════════════════════════════════════════════════════

Authentication:     ✅ PASS
GET /overlays:      ✅ PASS
GET /sessions:      ✅ PASS
POST /overlays:     ✅ PASS

Total: 4/4 tests passed

🎉 All tests passed!
```

### Known Issues

#### Authentication Failure - Missing Client ID

If you see this error:
```
❌ Authentication failed
Status Code: 500
Response: {
  "error": "1 validation error detected: Value null at 'clientId' failed to satisfy constraint: Member must not be null"
}
```

**Cause**: The auth Lambda is missing the `USER_POOL_CLIENT_ID` environment variable.

**Fix**: See [KNOWN-ISSUES.md](../KNOWN-ISSUES.md#authentication-lambda-missing-client-id) for detailed fix instructions.

#### 501 Not Implemented

If endpoints return 501 status:
```
ℹ️  Endpoint not yet implemented (501 Not Implemented)
This is expected - the endpoint is a placeholder.
```

**Cause**: Lambda functions contain placeholder code without full business logic.

**Status**: This is expected. The script treats 501 as a pass since it confirms the infrastructure is working.

#### 401 Unauthorized

If you see:
```
❌ Authorization failed (401 Unauthorized)
```

**Possible causes**:
- JWT token is invalid or expired
- Cognito authorizer configuration issue
- User not in correct group
- API Gateway configuration error

**Troubleshooting**:
1. Verify admin user exists: `npm run create-admin`
2. Check user is in system_admin group
3. Verify Cognito User Pool Client ID is correct
4. Check API Gateway authorizer configuration

### HTTP Status Code Reference

| Status | Meaning | Test Result |
|--------|---------|-------------|
| 200 | Success | ✅ PASS |
| 201 | Created | ✅ PASS |
| 401 | Unauthorized | ❌ FAIL |
| 403 | Forbidden | ❌ FAIL |
| 500 | Server Error | ❌ FAIL |
| 501 | Not Implemented | ✅ PASS (expected for placeholders) |

### Customizing the Script

Edit [scripts/test-api.js](scripts/test-api.js) to:

**Add New Test Endpoints**:
```javascript
async function testGetSubmissions(accessToken) {
  const response = await makeRequest(`${API_BASE_URL}submissions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  // ... handle response
}
```

**Change Test Data**:
```javascript
const testOverlay = {
  name: 'My Custom Test Overlay',
  documentType: 'essay',
  // ... customize fields
};
```

**Test Different Users**:
```bash
# Create a document admin user
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username docadmin@example.com \
  ...

aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username docadmin@example.com \
  --group-name document_admin

# Test with that user
npm run test:api -- --email docadmin@example.com --password Password123!
```

### Automated Testing in CI/CD

To use in CI/CD pipelines:

```bash
#!/bin/bash
# test-deployment.sh

# Exit on first failure
set -e

echo "Running API tests..."
npm run test:api

if [ $? -eq 0 ]; then
  echo "✅ API tests passed"
  exit 0
else
  echo "❌ API tests failed"
  exit 1
fi
```

### Debugging Failed Tests

Enable verbose logging:
1. Add console.log statements in `scripts/test-api.js`
2. Check CloudWatch Logs for Lambda execution errors:
   ```bash
   aws logs tail /aws/lambda/overlay-api-auth --follow --region eu-west-1
   aws logs tail /aws/lambda/overlay-api-overlays --follow --region eu-west-1
   ```
3. Verify API Gateway access logs
4. Check Cognito authentication logs

### Next Steps After Testing

Once tests pass:
1. ✅ Infrastructure is correctly deployed
2. ✅ Authentication is working
3. ✅ API Gateway is accessible
4. ⏳ Implement full business logic in Lambdas
5. ⏳ Add database operations
6. ⏳ Test document upload workflow
7. ⏳ Test Step Functions execution

---

## End-to-End Workflow Testing

The `test-workflow.js` script tests the complete document analysis workflow from document upload to final results retrieval.

### Quick Start

```bash
# Using npm script (recommended)
npm run test:workflow

# Or run directly
node scripts/test-workflow.js
```

### What Gets Tested

The script performs a complete end-to-end test:

1. **Document Creation**
   - Creates a test contract document with sample text
   - Includes intentional grammar errors for testing
   - Generates unique filename with timestamp

2. **S3 Upload**
   - Uploads document to `overlay-docs-975050116849` bucket
   - Places in `submissions/` folder
   - Adds metadata for tracking

3. **S3 Event Trigger**
   - Waits for S3 event notification
   - Monitors for Step Functions execution start
   - Max wait time: 30 seconds

4. **Step Functions Monitoring**
   - Real-time progress tracking
   - Shows each state transition:
     - Extract Document
     - Parallel Analysis (Structure, Content, Grammar)
     - Orchestrator Decision
     - Clarification (if needed)
     - Final Scoring
   - Polls every 5 seconds
   - Reports completion status

5. **Results Retrieval**
   - Queries Aurora `document_submissions` table
   - Queries `feedback_reports` table
   - Queries `criterion_scores` table
   - Displays comprehensive results

6. **Results Display**
   - Overall score (0-100)
   - Structure compliance (Yes/No)
   - Individual criterion scores
   - Detailed feedback and recommendations
   - Grammar issues found
   - Areas for improvement

### Output Example

```
══════════════════════════════════════════════════════════════════════
Overlay Platform - End-to-End Workflow Test
══════════════════════════════════════════════════════════════════════

Timestamp: 2026-01-20T14:00:00.000Z
Region: eu-west-1
Bucket: overlay-docs-975050116849
State Machine: arn:aws:states:eu-west-1:975050116849:stateMachine:overlay-document-workflow

══════════════════════════════════════════════════════════════════════
Step 1: Creating Test Document
══════════════════════════════════════════════════════════════════════

✅ Test document created
  File: test-contract-1768920000000.txt
  Path: c:\Projects\overlay-platform\temp\test-contract-1768920000000.txt
  Size: 2847 bytes

Content preview (first 200 chars):
  Test Contract Document
  Generated: 2026-01-20T14:00:00.000Z

  PARTIES

  This Agreement is entered into between Party A ("Client") and Party B ("Provider").

  TERMS AND CONDITIONS

  1. Scope of Work
  The Provid...

Intentional grammar errors included for testing:
  - "and accordance" (missing "in")
  - "Client agree" (should be "agrees")
  - "a interest" (should be "an")
  - "acknowledges" vs plural subject
  - "informations" (incorrect plural)
  - "Providers" (missing apostrophe)
  - "parties has" (should be "have")

══════════════════════════════════════════════════════════════════════
Step 2: Uploading Document to S3
══════════════════════════════════════════════════════════════════════

Bucket: overlay-docs-975050116849
Key: submissions/test-contract-1768920000000.txt
File: c:\Projects\overlay-platform\temp\test-contract-1768920000000.txt

✅ Document uploaded to S3
  S3 URI: s3://overlay-docs-975050116849/submissions/test-contract-1768920000000.txt

Waiting for S3 event to trigger Step Functions...

══════════════════════════════════════════════════════════════════════
Step 3: Waiting for Step Functions Execution
══════════════════════════════════════════════════════════════════════

Looking for executions of: arn:aws:states:eu-west-1:975050116849:stateMachine:overlay-document-workflow
Triggered by: submissions/test-contract-1768920000000.txt
Max wait time: 30 seconds

....✅ Step Functions execution started!
  Execution ARN: arn:aws:states:eu-west-1:975050116849:execution:overlay-document-workflow:abc123
  Started: 2026-01-20T14:00:08.000Z
  Status: RUNNING

══════════════════════════════════════════════════════════════════════
Step 4: Monitoring Step Functions Execution
══════════════════════════════════════════════════════════════════════

Execution ARN: arn:aws:states:eu-west-1:975050116849:execution:overlay-document-workflow:abc123

Real-time progress:

  🔄 Extract Document - STARTED
  ✅ Extract Document - COMPLETED
  🔄 Parallel Analysis - STARTED (Parallel execution)
  🔄 Structure Validator - STARTED
  🔄 Content Analyzer - STARTED
  🔄 Grammar Checker - STARTED
  ✅ Structure Validator - COMPLETED
  ✅ Content Analyzer - COMPLETED
  ✅ Grammar Checker - COMPLETED
  ✅ Parallel Analysis - COMPLETED (Parallel execution)
  🔄 Orchestrator Decision - STARTED
  ✅ Orchestrator Decision - COMPLETED
  🔄 Final Scoring - STARTED
  ✅ Final Scoring - COMPLETED

✅ Execution completed successfully!
  Duration: 42.35s
  Output available: Yes

══════════════════════════════════════════════════════════════════════
Step 5: Retrieving Results from Aurora
══════════════════════════════════════════════════════════════════════

Connecting to Aurora database...

✅ Connected to Aurora database

Querying document_submissions table...
✅ Submission found
  Submission ID: 30000000-0000-0000-0000-000000000001
  Status: completed
  Overall Score: 78
  Structure Compliant: true

Querying feedback_reports table...
✅ Feedback report found
  Report ID: 40000000-0000-0000-0000-000000000001

Querying criterion_scores table...
✅ Found 5 criterion scores

══════════════════════════════════════════════════════════════════════
Step 6: Analysis Results
══════════════════════════════════════════════════════════════════════

OVERALL RESULTS
──────────────────────────────────────────────────────────────────────
Submission ID:        30000000-0000-0000-0000-000000000001
Status:               completed
Overall Score:        78/100
Structure Compliant:  Yes
Submitted:            2026-01-20T14:00:10.000Z
Last Updated:         2026-01-20T14:00:50.000Z


CRITERION SCORES
──────────────────────────────────────────────────────────────────────

Content Quality:
  Score: 18/20 (90.0%)
  Feedback: Well-structured contract with clear sections and comprehensive terms

Grammar and Style:
  Score: 12/20 (60.0%)
  Feedback: Multiple grammar errors detected: subject-verb agreement, incorrect articles, missing apostrophes

Completeness:
  Score: 19/20 (95.0%)
  Feedback: All essential contract sections present

Legal Compliance:
  Score: 17/20 (85.0%)
  Feedback: Standard contract clauses included, proper legal terminology used

Formatting:
  Score: 12/20 (60.0%)
  Feedback: Basic formatting present, could improve consistency


DETAILED FEEDBACK
──────────────────────────────────────────────────────────────────────

Overall Feedback:
This is a well-structured contract document that covers all essential legal elements.
The content is comprehensive and uses appropriate legal terminology. However, there
are several grammar issues that need correction before finalization.

Strengths:
- Clear section structure
- Comprehensive coverage of contract terms
- Professional legal language
- All essential clauses present (payment, confidentiality, termination, liability)

Areas for Improvement:
- Grammar errors: "Client agree" should be "Client agrees"
- Grammar errors: "a interest" should be "an interest"
- Grammar errors: "informations" should be "information"
- Grammar errors: "parties has" should be "parties have"
- Missing "in" before "accordance"
- Missing apostrophe in "Providers"

Recommendations:
1. Run spell/grammar check before final submission
2. Have legal counsel review for jurisdiction-specific requirements
3. Ensure all placeholders are filled with actual party information
4. Add specific dates for agreement execution
5. Include detailed Exhibit A with scope of work

══════════════════════════════════════════════════════════════════════
Test Summary
══════════════════════════════════════════════════════════════════════

✅ End-to-end workflow test completed successfully!

What was tested:
  ✅ Document creation
  ✅ S3 upload
  ✅ S3 event notification
  ✅ Step Functions execution
  ✅ AI agent processing
  ✅ Aurora database writes
  ✅ Results retrieval

The platform is working end-to-end! 🎉
```

### Options

```bash
# Use specific overlay ID
npm run test:workflow -- --overlay-id 20000000-0000-0000-0000-000000000001

# Monitor existing execution (skip upload)
npm run test:workflow -- --skip-upload --execution-arn arn:aws:states:eu-west-1:975050116849:execution:overlay-document-workflow:abc123
```

### Troubleshooting

#### No Execution Found

```
⚠️  No execution found within timeout period

Possible causes:
  - S3 event notification not configured
  - EventBridge rule not triggered
  - Step Functions state machine not deployed
```

**Solution**: Check S3 event notifications and EventBridge configuration:

```bash
# Check S3 event notifications
aws s3api get-bucket-notification-configuration \
  --bucket overlay-docs-975050116849 \
  --region eu-west-1

# Check EventBridge rules
aws events list-rules --region eu-west-1 | grep overlay

# Check Step Functions state machines
aws stepfunctions list-state-machines --region eu-west-1
```

#### Execution Failed

```
❌ Execution failed!
  Error: States.TaskFailed
  Cause: Lambda function error
```

**Solution**: Check CloudWatch Logs for the failed Lambda function:

```bash
# Check logs for structure validator
aws logs tail /aws/lambda/overlay-structure-validator --follow --region eu-west-1

# Check logs for content analyzer
aws logs tail /aws/lambda/overlay-content-analyzer --follow --region eu-west-1
```

#### Database Connection Failed

```
❌ Failed to query Aurora database
Error: Connection refused
```

**Solution**: Aurora is in private subnets. Options:
1. Run the script from an EC2 instance in the VPC
2. Use AWS Systems Manager Session Manager to access VPC
3. Set up VPN connection to VPC
4. Use bastion host

For local development, you may need to:
- Configure VPC peering
- Use AWS Client VPN
- Deploy Lambda to query results instead

#### No Results in Database

```
⚠️  No submission found in database

Possible causes:
  - Step Functions execution did not complete successfully
  - Database write operation failed
  - S3 key mismatch
```

**Solution**:
1. Verify Lambda functions have database write permissions
2. Check Lambda logs for database connection errors
3. Verify Aurora security group allows Lambda access
4. Ensure Lambda functions are in VPC with Aurora access

### When to Use This Test

Run this test:
1. **After complete deployment** - All stacks must be deployed
2. **Before production release** - Validate end-to-end functionality
3. **After code changes** - Verify workflow still works
4. **For debugging** - Identify where workflow breaks
5. **Performance testing** - Measure execution time

### Prerequisites

Before running:
1. ✅ All CDK stacks deployed (Auth, Storage, Compute, Orchestration)
2. ✅ Aurora migrations completed
3. ✅ S3 event notifications configured
4. ✅ EventBridge rules deployed
5. ✅ Lambda functions have VPC access to Aurora
6. ✅ Claude API key stored in Secrets Manager
7. ✅ At least one active overlay exists in database

### Known Limitations

1. **Database Access**: Script must run from within VPC or with VPC connectivity to query Aurora
2. **Document Format**: Currently creates simple text files; DOCX support requires additional library
3. **Timeout**: 30-second timeout for execution start may need adjustment for cold starts
4. **Placeholder Code**: If Lambda functions have placeholder code, results may be incomplete

### Integration with CI/CD

```bash
#!/bin/bash
# End-to-end test in CI/CD pipeline

echo "Running end-to-end workflow test..."
npm run test:workflow

if [ $? -eq 0 ]; then
  echo "✅ Workflow test passed"
  exit 0
else
  echo "❌ Workflow test failed"
  exit 1
fi
```

