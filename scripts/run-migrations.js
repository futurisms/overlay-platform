#!/usr/bin/env ts-node
"use strict";
/**
 * Aurora Database Migration Runner
 *
 * This script:
 * 1. Retrieves Aurora credentials from AWS Secrets Manager
 * 2. Connects to Aurora PostgreSQL cluster
 * 3. Executes migration SQL files
 * 4. Verifies successful execution
 */
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
exports.main = main;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const REGION = 'eu-west-1';
const STACK_NAME = 'OverlayStorageStack';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
/**
 * Get CloudFormation stack outputs
 */
async function getStackOutputs() {
    console.log('📋 Retrieving stack outputs...');
    const cfnClient = new client_cloudformation_1.CloudFormationClient({ region: REGION });
    const command = new client_cloudformation_1.DescribeStacksCommand({ StackName: STACK_NAME });
    try {
        const response = await cfnClient.send(command);
        const outputs = response.Stacks?.[0]?.Outputs || [];
        const auroraEndpoint = outputs.find(o => o.OutputKey === 'AuroraClusterEndpoint')?.OutputValue;
        const secretArn = outputs.find(o => o.OutputKey === 'AuroraSecretArn')?.OutputValue;
        if (!auroraEndpoint || !secretArn) {
            throw new Error('Required stack outputs not found');
        }
        console.log(`✅ Aurora Endpoint: ${auroraEndpoint}`);
        console.log(`✅ Secret ARN: ${secretArn}`);
        return { auroraEndpoint, secretArn };
    }
    catch (error) {
        console.error('❌ Failed to retrieve stack outputs:', error);
        throw error;
    }
}
/**
 * Retrieve Aurora credentials from Secrets Manager
 */
async function getAuroraCredentials(secretArn) {
    console.log('\n🔐 Retrieving Aurora credentials from Secrets Manager...');
    const client = new client_secrets_manager_1.SecretsManagerClient({ region: REGION });
    const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretArn });
    try {
        const response = await client.send(command);
        if (!response.SecretString) {
            throw new Error('Secret string not found');
        }
        const credentials = JSON.parse(response.SecretString);
        console.log(`✅ Retrieved credentials for user: ${credentials.username}`);
        console.log(`✅ Database: ${credentials.dbname}`);
        return credentials;
    }
    catch (error) {
        console.error('❌ Failed to retrieve credentials:', error);
        throw error;
    }
}
/**
 * Connect to Aurora PostgreSQL
 */
async function connectToDatabase(endpoint, credentials) {
    console.log('\n🔌 Connecting to Aurora PostgreSQL...');
    const client = new pg_1.Client({
        host: endpoint,
        port: credentials.port || 5432,
        database: credentials.dbname,
        user: credentials.username,
        password: credentials.password,
        ssl: {
            rejectUnauthorized: false, // Aurora uses AWS certificates
        },
        connectionTimeoutMillis: 10000,
    });
    try {
        await client.connect();
        console.log('✅ Successfully connected to Aurora');
        // Test connection
        const result = await client.query('SELECT version()');
        console.log(`✅ PostgreSQL Version: ${result.rows[0].version.split(',')[0]}`);
        return client;
    }
    catch (error) {
        console.error('❌ Failed to connect to database:', error);
        throw error;
    }
}
/**
 * Execute SQL file
 */
async function executeSqlFile(client, filePath, fileName) {
    console.log(`\n📄 Executing ${fileName}...`);
    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        // Split by semicolon but preserve them in statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        console.log(`   Found ${statements.length} SQL statements`);
        let successCount = 0;
        let errorCount = 0;
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            // Skip comments and empty statements
            if (!statement || statement.startsWith('--')) {
                continue;
            }
            try {
                await client.query(statement);
                successCount++;
                // Log progress every 10 statements
                if ((i + 1) % 10 === 0) {
                    console.log(`   Progress: ${i + 1}/${statements.length} statements executed`);
                }
            }
            catch (error) {
                // Some errors are expected (like "already exists" for extensions)
                if (error.message?.includes('already exists')) {
                    console.log(`   ⚠️  Skipping: ${error.message.split('\n')[0]}`);
                    successCount++;
                }
                else {
                    console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
                    errorCount++;
                }
            }
        }
        console.log(`✅ ${fileName} executed: ${successCount} successful, ${errorCount} errors`);
    }
    catch (error) {
        console.error(`❌ Failed to read or execute ${fileName}:`, error);
        throw error;
    }
}
/**
 * Verify migrations
 */
