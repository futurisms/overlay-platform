"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_lambda_1 = require("@aws-sdk/client-lambda");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const lambdaClient = new client_lambda_1.LambdaClient({ region: 'eu-west-1' });
const cfnClient = new client_cloudformation_1.CloudFormationClient({ region: 'eu-west-1' });
/**
 * Get the migration Lambda function name from CloudFormation stack outputs
 */
async function getMigrationFunctionName() {
    console.log('📡 Retrieving migration Lambda function name from CloudFormation...');
    const command = new client_cloudformation_1.DescribeStacksCommand({
        StackName: 'OverlayStorageStack',
    });
    const response = await cfnClient.send(command);
    const stack = response.Stacks?.[0];
    if (!stack) {
        throw new Error('OverlayStorageStack not found');
    }
    const functionNameOutput = stack.Outputs?.find(output => output.OutputKey === 'MigrationFunctionName');
    if (!functionNameOutput || !functionNameOutput.OutputValue) {
        throw new Error('MigrationFunctionName output not found in stack');
    }
    console.log(`✅ Found Lambda function: ${functionNameOutput.OutputValue}`);
    return functionNameOutput.OutputValue;
}
/**
 * Invoke the migration Lambda function
 */
async function invokeMigrationLambda(functionName) {
    console.log('\n🚀 Invoking database migration Lambda function...');
    console.log('⏳ This may take several minutes as migrations execute...\n');
    const command = new client_lambda_1.InvokeCommand({
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
                    tables.forEach((table) => {
                        console.log(`   - ${table.table_name} (${table.row_count} rows)`);
                    });
                }
            }
            else {
                console.error('\n❌ Migration failed:', body.error);
                process.exit(1);
            }
        }
        else {
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
    }
    catch (error) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW52b2tlLW1pZ3JhdGlvbi1sYW1iZGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbnZva2UtbWlncmF0aW9uLWxhbWJkYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDBEQUFxRTtBQUNyRSwwRUFBNkY7QUFFN0YsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDL0QsTUFBTSxTQUFTLEdBQUcsSUFBSSw0Q0FBb0IsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBRXBFOztHQUVHO0FBQ0gsS0FBSyxVQUFVLHdCQUF3QjtJQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLHFFQUFxRSxDQUFDLENBQUM7SUFFbkYsTUFBTSxPQUFPLEdBQUcsSUFBSSw2Q0FBcUIsQ0FBQztRQUN4QyxTQUFTLEVBQUUscUJBQXFCO0tBQ2pDLENBQUMsQ0FBQztJQUVILE1BQU0sUUFBUSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFbkMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxNQUFNLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUM1QyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEtBQUssdUJBQXVCLENBQ3ZELENBQUM7SUFFRixJQUFJLENBQUMsa0JBQWtCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMzRCxNQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsNEJBQTRCLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDMUUsT0FBTyxrQkFBa0IsQ0FBQyxXQUFXLENBQUM7QUFDeEMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsS0FBSyxVQUFVLHFCQUFxQixDQUFDLFlBQW9CO0lBQ3ZELE9BQU8sQ0FBQyxHQUFHLENBQUMscURBQXFELENBQUMsQ0FBQztJQUNuRSxPQUFPLENBQUMsR0FBRyxDQUFDLDREQUE0RCxDQUFDLENBQUM7SUFFMUUsTUFBTSxPQUFPLEdBQUcsSUFBSSw2QkFBYSxDQUFDO1FBQ2hDLFlBQVksRUFBRSxZQUFZO1FBQzFCLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxvQkFBb0I7UUFDdkQsT0FBTyxFQUFFLE1BQU0sRUFBRSxzQkFBc0I7S0FDeEMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxRQUFRLEdBQUcsTUFBTSxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRWxELHFCQUFxQjtJQUNyQixJQUFJLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUN2QixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pFLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUN6QyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCx5QkFBeUI7SUFDekIsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDckIsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQ3ZDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFOUMsSUFBSSxPQUFPLENBQUMsVUFBVSxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQy9CLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXRDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7Z0JBRS9ELElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsQ0FBQztvQkFDL0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO29CQUNoRCxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7b0JBQzNDLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO29CQUNqRCxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7b0JBQ3BDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFVLEVBQUUsRUFBRTt3QkFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLFNBQVMsUUFBUSxDQUFDLENBQUM7b0JBQ3BFLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7WUFDSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sT0FBTyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ25ELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEIsQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ04sT0FBTyxDQUFDLEtBQUssQ0FBQyxnREFBZ0QsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDcEYsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsQixDQUFDO0lBQ0gsQ0FBQztJQUVELDRCQUE0QjtJQUM1QixJQUFJLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLDRCQUE0QixFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNwRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxLQUFLLFVBQVUsSUFBSTtJQUNqQixJQUFJLENBQUM7UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFFckUsK0NBQStDO1FBQy9DLE1BQU0sWUFBWSxHQUFHLE1BQU0sd0JBQXdCLEVBQUUsQ0FBQztRQUV0RCw4QkFBOEI7UUFDOUIsTUFBTSxxQkFBcUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUUxQyxPQUFPLENBQUMsR0FBRyxDQUFDLCtDQUErQyxDQUFDLENBQUM7UUFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2hDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMERBQTBELENBQUMsQ0FBQztRQUN4RSxPQUFPLENBQUMsR0FBRyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7UUFDdkUsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO1FBQzFELE9BQU8sQ0FBQyxHQUFHLENBQUMsMkRBQTJELENBQUMsQ0FBQztJQUUzRSxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0NBQXdDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFL0QsSUFBSSxLQUFLLFlBQVksS0FBSyxFQUFFLENBQUM7WUFDM0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDL0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUVELE9BQU8sQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUN2QyxPQUFPLENBQUMsS0FBSyxDQUFDLDhFQUE4RSxDQUFDLENBQUM7UUFDOUYsT0FBTyxDQUFDLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1FBQ3hFLE9BQU8sQ0FBQyxLQUFLLENBQUMscUVBQXFFLENBQUMsQ0FBQztRQUNyRixPQUFPLENBQUMsS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7UUFDekUsT0FBTyxDQUFDLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBRXJFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztBQUNILENBQUM7QUFFRCxJQUFJLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExhbWJkYUNsaWVudCwgSW52b2tlQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnO1xuaW1wb3J0IHsgQ2xvdWRGb3JtYXRpb25DbGllbnQsIERlc2NyaWJlU3RhY2tzQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5cbmNvbnN0IGxhbWJkYUNsaWVudCA9IG5ldyBMYW1iZGFDbGllbnQoeyByZWdpb246ICdldS13ZXN0LTEnIH0pO1xuY29uc3QgY2ZuQ2xpZW50ID0gbmV3IENsb3VkRm9ybWF0aW9uQ2xpZW50KHsgcmVnaW9uOiAnZXUtd2VzdC0xJyB9KTtcblxuLyoqXG4gKiBHZXQgdGhlIG1pZ3JhdGlvbiBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmcm9tIENsb3VkRm9ybWF0aW9uIHN0YWNrIG91dHB1dHNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0TWlncmF0aW9uRnVuY3Rpb25OYW1lKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnNvbGUubG9nKCfwn5OhIFJldHJpZXZpbmcgbWlncmF0aW9uIExhbWJkYSBmdW5jdGlvbiBuYW1lIGZyb20gQ2xvdWRGb3JtYXRpb24uLi4nKTtcblxuICBjb25zdCBjb21tYW5kID0gbmV3IERlc2NyaWJlU3RhY2tzQ29tbWFuZCh7XG4gICAgU3RhY2tOYW1lOiAnT3ZlcmxheVN0b3JhZ2VTdGFjaycsXG4gIH0pO1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2ZuQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gIGNvbnN0IHN0YWNrID0gcmVzcG9uc2UuU3RhY2tzPy5bMF07XG5cbiAgaWYgKCFzdGFjaykge1xuICAgIHRocm93IG5ldyBFcnJvcignT3ZlcmxheVN0b3JhZ2VTdGFjayBub3QgZm91bmQnKTtcbiAgfVxuXG4gIGNvbnN0IGZ1bmN0aW9uTmFtZU91dHB1dCA9IHN0YWNrLk91dHB1dHM/LmZpbmQoXG4gICAgb3V0cHV0ID0+IG91dHB1dC5PdXRwdXRLZXkgPT09ICdNaWdyYXRpb25GdW5jdGlvbk5hbWUnXG4gICk7XG5cbiAgaWYgKCFmdW5jdGlvbk5hbWVPdXRwdXQgfHwgIWZ1bmN0aW9uTmFtZU91dHB1dC5PdXRwdXRWYWx1ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignTWlncmF0aW9uRnVuY3Rpb25OYW1lIG91dHB1dCBub3QgZm91bmQgaW4gc3RhY2snKTtcbiAgfVxuXG4gIGNvbnNvbGUubG9nKGDinIUgRm91bmQgTGFtYmRhIGZ1bmN0aW9uOiAke2Z1bmN0aW9uTmFtZU91dHB1dC5PdXRwdXRWYWx1ZX1gKTtcbiAgcmV0dXJuIGZ1bmN0aW9uTmFtZU91dHB1dC5PdXRwdXRWYWx1ZTtcbn1cblxuLyoqXG4gKiBJbnZva2UgdGhlIG1pZ3JhdGlvbiBMYW1iZGEgZnVuY3Rpb25cbiAqL1xuYXN5bmMgZnVuY3Rpb24gaW52b2tlTWlncmF0aW9uTGFtYmRhKGZ1bmN0aW9uTmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnNvbGUubG9nKCdcXG7wn5qAIEludm9raW5nIGRhdGFiYXNlIG1pZ3JhdGlvbiBMYW1iZGEgZnVuY3Rpb24uLi4nKTtcbiAgY29uc29sZS5sb2coJ+KPsyBUaGlzIG1heSB0YWtlIHNldmVyYWwgbWludXRlcyBhcyBtaWdyYXRpb25zIGV4ZWN1dGUuLi5cXG4nKTtcblxuICBjb25zdCBjb21tYW5kID0gbmV3IEludm9rZUNvbW1hbmQoe1xuICAgIEZ1bmN0aW9uTmFtZTogZnVuY3Rpb25OYW1lLFxuICAgIEludm9jYXRpb25UeXBlOiAnUmVxdWVzdFJlc3BvbnNlJywgLy8gV2FpdCBmb3IgcmVzcG9uc2VcbiAgICBMb2dUeXBlOiAnVGFpbCcsIC8vIEdldCBDbG91ZFdhdGNoIGxvZ3NcbiAgfSk7XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBsYW1iZGFDbGllbnQuc2VuZChjb21tYW5kKTtcblxuICAvLyBEZWNvZGUgYmFzZTY0IGxvZ3NcbiAgaWYgKHJlc3BvbnNlLkxvZ1Jlc3VsdCkge1xuICAgIGNvbnN0IGxvZ3MgPSBCdWZmZXIuZnJvbShyZXNwb25zZS5Mb2dSZXN1bHQsICdiYXNlNjQnKS50b1N0cmluZygndXRmLTgnKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBMYW1iZGEgRXhlY3V0aW9uIExvZ3M6Jyk7XG4gICAgY29uc29sZS5sb2coJ+KUgCcucmVwZWF0KDgwKSk7XG4gICAgY29uc29sZS5sb2cobG9ncyk7XG4gICAgY29uc29sZS5sb2coJ+KUgCcucmVwZWF0KDgwKSk7XG4gIH1cblxuICAvLyBQYXJzZSByZXNwb25zZSBwYXlsb2FkXG4gIGlmIChyZXNwb25zZS5QYXlsb2FkKSB7XG4gICAgY29uc3QgcGF5bG9hZFN0cmluZyA9IEJ1ZmZlci5mcm9tKHJlc3BvbnNlLlBheWxvYWQpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnBhcnNlKHBheWxvYWRTdHJpbmcpO1xuXG4gICAgY29uc29sZS5sb2coJ1xcbvCfk4ogTWlncmF0aW9uIFJlc3VsdHM6Jyk7XG4gICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkocGF5bG9hZCwgbnVsbCwgMikpO1xuXG4gICAgaWYgKHBheWxvYWQuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShwYXlsb2FkLmJvZHkpO1xuXG4gICAgICBpZiAoYm9keS5zdWNjZXNzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdcXG7inIUgRGF0YWJhc2UgbWlncmF0aW9ucyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5IScpO1xuXG4gICAgICAgIGlmIChib2R5LnJlc3VsdHM/LnZlcmlmaWNhdGlvbikge1xuICAgICAgICAgIGNvbnN0IHRhYmxlcyA9IGJvZHkucmVzdWx0cy52ZXJpZmljYXRpb24udGFibGVzO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdcXG7wn5OIIERhdGFiYXNlIFZlcmlmaWNhdGlvbjonKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgICAgVG90YWwgVGFibGVzOiAke3RhYmxlcy5sZW5ndGh9YCk7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1xcbiAgIFRhYmxlcyBDcmVhdGVkOicpO1xuICAgICAgICAgIHRhYmxlcy5mb3JFYWNoKCh0YWJsZTogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgICAgLSAke3RhYmxlLnRhYmxlX25hbWV9ICgke3RhYmxlLnJvd19jb3VudH0gcm93cylgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignXFxu4p2MIE1pZ3JhdGlvbiBmYWlsZWQ6JywgYm9keS5lcnJvcik7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcignXFxu4p2MIExhbWJkYSBpbnZvY2F0aW9uIGZhaWxlZCB3aXRoIHN0YXR1cyBjb2RlOicsIHBheWxvYWQuc3RhdHVzQ29kZSk7XG4gICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hlY2sgZm9yIGZ1bmN0aW9uIGVycm9yc1xuICBpZiAocmVzcG9uc2UuRnVuY3Rpb25FcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1xcbuKdjCBMYW1iZGEgZnVuY3Rpb24gZXJyb3I6JywgcmVzcG9uc2UuRnVuY3Rpb25FcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG59XG5cbi8qKlxuICogTWFpbiBleGVjdXRpb25cbiAqL1xuYXN5bmMgZnVuY3Rpb24gbWFpbigpIHtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZygn8J+UpyBPdmVybGF5IFBsYXRmb3JtIC0gRGF0YWJhc2UgTWlncmF0aW9uIHZpYSBMYW1iZGFcXG4nKTtcblxuICAgIC8vIEdldCBMYW1iZGEgZnVuY3Rpb24gbmFtZSBmcm9tIENsb3VkRm9ybWF0aW9uXG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gYXdhaXQgZ2V0TWlncmF0aW9uRnVuY3Rpb25OYW1lKCk7XG5cbiAgICAvLyBJbnZva2UgdGhlIG1pZ3JhdGlvbiBMYW1iZGFcbiAgICBhd2FpdCBpbnZva2VNaWdyYXRpb25MYW1iZGEoZnVuY3Rpb25OYW1lKTtcblxuICAgIGNvbnNvbGUubG9nKCdcXG7inIUgTWlncmF0aW9uIHByb2Nlc3MgY29tcGxldGVkIHN1Y2Nlc3NmdWxseSEnKTtcbiAgICBjb25zb2xlLmxvZygnXFxu8J+TnSBOZXh0IFN0ZXBzOicpO1xuICAgIGNvbnNvbGUubG9nKCcgICAxLiBWZXJpZnkgdGFibGVzIGluIEF1cm9yYSB1c2luZyBwc3FsIG9yIFF1ZXJ5IEVkaXRvcicpO1xuICAgIGNvbnNvbGUubG9nKCcgICAyLiBDaGVjayBDbG91ZFdhdGNoIExvZ3MgZm9yIGRldGFpbGVkIGV4ZWN1dGlvbiBsb2dzJyk7XG4gICAgY29uc29sZS5sb2coJyAgIDMuIFJldmlldyB0aGUgc2VlZCBkYXRhIGluIHRoZSBkYXRhYmFzZScpO1xuICAgIGNvbnNvbGUubG9nKCcgICA0LiBEZXBsb3kgdGhlIGFwcGxpY2F0aW9uIHN0YWNrIChPdmVybGF5UGxhdGZvcm1TdGFjayknKTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1xcbuKdjCBFcnJvciBydW5uaW5nIGRhdGFiYXNlIG1pZ3JhdGlvbnM6JywgZXJyb3IpO1xuXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGRldGFpbHM6JywgZXJyb3IubWVzc2FnZSk7XG4gICAgICBjb25zb2xlLmVycm9yKCdcXG5TdGFjayB0cmFjZTonLCBlcnJvci5zdGFjayk7XG4gICAgfVxuXG4gICAgY29uc29sZS5lcnJvcignXFxu8J+UjSBUcm91Ymxlc2hvb3Rpbmc6Jyk7XG4gICAgY29uc29sZS5lcnJvcignICAgMS4gRW5zdXJlIE92ZXJsYXlTdG9yYWdlU3RhY2sgaXMgZGVwbG95ZWQ6IGNkayBkZXBsb3kgT3ZlcmxheVN0b3JhZ2VTdGFjaycpO1xuICAgIGNvbnNvbGUuZXJyb3IoJyAgIDIuIENoZWNrIHRoYXQgTGFtYmRhIGhhcyBWUEMgY29ubmVjdGl2aXR5IHRvIEF1cm9yYScpO1xuICAgIGNvbnNvbGUuZXJyb3IoJyAgIDMuIFZlcmlmeSBzZWN1cml0eSBncm91cCBydWxlcyBhbGxvdyBMYW1iZGEg4oaSIEF1cm9yYSAocG9ydCA1NDMyKScpO1xuICAgIGNvbnNvbGUuZXJyb3IoJyAgIDQuIENoZWNrIENsb3VkV2F0Y2ggTG9ncyBmb3IgTGFtYmRhIGV4ZWN1dGlvbiBlcnJvcnMnKTtcbiAgICBjb25zb2xlLmVycm9yKCcgICA1LiBFbnN1cmUgQXVyb3JhIGNsdXN0ZXIgaXMgaW4gXCJhdmFpbGFibGVcIiBzdGF0ZScpO1xuXG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG59XG5cbm1haW4oKTtcbiJdfQ==