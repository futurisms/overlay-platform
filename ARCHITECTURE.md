# Overlay Platform - Architecture Overview

## System Architecture

The Overlay Platform is an AI-powered document review system built on AWS infrastructure using a serverless architecture pattern.

## Core Components

### 1. Infrastructure (AWS CDK)

The infrastructure is defined as code using AWS CDK with TypeScript:

- **Region**: eu-west-1 (Ireland)
- **Stack**: OverlayPlatformStack
- **Deployment**: Single account, single region deployment

### 2. Storage Layer

#### S3 Document Bucket
- **Purpose**: Store uploaded documents with versioning
- **Features**:
  - Server-side encryption (AES256)
  - Public access blocked
  - Versioning enabled
  - Lifecycle policy: Delete old versions after 90 days
  - Retention policy: RETAIN on stack deletion

#### DynamoDB Document Table
- **Purpose**: Store document metadata and status
- **Schema**:
  - Partition Key: `documentId` (String)
  - Sort Key: `timestamp` (Number)
- **Indexes**:
  - StatusIndex (GSI): Query documents by status and timestamp
- **Features**:
  - Pay-per-request billing
  - Point-in-time recovery enabled
  - Retention policy: RETAIN on stack deletion

### 3. Compute Layer

#### Lambda Functions
- **Runtime**: Node.js 20.x
- **Location**: `lambda/functions/`
- **Shared Dependencies**: Common layer with AWS SDK v3

#### Lambda Layer
- **Name**: CommonLayer
- **Contents**: Shared dependencies for all Lambda functions
  - @aws-sdk/client-s3
  - @aws-sdk/client-dynamodb
  - @aws-sdk/lib-dynamodb

### 4. Type Definitions

Located in `src/types/index.ts`:

- **Document**: Core document interface
- **DocumentStatus**: Enum for document states (UPLOADED, PROCESSING, REVIEWED, APPROVED, REJECTED, ERROR)
- **DocumentMetadata**: Additional document information
- **ReviewResult**: Results from document review process
- **AIAnalysisResult**: AI-powered analysis outcomes

## Data Flow

1. **Document Upload**
   - User uploads document to S3 bucket
   - S3 event triggers Lambda function
   - Lambda creates metadata entry in DynamoDB

2. **Document Processing**
   - Processing Lambda retrieves document from S3
   - AI analysis performed
   - Status updated in DynamoDB via StatusIndex

3. **Document Review**
   - Review results stored in DynamoDB
   - Document status updated (REVIEWED/APPROVED/REJECTED)
   - Notifications sent if configured

## Security

- All S3 buckets have public access blocked
- Server-side encryption enabled on all storage
- IAM roles follow principle of least privilege
- All resources deployed in private subnets (when applicable)

## Scalability

- Serverless architecture scales automatically
- DynamoDB pay-per-request mode adapts to load
- S3 provides unlimited storage capacity
- Lambda functions scale horizontally

## Monitoring and Observability

(To be implemented)
- CloudWatch Logs for Lambda functions
- CloudWatch Metrics for system health
- X-Ray for distributed tracing
- CloudWatch Alarms for critical events

## Future Enhancements

- API Gateway for REST API endpoints
- Cognito for user authentication
- Step Functions for complex workflows
- EventBridge for event-driven architecture
- CloudFront for content delivery
- SQS for asynchronous processing queues
- SNS for notifications
