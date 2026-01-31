import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

const lambdaClient = new LambdaClient({ region: 'eu-west-1' });
const cfnClient = new CloudFormationClient({ region: 'eu-west-1' });

/**
 * Get the migration Lambda function name from CloudFormation stack outputs
 */
async function getMigrationFunctionName(): Promise<string> {
  console.log('📡 Retrieving migration Lambda function name from CloudFormation...');

  const command = new DescribeStacksCommand({
    StackName: 'OverlayStorageStack',
  });

  const response = await cfnClient.send(command);
  const stack = response.Stacks?.[0];

  if (!stack) {
    throw new Error('OverlayStorageStack not found');
  }

  const functionNameOutput = stack.Outputs?.find(
    output => output.OutputKey === 'MigrationFunctionName'
  );

  if (!functionNameOutput || !functionNameOutput.OutputValue) {
    throw new Error('MigrationFunctionName output not found in stack');
  }

  console.log(`✅ Found Lambda function: ${functionNameOutput.OutputValue}`);
  return functionNameOutput.OutputValue;
}

/**
 * Invoke the migration Lambda function
 */
async function invokeMigrationLambda(functionName: string): Promise<void> {
  console.log('\n🚀 Invoking database migration Lambda function...');
  console.log('⏳ This may take several minutes as migrations execute...\n');

  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'RequestResponse', // Wait for response
    LogType: 'Tail', // Get CloudWatch logs
  });

  const response = await lambdaClient.send(command);

  // Decode base64 logs
  if (response.LogResult) {
    const logs = Buffer.from(response.LogResult, 'base64').toString('utf-8');
    console.log('📋 Lambda Execution Logs:');
    console.log('─'.repeat(80));
    console.log(logs);
    console.log('─'.repeat(80));
  }

  // Parse response payload
  if (response.Payload) {
    const payloadString = Buffer.from(response.Payload).toString('utf-8');
    const payload = JSON.parse(payloadString);

    console.log('\n📊 Migration Results:');
    console.log(JSON.stringify(payload, null, 2));

    if (payload.statusCode === 200) {
      const body = JSON.parse(payload.body);

      if (body.success) {
        console.log('\n✅ Database migrations completed successfully!');

        if (body.results?.verification) {
          const tables = body.results.verification.tables;
          console.log('\n📈 Database Verification:');
          console.log(`   Total Tables: ${tables.length}`);
          console.log('\n   Tables Created:');
          tables.forEach((table: any) => {
            console.log(`   - ${table.table_name} (${table.row_count} rows)`);
          });
        }
      } else {
        console.error('\n❌ Migration failed:', body.error);
        process.exit(1);
      }
    } else {
      console.error('\n❌ Lambda invocation failed with status code:', payload.statusCode);
      process.exit(1);
    }
  }

  // Check for function errors
  if (response.FunctionError) {
    console.error('\n❌ Lambda function error:', response.FunctionError);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔧 Overlay Platform - Database Migration via Lambda\n');

    // Get Lambda function name from CloudFormation
    const functionName = await getMigrationFunctionName();

    // Invoke the migration Lambda
    await invokeMigrationLambda(functionName);

    console.log('\n✅ Migration process completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Verify tables in Aurora using psql or Query Editor');
    console.log('   2. Check CloudWatch Logs for detailed execution logs');
    console.log('   3. Review the seed data in the database');
    console.log('   4. Deploy the application stack (OverlayPlatformStack)');

  } catch (error) {
    console.error('\n❌ Error running database migrations:', error);

    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('\nStack trace:', error.stack);
    }

    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Ensure OverlayStorageStack is deployed: cdk deploy OverlayStorageStack');
    console.error('   2. Check that Lambda has VPC connectivity to Aurora');
    console.error('   3. Verify security group rules allow Lambda → Aurora (port 5432)');
    console.error('   4. Check CloudWatch Logs for Lambda execution errors');
    console.error('   5. Ensure Aurora cluster is in "available" state');

    process.exit(1);
  }
}

main();
