---
name: aws-fullstack-deployment
description: Proven patterns for deploying serverless full-stack applications on AWS using CDK, Lambda, API Gateway, RDS Aurora, and Cognito. Use when deploying new Lambda functions, creating CDK stacks, setting up API routes, configuring databases, managing VPC networking, or handling environment variables. Covers Lambda layers, permission policies, CloudWatch logging, deployment verification, and rollback procedures. Essential for AWS serverless deployments.
---

# AWS Full-Stack Deployment

Proven patterns from real serverless applications deployed on AWS.

## Stack Architecture Overview

Typical full-stack serverless application consists of:
- **Storage Stack**: VPC, RDS Aurora, S3, DynamoDB, Secrets Manager
- **Auth Stack**: Cognito User Pool, User Groups
- **Compute Stack**: Lambda functions, Lambda Layers, API handlers
- **Orchestration Stack**: API Gateway, Step Functions, SQS, EventBridge

## Core Principles

### 1. Stack Separation
**Separate stacks by lifecycle and dependency:**
- Storage resources change rarely → OverlayStorageStack
- Auth resources independent → OverlayAuthStack
- Compute resources change frequently → OverlayComputeStack
- Orchestration ties everything together → OverlayOrchestrationStack

**Benefits:**
- Deploy compute without touching database
- Avoid unnecessary resource updates
- Faster deployments
- Clear dependencies

### 2. Environment Variables Pattern
**Pass configuration, never hardcode:**
```typescript
environment: {
  DB_HOST: props.dbEndpoint,
  DB_PORT: '5432',
  DB_NAME: 'overlay_production',
  DB_USER: props.dbUser,
  DB_PASSWORD: props.dbPassword,
  FRONTEND_URL: 'http://localhost:3000',
  NODE_ENV: 'production'
}
```

**Never:**
- Hardcode connection strings
- Commit secrets to code
- Use different patterns across Lambdas

### 3. Lambda Layer for Shared Code
**Common utilities in layer, not duplicated:**
- Database utilities
- Permission helpers
- API client wrappers
- Constants and types

**Layer structure:**
```
lambda/layers/common/
└── nodejs/
    ├── db-utils.js
    ├── permissions.js
    ├── api-response.js
    └── package.json (if npm packages needed)
```

**Benefits:**
- Update once, affects all functions
- Smaller individual function packages
- Consistent utilities across Lambdas

## Lambda Function Patterns

### Standard Function Structure
```typescript
const myFunction = new lambda.Function(this, 'MyFunctionName', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/functions/my-function'),
  layers: [commonLayer], // ALWAYS include common layer
  environment: {
    // Pass ALL config via environment
    DB_HOST: props.dbEndpoint,
    // ... other vars
  },
  timeout: Duration.seconds(30), // Default 3s often too short
  memorySize: 256, // Default 128MB often too small
  vpc: props.vpc, // For RDS access
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
  }
});
```

### Function Sizing Guidelines
**Memory/Timeout by function type:**

**API Handlers:**
- Memory: 256-512 MB
- Timeout: 30 seconds
- Why: Quick response, limited processing

**AI/ML Processing:**
- Memory: 1024-3072 MB
- Timeout: 300 seconds (5 min)
- Why: Claude API calls can be slow

**Data Processing:**
- Memory: 512-1024 MB
- Timeout: 60-180 seconds
- Why: Database queries, transformations

**Scheduled Jobs:**
- Memory: 512-1024 MB
- Timeout: 300-900 seconds
- Why: Batch operations

### VPC Configuration for RDS Access
**All functions accessing RDS must be in VPC:**
```typescript
vpc: props.vpc,
vpcSubnets: {
  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
},
securityGroups: [props.lambdaSecurityGroup]
```

**Common mistake:** Forgetting VPC → function cannot reach RDS

## API Gateway Patterns

### REST API Structure
```typescript
const api = new apigateway.RestApi(this, 'OverlayApi', {
  restApiName: 'Overlay Platform API',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token'
    ]
  }
});
```

### Route Structure Convention
```
/overlays                    → GET (list), POST (create)
/overlays/{id}               → GET (read), PUT (update), DELETE
/sessions                    → GET (list), POST (create)
/sessions/{id}               → GET (read), PUT (update), DELETE
/sessions/{id}/invitations   → POST (create invitation)
/submissions                 → GET (list), POST (create)
/submissions/{id}            → GET (read), DELETE
```

**Pattern:** Resource-based URLs, standard HTTP methods

