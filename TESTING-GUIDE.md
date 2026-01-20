# Testing Guide

Comprehensive guide to testing the Overlay Platform at all levels.

## Quick Reference

| Test Type | Command | What It Tests | Duration |
|-----------|---------|--------------|----------|
| API Tests | `npm run test:api` | Authentication, API endpoints | ~10s |
| Workflow Test | `npm run test:workflow` | End-to-end document processing | ~1min |
| Unit Tests | `npm test` | Individual functions | ~5s |

## Test Scripts Overview

### 1. API Testing (`test-api.js`)

**Purpose**: Validate API Gateway, Cognito authentication, and Lambda functions

**What it tests**:
- ✅ Cognito authentication (ID token)
- ✅ GET /overlays (list overlays)
- ✅ GET /sessions (list sessions)
- ✅ POST /overlays (create overlay)

**Quick start**:
```bash
npm run test:api
```

**Custom credentials**:
```bash
npm run test:api -- --email admin@example.com --password SecurePass123!
```

**Expected result**: 4/4 tests passed

### 2. End-to-End Workflow Testing (`test-workflow.js`)

**Purpose**: Validate complete document analysis workflow from upload to results

**What it tests**:
- ✅ Document creation
- ✅ S3 upload
- ✅ S3 event trigger
- ✅ Step Functions execution
- ✅ AI agent processing (parallel)
- ✅ Database writes
- ✅ Results retrieval

**Quick start**:
```bash
npm run test:workflow
```

**Options**:
```bash
# Use specific overlay
npm run test:workflow -- --overlay-id 20000000-0000-0000-0000-000000000001

# Monitor existing execution
npm run test:workflow -- --skip-upload --execution-arn arn:aws:states:...
```

**Expected result**: All workflow steps complete successfully

### 3. Database Initialization (`db:init`)

**Purpose**: Run Aurora migrations and seed data

**What it does**:
- ✅ Creates 15 tables
- ✅ Seeds demo data
- ✅ Creates indexes
- ✅ Sets up triggers

**Quick start**:
```bash
npm run db:init
```

## Testing Workflow

### Initial Setup

1. **Deploy Infrastructure**
   ```bash
   npm run build
   npx cdk deploy --all
   ```

2. **Initialize Database**
   ```bash
   npm run db:init
   ```

3. **Create Admin User**
   ```bash
   npm run create-admin
   ```

4. **Seed LLM Config**
   ```bash
   npm run seed:llm-config
   ```

### Validation Tests

5. **Test API Endpoints**
   ```bash
   npm run test:api
   ```

   Expected: ✅ 4/4 tests passed

6. **Test End-to-End Workflow**
   ```bash
   npm run test:workflow
   ```

   Expected: ✅ Document processed, results in database

## Test Scenarios

### Scenario 1: New Deployment

After deploying to a new environment:

```bash
# 1. Initialize
npm run db:init
npm run create-admin
npm run seed:llm-config

# 2. Validate
npm run test:api

# 3. Test workflow
npm run test:workflow
```

### Scenario 2: Code Changes

After updating Lambda functions:

```bash
# 1. Rebuild
npm run build

# 2. Deploy
npx cdk deploy OverlayComputeStack

# 3. Test
npm run test:api
npm run test:workflow
```

### Scenario 3: Database Changes

After updating database schema:

```bash
# 1. Run migrations
npm run db:init

# 2. Verify with workflow test
npm run test:workflow
```

## Common Issues

### API Tests Fail with 401

**Problem**: `GET /overlays` returns 401 Unauthorized

**Solution**: Ensure using ID token (not access token)
- The script automatically uses ID token
- Verify Cognito authorizer configuration
- Check user is in correct group

### Workflow Test: No Execution Found

**Problem**: S3 upload doesn't trigger Step Functions

**Solution**: Check S3 event notifications:
```bash
aws s3api get-bucket-notification-configuration \
  --bucket overlay-docs-975050116849 \
  --region eu-west-1
```

