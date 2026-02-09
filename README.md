# Overlay Platform

An AI-powered document review system built with AWS CDK and TypeScript.

## Overview

Overlay Platform is a cloud-native document management and review system that leverages AWS services to provide secure, scalable document processing with AI-powered analysis capabilities.

## Architecture

The platform is built using:
- **AWS CDK** for infrastructure as code
- **S3** for document storage with versioning
- **DynamoDB** for document metadata and status tracking
- **Lambda** for serverless compute
- **Region**: eu-west-1 (Ireland)

## Project Structure

```
overlay-platform/
├── bin/                          # CDK app entry point
├── lib/                          # CDK stack definitions
├── lambda/
│   ├── functions/               # Lambda function implementations
│   └── layers/                  # Lambda layers for shared code
│       └── common/              # Common dependencies layer
├── src/
│   └── types/                   # TypeScript type definitions
├── test/                        # Unit and integration tests
└── cdk.json                     # CDK configuration
```

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Lambda layer dependencies:
```bash
cd lambda/layers/common/nodejs
npm install
cd ../../../..
```

3. Configure AWS credentials:
```bash
aws configure
```

4. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your AWS account details
```

## Deployment

1. Bootstrap CDK (first time only):
```bash
cdk bootstrap aws://ACCOUNT-ID/eu-west-1
```

2. Build the project:
```bash
npm run build
```

3. Review changes:
```bash
cdk diff
```

4. Deploy the stack:
```bash
cdk deploy
```

## Useful Commands

* `npm run build`   - Compile TypeScript to JavaScript
* `npm run watch`   - Watch for changes and compile
* `npm run test`    - Run Jest unit tests
* `cdk deploy`      - Deploy stack to AWS
* `cdk diff`        - Compare deployed stack with current state
* `cdk synth`       - Synthesize CloudFormation template
* `cdk destroy`     - Remove all resources from AWS

## Resources Created

The stack creates the following AWS resources:
- S3 bucket for document storage with encryption and versioning
- DynamoDB table for document metadata with GSI for status queries
- Lambda layer for common dependencies
- IAM roles and policies for secure access

## Development

To add new Lambda functions:
1. Create function code in `lambda/functions/`
2. Add function definition to the CDK stack in `lib/`
3. Grant necessary permissions (S3, DynamoDB, etc.)

## License

Proprietary
# Trigger redeploy
