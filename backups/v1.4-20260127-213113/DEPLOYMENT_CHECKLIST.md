# Deployment Checklist

**Purpose**: Ensure safe, validated deployments with rollback capability.

**When to use**:
- Before deploying to AWS
- After code changes to Lambda functions
- After database migrations
- Before production releases

---

## Pre-Deployment Checklist

### 1. Code Quality
- [ ] All TypeScript/JavaScript linting passes
- [ ] No console errors in frontend dev server
- [ ] Git status clean (no uncommitted changes) or changes committed
- [ ] Branch up to date with main/master

### 2. Local Testing
- [ ] Ran full [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) locally
- [ ] All critical paths working (auth, overlays, upload, feedback)
- [ ] No regressions from previous features
- [ ] Browser console shows no errors

### 3. Database Readiness
- [ ] Database migrations written (if schema changes)
- [ ] Migration tested locally
- [ ] Rollback migration prepared (if needed)
- [ ] Seed data updated (if new tables/columns)

### 4. AWS Readiness
- [ ] AWS credentials configured (`aws sts get-caller-identity`)
- [ ] CDK bootstrap completed for region
- [ ] Correct AWS profile selected
- [ ] CloudFormation stacks in healthy state

### 5. Dependencies
- [ ] `npm install` run in all directories (root, frontend, lambda)
- [ ] Lambda layer dependencies up to date
- [ ] No security vulnerabilities (`npm audit`)

---

## Deployment Steps

### Step 1: Deploy Infrastructure Changes (if any)

**Deploy Storage Stack** (Database, S3, DynamoDB):
```bash
cdk deploy OverlayStorageStack --require-approval never
```

Expected output:
```
✅ OverlayStorageStack
✨ Deployment time: XX.Xs
```

**Verify**:
- [ ] Aurora cluster running
- [ ] S3 bucket created
- [ ] DynamoDB tables created

---

**Deploy Auth Stack** (Cognito):
```bash
cdk deploy OverlayAuthStack --require-approval never
```

Expected output:
```
✅ OverlayAuthStack
✨ Deployment time: XX.Xs
```

**Verify**:
- [ ] User pool created
- [ ] Test user exists (admin@example.com)
- [ ] User groups configured (system_admin, reviewer, submitter)

---

### Step 2: Run Database Migrations

**Trigger migration Lambda**:
```bash
aws lambda invoke \
  --function-name overlay-database-migration \
  --region eu-west-1 \
  --payload '{}' \
  response.json
```

**Verify**:
- [ ] Migration Lambda completes successfully
- [ ] Check CloudWatch logs for "All migrations completed"
- [ ] Verify tables exist with correct schema

**Rollback plan**:
```bash
# If migration fails, restore from RDS snapshot
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier overlay-db-cluster \
  --db-cluster-identifier overlay-db-cluster-restored \
  --restore-to-time 2024-01-26T10:00:00Z
```

---

### Step 3: Deploy Orchestration Stack (AI Agents)

**Deploy**:
```bash
cdk deploy OverlayOrchestrationStack --require-approval never
```

Expected output:
```
✅ OverlayOrchestrationStack
✨ Deployment time: 120-180s
```

**Verify**:
- [ ] 6 agent Lambda functions deployed:
  - overlay-structure-validator
  - overlay-content-analyzer
  - overlay-grammar-checker
  - overlay-orchestrator
  - overlay-clarification
  - overlay-scoring
- [ ] Step Functions state machine created (OverlayOrchestrator)
- [ ] Lambda layer updated (overlay-common-layer)

**Test**:
```bash
# Test structure validator
aws lambda invoke \
  --function-name overlay-structure-validator \
  --region eu-west-1 \
  --payload '{"documentId":"test","s3Key":"test.txt","s3Bucket":"overlay-documents","overlayId":"test"}' \
  test-response.json
```

---

### Step 4: Deploy Compute Stack (API Handlers)

**Deploy**:
```bash
cdk deploy OverlayComputeStack --require-approval never
```

Expected output:
```
✅ OverlayComputeStack
✨ Deployment time: 40-60s

Outputs:
OverlayComputeStack.ApiEndpoint = https://[API_ID].execute-api.eu-west-1.amazonaws.com/production/
```

**Verify**:
- [ ] 9 API Lambda handlers deployed:
  - overlay-organizations-handler
  - overlay-overlays-handler
  - overlay-sessions-handler
  - overlay-submissions-handler
  - overlay-users-handler
  - overlay-invitations-handler
  - overlay-answers-handler
  - overlay-analytics-handler
  - overlay-llm-config-handler
- [ ] API Gateway routes configured (39+ endpoints)
- [ ] Cognito authorizer attached

**Test critical endpoints**:
```bash
# Get auth token
TOKEN=$(node scripts/get-auth-token.js)

# Test overlays endpoint
curl -X GET \
  https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"overlays": [...], "total": N}
```

---

## Post-Deployment Validation

### 1. Smoke Test (5 minutes)

Run the quick smoke test from [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md):
- [ ] Login works
- [ ] Dashboard loads
- [ ] Overlays list shows data
- [ ] Document upload succeeds
- [ ] Feedback displays

### 2. Full Integration Test (15 minutes)

Run complete testing checklist:
```bash
# Automated test
node scripts/end-to-end-test.js

# Manual testing
# Follow TESTING_CHECKLIST.md sections 1-6
```

### 3. CloudWatch Monitoring

Check for errors in CloudWatch Logs:
```bash
# Check recent errors across all Lambda functions
aws logs filter-log-events \
  --log-group-name /aws/lambda/overlay-* \
  --start-time $(($(date +%s) - 3600))000 \
  --filter-pattern "ERROR"
```