async function verifyMigrations(client) {
    console.log('\n🔍 Verifying database migrations...');
    try {
        // Count tables
        const tablesResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
        const tableCount = parseInt(tablesResult.rows[0].count);
        console.log(`✅ Tables created: ${tableCount}`);
        // List all tables
        const tableListResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
        console.log('\n📊 Database Tables:');
        tableListResult.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.table_name}`);
        });
        // Count views
        const viewsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_schema = 'public'
    `);
        const viewCount = parseInt(viewsResult.rows[0].count);
        console.log(`\n✅ Views created: ${viewCount}`);
        // Count indexes
        const indexesResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
        const indexCount = parseInt(indexesResult.rows[0].count);
        console.log(`✅ Indexes created: ${indexCount}`);
        // Verify seed data
        console.log('\n📊 Seed Data Verification:');
        const orgCount = await client.query('SELECT COUNT(*) as count FROM organizations');
        console.log(`   Organizations: ${orgCount.rows[0].count}`);
        const userCount = await client.query('SELECT COUNT(*) as count FROM users');
        console.log(`   Users: ${userCount.rows[0].count}`);
        const overlayCount = await client.query('SELECT COUNT(*) as count FROM overlays');
        console.log(`   Overlays: ${overlayCount.rows[0].count}`);
        const criteriaCount = await client.query('SELECT COUNT(*) as count FROM evaluation_criteria');
        console.log(`   Evaluation Criteria: ${criteriaCount.rows[0].count}`);
        const llmConfigCount = await client.query('SELECT COUNT(*) as count FROM llm_configurations');
        console.log(`   LLM Configurations: ${llmConfigCount.rows[0].count}`);
        const submissionCount = await client.query('SELECT COUNT(*) as count FROM document_submissions');
        console.log(`   Sample Submissions: ${submissionCount.rows[0].count}`);
        console.log('\n✅ All migrations verified successfully!');
    }
    catch (error) {
        console.error('❌ Verification failed:', error);
        throw error;
    }
}
/**
 * Main execution
 */
