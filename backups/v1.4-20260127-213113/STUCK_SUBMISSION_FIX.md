# Fix for Stuck Submissions Issue

## Problem
Documents uploaded were getting stuck in "pending" status because the AI analysis workflow was never triggered.

## Root Cause
The `WORKFLOW_STATE_MACHINE_ARN` environment variable was missing from the `overlay-api-submissions` Lambda function, so the code that triggers Step Functions workflows (lines 148-165 in `lambda/functions/submissions-crud-handler/index.js`) was being skipped.

## Fixes Applied

### Fix 1: Added Environment Variable (January 25, 2026, 14:45 UTC)

#### 1. Added Environment Variable
```bash
aws lambda update-function-configuration \
  --function-name overlay-api-submissions \
  --environment "Variables={...,WORKFLOW_STATE_MACHINE_ARN=arn:aws:states:eu-west-1:975050116849:stateMachine:overlay-document-analysis}"
```

#### 2. Granted IAM Permissions

**Step Functions Access** (for triggering AI workflows):
```bash
aws iam attach-role-policy \
  --role-name OverlayComputeStack-SubmissionsHandlerServiceRoleEE-NCvL4rQapsib \
  --policy-arn arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess
```

**Secrets Manager Access** (for database credentials):
```bash
aws iam put-role-policy \
  --role-name OverlayComputeStack-SubmissionsHandlerServiceRoleEE-NCvL4rQapsib \
  --policy-name SecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": [
        "arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/aurora/production/credentials-*",
        "arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/claude/production/api-key-*"
      ]
    }]
  }'
```

**Note**: Using wildcard patterns (`*`) at the end of secret ARNs allows the policy to match the random suffixes that AWS Secrets Manager appends to secret names.

**S3 Bucket Access** (for document uploads):
```bash
aws iam put-role-policy \
  --role-name OverlayComputeStack-SubmissionsHandlerServiceRoleEE-NCvL4rQapsib \
  --policy-name S3DocumentBucketAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::overlay-docs-975050116849/*",
        "arn:aws:s3:::overlay-docs-975050116849"
      ]
    }]
  }'
```

**DynamoDB Access** (for document metadata):
```bash
aws iam put-role-policy \
  --role-name OverlayComputeStack-SubmissionsHandlerServiceRoleEE-NCvL4rQapsib \
  --policy-name DynamoDBAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"],
      "Resource": [
        "arn:aws:dynamodb:eu-west-1:975050116849:table/overlay-documents",
        "arn:aws:dynamodb:eu-west-1:975050116849:table/overlay-llm-config"
      ]
    }]
  }'
```

### Fix 2: Updated Secret ARNs (January 25, 2026, 16:20 UTC)

**Issue**: Lambda environment variables contained old secret ARNs that no longer exist.

**Error**: "Secrets Manager can't find the specified secret"

**Solution**:
1. Listed current secrets in Secrets Manager to find correct ARNs
2. Updated Lambda environment variables with new secret paths:
   - `overlay/aurora/production/credentials-E3A4vl`
   - `overlay/claude/production/api-key-oZkZHk`
3. Updated IAM policy to match new secret name patterns with wildcards