**Verify**:
- [ ] No ERROR level logs
- [ ] No WARN level logs about failures
- [ ] Response times under 3 seconds

### 4. API Gateway Metrics

Check API Gateway dashboard:
- [ ] 4xx error rate < 5%
- [ ] 5xx error rate = 0%
- [ ] Latency p99 < 5 seconds

### 5. Database Connection Pool

Check Aurora metrics:
- [ ] DatabaseConnections < 50% of max
- [ ] No connection timeouts
- [ ] Query latency normal

---

## Rollback Procedure

If deployment fails or critical issues found:

### Quick Rollback (API Changes Only)

```bash
# Redeploy previous version
git checkout [PREVIOUS_COMMIT_SHA]
cdk deploy OverlayComputeStack --require-approval never

# Or use AWS Lambda versions
aws lambda update-function-code \
  --function-name overlay-overlays-handler \
  --s3-bucket cdk-XXXXX \
  --s3-key [PREVIOUS_VERSION_KEY]
```

### Full Rollback (Infrastructure Changes)

```bash
# Destroy stacks in reverse order
cdk destroy OverlayComputeStack
cdk destroy OverlayOrchestrationStack
cdk destroy OverlayAuthStack
cdk destroy OverlayStorageStack

# Redeploy from previous working commit
git checkout [PREVIOUS_WORKING_COMMIT]
cdk deploy --all
```

### Database Rollback

```bash
# Restore from automatic snapshot
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier overlay-db-cluster \
  --db-cluster-identifier overlay-db-cluster-restored \
  --restore-to-time [TIMESTAMP_BEFORE_MIGRATION]

# Update database endpoint in Secrets Manager
```

---

## Deployment Log Template

Save this for each deployment:

```
# Deployment Log: [DATE] [TIME]
Deployer: [NAME]
Branch: [BRANCH_NAME]
Commit: [SHA]
Environment: [dev/staging/production]

## Pre-Deployment Checks
- Code quality: ✅
- Local testing: ✅
- Database migrations: ✅
- AWS readiness: ✅

## Deployment Steps
1. OverlayStorageStack: ✅ [timestamp] [duration]
2. OverlayAuthStack: ✅ [timestamp] [duration]
3. Database migration: ✅ [timestamp] [duration]
4. OverlayOrchestrationStack: ✅ [timestamp] [duration]
5. OverlayComputeStack: ✅ [timestamp] [duration]

## Post-Deployment Validation
- Smoke test: ✅ PASS
- Integration test: ✅ PASS
- CloudWatch errors: ✅ None
- API metrics: ✅ Normal

## Changes Deployed
- [Brief description of changes]
- [Lambda functions modified]
- [Database schema changes]

## Issues Encountered
- [Issue 1]: [Resolution]
- None

## Rollback Plan (if needed)
- Commit to rollback to: [SHA]
- Database snapshot: [snapshot-id]
- Estimated rollback time: [X minutes]

## Sign-off
Deployed by: [NAME]
Validated by: [NAME]
Status: ✅ SUCCESS / ❌ FAILED
```

---

## Common Deployment Issues

### Issue: CDK Deploy Fails with "No changes to deploy"
**Cause**: Code changes not recognized by CDK
**Fix**: Force rebuild Lambda assets
```bash
cdk synth --force
cdk deploy OverlayComputeStack --force
```

### Issue: Lambda Functions Can't Connect to Database
**Cause**: VPC security groups not allowing traffic
**Fix**: Update security group rules
```bash
# Check security group allows port 5432 from Lambda
aws ec2 describe-security-groups \
  --group-ids [DB_SECURITY_GROUP_ID]
```

### Issue: API Gateway Returns 502 Bad Gateway
**Cause**: Lambda function timeout or error
**Fix**: Check CloudWatch logs
```bash
aws logs tail /aws/lambda/overlay-overlays-handler --follow
```

### Issue: Cognito Authorization Fails
**Cause**: Token expired or wrong user pool
**Fix**: Get fresh token
```bash
node scripts/get-auth-token.js
```

### Issue: Step Functions Execution Fails
**Cause**: Missing environment variables or permissions
**Fix**: Check Lambda environment variables
```bash
aws lambda get-function-configuration \
  --function-name overlay-structure-validator
```

---

## Production Deployment (Additional Steps)

For production releases:

1. **Blue/Green Deployment**
   - [ ] Deploy to staging environment first
   - [ ] Run full test suite on staging
   - [ ] Get stakeholder approval
   - [ ] Deploy to production with alias switching

2. **Traffic Monitoring**
   - [ ] Monitor API Gateway traffic for 1 hour post-deployment
   - [ ] Watch error rates and latency
   - [ ] Be ready to rollback within 15 minutes

3. **Database Backup**
   - [ ] Take manual RDS snapshot before deployment
   - [ ] Verify snapshot completed successfully
   - [ ] Document snapshot ID for rollback

4. **Communication**
   - [ ] Notify team in Slack/email before deployment
   - [ ] Post deployment completion message
   - [ ] Document any known issues or workarounds

---

## Deployment Frequency

- **Development**: Deploy as needed after each feature
- **Staging**: Daily or after feature completion
- **Production**: Weekly or bi-weekly after full testing

---

## Success Criteria

Deployment is successful when:
- ✅ All CDK stacks deploy without errors
- ✅ All Lambda functions pass health checks
- ✅ Full integration test passes
- ✅ No CloudWatch errors in 1 hour post-deployment
- ✅ API response times within normal range
- ✅ Database connections healthy
- ✅ End users can complete critical workflows
