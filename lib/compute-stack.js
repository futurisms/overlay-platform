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
exports.ComputeStack = ComputeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywyREFBNkM7QUFvQjdDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pCLEdBQUcsQ0FBcUI7SUFDeEIsMEJBQTBCLENBQWtCO0lBQzVDLHVCQUF1QixDQUFrQjtJQUN6QyxzQkFBc0IsQ0FBa0I7SUFDeEMsb0JBQW9CLENBQWtCO0lBQ3RDLHFCQUFxQixDQUFrQjtJQUN2QyxlQUFlLENBQWtCO0lBRWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFFOUQsc0NBQXNDO1FBQ3RDLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEUsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHFEQUFxRDtZQUNsRSxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsU0FBUztZQUMvQyxlQUFlLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsUUFBUTtZQUM3RCxlQUFlLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVO1lBQ2hELGNBQWMsRUFBRSxLQUFLLENBQUMsYUFB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O1FBRUgsT0FBTztRQUNQLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDdEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQXJ2QkQsb0NBcXZCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYi9jb3JlJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcclxuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ29tcHV0ZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnROYW1lPzogc3RyaW5nO1xyXG4gIHJlYWRvbmx5IHZwYzogZWMyLklWcGM7XHJcbiAgcmVhZG9ubHkgYXVyb3JhQ2x1c3RlcjogcmRzLklEYXRhYmFzZUNsdXN0ZXI7XHJcbiAgcmVhZG9ubHkgYXVyb3JhU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0O1xyXG4gIHJlYWRvbmx5IGRvY3VtZW50QnVja2V0OiBzMy5JQnVja2V0O1xyXG4gIHJlYWRvbmx5IGRvY3VtZW50VGFibGU6IGR5bmFtb2RiLklUYWJsZTtcclxuICByZWFkb25seSBsbG1Db25maWdUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xyXG4gIHJlYWRvbmx5IGNsYXVkZUFwaUtleVNlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcclxuICByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5JVXNlclBvb2w7XHJcbiAgcmVhZG9ubHkgdXNlclBvb2xDbGllbnQ6IGNvZ25pdG8uSVVzZXJQb29sQ2xpZW50O1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQ29tcHV0ZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XHJcbiAgcHVibGljIHJlYWRvbmx5IHN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbnRlbnRBbmFseXplckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGdyYW1tYXJDaGVja2VyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgb3JjaGVzdHJhdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgY2xhcmlmaWNhdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IHNjb3JpbmdGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ29tcHV0ZVN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IGVudmlyb25tZW50TmFtZSA9IHByb3BzLmVudmlyb25tZW50TmFtZSB8fCAncHJvZHVjdGlvbic7XHJcblxyXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIExhbWJkYSBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGxhbWJkYVNHID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdMYW1iZGFTZWN1cml0eUdyb3VwJywge1xyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgTGFtYmRhIGZ1bmN0aW9ucyB3aXRoIFZQQyBhY2Nlc3MnLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29tbW9uIExhbWJkYSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcclxuICAgIGNvbnN0IGNvbW1vbkVudmlyb25tZW50ID0ge1xyXG4gICAgICBBVVJPUkFfU0VDUkVUX0FSTjogcHJvcHMuYXVyb3JhU2VjcmV0LnNlY3JldEFybixcclxuICAgICAgQVVST1JBX0VORFBPSU5UOiBwcm9wcy5hdXJvcmFDbHVzdGVyLmNsdXN0ZXJFbmRwb2ludC5ob3N0bmFtZSxcclxuICAgICAgRE9DVU1FTlRfQlVDS0VUOiBwcm9wcy5kb2N1bWVudEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBET0NVTUVOVF9UQUJMRTogcHJvcHMuZG9jdW1lbnRUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIExMTV9DT05GSUdfVEFCTEU6IHByb3BzLmxsbUNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgQ0xBVURFX0FQSV9LRVlfU0VDUkVUOiBwcm9wcy5jbGF1ZGVBcGlLZXlTZWNyZXQuc2VjcmV0QXJuLFxyXG4gICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxyXG4gICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnROYW1lLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBDb21tb24gTGFtYmRhIGxheWVyIGZvciBzaGFyZWQgY29kZVxyXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIExhbWJkYSBsYXllciBmb3Igc2hhcmVkIGNvZGUuLi4nKTtcclxuICAgIGNvbnN0IGNvbW1vbkxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0NvbW1vbkxheWVyJywge1xyXG4gICAgICBsYXllclZlcnNpb25OYW1lOiAnb3ZlcmxheS1jb21tb24tbGF5ZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9sYXllcnMvY29tbW9uJyksXHJcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb21tb24gdXRpbGl0aWVzLCBkYXRhYmFzZSBjbGllbnRzLCBhbmQgTExNIGFic3RyYWN0aW9uIGxheWVyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBBSSBBR0VOVCBMQU1CREEgRlVOQ1RJT05TXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBBSSBhZ2VudCBMYW1iZGEgZnVuY3Rpb25zLi4uJyk7XHJcblxyXG4gICAgLy8gMS4gU3RydWN0dXJlIFZhbGlkYXRvciAoQmVkcm9jayBIYWlrdSAtIGZhc3QgdmFsaWRhdGlvbilcclxuICAgIHRoaXMuc3RydWN0dXJlVmFsaWRhdG9yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1zdHJ1Y3R1cmUtdmFsaWRhdG9yJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL3N0cnVjdHVyZS12YWxpZGF0b3InKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMiksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLCAvLyBCZWRyb2NrIEhhaWt1XHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnVmFsaWRhdGVzIGRvY3VtZW50IHN0cnVjdHVyZSBhbmQgZm9ybWF0IHVzaW5nIEJlZHJvY2sgSGFpa3UnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyLiBDb250ZW50IEFuYWx5emVyIChDbGF1ZGUgU29ubmV0IC0gZGV0YWlsZWQgYW5hbHlzaXMpXHJcbiAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29udGVudEFuYWx5emVyRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktY29udGVudC1hbmFseXplcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9jb250ZW50LWFuYWx5emVyJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdjbGF1ZGUtc29ubmV0LTQtNS0yMDI1MDkyOScsIC8vIENsYXVkZSBBUElcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdBbmFseXplcyBkb2N1bWVudCBjb250ZW50IGFnYWluc3QgZXZhbHVhdGlvbiBjcml0ZXJpYSB1c2luZyBDbGF1ZGUgU29ubmV0JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMy4gR3JhbW1hciBDaGVja2VyIChCZWRyb2NrIEhhaWt1IC0gZmFzdCBncmFtbWFyIGNoZWNrKVxyXG4gICAgdGhpcy5ncmFtbWFyQ2hlY2tlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR3JhbW1hckNoZWNrZXJGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1ncmFtbWFyLWNoZWNrZXInLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvZ3JhbW1hci1jaGVja2VyJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJywgLy8gQmVkcm9jayBIYWlrdVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NoZWNrcyBkb2N1bWVudCBncmFtbWFyIGFuZCB3cml0aW5nIHF1YWxpdHkgdXNpbmcgQmVkcm9jayBIYWlrdScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDQuIE9yY2hlc3RyYXRvciAoQ2xhdWRlIFNvbm5ldCAtIHdvcmtmbG93IGNvb3JkaW5hdGlvbilcclxuICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdPcmNoZXN0cmF0b3JGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1vcmNoZXN0cmF0b3InLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvb3JjaGVzdHJhdG9yJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdjbGF1ZGUtc29ubmV0LTQtNS0yMDI1MDkyOScsIC8vIENsYXVkZSBBUElcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdPcmNoZXN0cmF0ZXMgdGhlIDYtYWdlbnQgQUkgd29ya2Zsb3cgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDUuIENsYXJpZmljYXRpb24gKENsYXVkZSBTb25uZXQgLSBpbnRlbGxpZ2VudCBRJkEpXHJcbiAgICB0aGlzLmNsYXJpZmljYXRpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NsYXJpZmljYXRpb25GdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1jbGFyaWZpY2F0aW9uJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2NsYXJpZmljYXRpb24nKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMyksXHJcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2NsYXVkZS1zb25uZXQtNC01LTIwMjUwOTI5JywgLy8gQ2xhdWRlIEFQSVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgY2xhcmlmaWNhdGlvbiBxdWVzdGlvbnMgZHVyaW5nIGRvY3VtZW50IHJldmlldyB1c2luZyBDbGF1ZGUgU29ubmV0JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNi4gU2NvcmluZyAoQ2xhdWRlIFNvbm5ldCAtIGZpbmFsIHNjb3JpbmcpXHJcbiAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Njb3JpbmdGdW5jdGlvbicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1zY29yaW5nJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL3Njb3JpbmcnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMyksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnY2xhdWRlLXNvbm5ldC00LTUtMjAyNTA5MjknLCAvLyBDbGF1ZGUgQVBJXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2FsY3VsYXRlcyBmaW5hbCBzY29yZXMgYW5kIGdlbmVyYXRlcyBmZWVkYmFjayB1c2luZyBDbGF1ZGUgU29ubmV0JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFQSSBMQU1CREEgRlVOQ1RJT05TXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBBUEkgTGFtYmRhIGZ1bmN0aW9ucy4uLicpO1xyXG5cclxuICAgIC8vIEF1dGggSGFuZGxlclxyXG4gICAgY29uc3QgYXV0aEhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdXRoSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktYXV0aCcsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvYXV0aCcpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogcHJvcHMudXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiBwcm9wcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgYXV0aGVudGljYXRpb24gZW5kcG9pbnRzIChsb2dpbiwgcmVnaXN0ZXIsIHJlZnJlc2gpJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gT3ZlcmxheXMgSGFuZGxlclxyXG4gICAgY29uc3Qgb3ZlcmxheXNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnT3ZlcmxheXNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1vdmVybGF5cycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvb3ZlcmxheXMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgb3ZlcmxheSBDUlVEIG9wZXJhdGlvbnMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTZXNzaW9ucyBIYW5kbGVyXHJcbiAgICBjb25zdCBzZXNzaW9uc0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTZXNzaW9uc0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLXNlc3Npb25zJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9zZXNzaW9ucycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyBkb2N1bWVudCByZXZpZXcgc2Vzc2lvbiBtYW5hZ2VtZW50JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSW1wb3J0IFN0YXRlIE1hY2hpbmUgQVJOIGZyb20gT3JjaGVzdHJhdGlvbiBTdGFja1xyXG4gICAgY29uc3Qgc3RhdGVNYWNoaW5lQXJuID0gY2RrLkZuLmltcG9ydFZhbHVlKCdPdmVybGF5U3RhdGVNYWNoaW5lQXJuJyk7XHJcblxyXG4gICAgLy8gU3VibWlzc2lvbnMgSGFuZGxlclxyXG4gICAgY29uc3Qgc3VibWlzc2lvbnNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3VibWlzc2lvbnNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1zdWJtaXNzaW9ucycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvc3VibWlzc2lvbnMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIFdPUktGTE9XX1NUQVRFX01BQ0hJTkVfQVJOOiBzdGF0ZU1hY2hpbmVBcm4sXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyBkb2N1bWVudCBzdWJtaXNzaW9uIHVwbG9hZHMgYW5kIHByb2Nlc3NpbmcnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBRdWVyeSBSZXN1bHRzIEhhbmRsZXJcclxuICAgIGNvbnN0IHF1ZXJ5UmVzdWx0c0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdRdWVyeVJlc3VsdHNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LXF1ZXJ5LXJlc3VsdHMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvcXVlcnktcmVzdWx0cycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIEFVUk9SQV9TRUNSRVRfQVJOOiBwcm9wcy5hdXJvcmFTZWNyZXQuc2VjcmV0QXJuLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1F1ZXJpZXMgQXVyb3JhIGRhdGFiYXNlIGZvciBkb2N1bWVudCBwcm9jZXNzaW5nIHJlc3VsdHMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBOb3RlcyBIYW5kbGVyXHJcbiAgICBjb25zdCBub3Rlc0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdOb3Rlc0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLW5vdGVzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9ub3RlcycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyB1c2VyIG5vdGVzIENSVUQgb3BlcmF0aW9ucycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEludml0YXRpb25zIEhhbmRsZXJcclxuICAgIGNvbnN0IGludml0YXRpb25zSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0ludml0YXRpb25zSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktaW52aXRhdGlvbnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL2ludml0YXRpb25zJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgRlJPTlRFTkRfVVJMOiAnaHR0cHM6Ly9vdmVybGF5LmZ1dHVyaXNtcy5haScsXHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiBwcm9wcy51c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgYW5hbHlzdCBpbnZpdGF0aW9uIHN5c3RlbScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VzZXJzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktdXNlcnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL3VzZXJzJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIHVzZXIgaW5mb3JtYXRpb24gZW5kcG9pbnRzJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRtaW4gSGFuZGxlciAoYWRtaW4tb25seSBtb25pdG9yaW5nIGFuZCBhbmFseXRpY3MpXHJcbiAgICBjb25zdCBhZG1pbkhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBZG1pbkhhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWFkbWluJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9hZG1pbicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4tb25seSBlbmRwb2ludHMgZm9yIG1vbml0b3JpbmcgYWxsIHN1Ym1pc3Npb25zIGFuZCBjb3N0cycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFubm90YXRlIERvY3VtZW50IEhhbmRsZXIgKEFJLXBvd2VyZWQgZG9jdW1lbnQgYW5ub3RhdGlvbilcclxuICAgIGNvbnN0IGFubm90YXRlRG9jdW1lbnRIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQW5ub3RhdGVEb2N1bWVudEhhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWFubm90YXRlLWRvY3VtZW50JyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2Fubm90YXRlLWRvY3VtZW50JyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyA1IG1pbnV0ZXMgZm9yIENsYXVkZSBBUEkgY2FsbFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LCAvLyBNb3JlIG1lbW9yeSBmb3IgdGV4dCBwcm9jZXNzaW5nXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0dlbmVyYXRlcyBBSS1wb3dlcmVkIGFubm90YXRlZCBkb2N1bWVudHMgd2l0aCByZWNvbW1lbmRhdGlvbnMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gSUFNIFBFUk1JU1NJT05TXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDb25maWd1cmluZyBJQU0gcGVybWlzc2lvbnMuLi4nKTtcclxuXHJcbiAgICBjb25zdCBhbGxMYW1iZGFzID0gW1xyXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbixcclxuICAgICAgYXV0aEhhbmRsZXIsXHJcbiAgICAgIG92ZXJsYXlzSGFuZGxlcixcclxuICAgICAgc2Vzc2lvbnNIYW5kbGVyLFxyXG4gICAgICBzdWJtaXNzaW9uc0hhbmRsZXIsXHJcbiAgICAgIHF1ZXJ5UmVzdWx0c0hhbmRsZXIsXHJcbiAgICAgIG5vdGVzSGFuZGxlcixcclxuICAgICAgaW52aXRhdGlvbnNIYW5kbGVyLFxyXG4gICAgICB1c2Vyc0hhbmRsZXIsXHJcbiAgICAgIGFkbWluSGFuZGxlcixcclxuICAgICAgYW5ub3RhdGVEb2N1bWVudEhhbmRsZXIsXHJcbiAgICBdO1xyXG5cclxuICAgIC8vIEdyYW50IGFsbCBMYW1iZGFzIGFjY2VzcyB0byBzZWNyZXRzXHJcbiAgICBhbGxMYW1iZGFzLmZvckVhY2goZm4gPT4ge1xyXG4gICAgICBwcm9wcy5hdXJvcmFTZWNyZXQuZ3JhbnRSZWFkKGZuKTtcclxuICAgICAgcHJvcHMuY2xhdWRlQXBpS2V5U2VjcmV0LmdyYW50UmVhZChmbik7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBEeW5hbW9EQiBhY2Nlc3NcclxuICAgIGFsbExhbWJkYXMuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIHByb3BzLmRvY3VtZW50VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGZuKTtcclxuICAgICAgcHJvcHMubGxtQ29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YShmbik7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBTMyBhY2Nlc3NcclxuICAgIGFsbExhbWJkYXMuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIHByb3BzLmRvY3VtZW50QnVja2V0LmdyYW50UmVhZFdyaXRlKGZuKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IHN1Ym1pc3Npb25zIGhhbmRsZXIgcGVybWlzc2lvbiB0byBzdGFydCBTdGVwIEZ1bmN0aW9ucyBleGVjdXRpb25zXHJcbiAgICBzdWJtaXNzaW9uc0hhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogWydzdGF0ZXM6U3RhcnRFeGVjdXRpb24nXSxcclxuICAgICAgcmVzb3VyY2VzOiBbc3RhdGVNYWNoaW5lQXJuXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBHcmFudCBhbm5vdGF0ZS1kb2N1bWVudCBoYW5kbGVyIHBlcm1pc3Npb24gdG8gaW52b2tlIGl0c2VsZiAoZm9yIGFzeW5jIGJhY2tncm91bmQgcHJvY2Vzc2luZylcclxuICAgIGFubm90YXRlRG9jdW1lbnRIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFsnbGFtYmRhOkludm9rZUZ1bmN0aW9uJ10sXHJcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmxhbWJkYToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZnVuY3Rpb246b3ZlcmxheS1hcGktYW5ub3RhdGUtZG9jdW1lbnRgXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2VzcyB0byBBSSBmdW5jdGlvbnNcclxuICAgIGNvbnN0IGJlZHJvY2tQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXHJcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsLypgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIFtcclxuICAgICAgdGhpcy5zdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbixcclxuICAgICAgdGhpcy5jb250ZW50QW5hbHl6ZXJGdW5jdGlvbixcclxuICAgICAgdGhpcy5ncmFtbWFyQ2hlY2tlckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLm9yY2hlc3RyYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNsYXJpZmljYXRpb25GdW5jdGlvbixcclxuICAgICAgdGhpcy5zY29yaW5nRnVuY3Rpb24sXHJcbiAgICBdLmZvckVhY2goZm4gPT4gZm4uYWRkVG9Sb2xlUG9saWN5KGJlZHJvY2tQb2xpY3kpKTtcclxuXHJcbiAgICAvLyBHcmFudCBDb2duaXRvIGFjY2VzcyB0byBhdXRoIGhhbmRsZXJcclxuICAgIGF1dGhIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5Jbml0aWF0ZUF1dGgnLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNyZWF0ZVVzZXInLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluVXBkYXRlVXNlckF0dHJpYnV0ZXMnLFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtwcm9wcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gR3JhbnQgQ29nbml0byBhY2Nlc3MgdG8gaW52aXRhdGlvbnMgaGFuZGxlciAoZm9yIGFuYWx5c3Qgc2lnbnVwKVxyXG4gICAgaW52aXRhdGlvbnNIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5TZXRVc2VyUGFzc3dvcmQnLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJywgICAgICAgIC8vIEZvciBsb29raW5nIHVwIGV4aXN0aW5nIHVzZXJzIG9uIHNpZ251cCByZXRyeVxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkRlbGV0ZVVzZXInLCAgICAgIC8vIEZvciByb2xsYmFjayB3aGVuIGRhdGFiYXNlIG9wZXJhdGlvbnMgZmFpbFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtwcm9wcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFQSSBHQVRFV0FZXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBBUEkgR2F0ZXdheSBSRVNUIEFQSS4uLicpO1xyXG5cclxuICAgIC8vIExhbWJkYSBBdXRob3JpemVyIGZvciBKV1QgdmFsaWRhdGlvblxyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcclxuICAgICAgY29nbml0b1VzZXJQb29sczogW3Byb3BzLnVzZXJQb29sXSxcclxuICAgICAgYXV0aG9yaXplck5hbWU6ICdvdmVybGF5LWNvZ25pdG8tYXV0aG9yaXplcicsXHJcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUkVTVCBBUElcclxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnT3ZlcmxheUFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdvdmVybGF5LXBsYXRmb3JtLWFwaScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3ZlcmxheSBQbGF0Zm9ybSBSRVNUIEFQSScsXHJcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcclxuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50TmFtZSxcclxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXHJcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB0cmFjaW5nRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbXHJcbiAgICAgICAgICAnaHR0cHM6Ly9vdmVybGF5LmZ1dHVyaXNtcy5haScsIC8vIFByb2R1Y3Rpb24gY3VzdG9tIGRvbWFpblxyXG4gICAgICAgICAgJ2h0dHBzOi8vb3ZlcmxheS1wbGF0Zm9ybS52ZXJjZWwuYXBwJywgLy8gVmVyY2VsIHByb2R1Y3Rpb25cclxuICAgICAgICAgICdodHRwczovL292ZXJsYXktcGxhdGZvcm0tZ2l0LW1hc3Rlci1zYXRuYW1zLXByb2plY3RzLTcxOTNmZDkzLnZlcmNlbC5hcHAnLCAvLyBWZXJjZWwgZ2l0IGJyYW5jaFxyXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsIC8vIExvY2FsIGRldmVsb3BtZW50XHJcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAyJywgLy8gTG9jYWwgZGV2ZWxvcG1lbnQgKGFsdGVybmF0ZSBwb3J0KVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICAgICdYLUFtei1UYXJnZXQnLCAvLyBSZXF1aXJlZCBmb3IgQ29nbml0byBhdXRoIGVuZHBvaW50XHJcbiAgICAgICAgXSxcclxuICAgICAgICBtYXhBZ2U6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcclxuICAgICAgfSxcclxuICAgICAgY2xvdWRXYXRjaFJvbGU6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBUEkgUmVzb3VyY2VzIGFuZCBNZXRob2RzXHJcbiAgICBjb25zdCBhdXRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XHJcbiAgICBhdXRoUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXV0aEhhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsIC8vIFB1YmxpYyBlbmRwb2ludFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgb3ZlcmxheXNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ292ZXJsYXlzJyk7XHJcbiAgICBvdmVybGF5c1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3ZlcmxheXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBvdmVybGF5c1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG92ZXJsYXlJZFJlc291cmNlID0gb3ZlcmxheXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne292ZXJsYXlJZH0nKTtcclxuICAgIG92ZXJsYXlJZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3ZlcmxheXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBvdmVybGF5SWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgb3ZlcmxheUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzZXNzaW9uc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnc2Vzc2lvbnMnKTtcclxuICAgIHNlc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHNlc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3Nlc3Npb25zL2F2YWlsYWJsZVxyXG4gICAgY29uc3Qgc2Vzc2lvbnNBdmFpbGFibGVSZXNvdXJjZSA9IHNlc3Npb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2F2YWlsYWJsZScpO1xyXG4gICAgc2Vzc2lvbnNBdmFpbGFibGVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNlc3Npb25JZFJlc291cmNlID0gc2Vzc2lvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Nlc3Npb25JZH0nKTtcclxuICAgIHNlc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzZXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc2Vzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vc3VibWlzc2lvbnNcclxuICAgIGNvbnN0IHNlc3Npb25TdWJtaXNzaW9uc1Jlc291cmNlID0gc2Vzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N1Ym1pc3Npb25zJyk7XHJcbiAgICBzZXNzaW9uU3VibWlzc2lvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zZXNzaW9ucy97c2Vzc2lvbklkfS9yZXBvcnRcclxuICAgIGNvbnN0IHNlc3Npb25SZXBvcnRSZXNvdXJjZSA9IHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdyZXBvcnQnKTtcclxuICAgIHNlc3Npb25SZXBvcnRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zZXNzaW9ucy97c2Vzc2lvbklkfS9leHBvcnRcclxuICAgIGNvbnN0IHNlc3Npb25FeHBvcnRSZXNvdXJjZSA9IHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdleHBvcnQnKTtcclxuICAgIHNlc3Npb25FeHBvcnRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zZXNzaW9ucy97c2Vzc2lvbklkfS9wYXJ0aWNpcGFudHMve3VzZXJJZH1cclxuICAgIGNvbnN0IHNlc3Npb25QYXJ0aWNpcGFudHNSZXNvdXJjZSA9IHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdwYXJ0aWNpcGFudHMnKTtcclxuICAgIGNvbnN0IHBhcnRpY2lwYW50VXNlcklkUmVzb3VyY2UgPSBzZXNzaW9uUGFydGljaXBhbnRzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3t1c2VySWR9Jyk7XHJcbiAgICBwYXJ0aWNpcGFudFVzZXJJZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc3VibWlzc2lvbnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3N1Ym1pc3Npb25zJyk7XHJcbiAgICBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHN1Ym1pc3Npb25JZFJlc291cmNlID0gc3VibWlzc2lvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3N1Ym1pc3Npb25JZH0nKTtcclxuICAgIHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc3VibWlzc2lvbnMve3N1Ym1pc3Npb25JZH0vY29udGVudFxyXG4gICAgY29uc3Qgc3VibWlzc2lvbkNvbnRlbnRSZXNvdXJjZSA9IHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdjb250ZW50Jyk7XHJcbiAgICBzdWJtaXNzaW9uQ29udGVudFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2Fuc3dlcnNcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25BbnN3ZXJzUmVzb3VyY2UgPSBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5zd2VycycpO1xyXG4gICAgc3VibWlzc2lvbkFuc3dlcnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc3VibWlzc2lvbkFuc3dlcnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc3VibWlzc2lvbnMve3N1Ym1pc3Npb25JZH0vZmVlZGJhY2tcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25GZWVkYmFja1Jlc291cmNlID0gc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2ZlZWRiYWNrJyk7XHJcbiAgICBzdWJtaXNzaW9uRmVlZGJhY2tSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zdWJtaXNzaW9ucy97c3VibWlzc2lvbklkfS9kb3dubG9hZFxyXG4gICAgY29uc3Qgc3VibWlzc2lvbkRvd25sb2FkUmVzb3VyY2UgPSBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZG93bmxvYWQnKTtcclxuICAgIHN1Ym1pc3Npb25Eb3dubG9hZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2FuYWx5c2lzXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uQW5hbHlzaXNSZXNvdXJjZSA9IHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdhbmFseXNpcycpO1xyXG4gICAgc3VibWlzc2lvbkFuYWx5c2lzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc3VibWlzc2lvbnMve3N1Ym1pc3Npb25JZH0vYW5ub3RhdGVcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25Bbm5vdGF0ZVJlc291cmNlID0gc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2Fubm90YXRlJyk7XHJcbiAgICBzdWJtaXNzaW9uQW5ub3RhdGVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFubm90YXRlRG9jdW1lbnRIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgbm90ZXNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ25vdGVzJyk7XHJcbiAgICBub3Rlc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obm90ZXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBub3Rlc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG5vdGVJZFJlc291cmNlID0gbm90ZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne25vdGVJZH0nKTtcclxuICAgIG5vdGVJZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obm90ZXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBub3RlSWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgbm90ZUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gSU5WSVRBVElPTlMgUk9VVEVTXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIC8vIC9zZXNzaW9ucy97c2Vzc2lvbklkfS9pbnZpdGF0aW9ucyAoY3JlYXRlIGludml0YXRpb24gLSBhZG1pbiBvbmx5KVxyXG4gICAgY29uc3Qgc2Vzc2lvbkludml0YXRpb25zUmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnaW52aXRhdGlvbnMnKTtcclxuICAgIHNlc3Npb25JbnZpdGF0aW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGludml0YXRpb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9pbnZpdGF0aW9ucyAocHVibGljIHJvdXRlcyBmb3Igc2lnbnVwIGZsb3cpXHJcbiAgICBjb25zdCBpbnZpdGF0aW9uc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnaW52aXRhdGlvbnMnKTtcclxuXHJcbiAgICAvLyAvaW52aXRhdGlvbnMve3Rva2VufSAoZ2V0IGludml0YXRpb24gZGV0YWlscyAtIHB1YmxpYylcclxuICAgIGNvbnN0IGludml0YXRpb25Ub2tlblJlc291cmNlID0gaW52aXRhdGlvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Rva2VufScpO1xyXG4gICAgaW52aXRhdGlvblRva2VuUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihpbnZpdGF0aW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsIC8vIFB1YmxpYyBlbmRwb2ludFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL2ludml0YXRpb25zL3t0b2tlbn0vYWNjZXB0IChhY2NlcHQgaW52aXRhdGlvbiAtIHB1YmxpYylcclxuICAgIGNvbnN0IGFjY2VwdEludml0YXRpb25SZXNvdXJjZSA9IGludml0YXRpb25Ub2tlblJlc291cmNlLmFkZFJlc291cmNlKCdhY2NlcHQnKTtcclxuICAgIGFjY2VwdEludml0YXRpb25SZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihpbnZpdGF0aW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsIC8vIFB1YmxpYyBlbmRwb2ludFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3VzZXJzICh1c2VyIG1hbmFnZW1lbnQgcm91dGVzKVxyXG4gICAgY29uc3QgdXNlcnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VzZXJzJyk7XHJcblxyXG4gICAgLy8gL3VzZXJzL21lIChnZXQgY3VycmVudCB1c2VyIGluZm8gLSBhdXRoZW50aWNhdGVkKVxyXG4gICAgY29uc3QgdXNlcnNNZVJlc291cmNlID0gdXNlcnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbWUnKTtcclxuICAgIHVzZXJzTWVSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBBRE1JTiBST1VURVMgKGFkbWluLW9ubHkgbW9uaXRvcmluZyBhbmQgYW5hbHl0aWNzKVxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICBjb25zdCBhZG1pblJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYWRtaW4nKTtcclxuXHJcbiAgICAvLyAvYWRtaW4vc3VibWlzc2lvbnMgKGdldCBhbGwgc3VibWlzc2lvbnMgd2l0aCBjb3N0cyAtIGFkbWluIG9ubHkpXHJcbiAgICBjb25zdCBhZG1pblN1Ym1pc3Npb25zUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdzdWJtaXNzaW9ucycpO1xyXG4gICAgYWRtaW5TdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYWRtaW5IYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL2FkbWluL2FuYWx5dGljcyAoZ2V0IGRhc2hib2FyZCBhbmFseXRpY3MgLSBhZG1pbiBvbmx5KVxyXG4gICAgY29uc3QgYWRtaW5BbmFseXRpY3NSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FuYWx5dGljcycpO1xyXG4gICAgYWRtaW5BbmFseXRpY3NSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFkbWluSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHNcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlFbmRwb2ludCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuYXBpLnVybCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBlbmRwb2ludCBVUkwnLFxyXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheUFwaUVuZHBvaW50JyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuYXBpLnJlc3RBcGlJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBSRVNUIEFQSSBJRCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5QXBpSWQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVGFnc1xyXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50TmFtZSk7XHJcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnT3ZlcmxheScpO1xyXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFjaycsICdDb21wdXRlJyk7XHJcbiAgfVxyXG59XHJcbiJdfQ==