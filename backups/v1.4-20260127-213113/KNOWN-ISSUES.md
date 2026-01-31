# Known Issues

This document tracks known issues in the Overlay Platform deployment.

## Authentication Lambda Missing Client ID

**Issue**: The auth Lambda function (`overlay-api-auth`) is missing the `USER_POOL_CLIENT_ID` environment variable.

**Impact**: Authentication endpoint returns 500 error when attempting to login.

**Error Message**:
```json
{
  "error": "1 validation error detected: Value null at 'clientId' failed to satisfy constraint: Member must not be null"
}
```

**Root Cause**: The compute stack does not pass the User Pool Client ID to the auth Lambda environment variables.

**Location**: `lib/compute-stack.ts` lines 209-212

**Current Code**:
```typescript
environment: {
  USER_POOL_ID: props.userPool.userPoolId,
  ...commonEnvironment,
},
```

**Fix**:
```typescript
environment: {
  USER_POOL_ID: props.userPool.userPoolId,
  USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
  ...commonEnvironment,
},
```

**To Apply Fix**:
1. Update `lib/compute-stack.ts` with the corrected environment variables
2. Rebuild TypeScript: `npm run build`
3. Redeploy the Compute Stack: `npx cdk deploy OverlayComputeStack`

**Workaround**: None - auth Lambda must be updated and redeployed.

**Status**: **UNRESOLVED** - Needs code update and redeployment

---

## API Lambda Functions Have Placeholder Code

**Issue**: All API Lambda functions currently contain placeholder implementation code.

**Impact**: Most endpoints return 501 (Not Implemented) or basic stub responses.

**Affected Endpoints**:
- `POST /overlays` - Returns 501
- `GET /sessions` - Returns 501
- `POST /sessions` - Returns 501
- `GET /overlays` - Returns empty array (no database integration)
- `GET /submissions` - Returns empty array (no database integration)

**Root Cause**: Lambda functions were deployed with minimal placeholder code to validate infrastructure. Full business logic not yet implemented.

**Status**: **EXPECTED** - This is by design for Phase 2 infrastructure deployment

**Next Steps**:
1. Implement database connectivity in API Lambdas
2. Add Aurora PostgreSQL queries
3. Add DynamoDB operations
4. Implement S3 presigned URL generation
5. Add proper error handling and validation

---

## Lambda Functions Missing Database Connectivity

**Issue**: Lambda functions reference database clients but don't execute actual database operations.

**Impact**: API responses return empty data or placeholders instead of actual data from Aurora.

**Affected Functions**:
- `overlay-api-overlays`
- `overlay-api-sessions`
- `overlay-api-submissions`

**Root Cause**: Placeholder code doesn't implement full database logic.

**Status**: **EXPECTED** - Infrastructure is deployed, business logic is pending

**Next Steps**:
1. Verify Aurora database migrations completed
2. Test VPC connectivity from Lambda to Aurora
3. Implement SQL queries in Lambda functions
4. Add connection pooling and error handling

---

## S3 Event Notification Configuration

**Issue**: S3 event notification was configured manually after deployment.

**Impact**: None - configuration is working correctly.

**Background**: CDK cannot automatically configure S3 event notifications when the Lambda function and S3 bucket are in different stacks due to circular dependency.

**Manual Steps Taken**:
```bash
aws lambda add-permission \
  --function-name overlay-s3-trigger \
  --statement-id S3InvokePermission \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::overlay-docs-975050116849

aws s3api put-bucket-notification-configuration \
  --bucket overlay-docs-975050116849 \
  --notification-configuration ...
```

**Status**: **RESOLVED** - Manual configuration completed successfully

**Verification**:
```bash
aws s3api get-bucket-notification-configuration \
  --bucket overlay-docs-975050116849 \
  --region eu-west-1
```

---

## CloudWatch Log Groups from Failed Deployments

**Issue**: During initial Auth Stack deployment, CloudWatch log groups persisted after stack rollback.

**Impact**: Subsequent deployments failed due to log group conflicts.

**Error**:
```
Resource of type 'AWS::Logs::LogGroup' with identifier '{"/properties/LogGroupName":"/aws/lambda/overlay-cognito-presignup"}' already exists
```

**Resolution**: Manually deleted log groups before successful redeployment.

**Status**: **RESOLVED** - Occurred during initial deployment, no longer an issue

**Prevention**: In future failed deployments, manually clean up log groups:
```bash
aws logs delete-log-group \
  --log-group-name /aws/lambda/overlay-cognito-presignup \
  --region eu-west-1
```

---

## Deployment Summary

| Issue | Severity | Status | Action Required |
|-------|----------|--------|----------------|
| Auth Lambda Missing Client ID | HIGH | UNRESOLVED | Update and redeploy |
| Placeholder Lambda Code | LOW | EXPECTED | Implement business logic |
| Missing Database Operations | MEDIUM | EXPECTED | Add database queries |
| S3 Event Notification | NONE | RESOLVED | Manual config complete |
| Log Group Conflicts | NONE | RESOLVED | Already cleaned up |

---

**Last Updated**: January 20, 2026
