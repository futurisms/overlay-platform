# Phase 2: Application Stack - Ready for Deployment

## Overview

Phase 2 of the Overlay Platform is complete and ready for deployment. This phase includes authentication, compute, and orchestration infrastructure for the AI-powered document review system.

## Stacks Created

### 1. Auth Stack ([lib/auth-stack.ts](lib/auth-stack.ts))

**Cognito User Pool Configuration**:
- Email-based sign-in (username disabled)
- Self-signup disabled (admin-controlled user creation)
- MFA: Optional (SMS and OTP supported)
- Password Policy: 12+ chars, complexity requirements
- Advanced security mode: ENFORCED
- Device tracking enabled

**User Groups**:
1. **system_admin** (precedence: 1) - Full system access
2. **document_admin** (precedence: 10) - Create overlays, review documents
3. **end_user** (precedence: 100) - Submit documents

**Lambda Triggers**:
- **Pre-signup**: Auto-confirms admin-created users
- **Post-authentication**: Audit logging for user logins

**User Pool Client**:
- Auth flows: USER_PASSWORD_AUTH, USER_SRP_AUTH
- Token validity: 1 hour (access/ID), 30 days (refresh)
- Token revocation enabled

### 2. Compute Stack ([lib/compute-stack.ts](lib/compute-stack.ts))

**AI Agent Lambda Functions** (6-agent workflow):

| Function | Model | Purpose | Timeout | Memory |
|----------|-------|---------|---------|--------|
| structure-validator | Bedrock Haiku | Fast document structure validation | 2 min | 512 MB |
| content-analyzer | Claude Sonnet | Detailed content analysis | 5 min | 1024 MB |
| grammar-checker | Bedrock Haiku | Grammar and writing quality | 2 min | 512 MB |
| orchestrator | Claude Sonnet | Workflow coordination | 5 min | 1024 MB |
| clarification | Claude Sonnet | Intelligent Q&A | 3 min | 1024 MB |
| scoring | Claude Sonnet | Final scoring and feedback | 3 min | 512 MB |

**API Lambda Functions**:

| Function | Purpose | VPC | Auth Required |
|----------|---------|-----|---------------|
| auth | Login, register, token refresh | No | Public |
| overlays | Overlay CRUD operations | Yes | Cognito |
| sessions | Review session management | Yes | Cognito |
| submissions | Document upload/download | Yes | Cognito |

**API Gateway REST API**:

Endpoints:
- `POST /auth` - Authentication (public)
- `GET/POST /overlays` - List/create overlays
- `GET/PUT/DELETE /overlays/{overlayId}` - Manage specific overlay
- `GET/POST /sessions` - List/create review sessions
- `GET /sessions/{sessionId}` - Get session details
- `GET/POST /submissions` - List/create document submissions
- `GET /submissions/{submissionId}` - Get submission with presigned download URL

**Authentication**: Cognito User Pool Authorizer (JWT validation)

**Common Lambda Layer** ([lambda/layers/common](lambda/layers/common)):
- LLM client abstraction (Claude API + Bedrock)
- Database client utilities (Aurora connection)
- Shared dependencies (@anthropic-ai/sdk, pg, AWS SDK)

### 3. Orchestration Stack ([lib/orchestration-stack.ts](lib/orchestration-stack.ts))

**Step Functions State Machine**:

Workflow: Document Analysis (6-agent process)
1. Structure Validation → (if invalid, fail)
2. Content Analysis
3. Grammar Check (parallel)
4. Orchestration → (determine if clarification needed)
5. Clarification (conditional)
6. Scoring
7. Success

**Features**:
- 15-minute timeout
- CloudWatch Logs integration
- Error handling with failure states
- Conditional branching for clarification

**SQS Queues**:
- **Processing Queue**: Main async processing queue
  - Visibility timeout: 15 minutes
  - Encryption: KMS-managed
  - Dead letter queue enabled (3 retries)
- **Dead Letter Queue**: Failed messages (14-day retention)

**EventBridge Rules**:
- **Failed Execution**: Sends failed analyses to SQS for retry
- **Success Execution**: Triggers success handler Lambda

