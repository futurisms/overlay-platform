import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { StorageStack } from './storage-stack';

export interface OverlayPlatformStackProps extends cdk.StackProps {
  readonly storageStack: StorageStack;
}

export class OverlayPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OverlayPlatformStackProps) {
    super(scope, id, props);

    const { storageStack } = props;

    // Reference storage resources from storage stack
    const documentBucket = storageStack.documentBucket;
    const documentTable = storageStack.documentTable;
    const vpc = storageStack.vpc;
    const auroraCluster = storageStack.auroraCluster;

    // Lambda Layer for common dependencies
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset('lambda/layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Common dependencies for Overlay platform Lambda functions',
    });

    // Outputs
    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: documentBucket.bucketName,
      description: 'S3 bucket for document storage',
      exportName: 'OverlayDocumentBucket',
    });

    new cdk.CfnOutput(this, 'DocumentTableName', {
      value: documentTable.tableName,
      description: 'DynamoDB table for document metadata',
      exportName: 'OverlayDocumentTable',
    });

    new cdk.CfnOutput(this, 'CommonLayerArn', {
      value: commonLayer.layerVersionArn,
      description: 'Common Lambda layer ARN',
      exportName: 'OverlayCommonLayer',
    });
  }
}
