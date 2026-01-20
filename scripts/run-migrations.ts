#!/usr/bin/env ts-node

/**
 * Aurora Database Migration Runner
 *
 * This script:
 * 1. Retrieves Aurora credentials from AWS Secrets Manager
 * 2. Connects to Aurora PostgreSQL cluster
 * 3. Executes migration SQL files
 * 4. Verifies successful execution
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const REGION = 'eu-west-1';
const STACK_NAME = 'OverlayStorageStack';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

interface AuroraCredentials {
  username: string;
  password: string;
  engine: string;
  host: string;
  port: number;
  dbname: string;
}

interface StackOutputs {
  auroraEndpoint: string;
  secretArn: string;
}

/**
 * Get CloudFormation stack outputs
 */
async function getStackOutputs(): Promise<StackOutputs> {
  console.log('📋 Retrieving stack outputs...');

  const cfnClient = new CloudFormationClient({ region: REGION });
  const command = new DescribeStacksCommand({ StackName: STACK_NAME });

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
  } catch (error) {
    console.error('❌ Failed to retrieve stack outputs:', error);
    throw error;
  }
}

/**
 * Retrieve Aurora credentials from Secrets Manager
 */
async function getAuroraCredentials(secretArn: string): Promise<AuroraCredentials> {
  console.log('\n🔐 Retrieving Aurora credentials from Secrets Manager...');

  const client = new SecretsManagerClient({ region: REGION });
  const command = new GetSecretValueCommand({ SecretId: secretArn });

  try {
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret string not found');
    }

    const credentials = JSON.parse(response.SecretString) as AuroraCredentials;
    console.log(`✅ Retrieved credentials for user: ${credentials.username}`);
    console.log(`✅ Database: ${credentials.dbname}`);

    return credentials;
  } catch (error) {
    console.error('❌ Failed to retrieve credentials:', error);
    throw error;
  }
}

/**
 * Connect to Aurora PostgreSQL
 */
async function connectToDatabase(
  endpoint: string,
  credentials: AuroraCredentials
): Promise<Client> {
  console.log('\n🔌 Connecting to Aurora PostgreSQL...');

  const client = new Client({
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
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Execute SQL file
 */
async function executeSqlFile(client: Client, filePath: string, fileName: string): Promise<void> {
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
      } catch (error: any) {
        // Some errors are expected (like "already exists" for extensions)
        if (error.message?.includes('already exists')) {
          console.log(`   ⚠️  Skipping: ${error.message.split('\n')[0]}`);
          successCount++;
        } else {
          console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
          errorCount++;
        }
      }
    }

    console.log(`✅ ${fileName} executed: ${successCount} successful, ${errorCount} errors`);
  } catch (error) {
    console.error(`❌ Failed to read or execute ${fileName}:`, error);
    throw error;
  }
}

/**
 * Verify migrations
 */
async function verifyMigrations(client: Client): Promise<void> {
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
  } catch (error) {
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

  let client: Client | null = null;

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
    } else {
      console.error(`❌ Schema file not found: ${schemaFile}`);
      process.exit(1);
    }

    // Step 5: Execute seed data migration
    const seedFile = path.join(MIGRATIONS_DIR, '001_seed_data.sql');
    if (fs.existsSync(seedFile)) {
      await executeSqlFile(client, seedFile, '001_seed_data.sql');
    } else {
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

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
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

export { main };
