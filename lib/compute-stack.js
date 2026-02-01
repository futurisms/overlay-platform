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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywyREFBNkM7QUFvQjdDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pCLEdBQUcsQ0FBcUI7SUFDeEIsMEJBQTBCLENBQWtCO0lBQzVDLHVCQUF1QixDQUFrQjtJQUN6QyxzQkFBc0IsQ0FBa0I7SUFDeEMsb0JBQW9CLENBQWtCO0lBQ3RDLHFCQUFxQixDQUFrQjtJQUN2QyxlQUFlLENBQWtCO0lBRWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFFOUQsc0NBQXNDO1FBQ3RDLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEUsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLHFEQUFxRDtZQUNsRSxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxZQUFZLENBQUMsU0FBUztZQUMvQyxlQUFlLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsUUFBUTtZQUM3RCxlQUFlLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVO1lBQ2hELGNBQWMsRUFBRSxLQUFLLENBQUMsYUFB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WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWIvY29yZSc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XHJcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENvbXB1dGVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIHJlYWRvbmx5IGVudmlyb25tZW50TmFtZT86IHN0cmluZztcclxuICByZWFkb25seSB2cGM6IGVjMi5JVnBjO1xyXG4gIHJlYWRvbmx5IGF1cm9yYUNsdXN0ZXI6IHJkcy5JRGF0YWJhc2VDbHVzdGVyO1xyXG4gIHJlYWRvbmx5IGF1cm9yYVNlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcclxuICByZWFkb25seSBkb2N1bWVudEJ1Y2tldDogczMuSUJ1Y2tldDtcclxuICByZWFkb25seSBkb2N1bWVudFRhYmxlOiBkeW5hbW9kYi5JVGFibGU7XHJcbiAgcmVhZG9ubHkgbGxtQ29uZmlnVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcclxuICByZWFkb25seSBjbGF1ZGVBcGlLZXlTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XHJcbiAgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uSVVzZXJQb29sO1xyXG4gIHJlYWRvbmx5IHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLklVc2VyUG9vbENsaWVudDtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIENvbXB1dGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xyXG4gIHB1YmxpYyByZWFkb25seSBzdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBjb250ZW50QW5hbHl6ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBncmFtbWFyQ2hlY2tlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IG9yY2hlc3RyYXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGNsYXJpZmljYXRpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBzY29yaW5nRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IENvbXB1dGVTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBlbnZpcm9ubWVudE5hbWUgPSBwcm9wcy5lbnZpcm9ubWVudE5hbWUgfHwgJ3Byb2R1Y3Rpb24nO1xyXG5cclxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zXHJcbiAgICBjb25zdCBsYW1iZGFTRyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cCcsIHtcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIExhbWJkYSBmdW5jdGlvbnMgd2l0aCBWUEMgYWNjZXNzJyxcclxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbW1vbiBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzXHJcbiAgICBjb25zdCBjb21tb25FbnZpcm9ubWVudCA9IHtcclxuICAgICAgQVVST1JBX1NFQ1JFVF9BUk46IHByb3BzLmF1cm9yYVNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgIEFVUk9SQV9FTkRQT0lOVDogcHJvcHMuYXVyb3JhQ2x1c3Rlci5jbHVzdGVyRW5kcG9pbnQuaG9zdG5hbWUsXHJcbiAgICAgIERPQ1VNRU5UX0JVQ0tFVDogcHJvcHMuZG9jdW1lbnRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgRE9DVU1FTlRfVEFCTEU6IHByb3BzLmRvY3VtZW50VGFibGUudGFibGVOYW1lLFxyXG4gICAgICBMTE1fQ09ORklHX1RBQkxFOiBwcm9wcy5sbG1Db25maWdUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIENMQVVERV9BUElfS0VZX1NFQ1JFVDogcHJvcHMuY2xhdWRlQXBpS2V5U2VjcmV0LnNlY3JldEFybixcclxuICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcclxuICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50TmFtZSxcclxuICAgIH07XHJcblxyXG4gICAgLy8gQ29tbW9uIExhbWJkYSBsYXllciBmb3Igc2hhcmVkIGNvZGVcclxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBMYW1iZGEgbGF5ZXIgZm9yIHNoYXJlZCBjb2RlLi4uJyk7XHJcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcclxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogJ292ZXJsYXktY29tbW9uLWxheWVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvbGF5ZXJzL2NvbW1vbicpLFxyXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWF0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tbW9uIHV0aWxpdGllcywgZGF0YWJhc2UgY2xpZW50cywgYW5kIExMTSBhYnN0cmFjdGlvbiBsYXllcicsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQUkgQUdFTlQgTEFNQkRBIEZVTkNUSU9OU1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgQUkgYWdlbnQgTGFtYmRhIGZ1bmN0aW9ucy4uLicpO1xyXG5cclxuICAgIC8vIDEuIFN0cnVjdHVyZSBWYWxpZGF0b3IgKEJlZHJvY2sgSGFpa3UgLSBmYXN0IHZhbGlkYXRpb24pXHJcbiAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3RydWN0dXJlVmFsaWRhdG9yRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktc3RydWN0dXJlLXZhbGlkYXRvcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9zdHJ1Y3R1cmUtdmFsaWRhdG9yJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJywgLy8gQmVkcm9jayBIYWlrdVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZhbGlkYXRlcyBkb2N1bWVudCBzdHJ1Y3R1cmUgYW5kIGZvcm1hdCB1c2luZyBCZWRyb2NrIEhhaWt1JyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMi4gQ29udGVudCBBbmFseXplciAoQ2xhdWRlIFNvbm5ldCAtIGRldGFpbGVkIGFuYWx5c2lzKVxyXG4gICAgdGhpcy5jb250ZW50QW5hbHl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvbnRlbnRBbmFseXplckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWNvbnRlbnQtYW5hbHl6ZXInLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvY29udGVudC1hbmFseXplcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnY2xhdWRlLXNvbm5ldC00LTUtMjAyNTA5MjknLCAvLyBDbGF1ZGUgQVBJXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW5hbHl6ZXMgZG9jdW1lbnQgY29udGVudCBhZ2FpbnN0IGV2YWx1YXRpb24gY3JpdGVyaWEgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDMuIEdyYW1tYXIgQ2hlY2tlciAoQmVkcm9jayBIYWlrdSAtIGZhc3QgZ3JhbW1hciBjaGVjaylcclxuICAgIHRoaXMuZ3JhbW1hckNoZWNrZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dyYW1tYXJDaGVja2VyRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktZ3JhbW1hci1jaGVja2VyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL2dyYW1tYXItY2hlY2tlcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygyKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdhbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MCcsIC8vIEJlZHJvY2sgSGFpa3VcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDaGVja3MgZG9jdW1lbnQgZ3JhbW1hciBhbmQgd3JpdGluZyBxdWFsaXR5IHVzaW5nIEJlZHJvY2sgSGFpa3UnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA0LiBPcmNoZXN0cmF0b3IgKENsYXVkZSBTb25uZXQgLSB3b3JrZmxvdyBjb29yZGluYXRpb24pXHJcbiAgICB0aGlzLm9yY2hlc3RyYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnT3JjaGVzdHJhdG9yRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktb3JjaGVzdHJhdG9yJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL29yY2hlc3RyYXRvcicpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgdnBjOiBwcm9wcy52cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNHXSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIC4uLmNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICAgIE1PREVMX0lEOiAnY2xhdWRlLXNvbm5ldC00LTUtMjAyNTA5MjknLCAvLyBDbGF1ZGUgQVBJXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3JjaGVzdHJhdGVzIHRoZSA2LWFnZW50IEFJIHdvcmtmbG93IHVzaW5nIENsYXVkZSBTb25uZXQnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA1LiBDbGFyaWZpY2F0aW9uIChDbGF1ZGUgU29ubmV0IC0gaW50ZWxsaWdlbnQgUSZBKVxyXG4gICAgdGhpcy5jbGFyaWZpY2F0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDbGFyaWZpY2F0aW9uRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktY2xhcmlmaWNhdGlvbicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9jbGFyaWZpY2F0aW9uJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMpLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgLi4uY29tbW9uRW52aXJvbm1lbnQsXHJcbiAgICAgICAgTU9ERUxfSUQ6ICdjbGF1ZGUtc29ubmV0LTQtNS0yMDI1MDkyOScsIC8vIENsYXVkZSBBUElcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGNsYXJpZmljYXRpb24gcXVlc3Rpb25zIGR1cmluZyBkb2N1bWVudCByZXZpZXcgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDYuIFNjb3JpbmcgKENsYXVkZSBTb25uZXQgLSBmaW5hbCBzY29yaW5nKVxyXG4gICAgdGhpcy5zY29yaW5nRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTY29yaW5nRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktc2NvcmluZycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9zY29yaW5nJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBNT0RFTF9JRDogJ2NsYXVkZS1zb25uZXQtNC01LTIwMjUwOTI5JywgLy8gQ2xhdWRlIEFQSVxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NhbGN1bGF0ZXMgZmluYWwgc2NvcmVzIGFuZCBnZW5lcmF0ZXMgZmVlZGJhY2sgdXNpbmcgQ2xhdWRlIFNvbm5ldCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICAvLyBBUEkgTEFNQkRBIEZVTkNUSU9OU1xyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgQVBJIExhbWJkYSBmdW5jdGlvbnMuLi4nKTtcclxuXHJcbiAgICAvLyBBdXRoIEhhbmRsZXJcclxuICAgIGNvbnN0IGF1dGhIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aEhhbmRsZXInLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ292ZXJsYXktYXBpLWF1dGgnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL2F1dGgnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHByb3BzLnVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgVVNFUl9QT09MX0NMSUVOVF9JRDogcHJvcHMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIGF1dGhlbnRpY2F0aW9uIGVuZHBvaW50cyAobG9naW4sIHJlZ2lzdGVyLCByZWZyZXNoKScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE92ZXJsYXlzIEhhbmRsZXJcclxuICAgIGNvbnN0IG92ZXJsYXlzSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ092ZXJsYXlzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktb3ZlcmxheXMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL292ZXJsYXlzJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB2cGM6IHByb3BzLnZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXHJcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbGFtYmRhU0ddLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgZGVzY3JpcHRpb246ICdIYW5kbGVzIG92ZXJsYXkgQ1JVRCBvcGVyYXRpb25zJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2Vzc2lvbnMgSGFuZGxlclxyXG4gICAgY29uc3Qgc2Vzc2lvbnNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2Vzc2lvbnNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1zZXNzaW9ucycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvc2Vzc2lvbnMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgZG9jdW1lbnQgcmV2aWV3IHNlc3Npb24gbWFuYWdlbWVudCcsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEltcG9ydCBTdGF0ZSBNYWNoaW5lIEFSTiBmcm9tIE9yY2hlc3RyYXRpb24gU3RhY2tcclxuICAgIGNvbnN0IHN0YXRlTWFjaGluZUFybiA9IGNkay5Gbi5pbXBvcnRWYWx1ZSgnT3ZlcmxheVN0YXRlTWFjaGluZUFybicpO1xyXG5cclxuICAgIC8vIFN1Ym1pc3Npb25zIEhhbmRsZXJcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25zSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N1Ym1pc3Npb25zSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hcGktc3VibWlzc2lvbnMnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9mdW5jdGlvbnMvYXBpL3N1Ym1pc3Npb25zJyksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEpLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBXT1JLRkxPV19TVEFURV9NQUNISU5FX0FSTjogc3RhdGVNYWNoaW5lQXJuLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgZG9jdW1lbnQgc3VibWlzc2lvbiB1cGxvYWRzIGFuZCBwcm9jZXNzaW5nJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUXVlcnkgUmVzdWx0cyBIYW5kbGVyXHJcbiAgICBjb25zdCBxdWVyeVJlc3VsdHNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUXVlcnlSZXN1bHRzSGFuZGxlcicsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1xdWVyeS1yZXN1bHRzJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvZnVuY3Rpb25zL3F1ZXJ5LXJlc3VsdHMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAuLi5jb21tb25FbnZpcm9ubWVudCxcclxuICAgICAgICBBVVJPUkFfU0VDUkVUX0FSTjogcHJvcHMuYXVyb3JhU2VjcmV0LnNlY3JldEFybixcclxuICAgICAgfSxcclxuICAgICAgZGVzY3JpcHRpb246ICdRdWVyaWVzIEF1cm9yYSBkYXRhYmFzZSBmb3IgZG9jdW1lbnQgcHJvY2Vzc2luZyByZXN1bHRzJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTm90ZXMgSGFuZGxlclxyXG4gICAgY29uc3Qgbm90ZXNIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTm90ZXNIYW5kbGVyJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWFwaS1ub3RlcycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9hcGkvbm90ZXMnKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXHJcbiAgICAgIHZwYzogcHJvcHMudnBjLFxyXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MgfSxcclxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTR10sXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudmlyb25tZW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgdXNlciBub3RlcyBDUlVEIG9wZXJhdGlvbnMnLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gSUFNIFBFUk1JU1NJT05TXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdDb25maWd1cmluZyBJQU0gcGVybWlzc2lvbnMuLi4nKTtcclxuXHJcbiAgICBjb25zdCBhbGxMYW1iZGFzID0gW1xyXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbixcclxuICAgICAgYXV0aEhhbmRsZXIsXHJcbiAgICAgIG92ZXJsYXlzSGFuZGxlcixcclxuICAgICAgc2Vzc2lvbnNIYW5kbGVyLFxyXG4gICAgICBzdWJtaXNzaW9uc0hhbmRsZXIsXHJcbiAgICAgIHF1ZXJ5UmVzdWx0c0hhbmRsZXIsXHJcbiAgICAgIG5vdGVzSGFuZGxlcixcclxuICAgIF07XHJcblxyXG4gICAgLy8gR3JhbnQgYWxsIExhbWJkYXMgYWNjZXNzIHRvIHNlY3JldHNcclxuICAgIGFsbExhbWJkYXMuZm9yRWFjaChmbiA9PiB7XHJcbiAgICAgIHByb3BzLmF1cm9yYVNlY3JldC5ncmFudFJlYWQoZm4pO1xyXG4gICAgICBwcm9wcy5jbGF1ZGVBcGlLZXlTZWNyZXQuZ3JhbnRSZWFkKGZuKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IER5bmFtb0RCIGFjY2Vzc1xyXG4gICAgYWxsTGFtYmRhcy5mb3JFYWNoKGZuID0+IHtcclxuICAgICAgcHJvcHMuZG9jdW1lbnRUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZm4pO1xyXG4gICAgICBwcm9wcy5sbG1Db25maWdUYWJsZS5ncmFudFJlYWREYXRhKGZuKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IFMzIGFjY2Vzc1xyXG4gICAgYWxsTGFtYmRhcy5mb3JFYWNoKGZuID0+IHtcclxuICAgICAgcHJvcHMuZG9jdW1lbnRCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZm4pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgc3VibWlzc2lvbnMgaGFuZGxlciBwZXJtaXNzaW9uIHRvIHN0YXJ0IFN0ZXAgRnVuY3Rpb25zIGV4ZWN1dGlvbnNcclxuICAgIHN1Ym1pc3Npb25zSGFuZGxlci5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBhY3Rpb25zOiBbJ3N0YXRlczpTdGFydEV4ZWN1dGlvbiddLFxyXG4gICAgICByZXNvdXJjZXM6IFtzdGF0ZU1hY2hpbmVBcm5dLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIEdyYW50IEJlZHJvY2sgYWNjZXNzIHRvIEFJIGZ1bmN0aW9uc1xyXG4gICAgY29uc3QgYmVkcm9ja1BvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcclxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvKmBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgW1xyXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmNvbnRlbnRBbmFseXplckZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLmdyYW1tYXJDaGVja2VyRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMub3JjaGVzdHJhdG9yRnVuY3Rpb24sXHJcbiAgICAgIHRoaXMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxyXG4gICAgICB0aGlzLnNjb3JpbmdGdW5jdGlvbixcclxuICAgIF0uZm9yRWFjaChmbiA9PiBmbi5hZGRUb1JvbGVQb2xpY3koYmVkcm9ja1BvbGljeSkpO1xyXG5cclxuICAgIC8vIEdyYW50IENvZ25pdG8gYWNjZXNzIHRvIGF1dGggaGFuZGxlclxyXG4gICAgYXV0aEhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkluaXRpYXRlQXV0aCcsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsXHJcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluU2V0VXNlclBhc3N3b3JkJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcclxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlcycsXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlc291cmNlczogW3Byb3BzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgLy8gQVBJIEdBVEVXQVlcclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIEFQSSBHYXRld2F5IFJFU1QgQVBJLi4uJyk7XHJcblxyXG4gICAgLy8gTGFtYmRhIEF1dGhvcml6ZXIgZm9yIEpXVCB2YWxpZGF0aW9uXHJcbiAgICBjb25zdCBhdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0NvZ25pdG9BdXRob3JpemVyJywge1xyXG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbcHJvcHMudXNlclBvb2xdLFxyXG4gICAgICBhdXRob3JpemVyTmFtZTogJ292ZXJsYXktY29nbml0by1hdXRob3JpemVyJyxcclxuICAgICAgaWRlbnRpdHlTb3VyY2U6ICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvbicsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBSRVNUIEFQSVxyXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdPdmVybGF5QXBpJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ292ZXJsYXktcGxhdGZvcm0tYXBpJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdPdmVybGF5IFBsYXRmb3JtIFJFU1QgQVBJJyxcclxuICAgICAgZGVwbG95T3B0aW9uczoge1xyXG4gICAgICAgIHN0YWdlTmFtZTogZW52aXJvbm1lbnROYW1lLFxyXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcclxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxyXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxyXG4gICAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUywgLy8gVXBkYXRlIGluIHByb2R1Y3Rpb25cclxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxyXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxyXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxyXG4gICAgICAgICAgJ1gtQXBpLUtleScsXHJcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXHJcbiAgICAgIH0sXHJcbiAgICAgIGNsb3VkV2F0Y2hSb2xlOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIFJlc291cmNlcyBhbmQgTWV0aG9kc1xyXG4gICAgY29uc3QgYXV0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYXV0aCcpO1xyXG4gICAgYXV0aFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGF1dGhIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5OT05FLCAvLyBQdWJsaWMgZW5kcG9pbnRcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG92ZXJsYXlzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdvdmVybGF5cycpO1xyXG4gICAgb3ZlcmxheXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgb3ZlcmxheXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBvdmVybGF5SWRSZXNvdXJjZSA9IG92ZXJsYXlzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tvdmVybGF5SWR9Jyk7XHJcbiAgICBvdmVybGF5SWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG92ZXJsYXlzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgb3ZlcmxheUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihvdmVybGF5c0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG92ZXJsYXlJZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ob3ZlcmxheXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2Vzc2lvbnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Nlc3Npb25zJyk7XHJcbiAgICBzZXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzZXNzaW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zZXNzaW9ucy9hdmFpbGFibGVcclxuICAgIGNvbnN0IHNlc3Npb25zQXZhaWxhYmxlUmVzb3VyY2UgPSBzZXNzaW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCdhdmFpbGFibGUnKTtcclxuICAgIHNlc3Npb25zQXZhaWxhYmxlUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzZXNzaW9uSWRSZXNvdXJjZSA9IHNlc3Npb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tzZXNzaW9uSWR9Jyk7XHJcbiAgICBzZXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHNlc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgc2Vzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHNlc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2Vzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3Nlc3Npb25zL3tzZXNzaW9uSWR9L3N1Ym1pc3Npb25zXHJcbiAgICBjb25zdCBzZXNzaW9uU3VibWlzc2lvbnNSZXNvdXJjZSA9IHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdzdWJtaXNzaW9ucycpO1xyXG4gICAgc2Vzc2lvblN1Ym1pc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vcmVwb3J0XHJcbiAgICBjb25zdCBzZXNzaW9uUmVwb3J0UmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVwb3J0Jyk7XHJcbiAgICBzZXNzaW9uUmVwb3J0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc2Vzc2lvbnMve3Nlc3Npb25JZH0vZXhwb3J0XHJcbiAgICBjb25zdCBzZXNzaW9uRXhwb3J0UmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZXhwb3J0Jyk7XHJcbiAgICBzZXNzaW9uRXhwb3J0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzZXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnc3VibWlzc2lvbnMnKTtcclxuICAgIHN1Ym1pc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHN1Ym1pc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc3VibWlzc2lvbklkUmVzb3VyY2UgPSBzdWJtaXNzaW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7c3VibWlzc2lvbklkfScpO1xyXG4gICAgc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiAgICBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9zdWJtaXNzaW9ucy97c3VibWlzc2lvbklkfS9mZWVkYmFja1xyXG4gICAgY29uc3Qgc3VibWlzc2lvbkZlZWRiYWNrUmVzb3VyY2UgPSBzdWJtaXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZmVlZGJhY2snKTtcclxuICAgIHN1Ym1pc3Npb25GZWVkYmFja1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3VibWlzc2lvbnNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1Ym1pc3Npb25zL3tzdWJtaXNzaW9uSWR9L2Rvd25sb2FkXHJcbiAgICBjb25zdCBzdWJtaXNzaW9uRG93bmxvYWRSZXNvdXJjZSA9IHN1Ym1pc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdkb3dubG9hZCcpO1xyXG4gICAgc3VibWlzc2lvbkRvd25sb2FkUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXNzaW9uc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvc3VibWlzc2lvbnMve3N1Ym1pc3Npb25JZH0vYW5hbHlzaXNcclxuICAgIGNvbnN0IHN1Ym1pc3Npb25BbmFseXNpc1Jlc291cmNlID0gc3VibWlzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FuYWx5c2lzJyk7XHJcbiAgICBzdWJtaXNzaW9uQW5hbHlzaXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pc3Npb25zSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG5vdGVzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdub3RlcycpO1xyXG4gICAgbm90ZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgbm90ZXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBub3RlSWRSZXNvdXJjZSA9IG5vdGVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tub3RlSWR9Jyk7XHJcbiAgICBub3RlSWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG5vdGVzSGFuZGxlciksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gICAgbm90ZUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihub3Rlc0hhbmRsZXIpLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuICAgIG5vdGVJZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obm90ZXNIYW5kbGVyKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUVuZHBvaW50Jywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGVuZHBvaW50IFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5QXBpRW5kcG9pbnQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUlkJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkucmVzdEFwaUlkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFJFU1QgQVBJIElEJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlBcGlJZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBUYWdzXHJcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnROYW1lKTtcclxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdPdmVybGF5Jyk7XHJcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrJywgJ0NvbXB1dGUnKTtcclxuICB9XHJcbn1cclxuIl19