### Lambda Integration
```typescript
const resource = api.root.addResource('overlays');

// GET /overlays
resource.addMethod('GET', new apigateway.LambdaIntegration(overlaysHandler));

// POST /overlays
resource.addMethod('POST', new apigateway.LambdaIntegration(overlaysHandler));

// /overlays/{id}
const singleResource = resource.addResource('{id}');
singleResource.addMethod('GET', new apigateway.LambdaIntegration(overlaysHandler));
singleResource.addMethod('PUT', new apigateway.LambdaIntegration(overlaysHandler));
singleResource.addMethod('DELETE', new apigateway.LambdaIntegration(overlaysHandler));
```

**Common pattern:** One handler for all methods on a resource, route by `event.httpMethod`

### Authorizer Configuration
```typescript
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
  this,
  'ApiAuthorizer',
  {
    cognitoUserPools: [props.userPool]
  }
);

// Apply to routes
resource.addMethod('POST', integration, {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO
});
```

## Database Connection Patterns

### Connection Pooling (Critical)
**ALWAYS use connection pool in Lambda:**
```javascript
const { Pool } = require('pg');

// Create pool OUTSIDE handler (reused across invocations)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 5, // Limit connections per Lambda
  idleTimeoutMillis: 30000
});

// Inside handler
exports.handler = async (event) => {
  const client = await pool.connect();
  try {
    // Use client
    const result = await client.query('SELECT ...');
    return result.rows;
  } finally {
    client.release(); // ALWAYS release
  }
};
```

**Why:**
- Lambda containers reuse
- Pool persists across invocations
- Avoid connection exhaustion

### RDS Aurora Serverless v2 Configuration
```typescript
const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_16_6
  }),
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 2,
  writer: rds.ClusterInstance.serverlessV2('writer'),
  vpc: vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED
  }
});
```

**Key settings:**
- Min 0.5 ACU (lowest cost when idle)
- Max 2 ACU (sufficient for most apps)
- Private isolated subnet (most secure)

## Secrets Management

### Secrets Manager Pattern
```typescript
// In CDK
const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
  secretName: 'overlay/aurora/production/credentials',
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'admin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
    passwordLength: 32
  }
});

// Attach to cluster
cluster.addRotationSingleUser();

// Grant read to Lambda
dbSecret.grantRead(myFunction);
```

### Reading Secrets in Lambda
```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  const data = await secretsManager
    .getSecretValue({ SecretId: secretName })
    .promise();
  return JSON.parse(data.SecretString);
}

// Cache in Lambda container
let cachedCredentials;
exports.handler = async (event) => {
  if (!cachedCredentials) {
    cachedCredentials = await getSecret(process.env.SECRET_ARN);
  }
  // Use cachedCredentials
};
```

## IAM Permission Patterns

### Principle of Least Privilege
**Grant only required permissions:**

**Database access:**
```typescript
dbSecret.grantRead(lambda);
cluster.connections.allowFrom(lambda, ec2.Port.tcp(5432));
```

**S3 access:**
```typescript
bucket.grantRead(lambda); // Read only
bucket.grantWrite(lambda); // Write only
bucket.grantReadWrite(lambda); // Both
```

**DynamoDB access:**
```typescript
table.grantReadData(lambda);
table.grantWriteData(lambda);
table.grantReadWriteData(lambda);
```

### Custom Policies (When Needed)
```typescript
lambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*']
}));
```

## CloudWatch Logging

### Log Group Configuration
```typescript
const logGroup = new logs.LogGroup(this, 'MyFunctionLogs', {
  logGroupName: `/aws/lambda/${functionName}`,
  retention: logs.RetentionDays.ONE_WEEK, // Adjust as needed
  removalPolicy: RemovalPolicy.DESTROY // For dev, RETAIN for prod
});
```

### Structured Logging Pattern
```javascript
// In Lambda
exports.handler = async (event) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing request',
    requestId: event.requestContext?.requestId,
    path: event.path,
    method: event.httpMethod,
    timestamp: new Date().toISOString()
  }));
  
  try {
    // Process
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Request completed',
      statusCode: 200,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Request failed',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }));
  }
};
```

**Benefits:**
- CloudWatch Insights queries
- Easy filtering
- Structured analysis

## Deployment Process

### Pre-Deployment Checklist
- [ ] Code committed to Git
- [ ] Tests passing
- [ ] Environment variables configured
- [ ] Secrets created in Secrets Manager
- [ ] Database migrations ready (if needed)
- [ ] Backup taken

### Deployment Command
```bash
# Synth first to check for errors
cdk synth

# Deploy specific stack
cdk deploy OverlayComputeStack --require-approval never

# Deploy all stacks
cdk deploy --all --require-approval never

# Deploy with specific profile
cdk deploy --profile production
```

