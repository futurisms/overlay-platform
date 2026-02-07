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
                FRONTEND_URL: 'http://localhost:3000', // TODO: Update for production
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
                allowOrigins: apigateway.Cors.ALL_ORIGINS, // Update in production
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Amz-Date',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywyREFBNkM7QUFvQjdDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pCLEdBQUcsQ0FBcUI7SUFDeEIsMEJBQTBCLENBQWtCO0lBQzVDLHVCQUF1QixDQUFrQjtJQUN6QyxzQkFBc0IsQ0FBa0I7SUFDeEMsb0JBQW9CLENBQWtCO0lBQ3RDLHFCQUFxQixDQUFrQjtJQUN2QyxlQUFlLENBQWtCO0lBRWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFFOUQsc0NBQXNDO1FBQ3RDLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEUsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHFEQUFxRDtZQUNsRSxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsU0FBUztZQUMvQyxlQUFlLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsUUFBUTtZQUM3RCxlQUFlLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVO1lBQ2hELGNBQWMsRUFBRSxLQUFLLENBQUMsYUFB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Q0FBQztJQUM1QyxDQUFDO0NBQ0Y7QUFuckJELG9DQW1yQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWIvY29yZSc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XHJcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENvbXB1dGVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIHJlYWRvbmx5IGVudmlyb25tZW50TmFtZT86IHN0cmluZztcclxuICByZWFkb25seSB2cGM6IGVjMi5JVnBjO1xyXG4gIHJlYWRvbmx5IGF1cm9yYUNsdXN0ZXI6IHJkcy5JRGF0YWJhc2VDbHVzdGVyO1xyXG4gIHJlYWRvbmx5IGF1cm9yYVNlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcclxuICByZWFkb25seSBkb2N1bWVudEJ1Y2tldDogczMuSUJ1Y2tldDtcclxuICByZWFkb25seSBkb2N1bWVudFRhYmxlOiBkeW5hbW9kYi5JVGFibGU7XHJcbiAgcmVhZG9ubHkgbGxtQ29uZmlnVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcclxuICByZWFkb25seSBjbGF1ZGVBcGlLZXlTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XHJcbiAgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uSVVzZXJQb29sO1xyXG4gIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLklVc2VyUG9vbENsaWVudDtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIENvbXB1dGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xyXG4gIHB1YmxpYyByZWFkb25seSBzdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBjb250ZW50QW5hbHl6ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBncmFtbWFyQ2hlY2tlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IG9yY2hlc3RyYXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGNsYXJpZmljYXRpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBzY29yaW5nRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENvbXB1dGVTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBlbnZpcm9ubWVudE5hbWUgPSBwcm9wcy5lbnZpcm9ubWVudE5hbWUgfHwgJ3Byb2R1Y3Rpb24nO1xyXG5cclxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zXHJcbiAgICBjb25zdCBsYW1iZGFTRyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIExhbWJkYSBmdW5jdGlvbnMgd2l0aCBWUEMgYWNjZXNzJyxcclxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbW1vbiBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzXHJcbiAgICBjb25zdCBjb21tb25FbnZpcm9ubWVudCA9IHtcclxuICAgICAgQVVST1JBX1NFQ1JFVF9BUk46IHByb3BzLmF1cm9yYVNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgIEFVUk9SQV9FTkRQT0lOVDogcHJvcHMuYXVyb3JhQ2x1c3Rlci5jbHVzdGVyRW5kcG9pbnQuaG9zdG5hbWUsXHJcbiAgICAgIERPQ1VNRU5UX0JVQ0tFVDogcHJvcHMuZG9jdW1lbnRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgRE9DVU1FTlRfVEFCTEU6IHByb3BzLmRvY3VtZW50VGFibGUudGFibGVOYW1lLFxyXG4gICAgICBMTE1fQ09ORklHX1RBQkxFOiBwcm9wcy5sbG1Db25maWdUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIENMQVVERV9BUElfS0VZX1NFQ1JFVDogcHJvcHMuY2xhdWRlQXBpS2V5U2VjcmV0LnNlY3JldEFybixcclxuICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcclxuICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50TmFtZSxcclxuICAgIH07XHJcblxyXG4gICAgLy8gQ29tbW9uIExhbWJkYSBsYXllciBmb3Igc2hhcmVkIGNvZGVcclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBMYW1iZGEgbGF5ZXIgZm9yIHNoYXJlZCBjb2RlLi4uJyk7XHJcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcclxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogJ292ZXJsYXktY29tbW9uLWxheWVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvbGF5ZXJzL2NvbW1vbicpLFxyXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWF0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tbW9uIHV0aWxpdGllcywgZGF0YWJhc2UgY2xpZW50cywgYW5kIExMTSBhYnN0cmFjdGlvbiBsYXllcicsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQUkgQUdFTlQgTEFNQkRBIEZVTkNUSU9OU1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgQUkgYWdlbnQgTGFtYmRhIGZ1bmN0aW9ucy4uLicpO1xyXG5cclxuICAgIC8vIDEuIFN0cnVjdHVyZSBWYWxpZGF0b3IgKEJlZHJvY2sgSGFpa3UgLSBmYXN0IHZhbGlkYXRpb24pXHJcbiAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3RydWN0dXJlVmFsaWRhdG9yRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktc3RydWN0dXJlLXZhbGlkYXRvcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9zdHJ1Y3R1cmUtdmFsaWRhdG9yJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJywgLy8gQmVkcm9jayBIYWlrdVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZhbGlkYXRlcyBkb2N1bWVudCBzdHJ1Y3R1cmUgYW5kIGZvcm1hdCB1c2luZyBCZWRyb2NrIEhhaWt1JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMi4gQ29udGVudCBBbmFseXplciAoQ2xhdWRlIFNvbm5ldCAtIGRldGFpbGVkIGFuYWx5c2lzKVxyXG4gICAgdGhpcy5jb250ZW50QW5hbHl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvbnRlbnRBbmFseXplckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWNvbnRlbnQtYW5hbHl6ZXInLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvY29udGVudC1hbmFseXplcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnY2xhdWRlLXNvbm5ldC00LTUtMjAyNTA5MjknLCAvLyBDbGF1ZGUgQVBJXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW5hbHl6ZXMgZG9jdW1lbnQgY29udGVudCBhZ2FpbnN0IGV2YWx1YXRpb24gY3JpdGVyaWEgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDMuIEdyYW1tYXIgQ2hlY2tlciAoQmVkcm9jayBIYWlrdSAtIGZhc3QgZ3JhbW1hciBjaGVjaylcclxuICAgIHRoaXMuZ3JhbW1hckNoZWNrZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dyYW1tYXJDaGVja2VyRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktZ3JhbW1hci1jaGVja2VyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2dyYW1tYXItY2hlY2tlcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygyKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdhbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MCcsIC8vIEJlZHJvY2sgSGFpa3VcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDaGVja3MgZG9jdW1lbnQgZ3JhbW1hciBhbmQgd3JpdGluZyBxdWFsaXR5IHVzaW5nIEJlZHJvY2sgSGFpa3UnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA0LiBPcmNoZXN0cmF0b3IgKENsYXVkZSBTb25uZXQgLSB3b3JrZmxvdyBjb29yZGluYXRpb24pXHJcbiAgICB0aGlzLm9yY2hlc3RyYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnT3JjaGVzdHJhdG9yRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktb3JjaGVzdHJhdG9yJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL29yY2hlc3RyYXRvcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnY2xhdWRlLXNvbm5ldC00LTUtMjAyNTA5MjknLCAvLyBDbGF1ZGUgQVBJXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3JjaGVzdHJhdGVzIHRoZSA2LWFnZW50IEFJIHdvcmtmbG93IHVzaW5nIENsYXVkZSBTb25uZXQnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA1LiBDbGFyaWZpY2F0aW9uIChDbGF1ZGUgU29ubmV0IC0gaW50ZWxsaWdlbnQgUSZBKVxyXG4gICAgdGhpcy5jbGFyaWZpY2F0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDbGFyaWZpY2F0aW9uRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktY2xhcmlmaWNhdGlvbicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9jbGFyaWZpY2F0aW9uJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdjbGF1ZGUtc29ubmV0LTQtNS0yMDI1MDkyOScsIC8vIENsYXVkZSBBUElcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGNsYXJpZmljYXRpb24gcXVlc3Rpb25zIGR1cmluZyBkb2N1bWVudCByZXZpZXcgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDYuIFNjb3JpbmcgKENsYXVkZSBTb25uZXQgLSBmaW5hbCBzY29yaW5nKVxyXG4gICAgdGhpcy5zY29yaW5nRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY29yaW5nRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktc2NvcmluZycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9zY29yaW5nJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2NsYXVkZS1zb25uZXQtNC01LTIwMjUwOTI5JywgLy8gQ2xhdWRlIEFQSVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NhbGN1bGF0ZXMgZmluYWwgc2NvcmVzIGFuZCBnZW5lcmF0ZXMgZmVlZGJhY2sgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBBUEkgTEFNQkRBIEZVTkNUSU9OU1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgQVBJIExhbWJkYSBmdW5jdGlvbnMuLi4nKTtcclxuXHJcbiAgICAvLyBBdXRoIEhhbmRsZXJcclxuICAgIGNvbnN0IGF1dGhIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aEhhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWF1dGgnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL2F1dGgnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHByb3BzLnVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogcHJvcHMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGF1dGhlbnRpY2F0aW9uIGVuZHBvaW50cyAobG9naW4sIHJlZ2lzdGVyLCByZWZyZXNoKScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE92ZXJsYXlzIEhhbmRsZXJcclxuICAgIGNvbnN0IG92ZXJsYXlzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ092ZXJsYXlzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktb3ZlcmxheXMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL292ZXJsYXlzJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIG92ZXJsYXkgQ1JVRCBvcGVyYXRpb25zJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2Vzc2lvbnMgSGFuZGxlclxyXG4gICAgY29uc3Qgc2Vzc2lvbnNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2Vzc2lvbnNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1zZXNzaW9ucycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvc2Vzc2lvbnMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgZG9jdW1lbnQgcmV2aWV3IHNlc3Npb24gbWFuYWdlbWVudCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEltcG9ydCBTdGF0ZSBNYWNoaW5lIEFSTiBmcm9tIE9yY2hlc3RyYXRpb24gU3RhY2tcclxuICAgIGNvbnN0IHN0YXRlTWFjaGluZUFybiA9IGNkay5Gbi5pbXBvcnRWYWx1ZSgnT3ZlcmxheVN0YXRlTWFjaGluZUFybicpO1xyXG5cclxuICAgIC8vIFN1Ym1pc3Npb25zIEhhbmRsZXJcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25zSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N1Ym1pc3Npb25zSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktc3VibWlzc2lvbnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL3N1Ym1pc3Npb25zJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBXT1JLRkxPV19TVEFURV9NQUNISU5FX0FSTjogc3RhdGVNYWNoaW5lQXJuLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgZG9jdW1lbnQgc3VibWlzc2lvbiB1cGxvYWRzIGFuZCBwcm9jZXNzaW5nJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUXVlcnkgUmVzdWx0cyBIYW5kbGVyXHJcbiAgICBjb25zdCBxdWVyeVJlc3VsdHNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUXVlcnlSZXN1bHRzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1xdWVyeS1yZXN1bHRzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL3F1ZXJ5LXJlc3VsdHMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBBVVJPUkFfU0VDUkVUX0FSTjogcHJvcHMuYXVyb3JhU2VjcmV0LnNlY3JldEFybixcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdRdWVyaWVzIEF1cm9yYSBkYXRhYmFzZSBmb3IgZG9jdW1lbnQgcHJvY2Vzc2luZyByZXN1bHRzJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTm90ZXMgSGFuZGxlclxyXG4gICAgY29uc3Qgbm90ZXNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTm90ZXNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1ub3RlcycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvbm90ZXMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgdXNlciBub3RlcyBDUlVEIG9wZXJhdGlvbnMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJbnZpdGF0aW9ucyBIYW5kbGVyXHJcbiAgICBjb25zdCBpbnZpdGF0aW9uc0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdJbnZpdGF0aW9uc0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWludml0YXRpb25zJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS9pbnZpdGF0aW9ucycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIEZST05URU5EX1VSTDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsIC8vIFRPRE86IFVwZGF0ZSBmb3IgcHJvZHVjdGlvblxyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogcHJvcHMudXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGFuYWx5c3QgaW52aXRhdGlvbiBzeXN0ZW0nLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1c2Vyc0hhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVc2Vyc0hhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLXVzZXJzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2FwaS91c2VycycpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGFuZGxlcyB1c2VyIGluZm9ybWF0aW9uIGVuZHBvaW50cycsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkbWluIEhhbmRsZXIgKGFkbWluLW9ubHkgbW9uaXRvcmluZyBhbmQgYW5hbHl0aWNzKVxyXG4gICAgY29uc3QgYWRtaW5IYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWRtaW5IYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1hZG1pbicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvYWRtaW4nKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluLW9ubHkgZW5kcG9pbnRzIGZvciBtb25pdG9yaW5nIGFsbCBzdWJtaXNzaW9ucyBhbmQgY29zdHMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gSUFNIFBFUk1JU1NJT05TXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDb25maWd1cmluZyBJQU0gcGVybWlzc2lvbnMuLi4nKTtcclxuXHJcbiAgICBjb25zdCBhbGxMYW1iZGFzID0gW1xyXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbixcclxuICAgICAgYXV0aEhhbmRsZXIsXHJcbiAgICAgIG92ZXJsYXlzSGFuZGxlcixcclxuICAgICAgc2Vzc2lvbnNIYW5kbGVyLFxyXG4gICAgICBzdWJtaXNzaW9uc0hhbmRsZXIsXHJcbiAgICAgIHF1ZXJ5UmVzdWx0c0hhbmRsZXIsXHJcbiAgICAgIG5vdGVzSGFuZGxlcixcclxuICAgICAgaW52aXRhdGlvbnNIYW5kbGVyLFxyXG4gICAgICB1c2Vyc0hhbmRsZXIsXHJcbiAgICAgIGFkbWluSGFuZGxlcixcclxuICAgIF07XHJcblxyXG4gICAgLy8gR3JhbnQgYWxsIExhbWJkYXMgYWNjZXNzIHRvIHNlY3JldHNcclxuICAgIGFsbExhbWJkYXMuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIHByb3BzLmF1cm9yYVNlY3JldC5ncmFudFJlYWQoZm4pO1xyXG4gICAgICBwcm9wcy5jbGF1ZGVBcGlLZXlTZWNyZXQuZ3JhbnRSZWFkKGZuKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IER5bmFtb0RCIGFjY2Vzc1xyXG4gICAgYWxsTGFtYmRhcy5mb3JFYWNoKGZuID0+IHtcclxuICAgICAgcHJvcHMuZG9jdW1lbnRUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZm4pO1xyXG4gICAgICBwcm9wcy5sbG1Db25maWdUYWJsZS5ncmFudFJlYWREYXRhKGZuKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IFMzIGFjY2Vzc1xyXG4gICAgYWxsTGFtYmRhcy5mb3JFYWNoKGZuID0+IHtcclxuICAgICAgcHJvcHMuZG9jdW1lbnRCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZm4pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgc3VibWlzc2lvbnMgaGFuZGxlciBwZXJtaXNzaW9uIHRvIHN0YXJ0IFN0ZXAgRnVuY3Rpb25zIGV4ZWN1dGlvbnNcclxuICAgIHN1Ym1pc3Npb25zSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBhY3Rpb25zOiBbJ3N0YXRlczpTdGFydEV4ZWN1dGlvbiddLFxyXG4gICAgICByZXNvdXJjZXM6IFtzdGF0ZU1hY2hpbmVBcm5dLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIEdyYW50IEJlZHJvY2sgYWNjZXNzIHRvIEFJIGZ1bmN0aW9uc1xyXG4gICAgY29uc3QgYmVkcm9ja1BvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcclxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvKmBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgW1xyXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbixcclxuICAgIF0uZm9yRWFjaChmbiA9PiBmbi5hZGRUb1JvbGVQb2xpY3koYmVkcm9ja1BvbGljeSkpO1xyXG5cclxuICAgIC8vIEdyYW50IENvZ25pdG8gYWNjZXNzIHRvIGF1dGggaGFuZGxlclxyXG4gICAgYXV0aEhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkluaXRpYXRlQXV0aCcsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluU2V0VXNlclBhc3N3b3JkJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlcycsXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlc291cmNlczogW3Byb3BzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBHcmFudCBDb2duaXRvIGFjY2VzcyB0byBpbnZpdGF0aW9ucyBoYW5kbGVyIChmb3IgYW5hbHlzdCBzaWdudXApXHJcbiAgICBpbnZpdGF0aW9uc0hhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkNyZWF0ZVVzZXInLFxyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXAnLFxyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFtwcm9wcy51c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFQSSBHQVRFV0FZXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBBUEkgR2F0ZXdheSBSRVNUIEFQSS4uLicpO1xyXG5cclxuICAgIC8vIExhbWJkYSBBdXRob3JpemVyIGZvciBKV1QgdmFsaWRhdGlvblxyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcclxuICAgICAgY29nbml0b1VzZXJQb29sczogW3Byb3BzLnVzZXJQb29sXSxcclxuICAgICAgYXV0aG9yaXplck5hbWU6ICdvdmVybGF5LWNvZ25pdG8tYXV0aG9yaXplcicsXHJcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUkVTVCBBUElcclxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnT3ZlcmxheUFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdvdmVybGF5LXBsYXRmb3JtLWFwaScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3ZlcmxheSBQbGF0Zm9ybSBSRVNUIEFQSScsXHJcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcclxuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50TmFtZSxcclxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXHJcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICB0cmFjaW5nRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsIC8vIFVwZGF0ZSBpbiBwcm9kdWN0aW9uXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICBdLFxyXG4gICAgICAgIG1heEFnZTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxyXG4gICAgICB9LFxyXG4gICAgICBjbG91ZFdhdGNoUm9sZTogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFQSSBSZXNvdXJjZXMgYW5kIE1ldGhvZHNcclxuICAgIGNvbnN0IGF1dGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2F1dGgnKTtcclxuICAgIGF1dGhSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhdXRoSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORSwgLy8gUHVibGljIGVuZHBvaW50XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBvdmVybGF5c1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnb3ZlcmxheXMnKTtcclxuICAgIG92ZXJsYXlzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG92ZXJsYXlzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3ZlcmxheXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgb3ZlcmxheUlkUmVzb3VyY2UgPSBvdmVybGF5c1Jlc291cmNlLmFkZFJlc291cmNlKCd7b3ZlcmxheUlkfScpO1xyXG4gICAgb3ZlcmxheUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG92ZXJsYXlJZFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3ZlcmxheXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBvdmVybGF5SWRSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNlc3Npb25zUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdzZXNzaW9ucycpO1xyXG4gICAgc2Vzc2lvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc2Vzc2lvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMvYXZhaWxhYmxlXHJcbiAgICBjb25zdCBzZXNzaW9uc0F2YWlsYWJsZVJlc291cmNlID0gc2Vzc2lvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYXZhaWxhYmxlJyk7XHJcbiAgICBzZXNzaW9uc0F2YWlsYWJsZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2Vzc2lvbklkUmVzb3VyY2UgPSBzZXNzaW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7c2Vzc2lvbklkfScpO1xyXG4gICAgc2Vzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHNlc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzZXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zZXNzaW9ucy97c2Vzc2lvbklkfS9zdWJtaXNzaW9uc1xyXG4gICAgY29uc3Qgc2Vzc2lvblN1Ym1pc3Npb25zUmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3VibWlzc2lvbnMnKTtcclxuICAgIHNlc3Npb25TdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3Nlc3Npb25zL3tzZXNzaW9uSWR9L3JlcG9ydFxyXG4gICAgY29uc3Qgc2Vzc2lvblJlcG9ydFJlc291cmNlID0gc2Vzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3JlcG9ydCcpO1xyXG4gICAgc2Vzc2lvblJlcG9ydFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3Nlc3Npb25zL3tzZXNzaW9uSWR9L2V4cG9ydFxyXG4gICAgY29uc3Qgc2Vzc2lvbkV4cG9ydFJlc291cmNlID0gc2Vzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2V4cG9ydCcpO1xyXG4gICAgc2Vzc2lvbkV4cG9ydFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc3VibWlzc2lvbnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3N1Ym1pc3Npb25zJyk7XHJcbiAgICBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHN1Ym1pc3Npb25JZFJlc291cmNlID0gc3VibWlzc2lvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3N1Ym1pc3Npb25JZH0nKTtcclxuICAgIHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc3VibWlzc2lvbnMve3N1Ym1pc3Npb25JZH0vZmVlZGJhY2tcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25GZWVkYmFja1Jlc291cmNlID0gc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2ZlZWRiYWNrJyk7XHJcbiAgICBzdWJtaXNzaW9uRmVlZGJhY2tSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zdWJtaXNzaW9ucy97c3VibWlzc2lvbklkfS9kb3dubG9hZFxyXG4gICAgY29uc3Qgc3VibWlzc2lvbkRvd25sb2FkUmVzb3VyY2UgPSBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZG93bmxvYWQnKTtcclxuICAgIHN1Ym1pc3Npb25Eb3dubG9hZFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2FuYWx5c2lzXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uQW5hbHlzaXNSZXNvdXJjZSA9IHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdhbmFseXNpcycpO1xyXG4gICAgc3VibWlzc2lvbkFuYWx5c2lzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBub3Rlc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnbm90ZXMnKTtcclxuICAgIG5vdGVzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG5vdGVzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obm90ZXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgbm90ZUlkUmVzb3VyY2UgPSBub3Rlc1Jlc291cmNlLmFkZFJlc291cmNlKCd7bm90ZUlkfScpO1xyXG4gICAgbm90ZUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG5vdGVJZFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obm90ZXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBub3RlSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBJTlZJVEFUSU9OUyBST1VURVNcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgLy8gL3Nlc3Npb25zL3tzZXNzaW9uSWR9L2ludml0YXRpb25zIChjcmVhdGUgaW52aXRhdGlvbiAtIGFkbWluIG9ubHkpXHJcbiAgICBjb25zdCBzZXNzaW9uSW52aXRhdGlvbnNSZXNvdXJjZSA9IHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdpbnZpdGF0aW9ucycpO1xyXG4gICAgc2Vzc2lvbkludml0YXRpb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oaW52aXRhdGlvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL2ludml0YXRpb25zIChwdWJsaWMgcm91dGVzIGZvciBzaWdudXAgZmxvdylcclxuICAgIGNvbnN0IGludml0YXRpb25zUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdpbnZpdGF0aW9ucycpO1xyXG5cclxuICAgIC8vIC9pbnZpdGF0aW9ucy97dG9rZW59IChnZXQgaW52aXRhdGlvbiBkZXRhaWxzIC0gcHVibGljKVxyXG4gICAgY29uc3QgaW52aXRhdGlvblRva2VuUmVzb3VyY2UgPSBpbnZpdGF0aW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7dG9rZW59Jyk7XHJcbiAgICBpbnZpdGF0aW9uVG9rZW5SZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGludml0YXRpb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORSwgLy8gUHVibGljIGVuZHBvaW50XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvaW52aXRhdGlvbnMve3Rva2VufS9hY2NlcHQgKGFjY2VwdCBpbnZpdGF0aW9uIC0gcHVibGljKVxyXG4gICAgY29uc3QgYWNjZXB0SW52aXRhdGlvblJlc291cmNlID0gaW52aXRhdGlvblRva2VuUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FjY2VwdCcpO1xyXG4gICAgYWNjZXB0SW52aXRhdGlvblJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGludml0YXRpb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuTk9ORSwgLy8gUHVibGljIGVuZHBvaW50XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvdXNlcnMgKHVzZXIgbWFuYWdlbWVudCByb3V0ZXMpXHJcbiAgICBjb25zdCB1c2Vyc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgndXNlcnMnKTtcclxuXHJcbiAgICAvLyAvdXNlcnMvbWUgKGdldCBjdXJyZW50IHVzZXIgaW5mbyAtIGF1dGhlbnRpY2F0ZWQpXHJcbiAgICBjb25zdCB1c2Vyc01lUmVzb3VyY2UgPSB1c2Vyc1Jlc291cmNlLmFkZFJlc291cmNlKCdtZScpO1xyXG4gICAgdXNlcnNNZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIEFETUlOIFJPVVRFUyAoYWRtaW4tb25seSBtb25pdG9yaW5nIGFuZCBhbmFseXRpY3MpXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnN0IGFkbWluUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdhZG1pbicpO1xyXG5cclxuICAgIC8vIC9hZG1pbi9zdWJtaXNzaW9ucyAoZ2V0IGFsbCBzdWJtaXNzaW9ucyB3aXRoIGNvc3RzIC0gYWRtaW4gb25seSlcclxuICAgIGNvbnN0IGFkbWluU3VibWlzc2lvbnNSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N1Ym1pc3Npb25zJyk7XHJcbiAgICBhZG1pblN1Ym1pc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhZG1pbkhhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvYWRtaW4vYW5hbHl0aWNzIChnZXQgZGFzaGJvYXJkIGFuYWx5dGljcyAtIGFkbWluIG9ubHkpXHJcbiAgICBjb25zdCBhZG1pbkFuYWx5dGljc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XHJcbiAgICBhZG1pbkFuYWx5dGljc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYWRtaW5IYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUVuZHBvaW50Jywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGVuZHBvaW50IFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5QXBpRW5kcG9pbnQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUlkJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkucmVzdEFwaUlkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFJFU1QgQVBJIElEJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlBcGlJZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYWdzXHJcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnROYW1lKTtcclxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdPdmVybGF5Jyk7XHJcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrJywgJ0NvbXB1dGUnKTtcclxuICB9XHJcbn1cclxuIl19