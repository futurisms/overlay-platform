#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib/core';
import { StorageStack } from '../lib/storage-stack';
import { AuthStack } from '../lib/auth-stack';
import { ComputeStack } from '../lib/compute-stack';
import { OrchestrationStack } from '../lib/orchestration-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'eu-west-1',
};

const environmentName = 'production';

// ============================================================================
// PHASE 1: STORAGE STACK
// ============================================================================
// VPC, Aurora PostgreSQL, DynamoDB, S3, Secrets Manager
const storageStack = new StorageStack(app, 'OverlayStorageStack', {
  env,
  environmentName,
  description: 'Overlay Platform - Storage infrastructure (VPC, Aurora, DynamoDB, S3)',
  tags: {
    Project: 'Overlay',
    Environment: environmentName,
    Stack: 'Storage',
  },
});

// ============================================================================
// PHASE 2: AUTH STACK
// ============================================================================
// Cognito User Pool, User Groups, Lambda Triggers
const authStack = new AuthStack(app, 'OverlayAuthStack', {
  env,
  environmentName,
  description: 'Overlay Platform - Authentication infrastructure (Cognito)',
  tags: {
    Project: 'Overlay',
    Environment: environmentName,
    Stack: 'Auth',
  },
});

// ============================================================================
// PHASE 3: COMPUTE STACK
// ============================================================================
// Lambda Functions (AI Agents + API), API Gateway, IAM Permissions
const computeStack = new ComputeStack(app, 'OverlayComputeStack', {
  env,
  environmentName,
  vpc: storageStack.vpc,
  auroraCluster: storageStack.auroraCluster,
  auroraSecret: storageStack.auroraCluster.secret!,
  documentBucket: storageStack.documentBucket,
  documentTable: storageStack.documentTable,
  llmConfigTable: storageStack.llmConfigTable,
  claudeApiKeySecret: storageStack.claudeApiKeySecret,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  description: 'Overlay Platform - Compute infrastructure (Lambda, API Gateway)',
  tags: {
    Project: 'Overlay',
    Environment: environmentName,
    Stack: 'Compute',
  },
});
computeStack.addDependency(storageStack);
computeStack.addDependency(authStack);

// ============================================================================
// PHASE 4: ORCHESTRATION STACK
// ============================================================================
// Step Functions, EventBridge, SQS Queues
const orchestrationStack = new OrchestrationStack(app, 'OverlayOrchestrationStack', {
  env,
  environmentName,
  documentBucket: storageStack.documentBucket,
  structureValidatorFunction: computeStack.structureValidatorFunction,
  contentAnalyzerFunction: computeStack.contentAnalyzerFunction,
  grammarCheckerFunction: computeStack.grammarCheckerFunction,
  orchestratorFunction: computeStack.orchestratorFunction,
  clarificationFunction: computeStack.clarificationFunction,
  scoringFunction: computeStack.scoringFunction,
  analysisFailureHandler: computeStack.analysisFailureHandler,
  description: 'Overlay Platform - Orchestration infrastructure (Step Functions, EventBridge)',
  tags: {
    Project: 'Overlay',
    Environment: environmentName,
    Stack: 'Orchestration',
  },
});
orchestrationStack.addDependency(computeStack);
