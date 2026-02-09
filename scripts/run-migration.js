/**
 * Database Migration Runner
 * Connects to Aurora PostgreSQL and runs the appendix support migration
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Database credentials from AWS Secrets Manager
  const dbConfig = {
    host: 'overlaystoragestack-auroracluster23d869c0-higkke9k7oro.cluster-chwcq22k4a75.eu-west-1.rds.amazonaws.com',
    database: 'overlay_db',
    user: 'overlay_admin',
    password: 'B,thQDe.8o_bcUU^nCW.s9nwA9d,LS',
    port: 5432,
    ssl: {
      rejectUnauthorized: false // AWS RDS uses self-signed certs
    }
  };

  const client = new Client(dbConfig);

  try {
    console.log('Connecting to Aurora PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-appendix-support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\nRunning migration: add-appendix-support.sql');
    console.log('━'.repeat(60));

    // Execute migration
    const result = await client.query(migrationSQL);

    console.log('✅ Migration executed successfully');

    // Verify the column was added
    const verifyQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'document_submissions'
      AND column_name = 'appendix_files'
    `;

    const verifyResult = await client.query(verifyQuery);

    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Verification successful:');
      console.log('   Column: appendix_files');
      console.log('   Type:', verifyResult.rows[0].data_type);
      console.log('   Default:', verifyResult.rows[0].column_default);
    } else {
      console.error('\n❌ Verification failed: appendix_files column not found');
      process.exit(1);
    }

    // Verify index was created
    const indexQuery = `
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'document_submissions'
      AND indexname = 'idx_submissions_appendix_files'
    `;

    const indexResult = await client.query(indexQuery);

    if (indexResult.rows.length > 0) {
      console.log('✅ Index created: idx_submissions_appendix_files');
    } else {
      console.warn('⚠️  Index not found (may have been created with different name)');
    }

    console.log('\n' + '━'.repeat(60));
    console.log('✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('  1. Deploy backend Lambda functions');
    console.log('  2. Deploy frontend changes');
    console.log('  3. Test multi-file upload');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);

  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run migration
runMigration().catch(console.error);