### Database Connection Failed

**Problem**: Cannot connect to Aurora from local machine

**Solution**: Aurora is in private subnets
- Run from EC2/bastion in VPC
- Use AWS Systems Manager Session Manager
- Set up VPN to VPC
- Deploy Lambda to query results

## Test Data

### Demo Overlays

After database initialization, 4 demo overlays exist:
1. Contract Review - Standard
2. Financial Statement Review
3. Compliance Document Review
4. General Document Review

### Test Users

Create test users for different roles:

```bash
# System Admin
npm run create-admin -- \
  --email admin@example.com \
  --password Admin123!

# Document Admin
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username docadmin@example.com \
  ...
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username docadmin@example.com \
  --group-name document_admin

# End User
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username user@example.com \
  ...
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username user@example.com \
  --group-name end_user
```

## Performance Testing

### Measure API Response Time

```bash
time npm run test:api
```

### Measure Workflow Duration

```bash
time npm run test:workflow
```

### Load Testing

```bash
# Run multiple tests in parallel
for i in {1..10}; do
  npm run test:workflow &
done
wait
```

## Monitoring Test Results

### CloudWatch Logs

```bash
# API Gateway logs
aws logs tail /aws/apigateway/overlay-platform-api --follow --region eu-west-1

# Lambda logs
aws logs tail /aws/lambda/overlay-api-auth --follow --region eu-west-1
aws logs tail /aws/lambda/overlay-api-overlays --follow --region eu-west-1

# Step Functions logs
aws logs tail /aws/vendedlogs/states/overlay-document-workflow --follow --region eu-west-1
```

### Database Queries

```sql
-- View recent submissions
SELECT * FROM document_submissions
ORDER BY created_at DESC
LIMIT 10;

-- View feedback reports
SELECT * FROM feedback_reports
ORDER BY created_at DESC
LIMIT 10;

-- View criterion scores
SELECT * FROM criterion_scores
ORDER BY created_at DESC
LIMIT 20;
```

## Automated Testing in CI/CD

### GitHub Actions Example

```yaml
name: Test Deployment

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Test API
        run: npm run test:api
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: eu-west-1

      - name: Test Workflow
        run: npm run test:workflow
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: eu-west-1
```

## Test Coverage

### What's Tested

| Component | API Test | Workflow Test | Manual Test |
|-----------|----------|---------------|-------------|
| Cognito Auth | ✅ | - | - |
| API Gateway | ✅ | - | - |
| Lambda (API) | ✅ | - | - |
| Lambda (AI) | - | ✅ | - |
| S3 Events | - | ✅ | - |
| Step Functions | - | ✅ | - |
| Aurora Writes | - | ✅ | - |
| Aurora Reads | ✅ | ✅ | - |
| DynamoDB | - | ✅ | - |
| Secrets Manager | - | ✅ | - |

### What's Not Tested

- [ ] Frontend integration
- [ ] WebSocket connections
- [ ] Real DOCX file processing
- [ ] Large file uploads (>10MB)
- [ ] Concurrent user sessions
- [ ] Rate limiting
- [ ] Security vulnerabilities
- [ ] Load/stress testing

## Next Steps

After successful testing:

1. ✅ Infrastructure validated
2. ✅ Authentication working
3. ✅ API endpoints functional
4. ✅ Workflow executing
5. ⏳ Implement full AI agent logic
6. ⏳ Add frontend application
7. ⏳ Production deployment
8. ⏳ Monitoring and alerting

## See Also

- [scripts/README.md](scripts/README.md) - Detailed script documentation
- [TEST-WORKFLOW.md](TEST-WORKFLOW.md) - Workflow test quick reference
- [CREATE-ADMIN-USER.md](CREATE-ADMIN-USER.md) - Admin user creation
- [KNOWN-ISSUES.md](KNOWN-ISSUES.md) - Known issues and fixes
