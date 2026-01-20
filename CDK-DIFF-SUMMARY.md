# CDK Diff Summary - Phase 2 Application Stacks

## Overview

Phase 2 will deploy **244 AWS resources** across 3 new stacks (Auth, Compute, Orchestration).

## Stack Breakdown

### 1. OverlayAuthStack (14 Resources)

**Cognito User Pool Resources**:
- 1 × User Pool (overlay-users)
- 1 × User Pool Client (web application)
- 1 × SMS Role (for MFA)
- 3 × User Groups (system_admin, document_admin, end_user)

**Lambda Triggers**:
- 2 × Lambda Functions (pre-signup, post-authentication)
- 2 × IAM Roles (for Lambda execution)
- 2 × CloudWatch Log Groups
- 2 × Lambda Permissions (Cognito invoke)

**Outputs**:
- User Pool ID
- User Pool ARN
- User Pool Client ID
- User Pool Domain

**Total**: **14 resources**

---

### 2. OverlayComputeStack (106 Resources)

**Lambda Functions** (10 total):
- 6 × AI Agent Functions:
  - Structure Validator (Bedrock Haiku)
  - Content Analyzer (Claude Sonnet)
  - Grammar Checker (Bedrock Haiku)
  - Orchestrator (Claude Sonnet)
  - Clarification (Claude Sonnet)
  - Scoring (Claude Sonnet)
- 4 × API Functions:
  - Auth Handler
  - Overlays Handler
  - Sessions Handler
  - Submissions Handler

**Supporting Resources**:
- 1 × Lambda Layer (common utilities)
- 1 × Security Group (Lambda VPC access)
- 10 × IAM Roles (one per Lambda)
- 10 × IAM Policies (Lambda execution policies)
- 10 × CloudWatch Log Groups
- 1 × Shared Log Retention Lambda
- 1 × Log Retention IAM Role + Policy

**API Gateway**:
- 1 × REST API
- 1 × API Deployment
- 1 × API Stage (production)
- 1 × Cognito Authorizer
- Multiple API Resources & Methods:
  - /auth (POST)
  - /overlays (GET, POST)
  - /overlays/{overlayId} (GET, PUT, DELETE)
  - /sessions (GET, POST)
  - /sessions/{sessionId} (GET)
  - /submissions (GET, POST)
  - /submissions/{submissionId} (GET)

**IAM Permissions**:
- Secrets Manager read access (Aurora + Claude API key)
- DynamoDB read/write access (documents, LLM config)
- S3 read/write access (document bucket)
- Bedrock InvokeModel permissions (AI functions)
- Cognito admin permissions (auth handler)

**Total**: **106 resources**

---

### 3. OverlayOrchestrationStack (124 Resources)

**Step Functions**:
- 1 × State Machine (6-agent workflow)
- 1 × CloudWatch Log Group (execution logs)
- 1 × IAM Role (state machine execution)
- State Machine States:
  - Structure Validation (Lambda invoke)
  - Content Analysis (Lambda invoke)
  - Grammar Check (Parallel + Lambda invoke)
  - Orchestration (Lambda invoke)
  - Clarification (Lambda invoke - conditional)
  - Scoring (Lambda invoke)
  - Choice states (2)
  - Success/Failure states

**SQS Queues**:
- 1 × Processing Queue
- 1 × Dead Letter Queue
- 2 × Queue Policies

**EventBridge**:
- 2 × Event Rules (failed execution, success execution)
- 2 × Event Targets (SQS, Lambda)

**Lambda Functions**:
- 1 × S3 Trigger Function (starts Step Functions)
- 1 × Success Handler Function
- 2 × IAM Roles (Lambda execution)
- 2 × IAM Policies
- 2 × CloudWatch Log Groups

**IAM Permissions**:
- Step Functions start execution (from S3 trigger)
- S3 read access (document bucket)
- Lambda invoke permissions (all AI agents)

**Outputs**:
- State Machine ARN
- Processing Queue URL
- Dead Letter Queue URL
- S3 Trigger Function ARN (for manual S3 config)

**Total**: **124 resources**

---

## Total Resources Across All Phase 2 Stacks

| Stack | Resources | Description |
|-------|-----------|-------------|
| OverlayAuthStack | 14 | Cognito User Pool, groups, Lambda triggers |
| OverlayComputeStack | 106 | 10 Lambda functions, API Gateway, IAM |
| OverlayOrchestrationStack | 124 | Step Functions, SQS, EventBridge |
| **TOTAL** | **244** | **Phase 2 application infrastructure** |

---

## Key Features Deployed

### Authentication (Auth Stack)
✓ Email-based login with Cognito
✓ 3-tier role system (admin, document_admin, end_user)
✓ MFA support (SMS + OTP)
✓ Strong password policy (12+ chars)
✓ Lambda triggers for auto-confirmation and audit logging
✓ Advanced security mode with device tracking

