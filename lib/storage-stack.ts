import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface StorageStackProps extends cdk.StackProps {
  readonly environmentName?: string;
}

export class StorageStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly auroraCluster: rds.DatabaseCluster;
  public readonly llmConfigTable: dynamodb.Table;
  public readonly claudeApiKeySecret: secretsmanager.Secret;
  public readonly documentBucket: s3.Bucket;
  public readonly documentTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StorageStackProps) {
    super(scope, id, props);

    const environmentName = props?.environmentName || 'production';

    // VPC with private subnets for Aurora
    console.log('Creating VPC with private subnets...');
    this.vpc = new ec2.Vpc(this, 'OverlayVPC', {
      vpcName: 'overlay-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Aurora Serverless v2 PostgreSQL Cluster
    console.log('Creating Aurora Serverless v2 PostgreSQL cluster...');

    // Security group for Aurora
    const auroraSG = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora Serverless v2 cluster',
      allowAllOutbound: true,
    });

    // Allow access from within VPC
    auroraSG.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from VPC'
    );

    // Database credentials
    const databaseUsername = 'overlay_admin';
    const databaseName = 'overlay_db';

    // Create Aurora cluster with Serverless v2
    this.auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2('reader1', {
          scaleWithWriter: true,
          publiclyAccessible: false,
        }),
      ],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [auroraSG],
      defaultDatabaseName: databaseName,
      credentials: rds.Credentials.fromGeneratedSecret(databaseUsername, {
        secretName: `overlay/aurora/${environmentName}/credentials`,
      }),
      backup: {
        retention: cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: true,
    });

    // DynamoDB Table for LLM Configuration
    console.log('Creating DynamoDB table for LLM configuration...');
    this.llmConfigTable = new dynamodb.Table(this, 'LLMConfigTable', {
      tableName: 'overlay-llm-config',
      partitionKey: {
        name: 'configId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'version',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying active configurations
    this.llmConfigTable.addGlobalSecondaryIndex({
      indexName: 'ActiveConfigIndex',
      partitionKey: {
        name: 'isActive',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'lastModified',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Secrets Manager Secret for Claude API Key
    console.log('Creating Secrets Manager secret for Claude API key...');

    // Get Claude API key from environment variable or use placeholder
    const claudeApiKey = process.env.CLAUDE_API_KEY || 'PLACEHOLDER_UPDATE_AFTER_DEPLOYMENT';

    this.claudeApiKeySecret = new secretsmanager.Secret(this, 'ClaudeApiKeySecret', {
      secretName: `overlay/claude/${environmentName}/api-key`,
      description: 'Claude API key for Overlay Platform AI processing',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          apiKey: claudeApiKey,
        })
      ),
    });

    // S3 Bucket for document storage (moved from main stack)
    console.log('Creating S3 bucket for document storage...');
    this.documentBucket = new s3.Bucket(this, 'DocumentBucket', {
      bucketName: `overlay-docs-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // Update with actual domain in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // DynamoDB Table for document metadata (moved from main stack)
    console.log('Creating DynamoDB table for document metadata...');
    this.documentTable = new dynamodb.Table(this, 'DocumentTable', {
      tableName: 'overlay-documents',
      partitionKey: {
        name: 'documentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSI for querying by status
    this.documentTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Add GSI for querying by user
    this.documentTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: {
        name: 'uploadedBy',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Database Migration Lambda Function
    console.log('Creating database migration Lambda function...');

    // Security group for Lambda
    const migrationLambdaSG = new ec2.SecurityGroup(this, 'MigrationLambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for database migration Lambda',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to Aurora
    auroraSG.addIngressRule(
      migrationLambdaSG,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from migration Lambda'
    );

    // Lambda function for database migrations
    const migrationFunction = new lambda.Function(this, 'DatabaseMigrationFunction', {
      functionName: 'overlay-database-migration',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/database-migration'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [migrationLambdaSG],
      environment: {
        SECRET_ARN: this.auroraCluster.secret?.secretArn || '',
        DB_ENDPOINT: this.auroraCluster.clusterEndpoint.hostname,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      description: 'Runs database migrations on Aurora PostgreSQL',
    });

    // Grant Lambda permission to read Aurora secret
    this.auroraCluster.secret?.grantRead(migrationFunction);

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'OverlayVpcId',
    });

    new cdk.CfnOutput(this, 'MigrationFunctionName', {
      value: migrationFunction.functionName,
      description: 'Database migration Lambda function name',
      exportName: 'OverlayMigrationFunctionName',
    });

    new cdk.CfnOutput(this, 'MigrationFunctionArn', {
      value: migrationFunction.functionArn,
      description: 'Database migration Lambda function ARN',
      exportName: 'OverlayMigrationFunctionArn',
    });

    new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
      value: this.auroraCluster.clusterEndpoint.hostname,
      description: 'Aurora cluster writer endpoint',
      exportName: 'OverlayAuroraClusterEndpoint',
    });

    new cdk.CfnOutput(this, 'AuroraClusterReadEndpoint', {
      value: this.auroraCluster.clusterReadEndpoint.hostname,
      description: 'Aurora cluster reader endpoint',
      exportName: 'OverlayAuroraClusterReadEndpoint',
    });

    new cdk.CfnOutput(this, 'AuroraSecretArn', {
      value: this.auroraCluster.secret?.secretArn || 'N/A',
      description: 'Aurora database credentials secret ARN',
      exportName: 'OverlayAuroraSecretArn',
    });

    new cdk.CfnOutput(this, 'LLMConfigTableName', {
      value: this.llmConfigTable.tableName,
      description: 'DynamoDB table for LLM configuration',
      exportName: 'OverlayLLMConfigTable',
    });

    new cdk.CfnOutput(this, 'ClaudeApiKeySecretArn', {
      value: this.claudeApiKeySecret.secretArn,
      description: 'Claude API key secret ARN',
      exportName: 'OverlayClaudeApiKeySecretArn',
    });

    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: this.documentBucket.bucketName,
      description: 'S3 bucket for document storage',
      exportName: 'OverlayDocumentBucket',
    });

    new cdk.CfnOutput(this, 'DocumentTableName', {
      value: this.documentTable.tableName,
      description: 'DynamoDB table for document metadata',
      exportName: 'OverlayDocumentTable',
    });

    // Tags
    cdk.Tags.of(this).add('Environment', environmentName);
    cdk.Tags.of(this).add('Project', 'Overlay');
    cdk.Tags.of(this).add('Stack', 'Storage');
  }
}
