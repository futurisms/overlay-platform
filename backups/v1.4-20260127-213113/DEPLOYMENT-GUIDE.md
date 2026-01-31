# Overlay Platform - Deployment Guide

## Pre-Deployment Checklist

✅ **Completed**:
- [x] AWS CDK installed and bootstrapped
- [x] AWS credentials configured (Account: 975050116849)
- [x] CDK bootstrap completed for eu-west-1
- [x] Claude API key configured in `.env` file
- [x] Project built successfully
- [x] Storage stack created and ready

## Deployment Steps

### Step 1: Verify Environment Variables

Ensure your `.env` file contains:

```bash
AWS_REGION=eu-west-1
AWS_ACCOUNT_ID=975050116849
CDK_DEFAULT_ACCOUNT=975050116849
CDK_DEFAULT_REGION=eu-west-1
ENVIRONMENT=production
CLAUDE_API_KEY=sk-ant-api03-...
```

Verify the API key is loaded:
```bash
node -e "require('dotenv').config(); console.log('API Key loaded:', !!process.env.CLAUDE_API_KEY);"
```

### Step 2: Review What Will Be Deployed

```bash
# Review storage stack changes
cdk diff OverlayStorageStack

# Review platform stack changes
cdk diff OverlayPlatformStack
```

### Step 3: Deploy Storage Stack

The Storage Stack creates the foundation infrastructure:
- VPC with public, private, and isolated subnets
- Aurora Serverless v2 PostgreSQL cluster
- DynamoDB tables (documents and LLM config)
- S3 bucket for document storage
- Secrets Manager for API keys

```bash
# Deploy storage infrastructure
cdk deploy OverlayStorageStack
```

**Expected deployment time**: 15-20 minutes (Aurora cluster takes the longest)

### Step 4: Deploy Platform Stack

The Platform Stack creates the application layer:
- Lambda layers
- Future: Lambda functions, API Gateway, etc.

```bash
# Deploy application infrastructure
cdk deploy OverlayPlatformStack
```

**Expected deployment time**: 2-3 minutes

### Step 5: Deploy All Stacks at Once (Alternative)

```bash
# Deploy all stacks in order
cdk deploy --all
```

## Post-Deployment Steps

### 1. Verify Aurora Cluster

```bash
# Get Aurora endpoint
aws cloudformation describe-stacks \
  --stack-name OverlayStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraClusterEndpoint`].OutputValue' \
  --output text
```

### 2. Retrieve Database Credentials

```bash
# Get the secret ARN
aws cloudformation describe-stacks \
  --stack-name OverlayStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraSecretArn`].OutputValue' \
  --output text

# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id overlay/aurora/production/credentials \
  --query SecretString \
  --output text | jq
```

### 3. Verify Claude API Key

```bash
# Verify the Claude API key is stored
aws secretsmanager get-secret-value \
  --secret-id overlay/claude/production/api-key \
  --query SecretString \
  --output text | jq
```

### 4. Initialize Aurora Database

Connect to Aurora and run initialization scripts:

```bash
# Get connection details
export DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name OverlayStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraClusterEndpoint`].OutputValue' \
  --output text)

export DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id overlay/aurora/production/credentials \
  --query SecretString \
  --output text)

# Extract credentials
export DB_USERNAME=$(echo $DB_SECRET | jq -r .username)
export DB_PASSWORD=$(echo $DB_SECRET | jq -r .password)
export DB_NAME=$(echo $DB_SECRET | jq -r .dbname)

# Connect using psql (requires connection from within VPC or bastion host)
# For now, note these for later when we set up VPC connectivity
echo "Database Endpoint: $DB_ENDPOINT"
echo "Database Name: $DB_NAME"
echo "Username: $DB_USERNAME"
```

### 5. Test S3 Bucket

```bash
# Test upload
aws s3 cp test-document.txt s3://overlay-documents-975050116849/

# Verify
aws s3 ls s3://overlay-documents-975050116849/
```

### 6. Test DynamoDB Tables

```bash
# List tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `overlay`)]'

# Describe document table
aws dynamodb describe-table --table-name overlay-documents

# Describe LLM config table
aws dynamodb describe-table --table-name overlay-llm-config
```

## Monitoring and Verification

### CloudWatch Logs

Aurora PostgreSQL logs are exported to CloudWatch:
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/rds/cluster/auroracluster"
```

### Resource Tags

All resources are tagged with:
- `Project: Overlay`
- `Environment: production`
- `Stack: Storage` or `Stack: Application`

View tagged resources:
```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=Overlay
```

## Cost Monitoring

Set up a billing alarm:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name overlay-platform-cost-alert \
  --alarm-description "Alert when Overlay Platform costs exceed threshold" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 200 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD
```

## Troubleshooting

### Stack Deployment Fails

1. Check CloudFormation events:
```bash
aws cloudformation describe-stack-events \
  --stack-name OverlayStorageStack \
  --max-items 20
```

2. Review error messages and fix issues

3. Delete and retry if needed:
```bash
cdk destroy OverlayStorageStack
cdk deploy OverlayStorageStack
```

### Aurora Cluster Issues

- Ensure VPC has proper subnet configuration
- Verify security groups allow traffic from expected sources
- Check CloudWatch logs for PostgreSQL errors

### Secret Access Issues

- Verify IAM permissions for reading secrets
- Ensure secret names match expected format
- Check if secrets exist:
```bash
aws secretsmanager list-secrets
```

## Security Best Practices

1. **Rotate Secrets**: Set up automatic rotation for Aurora credentials
2. **Enable MFA Delete**: For S3 bucket protection
3. **Review IAM Policies**: Ensure least privilege access
4. **Enable CloudTrail**: Track all API calls
5. **Set up GuardDuty**: Detect security threats
6. **Configure WAF**: When API Gateway is added

## Next Phase: Application Layer

After successful storage deployment:

1. Create Lambda functions for document processing
2. Set up API Gateway for REST endpoints
3. Configure Cognito for user authentication
4. Add Step Functions for workflows
5. Set up EventBridge for event routing
6. Deploy frontend application

## Rollback Procedure

If deployment fails or issues arise:

```bash
# Destroy application stack first (has dependencies)
cdk destroy OverlayPlatformStack

# Then destroy storage stack
cdk destroy OverlayStorageStack
```

**Note**: Resources with `RETAIN` policy (S3, DynamoDB, Aurora snapshots) will not be deleted automatically.

## Support

For issues:
1. Check CloudFormation events
2. Review CloudWatch logs
3. Verify AWS service limits
4. Check AWS service health dashboard

---

**Ready to Deploy**: Yes ✅
**Estimated Time**: 20-25 minutes total
**Estimated Cost**: $75-$205/month
