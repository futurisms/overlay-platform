import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface ComputeStackProps extends cdk.StackProps {
  readonly environmentName?: string;
  readonly vpc: ec2.IVpc;
  readonly auroraCluster: rds.IDatabaseCluster;
  readonly auroraSecret: secretsmanager.ISecret;
  readonly documentBucket: s3.IBucket;
  readonly documentTable: dynamodb.ITable;
  readonly llmConfigTable: dynamodb.ITable;
  readonly claudeApiKeySecret: secretsmanager.ISecret;
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
}

export class ComputeStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly structureValidatorFunction: lambda.Function;
  public readonly contentAnalyzerFunction: lambda.Function;
  public readonly grammarCheckerFunction: lambda.Function;
  public readonly orchestratorFunction: lambda.Function;
  public readonly clarificationFunction: lambda.Function;
  public readonly scoringFunction: lambda.Function;
  public readonly analysisFailureHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const environmentName = props.environmentName || 'production';

    // Security Group for Lambda functions
    const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Lambda functions with VPC access',
      allowAllOutbound: true,
    });

    // Common Lambda environment variables
    const commonEnvironment = {
      AURORA_SECRET_ARN: props.auroraSecret.secretArn,
      AURORA_ENDPOINT: props.auroraCluster.clusterEndpoint.hostname,
      DOCUMENT_BUCKET: props.documentBucket.bucketName,
      DOCUMENT_TABLE: props.documentTable.tableName,
      LLM_CONFIG_TABLE: props.llmConfigTable.tableName,
      CLAUDE_API_KEY_SECRET: props.claudeApiKeySecret.secretArn,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      ENVIRONMENT: environmentName,
    };

    // Common Lambda layer for shared code
    console.log('Creating Lambda layer for shared code...');
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      layerVersionName: 'overlay-common-layer',
      code: lambda.Code.fromAsset('lambda/layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Common utilities, database clients, and LLM abstraction layer',
    });

    // ==========================================================================
    // AI AGENT LAMBDA FUNCTIONS
    // ==========================================================================

    console.log('Creating AI agent Lambda functions...');

    // 1. Structure Validator (Bedrock Haiku - fast validation)
    this.structureValidatorFunction = new lambda.Function(this, 'StructureValidatorFunction', {
      functionName: 'overlay-structure-validator',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/structure-validator'),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0', // Bedrock Haiku
      },
      description: 'Validates document structure and format using Bedrock Haiku',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // 2. Content Analyzer (Claude Sonnet - detailed analysis)
    this.contentAnalyzerFunction = new lambda.Function(this, 'ContentAnalyzerFunction', {
      functionName: 'overlay-content-analyzer',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/content-analyzer'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        MODEL_ID: 'claude-sonnet-4-5-20250929', // Claude API
      },
      description: 'Analyzes document content against evaluation criteria using Claude Sonnet',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // 3. Grammar Checker (Bedrock Haiku - fast grammar check)
    this.grammarCheckerFunction = new lambda.Function(this, 'GrammarCheckerFunction', {
      functionName: 'overlay-grammar-checker',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/grammar-checker'),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0', // Bedrock Haiku
      },
      description: 'Checks document grammar and writing quality using Bedrock Haiku',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // 4. Orchestrator (Claude Sonnet - workflow coordination)
    this.orchestratorFunction = new lambda.Function(this, 'OrchestratorFunction', {
      functionName: 'overlay-orchestrator',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/orchestrator'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        MODEL_ID: 'claude-sonnet-4-5-20250929', // Claude API
      },
      description: 'Orchestrates the 6-agent AI workflow using Claude Sonnet',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // 5. Clarification (Claude Sonnet - intelligent Q&A)
    this.clarificationFunction = new lambda.Function(this, 'ClarificationFunction', {
      functionName: 'overlay-clarification',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/clarification'),
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        MODEL_ID: 'claude-sonnet-4-5-20250929', // Claude API
      },
      description: 'Handles clarification questions during document review using Claude Sonnet',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // 6. Scoring (Claude Sonnet - final scoring)
    this.scoringFunction = new lambda.Function(this, 'ScoringFunction', {
      functionName: 'overlay-scoring',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/scoring'),
      timeout: cdk.Duration.minutes(3),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        MODEL_ID: 'claude-sonnet-4-5-20250929', // Claude API
      },
      description: 'Calculates final scores and generates feedback using Claude Sonnet',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // 7. Analysis Failure Handler (Database update on workflow failure)
    this.analysisFailureHandler = new lambda.Function(this, 'AnalysisFailureHandler', {
      functionName: 'overlay-analysis-failure-handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/analysis-failure-handler'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      environment: {
        ...commonEnvironment,
      },
      description: 'Updates submission status when Step Functions execution fails',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant database secret access to failure handler (network access already allowed via VPC)
    props.auroraSecret.grantRead(this.analysisFailureHandler);

    // ==========================================================================
    // API LAMBDA FUNCTIONS
    // ==========================================================================

    console.log('Creating API Lambda functions...');

    // Auth Handler
    const authHandler = new lambda.Function(this, 'AuthHandler', {
      functionName: 'overlay-api-auth',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/auth'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      layers: [commonLayer],
      environment: {
        USER_POOL_ID: props.userPool.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
        ...commonEnvironment,
      },
      description: 'Handles authentication endpoints (login, register, refresh)',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Overlays Handler
    const overlaysHandler = new lambda.Function(this, 'OverlaysHandler', {
      functionName: 'overlay-api-overlays',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/overlays'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: commonEnvironment,
      description: 'Handles overlay CRUD operations',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Sessions Handler
    const sessionsHandler = new lambda.Function(this, 'SessionsHandler', {
      functionName: 'overlay-api-sessions',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/sessions'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: commonEnvironment,
      description: 'Handles document review session management',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Import State Machine ARN from Orchestration Stack
    const stateMachineArn = cdk.Fn.importValue('OverlayStateMachineArn');

    // Submissions Handler
    const submissionsHandler = new lambda.Function(this, 'SubmissionsHandler', {
      functionName: 'overlay-api-submissions',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/submissions'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        WORKFLOW_STATE_MACHINE_ARN: stateMachineArn,
      },
      description: 'Handles document submission uploads and processing',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Query Results Handler
    const queryResultsHandler = new lambda.Function(this, 'QueryResultsHandler', {
      functionName: 'overlay-query-results',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/query-results'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        AURORA_SECRET_ARN: props.auroraSecret.secretArn,
      },
      description: 'Queries Aurora database for document processing results',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Notes Handler
    const notesHandler = new lambda.Function(this, 'NotesHandler', {
      functionName: 'overlay-api-notes',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/notes'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: commonEnvironment,
      description: 'Handles user notes CRUD operations',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Invitations Handler
    const invitationsHandler = new lambda.Function(this, 'InvitationsHandler', {
      functionName: 'overlay-api-invitations',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/invitations'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: {
        ...commonEnvironment,
        FRONTEND_URL: 'https://overlay.futurisms.ai',
        USER_POOL_ID: props.userPool.userPoolId,
      },
      description: 'Handles analyst invitation system',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    const usersHandler = new lambda.Function(this, 'UsersHandler', {
      functionName: 'overlay-api-users',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/users'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: commonEnvironment,
      description: 'Handles user information endpoints',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Admin Handler (admin-only monitoring and analytics)
    const adminHandler = new lambda.Function(this, 'AdminHandler', {
      functionName: 'overlay-api-admin',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/api/admin'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: commonEnvironment,
      description: 'Admin-only endpoints for monitoring all submissions and costs',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Annotate Document Handler (AI-powered document annotation)
    const annotateDocumentHandler = new lambda.Function(this, 'AnnotateDocumentHandler', {
      functionName: 'overlay-api-annotate-document',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/annotate-document'),
      timeout: cdk.Duration.minutes(5), // 5 minutes for Claude API call
      memorySize: 1024, // More memory for text processing
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      layers: [commonLayer],
      environment: commonEnvironment,
      description: 'Generates AI-powered annotated documents with recommendations',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // ==========================================================================
    // IAM PERMISSIONS
    // ==========================================================================

    console.log('Configuring IAM permissions...');

    const allLambdas = [
      this.structureValidatorFunction,
      this.contentAnalyzerFunction,
      this.grammarCheckerFunction,
      this.orchestratorFunction,
      this.clarificationFunction,
      this.scoringFunction,
      authHandler,
      overlaysHandler,
      sessionsHandler,
      submissionsHandler,
      queryResultsHandler,
      notesHandler,
      invitationsHandler,
      usersHandler,
      adminHandler,
      annotateDocumentHandler,
    ];

    // Grant all Lambdas access to secrets
    allLambdas.forEach(fn => {
      props.auroraSecret.grantRead(fn);
      props.claudeApiKeySecret.grantRead(fn);
    });

    // Grant DynamoDB access
    allLambdas.forEach(fn => {
      props.documentTable.grantReadWriteData(fn);
      props.llmConfigTable.grantReadData(fn);
    });

    // Grant S3 access
    allLambdas.forEach(fn => {
      props.documentBucket.grantReadWrite(fn);
    });

    // Grant submissions handler permission to start Step Functions executions
    submissionsHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [stateMachineArn],
    }));

    // Grant annotate-document handler permission to invoke itself (for async background processing)
    annotateDocumentHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:overlay-api-annotate-document`],
    }));

    // Grant Bedrock access to AI functions
    const bedrockPolicy = new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
    });

    [
      this.structureValidatorFunction,
      this.contentAnalyzerFunction,
      this.grammarCheckerFunction,
      this.orchestratorFunction,
      this.clarificationFunction,
      this.scoringFunction,
    ].forEach(fn => fn.addToRolePolicy(bedrockPolicy));

    // Grant Cognito access to auth handler
    authHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminUpdateUserAttributes',
      ],
      resources: [props.userPool.userPoolArn],
    }));

    // Grant Cognito access to invitations handler (for analyst signup)
    invitationsHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminGetUser',        // For looking up existing users on signup retry
        'cognito-idp:AdminDeleteUser',      // For rollback when database operations fail
      ],
      resources: [props.userPool.userPoolArn],
    }));

    // ==========================================================================
    // API GATEWAY
    // ==========================================================================

    console.log('Creating API Gateway REST API...');

    // Lambda Authorizer for JWT validation
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'overlay-cognito-authorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // REST API
    this.api = new apigateway.RestApi(this, 'OverlayApi', {
      restApiName: 'overlay-platform-api',
      description: 'Overlay Platform REST API',
      deployOptions: {
        stageName: environmentName,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [
          'https://overlay.futurisms.ai', // Production custom domain
          'https://overlay-platform.vercel.app', // Vercel production
          'https://overlay-platform-git-master-satnams-projects-7193fd93.vercel.app', // Vercel git branch
          'http://localhost:3000', // Local development
          'http://localhost:3002', // Local development (alternate port)
        ],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-Target', // Required for Cognito auth endpoint
        ],
        maxAge: cdk.Duration.hours(1),
      },
      cloudWatchRole: true,
    });

    // API Resources and Methods
    const authResource = this.api.root.addResource('auth');
    authResource.addMethod('POST', new apigateway.LambdaIntegration(authHandler), {
      authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
    });

    const overlaysResource = this.api.root.addResource('overlays');
    overlaysResource.addMethod('GET', new apigateway.LambdaIntegration(overlaysHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    overlaysResource.addMethod('POST', new apigateway.LambdaIntegration(overlaysHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const overlayIdResource = overlaysResource.addResource('{overlayId}');
    overlayIdResource.addMethod('GET', new apigateway.LambdaIntegration(overlaysHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    overlayIdResource.addMethod('PUT', new apigateway.LambdaIntegration(overlaysHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    overlayIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(overlaysHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const sessionsResource = this.api.root.addResource('sessions');
    sessionsResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    sessionsResource.addMethod('POST', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /sessions/available
    const sessionsAvailableResource = sessionsResource.addResource('available');
    sessionsAvailableResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const sessionIdResource = sessionsResource.addResource('{sessionId}');
    sessionIdResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    sessionIdResource.addMethod('PUT', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    sessionIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /sessions/{sessionId}/submissions
    const sessionSubmissionsResource = sessionIdResource.addResource('submissions');
    sessionSubmissionsResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /sessions/{sessionId}/report
    const sessionReportResource = sessionIdResource.addResource('report');
    sessionReportResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /sessions/{sessionId}/export
    const sessionExportResource = sessionIdResource.addResource('export');
    sessionExportResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /sessions/{sessionId}/participants/{userId}
    const sessionParticipantsResource = sessionIdResource.addResource('participants');
    const participantUserIdResource = sessionParticipantsResource.addResource('{userId}');
    participantUserIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const submissionsResource = this.api.root.addResource('submissions');
    submissionsResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    submissionsResource.addMethod('POST', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const submissionIdResource = submissionsResource.addResource('{submissionId}');
    submissionIdResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    submissionIdResource.addMethod('PUT', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    submissionIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /submissions/{submissionId}/content
    const submissionContentResource = submissionIdResource.addResource('content');
    submissionContentResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /submissions/{submissionId}/answers
    const submissionAnswersResource = submissionIdResource.addResource('answers');
    submissionAnswersResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    submissionAnswersResource.addMethod('POST', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /submissions/{submissionId}/feedback
    const submissionFeedbackResource = submissionIdResource.addResource('feedback');
    submissionFeedbackResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /submissions/{submissionId}/download
    const submissionDownloadResource = submissionIdResource.addResource('download');
    submissionDownloadResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /submissions/{submissionId}/analysis
    const submissionAnalysisResource = submissionIdResource.addResource('analysis');
    submissionAnalysisResource.addMethod('GET', new apigateway.LambdaIntegration(submissionsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /submissions/{submissionId}/annotate
    const submissionAnnotateResource = submissionIdResource.addResource('annotate');
    submissionAnnotateResource.addMethod('GET', new apigateway.LambdaIntegration(annotateDocumentHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const notesResource = this.api.root.addResource('notes');
    notesResource.addMethod('GET', new apigateway.LambdaIntegration(notesHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    notesResource.addMethod('POST', new apigateway.LambdaIntegration(notesHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const noteIdResource = notesResource.addResource('{noteId}');
    noteIdResource.addMethod('GET', new apigateway.LambdaIntegration(notesHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    noteIdResource.addMethod('PUT', new apigateway.LambdaIntegration(notesHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    noteIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(notesHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ==========================================================================
    // INVITATIONS ROUTES
    // ==========================================================================

    // /sessions/{sessionId}/invitations (create invitation - admin only)
    const sessionInvitationsResource = sessionIdResource.addResource('invitations');
    sessionInvitationsResource.addMethod('POST', new apigateway.LambdaIntegration(invitationsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /invitations (public routes for signup flow)
    const invitationsResource = this.api.root.addResource('invitations');

    // /invitations/{token} (get invitation details - public)
    const invitationTokenResource = invitationsResource.addResource('{token}');
    invitationTokenResource.addMethod('GET', new apigateway.LambdaIntegration(invitationsHandler), {
      authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
    });

    // /invitations/{token}/accept (accept invitation - public)
    const acceptInvitationResource = invitationTokenResource.addResource('accept');
    acceptInvitationResource.addMethod('POST', new apigateway.LambdaIntegration(invitationsHandler), {
      authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
    });

    // /users (user management routes)
    const usersResource = this.api.root.addResource('users');

    // /users/me (get current user info - authenticated)
    const usersMeResource = usersResource.addResource('me');
    usersMeResource.addMethod('GET', new apigateway.LambdaIntegration(usersHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ==========================================================================
    // ADMIN ROUTES (admin-only monitoring and analytics)
    // ==========================================================================

    const adminResource = this.api.root.addResource('admin');

    // /admin/submissions (get all submissions with costs - admin only)
    const adminSubmissionsResource = adminResource.addResource('submissions');
    adminSubmissionsResource.addMethod('GET', new apigateway.LambdaIntegration(adminHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/analytics (get dashboard analytics - admin only)
    const adminAnalyticsResource = adminResource.addResource('analytics');
    adminAnalyticsResource.addMethod('GET', new apigateway.LambdaIntegration(adminHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'OverlayApiEndpoint',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway REST API ID',
      exportName: 'OverlayApiId',
    });

    // Tags
    cdk.Tags.of(this).add('Environment', environmentName);
    cdk.Tags.of(this).add('Project', 'Overlay');
    cdk.Tags.of(this).add('Stack', 'Compute');
  }
}
