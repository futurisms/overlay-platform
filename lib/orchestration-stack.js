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
exports.OrchestrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib/core"));
const stepfunctions = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class OrchestrationStack extends cdk.Stack {
    documentAnalysisStateMachine;
    processingQueue;
    deadLetterQueue;
    constructor(scope, id, props) {
        super(scope, id, props);
        const environmentName = props.environmentName || 'production';
        // ==========================================================================
        // SQS QUEUES
        // ==========================================================================
        console.log('Creating SQS queues for async processing...');
        // Dead Letter Queue
        this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
            queueName: 'overlay-processing-dlq',
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.KMS_MANAGED,
        });
        // Main Processing Queue
        this.processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
            queueName: 'overlay-processing-queue',
            visibilityTimeout: cdk.Duration.minutes(15), // Match Step Functions timeout
            retentionPeriod: cdk.Duration.days(7),
            encryption: sqs.QueueEncryption.KMS_MANAGED,
            deadLetterQueue: {
                queue: this.deadLetterQueue,
                maxReceiveCount: 3, // Retry 3 times before moving to DLQ
            },
        });
        // ==========================================================================
        // STEP FUNCTIONS STATE MACHINE
        // ==========================================================================
        console.log('Creating Step Functions state machine for 6-agent workflow...');
        // Define the 6-agent workflow
        // IMPORTANT: Using resultPath instead of outputPath to preserve original input (s3Key, s3Bucket, overlayId, etc.)
        const structureValidation = new tasks.LambdaInvoke(this, 'StructureValidation', {
            lambdaFunction: props.structureValidatorFunction,
            resultPath: '$.structureValidationResult',
            outputPath: '$', // Keep entire state
            retryOnServiceExceptions: true,
            payload: stepfunctions.TaskInput.fromObject({
                documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
                submissionId: stepfunctions.JsonPath.stringAt('$.submissionId'),
                s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
                s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
                overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
            }),
        });
        const contentAnalysis = new tasks.LambdaInvoke(this, 'ContentAnalysis', {
            lambdaFunction: props.contentAnalyzerFunction,
            resultPath: '$.contentAnalysisResult',
            outputPath: '$', // Keep entire state
            retryOnServiceExceptions: true,
            payload: stepfunctions.TaskInput.fromObject({
                documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
                submissionId: stepfunctions.JsonPath.stringAt('$.structureValidationResult.Payload.submissionId'),
                s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
                s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
                overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
                structureValidation: stepfunctions.JsonPath.objectAt('$.structureValidationResult.Payload.structureValidation'),
            }),
        });
        const grammarCheck = new tasks.LambdaInvoke(this, 'GrammarCheck', {
            lambdaFunction: props.grammarCheckerFunction,
            resultPath: '$.grammarCheckResult',
            outputPath: '$', // Keep entire state
            retryOnServiceExceptions: true,
            payload: stepfunctions.TaskInput.fromObject({
                documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
                submissionId: stepfunctions.JsonPath.stringAt('$.structureValidationResult.Payload.submissionId'),
                s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
                s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
                overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
                structureValidation: stepfunctions.JsonPath.objectAt('$.structureValidationResult.Payload.structureValidation'),
                contentAnalysis: stepfunctions.JsonPath.objectAt('$.contentAnalysisResult.Payload.contentAnalysis'),
            }),
        });
        const orchestration = new tasks.LambdaInvoke(this, 'Orchestration', {
            lambdaFunction: props.orchestratorFunction,
            resultPath: '$.orchestrationResult',
            outputPath: '$', // Keep entire state
            retryOnServiceExceptions: true,
            payload: stepfunctions.TaskInput.fromObject({
                documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
                submissionId: stepfunctions.JsonPath.stringAt('$.structureValidationResult.Payload.submissionId'),
                s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
                s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
                overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
                structureValidation: stepfunctions.JsonPath.objectAt('$.structureValidationResult.Payload.structureValidation'),
                contentAnalysis: stepfunctions.JsonPath.objectAt('$.contentAnalysisResult.Payload.contentAnalysis'),
                grammarCheck: stepfunctions.JsonPath.objectAt('$.grammarCheckResult.Payload.grammarCheck'),
            }),
        });
        // Clarification step (always runs, but may skip if not needed)
        const clarification = new tasks.LambdaInvoke(this, 'Clarification', {
            lambdaFunction: props.clarificationFunction,
            resultPath: '$.clarificationResult',
            outputPath: '$', // Keep entire state
            retryOnServiceExceptions: true,
            payload: stepfunctions.TaskInput.fromObject({
                documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
                submissionId: stepfunctions.JsonPath.stringAt('$.structureValidationResult.Payload.submissionId'),
                s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
                s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
                overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
                structureValidation: stepfunctions.JsonPath.objectAt('$.structureValidationResult.Payload.structureValidation'),
                contentAnalysis: stepfunctions.JsonPath.objectAt('$.contentAnalysisResult.Payload.contentAnalysis'),
                grammarCheck: stepfunctions.JsonPath.objectAt('$.grammarCheckResult.Payload.grammarCheck'),
                orchestration: stepfunctions.JsonPath.objectAt('$.orchestrationResult.Payload.orchestration'),
            }),
        });
        const scoring = new tasks.LambdaInvoke(this, 'Scoring', {
            lambdaFunction: props.scoringFunction,
            resultPath: '$.scoringResult',
            outputPath: '$', // Keep entire state
            retryOnServiceExceptions: true,
            payload: stepfunctions.TaskInput.fromObject({
                documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
                submissionId: stepfunctions.JsonPath.stringAt('$.structureValidationResult.Payload.submissionId'),
                s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
                s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
                overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
                structureValidation: stepfunctions.JsonPath.objectAt('$.structureValidationResult.Payload.structureValidation'),
                contentAnalysis: stepfunctions.JsonPath.objectAt('$.contentAnalysisResult.Payload.contentAnalysis'),
                grammarCheck: stepfunctions.JsonPath.objectAt('$.grammarCheckResult.Payload.grammarCheck'),
                orchestration: stepfunctions.JsonPath.objectAt('$.orchestrationResult.Payload.orchestration'),
                clarification: stepfunctions.JsonPath.objectAt('$.clarificationResult.Payload.clarification'),
            }),
        });
        // Success state
        const success = new stepfunctions.Succeed(this, 'AnalysisComplete', {
            comment: 'Document analysis completed successfully',
        });
        // Failure state
        const failure = new stepfunctions.Fail(this, 'AnalysisFailed', {
            cause: 'Document analysis failed',
            error: 'ANALYSIS_ERROR',
        });
        // Build workflow chains
        const parallelStep = new stepfunctions.Parallel(this, 'ParallelAnalysis', {
            resultPath: '$.parallelResults',
        }).branch(grammarCheck);
        parallelStep.addCatch(failure, {
            errors: ['States.ALL'],
            resultPath: '$.error',
        });
        // Connect grammar check to orchestration
        grammarCheck.next(orchestration);
        // Connect states with clarification
        orchestration.next(clarification);
        clarification.next(scoring);
        scoring.next(success);
        // Connect states (no validation check for now - Lambda functions have placeholder code)
        // TODO: Add validation checks when Lambda functions have full implementation
        structureValidation.next(contentAnalysis);
        contentAnalysis.next(parallelStep);
        const definition = structureValidation;
        // Create State Machine
        this.documentAnalysisStateMachine = new stepfunctions.StateMachine(this, 'DocumentAnalysisStateMachine', {
            stateMachineName: 'overlay-document-analysis',
            definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
            timeout: cdk.Duration.minutes(15),
            tracingEnabled: true,
            logs: {
                destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
                    logGroupName: '/aws/stepfunctions/overlay-document-analysis',
                    retention: logs.RetentionDays.ONE_MONTH,
                    removalPolicy: cdk.RemovalPolicy.DESTROY,
                }),
                level: stepfunctions.LogLevel.ALL,
                includeExecutionData: true,
            },
        });
        // ==========================================================================
        // S3 EVENT TRIGGER
        // ==========================================================================
        console.log('Creating S3 event trigger for document uploads...');
        // Lambda to start Step Functions execution on S3 upload
        const s3TriggerFunction = new lambda.Function(this, 'S3TriggerFunction', {
            functionName: 'overlay-s3-trigger',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
        const sfn = new SFNClient();

        exports.handler = async (event) => {
          console.log('S3 event received:', JSON.stringify(event));

          for (const record of event.Records) {
            const bucket = record.s3.bucket.name;
            const key = decodeURIComponent(record.s3.object.key.replace(/\\+/g, ' '));

            // Only process uploads to submissions/ folder
            if (!key.startsWith('submissions/')) {
              console.log('Skipping non-submission file:', key);
              continue;
            }

            // Extract metadata from S3 object key
            // Expected format: submissions/{documentId}/{filename}
            const parts = key.split('/');
            const documentId = parts[1];

            // TODO: Query overlayId from database based on user/organization
            // For now, use default overlay ID from environment or first demo overlay
            const overlayId = process.env.DEFAULT_OVERLAY_ID || '20000000-0000-0000-0000-000000000001';

            // Start Step Functions execution
            const input = {
              documentId,
              submissionId: documentId, // Pass submissionId (same as documentId)
              s3Bucket: bucket,
              s3Key: key,
              overlayId,
              uploadedAt: new Date().toISOString(),
            };

            const command = new StartExecutionCommand({
              stateMachineArn: process.env.STATE_MACHINE_ARN,
              input: JSON.stringify(input),
              name: \`doc-\${documentId}-\${Date.now()}\`,
            });

            try {
              const result = await sfn.send(command);
              console.log('Started execution:', result.executionArn);
            } catch (error) {
              console.error('Failed to start execution:', error);
              throw error;
            }
          }

          return { statusCode: 200, body: 'Processing started' };
        };
      `),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                STATE_MACHINE_ARN: this.documentAnalysisStateMachine.stateMachineArn,
                DEFAULT_OVERLAY_ID: '20000000-0000-0000-0000-000000000001', // Demo overlay: Contract Review
            },
            description: 'Triggers Step Functions workflow on S3 document upload',
            logRetention: logs.RetentionDays.ONE_MONTH,
        });
        // Grant permissions
        this.documentAnalysisStateMachine.grantStartExecution(s3TriggerFunction);
        props.documentBucket.grantRead(s3TriggerFunction);
        // NOTE: S3 notification cannot be added here due to circular dependency
        // (Storage Stack -> Orchestration Stack -> S3 Trigger Lambda ARN -> Storage Stack)
        //
        // To add S3 trigger after deployment, run:
        // aws s3api put-bucket-notification-configuration \
        //   --bucket overlay-docs-{ACCOUNT_ID} \
        //   --notification-configuration '{
        //     "LambdaFunctionConfigurations": [{
        //       "LambdaFunctionArn": "{S3_TRIGGER_FUNCTION_ARN}",
        //       "Events": ["s3:ObjectCreated:*"],
        //       "Filter": {"Key": {"FilterRules": [{"Name": "prefix", "Value": "submissions/"}]}}
        //     }]
        //   }'
        //
        // Or use the AWS Console: S3 -> Bucket -> Properties -> Event Notifications
        // Export S3 trigger function ARN for manual configuration
        new cdk.CfnOutput(this, 'S3TriggerFunctionArn', {
            value: s3TriggerFunction.functionArn,
            description: 'S3 trigger Lambda function ARN (configure S3 notification manually)',
            exportName: 'OverlayS3TriggerFunctionArn',
        });
        // ==========================================================================
        // EVENTBRIDGE RULES
        // ==========================================================================
        console.log('Creating EventBridge rules...');
        // Rule for failed executions
        const failedExecutionRule = new events.Rule(this, 'FailedExecutionRule', {
            ruleName: 'overlay-analysis-failed',
            description: 'Triggers when document analysis fails',
            eventPattern: {
                source: ['aws.states'],
                detailType: ['Step Functions Execution Status Change'],
                detail: {
                    status: ['FAILED', 'TIMED_OUT', 'ABORTED'],
                    stateMachineArn: [this.documentAnalysisStateMachine.stateMachineArn],
                },
            },
        });
        // Send failed executions to SQS for retry
        failedExecutionRule.addTarget(new targets.SqsQueue(this.processingQueue));
        // Rule for successful executions
        const successExecutionRule = new events.Rule(this, 'SuccessExecutionRule', {
            ruleName: 'overlay-analysis-success',
            description: 'Triggers when document analysis succeeds',
            eventPattern: {
                source: ['aws.states'],
                detailType: ['Step Functions Execution Status Change'],
                detail: {
                    status: ['SUCCEEDED'],
                    stateMachineArn: [this.documentAnalysisStateMachine.stateMachineArn],
                },
            },
        });
        // Lambda to handle successful analysis
        const successHandlerFunction = new lambda.Function(this, 'SuccessHandlerFunction', {
            functionName: 'overlay-analysis-success-handler',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Analysis completed successfully:', JSON.stringify(event));
          // TODO: Update database, send notifications, etc.
          return { statusCode: 200 };
        };
      `),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            description: 'Handles successful document analysis completion',
            logRetention: logs.RetentionDays.ONE_MONTH,
        });
        successExecutionRule.addTarget(new targets.LambdaFunction(successHandlerFunction));
        // CloudFormation Outputs
        new cdk.CfnOutput(this, 'StateMachineArn', {
            value: this.documentAnalysisStateMachine.stateMachineArn,
            description: 'Document analysis state machine ARN',
            exportName: 'OverlayStateMachineArn',
        });
        new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
            value: this.processingQueue.queueUrl,
            description: 'Processing queue URL',
            exportName: 'OverlayProcessingQueueUrl',
        });
        new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
            value: this.deadLetterQueue.queueUrl,
            description: 'Dead letter queue URL',
            exportName: 'OverlayDeadLetterQueueUrl',
        });
        // Tags
        cdk.Tags.of(this).add('Environment', environmentName);
        cdk.Tags.of(this).add('Project', 'Overlay');
        cdk.Tags.of(this).add('Stack', 'Orchestration');
    }
}
exports.OrchestrationStack = OrchestrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JjaGVzdHJhdGlvbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9yY2hlc3RyYXRpb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLDZFQUErRDtBQUMvRCwyRUFBNkQ7QUFDN0QsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQseURBQTJDO0FBRzNDLDJEQUE2QztBQWE3QyxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQy9CLDRCQUE0QixDQUE2QjtJQUN6RCxlQUFlLENBQVk7SUFDM0IsZUFBZSxDQUFZO0lBRTNDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBOEI7UUFDdEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFFOUQsNkVBQTZFO1FBQzdFLGFBQWE7UUFDYiw2RUFBNkU7UUFFN0UsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO1FBRTNELG9CQUFvQjtRQUNwQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDNUQsU0FBUyxFQUFFLHdCQUF3QjtZQUNuQyxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3RDLFVBQVUsRUFBRSxHQUFHLENBQUMsZUFBZSxDQUFDLFdBQVc7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUM1RCxTQUFTLEVBQUUsMEJBQTBCO1lB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QUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBM1hELGdEQTJYQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYi9jb3JlJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgc3RlcGZ1bmN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgKiBhcyB0YXNrcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgczNub3RpZmljYXRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1ub3RpZmljYXRpb25zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9yY2hlc3RyYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudE5hbWU/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGRvY3VtZW50QnVja2V0OiBzMy5JQnVja2V0O1xuICByZWFkb25seSBzdHJ1Y3R1cmVWYWxpZGF0b3JGdW5jdGlvbjogbGFtYmRhLklGdW5jdGlvbjtcbiAgcmVhZG9ubHkgY29udGVudEFuYWx5emVyRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb247XG4gIHJlYWRvbmx5IGdyYW1tYXJDaGVja2VyRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb247XG4gIHJlYWRvbmx5IG9yY2hlc3RyYXRvckZ1bmN0aW9uOiBsYW1iZGEuSUZ1bmN0aW9uO1xuICByZWFkb25seSBjbGFyaWZpY2F0aW9uRnVuY3Rpb246IGxhbWJkYS5JRnVuY3Rpb247XG4gIHJlYWRvbmx5IHNjb3JpbmdGdW5jdGlvbjogbGFtYmRhLklGdW5jdGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIE9yY2hlc3RyYXRpb25TdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBkb2N1bWVudEFuYWx5c2lzU3RhdGVNYWNoaW5lOiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZTtcbiAgcHVibGljIHJlYWRvbmx5IHByb2Nlc3NpbmdRdWV1ZTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgZGVhZExldHRlclF1ZXVlOiBzcXMuUXVldWU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE9yY2hlc3RyYXRpb25TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBlbnZpcm9ubWVudE5hbWUgPSBwcm9wcy5lbnZpcm9ubWVudE5hbWUgfHwgJ3Byb2R1Y3Rpb24nO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTUVMgUVVFVUVTXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBTUVMgcXVldWVzIGZvciBhc3luYyBwcm9jZXNzaW5nLi4uJyk7XG5cbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZVxuICAgIHRoaXMuZGVhZExldHRlclF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnRGVhZExldHRlclF1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiAnb3ZlcmxheS1wcm9jZXNzaW5nLWRscScsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgIGVuY3J5cHRpb246IHNxcy5RdWV1ZUVuY3J5cHRpb24uS01TX01BTkFHRUQsXG4gICAgfSk7XG5cbiAgICAvLyBNYWluIFByb2Nlc3NpbmcgUXVldWVcbiAgICB0aGlzLnByb2Nlc3NpbmdRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1Byb2Nlc3NpbmdRdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogJ292ZXJsYXktcHJvY2Vzc2luZy1xdWV1ZScsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLCAvLyBNYXRjaCBTdGVwIEZ1bmN0aW9ucyB0aW1lb3V0XG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5LTVNfTUFOQUdFRCxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogdGhpcy5kZWFkTGV0dGVyUXVldWUsXG4gICAgICAgIG1heFJlY2VpdmVDb3VudDogMywgLy8gUmV0cnkgMyB0aW1lcyBiZWZvcmUgbW92aW5nIHRvIERMUVxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU1RFUCBGVU5DVElPTlMgU1RBVEUgTUFDSElORVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBmb3IgNi1hZ2VudCB3b3JrZmxvdy4uLicpO1xuXG4gICAgLy8gRGVmaW5lIHRoZSA2LWFnZW50IHdvcmtmbG93XG4gICAgLy8gSU1QT1JUQU5UOiBVc2luZyByZXN1bHRQYXRoIGluc3RlYWQgb2Ygb3V0cHV0UGF0aCB0byBwcmVzZXJ2ZSBvcmlnaW5hbCBpbnB1dCAoczNLZXksIHMzQnVja2V0LCBvdmVybGF5SWQsIGV0Yy4pXG4gICAgY29uc3Qgc3RydWN0dXJlVmFsaWRhdGlvbiA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ1N0cnVjdHVyZVZhbGlkYXRpb24nLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogcHJvcHMuc3RydWN0dXJlVmFsaWRhdG9yRnVuY3Rpb24sXG4gICAgICByZXN1bHRQYXRoOiAnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0JyxcbiAgICAgIG91dHB1dFBhdGg6ICckJywgLy8gS2VlcCBlbnRpcmUgc3RhdGVcbiAgICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogdHJ1ZSxcbiAgICAgIHBheWxvYWQ6IHN0ZXBmdW5jdGlvbnMuVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICBkb2N1bWVudElkOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLmRvY3VtZW50SWQnKSxcbiAgICAgICAgc3VibWlzc2lvbklkOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnN1Ym1pc3Npb25JZCcpLFxuICAgICAgICBzM0tleTogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5zM0tleScpLFxuICAgICAgICBzM0J1Y2tldDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5zM0J1Y2tldCcpLFxuICAgICAgICBvdmVybGF5SWQ6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGguc3RyaW5nQXQoJyQub3ZlcmxheUlkJyksXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnRlbnRBbmFseXNpcyA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0NvbnRlbnRBbmFseXNpcycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBwcm9wcy5jb250ZW50QW5hbHl6ZXJGdW5jdGlvbixcbiAgICAgIHJlc3VsdFBhdGg6ICckLmNvbnRlbnRBbmFseXNpc1Jlc3VsdCcsXG4gICAgICBvdXRwdXRQYXRoOiAnJCcsIC8vIEtlZXAgZW50aXJlIHN0YXRlXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgICBwYXlsb2FkOiBzdGVwZnVuY3Rpb25zLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgZG9jdW1lbnRJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5kb2N1bWVudElkJyksXG4gICAgICAgIHN1Ym1pc3Npb25JZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3VibWlzc2lvbklkJyksXG4gICAgICAgIHMzS2V5OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzS2V5JyksXG4gICAgICAgIHMzQnVja2V0OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzQnVja2V0JyksXG4gICAgICAgIG92ZXJsYXlJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5vdmVybGF5SWQnKSxcbiAgICAgICAgc3RydWN0dXJlVmFsaWRhdGlvbjogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3RydWN0dXJlVmFsaWRhdGlvbicpLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBncmFtbWFyQ2hlY2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdHcmFtbWFyQ2hlY2snLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogcHJvcHMuZ3JhbW1hckNoZWNrZXJGdW5jdGlvbixcbiAgICAgIHJlc3VsdFBhdGg6ICckLmdyYW1tYXJDaGVja1Jlc3VsdCcsXG4gICAgICBvdXRwdXRQYXRoOiAnJCcsIC8vIEtlZXAgZW50aXJlIHN0YXRlXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgICBwYXlsb2FkOiBzdGVwZnVuY3Rpb25zLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgZG9jdW1lbnRJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5kb2N1bWVudElkJyksXG4gICAgICAgIHN1Ym1pc3Npb25JZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3VibWlzc2lvbklkJyksXG4gICAgICAgIHMzS2V5OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzS2V5JyksXG4gICAgICAgIHMzQnVja2V0OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzQnVja2V0JyksXG4gICAgICAgIG92ZXJsYXlJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5vdmVybGF5SWQnKSxcbiAgICAgICAgc3RydWN0dXJlVmFsaWRhdGlvbjogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3RydWN0dXJlVmFsaWRhdGlvbicpLFxuICAgICAgICBjb250ZW50QW5hbHlzaXM6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGgub2JqZWN0QXQoJyQuY29udGVudEFuYWx5c2lzUmVzdWx0LlBheWxvYWQuY29udGVudEFuYWx5c2lzJyksXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IG9yY2hlc3RyYXRpb24gPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdPcmNoZXN0cmF0aW9uJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHByb3BzLm9yY2hlc3RyYXRvckZ1bmN0aW9uLFxuICAgICAgcmVzdWx0UGF0aDogJyQub3JjaGVzdHJhdGlvblJlc3VsdCcsXG4gICAgICBvdXRwdXRQYXRoOiAnJCcsIC8vIEtlZXAgZW50aXJlIHN0YXRlXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgICBwYXlsb2FkOiBzdGVwZnVuY3Rpb25zLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgZG9jdW1lbnRJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5kb2N1bWVudElkJyksXG4gICAgICAgIHN1Ym1pc3Npb25JZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3VibWlzc2lvbklkJyksXG4gICAgICAgIHMzS2V5OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzS2V5JyksXG4gICAgICAgIHMzQnVja2V0OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzQnVja2V0JyksXG4gICAgICAgIG92ZXJsYXlJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5vdmVybGF5SWQnKSxcbiAgICAgICAgc3RydWN0dXJlVmFsaWRhdGlvbjogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3RydWN0dXJlVmFsaWRhdGlvbicpLFxuICAgICAgICBjb250ZW50QW5hbHlzaXM6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGgub2JqZWN0QXQoJyQuY29udGVudEFuYWx5c2lzUmVzdWx0LlBheWxvYWQuY29udGVudEFuYWx5c2lzJyksXG4gICAgICAgIGdyYW1tYXJDaGVjazogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5ncmFtbWFyQ2hlY2tSZXN1bHQuUGF5bG9hZC5ncmFtbWFyQ2hlY2snKSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xhcmlmaWNhdGlvbiBzdGVwIChhbHdheXMgcnVucywgYnV0IG1heSBza2lwIGlmIG5vdCBuZWVkZWQpXG4gICAgY29uc3QgY2xhcmlmaWNhdGlvbiA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0NsYXJpZmljYXRpb24nLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogcHJvcHMuY2xhcmlmaWNhdGlvbkZ1bmN0aW9uLFxuICAgICAgcmVzdWx0UGF0aDogJyQuY2xhcmlmaWNhdGlvblJlc3VsdCcsXG4gICAgICBvdXRwdXRQYXRoOiAnJCcsIC8vIEtlZXAgZW50aXJlIHN0YXRlXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgICBwYXlsb2FkOiBzdGVwZnVuY3Rpb25zLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgZG9jdW1lbnRJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5kb2N1bWVudElkJyksXG4gICAgICAgIHN1Ym1pc3Npb25JZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3VibWlzc2lvbklkJyksXG4gICAgICAgIHMzS2V5OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzS2V5JyksXG4gICAgICAgIHMzQnVja2V0OiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnMzQnVja2V0JyksXG4gICAgICAgIG92ZXJsYXlJZDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJC5vdmVybGF5SWQnKSxcbiAgICAgICAgc3RydWN0dXJlVmFsaWRhdGlvbjogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5zdHJ1Y3R1cmVWYWxpZGF0aW9uUmVzdWx0LlBheWxvYWQuc3RydWN0dXJlVmFsaWRhdGlvbicpLFxuICAgICAgICBjb250ZW50QW5hbHlzaXM6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGgub2JqZWN0QXQoJyQuY29udGVudEFuYWx5c2lzUmVzdWx0LlBheWxvYWQuY29udGVudEFuYWx5c2lzJyksXG4gICAgICAgIGdyYW1tYXJDaGVjazogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5ncmFtbWFyQ2hlY2tSZXN1bHQuUGF5bG9hZC5ncmFtbWFyQ2hlY2snKSxcbiAgICAgICAgb3JjaGVzdHJhdGlvbjogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5vcmNoZXN0cmF0aW9uUmVzdWx0LlBheWxvYWQub3JjaGVzdHJhdGlvbicpLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBzY29yaW5nID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnU2NvcmluZycsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBwcm9wcy5zY29yaW5nRnVuY3Rpb24sXG4gICAgICByZXN1bHRQYXRoOiAnJC5zY29yaW5nUmVzdWx0JyxcbiAgICAgIG91dHB1dFBhdGg6ICckJywgLy8gS2VlcCBlbnRpcmUgc3RhdGVcbiAgICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogdHJ1ZSxcbiAgICAgIHBheWxvYWQ6IHN0ZXBmdW5jdGlvbnMuVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICBkb2N1bWVudElkOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLmRvY3VtZW50SWQnKSxcbiAgICAgICAgc3VibWlzc2lvbklkOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLnN0cnVjdHVyZVZhbGlkYXRpb25SZXN1bHQuUGF5bG9hZC5zdWJtaXNzaW9uSWQnKSxcbiAgICAgICAgczNLZXk6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGguc3RyaW5nQXQoJyQuczNLZXknKSxcbiAgICAgICAgczNCdWNrZXQ6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGguc3RyaW5nQXQoJyQuczNCdWNrZXQnKSxcbiAgICAgICAgb3ZlcmxheUlkOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLm92ZXJsYXlJZCcpLFxuICAgICAgICBzdHJ1Y3R1cmVWYWxpZGF0aW9uOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLm9iamVjdEF0KCckLnN0cnVjdHVyZVZhbGlkYXRpb25SZXN1bHQuUGF5bG9hZC5zdHJ1Y3R1cmVWYWxpZGF0aW9uJyksXG4gICAgICAgIGNvbnRlbnRBbmFseXNpczogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5vYmplY3RBdCgnJC5jb250ZW50QW5hbHlzaXNSZXN1bHQuUGF5bG9hZC5jb250ZW50QW5hbHlzaXMnKSxcbiAgICAgICAgZ3JhbW1hckNoZWNrOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLm9iamVjdEF0KCckLmdyYW1tYXJDaGVja1Jlc3VsdC5QYXlsb2FkLmdyYW1tYXJDaGVjaycpLFxuICAgICAgICBvcmNoZXN0cmF0aW9uOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLm9iamVjdEF0KCckLm9yY2hlc3RyYXRpb25SZXN1bHQuUGF5bG9hZC5vcmNoZXN0cmF0aW9uJyksXG4gICAgICAgIGNsYXJpZmljYXRpb246IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGgub2JqZWN0QXQoJyQuY2xhcmlmaWNhdGlvblJlc3VsdC5QYXlsb2FkLmNsYXJpZmljYXRpb24nKSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gU3VjY2VzcyBzdGF0ZVxuICAgIGNvbnN0IHN1Y2Nlc3MgPSBuZXcgc3RlcGZ1bmN0aW9ucy5TdWNjZWVkKHRoaXMsICdBbmFseXNpc0NvbXBsZXRlJywge1xuICAgICAgY29tbWVudDogJ0RvY3VtZW50IGFuYWx5c2lzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHknLFxuICAgIH0pO1xuXG4gICAgLy8gRmFpbHVyZSBzdGF0ZVxuICAgIGNvbnN0IGZhaWx1cmUgPSBuZXcgc3RlcGZ1bmN0aW9ucy5GYWlsKHRoaXMsICdBbmFseXNpc0ZhaWxlZCcsIHtcbiAgICAgIGNhdXNlOiAnRG9jdW1lbnQgYW5hbHlzaXMgZmFpbGVkJyxcbiAgICAgIGVycm9yOiAnQU5BTFlTSVNfRVJST1InLFxuICAgIH0pO1xuXG4gICAgLy8gQnVpbGQgd29ya2Zsb3cgY2hhaW5zXG4gICAgY29uc3QgcGFyYWxsZWxTdGVwID0gbmV3IHN0ZXBmdW5jdGlvbnMuUGFyYWxsZWwodGhpcywgJ1BhcmFsbGVsQW5hbHlzaXMnLCB7XG4gICAgICByZXN1bHRQYXRoOiAnJC5wYXJhbGxlbFJlc3VsdHMnLFxuICAgIH0pLmJyYW5jaChncmFtbWFyQ2hlY2spO1xuXG4gICAgcGFyYWxsZWxTdGVwLmFkZENhdGNoKGZhaWx1cmUsIHtcbiAgICAgIGVycm9yczogWydTdGF0ZXMuQUxMJ10sXG4gICAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgfSk7XG5cbiAgICAvLyBDb25uZWN0IGdyYW1tYXIgY2hlY2sgdG8gb3JjaGVzdHJhdGlvblxuICAgIGdyYW1tYXJDaGVjay5uZXh0KG9yY2hlc3RyYXRpb24pO1xuXG4gICAgLy8gQ29ubmVjdCBzdGF0ZXMgd2l0aCBjbGFyaWZpY2F0aW9uXG4gICAgb3JjaGVzdHJhdGlvbi5uZXh0KGNsYXJpZmljYXRpb24pO1xuICAgIGNsYXJpZmljYXRpb24ubmV4dChzY29yaW5nKTtcbiAgICBzY29yaW5nLm5leHQoc3VjY2Vzcyk7XG5cbiAgICAvLyBDb25uZWN0IHN0YXRlcyAobm8gdmFsaWRhdGlvbiBjaGVjayBmb3Igbm93IC0gTGFtYmRhIGZ1bmN0aW9ucyBoYXZlIHBsYWNlaG9sZGVyIGNvZGUpXG4gICAgLy8gVE9ETzogQWRkIHZhbGlkYXRpb24gY2hlY2tzIHdoZW4gTGFtYmRhIGZ1bmN0aW9ucyBoYXZlIGZ1bGwgaW1wbGVtZW50YXRpb25cbiAgICBzdHJ1Y3R1cmVWYWxpZGF0aW9uLm5leHQoY29udGVudEFuYWx5c2lzKTtcbiAgICBjb250ZW50QW5hbHlzaXMubmV4dChwYXJhbGxlbFN0ZXApO1xuXG4gICAgY29uc3QgZGVmaW5pdGlvbiA9IHN0cnVjdHVyZVZhbGlkYXRpb247XG5cbiAgICAvLyBDcmVhdGUgU3RhdGUgTWFjaGluZVxuICAgIHRoaXMuZG9jdW1lbnRBbmFseXNpc1N0YXRlTWFjaGluZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSh0aGlzLCAnRG9jdW1lbnRBbmFseXNpc1N0YXRlTWFjaGluZScsIHtcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6ICdvdmVybGF5LWRvY3VtZW50LWFuYWx5c2lzJyxcbiAgICAgIGRlZmluaXRpb25Cb2R5OiBzdGVwZnVuY3Rpb25zLkRlZmluaXRpb25Cb2R5LmZyb21DaGFpbmFibGUoZGVmaW5pdGlvbiksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICB0cmFjaW5nRW5hYmxlZDogdHJ1ZSxcbiAgICAgIGxvZ3M6IHtcbiAgICAgICAgZGVzdGluYXRpb246IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdTdGF0ZU1hY2hpbmVMb2dHcm91cCcsIHtcbiAgICAgICAgICBsb2dHcm91cE5hbWU6ICcvYXdzL3N0ZXBmdW5jdGlvbnMvb3ZlcmxheS1kb2N1bWVudC1hbmFseXNpcycsXG4gICAgICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIH0pLFxuICAgICAgICBsZXZlbDogc3RlcGZ1bmN0aW9ucy5Mb2dMZXZlbC5BTEwsXG4gICAgICAgIGluY2x1ZGVFeGVjdXRpb25EYXRhOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUzMgRVZFTlQgVFJJR0dFUlxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgUzMgZXZlbnQgdHJpZ2dlciBmb3IgZG9jdW1lbnQgdXBsb2Fkcy4uLicpO1xuXG4gICAgLy8gTGFtYmRhIHRvIHN0YXJ0IFN0ZXAgRnVuY3Rpb25zIGV4ZWN1dGlvbiBvbiBTMyB1cGxvYWRcbiAgICBjb25zdCBzM1RyaWdnZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1MzVHJpZ2dlckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1zMy10cmlnZ2VyJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHsgU0ZOQ2xpZW50LCBTdGFydEV4ZWN1dGlvbkNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1zZm4nKTtcbiAgICAgICAgY29uc3Qgc2ZuID0gbmV3IFNGTkNsaWVudCgpO1xuXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdTMyBldmVudCByZWNlaXZlZDonLCBKU09OLnN0cmluZ2lmeShldmVudCkpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCByZWNvcmQgb2YgZXZlbnQuUmVjb3Jkcykge1xuICAgICAgICAgICAgY29uc3QgYnVja2V0ID0gcmVjb3JkLnMzLmJ1Y2tldC5uYW1lO1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KHJlY29yZC5zMy5vYmplY3Qua2V5LnJlcGxhY2UoL1xcXFwrL2csICcgJykpO1xuXG4gICAgICAgICAgICAvLyBPbmx5IHByb2Nlc3MgdXBsb2FkcyB0byBzdWJtaXNzaW9ucy8gZm9sZGVyXG4gICAgICAgICAgICBpZiAoIWtleS5zdGFydHNXaXRoKCdzdWJtaXNzaW9ucy8nKSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnU2tpcHBpbmcgbm9uLXN1Ym1pc3Npb24gZmlsZTonLCBrZXkpO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXh0cmFjdCBtZXRhZGF0YSBmcm9tIFMzIG9iamVjdCBrZXlcbiAgICAgICAgICAgIC8vIEV4cGVjdGVkIGZvcm1hdDogc3VibWlzc2lvbnMve2RvY3VtZW50SWR9L3tmaWxlbmFtZX1cbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0ga2V5LnNwbGl0KCcvJyk7XG4gICAgICAgICAgICBjb25zdCBkb2N1bWVudElkID0gcGFydHNbMV07XG5cbiAgICAgICAgICAgIC8vIFRPRE86IFF1ZXJ5IG92ZXJsYXlJZCBmcm9tIGRhdGFiYXNlIGJhc2VkIG9uIHVzZXIvb3JnYW5pemF0aW9uXG4gICAgICAgICAgICAvLyBGb3Igbm93LCB1c2UgZGVmYXVsdCBvdmVybGF5IElEIGZyb20gZW52aXJvbm1lbnQgb3IgZmlyc3QgZGVtbyBvdmVybGF5XG4gICAgICAgICAgICBjb25zdCBvdmVybGF5SWQgPSBwcm9jZXNzLmVudi5ERUZBVUxUX09WRVJMQVlfSUQgfHwgJzIwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSc7XG5cbiAgICAgICAgICAgIC8vIFN0YXJ0IFN0ZXAgRnVuY3Rpb25zIGV4ZWN1dGlvblxuICAgICAgICAgICAgY29uc3QgaW5wdXQgPSB7XG4gICAgICAgICAgICAgIGRvY3VtZW50SWQsXG4gICAgICAgICAgICAgIHN1Ym1pc3Npb25JZDogZG9jdW1lbnRJZCwgLy8gUGFzcyBzdWJtaXNzaW9uSWQgKHNhbWUgYXMgZG9jdW1lbnRJZClcbiAgICAgICAgICAgICAgczNCdWNrZXQ6IGJ1Y2tldCxcbiAgICAgICAgICAgICAgczNLZXk6IGtleSxcbiAgICAgICAgICAgICAgb3ZlcmxheUlkLFxuICAgICAgICAgICAgICB1cGxvYWRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gbmV3IFN0YXJ0RXhlY3V0aW9uQ29tbWFuZCh7XG4gICAgICAgICAgICAgIHN0YXRlTWFjaGluZUFybjogcHJvY2Vzcy5lbnYuU1RBVEVfTUFDSElORV9BUk4sXG4gICAgICAgICAgICAgIGlucHV0OiBKU09OLnN0cmluZ2lmeShpbnB1dCksXG4gICAgICAgICAgICAgIG5hbWU6IFxcYGRvYy1cXCR7ZG9jdW1lbnRJZH0tXFwke0RhdGUubm93KCl9XFxgLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNmbi5zZW5kKGNvbW1hbmQpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnU3RhcnRlZCBleGVjdXRpb246JywgcmVzdWx0LmV4ZWN1dGlvbkFybik7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc3RhcnQgZXhlY3V0aW9uOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHsgc3RhdHVzQ29kZTogMjAwLCBib2R5OiAnUHJvY2Vzc2luZyBzdGFydGVkJyB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTVEFURV9NQUNISU5FX0FSTjogdGhpcy5kb2N1bWVudEFuYWx5c2lzU3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybixcbiAgICAgICAgREVGQVVMVF9PVkVSTEFZX0lEOiAnMjAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxJywgLy8gRGVtbyBvdmVybGF5OiBDb250cmFjdCBSZXZpZXdcbiAgICAgIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIFN0ZXAgRnVuY3Rpb25zIHdvcmtmbG93IG9uIFMzIGRvY3VtZW50IHVwbG9hZCcsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uc1xuICAgIHRoaXMuZG9jdW1lbnRBbmFseXNpc1N0YXRlTWFjaGluZS5ncmFudFN0YXJ0RXhlY3V0aW9uKHMzVHJpZ2dlckZ1bmN0aW9uKTtcbiAgICBwcm9wcy5kb2N1bWVudEJ1Y2tldC5ncmFudFJlYWQoczNUcmlnZ2VyRnVuY3Rpb24pO1xuXG4gICAgLy8gTk9URTogUzMgbm90aWZpY2F0aW9uIGNhbm5vdCBiZSBhZGRlZCBoZXJlIGR1ZSB0byBjaXJjdWxhciBkZXBlbmRlbmN5XG4gICAgLy8gKFN0b3JhZ2UgU3RhY2sgLT4gT3JjaGVzdHJhdGlvbiBTdGFjayAtPiBTMyBUcmlnZ2VyIExhbWJkYSBBUk4gLT4gU3RvcmFnZSBTdGFjaylcbiAgICAvL1xuICAgIC8vIFRvIGFkZCBTMyB0cmlnZ2VyIGFmdGVyIGRlcGxveW1lbnQsIHJ1bjpcbiAgICAvLyBhd3MgczNhcGkgcHV0LWJ1Y2tldC1ub3RpZmljYXRpb24tY29uZmlndXJhdGlvbiBcXFxuICAgIC8vICAgLS1idWNrZXQgb3ZlcmxheS1kb2NzLXtBQ0NPVU5UX0lEfSBcXFxuICAgIC8vICAgLS1ub3RpZmljYXRpb24tY29uZmlndXJhdGlvbiAne1xuICAgIC8vICAgICBcIkxhbWJkYUZ1bmN0aW9uQ29uZmlndXJhdGlvbnNcIjogW3tcbiAgICAvLyAgICAgICBcIkxhbWJkYUZ1bmN0aW9uQXJuXCI6IFwie1MzX1RSSUdHRVJfRlVOQ1RJT05fQVJOfVwiLFxuICAgIC8vICAgICAgIFwiRXZlbnRzXCI6IFtcInMzOk9iamVjdENyZWF0ZWQ6KlwiXSxcbiAgICAvLyAgICAgICBcIkZpbHRlclwiOiB7XCJLZXlcIjoge1wiRmlsdGVyUnVsZXNcIjogW3tcIk5hbWVcIjogXCJwcmVmaXhcIiwgXCJWYWx1ZVwiOiBcInN1Ym1pc3Npb25zL1wifV19fVxuICAgIC8vICAgICB9XVxuICAgIC8vICAgfSdcbiAgICAvL1xuICAgIC8vIE9yIHVzZSB0aGUgQVdTIENvbnNvbGU6IFMzIC0+IEJ1Y2tldCAtPiBQcm9wZXJ0aWVzIC0+IEV2ZW50IE5vdGlmaWNhdGlvbnNcblxuICAgIC8vIEV4cG9ydCBTMyB0cmlnZ2VyIGZ1bmN0aW9uIEFSTiBmb3IgbWFudWFsIGNvbmZpZ3VyYXRpb25cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUzNUcmlnZ2VyRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogczNUcmlnZ2VyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIHRyaWdnZXIgTGFtYmRhIGZ1bmN0aW9uIEFSTiAoY29uZmlndXJlIFMzIG5vdGlmaWNhdGlvbiBtYW51YWxseSknLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlTM1RyaWdnZXJGdW5jdGlvbkFybicsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEVWRU5UQlJJREdFIFJVTEVTXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnNvbGUubG9nKCdDcmVhdGluZyBFdmVudEJyaWRnZSBydWxlcy4uLicpO1xuXG4gICAgLy8gUnVsZSBmb3IgZmFpbGVkIGV4ZWN1dGlvbnNcbiAgICBjb25zdCBmYWlsZWRFeGVjdXRpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdGYWlsZWRFeGVjdXRpb25SdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdvdmVybGF5LWFuYWx5c2lzLWZhaWxlZCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdoZW4gZG9jdW1lbnQgYW5hbHlzaXMgZmFpbHMnLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydhd3Muc3RhdGVzJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnU3RlcCBGdW5jdGlvbnMgRXhlY3V0aW9uIFN0YXR1cyBDaGFuZ2UnXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgc3RhdHVzOiBbJ0ZBSUxFRCcsICdUSU1FRF9PVVQnLCAnQUJPUlRFRCddLFxuICAgICAgICAgIHN0YXRlTWFjaGluZUFybjogW3RoaXMuZG9jdW1lbnRBbmFseXNpc1N0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm5dLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFNlbmQgZmFpbGVkIGV4ZWN1dGlvbnMgdG8gU1FTIGZvciByZXRyeVxuICAgIGZhaWxlZEV4ZWN1dGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLlNxc1F1ZXVlKHRoaXMucHJvY2Vzc2luZ1F1ZXVlKSk7XG5cbiAgICAvLyBSdWxlIGZvciBzdWNjZXNzZnVsIGV4ZWN1dGlvbnNcbiAgICBjb25zdCBzdWNjZXNzRXhlY3V0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnU3VjY2Vzc0V4ZWN1dGlvblJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ292ZXJsYXktYW5hbHlzaXMtc3VjY2VzcycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXJzIHdoZW4gZG9jdW1lbnQgYW5hbHlzaXMgc3VjY2VlZHMnLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydhd3Muc3RhdGVzJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnU3RlcCBGdW5jdGlvbnMgRXhlY3V0aW9uIFN0YXR1cyBDaGFuZ2UnXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgc3RhdHVzOiBbJ1NVQ0NFRURFRCddLFxuICAgICAgICAgIHN0YXRlTWFjaGluZUFybjogW3RoaXMuZG9jdW1lbnRBbmFseXNpc1N0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm5dLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSB0byBoYW5kbGUgc3VjY2Vzc2Z1bCBhbmFseXNpc1xuICAgIGNvbnN0IHN1Y2Nlc3NIYW5kbGVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdWNjZXNzSGFuZGxlckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnb3ZlcmxheS1hbmFseXNpcy1zdWNjZXNzLWhhbmRsZXInLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0FuYWx5c2lzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHk6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQpKTtcbiAgICAgICAgICAvLyBUT0RPOiBVcGRhdGUgZGF0YWJhc2UsIHNlbmQgbm90aWZpY2F0aW9ucywgZXRjLlxuICAgICAgICAgIHJldHVybiB7IHN0YXR1c0NvZGU6IDIwMCB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBkZXNjcmlwdGlvbjogJ0hhbmRsZXMgc3VjY2Vzc2Z1bCBkb2N1bWVudCBhbmFseXNpcyBjb21wbGV0aW9uJyxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICB9KTtcblxuICAgIHN1Y2Nlc3NFeGVjdXRpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzdWNjZXNzSGFuZGxlckZ1bmN0aW9uKSk7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvY3VtZW50QW5hbHlzaXNTdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdEb2N1bWVudCBhbmFseXNpcyBzdGF0ZSBtYWNoaW5lIEFSTicsXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheVN0YXRlTWFjaGluZUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvY2Vzc2luZ1F1ZXVlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJvY2Vzc2luZ1F1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9jZXNzaW5nIHF1ZXVlIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheVByb2Nlc3NpbmdRdWV1ZVVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVhZExldHRlclF1ZXVlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGVhZExldHRlclF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdEZWFkIGxldHRlciBxdWV1ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlEZWFkTGV0dGVyUXVldWVVcmwnLFxuICAgIH0pO1xuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdPdmVybGF5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFjaycsICdPcmNoZXN0cmF0aW9uJyk7XG4gIH1cbn1cbiJdfQ==