# Deployment Guide

**Overlay Platform - Production Deployment**
**Last Updated**: January 26, 2026
**Version**: v1.1

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Order](#deployment-order)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Environment Variables](#environment-variables)
8. [Lambda Layer Details](#lambda-layer-details)
9. [Database Migrations](#database-migrations)
10. [Common Issues & Fixes](#common-issues--fixes)
11. [Verification](#verification)
12. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Software:

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Node.js** | 20.x | Runtime for Lambda + Frontend | [nodejs.org](https://nodejs.org) |
| **npm** | 10.x | Package manager | Included with Node.js |
| **AWS CLI** | 2.x | AWS service interaction | [AWS CLI Install Guide](https://aws.amazon.com/cli/) |
| **AWS CDK** | 2.x | Infrastructure as Code | `npm install -g aws-cdk` |
| **Git** | 2.x | Version control | [git-scm.com](https://git-scm.com) |
| **PostgreSQL Client** (optional) | 16.x | Database management | [postgresql.org](https://postgresql.org) |

### AWS Account Requirements:

- **AWS Account** with admin access
- **AWS Credentials** configured (`~/.aws/credentials`)
- **AWS Region**: eu-west-1 (or your preferred region)
- **Budget**: ~$50-100/month for production workload

### AWS CLI Configuration:

```bash
# Configure AWS credentials
aws configure
# AWS Access Key ID: [YOUR_ACCESS_KEY]
# AWS Secret Access Key: [YOUR_SECRET_KEY]
# Default region name: eu-west-1
# Default output format: json

# Verify credentials
aws sts get-caller-identity
```

### CDK Bootstrap:

```bash
# Bootstrap CDK in your AWS account (one-time setup)
cdk bootstrap aws://ACCOUNT_ID/REGION

# Example:
cdk bootstrap aws://123456789012/eu-west-1
```

### Environment Setup:

```bash
# Clone repository
git clone https://github.com/futurisms/overlay-platform.git
cd overlay-platform

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

## Architecture Overview

### Infrastructure Stacks (4 CDK Stacks):

```
┌────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT ORDER                       │
└────────────────────────────────────────────────────────────┘

1. OverlayStorageStack
   ├─ S3 Bucket (documents)
   └─ DynamoDB Table (LLM config)

2. OverlayAuthStack
   ├─ Cognito User Pool
   ├─ Cognito User Pool Client
   └─ Cognito Identity Pool

3. OverlayOrchestrationStack
   ├─ VPC (if needed)
   ├─ Aurora PostgreSQL Serverless v2
   ├─ Lambda Layer (common utilities)
   ├─ 6 AI Agent Lambdas
   └─ Step Functions State Machine

4. OverlayComputeStack
   ├─ API Gateway REST API
   ├─ 9 CRUD Lambda Handlers
   └─ Cognito Authorizer

Frontend (Separate)
   └─ Next.js Application (localhost or Vercel)
```

### Dependency Graph:

```
StorageStack (no dependencies)
    ↓
AuthStack (no dependencies)
    ↓
OrchestrationStack (depends on: StorageStack)
    ↓
ComputeStack (depends on: StorageStack, AuthStack, OrchestrationStack)
    ↓
Frontend (depends on: API Gateway URL, Cognito config)
```

---

## Deployment Order

### Step-by-Step Deployment:

#### 1. Deploy Storage Stack (10 minutes)

**What it creates**:
- S3 bucket for document storage
- DynamoDB table for LLM configuration

```bash
npx cdk deploy OverlayStorageStack
```

**Expected Output**:
```
OverlayStorageStack: deploying...
[██████████████████████████████████████████████████] (100%)

✅  OverlayStorageStack

Outputs:
OverlayStorageStack.DocumentBucketName = overlay-documents-123456789012
OverlayStorageStack.LLMConfigTableName = overlay-llm-config
```

**Verify**:
```bash
# Check S3 bucket exists
aws s3 ls s3://overlay-documents-123456789012

# Check DynamoDB table exists
aws dynamodb describe-table --table-name overlay-llm-config
```

---

#### 2. Deploy Auth Stack (10 minutes)

**What it creates**:
- Cognito User Pool for authentication
- User Pool Client for frontend
- Identity Pool for federated identities

```bash
npx cdk deploy OverlayAuthStack
```

**Expected Output**:
```
OverlayAuthStack: deploying...
[██████████████████████████████████████████████████] (100%)

✅  OverlayAuthStack

Outputs:
OverlayAuthStack.UserPoolId = eu-west-1_lC25xZ8s6
OverlayAuthStack.UserPoolClientId = 3k9j8h7g6f5d4s3a2p1o
OverlayAuthStack.IdentityPoolId = eu-west-1:12345678-1234-1234-1234-123456789012
```

**Verify**:
```bash
# Check Cognito User Pool exists
aws cognito-idp describe-user-pool --user-pool-id eu-west-1_lC25xZ8s6
```

---

#### 3. Deploy Orchestration Stack (30-40 minutes)

**What it creates**:
- Aurora PostgreSQL Serverless v2 cluster
- Database secret in Secrets Manager
- Lambda Layer with common utilities (v14)
- 6 AI Agent Lambda functions
- Step Functions state machine
- EventBridge rules
- SQS queues (processing + DLQ)

**⚠️ IMPORTANT**: This stack takes the longest due to Aurora provisioning.

```bash
npx cdk deploy OverlayOrchestrationStack
```

**Expected Output**:
```
OverlayOrchestrationStack: deploying...
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] (10%) Creating Aurora cluster... (20-30 min)
[████████████████████░░░░░░░░░░░░░░░░░░░░░░] (40%) Creating Lambda functions...
[██████████████████████████████████████████] (100%)

✅  OverlayOrchestrationStack

Outputs:
OverlayOrchestrationStack.AuroraClusterEndpoint = overlay-db-cluster.cluster-xyz.eu-west-1.rds.amazonaws.com
OverlayOrchestrationStack.AuroraSecretArn = arn:aws:secretsmanager:eu-west-1:123456789012:secret:overlay-db-secret-abc123
OverlayOrchestrationStack.StateMachineArn = arn:aws:states:eu-west-1:123456789012:stateMachine:overlay-document-analysis
OverlayOrchestrationStack.CommonLayerArn = arn:aws:lambda:eu-west-1:123456789012:layer:overlay-common-layer:14
```

**Verify**:
```bash
# Check Aurora cluster status (should be "available")
aws rds describe-db-clusters --db-cluster-identifier overlay-db-cluster

# Check Lambda layer exists
aws lambda list-layer-versions --layer-name overlay-common-layer

# Check Step Functions state machine exists
aws stepfunctions describe-state-machine \
  --state-machine-arn arn:aws:states:eu-west-1:123456789012:stateMachine:overlay-document-analysis
```

---

#### 4. Run Database Migrations (5 minutes)

**What it does**:
- Creates database schema (19 tables)
- Seeds test data (organizations, users, overlays, sessions)

```bash
# Get database credentials from Secrets Manager
export AURORA_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name OverlayOrchestrationStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraSecretArn`].OutputValue' \
  --output text)

# Run migrations
aws lambda invoke \
  --function-name overlay-database-migration \
  --payload '{"action": "migrate"}' \
  response.json

# Check result
cat response.json
```

**Expected Output**:
```json
{
  "statusCode": 200,
  "body": {
    "message": "Database migrated successfully",
    "migrations": [
      "000_initial_schema.sql",
      "002_add_review_sessions.sql",
      "003_add_test_user.sql",
      "004_add_overlay_context_fields.sql"
    ]
  }
}
```

**Verify**:
```bash
# Connect to Aurora (requires VPN or bastion host)
psql -h overlay-db-cluster.cluster-xyz.eu-west-1.rds.amazonaws.com \
  -U postgres \
  -d overlay_db

# List tables
\dt

# Check test data
SELECT * FROM organizations;
SELECT * FROM users WHERE email = 'admin@example.com';
```

---

#### 5. Deploy Compute Stack (15 minutes)

**What it creates**:
- API Gateway REST API (39+ endpoints)
- 9 CRUD Lambda handlers
- Cognito authorizer for API Gateway

```bash
npx cdk deploy OverlayComputeStack
```

**Expected Output**:
```
OverlayComputeStack: deploying...
[██████████████████████████████████████████████████] (100%)

✅  OverlayComputeStack

Outputs:
OverlayComputeStack.APIEndpoint = https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
OverlayComputeStack.CognitoUserPoolId = eu-west-1_lC25xZ8s6
```

**Verify**:
```bash
# Check API Gateway exists
aws apigateway get-rest-apis | grep overlay

# Test API endpoint (should return 401 without auth)
curl https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions
```

---

#### 6. Create Cognito Test User (2 minutes)

**Create admin user**:
```bash
# Set Cognito User Pool ID
export USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name OverlayAuthStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes \
    Name=email,Value=admin@example.com \
    Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password TestPassword123! \
  --permanent

# Add to system_admin group (if needed)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --group-name system_admin
```

**Verify**:
```bash
# List users
aws cognito-idp list-users --user-pool-id $USER_POOL_ID
```

---

## Backend Deployment

### Complete Backend Deployment (One Command):

```bash
# Deploy all stacks in order
npx cdk deploy --all --require-approval never
```

**Duration**: ~60-70 minutes (Aurora takes longest)

**What happens**:
1. OverlayStorageStack deploys (~10 min)
2. OverlayAuthStack deploys (~10 min)
3. OverlayOrchestrationStack deploys (~35 min)
4. OverlayComputeStack deploys (~15 min)

### Updating Existing Deployment:

```bash
# Update only changed stacks
npx cdk deploy --all

# Update specific stack
npx cdk deploy OverlayComputeStack

# Preview changes before deploying
npx cdk diff OverlayComputeStack
```

### Lambda Function Updates:

**Update single Lambda**:
```bash
# Update Lambda code without CDK
cd lambda/functions/api/submissions
zip -r function.zip .
aws lambda update-function-code \
  --function-name overlay-api-submissions \
  --zip-file fileb://function.zip
```

**Update Lambda via CDK** (recommended):
```bash
# CDK automatically detects code changes
npx cdk deploy OverlayComputeStack
```

### Lambda Layer Updates:

**When to update layer**:
- Changes to `lambda/layers/common/nodejs/db-utils.js`
- Changes to `lambda/layers/common/nodejs/llm-client.js`
- Package dependency updates

**Update process**:
```bash
# 1. Modify layer code
vim lambda/layers/common/nodejs/db-utils.js

# 2. Deploy (CDK creates new layer version automatically)
npx cdk deploy OverlayOrchestrationStack

# 3. Verify new version
aws lambda list-layer-versions --layer-name overlay-common-layer
# Should show version 15 (was 14)
```

**Current Layer Version**: v14
**Contents**:
- `db-utils.js` v2.0.0
- `llm-client.js` v2.3.0
- Dependencies: pg, @aws-sdk/*, mammoth, pdf-parse

---

## Frontend Deployment

### Local Development (Current Setup):

**Requirements**:
- 2 terminal windows
- Backend already deployed

**Terminal 1 - Proxy Server** (handles CORS):
```bash
cd frontend
node proxy-server.js
```

**Output**:
```
🔄 CORS Proxy Server running on http://localhost:3001
Proxying API requests to: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
Proxying Cognito requests to: https://cognito-idp.eu-west-1.amazonaws.com
```

**Terminal 2 - Next.js Dev Server**:
```bash
cd frontend
npm run dev
```

**Output**:
```
   ▲ Next.js 15.1.4
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.100:3000

 ✓ Starting...
 ✓ Ready in 1037ms
```

**Access**: http://localhost:3000

**Login Credentials**:
- Email: admin@example.com
- Password: TestPassword123!

### Production Deployment (Vercel):

**Prerequisites**:
- Vercel account
- GitHub repository connected to Vercel

**Step 1: Update Environment Variables**

Create `frontend/.env.production`:
```bash
# API Gateway URL (from CDK output)
NEXT_PUBLIC_API_BASE_URL=https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production

# Cognito Configuration (from CDK outputs)
NEXT_PUBLIC_COGNITO_REGION=eu-west-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-1_lC25xZ8s6
NEXT_PUBLIC_COGNITO_CLIENT_ID=3k9j8h7g6f5d4s3a2p1o

# No proxy needed in production (direct API access)
```

**Step 2: Configure CORS on API Gateway**

```bash
# Enable CORS for your Vercel domain
aws apigateway update-rest-api \
  --rest-api-id wojz5amtrl \
  --patch-operations \
    op=add,path=/cors,value='{"allowOrigins":["https://your-app.vercel.app"],"allowMethods":["GET","POST","PUT","DELETE","OPTIONS"],"allowHeaders":["Content-Type","Authorization"]}'
```

**Step 3: Deploy to Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd frontend
vercel --prod
```

**Step 4: Configure Vercel Environment Variables**

In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.production`
3. Redeploy

**Alternative: Manual Deployment**

```bash
# Build for production
cd frontend
npm run build

# Start production server
npm run start
```

**Output**:
```
   ▲ Next.js 15.1.4
   - Local:        http://localhost:3000

 ✓ Ready in 523ms
```

---

## Post-Deployment Configuration

### 1. Configure API Gateway CORS (Production Only)

**Why needed**: Browser blocks cross-origin requests from frontend domain

**Configuration**:
```bash
# Get API Gateway ID
export API_ID=$(aws cloudformation describe-stacks \
  --stack-name OverlayComputeStack \
  --query 'Stacks[0].Outputs[?OutputKey==`APIId`].OutputValue' \
  --output text)

# Enable CORS for all endpoints
aws apigateway update-rest-api \
  --rest-api-id $API_ID \
  --patch-operations \
    op=add,path=/corsConfiguration/allowOrigins,value='["https://your-frontend-domain.com"]' \
    op=add,path=/corsConfiguration/allowMethods,value='["GET","POST","PUT","DELETE","OPTIONS"]' \
    op=add,path=/corsConfiguration/allowHeaders,value='["Content-Type","Authorization","X-Amz-Date","X-Api-Key","X-Amz-Security-Token"]' \
    op=add,path=/corsConfiguration/allowCredentials,value=true \
    op=add,path=/corsConfiguration/maxAge,value=3600

# Deploy changes
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name production
```

### 2. Store API Secrets (Anthropic API Key)

**Create Anthropic API key** at https://console.anthropic.com/

**Store in Secrets Manager**:
```bash
aws secretsmanager create-secret \
  --name claude-api-key \
  --description "Anthropic Claude API key for Overlay Platform" \
  --secret-string '{"apiKey":"sk-ant-api03-..."}'
```

**Update Lambda environment variables**:
```bash
# Update all AI agent Lambdas
for agent in structure-validator content-analyzer grammar-checker orchestrator clarification scoring; do
  aws lambda update-function-configuration \
    --function-name overlay-$agent \
    --environment Variables={
      CLAUDE_API_KEY_SECRET=claude-api-key,
      MODEL_ID=claude-sonnet-4-5-20250929,
      AWS_REGION=eu-west-1
    }
done
```

### 3. Configure S3 Event Notifications (Optional)

**Why**: Trigger Step Functions on direct S3 uploads

**Configuration**:
```bash
# Get S3 trigger Lambda ARN
export S3_TRIGGER_ARN=$(aws cloudformation describe-stacks \
  --stack-name OverlayOrchestrationStack \
  --query 'Stacks[0].Outputs[?OutputKey==`S3TriggerFunctionArn`].OutputValue' \
  --output text)

# Get bucket name
export BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name OverlayStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DocumentBucketName`].OutputValue' \
  --output text)

# Add Lambda permission
aws lambda add-permission \
  --function-name overlay-s3-trigger \
  --statement-id s3-invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::$BUCKET_NAME

# Configure S3 notification
aws s3api put-bucket-notification-configuration \
  --bucket $BUCKET_NAME \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "LambdaFunctionArn": "'$S3_TRIGGER_ARN'",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [{"Name": "prefix", "Value": "submissions/"}]
        }
      }
    }]
  }'
```

---

## Environment Variables

### Complete Environment Variable Reference:

#### API Lambda Functions:

```bash
# Database
AURORA_SECRET_ARN=arn:aws:secretsmanager:eu-west-1:123456789012:secret:overlay-db-secret-abc123
AWS_REGION=eu-west-1

# Cognito
USER_POOL_ID=eu-west-1_lC25xZ8s6

# Storage
DOCUMENTS_BUCKET=overlay-documents-123456789012

# Step Functions (submissions handler only)
WORKFLOW_STATE_MACHINE_ARN=arn:aws:states:eu-west-1:123456789012:stateMachine:overlay-document-analysis

# LLM Config (llm-config handler only)
LLM_CONFIG_TABLE=overlay-llm-config
```

#### AI Agent Lambda Functions:

```bash
# Database
AURORA_SECRET_ARN=arn:aws:secretsmanager:eu-west-1:123456789012:secret:overlay-db-secret-abc123
AWS_REGION=eu-west-1

# LLM
CLAUDE_API_KEY_SECRET=claude-api-key
LLM_CONFIG_TABLE=overlay-llm-config

# Model ID (varies by agent)
MODEL_ID=anthropic.claude-haiku-20240307    # Agents 1-3
MODEL_ID=claude-sonnet-4-5-20250929         # Agents 4-6

# Storage
DOCUMENTS_BUCKET=overlay-documents-123456789012
```

#### Frontend (.env.local for development):

```bash
# Proxy (development only)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Cognito (development and production)
NEXT_PUBLIC_COGNITO_REGION=eu-west-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-1_lC25xZ8s6
NEXT_PUBLIC_COGNITO_CLIENT_ID=3k9j8h7g6f5d4s3a2p1o
```

#### Frontend (.env.production for production):

```bash
# API Gateway (direct access, no proxy)
NEXT_PUBLIC_API_BASE_URL=https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production

# Cognito
NEXT_PUBLIC_COGNITO_REGION=eu-west-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-1_lC25xZ8s6
NEXT_PUBLIC_COGNITO_CLIENT_ID=3k9j8h7g6f5d4s3a2p1o
```

---

## Lambda Layer Details

### Current Layer: v14

**Location**: `lambda/layers/common/nodejs/`

**Contents**:
```
lambda/layers/common/nodejs/
├── db-utils.js (v2.0.0)
├── llm-client.js (v2.3.0)
└── package.json
    └── dependencies:
        ├── pg@8.11.3
        ├── @aws-sdk/client-s3@3.x
        ├── @aws-sdk/client-secrets-manager@3.x
        ├── @aws-sdk/client-dynamodb@3.x
        ├── @aws-sdk/lib-dynamodb@3.x
        ├── @anthropic-ai/sdk@0.27.3
        ├── mammoth@1.6.0
        └── pdf-parse@1.1.1
```

### db-utils.js Functions:

| Function | Purpose |
|----------|---------|
| `createDbConnection()` | Create PostgreSQL connection |
| `getAuroraCredentials()` | Fetch DB credentials from Secrets Manager |
| `getOverlayById()` | Load overlay configuration (with context fields v1.1) |
| `getEvaluationCriteria()` | Load evaluation criteria for overlay |
| `createDocumentSubmission()` | Create submission record |
| `updateSubmissionStatus()` | Update submission status |
| `saveFeedbackReport()` | Save to feedback_reports table |
| `saveCriterionScores()` | Save to evaluation_responses table |
| `saveClarificationQuestions()` | Save to clarification_questions table |
| `getDocumentFromS3()` | Fetch + extract text (mammoth/pdf-parse) |

### llm-client.js Functions:

| Function | Purpose |
|----------|---------|
| `getClaudeClient()` | Get Claude API client with sendMessage wrapper |
| `getClaudeApiKey()` | Fetch API key from Secrets Manager |
| `getLLMConfig()` | Get LLM configuration from DynamoDB |
| `getModelInfo()` | Get supported models and default model |

### Layer Size & Performance:

- **Size**: ~15 MB (compressed)
- **Cold Start Impact**: +500-800ms on first invocation
- **Warm Start**: <50ms (layer already loaded)

---

## Database Migrations

### Migration Files:

| File | Description | Tables Created |
|------|-------------|----------------|
| `000_initial_schema.sql` | Initial 13 tables | organizations, users, overlays, evaluation_criteria, document_submissions, feedback_reports, etc. |
| `002_add_review_sessions.sql` | Review sessions + AI results | review_sessions, session_participants, session_invitations, clarification_questions, clarification_answers, ai_agent_results |
| `003_add_test_user.sql` | Seed test data | Test user: admin@example.com |
| `004_add_overlay_context_fields.sql` | Document context (v1.1) | ALTER overlays ADD document_purpose, when_used, process_context, target_audience |

### Running Migrations Manually:

**Via Lambda**:
```bash
aws lambda invoke \
  --function-name overlay-database-migration \
  --payload '{"action": "migrate"}' \
  response.json && cat response.json
```

**Via psql** (requires VPN or bastion host):
```bash
# Connect to Aurora
psql -h overlay-db-cluster.cluster-xyz.eu-west-1.rds.amazonaws.com \
  -U postgres \
  -d overlay_db

# Run migrations manually
\i lambda/functions/database-migration/migrations/000_initial_schema.sql
\i lambda/functions/database-migration/migrations/002_add_review_sessions.sql
\i lambda/functions/database-migration/migrations/003_add_test_user.sql
\i lambda/functions/database-migration/migrations/004_add_overlay_context_fields.sql
```

### Verifying Migrations:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected output: 19 tables

-- Check context fields exist (v1.1)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'overlays'
  AND column_name IN ('document_purpose', 'when_used', 'process_context', 'target_audience');

-- Should return 4 rows
```

---

## Common Issues & Fixes

### Issue 1: CDK Bootstrap Not Complete

**Symptom**:
```
Error: This stack uses assets, so the toolkit stack must be deployed...
```

**Fix**:
```bash
cdk bootstrap aws://ACCOUNT_ID/REGION
```

---

### Issue 2: Aurora Cluster Takes Too Long

**Symptom**: OverlayOrchestrationStack stuck at "Creating Aurora cluster..." for >40 minutes

**Fix**: This is normal. Aurora Serverless v2 provisioning takes 25-35 minutes. Wait patiently.

**Alternative**: Check CloudFormation console for progress:
```bash
aws cloudformation describe-stack-events \
  --stack-name OverlayOrchestrationStack \
  --max-items 10
```

---

### Issue 3: Lambda Timeout Connecting to Aurora

**Symptom**:
```
Lambda timeout after 30 seconds
CloudWatch logs show: "Connecting to Aurora..."
```

**Root Cause**: Lambda not in same VPC as Aurora

**Fix**:
```bash
# Check Lambda VPC configuration
aws lambda get-function-configuration \
  --function-name overlay-structure-validator \
  --query 'VpcConfig'

# Should show: VpcId, SubnetIds, SecurityGroupIds
# If empty, redeploy:
npx cdk deploy OverlayOrchestrationStack
```

---

### Issue 4: CORS Errors in Browser

**Symptom**:
```
Access to XMLHttpRequest at 'https://wojz5amtrl...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Fix (Development)**:
```bash
# Use proxy server
cd frontend
node proxy-server.js  # Terminal 1
npm run dev           # Terminal 2
```

**Fix (Production)**:
```bash
# Configure CORS on API Gateway (see Post-Deployment Configuration section)
```

---

### Issue 5: Cognito User Not Found

**Symptom**:
```
POST /login returns 404: User not found
```

**Fix**:
```bash
# Check user exists
aws cognito-idp list-users --user-pool-id eu-west-1_lC25xZ8s6

# If not found, create user (see Step 6 of Deployment Order)
```

---

### Issue 6: Step Functions Execution Fails

**Symptom**:
```
Step Functions execution fails immediately
CloudWatch logs show: "Execution failed with error: States.Runtime"
```

**Debug**:
```bash
# 1. Check execution history
aws stepfunctions get-execution-history \
  --execution-arn arn:aws:states:...:execution:... \
  --reverse-order

# 2. Check Lambda logs
aws logs tail /aws/lambda/overlay-structure-validator --follow

# 3. Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name overlay-structure-validator \
  --query 'Environment.Variables'
```

**Common Causes**:
- Missing environment variable (AURORA_SECRET_ARN, MODEL_ID)
- Invalid Secrets Manager secret
- Lambda not in VPC
- Missing IAM permissions

---

### Issue 7: Database Migration Fails

**Symptom**:
```
Lambda returns 500: Database migration failed
```

**Fix**:
```bash
# 1. Check Aurora cluster is available
aws rds describe-db-clusters \
  --db-cluster-identifier overlay-db-cluster \
  --query 'DBClusters[0].Status'

# Should return: "available"

# 2. Check database credentials
aws secretsmanager get-secret-value \
  --secret-id overlay-db-secret \
  --query 'SecretString'

# 3. Run migration manually (see Database Migrations section)
```

---

### Issue 8: Frontend Can't Connect to API

**Symptom**:
```
Frontend shows: "Network error" or "Failed to fetch"
```

**Fix**:
```bash
# 1. Check .env.local is configured
cat frontend/.env.local

# Should have:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 (development)
# or
# NEXT_PUBLIC_API_BASE_URL=https://wojz5amtrl... (production)

# 2. Test API endpoint directly
curl https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/sessions

# Should return 401 (Unauthorized) - this is expected without auth token
```

---

## Verification

### Post-Deployment Checklist:

#### Backend Verification:

- [ ] **Storage**: S3 bucket exists
  ```bash
  aws s3 ls s3://overlay-documents-123456789012
  ```

- [ ] **Auth**: Cognito User Pool exists
  ```bash
  aws cognito-idp describe-user-pool --user-pool-id eu-west-1_lC25xZ8s6
  ```

- [ ] **Database**: Aurora cluster is available
  ```bash
  aws rds describe-db-clusters --db-cluster-identifier overlay-db-cluster
  ```

- [ ] **Database**: 19 tables exist
  ```bash
  # Connect via psql and run: \dt
  ```

- [ ] **Lambda**: All 15 functions exist (9 API + 6 agents)
  ```bash
  aws lambda list-functions | grep overlay | wc -l
  # Should return: 15
  ```

- [ ] **Step Functions**: State machine exists
  ```bash
  aws stepfunctions list-state-machines | grep overlay-document-analysis
  ```

- [ ] **API Gateway**: API exists with 39+ routes
  ```bash
  aws apigateway get-rest-apis | grep overlay
  ```

#### Frontend Verification:

- [ ] **Development server running**: http://localhost:3000 accessible
- [ ] **Proxy server running**: http://localhost:3001 accessible
- [ ] **Login works**: Can login with admin@example.com / TestPassword123!
- [ ] **Dashboard loads**: Shows 8 review sessions
- [ ] **Session detail loads**: Shows evaluation criteria
- [ ] **Document upload works**: Can upload DOCX/PDF file
- [ ] **Submissions list**: Shows uploaded documents
- [ ] **Feedback displays**: After ~2 minutes, feedback appears

#### End-to-End Verification:

```bash
# 1. Login via frontend
# 2. Navigate to any session
# 3. Upload test document
# 4. Wait ~2 minutes
# 5. Refresh submission detail page
# 6. Verify feedback displays:
#    - Overall score (0-100)
#    - Strengths list
#    - Weaknesses list
#    - Recommendations list
#    - Criterion scores
```

---

## Rollback Procedures

### Rollback Single Stack:

```bash
# Get previous CloudFormation template version
aws cloudformation describe-stack-events \
  --stack-name OverlayComputeStack \
  --max-items 50

# Rollback to previous state
aws cloudformation rollback-stack \
  --stack-name OverlayComputeStack
```

### Rollback Lambda Function:

```bash
# List previous versions
aws lambda list-versions-by-function \
  --function-name overlay-api-submissions

# Rollback to version N
aws lambda update-alias \
  --function-name overlay-api-submissions \
  --name live \
  --function-version N
```

### Rollback Database Migration:

**⚠️ WARNING**: Database rollbacks can cause data loss. Always backup first.

```bash
# 1. Export current data
pg_dump -h overlay-db-cluster... -U postgres -d overlay_db > backup.sql

# 2. Drop new tables/columns
psql -h overlay-db-cluster... -U postgres -d overlay_db
DROP TABLE IF EXISTS new_table;
ALTER TABLE overlays DROP COLUMN IF EXISTS document_purpose;

# 3. Restore from backup (if needed)
psql -h overlay-db-cluster... -U postgres -d overlay_db < backup.sql
```

### Complete Teardown:

**⚠️ WARNING**: This deletes ALL resources. Use only for development.

```bash
# Delete all stacks (in reverse order)
npx cdk destroy OverlayComputeStack --force
npx cdk destroy OverlayOrchestrationStack --force
npx cdk destroy OverlayAuthStack --force
npx cdk destroy OverlayStorageStack --force

# Or all at once
npx cdk destroy --all --force
```

---

## Summary

### Deployment Checklist:

1. ✅ Prerequisites installed (Node.js, AWS CLI, CDK)
2. ✅ AWS credentials configured
3. ✅ CDK bootstrapped
4. ✅ Deploy OverlayStorageStack
5. ✅ Deploy OverlayAuthStack
6. ✅ Deploy OverlayOrchestrationStack (~35 min)
7. ✅ Run database migrations
8. ✅ Deploy OverlayComputeStack
9. ✅ Create Cognito test user
10. ✅ Store Anthropic API key in Secrets Manager
11. ✅ Start frontend (proxy + dev server)
12. ✅ Verify end-to-end workflow

### Deployment Times:

| Component | Duration |
|-----------|----------|
| Storage Stack | 10 min |
| Auth Stack | 10 min |
| Orchestration Stack | 35 min |
| Database Migration | 5 min |
| Compute Stack | 15 min |
| Frontend Setup | 5 min |
| **Total** | **~80 min** |

### Post-Deployment Maintenance:

- **Daily**: Check CloudWatch logs for errors
- **Weekly**: Review Step Functions execution success rate
- **Monthly**: Check AWS costs and optimize
- **Quarterly**: Update Lambda runtime and dependencies
- **Yearly**: Review security groups and IAM permissions

---

**Document Version**: 1.0
**Last Updated**: January 26, 2026
**Maintained By**: Architecture Team