**S3 Event Trigger**:
- Triggers on S3 uploads to `submissions/` folder
- Starts Step Functions execution automatically
- Expected S3 key format: `submissions/{documentId}/{filename}`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│  Cognito User Pool → Groups (admin, document_admin, end_user)       │
│  Lambda Triggers (pre-signup, post-auth)                            │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY                               │
├─────────────────────────────────────────────────────────────────────┤
│  /auth (public) → Auth Lambda                                       │
│  /overlays → Overlays Lambda (Cognito auth)                         │
│  /sessions → Sessions Lambda (Cognito auth)                         │
│  /submissions → Submissions Lambda (Cognito auth)                   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT UPLOAD FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│  1. API: POST /submissions → Presigned S3 URL                       │
│  2. Client uploads to S3 (submissions/{docId}/file.pdf)             │
│  3. S3 Event → Trigger Lambda → Start Step Functions                │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  STEP FUNCTIONS WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│  Structure Validator (Bedrock Haiku)                                │
│         ↓                                                            │
│  Content Analyzer (Claude Sonnet)                                   │
│         ↓                                                            │
│  Grammar Checker (Bedrock Haiku) [parallel]                         │
│         ↓                                                            │
│  Orchestrator (Claude Sonnet)                                       │
│         ↓                                                            │
│  Clarification (Claude Sonnet) [conditional]                        │
│         ↓                                                            │
│  Scoring (Claude Sonnet)                                            │
│         ↓                                                            │
│  Success → EventBridge → Success Handler                            │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA PERSISTENCE                             │
├─────────────────────────────────────────────────────────────────────┤
│  Aurora PostgreSQL: Overlays, submissions, analysis results         │
│  DynamoDB: Document metadata, LLM configurations                     │
│  S3: Document storage                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## LLM Abstraction Layer

The common Lambda layer provides a unified interface for LLM interactions:

**Features**:
- Automatic API key retrieval from Secrets Manager (cached)
- Support for Claude API (direct) and Bedrock (AWS-hosted)
- Model configuration from DynamoDB table
- Consistent interface across all AI agents

**Usage**:
```javascript
const { getClaudeClient } = require('/opt/nodejs/llm-client');

const claude = await getClaudeClient();
const response = await claude.sendMessage(prompt, {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2048,
});
```

## Security Features

1. **VPC Isolation**: All AI agent and API Lambdas run in VPC private subnets
2. **Secrets Management**: API keys and DB credentials in Secrets Manager
3. **Encryption**:
   - S3: Server-side encryption
   - DynamoDB: AWS-managed encryption
   - SQS: KMS-managed encryption
4. **IAM Least Privilege**: Functions have minimal required permissions
5. **Cognito Security**:
   - Advanced security mode (adaptive authentication)
   - Device tracking
   - Strong password policy
   - MFA support
6. **API Security**:
   - JWT validation via Cognito authorizer
   - CORS configured
   - Request/response logging

## Environment Variables

All Lambda functions receive:
- `AURORA_SECRET_ARN`: Aurora credentials secret
- `AURORA_ENDPOINT`: Aurora writer endpoint
- `DOCUMENT_BUCKET`: S3 bucket name
- `DOCUMENT_TABLE`: DynamoDB documents table
- `LLM_CONFIG_TABLE`: DynamoDB LLM config table
- `CLAUDE_API_KEY_SECRET`: Claude API key secret
- `MODEL_ID`: Specific model for each function
- `ENVIRONMENT`: production

## Lambda Function Structure

All Lambda functions are located in:
```
lambda/functions/
├── structure-validator/index.js
├── content-analyzer/index.js
├── grammar-checker/index.js
├── orchestrator/index.js
├── clarification/index.js
├── scoring/index.js
└── api/
    ├── auth/index.js
    ├── overlays/index.js
    ├── sessions/index.js
    └── submissions/index.js
```

Common layer:
```
lambda/layers/common/nodejs/
├── package.json
├── llm-client.js (LLM abstraction)
└── db-client.js (Aurora utilities)
```

## Deployment Steps

### Prerequisites
1. Phase 1 (Storage Stack) must be deployed
2. Aurora database migrations completed
3. Claude API key configured in Secrets Manager

### Deploy Auth Stack

```bash
# Preview changes
npx cdk diff OverlayAuthStack

# Deploy
npx cdk deploy OverlayAuthStack
```

### Deploy Compute Stack

```bash
# Preview changes
npx cdk diff OverlayComputeStack

# Deploy (depends on Storage + Auth)
npx cdk deploy OverlayComputeStack
```

### Deploy Orchestration Stack

```bash
# Preview changes
npx cdk diff OverlayOrchestrationStack

# Deploy (depends on Compute)
npx cdk deploy OverlayOrchestrationStack
```

### Deploy All Stacks

```bash
# Deploy all Phase 2 stacks in order
npx cdk deploy OverlayAuthStack OverlayComputeStack OverlayOrchestrationStack
```

## Post-Deployment Setup

### 1. Create Admin User

```bash
# Get User Pool ID from outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name OverlayAuthStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@overlay.com \
  --user-attributes Name=email,Value=admin@overlay.com \
                     Name=given_name,Value=Admin \
                     Name=family_name,Value=User \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@overlay.com \
  --password 'YourSecurePassword123!' \
  --permanent

# Add to system_admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@overlay.com \
  --group-name system_admin
```

### 2. Test API Endpoint

```bash
# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name OverlayComputeStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Test login
curl -X POST "${API_ENDPOINT}auth" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "login",
    "email": "admin@overlay.com",
    "password": "YourSecurePassword123!"
  }'
```

### 3. Test Document Upload Flow