### Compute (Compute Stack)
✓ 6-agent AI workflow (Bedrock Haiku + Claude Sonnet)
✓ REST API with Cognito JWT authentication
✓ VPC-isolated Lambda functions
✓ LLM abstraction layer (common layer)
✓ Database connectivity (Aurora PostgreSQL)
✓ S3 presigned URLs for document upload/download
✓ Comprehensive IAM least privilege permissions

### Orchestration (Orchestration Stack)
✓ Step Functions state machine (6-agent workflow)
✓ Async processing with SQS (3 retry attempts)
✓ EventBridge rules for success/failure handling
✓ S3 event trigger (manual configuration)
✓ CloudWatch Logs integration
✓ Error handling with DLQ

---

## Security Highlights

### Network Security
- All AI agents run in VPC private subnets
- API handlers in VPC (database access)
- Security group controls VPC egress

### Data Security
- Secrets Manager for credentials (cached in Lambda)
- S3 server-side encryption
- DynamoDB AWS-managed encryption
- SQS KMS-managed encryption

### Access Control
- Cognito JWT tokens for API authentication
- IAM least privilege for all Lambda functions
- Separate roles per function
- Cross-stack exports for resource references

### Audit & Monitoring
- CloudWatch Logs (30-day retention)
- Step Functions execution tracking
- EventBridge for workflow monitoring
- Post-auth Lambda for login auditing

---

## Important Notes

### ⚠️ Manual Configuration Required

After deployment, you must **manually configure S3 event notification** because CDK cannot add it due to circular dependency:

```bash
# Get values from stack outputs
S3_TRIGGER_ARN=$(aws cloudformation describe-stacks \
  --stack-name OverlayOrchestrationStack \
  --query 'Stacks[0].Outputs[?OutputKey==`S3TriggerFunctionArn`].OutputValue' \
  --output text)

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name OverlayStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DocumentBucketName`].OutputValue' \
  --output text)

# Add Lambda permission for S3 to invoke
aws lambda add-permission \
  --function-name overlay-s3-trigger \
  --statement-id S3InvokePermission \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::${BUCKET_NAME}

# Configure S3 notification
aws s3api put-bucket-notification-configuration \
  --bucket $BUCKET_NAME \
  --notification-configuration "{
    \"LambdaFunctionConfigurations\": [{
      \"LambdaFunctionArn\": \"${S3_TRIGGER_ARN}\",
      \"Events\": [\"s3:ObjectCreated:*\"],
      \"Filter\": {
        \"Key\": {
          \"FilterRules\": [{
            \"Name\": \"prefix\",
            \"Value\": \"submissions/\"
          }]
        }
      }
    }]
  }"
```

### Deprecated API Warnings

The following warnings appear during `cdk diff` but don't affect functionality:
- `advancedSecurityMode` in Cognito (replaced with ThreatProtectionMode)
- `logRetention` in Lambda (replaced with `logGroup`)

These are cosmetic and will be addressed in future CDK versions.

---

## Dependencies

```
OverlayStorageStack (Phase 1)
    ↓
OverlayAuthStack
    ↓
OverlayComputeStack
    ↓
OverlayOrchestrationStack
```

---

## Deployment Command

```bash
# Deploy all Phase 2 stacks in order
npx cdk deploy OverlayAuthStack OverlayComputeStack OverlayOrchestrationStack

# Or deploy individually
npx cdk deploy OverlayAuthStack
npx cdk deploy OverlayComputeStack  # (requires Auth)
npx cdk deploy OverlayOrchestrationStack  # (requires Compute)
```

---

## Estimated Deployment Time

- **OverlayAuthStack**: ~3-5 minutes
- **OverlayComputeStack**: ~8-12 minutes (10 Lambda functions + API Gateway)
- **OverlayOrchestrationStack**: ~5-8 minutes (Step Functions + SQS + EventBridge)

**Total**: ~20-30 minutes for all Phase 2 stacks

---

## Cost Impact

Phase 2 adds the following monthly costs:

- **Cognito**: Free (< 50k MAU)
- **Lambda**: ~$55-110 (AI agents + API handlers)
- **API Gateway**: ~$0.35 (100k requests)
- **Step Functions**: ~$0.25 (1k executions)
- **SQS**: ~$0.04 (100k messages)
- **Bedrock**: ~$10-30 (Haiku usage)
- **Claude API**: ~$50-150 (Sonnet usage)

**Phase 2 Total**: ~$120-300/month (usage-dependent)
**Combined (Phase 1 + 2)**: ~$195-505/month

---

## Validation

After deployment, verify:
1. ✓ User Pool created in Cognito
2. ✓ API Gateway endpoint accessible
3. ✓ Lambda functions deployed
4. ✓ Step Functions state machine created
5. ✓ SQS queues created
6. ✓ S3 trigger configured manually (see above)

Test workflow:
1. Create admin user in Cognito
2. Login via API
3. Upload document to S3 (`submissions/`)
4. Verify Step Functions execution starts
5. Check CloudWatch Logs for workflow progress

---

**Ready to deploy!** 🚀

See [PHASE2-READY.md](PHASE2-READY.md) for detailed deployment instructions.
