/**
 * Aurora Database Migration Lambda Function
 *
 * Runs database migrations from within VPC with access to Aurora
 */

const { Client } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'eu-west-1';
const SECRET_ARN = process.env.SECRET_ARN;
const DB_ENDPOINT = process.env.DB_ENDPOINT;

/**
 * Get database credentials from Secrets Manager
 */
async function getCredentials() {
  console.log('Retrieving credentials from Secrets Manager...');

  const client = new SecretsManagerClient({ region: REGION });
  const command = new GetSecretValueCommand({ SecretId: SECRET_ARN });

  const response = await client.send(command);
  const credentials = JSON.parse(response.SecretString);

  console.log('Credentials retrieved successfully');
  return credentials;
}

/**
 * Connect to Aurora PostgreSQL
 */
async function connectToDatabase(credentials) {
  console.log('Connecting to Aurora PostgreSQL...');

  const client = new Client({
    host: DB_ENDPOINT,
    port: credentials.port || 5432,
    database: credentials.dbname,
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log('Connected to database successfully');

  // Test connection
  const result = await client.query('SELECT version()');
  console.log('PostgreSQL version:', result.rows[0].version.split(',')[0]);

  return client;
}

/**
 * Execute SQL file
 */
async function executeSqlFile(client, fileName, sqlContent) {
  console.log(`Executing ${fileName}...`);

  // Parse SQL statements, handling $$ delimited functions
  const statements = [];
  let currentStatement = '';
  let inDollarQuote = false;

  const lines = sqlContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue;
    }

    // Check for $$ delimiter
    if (trimmedLine.includes('$$')) {
      inDollarQuote = !inDollarQuote;
    }

    currentStatement += line + '\n';

    // Statement ends with ; outside of $$ quotes
    if (trimmedLine.endsWith(';') && !inDollarQuote) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add final statement if any
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`Found ${statements.length} SQL statements`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    if (!statement || statement.startsWith('--')) {
      continue;
    }

    try {
      await client.query(statement);
      successCount++;

      if ((i + 1) % 10 === 0) {
        console.log(`Progress: ${i + 1}/${statements.length} statements executed`);
      }
    } catch (error) {
      // Some errors are expected (like "already exists")
      if (error.message?.includes('already exists')) {
        console.log(`Skipping (already exists): statement ${i + 1}`);
        successCount++;
      } else {
        console.error(`Error in statement ${i + 1}:`, error.message);
        errorCount++;
        errors.push({
          statement: i + 1,
          error: error.message,
        });
      }
    }
  }

  console.log(`${fileName} executed: ${successCount} successful, ${errorCount} errors`);

  return { successCount, errorCount, errors };
}

/**
 * Verify migrations
 */
async function verifyMigrations(client) {
  console.log('Verifying migrations...');

  const results = {};

  // Count tables
  const tablesResult = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  results.tableCount = parseInt(tablesResult.rows[0].count);
  console.log(`Tables: ${results.tableCount}`);

  // Count views
  const viewsResult = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.views
    WHERE table_schema = 'public'
  `);
  results.viewCount = parseInt(viewsResult.rows[0].count);
  console.log(`Views: ${results.viewCount}`);

  // Count indexes
  const indexesResult = await client.query(`
    SELECT COUNT(*) as count
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  results.indexCount = parseInt(indexesResult.rows[0].count);
  console.log(`Indexes: ${results.indexCount}`);

  // Seed data counts
  const orgCount = await client.query('SELECT COUNT(*) as count FROM organizations');
  results.organizations = parseInt(orgCount.rows[0].count);

  const userCount = await client.query('SELECT COUNT(*) as count FROM users');
  results.users = parseInt(userCount.rows[0].count);

  const overlayCount = await client.query('SELECT COUNT(*) as count FROM overlays');
  results.overlays = parseInt(overlayCount.rows[0].count);

  const criteriaCount = await client.query('SELECT COUNT(*) as count FROM evaluation_criteria');
  results.criteria = parseInt(criteriaCount.rows[0].count);

  console.log('Verification complete:', results);

  return results;
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log('Database Migration Lambda started');
  console.log('Event:', JSON.stringify(event, null, 2));

  let client = null;

  try {
    // Get credentials
    const credentials = await getCredentials();

    // Connect to database
    client = await connectToDatabase(credentials);

    // Check if this is a query request (not migration)
    if (event.querySQL) {
      console.log('Executing ad-hoc query:', event.querySQL);

      const result = await client.query(event.querySQL);

      console.log(`Query returned ${result.rows.length} rows`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Query executed successfully',
          rowCount: result.rows.length,
          rows: result.rows,
        }),
      };
    }

    // Otherwise, run migrations
    const results = {
      migrations: [],
      verification: null,
    };

    // Get all migration files and sort them
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files:`, migrationFiles);

    // Execute each migration file in order
    for (const fileName of migrationFiles) {
      console.log(`\nExecuting migration: ${fileName}`);
      const filePath = path.join(migrationsDir, fileName);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const result = await executeSqlFile(client, fileName, fileContent);
      results.migrations.push({
        fileName,
        ...result
      });
    }

    // Verify migrations
    results.verification = await verifyMigrations(client);

    console.log('Migration completed successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Database migrations completed successfully',
        results,
      }),
    };

  } catch (error) {
    console.error('Migration failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
    };

  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed');
    }
  }
};