```bash
# Get access token from login response above
ACCESS_TOKEN="<token>"

# Request upload URL
curl -X POST "${API_ENDPOINT}submissions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{
    "overlayId": "overlay-id-here",
    "fileName": "test.pdf",
    "fileType": "application/pdf"
  }'

# Upload file to presigned URL (returned from above)
curl -X PUT "<presigned-url>" \
  --upload-file test.pdf \
  -H "Content-Type: application/pdf"

# Check Step Functions execution
aws stepfunctions list-executions \
  --state-machine-arn <state-machine-arn> \
  --max-results 10
```

## Monitoring

### CloudWatch Logs

Lambda function logs:
```bash
# AI agent logs
aws logs tail /aws/lambda/overlay-structure-validator --follow
aws logs tail /aws/lambda/overlay-content-analyzer --follow
aws logs tail /aws/lambda/overlay-grammar-checker --follow
aws logs tail /aws/lambda/overlay-orchestrator --follow
aws logs tail /aws/lambda/overlay-clarification --follow
aws logs tail /aws/lambda/overlay-scoring --follow

# API logs
aws logs tail /aws/lambda/overlay-api-auth --follow
aws logs tail /aws/lambda/overlay-api-overlays --follow
aws logs tail /aws/lambda/overlay-api-sessions --follow
aws logs tail /aws/lambda/overlay-api-submissions --follow

# Step Functions logs
aws logs tail /aws/stepfunctions/overlay-document-analysis --follow
```

### Metrics

Key metrics to monitor:
- API Gateway: Request count, 4xx/5xx errors, latency
- Lambda: Invocations, errors, duration, concurrent executions
- Step Functions: Execution count, failed executions, duration
- Cognito: Sign-in attempts, failed authentications
- SQS: Messages in queue, DLQ message count

## Cost Estimation

### Monthly Costs (Estimated)

**Cognito**:
- 50 MAUs: Free (first 50k)

**Lambda**:
- API functions: ~$5-10 (assuming 100k requests)
- AI agents: ~$50-100 (compute time for AI operations)

**API Gateway**:
- 100k requests: ~$0.35

**Step Functions**:
- 1000 executions/month: ~$0.25

**SQS**:
- 100k messages: ~$0.04

**Bedrock** (Claude Haiku):
- Input: $0.25/MTok
- Output: $1.25/MTok
- Estimated: ~$10-30/month for 1000 documents

**Claude API** (Claude Sonnet):
- Input: $3/MTok
- Output: $15/MTok
- Estimated: ~$50-150/month for 1000 documents

**Total Phase 2**: ~$120-300/month (depending on usage)

**Note**: This is in addition to Phase 1 costs (~$75-205/month for infrastructure).

## Status

- [x] Auth Stack created
- [x] Compute Stack created
- [x] Orchestration Stack created
- [x] Lambda functions implemented (placeholder code)
- [x] Common layer implemented
- [x] TypeScript compilation successful
- [ ] Stacks deployed to AWS
- [ ] Admin user created
- [ ] API tested
- [ ] Document workflow tested end-to-end

## Next Steps

1. Deploy all Phase 2 stacks to AWS
2. Create admin user in Cognito
3. Test authentication flow
4. Test API endpoints
5. Upload test document and verify Step Functions execution
6. Implement complete business logic in Lambda functions (currently placeholders)
7. Add error handling and retry logic
8. Set up CloudWatch alarms and dashboards
9. Configure CI/CD pipeline for automated deployments

## Files Created

### CDK Stacks
- [lib/auth-stack.ts](lib/auth-stack.ts)
- [lib/compute-stack.ts](lib/compute-stack.ts)
- [lib/orchestration-stack.ts](lib/orchestration-stack.ts)
- [bin/overlay-platform.ts](bin/overlay-platform.ts) (updated)

### Lambda Functions
- [lambda/functions/structure-validator/index.js](lambda/functions/structure-validator/index.js)
- [lambda/functions/content-analyzer/index.js](lambda/functions/content-analyzer/index.js)
- [lambda/functions/grammar-checker/index.js](lambda/functions/grammar-checker/index.js)
- [lambda/functions/orchestrator/index.js](lambda/functions/orchestrator/index.js)
- [lambda/functions/clarification/index.js](lambda/functions/clarification/index.js)
- [lambda/functions/scoring/index.js](lambda/functions/scoring/index.js)
- [lambda/functions/api/auth/index.js](lambda/functions/api/auth/index.js)
- [lambda/functions/api/overlays/index.js](lambda/functions/api/overlays/index.js)
- [lambda/functions/api/sessions/index.js](lambda/functions/api/sessions/index.js)
- [lambda/functions/api/submissions/index.js](lambda/functions/api/submissions/index.js)

### Common Layer
- [lambda/layers/common/nodejs/package.json](lambda/layers/common/nodejs/package.json)
- [lambda/layers/common/nodejs/llm-client.js](lambda/layers/common/nodejs/llm-client.js)
- [lambda/layers/common/nodejs/db-client.js](lambda/layers/common/nodejs/db-client.js)

---

**Ready for deployment!** 🚀