See ["Secrets Manager Can't Find the Specified Secret" Error](#secrets-manager-cant-find-the-specified-secret-error) section for details.

### Fix 3: Corrected Step Functions Input Format (January 25, 2026, 16:28 UTC)

**Issue**: Submissions handler was passing `submissionId` to Step Functions, but the state machine expects `documentId`.

**Error**: Step Functions failed immediately with:
```
The JSONPath '$.documentId' specified for the field 'documentId.$' could not be found in the input
```

**Solution**: Updated [lambda/functions/submissions-crud-handler/index.js](lambda/functions/submissions-crud-handler/index.js:148-166) to pass both `documentId` and `submissionId`:

```javascript
input: JSON.stringify({
  documentId: submission.submission_id, // State machine expects documentId
  submissionId: submission.submission_id, // Also pass submissionId for compatibility
  s3Bucket: s3Bucket,
  s3Key: s3Key,
  overlayId: overlay_id,
  uploadedAt: new Date().toISOString(),
}),
```

This ensures the Step Functions workflow receives the correct input format and can process documents successfully.

### Fix 4: Validated Criterion IDs in Scoring Agent (January 25, 2026, 16:48 UTC)

**Issue**: When overlays have no evaluation criteria defined, Claude generates fake criterion IDs (strings like "structure_validation") which fail when inserted into the database (expects UUIDs).

**Error**:
```
invalid input syntax for type uuid: "structure_validation"
```

**Solution**: Updated [lambda/functions/scoring/index.js](lambda/functions/scoring/index.js:153-169) to validate criterion IDs before saving to database:

```javascript
// Helper function to validate UUID format
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const scoresForDb = scoringResult.criterionScores.map(s => ({
  criterionId: criteriaMap[s.criterionName] || s.criterionId,
  score: s.score,
  reasoning: s.reasoning,
  evaluatedBy: 'ai-agent',
})).filter(s => s.criterionId && isValidUUID(s.criterionId)); // Only include valid UUID criterion IDs
```

This allows the workflow to complete successfully even when overlays have no criteria defined. The AI feedback is still saved in the feedback_reports table.

## How It Works Now

When a document is uploaded:

1. **Frontend** → Uploads document with base64 content to `/submissions` endpoint
2. **Submissions Handler** →
   - Uploads file to S3: `s3://overlay-docs-975050116849/submissions/{userId}/{timestamp}-{filename}`
   - Creates submission record in database (status: "submitted", ai_analysis_status: "pending")
   - **NEW**: Triggers Step Functions workflow with `WORKFLOW_STATE_MACHINE_ARN`
3. **Step Functions** →
   - Runs 6 AI agents in sequence (structure → content → grammar → orchestrator → clarification → scoring)
   - Takes ~2-3 minutes to complete
4. **Scoring Agent** →
   - Saves AI results to database
   - Updates submission status to "completed"
5. **Frontend** →
   - Auto-refreshes every 10 seconds
   - Displays AI feedback, scores, strengths, weaknesses, recommendations

## Frontend Changes

Added auto-refresh polling to [frontend/app/submission/[id]/page.tsx](frontend/app/submission/[id]/page.tsx:69-81):

```typescript
// Auto-refresh when analysis is in progress
useEffect(() => {
  if (!submission || submission.ai_analysis_status === "completed") {
    return;
  }

  // Poll every 10 seconds when analysis is not completed
  const intervalId = setInterval(() => {
    console.log("Auto-refreshing submission data...");
    loadSubmissionData();
  }, 10000);

  return () => clearInterval(intervalId);
}, [submission?.ai_analysis_status]);
```

Improved messaging for pending/in-progress states:
- **Pending**: "Your document has been uploaded successfully and is waiting for AI analysis to begin."
- **In Progress**: "AI agents are analyzing your document. This may take a few minutes."
- Both show: "⏱️ Auto-refreshing every 10 seconds..."

## Testing

To test the fix:

1. Navigate to the dashboard
2. Click "Quick Upload" or go to a session
3. Upload a document (PDF, DOCX, TXT)
4. You'll be redirected to the submission detail page
5. Wait 10-30 seconds - status should change from "pending" to "in_progress"
6. Wait 2-3 minutes - AI analysis should complete
7. Page will auto-refresh and show:
   - Overall score
   - Strengths
   - Weaknesses
   - Recommendations
   - Clarification questions

## Old Submissions

**Important**: Submissions created BEFORE this fix (like submission ID `219acea6-ef54-482c-9fc0-202afcce8924`) will remain stuck in "pending" status because:

1. They were uploaded when the environment variable was missing
2. The Step Functions workflow was never triggered
3. No AI analysis data exists for them

**Options for old submissions:**
- **Option 1**: Delete and re-upload the document
- **Option 2**: Manually trigger the workflow (requires S3 key from database)
- **Option 3**: Leave them as-is (they won't auto-complete)

## Verification

Check that the fix is working:

```bash
# Verify environment variable is set
aws lambda get-function-configuration --function-name overlay-api-submissions --query 'Environment.Variables.WORKFLOW_STATE_MACHINE_ARN'

# List all permissions attached to role
aws iam list-role-policies --role-name OverlayComputeStack-SubmissionsHandlerServiceRoleEE-NCvL4rQapsib

# Check recent Step Functions executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-west-1:975050116849:stateMachine:overlay-document-analysis \
  --max-results 10

# View Lambda logs
aws logs tail /aws/lambda/overlay-api-submissions --follow
```

## Troubleshooting

### Permission Denied Errors

If you see errors like:
```
User: ... is not authorized to perform: secretsmanager:GetSecretValue ...
```

This means the submissions handler is missing IAM permissions. Run the permission grant commands above again, or check which specific permission is missing from the error message and add it.

### "Secrets Manager Can't Find the Specified Secret" Error

If you see this error after fixing permissions:
```
Secrets Manager can't find the specified secret
```

This means the Lambda's environment variables contain ARNs for secrets that no longer exist (likely from a previous stack deployment).

**Root Cause**: The CDK stack was redeployed, which created new secrets with different names, but the Lambda's environment variables still reference the old secret ARNs.

**Fix**: Update the Lambda's environment variables to point to the current secrets:

1. **List current secrets** to find the correct ARNs:
```bash
aws secretsmanager list-secrets --region eu-west-1 --query 'SecretList[?contains(Name, `overlay`)].{Name:Name, ARN:ARN}'
```

2. **Update Lambda environment variables** with correct ARNs:
```bash
aws lambda update-function-configuration \
  --function-name overlay-api-submissions \
  --region eu-west-1 \
  --environment "Variables={DOCUMENT_BUCKET=overlay-docs-975050116849,ENVIRONMENT=production,WORKFLOW_STATE_MACHINE_ARN=arn:aws:states:eu-west-1:975050116849:stateMachine:overlay-document-analysis,AURORA_ENDPOINT=overlay-db-cluster.cluster-c4jzxvjwxnfn.eu-west-1.rds.amazonaws.com,AURORA_SECRET_ARN=arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/aurora/production/credentials-E3A4vl,DOCUMENT_TABLE=overlay-documents,LLM_CONFIG_TABLE=overlay-llm-config,AWS_NODEJS_CONNECTION_REUSE_ENABLED=1,CLAUDE_API_KEY_SECRET=arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/claude/production/api-key-oZkZHk}"
```

3. **Update IAM policy** to match the new secret name patterns:
```bash
aws iam put-role-policy \
  --role-name OverlayComputeStack-SubmissionsHandlerServiceRoleEE-NCvL4rQapsib \
  --policy-name SecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": [
        "arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/aurora/production/credentials-*",
        "arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/claude/production/api-key-*"
      ]
    }]
  }'
```

Wait 5-10 seconds for the configuration update to propagate, then try uploading again.

### Common Permission Issues

- **Secrets Manager**: Required to read database credentials and API keys
- **S3**: Required to upload document files
- **DynamoDB**: Required to store document metadata
- **Step Functions**: Required to trigger AI analysis workflows

All four permission sets must be in place for uploads to work correctly.

## Future Improvement

To prevent this issue in the future, update the CDK infrastructure to include the environment variable at deployment time. However, this requires resolving the cyclic dependency between ComputeStack and OrchestrationStack.

**Possible solutions:**
1. Use CloudFormation exports/imports
2. Create a third stack for cross-stack wiring
3. Pass state machine ARN as SSM parameter
4. Use custom resource to update Lambda after both stacks deploy

For now, the manual AWS CLI fix is sufficient and will persist across Lambda function updates (as long as the code path doesn't change).
