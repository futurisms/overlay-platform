# Overlay Platform - Storage Stack Deployment Summary

## Overview

Phase 1 of the Overlay Platform infrastructure has been successfully created. The Storage Stack provides the foundational data layer for the AI-powered document review system.

## Infrastructure Components Created

### 1. VPC (Virtual Private Cloud)
- **Name**: `overlay-vpc`
- **CIDR**: 10.0.0.0/16
- **Availability Zones**: 2
- **Subnets**:
  - **Public Subnets** (2x): For NAT Gateway and future load balancers
  - **Private Subnets** (2x): For Lambda functions with internet access
  - **Isolated Subnets** (2x): For Aurora database (no internet access)
- **NAT Gateway**: 1 (for cost optimization)
- **Internet Gateway**: 1

### 2. Aurora Serverless v2 PostgreSQL Cluster
- **Engine**: PostgreSQL 16.6
- **Cluster Name**: AuroraCluster
- **Database Name**: `overlay_db`
- **Username**: `overlay_admin`
- **Instances**:
  - 1x Writer instance (Serverless v2)
  - 1x Reader instance (Serverless v2 with writer scaling)
- **Scaling**: 0.5 - 2 ACU (Aurora Capacity Units)
- **Backup**: 7-day retention, daily at 03:00-04:00
- **Encryption**: Storage encrypted at rest
- **Logging**: PostgreSQL logs exported to CloudWatch (30-day retention)
- **Security**:
  - Deployed in isolated subnets
  - Security group allows access only from VPC CIDR
  - Deletion protection enabled
  - Snapshot on stack deletion

### 3. DynamoDB Tables

#### A. Document Metadata Table
- **Table Name**: `overlay-documents`
- **Primary Key**:
  - Partition Key: `documentId` (String)
  - Sort Key: `timestamp` (Number)
- **Global Secondary Indexes**:
  - **StatusIndex**: Query by status + timestamp
  - **UserIndex**: Query by uploadedBy + timestamp
- **Features**:
  - Pay-per-request billing
  - Point-in-time recovery enabled
  - DynamoDB Streams enabled (NEW_AND_OLD_IMAGES)
  - AWS-managed encryption
  - RETAIN policy (preserved on stack deletion)

#### B. LLM Configuration Table
- **Table Name**: `overlay-llm-config`
- **Primary Key**:
  - Partition Key: `configId` (String)
  - Sort Key: `version` (Number)
- **Global Secondary Index**:
  - **ActiveConfigIndex**: Query by isActive + lastModified
- **Features**:
  - Pay-per-request billing
  - Point-in-time recovery enabled
  - AWS-managed encryption
  - RETAIN policy

### 4. S3 Bucket
- **Bucket Name**: `overlay-documents-975050116849`
- **Features**:
  - Server-side encryption (S3-managed keys)
  - Versioning enabled
  - Public access completely blocked
  - CORS configured for web uploads
- **Lifecycle Policies**:
  - Delete old versions after 90 days
  - Transition to Infrequent Access after 30 days
- **Retention**: RETAIN policy

### 5. Secrets Manager

#### A. Aurora Database Credentials
- **Secret Name**: `overlay/aurora/production/credentials`
- **Contents**: Auto-generated password for `overlay_admin` user
- **Auto-rotation**: Available (not yet configured)

#### B. Claude API Key
- **Secret Name**: `overlay/claude/production/api-key`
- **Contents**: Placeholder (needs to be updated with actual API key)
- **Purpose**: Store Anthropic Claude API key for AI processing

## CloudFormation Outputs

The stack exports the following values for use by other stacks:

| Output Name | Description | Export Name |
|------------|-------------|-------------|
| VpcId | VPC ID | OverlayVpcId |
| AuroraClusterEndpoint | Aurora writer endpoint | OverlayAuroraClusterEndpoint |
| AuroraClusterReadEndpoint | Aurora reader endpoint | OverlayAuroraClusterReadEndpoint |
| AuroraSecretArn | Database credentials ARN | OverlayAuroraSecretArn |
| LLMConfigTableName | LLM config table name | OverlayLLMConfigTable |
| ClaudeApiKeySecretArn | Claude API key ARN | OverlayClaudeApiKeySecretArn |
| DocumentBucketName | S3 bucket name | OverlayDocumentBucket |
| DocumentTableName | Document table name | OverlayDocumentTable |

## Resource Count

- **VPC Resources**: 28 (VPC, subnets, route tables, NAT gateway, etc.)
- **Aurora Resources**: 8 (cluster, instances, subnet group, security group, secrets)
- **DynamoDB Tables**: 2 (with 3 GSIs total)
- **S3 Buckets**: 1
- **Secrets**: 2
- **IAM Roles**: 2 (for log retention and VPC custom resources)

**Total**: ~45 AWS resources

## Estimated Monthly Cost

Based on minimal usage:

- **VPC**: ~$32/month (NAT Gateway)
- **Aurora Serverless v2**: ~$43-$172/month (0.5-2 ACU at $0.12/ACU-hour)
- **DynamoDB**: Pay-per-request (minimal cost for testing)
- **S3**: ~$0.023/GB/month + requests
- **Secrets Manager**: $0.40/secret/month = $0.80/month
- **Data Transfer**: Variable

**Estimated Total**: $75-$205/month (depending on usage)

## Next Steps

1. **Deploy the Storage Stack**:
   ```bash
   cdk deploy OverlayStorageStack
   ```

2. **Update Claude API Key**:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id overlay/claude/production/api-key \
     --secret-string '{"apiKey":"your-actual-api-key"}'
   ```

3. **Initialize Aurora Database**:
   - Connect to Aurora cluster using credentials from Secrets Manager
   - Run database migration scripts to create schema

4. **Phase 2 - Application Stack**:
   - Lambda functions for document processing
   - API Gateway for REST endpoints
   - Cognito for user authentication
   - Step Functions for workflows
   - EventBridge for event routing

## Security Considerations

✅ **Implemented**:
- All data encrypted at rest
- VPC isolation for database
- Security groups restricting access
- No public access to S3 or database
- Secrets managed via AWS Secrets Manager
- Deletion protection on Aurora
- Point-in-time recovery on DynamoDB
- Backup retention for Aurora

⚠️ **To Implement**:
- WAF for API Gateway
- CloudTrail for audit logging
- GuardDuty for threat detection
- Config rules for compliance
- KMS customer-managed keys
- VPC Flow Logs
- Secret rotation policies

## Stack Dependencies

```
OverlayStorageStack (Phase 1)
    ↓
OverlayPlatformStack (Phase 2 - In Progress)
    ↓
Additional stacks as needed
```

## Cleanup

To remove all resources (⚠️ **Danger**: This will delete data):

```bash
# Remove deletion protection first
cdk deploy OverlayStorageStack --context deletionProtection=false

# Then destroy
cdk destroy OverlayStorageStack
```

Note: S3 buckets, DynamoDB tables, and Aurora snapshots will be retained due to RETAIN policies.

---

**Status**: ✅ Ready for deployment
**Date**: 2026-01-19
**Region**: eu-west-1
**Account**: 975050116849