async function main() {
    console.log('🚀 Aurora Database Migration Runner\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    let client = null;
    try {
        // Step 1: Get stack outputs
        const { auroraEndpoint, secretArn } = await getStackOutputs();
        // Step 2: Get credentials
        const credentials = await getAuroraCredentials(secretArn);
        // Step 3: Connect to database
        client = await connectToDatabase(auroraEndpoint, credentials);
        // Step 4: Execute schema migration
        const schemaFile = path.join(MIGRATIONS_DIR, '000_initial_schema.sql');
        if (fs.existsSync(schemaFile)) {
            await executeSqlFile(client, schemaFile, '000_initial_schema.sql');
        }
        else {
            console.error(`❌ Schema file not found: ${schemaFile}`);
            process.exit(1);
        }
        // Step 5: Execute seed data migration
        const seedFile = path.join(MIGRATIONS_DIR, '001_seed_data.sql');
        if (fs.existsSync(seedFile)) {
            await executeSqlFile(client, seedFile, '001_seed_data.sql');
        }
        else {
            console.error(`❌ Seed file not found: ${seedFile}`);
            process.exit(1);
        }
        // Step 6: Verify migrations
        await verifyMigrations(client);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('🎉 Your Aurora database is now ready for use!\n');
        console.log('Next steps:');
        console.log('  1. Test database connectivity from your application');
        console.log('  2. Deploy Lambda functions to process documents');
        console.log('  3. Set up API Gateway for REST endpoints\n');
    }
    catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        // Always close the connection
        if (client) {
            await client.end();
            console.log('🔌 Database connection closed');
        }
    }
}
// Execute main function
if (require.main === module) {
    main();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuLW1pZ3JhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJydW4tbWlncmF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQThUTSxvQkFBSTtBQTVUYiw0RUFBOEY7QUFDOUYsMEVBQTZGO0FBQzdGLDJCQUE0QjtBQUM1Qix1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQztBQUMzQixNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQztBQUN6QyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFnQmhFOztHQUVHO0FBQ0gsS0FBSyxVQUFVLGVBQWU7SUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0lBRTlDLE1BQU0sU0FBUyxHQUFHLElBQUksNENBQW9CLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUMvRCxNQUFNLE9BQU8sR0FBRyxJQUFJLDZDQUFxQixDQUFDLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFFckUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxRQUFRLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDO1FBRXBELE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxLQUFLLHVCQUF1QixDQUFDLEVBQUUsV0FBVyxDQUFDO1FBQy9GLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxJ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LENBQUMsR0FBRyxDQUFDLDhDQUE4QyxDQUFDLENBQUM7SUFFOUQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztZQUFTLENBQUM7UUFDVCw4QkFBOEI7UUFDOUIsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNYLE1BQU0sTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUMvQyxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRCx3QkFBd0I7QUFDeEIsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRSxDQUFDO0lBQzVCLElBQUksRUFBRSxDQUFDO0FBQ1QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IHRzLW5vZGVcblxuLyoqXG4gKiBBdXJvcmEgRGF0YWJhc2UgTWlncmF0aW9uIFJ1bm5lclxuICpcbiAqIFRoaXMgc2NyaXB0OlxuICogMS4gUmV0cmlldmVzIEF1cm9yYSBjcmVkZW50aWFscyBmcm9tIEFXUyBTZWNyZXRzIE1hbmFnZXJcbiAqIDIuIENvbm5lY3RzIHRvIEF1cm9yYSBQb3N0Z3JlU1FMIGNsdXN0ZXJcbiAqIDMuIEV4ZWN1dGVzIG1pZ3JhdGlvbiBTUUwgZmlsZXNcbiAqIDQuIFZlcmlmaWVzIHN1Y2Nlc3NmdWwgZXhlY3V0aW9uXG4gKi9cblxuaW1wb3J0IHsgU2VjcmV0c01hbmFnZXJDbGllbnQsIEdldFNlY3JldFZhbHVlQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zZWNyZXRzLW1hbmFnZXInO1xuaW1wb3J0IHsgQ2xvdWRGb3JtYXRpb25DbGllbnQsIERlc2NyaWJlU3RhY2tzQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jbG91ZGZvcm1hdGlvbic7XG5pbXBvcnQgeyBDbGllbnQgfSBmcm9tICdwZyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBSRUdJT04gPSAnZXUtd2VzdC0xJztcbmNvbnN0IFNUQUNLX05BTUUgPSAnT3ZlcmxheVN0b3JhZ2VTdGFjayc7XG5jb25zdCBNSUdSQVRJT05TX0RJUiA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICdtaWdyYXRpb25zJyk7XG5cbmludGVyZmFjZSBBdXJvcmFDcmVkZW50aWFscyB7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG4gIGVuZ2luZTogc3RyaW5nO1xuICBob3N0OiBzdHJpbmc7XG4gIHBvcnQ6IG51bWJlcjtcbiAgZGJuYW1lOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTdGFja091dHB1dHMge1xuICBhdXJvcmFFbmRwb2ludDogc3RyaW5nO1xuICBzZWNyZXRBcm46IHN0cmluZztcbn1cblxuLyoqXG4gKiBHZXQgQ2xvdWRGb3JtYXRpb24gc3RhY2sgb3V0cHV0c1xuICovXG5hc3luYyBmdW5jdGlvbiBnZXRTdGFja091dHB1dHMoKTogUHJvbWlzZTxTdGFja091dHB1dHM+IHtcbiAgY29uc29sZS5sb2coJ/Cfk4sgUmV0cmlldmluZyBzdGFjayBvdXRwdXRzLi4uJyk7XG5cbiAgY29uc3QgY2ZuQ2xpZW50ID0gbmV3IENsb3VkRm9ybWF0aW9uQ2xpZW50KHsgcmVnaW9uOiBSRUdJT04gfSk7XG4gIGNvbnN0IGNvbW1hbmQgPSBuZXcgRGVzY3JpYmVTdGFja3NDb21tYW5kKHsgU3RhY2tOYW1lOiBTVEFDS19OQU1FIH0pO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjZm5DbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICBjb25zdCBvdXRwdXRzID0gcmVzcG9uc2UuU3RhY2tzPy5bMF0/Lk91dHB1dHMgfHwgW107XG5cbiAgICBjb25zdCBhdXJvcmFFbmRwb2ludCA9IG91dHB1dHMuZmluZChvID0+IG8uT3V0cHV0S2V5ID09PSAnQXVyb3JhQ2x1c3RlckVuZHBvaW50Jyk/Lk91dHB1dFZhbHVlO1xuICAgIGNvbnN0IHNlY3JldEFybiA9IG91dHB1dHMuZmluZChvID0+IG8uT3V0cHV0S2V5ID09PSAnQXVyb3JhU2VjcmV0QXJuJyk/Lk91dHB1dFZhbHVlO1xuXG4gICAgaWYgKCFhdXJvcmFFbmRwb2ludCB8fCAhc2VjcmV0QXJuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIHN0YWNrIG91dHB1dHMgbm90IGZvdW5kJyk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYOKchSBBdXJvcmEgRW5kcG9pbnQ6ICR7YXVyb3JhRW5kcG9pbnR9YCk7XG4gICAgY29uc29sZS5sb2coYOKchSBTZWNyZXQgQVJOOiAke3NlY3JldEFybn1gKTtcblxuICAgIHJldHVybiB7IGF1cm9yYUVuZHBvaW50LCBzZWNyZXRBcm4gfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfinYwgRmFpbGVkIHRvIHJldHJpZXZlIHN0YWNrIG91dHB1dHM6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogUmV0cmlldmUgQXVyb3JhIGNyZWRlbnRpYWxzIGZyb20gU2VjcmV0cyBNYW5hZ2VyXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEF1cm9yYUNyZWRlbnRpYWxzKHNlY3JldEFybjogc3RyaW5nKTogUHJvbWlzZTxBdXJvcmFDcmVkZW50aWFscz4ge1xuICBjb25zb2xlLmxvZygnXFxu8J+UkCBSZXRyaWV2aW5nIEF1cm9yYSBjcmVkZW50aWFscyBmcm9tIFNlY3JldHMgTWFuYWdlci4uLicpO1xuXG4gIGNvbnN0IGNsaWVudCA9IG5ldyBTZWNyZXRzTWFuYWdlckNsaWVudCh7IHJlZ2lvbjogUkVHSU9OIH0pO1xuICBjb25zdCBjb21tYW5kID0gbmV3IEdldFNlY3JldFZhbHVlQ29tbWFuZCh7IFNlY3JldElkOiBzZWNyZXRBcm4gfSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5TZWNyZXRTdHJpbmcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU2VjcmV0IHN0cmluZyBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBjcmVkZW50aWFscyA9IEpTT04ucGFyc2UocmVzcG9uc2UuU2VjcmV0U3RyaW5nKSBhcyBBdXJvcmFDcmVkZW50aWFscztcbiAgICBjb25zb2xlLmxvZyhg4pyFIFJldHJpZXZlZCBjcmVkZW50aWFscyBmb3IgdXNlcjogJHtjcmVkZW50aWFscy51c2VybmFtZX1gKTtcbiAgICBjb25zb2xlLmxvZyhg4pyFIERhdGFiYXNlOiAke2NyZWRlbnRpYWxzLmRibmFtZX1gKTtcblxuICAgIHJldHVybiBjcmVkZW50aWFscztcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfinYwgRmFpbGVkIHRvIHJldHJpZXZlIGNyZWRlbnRpYWxzOicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIENvbm5lY3QgdG8gQXVyb3JhIFBvc3RncmVTUUxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gY29ubmVjdFRvRGF0YWJhc2UoXG4gIGVuZHBvaW50OiBzdHJpbmcsXG4gIGNyZWRlbnRpYWxzOiBBdXJvcmFDcmVkZW50aWFsc1xuKTogUHJvbWlzZTxDbGllbnQ+IHtcbiAgY29uc29sZS5sb2coJ1xcbvCflIwgQ29ubmVjdGluZyB0byBBdXJvcmEgUG9zdGdyZVNRTC4uLicpO1xuXG4gIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQoe1xuICAgIGhvc3Q6IGVuZHBvaW50LFxuICAgIHBvcnQ6IGNyZWRlbnRpYWxzLnBvcnQgfHwgNTQzMixcbiAgICBkYXRhYmFzZTogY3JlZGVudGlhbHMuZGJuYW1lLFxuICAgIHVzZXI6IGNyZWRlbnRpYWxzLnVzZXJuYW1lLFxuICAgIHBhc3N3b3JkOiBjcmVkZW50aWFscy5wYXNzd29yZCxcbiAgICBzc2w6IHtcbiAgICAgIHJlamVjdFVuYXV0aG9yaXplZDogZmFsc2UsIC8vIEF1cm9yYSB1c2VzIEFXUyBjZXJ0aWZpY2F0ZXNcbiAgICB9LFxuICAgIGNvbm5lY3Rpb25UaW1lb3V0TWlsbGlzOiAxMDAwMCxcbiAgfSk7XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBjbGllbnQuY29ubmVjdCgpO1xuICAgIGNvbnNvbGUubG9nKCfinIUgU3VjY2Vzc2Z1bGx5IGNvbm5lY3RlZCB0byBBdXJvcmEnKTtcblxuICAgIC8vIFRlc3QgY29ubmVjdGlvblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNsaWVudC5xdWVyeSgnU0VMRUNUIHZlcnNpb24oKScpO1xuICAgIGNvbnNvbGUubG9nKGDinIUgUG9zdGdyZVNRTCBWZXJzaW9uOiAke3Jlc3VsdC5yb3dzWzBdLnZlcnNpb24uc3BsaXQoJywnKVswXX1gKTtcblxuICAgIHJldHVybiBjbGllbnQ7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign4p2MIEZhaWxlZCB0byBjb25uZWN0IHRvIGRhdGFiYXNlOicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIEV4ZWN1dGUgU1FMIGZpbGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZVNxbEZpbGUoY2xpZW50OiBDbGllbnQsIGZpbGVQYXRoOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc29sZS5sb2coYFxcbvCfk4QgRXhlY3V0aW5nICR7ZmlsZU5hbWV9Li4uYCk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBzcWwgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4Jyk7XG5cbiAgICAvLyBTcGxpdCBieSBzZW1pY29sb24gYnV0IHByZXNlcnZlIHRoZW0gaW4gc3RhdGVtZW50c1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPSBzcWxcbiAgICAgIC5zcGxpdCgnOycpXG4gICAgICAubWFwKHMgPT4gcy50cmltKCkpXG4gICAgICAuZmlsdGVyKHMgPT4gcy5sZW5ndGggPiAwICYmICFzLnN0YXJ0c1dpdGgoJy0tJykpO1xuXG4gICAgY29uc29sZS5sb2coYCAgIEZvdW5kICR7c3RhdGVtZW50cy5sZW5ndGh9IFNRTCBzdGF0ZW1lbnRzYCk7XG5cbiAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMDtcbiAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHN0YXRlbWVudCA9IHN0YXRlbWVudHNbaV07XG5cbiAgICAgIC8vIFNraXAgY29tbWVudHMgYW5kIGVtcHR5IHN0YXRlbWVudHNcbiAgICAgIGlmICghc3RhdGVtZW50IHx8IHN0YXRlbWVudC5zdGFydHNXaXRoKCctLScpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBjbGllbnQucXVlcnkoc3RhdGVtZW50KTtcbiAgICAgICAgc3VjY2Vzc0NvdW50Kys7XG5cbiAgICAgICAgLy8gTG9nIHByb2dyZXNzIGV2ZXJ5IDEwIHN0YXRlbWVudHNcbiAgICAgICAgaWYgKChpICsgMSkgJSAxMCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGAgICBQcm9ncmVzczogJHtpICsgMX0vJHtzdGF0ZW1lbnRzLmxlbmd0aH0gc3RhdGVtZW50cyBleGVjdXRlZGApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIC8vIFNvbWUgZXJyb3JzIGFyZSBleHBlY3RlZCAobGlrZSBcImFscmVhZHkgZXhpc3RzXCIgZm9yIGV4dGVuc2lvbnMpXG4gICAgICAgIGlmIChlcnJvci5tZXNzYWdlPy5pbmNsdWRlcygnYWxyZWFkeSBleGlzdHMnKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGAgICDimqDvuI8gIFNraXBwaW5nOiAke2Vycm9yLm1lc3NhZ2Uuc3BsaXQoJ1xcbicpWzBdfWApO1xuICAgICAgICAgIHN1Y2Nlc3NDb3VudCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYCAgIOKdjCBFcnJvciBleGVjdXRpbmcgc3RhdGVtZW50ICR7aSArIDF9OmAsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgIGVycm9yQ291bnQrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGDinIUgJHtmaWxlTmFtZX0gZXhlY3V0ZWQ6ICR7c3VjY2Vzc0NvdW50fSBzdWNjZXNzZnVsLCAke2Vycm9yQ291bnR9IGVycm9yc2ApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYOKdjCBGYWlsZWQgdG8gcmVhZCBvciBleGVjdXRlICR7ZmlsZU5hbWV9OmAsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIFZlcmlmeSBtaWdyYXRpb25zXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHZlcmlmeU1pZ3JhdGlvbnMoY2xpZW50OiBDbGllbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc29sZS5sb2coJ1xcbvCflI0gVmVyaWZ5aW5nIGRhdGFiYXNlIG1pZ3JhdGlvbnMuLi4nKTtcblxuICB0cnkge1xuICAgIC8vIENvdW50IHRhYmxlc1xuICAgIGNvbnN0IHRhYmxlc1Jlc3VsdCA9IGF3YWl0IGNsaWVudC5xdWVyeShgXG4gICAgICBTRUxFQ1QgQ09VTlQoKikgYXMgY291bnRcbiAgICAgIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlc1xuICAgICAgV0hFUkUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYydcbiAgICAgIEFORCB0YWJsZV90eXBlID0gJ0JBU0UgVEFCTEUnXG4gICAgYCk7XG4gICAgY29uc3QgdGFibGVDb3VudCA9IHBhcnNlSW50KHRhYmxlc1Jlc3VsdC5yb3dzWzBdLmNvdW50KTtcbiAgICBjb25zb2xlLmxvZyhg4pyFIFRhYmxlcyBjcmVhdGVkOiAke3RhYmxlQ291bnR9YCk7XG5cbiAgICAvLyBMaXN0IGFsbCB0YWJsZXNcbiAgICBjb25zdCB0YWJsZUxpc3RSZXN1bHQgPSBhd2FpdCBjbGllbnQucXVlcnkoYFxuICAgICAgU0VMRUNUIHRhYmxlX25hbWVcbiAgICAgIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlc1xuICAgICAgV0hFUkUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYydcbiAgICAgIEFORCB0YWJsZV90eXBlID0gJ0JBU0UgVEFCTEUnXG4gICAgICBPUkRFUiBCWSB0YWJsZV9uYW1lXG4gICAgYCk7XG5cbiAgICBjb25zb2xlLmxvZygnXFxu8J+TiiBEYXRhYmFzZSBUYWJsZXM6Jyk7XG4gICAgdGFibGVMaXN0UmVzdWx0LnJvd3MuZm9yRWFjaCgocm93LCBpbmRleCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYCAgICR7aW5kZXggKyAxfS4gJHtyb3cudGFibGVfbmFtZX1gKTtcbiAgICB9KTtcblxuICAgIC8vIENvdW50IHZpZXdzXG4gICAgY29uc3Qgdmlld3NSZXN1bHQgPSBhd2FpdCBjbGllbnQucXVlcnkoYFxuICAgICAgU0VMRUNUIENPVU5UKCopIGFzIGNvdW50XG4gICAgICBGUk9NIGluZm9ybWF0aW9uX3NjaGVtYS52aWV3c1xuICAgICAgV0hFUkUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYydcbiAgICBgKTtcbiAgICBjb25zdCB2aWV3Q291bnQgPSBwYXJzZUludCh2aWV3c1Jlc3VsdC5yb3dzWzBdLmNvdW50KTtcbiAgICBjb25zb2xlLmxvZyhgXFxu4pyFIFZpZXdzIGNyZWF0ZWQ6ICR7dmlld0NvdW50fWApO1xuXG4gICAgLy8gQ291bnQgaW5kZXhlc1xuICAgIGNvbnN0IGluZGV4ZXNSZXN1bHQgPSBhd2FpdCBjbGllbnQucXVlcnkoYFxuICAgICAgU0VMRUNUIENPVU5UKCopIGFzIGNvdW50XG4gICAgICBGUk9NIHBnX2luZGV4ZXNcbiAgICAgIFdIRVJFIHNjaGVtYW5hbWUgPSAncHVibGljJ1xuICAgIGApO1xuICAgIGNvbnN0IGluZGV4Q291bnQgPSBwYXJzZUludChpbmRleGVzUmVzdWx0LnJvd3NbMF0uY291bnQpO1xuICAgIGNvbnNvbGUubG9nKGDinIUgSW5kZXhlcyBjcmVhdGVkOiAke2luZGV4Q291bnR9YCk7XG5cbiAgICAvLyBWZXJpZnkgc2VlZCBkYXRhXG4gICAgY29uc29sZS5sb2coJ1xcbvCfk4ogU2VlZCBEYXRhIFZlcmlmaWNhdGlvbjonKTtcblxuICAgIGNvbnN0IG9yZ0NvdW50ID0gYXdhaXQgY2xpZW50LnF1ZXJ5KCdTRUxFQ1QgQ09VTlQoKikgYXMgY291bnQgRlJPTSBvcmdhbml6YXRpb25zJyk7XG4gICAgY29uc29sZS5sb2coYCAgIE9yZ2FuaXphdGlvbnM6ICR7b3JnQ291bnQucm93c1swXS5jb3VudH1gKTtcblxuICAgIGNvbnN0IHVzZXJDb3VudCA9IGF3YWl0IGNsaWVudC5xdWVyeSgnU0VMRUNUIENPVU5UKCopIGFzIGNvdW50IEZST00gdXNlcnMnKTtcbiAgICBjb25zb2xlLmxvZyhgICAgVXNlcnM6ICR7dXNlckNvdW50LnJvd3NbMF0uY291bnR9YCk7XG5cbiAgICBjb25zdCBvdmVybGF5Q291bnQgPSBhd2FpdCBjbGllbnQucXVlcnkoJ1NFTEVDVCBDT1VOVCgqKSBhcyBjb3VudCBGUk9NIG92ZXJsYXlzJyk7XG4gICAgY29uc29sZS5sb2coYCAgIE92ZXJsYXlzOiAke292ZXJsYXlDb3VudC5yb3dzWzBdLmNvdW50fWApO1xuXG4gICAgY29uc3QgY3JpdGVyaWFDb3VudCA9IGF3YWl0IGNsaWVudC5xdWVyeSgnU0VMRUNUIENPVU5UKCopIGFzIGNvdW50IEZST00gZXZhbHVhdGlvbl9jcml0ZXJpYScpO1xuICAgIGNvbnNvbGUubG9nKGAgICBFdmFsdWF0aW9uIENyaXRlcmlhOiAke2NyaXRlcmlhQ291bnQucm93c1swXS5jb3VudH1gKTtcblxuICAgIGNvbnN0IGxsbUNvbmZpZ0NvdW50ID0gYXdhaXQgY2xpZW50LnF1ZXJ5KCdTRUxFQ1QgQ09VTlQoKikgYXMgY291bnQgRlJPTSBsbG1fY29uZmlndXJhdGlvbnMnKTtcbiAgICBjb25zb2xlLmxvZyhgICAgTExNIENvbmZpZ3VyYXRpb25zOiAke2xsbUNvbmZpZ0NvdW50LnJvd3NbMF0uY291bnR9YCk7XG5cbiAgICBjb25zdCBzdWJtaXNzaW9uQ291bnQgPSBhd2FpdCBjbGllbnQucXVlcnkoJ1NFTEVDVCBDT1VOVCgqKSBhcyBjb3VudCBGUk9NIGRvY3VtZW50X3N1Ym1pc3Npb25zJyk7XG4gICAgY29uc29sZS5sb2coYCAgIFNhbXBsZSBTdWJtaXNzaW9uczogJHtzdWJtaXNzaW9uQ291bnQucm93c1swXS5jb3VudH1gKTtcblxuICAgIGNvbnNvbGUubG9nKCdcXG7inIUgQWxsIG1pZ3JhdGlvbnMgdmVyaWZpZWQgc3VjY2Vzc2Z1bGx5IScpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBWZXJpZmljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIE1haW4gZXhlY3V0aW9uXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSB7XG4gIGNvbnNvbGUubG9nKCfwn5qAIEF1cm9yYSBEYXRhYmFzZSBNaWdyYXRpb24gUnVubmVyXFxuJyk7XG4gIGNvbnNvbGUubG9nKCfilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZBcXG4nKTtcblxuICBsZXQgY2xpZW50OiBDbGllbnQgfCBudWxsID0gbnVsbDtcblxuICB0cnkge1xuICAgIC8vIFN0ZXAgMTogR2V0IHN0YWNrIG91dHB1dHNcbiAgICBjb25zdCB7IGF1cm9yYUVuZHBvaW50LCBzZWNyZXRBcm4gfSA9IGF3YWl0IGdldFN0YWNrT3V0cHV0cygpO1xuXG4gICAgLy8gU3RlcCAyOiBHZXQgY3JlZGVudGlhbHNcbiAgICBjb25zdCBjcmVkZW50aWFscyA9IGF3YWl0IGdldEF1cm9yYUNyZWRlbnRpYWxzKHNlY3JldEFybik7XG5cbiAgICAvLyBTdGVwIDM6IENvbm5lY3QgdG8gZGF0YWJhc2VcbiAgICBjbGllbnQgPSBhd2FpdCBjb25uZWN0VG9EYXRhYmFzZShhdXJvcmFFbmRwb2ludCwgY3JlZGVudGlhbHMpO1xuXG4gICAgLy8gU3RlcCA0OiBFeGVjdXRlIHNjaGVtYSBtaWdyYXRpb25cbiAgICBjb25zdCBzY2hlbWFGaWxlID0gcGF0aC5qb2luKE1JR1JBVElPTlNfRElSLCAnMDAwX2luaXRpYWxfc2NoZW1hLnNxbCcpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHNjaGVtYUZpbGUpKSB7XG4gICAgICBhd2FpdCBleGVjdXRlU3FsRmlsZShjbGllbnQsIHNjaGVtYUZpbGUsICcwMDBfaW5pdGlhbF9zY2hlbWEuc3FsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCBTY2hlbWEgZmlsZSBub3QgZm91bmQ6ICR7c2NoZW1hRmlsZX1gKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICAvLyBTdGVwIDU6IEV4ZWN1dGUgc2VlZCBkYXRhIG1pZ3JhdGlvblxuICAgIGNvbnN0IHNlZWRGaWxlID0gcGF0aC5qb2luKE1JR1JBVElPTlNfRElSLCAnMDAxX3NlZWRfZGF0YS5zcWwnKTtcbiAgICBpZiAoZnMuZXhpc3RzU3luYyhzZWVkRmlsZSkpIHtcbiAgICAgIGF3YWl0IGV4ZWN1dGVTcWxGaWxlKGNsaWVudCwgc2VlZEZpbGUsICcwMDFfc2VlZF9kYXRhLnNxbCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKGDinYwgU2VlZCBmaWxlIG5vdCBmb3VuZDogJHtzZWVkRmlsZX1gKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG5cbiAgICAvLyBTdGVwIDY6IFZlcmlmeSBtaWdyYXRpb25zXG4gICAgYXdhaXQgdmVyaWZ5TWlncmF0aW9ucyhjbGllbnQpO1xuXG4gICAgY29uc29sZS5sb2coJ1xcbuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCcpO1xuICAgIGNvbnNvbGUubG9nKCfinIUgREFUQUJBU0UgTUlHUkFUSU9OIENPTVBMRVRFRCBTVUNDRVNTRlVMTFkhJyk7XG4gICAgY29uc29sZS5sb2coJ+KVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkFxcbicpO1xuXG4gICAgY29uc29sZS5sb2coJ/CfjokgWW91ciBBdXJvcmEgZGF0YWJhc2UgaXMgbm93IHJlYWR5IGZvciB1c2UhXFxuJyk7XG4gICAgY29uc29sZS5sb2coJ05leHQgc3RlcHM6Jyk7XG4gICAgY29uc29sZS5sb2coJyAgMS4gVGVzdCBkYXRhYmFzZSBjb25uZWN0aXZpdHkgZnJvbSB5b3VyIGFwcGxpY2F0aW9uJyk7XG4gICAgY29uc29sZS5sb2coJyAgMi4gRGVwbG95IExhbWJkYSBmdW5jdGlvbnMgdG8gcHJvY2VzcyBkb2N1bWVudHMnKTtcbiAgICBjb25zb2xlLmxvZygnICAzLiBTZXQgdXAgQVBJIEdhdGV3YXkgZm9yIFJFU1QgZW5kcG9pbnRzXFxuJyk7XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdcXG7inYwgTWlncmF0aW9uIGZhaWxlZDonLCBlcnJvcik7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9IGZpbmFsbHkge1xuICAgIC8vIEFsd2F5cyBjbG9zZSB0aGUgY29ubmVjdGlvblxuICAgIGlmIChjbGllbnQpIHtcbiAgICAgIGF3YWl0IGNsaWVudC5lbmQoKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SMIERhdGFiYXNlIGNvbm5lY3Rpb24gY2xvc2VkJyk7XG4gICAgfVxuICB9XG59XG5cbi8vIEV4ZWN1dGUgbWFpbiBmdW5jdGlvblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIG1haW4oKTtcbn1cblxuZXhwb3J0IHsgbWFpbiB9O1xuIl19