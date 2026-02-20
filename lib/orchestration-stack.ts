import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface OrchestrationStackProps extends cdk.StackProps {
  readonly environmentName?: string;
  readonly documentBucket: s3.IBucket;
  readonly structureValidatorFunction: lambda.IFunction;
  readonly contentAnalyzerFunction: lambda.IFunction;
  readonly grammarCheckerFunction: lambda.IFunction;
  readonly orchestratorFunction: lambda.IFunction;
  readonly clarificationFunction: lambda.IFunction;
  readonly scoringFunction: lambda.IFunction;
  readonly analysisFailureHandler: lambda.IFunction;
}

export class OrchestrationStack extends cdk.Stack {
  public readonly documentAnalysisStateMachine: stepfunctions.StateMachine;
  public readonly processingQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: OrchestrationStackProps) {
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

    // Send failed executions to Lambda handler to update database status
    failedExecutionRule.addTarget(new targets.LambdaFunction(props.analysisFailureHandler));

    // Also send to SQS for retry/monitoring
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