### Post-Deployment Verification
```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name OverlayComputeStack \
  --query 'Stacks[0].StackStatus'

# List Lambda functions
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `overlay`)].FunctionName'

# Check API Gateway
aws apigateway get-rest-apis \
  --query 'items[?name==`Overlay Platform API`].id'

# Test API endpoint
curl -X GET https://api-id.execute-api.region.amazonaws.com/production/overlays
```

### Verification Steps
1. **Lambda functions deployed:**
   - Check AWS Console → Lambda
   - Verify function count matches expected

2. **API Gateway routes:**
   - Check AWS Console → API Gateway
   - Test endpoints with curl/Postman

3. **CloudWatch logs working:**
   - Trigger function (API call or test event)
   - Check logs appear in CloudWatch

4. **Database connectivity:**
   - Invoke function that queries DB
   - Verify no connection errors

5. **Permissions working:**
   - Test protected routes with/without auth
   - Verify 401/403 responses

## Rollback Procedures

### Quick Rollback
```bash
# Rollback to previous stack version
cdk deploy OverlayComputeStack --no-previous-parameters

# Or delete and redeploy from Git tag
git checkout v1.x-previous-version
cdk deploy OverlayComputeStack
```

### Code-Level Rollback
```bash
# Revert to previous Lambda code
git revert <commit-hash>
cdk deploy OverlayComputeStack
```

### Database Rollback
```bash
# Run rollback migration
psql -h <endpoint> -U admin -d overlay_production -f rollback-XXX.sql

# Or restore from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier overlay-cluster \
  --snapshot-identifier overlay-snapshot-20260203
```

## Common Issues & Solutions

### Issue 1: Lambda Timeout
**Symptom:** Functions timing out at 3 seconds

**Solution:** Increase timeout
```typescript
timeout: Duration.seconds(30) // or higher for AI calls
```

### Issue 2: Database Connection Pool Exhausted
**Symptom:** "too many connections" errors

**Solution:** Limit pool size per Lambda
```javascript
const pool = new Pool({
  max: 5, // Not 20+ per Lambda!
  // ...
});
```

### Issue 3: Lambda Cannot Reach RDS
**Symptom:** Connection timeout to database

**Solution:** Ensure VPC configuration
```typescript
vpc: props.vpc,
vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
```

### Issue 4: CORS Errors
**Symptom:** Browser blocks API calls

**Solution:** Configure CORS in API Gateway
```typescript
defaultCorsPreflightOptions: {
  allowOrigins: ['http://localhost:3000'], // Or specific origins
  allowMethods: apigateway.Cors.ALL_METHODS
}
```

### Issue 5: Environment Variables Not Available
**Symptom:** `process.env.DB_HOST` is undefined

**Solution:** Pass in CDK
```typescript
environment: {
  DB_HOST: props.dbEndpoint
}
```

## Best Practices

### 1. Tag Everything
```typescript
Tags.of(this).add('Project', 'OverlayPlatform');
Tags.of(this).add('Environment', 'Production');
Tags.of(this).add('CostCenter', 'Engineering');
```

### 2. Use CDK Constructs
**Don't reinvent wheels:**
- Use `@aws-cdk/aws-lambda-nodejs` for bundling
- Use `@aws-cdk/aws-apigatewayv2` for HTTP APIs
- Use CDK patterns library

### 3. Monitor Costs
**Add cost alerts:**
```typescript
const alarm = new cloudwatch.Alarm(this, 'CostAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Billing',
    metricName: 'EstimatedCharges',
    statistic: 'Maximum',
    period: Duration.hours(6)
  }),
  threshold: 50, // $50
  evaluationPeriods: 1
});
```

### 4. Use CDK Context
```json
// cdk.context.json
{
  "vpc-id": "vpc-xxx",
  "availability-zones": ["us-east-1a", "us-east-1b"],
  "production": {
    "db-instance-count": 2,
    "lambda-memory": 1024
  }
}
```

### 5. Separate Dev/Prod
**Use different stacks or accounts:**
```typescript
const env = process.env.ENV || 'dev';
const stackName = `OverlayComputeStack-${env}`;
```

## Quick Start Template

### Basic Lambda + API Stack
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class MyStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda Layer
    const layer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset('lambda/layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X]
    });

    // Lambda Function
    const handler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api'),
      layers: [layer],
      environment: {
        NODE_ENV: 'production'
      },
      timeout: cdk.Duration.seconds(30)
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'My API'
    });

    const resource = api.root.addResource('items');
    resource.addMethod('GET', new apigateway.LambdaIntegration(handler));
    resource.addMethod('POST', new apigateway.LambdaIntegration(handler));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url
    });
  }
}
```

## Reference Documents

See `references/` folder for:
- CDK patterns and examples
- Lambda optimization guides
- RDS configuration details
- Security best practices

---

**Remember:** These patterns are proven from real production deployments. Follow them to avoid common pitfalls!
