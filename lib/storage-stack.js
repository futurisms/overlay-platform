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
exports.StorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib/core"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class StorageStack extends cdk.Stack {
    vpc;
    auroraCluster;
    llmConfigTable;
    claudeApiKeySecret;
    documentBucket;
    documentTable;
    constructor(scope, id, props) {
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
        auroraSG.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'Allow PostgreSQL access from VPC');
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
            secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
                apiKey: claudeApiKey,
            })),
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
        auroraSG.addIngressRule(migrationLambdaSG, ec2.Port.tcp(5432), 'Allow PostgreSQL access from migration Lambda');
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
exports.StorageStack = StorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsc0RBQXdDO0FBRXhDLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsbUVBQXFEO0FBQ3JELCtFQUFpRTtBQUNqRSx1REFBeUM7QUFDekMsMkRBQTZDO0FBQzdDLCtEQUFpRDtBQU1qRCxNQUFhLFlBQWEsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6QixHQUFHLENBQVU7SUFDYixhQUFhLENBQXNCO0lBQ25DLGNBQWMsQ0FBaUI7SUFDL0Isa0JBQWtCLENBQXdCO0lBQzFDLGNBQWMsQ0FBWTtJQUMxQixhQUFhLENBQWlCO0lBRTlDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxlQUFlLEdBQUcsS0FBSyxFQUFFLGVBQWUsSUFBSSxZQUFZLENBQUM7UUFFL0Qsc0NBQXNDO1FBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3pDLE9BQU8sRUFBRSxhQUFhO1lBQ3RCLFdBQVcsRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDaEQsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQztZQUNkLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNO2lCQUNsQztnQkFDRDtvQkFDRSxRQUFR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QztZQUM3QyxVQUFVLEVBQUUsdUJBQXVCO1NBQ3BDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUztZQUNuQyxXQUFXLEVBQUUsc0NBQXNDO1lBQ25ELFVBQVUsRUFBRSxzQkFBc0I7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDdEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQWxWRCxvQ0FrVkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWIvY29yZSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN0b3JhZ2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudE5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yYWdlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjOiBlYzIuVnBjO1xuICBwdWJsaWMgcmVhZG9ubHkgYXVyb3JhQ2x1c3RlcjogcmRzLkRhdGFiYXNlQ2x1c3RlcjtcbiAgcHVibGljIHJlYWRvbmx5IGxsbUNvbmZpZ1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGNsYXVkZUFwaUtleVNlY3JldDogc2VjcmV0c21hbmFnZXIuU2VjcmV0O1xuICBwdWJsaWMgcmVhZG9ubHkgZG9jdW1lbnRCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGRvY3VtZW50VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogU3RvcmFnZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50TmFtZSA9IHByb3BzPy5lbnZpcm9ubWVudE5hbWUgfHwgJ3Byb2R1Y3Rpb24nO1xuXG4gICAgLy8gVlBDIHdpdGggcHJpdmF0ZSBzdWJuZXRzIGZvciBBdXJvcmFcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgVlBDIHdpdGggcHJpdmF0ZSBzdWJuZXRzLi4uJyk7XG4gICAgdGhpcy52cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnT3ZlcmxheVZQQycsIHtcbiAgICAgIHZwY05hbWU6ICdvdmVybGF5LXZwYycsXG4gICAgICBpcEFkZHJlc3NlczogZWMyLklwQWRkcmVzc2VzLmNpZHIoJzEwLjAuMC4wLzE2JyksXG4gICAgICBtYXhBenM6IDIsXG4gICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiAnUHVibGljJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjgsXG4gICAgICAgICAgbmFtZTogJ0lzb2xhdGVkJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBdXJvcmEgU2VydmVybGVzcyB2MiBQb3N0Z3JlU1FMIENsdXN0ZXJcbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgQXVyb3JhIFNlcnZlcmxlc3MgdjIgUG9zdGdyZVNRTCBjbHVzdGVyLi4uJyk7XG5cbiAgICAvLyBTZWN1cml0eSBncm91cCBmb3IgQXVyb3JhXG4gICAgY29uc3QgYXVyb3JhU0cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0F1cm9yYVNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgQXVyb3JhIFNlcnZlcmxlc3MgdjIgY2x1c3RlcicsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQWxsb3cgYWNjZXNzIGZyb20gd2l0aGluIFZQQ1xuICAgIGF1cm9yYVNHLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuaXB2NCh0aGlzLnZwYy52cGNDaWRyQmxvY2spLFxuICAgICAgZWMyLlBvcnQudGNwKDU0MzIpLFxuICAgICAgJ0FsbG93IFBvc3RncmVTUUwgYWNjZXNzIGZyb20gVlBDJ1xuICAgICk7XG5cbiAgICAvLyBEYXRhYmFzZSBjcmVkZW50aWFsc1xuICAgIGNvbnN0IGRhdGFiYXNlVXNlcm5hbWUgPSAnb3ZlcmxheV9hZG1pbic7XG4gICAgY29uc3QgZGF0YWJhc2VOYW1lID0gJ292ZXJsYXlfZGInO1xuXG4gICAgLy8gQ3JlYXRlIEF1cm9yYSBjbHVzdGVyIHdpdGggU2VydmVybGVzcyB2MlxuICAgIHRoaXMuYXVyb3JhQ2x1c3RlciA9IG5ldyByZHMuRGF0YWJhc2VDbHVzdGVyKHRoaXMsICdBdXJvcmFDbHVzdGVyJywge1xuICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VDbHVzdGVyRW5naW5lLmF1cm9yYVBvc3RncmVzKHtcbiAgICAgICAgdmVyc2lvbjogcmRzLkF1cm9yYVBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTZfNixcbiAgICAgIH0pLFxuICAgICAgd3JpdGVyOiByZHMuQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMignd3JpdGVyJywge1xuICAgICAgICBwdWJsaWNseUFjY2Vzc2libGU6IGZhbHNlLFxuICAgICAgfSksXG4gICAgICByZWFkZXJzOiBbXG4gICAgICAgIHJkcy5DbHVzdGVySW5zdGFuY2Uuc2VydmVybGVzc1YyKCdyZWFkZXIxJywge1xuICAgICAgICAgIHNjYWxlV2l0aFdyaXRlcjogdHJ1ZSxcbiAgICAgICAgICBwdWJsaWNseUFjY2Vzc2libGU6IGZhbHNlLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgICBzZXJ2ZXJsZXNzVjJNaW5DYXBhY2l0eTogMC41LFxuICAgICAgc2VydmVybGVzc1YyTWF4Q2FwYWNpdHk6IDIsXG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbYXVyb3JhU0ddLFxuICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogZGF0YWJhc2VOYW1lLFxuICAgICAgY3JlZGVudGlhbHM6IHJkcy5DcmVkZW50aWFscy5mcm9tR2VuZXJhdGVkU2VjcmV0KGRhdGFiYXNlVXNlcm5hbWUsIHtcbiAgICAgICAgc2VjcmV0TmFtZTogYG92ZXJsYXkvYXVyb3JhLyR7ZW52aXJvbm1lbnROYW1lfS9jcmVkZW50aWFsc2AsXG4gICAgICB9KSxcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICByZXRlbnRpb246IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgICBwcmVmZXJyZWRXaW5kb3c6ICcwMzowMC0wNDowMCcsXG4gICAgICB9LFxuICAgICAgY2xvdWR3YXRjaExvZ3NFeHBvcnRzOiBbJ3Bvc3RncmVzcWwnXSxcbiAgICAgIGNsb3Vkd2F0Y2hMb2dzUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgc3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlNOQVBTSE9ULFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgZm9yIExMTSBDb25maWd1cmF0aW9uXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIER5bmFtb0RCIHRhYmxlIGZvciBMTE0gY29uZmlndXJhdGlvbi4uLicpO1xuICAgIHRoaXMubGxtQ29uZmlnVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0xMTUNvbmZpZ1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnb3ZlcmxheS1sbG0tY29uZmlnJyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY29uZmlnSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd2ZXJzaW9uJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlTcGVjaWZpY2F0aW9uOiB7XG4gICAgICAgIHBvaW50SW5UaW1lUmVjb3ZlcnlFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGFjdGl2ZSBjb25maWd1cmF0aW9uc1xuICAgIHRoaXMubGxtQ29uZmlnVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnQWN0aXZlQ29uZmlnSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdpc0FjdGl2ZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2xhc3RNb2RpZmllZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFNlY3JldHMgTWFuYWdlciBTZWNyZXQgZm9yIENsYXVkZSBBUEkgS2V5XG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIFNlY3JldHMgTWFuYWdlciBzZWNyZXQgZm9yIENsYXVkZSBBUEkga2V5Li4uJyk7XG5cbiAgICAvLyBHZXQgQ2xhdWRlIEFQSSBrZXkgZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZSBvciB1c2UgcGxhY2Vob2xkZXJcbiAgICBjb25zdCBjbGF1ZGVBcGlLZXkgPSBwcm9jZXNzLmVudi5DTEFVREVfQVBJX0tFWSB8fCAnUExBQ0VIT0xERVJfVVBEQVRFX0FGVEVSX0RFUExPWU1FTlQnO1xuXG4gICAgdGhpcy5jbGF1ZGVBcGlLZXlTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdDbGF1ZGVBcGlLZXlTZWNyZXQnLCB7XG4gICAgICBzZWNyZXROYW1lOiBgb3ZlcmxheS9jbGF1ZGUvJHtlbnZpcm9ubWVudE5hbWV9L2FwaS1rZXlgLFxuICAgICAgZGVzY3JpcHRpb246ICdDbGF1ZGUgQVBJIGtleSBmb3IgT3ZlcmxheSBQbGF0Zm9ybSBBSSBwcm9jZXNzaW5nJyxcbiAgICAgIHNlY3JldFN0cmluZ1ZhbHVlOiBjZGsuU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYXBpS2V5OiBjbGF1ZGVBcGlLZXksXG4gICAgICAgIH0pXG4gICAgICApLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgQnVja2V0IGZvciBkb2N1bWVudCBzdG9yYWdlIChtb3ZlZCBmcm9tIG1haW4gc3RhY2spXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIFMzIGJ1Y2tldCBmb3IgZG9jdW1lbnQgc3RvcmFnZS4uLicpO1xuICAgIHRoaXMuZG9jdW1lbnRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdEb2N1bWVudEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBvdmVybGF5LWRvY3MtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXG4gICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ1RyYW5zaXRpb25Ub0lBJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sIC8vIFVwZGF0ZSB3aXRoIGFjdHVhbCBkb21haW4gaW4gcHJvZHVjdGlvblxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgZm9yIGRvY3VtZW50IG1ldGFkYXRhIChtb3ZlZCBmcm9tIG1haW4gc3RhY2spXG4gICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIER5bmFtb0RCIHRhYmxlIGZvciBkb2N1bWVudCBtZXRhZGF0YS4uLicpO1xuICAgIHRoaXMuZG9jdW1lbnRUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRG9jdW1lbnRUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ292ZXJsYXktZG9jdW1lbnRzJyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnZG9jdW1lbnRJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5U3BlY2lmaWNhdGlvbjoge1xuICAgICAgICBwb2ludEluVGltZVJlY292ZXJ5RW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IHN0YXR1c1xuICAgIHRoaXMuZG9jdW1lbnRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IHVzZXJcbiAgICB0aGlzLmRvY3VtZW50VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVXNlckluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXBsb2FkZWRCeScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIERhdGFiYXNlIE1pZ3JhdGlvbiBMYW1iZGEgRnVuY3Rpb25cbiAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgZGF0YWJhc2UgbWlncmF0aW9uIExhbWJkYSBmdW5jdGlvbi4uLicpO1xuXG4gICAgLy8gU2VjdXJpdHkgZ3JvdXAgZm9yIExhbWJkYVxuICAgIGNvbnN0IG1pZ3JhdGlvbkxhbWJkYVNHID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdNaWdyYXRpb25MYW1iZGFTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIGRhdGFiYXNlIG1pZ3JhdGlvbiBMYW1iZGEnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIEFsbG93IExhbWJkYSB0byBjb25uZWN0IHRvIEF1cm9yYVxuICAgIGF1cm9yYVNHLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgbWlncmF0aW9uTGFtYmRhU0csXG4gICAgICBlYzIuUG9ydC50Y3AoNTQzMiksXG4gICAgICAnQWxsb3cgUG9zdGdyZVNRTCBhY2Nlc3MgZnJvbSBtaWdyYXRpb24gTGFtYmRhJ1xuICAgICk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIGRhdGFiYXNlIG1pZ3JhdGlvbnNcbiAgICBjb25zdCBtaWdyYXRpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RhdGFiYXNlTWlncmF0aW9uRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdvdmVybGF5LWRhdGFiYXNlLW1pZ3JhdGlvbicsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2Z1bmN0aW9ucy9kYXRhYmFzZS1taWdyYXRpb24nKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFttaWdyYXRpb25MYW1iZGFTR10sXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTRUNSRVRfQVJOOiB0aGlzLmF1cm9yYUNsdXN0ZXIuc2VjcmV0Py5zZWNyZXRBcm4gfHwgJycsXG4gICAgICAgIERCX0VORFBPSU5UOiB0aGlzLmF1cm9yYUNsdXN0ZXIuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxuICAgICAgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUnVucyBkYXRhYmFzZSBtaWdyYXRpb25zIG9uIEF1cm9yYSBQb3N0Z3JlU1FMJyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9uIHRvIHJlYWQgQXVyb3JhIHNlY3JldFxuICAgIHRoaXMuYXVyb3JhQ2x1c3Rlci5zZWNyZXQ/LmdyYW50UmVhZChtaWdyYXRpb25GdW5jdGlvbik7XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0lkJywge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLnZwY0lkLFxuICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlWcGNJZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWlncmF0aW9uRnVuY3Rpb25OYW1lJywge1xuICAgICAgdmFsdWU6IG1pZ3JhdGlvbkZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGF0YWJhc2UgbWlncmF0aW9uIExhbWJkYSBmdW5jdGlvbiBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5TWlncmF0aW9uRnVuY3Rpb25OYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNaWdyYXRpb25GdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiBtaWdyYXRpb25GdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGF0YWJhc2UgbWlncmF0aW9uIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlNaWdyYXRpb25GdW5jdGlvbkFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVyb3JhQ2x1c3RlckVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IHRoaXMuYXVyb3JhQ2x1c3Rlci5jbHVzdGVyRW5kcG9pbnQuaG9zdG5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1cm9yYSBjbHVzdGVyIHdyaXRlciBlbmRwb2ludCcsXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheUF1cm9yYUNsdXN0ZXJFbmRwb2ludCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVyb3JhQ2x1c3RlclJlYWRFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1cm9yYUNsdXN0ZXIuY2x1c3RlclJlYWRFbmRwb2ludC5ob3N0bmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXVyb3JhIGNsdXN0ZXIgcmVhZGVyIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5QXVyb3JhQ2x1c3RlclJlYWRFbmRwb2ludCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVyb3JhU2VjcmV0QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXVyb3JhQ2x1c3Rlci5zZWNyZXQ/LnNlY3JldEFybiB8fCAnTi9BJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXVyb3JhIGRhdGFiYXNlIGNyZWRlbnRpYWxzIHNlY3JldCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlBdXJvcmFTZWNyZXRBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xMTUNvbmZpZ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmxsbUNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIExMTSBjb25maWd1cmF0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdPdmVybGF5TExNQ29uZmlnVGFibGUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NsYXVkZUFwaUtleVNlY3JldEFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNsYXVkZUFwaUtleVNlY3JldC5zZWNyZXRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NsYXVkZSBBUEkga2V5IHNlY3JldCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlDbGF1ZGVBcGlLZXlTZWNyZXRBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RvY3VtZW50QnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvY3VtZW50QnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgZG9jdW1lbnQgc3RvcmFnZScsXG4gICAgICBleHBvcnROYW1lOiAnT3ZlcmxheURvY3VtZW50QnVja2V0JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2N1bWVudFRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvY3VtZW50VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBmb3IgZG9jdW1lbnQgbWV0YWRhdGEnLFxuICAgICAgZXhwb3J0TmFtZTogJ092ZXJsYXlEb2N1bWVudFRhYmxlJyxcbiAgICB9KTtcblxuICAgIC8vIFRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnT3ZlcmxheScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2snLCAnU3RvcmFnZScpO1xuICB9XG59XG4iXX0=