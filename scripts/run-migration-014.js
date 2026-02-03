/**
 * Run Migration 014: Add is_active to review_sessions
 * Hotfix for Phase 2A permission system
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);

async function runMigration() {
  console.log('\n=== Running Migration 014: Add is_active to review_sessions ===\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '014_add_is_active_to_sessions.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('Migration SQL:');
  console.log(migrationSQL);
  console.log('\n' + '='.repeat(70) + '\n');

  // Prepare payload
  const payload = {
    migrationSQL: migrationSQL
  };

  try {
    // Invoke Lambda
    const cmd = `aws lambda invoke --function-name overlay-database-migration --payload ${JSON.stringify(JSON.stringify(payload))} --cli-binary-format raw-in-base64-out response.json`;

    console.log('Invoking migration Lambda...\n');
    const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });

    console.log('Lambda invocation result:', stdout);

    // Read response
    if (fs.existsSync('response.json')) {
      const response = JSON.parse(fs.readFileSync('response.json', 'utf8'));
      console.log('\nMigration response:');
      console.log(JSON.stringify(response, null, 2));

      // Clean up
      fs.unlinkSync('response.json');

      if (response.statusCode === 200) {
        console.log('\n✅ Migration 014 completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Redeploy ComputeStack to pick up updated permissions.js (if needed)');
        console.log('2. Test dashboard - should work without errors now');
      } else {
        console.error('\n❌ Migration failed!');
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('\n❌ Error running migration:', error.message);
    process.exit(1);
  }
}

runMigration().catch(console.error);
