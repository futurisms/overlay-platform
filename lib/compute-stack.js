"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputeStack = void 0;
const cdk = __importStar(require("aws-cdk-lib/core"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ComputeStack extends cdk.Stack {
    api;
    structureValidatorFunction;
    contentAnalyzerFunction;
    grammarCheckerFunction;
    orchestratorFunction;
    clarificationFunction;
    scoringFunction;
    constructor(scope, id, props) {
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
                FRONTEND_URL: 'https://overlay-platform.vercel.app',
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
                'cognito-idp:AdminGetUser', // For looking up existing users on signup retry
                'cognito-idp:AdminDeleteUser', // For rollback when database operations fail
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
                    'http://localhost:3000', // Local development
                    'https://overlay-platform.vercel.app', // Vercel production
                    'https://overlay-platform-git-master-satnams-projects-7193fd93.vercel.app', // Vercel git branch
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
exports.ComputeStack = ComputeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywyREFBNkM7QUFvQjdDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pCLEdBQUcsQ0FBcUI7SUFDeEIsMEJBQTBCLENBQWtCO0lBQzVDLHVCQUF1QixDQUFrQjtJQUN6QyxzQkFBc0IsQ0FBa0I7SUFDeEMsb0JBQW9CLENBQWtCO0lBQ3RDLHFCQUFxQixDQUFrQjtJQUN2QyxlQUFlLENBQWtCO0lBRWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFFOUQsc0NBQXNDO1FBQ3RDLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEUsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHFEQUFxRDtZQUNsRSxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsU0FBUztZQUMvQyxlQUFlLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsUUFBUTtZQUM3RCxlQUFlLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVO1lBQ2hELGNBQWMsRUFBRSxLQUFLLENBQUMsYUFB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QUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN0RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBbnZCRCxvQ0FtdkJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliL2NvcmUnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xyXG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDb21wdXRlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICByZWFkb25seSBlbnZpcm9ubWVudE5hbWU/OiBzdHJpbmc7XHJcbiAgcmVhZG9ubHkgdnBjOiBlYzIuSVZwYztcclxuICByZWFkb25seSBhdXJvcmFDbHVzdGVyOiByZHMuSURhdGFiYXNlQ2x1c3RlcjtcclxuICByZWFkb25seSBhdXJvcmFTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XHJcbiAgcmVhZG9ubHkgZG9jdW1lbnRCdWNrZXQ6IHMzLklCdWNrZXQ7XHJcbiAgcmVhZG9ubHkgZG9jdW1lbnRUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xyXG4gIHJlYWRvbmx5IGxsbUNvbmZpZ1RhYmxlOiBkeW5hbW9kYi5JVGFibGU7XHJcbiAgcmVhZG9ubHkgY2xhdWRlQXBpS2V5U2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0O1xyXG4gIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLklVc2VyUG9vbDtcclxuICByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5JVXNlclBvb2xDbGllbnQ7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBDb21wdXRlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcclxuICBwdWJsaWMgcmVhZG9ubHkgc3RydWN0dXJlVmFsaWRhdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgY29udGVudEFuYWx5emVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgZ3JhbW1hckNoZWNrZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBvcmNoZXN0cmF0b3JGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGFyaWZpY2F0aW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgc2NvcmluZ0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBDb21wdXRlU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgY29uc3QgZW52aXJvbm1lbnROYW1lID0gcHJvcHMuZW52aXJvbm1lbnROYW1lIHx8ICdwcm9kdWN0aW9uJztcclxuXHJcbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xyXG4gICAgY29uc3QgbGFtYmRhU0cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0xhbWJkYVNlY3VyaXR5R3JvdXAnLCB7XHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zIHdpdGggVlBDIGFjY2VzcycsXHJcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb21tb24gTGFtYmRhIGVudmlyb25tZW50IHZhcmlhYmxlc1xyXG4gICAgY29uc3QgY29tbW9uRW52aXJvbm1lbnQgPSB7XHJcbiAgICAgIEFVUk9SQV9TRUNSRVRfQVJOOiBwcm9wcy5hdXJvcmFTZWNyZXQuc2VjcmV0QXJuLFxyXG4gICAgICBBVVJPUkFfRU5EUE9JTlQ6IHByb3BzLmF1cm9yYUNsdXN0ZXIuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lLFxyXG4gICAgICBET0NVTUVOVF9CVUNLRVQ6IHByb3BzLmRvY3VtZW50QnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIERPQ1VNRU5UX1RBQkxFOiBwcm9wcy5kb2N1bWVudFRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgTExNX0NPTkZJR19UQUJMRTogcHJvcHMubGxtQ29uZmlnVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBDTEFVREVfQVBJX0tFWV9TRUNSRVQ6IHByb3BzLmNsYXVkZUFwaUtleVNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgIEFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEOiAnMScsXHJcbiAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudE5hbWUsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIENvbW1vbiBMYW1iZGEgbGF5ZXIgZm9yIHNoYXJlZCBjb2RlXHJcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgTGFtYmRhIGxheWVyIGZvciBzaGFyZWQgY29kZS4uLicpO1xyXG4gICAgY29uc3QgY29tbW9uTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnQ29tbW9uTGF5ZXInLCB7XHJcbiAgICAgIGxheWVyVmVyc2lvbk5hbWU6ICdvdmVybGF5LWNvbW1vbi1sYXllcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2xheWVycy9jb21tb24nKSxcclxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1hdLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiB1dGlsaXRpZXMsIGRhdGFiYXNlIGNsaWVudHMsIGFuZCBMTE0gYWJzdHJhY3Rpb24gbGF5ZXInLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFJIEFHRU5UIExBTUJEQSBGVU5DVElPTlNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIEFJIGFnZW50IExhbWJkYSBmdW5jdGlvbnMuLi4nKTtcclxuXHJcbiAgICAvLyAxLiBTdHJ1Y3R1cmUgVmFsaWRhdG9yIChCZWRyb2NrIEhhaWt1IC0gZmFzdCB2YWxpZGF0aW9uKVxyXG4gICAgdGhpcy5zdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LXN0cnVjdHVyZS12YWxpZGF0b3InLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvc3RydWN0dXJlLXZhbGlkYXRvcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygyKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdhbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MCcsIC8vIEJlZHJvY2sgSGFpa3VcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdWYWxpZGF0ZXMgZG9jdW1lbnQgc3RydWN0dXJlIGFuZCBmb3JtYXQgdXNpbmcgQmVkcm9jayBIYWlrdScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDIuIENvbnRlbnQgQW5hbHl6ZXIgKENsYXVkZSBTb25uZXQgLSBkZXRhaWxlZCBhbmFseXNpcylcclxuICAgIHRoaXMuY29udGVudEFuYWx5emVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDb250ZW50QW5hbHl6ZXJGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1jb250ZW50LWFuYWx5emVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2NvbnRlbnQtYW5hbHl6ZXInKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2NsYXVkZS1zb25uZXQtNC01LTIwMjUwOTI5JywgLy8gQ2xhdWRlIEFQSVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FuYWx5emVzIGRvY3VtZW50IGNvbnRlbnQgYWdhaW5zdCBldmFsdWF0aW9uIGNyaXRlcmlhIHVzaW5nIENsYXVkZSBTb25uZXQnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAzLiBHcmFtbWFyIENoZWNrZXIgKEJlZHJvY2sgSGFpa3UgLSBmYXN0IGdyYW1tYXIgY2hlY2spXHJcbiAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHcmFtbWFyQ2hlY2tlckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWdyYW1tYXItY2hlY2tlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9ncmFtbWFyLWNoZWNrZXInKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMiksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLCAvLyBCZWRyb2NrIEhhaWt1XHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2hlY2tzIGRvY3VtZW50IGdyYW1tYXIgYW5kIHdyaXRpbmcgcXVhbGl0eSB1c2luZyBCZWRyb2NrIEhhaWt1JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNC4gT3JjaGVzdHJhdG9yIChDbGF1ZGUgU29ubmV0IC0gd29ya2Zsb3cgY29vcmRpbmF0aW9uKVxyXG4gICAgdGhpcy5vcmNoZXN0cmF0b3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ09yY2hlc3RyYXRvckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LW9yY2hlc3RyYXRvcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9vcmNoZXN0cmF0b3InKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2NsYXVkZS1zb25uZXQtNC01LTIwMjUwOTI5JywgLy8gQ2xhdWRlIEFQSVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ09yY2hlc3RyYXRlcyB0aGUgNi1hZ2VudCBBSSB3b3JrZmxvdyB1c2luZyBDbGF1ZGUgU29ubmV0JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNS4gQ2xhcmlmaWNhdGlvbiAoQ2xhdWRlIFNvbm5ldCAtIGludGVsbGlnZW50IFEmQSlcclxuICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ2xhcmlmaWNhdGlvbkZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWNsYXJpZmljYXRpb24nLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvY2xhcmlmaWNhdGlvbicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygzKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnY2xhdWRlLXNvbm5ldC00LTUtMjAyNTA5MjknLCAvLyBDbGF1ZGUgQVBJXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyBjbGFyaWZpY2F0aW9uIHF1ZXN0aW9ucyBkdXJpbmcgZG9jdW1lbnQgcmV2aWV3IHVzaW5nIENsYXVkZSBTb25uZXQnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA2LiBTY29yaW5nIChDbGF1ZGUgU29ubmV0IC0gZmluYWwgc2NvcmluZylcclxuICAgIHRoaXMuc2NvcmluZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2NvcmluZ0Z1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LXNjb3JpbmcnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvc2NvcmluZycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygzKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdjbGF1ZGUtc29ubmV0LTQtNS0yMDI1MDkyOScsIC8vIENsYXVkZSBBUElcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDYWxjdWxhdGVzIGZpbmFsIHNjb3JlcyBhbmQgZ2VuZXJhdGVzIGZlZWRiYWNrIHVzaW5nIENsYXVkZSBTb25uZXQnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQVBJIExBTUJEQSBGVU5DVElPTlNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIEFQSSBMYW1iZGEgZnVuY3Rpb25zLi4uJyk7XHJcblxyXG4gICAgLy8gQXV0aCBIYW5kbGVyXHJcbiAgICBjb25zdCBhdXRoSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F1dGhIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1hdXRoJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9hdXRoJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiBwcm9wcy51c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHByb3BzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyBhdXRoZW50aWNhdGlvbiBlbmRwb2ludHMgKGxvZ2luLCByZWdpc3RlciwgcmVmcmVzaCknLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBPdmVybGF5cyBIYW5kbGVyXHJcbiAgICBjb25zdCBvdmVybGF5c0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdPdmVybGF5c0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLW92ZXJsYXlzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9vdmVybGF5cycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyBvdmVybGF5IENSVUQgb3BlcmF0aW9ucycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNlc3Npb25zIEhhbmRsZXJcclxuICAgIGNvbnN0IHNlc3Npb25zSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Nlc3Npb25zSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktc2Vzc2lvbnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL3Nlc3Npb25zJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGRvY3VtZW50IHJldmlldyBzZXNzaW9uIG1hbmFnZW1lbnQnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJbXBvcnQgU3RhdGUgTWFjaGluZSBBUk4gZnJvbSBPcmNoZXN0cmF0aW9uIFN0YWNrXHJcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmVBcm4gPSBjZGsuRm4uaW1wb3J0VmFsdWUoJ092ZXJsYXlTdGF0ZU1hY2hpbmVBcm4nKTtcclxuXHJcbiAgICAvLyBTdWJtaXNzaW9ucyBIYW5kbGVyXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uc0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdWJtaXNzaW9uc0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLXN1Ym1pc3Npb25zJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9zdWJtaXNzaW9ucycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgV09SS0ZMT1dfU1RBVEVfTUFDSElORV9BUk46IHN0YXRlTWFjaGluZUFybixcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGRvY3VtZW50IHN1Ym1pc3Npb24gdXBsb2FkcyBhbmQgcHJvY2Vzc2luZycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFF1ZXJ5IFJlc3VsdHMgSGFuZGxlclxyXG4gICAgY29uc3QgcXVlcnlSZXN1bHRzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1F1ZXJ5UmVzdWx0c0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktcXVlcnktcmVzdWx0cycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9xdWVyeS1yZXN1bHRzJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgQVVST1JBX1NFQ1JFVF9BUk46IHByb3BzLmF1cm9yYVNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUXVlcmllcyBBdXJvcmEgZGF0YWJhc2UgZm9yIGRvY3VtZW50IHByb2Nlc3NpbmcgcmVzdWx0cycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE5vdGVzIEhhbmRsZXJcclxuICAgIGNvbnN0IG5vdGVzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ05vdGVzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktbm90ZXMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL25vdGVzJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIHVzZXIgbm90ZXMgQ1JVRCBvcGVyYXRpb25zJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSW52aXRhdGlvbnMgSGFuZGxlclxyXG4gICAgY29uc3QgaW52aXRhdGlvbnNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSW52aXRhdGlvbnNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1pbnZpdGF0aW9ucycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvaW52aXRhdGlvbnMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBGUk9OVEVORF9VUkw6ICdodHRwczovL292ZXJsYXktcGxhdGZvcm0udmVyY2VsLmFwcCcsXHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiBwcm9wcy51c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgYW5hbHlzdCBpbnZpdGF0aW9uIHN5c3RlbScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VzZXJzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktdXNlcnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL3VzZXJzJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIHVzZXIgaW5mb3JtYXRpb24gZW5kcG9pbnRzJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRtaW4gSGFuZGxlciAoYWRtaW4tb25seSBtb25pdG9yaW5nIGFuZCBhbmFseXRpY3MpXHJcbiAgICBjb25zdCBhZG1pbkhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZG1pbkhhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWFkbWluJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9hZG1pbicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4tb25seSBlbmRwb2ludHMgZm9yIG1vbml0b3JpbmcgYWxsIHN1Ym1pc3Npb25zIGFuZCBjb3N0cycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFubm90YXRlIERvY3VtZW50IEhhbmRsZXIgKEFJLXBvd2VyZWQgZG9jdW1lbnQgYW5ub3RhdGlvbilcclxuICAgIGNvbnN0IGFubm90YXRlRG9jdW1lbnRIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQW5ub3RhdGVEb2N1bWVudEhhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWFubm90YXRlLWRvY3VtZW50JyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2Fubm90YXRlLWRvY3VtZW50JyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyA1IG1pbnV0ZXMgZm9yIENsYXVkZSBBUEkgY2FsbFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LCAvLyBNb3JlIG1lbW9yeSBmb3IgdGV4dCBwcm9jZXNzaW5nXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlcyBBSS1wb3dlcmVkIGFubm90YXRlZCBkb2N1bWVudHMgd2l0aCByZWNvbW1lbmRhdGlvbnMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gSUFNIFBFUk1JU1NJT05TXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDb25maWd1cmluZyBJQU0gcGVybWlzc2lvbnMuLi4nKTtcclxuXHJcbiAgICBjb25zdCBhbGxMYW1iZGFzID0gW1xyXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbixcclxuICAgICAgYXV0aEhhbmRsZXIsXHJcbiAgICAgIG92ZXJsYXlzSGFuZGxlcixcclxuICAgICAgc2Vzc2lvbnNIYW5kbGVyLFxyXG4gICAgICBzdWJtaXNzaW9uc0hhbmRsZXIsXHJcbiAgICAgIHF1ZXJ5UmVzdWx0c0hhbmRsZXIsXHJcbiAgICAgIG5vdGVzSGFuZGxlcixcclxuICAgICAgaW52aXRhdGlvbnNIYW5kbGVyLFxyXG4gICAgICB1c2Vyc0hhbmRsZXIsXHJcbiAgICAgIGFkbWluSGFuZGxlcixcclxuICAgICAgYW5ub3RhdGVEb2N1bWVudEhhbmRsZXIsXHJcbiAgICBdO1xyXG5cclxuICAgIC8vIEdyYW50IGFsbCBMYW1iZGFzIGFjY2VzcyB0byBzZWNyZXRzXHJcbiAgICBhbGxMYW1iZGFzLmZvckVhY2goZm4gPT4ge1xyXG4gICAgICBwcm9wcy5hdXJvcmFTZWNyZXQuZ3JhbnRSZWFkKGZuKTtcclxuICAgICAgcHJvcHMuY2xhdWRlQXBpS2V5U2VjcmV0LmdyYW50UmVhZChmbik7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBEeW5hbW9EQiBhY2Nlc3NcclxuICAgIGFsbExhbWJkYXMuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIHByb3BzLmRvY3VtZW50VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGZuKTtcclxuICAgICAgcHJvcHMubGxtQ29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YShmbik7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBTMyBhY2Nlc3NcclxuICAgIGFsbExhbWJkYXMuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIHByb3BzLmRvY3VtZW50QnVja2V0LmdyYW50UmVhZFdyaXRlKGZuKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IHN1Ym1pc3Npb25zIGhhbmRsZXIgcGVybWlzc2lvbiB0byBzdGFydCBTdGVwIEZ1bmN0aW9ucyBleGVjdXRpb25zXHJcbiAgICBzdWJtaXNzaW9uc0hhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogWydzdGF0ZXM6U3RhcnRFeGVjdXRpb24nXSxcclxuICAgICAgcmVzb3VyY2VzOiBbc3RhdGVNYWNoaW5lQXJuXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBHcmFudCBhbm5vdGF0ZS1kb2N1bWVudCBoYW5kbGVyIHBlcm1pc3Npb24gdG8gaW52b2tlIGl0c2VsZiAoZm9yIGFzeW5jIGJhY2tncm91bmQgcHJvY2Vzc2luZylcclxuICAgIGFubm90YXRlRG9jdW1lbnRIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFsnbGFtYmRhOkludm9rZUZ1bmN0aW9uJ10sXHJcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmxhbWJkYToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZnVuY3Rpb246b3ZlcmxheS1hcGktYW5ub3RhdGUtZG9jdW1lbnRgXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2VzcyB0byBBSSBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGJlZHJvY2tQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXHJcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsLypgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIFtcclxuICAgICAgdGhpcy5zdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbixcclxuICAgICAgdGhpcy5jb250ZW50QW5hbHl6ZXJGdW5jdGlvbixcclxuICAgICAgdGhpcy5ncmFtbWFyQ2hlY2tlckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLm9yY2hlc3RyYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNsYXJpZmljYXRpb25GdW5jdGlvbixcclxuICAgICAgdGhpcy5zY29yaW5nRnVuY3Rpb24sXHJcbiAgICBdLmZvckVhY2goZm4gPT4gZm4uYWRkVG9Sb2xlUG9saWN5KGJlZHJvY2tQb2xpY3kpKTtcclxuXHJcbiAgICAvLyBHcmFudCBDb2duaXRvIGFjY2VzcyB0byBhdXRoIGhhbmRsZXJcclxuICAgIGF1dGhIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5Jbml0aWF0ZUF1dGgnLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNyZWF0ZVVzZXInLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtwcm9wcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gR3JhbnQgQ29nbml0byBhY2Nlc3MgdG8gaW52aXRhdGlvbnMgaGFuZGxlciAoZm9yIGFuYWx5c3Qgc2lnbnVwKVxyXG4gICAgaW52aXRhdGlvbnNIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmQnLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJywgICAgICAgIC8vIEZvciBsb29raW5nIHVwIGV4aXN0aW5nIHVzZXJzIG9uIHNpZ251cCByZXRyeVxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkRlbGV0ZVVzZXInLCAgICAgIC8vIEZvciByb2xsYmFjayB3aGVuIGRhdGFiYXNlIG9wZXJhdGlvbnMgZmFpbFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtwcm9wcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFQSSBHQVRFV0FZXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBBUEkgR2F0ZXdheSBSRVNUIEFQSS4uLicpO1xyXG5cclxuICAgIC8vIExhbWJkYSBBdXRob3JpemVyIGZvciBKV1QgdmFsaWRhdGlvblxyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcclxuICAgICAgY29nbml0b1VzZXJQb29sczogW3Byb3BzLnVzZXJQb29sXSxcclxuICAgICAgYXV0aG9yaXplck5hbWU6ICdvdmVybGF5LWNvZ25pdG8tYXV0aG9yaXplcicsXHJcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUkVTVCBBUElcclxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnT3ZlcmxheUFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdvdmVybGF5LXBsYXRmb3JtLWFwaScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3ZlcmxheSBQbGF0Zm9ybSBSRVNUIEFQSScsXHJcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcclxuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50TmFtZSxcclxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXHJcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB0cmFjaW5nRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbXHJcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwJywgLy8gTG9jYWwgZGV2ZWxvcG1lbnRcclxuICAgICAgICAgICdodHRwczovL292ZXJsYXktcGxhdGZvcm0udmVyY2VsLmFwcCcsIC8vIFZlcmNlbCBwcm9kdWN0aW9uXHJcbiAgICAgICAgICAnaHR0cHM6Ly9vdmVybGF5LXBsYXRmb3JtLWdpdC1tYXN0ZXItc2F0bmFtcy1wcm9qZWN0cy03MTkzZmQ5My52ZXJjZWwuYXBwJywgLy8gVmVyY2VsIGdpdCBicmFuY2hcclxuICAgICAgICBdLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxyXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xyXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXHJcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXHJcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXHJcbiAgICAgICAgICAnWC1BcGktS2V5JyxcclxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXHJcbiAgICAgICAgICAnWC1BbXotVGFyZ2V0JywgLy8gUmVxdWlyZWQgZm9yIENvZ25pdG8gYXV0aCBlbmRwb2ludFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXHJcbiAgICAgIH0sXHJcbiAgICAgIGNsb3VkV2F0Y2hSb2xlOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIFJlc291cmNlcyBhbmQgTWV0aG9kc1xyXG4gICAgY29uc3QgYXV0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYXV0aCcpO1xyXG4gICAgYXV0aFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGF1dGhIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLCAvLyBQdWJsaWMgZW5kcG9pbnRcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG92ZXJsYXlzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdvdmVybGF5cycpO1xyXG4gICAgb3ZlcmxheXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgb3ZlcmxheXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBvdmVybGF5SWRSZXNvdXJjZSA9IG92ZXJsYXlzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tvdmVybGF5SWR9Jyk7XHJcbiAgICBvdmVybGF5SWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgb3ZlcmxheUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG92ZXJsYXlJZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3ZlcmxheXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2Vzc2lvbnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Nlc3Npb25zJyk7XHJcbiAgICBzZXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzZXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zZXNzaW9ucy9hdmFpbGFibGVcclxuICAgIGNvbnN0IHNlc3Npb25zQXZhaWxhYmxlUmVzb3VyY2UgPSBzZXNzaW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCdhdmFpbGFibGUnKTtcclxuICAgIHNlc3Npb25zQXZhaWxhYmxlUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzZXNzaW9uSWRSZXNvdXJjZSA9IHNlc3Npb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tzZXNzaW9uSWR9Jyk7XHJcbiAgICBzZXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc2Vzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHNlc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3Nlc3Npb25zL3tzZXNzaW9uSWR9L3N1Ym1pc3Npb25zXHJcbiAgICBjb25zdCBzZXNzaW9uU3VibWlzc2lvbnNSZXNvdXJjZSA9IHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdzdWJtaXNzaW9ucycpO1xyXG4gICAgc2Vzc2lvblN1Ym1pc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vcmVwb3J0XHJcbiAgICBjb25zdCBzZXNzaW9uUmVwb3J0UmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVwb3J0Jyk7XHJcbiAgICBzZXNzaW9uUmVwb3J0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vZXhwb3J0XHJcbiAgICBjb25zdCBzZXNzaW9uRXhwb3J0UmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZXhwb3J0Jyk7XHJcbiAgICBzZXNzaW9uRXhwb3J0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vcGFydGljaXBhbnRzL3t1c2VySWR9XHJcbiAgICBjb25zdCBzZXNzaW9uUGFydGljaXBhbnRzUmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgncGFydGljaXBhbnRzJyk7XHJcbiAgICBjb25zdCBwYXJ0aWNpcGFudFVzZXJJZFJlc291cmNlID0gc2Vzc2lvblBhcnRpY2lwYW50c1Jlc291cmNlLmFkZFJlc291cmNlKCd7dXNlcklkfScpO1xyXG4gICAgcGFydGljaXBhbnRVc2VySWRSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHN1Ym1pc3Npb25zUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdzdWJtaXNzaW9ucycpO1xyXG4gICAgc3VibWlzc2lvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc3VibWlzc2lvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uSWRSZXNvdXJjZSA9IHN1Ym1pc3Npb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tzdWJtaXNzaW9uSWR9Jyk7XHJcbiAgICBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2NvbnRlbnRcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25Db250ZW50UmVzb3VyY2UgPSBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnY29udGVudCcpO1xyXG4gICAgc3VibWlzc2lvbkNvbnRlbnRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zdWJtaXNzaW9ucy97c3VibWlzc2lvbklkfS9hbnN3ZXJzXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uQW5zd2Vyc1Jlc291cmNlID0gc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2Fuc3dlcnMnKTtcclxuICAgIHN1Ym1pc3Npb25BbnN3ZXJzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHN1Ym1pc3Npb25BbnN3ZXJzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2ZlZWRiYWNrXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uRmVlZGJhY2tSZXNvdXJjZSA9IHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdmZWVkYmFjaycpO1xyXG4gICAgc3VibWlzc2lvbkZlZWRiYWNrUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc3VibWlzc2lvbnMve3N1Ym1pc3Npb25JZH0vZG93bmxvYWRcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25Eb3dubG9hZFJlc291cmNlID0gc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2Rvd25sb2FkJyk7XHJcbiAgICBzdWJtaXNzaW9uRG93bmxvYWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zdWJtaXNzaW9ucy97c3VibWlzc2lvbklkfS9hbmFseXNpc1xyXG4gICAgY29uc3Qgc3VibWlzc2lvbkFuYWx5c2lzUmVzb3VyY2UgPSBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5hbHlzaXMnKTtcclxuICAgIHN1Ym1pc3Npb25BbmFseXNpc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2Fubm90YXRlXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uQW5ub3RhdGVSZXNvdXJjZSA9IHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdhbm5vdGF0ZScpO1xyXG4gICAgc3VibWlzc2lvbkFubm90YXRlUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhbm5vdGF0ZURvY3VtZW50SGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG5vdGVzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdub3RlcycpO1xyXG4gICAgbm90ZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgbm90ZXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBub3RlSWRSZXNvdXJjZSA9IG5vdGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tub3RlSWR9Jyk7XHJcbiAgICBub3RlSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgbm90ZUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG5vdGVJZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obm90ZXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIElOVklUQVRJT05TIFJPVVRFU1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vaW52aXRhdGlvbnMgKGNyZWF0ZSBpbnZpdGF0aW9uIC0gYWRtaW4gb25seSlcclxuICAgIGNvbnN0IHNlc3Npb25JbnZpdGF0aW9uc1Jlc291cmNlID0gc2Vzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2ludml0YXRpb25zJyk7XHJcbiAgICBzZXNzaW9uSW52aXRhdGlvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihpbnZpdGF0aW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvaW52aXRhdGlvbnMgKHB1YmxpYyByb3V0ZXMgZm9yIHNpZ251cCBmbG93KVxyXG4gICAgY29uc3QgaW52aXRhdGlvbnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2ludml0YXRpb25zJyk7XHJcblxyXG4gICAgLy8gL2ludml0YXRpb25zL3t0b2tlbn0gKGdldCBpbnZpdGF0aW9uIGRldGFpbHMgLSBwdWJsaWMpXHJcbiAgICBjb25zdCBpbnZpdGF0aW9uVG9rZW5SZXNvdXJjZSA9IGludml0YXRpb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3t0b2tlbn0nKTtcclxuICAgIGludml0YXRpb25Ub2tlblJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaW52aXRhdGlvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLCAvLyBQdWJsaWMgZW5kcG9pbnRcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9pbnZpdGF0aW9ucy97dG9rZW59L2FjY2VwdCAoYWNjZXB0IGludml0YXRpb24gLSBwdWJsaWMpXHJcbiAgICBjb25zdCBhY2NlcHRJbnZpdGF0aW9uUmVzb3VyY2UgPSBpbnZpdGF0aW9uVG9rZW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnYWNjZXB0Jyk7XHJcbiAgICBhY2NlcHRJbnZpdGF0aW9uUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaW52aXRhdGlvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLCAvLyBQdWJsaWMgZW5kcG9pbnRcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC91c2VycyAodXNlciBtYW5hZ2VtZW50IHJvdXRlcylcclxuICAgIGNvbnN0IHVzZXJzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCd1c2VycycpO1xyXG5cclxuICAgIC8vIC91c2Vycy9tZSAoZ2V0IGN1cnJlbnQgdXNlciBpbmZvIC0gYXV0aGVudGljYXRlZClcclxuICAgIGNvbnN0IHVzZXJzTWVSZXNvdXJjZSA9IHVzZXJzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21lJyk7XHJcbiAgICB1c2Vyc01lUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQURNSU4gUk9VVEVTIChhZG1pbi1vbmx5IG1vbml0b3JpbmcgYW5kIGFuYWx5dGljcylcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FkbWluJyk7XHJcblxyXG4gICAgLy8gL2FkbWluL3N1Ym1pc3Npb25zIChnZXQgYWxsIHN1Ym1pc3Npb25zIHdpdGggY29zdHMgLSBhZG1pbiBvbmx5KVxyXG4gICAgY29uc3QgYWRtaW5TdWJtaXNzaW9uc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3VibWlzc2lvbnMnKTtcclxuICAgIGFkbWluU3VibWlzc2lvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFkbWluSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9hZG1pbi9hbmFseXRpY3MgKGdldCBkYXNoYm9hcmQgYW5hbHl0aWNzIC0gYWRtaW4gb25seSlcclxuICAgIGNvbnN0IGFkbWluQW5hbHl0aWNzUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdhbmFseXRpY3MnKTtcclxuICAgIGFkbWluQW5hbHl0aWNzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhZG1pbkhhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpRW5kcG9pbnQnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgZW5kcG9pbnQgVVJMJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlBcGlFbmRwb2ludCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpSWQnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS5yZXN0QXBpSWQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgUkVTVCBBUEkgSUQnLFxyXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheUFwaUlkJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFRhZ3NcclxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudE5hbWUpO1xyXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ092ZXJsYXknKTtcclxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2snLCAnQ29tcHV0ZScpO1xyXG4gIH1cclxufVxyXG4iXX0=