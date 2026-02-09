#!/usr/bin/env node

/**
 * Create user_invitations table
 * This script creates the table that migration 012 failed to create
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');

const REGION = 'eu-west-1';
const SECRET_ARN = 'arn:aws:secretsmanager:eu-west-1:975050116849:secret:overlay/aurora/production/credentials-E3A4vl';

async function createTable() {
  console.log('Fetching database credentials...');

  const secretsManager = new SecretsManagerClient({ region: REGION });
  const secretResponse = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: SECRET_ARN })
  );

  const secret = JSON.parse(secretResponse.SecretString);

  const client = new Client({
    host: secret.host,
    port: secret.port,
    database: secret.dbname,
    user: secret.username,
    password: secret.password,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✓ Connected to database\n');

  try {
    // Check if table exists
    const checkResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_invitations'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✓ user_invitations table already exists');
      await client.end();
      return;
    }

    console.log('Creating user_invitations table...');

    // Create table
    await client.query(`
      CREATE TABLE user_invitations (
        invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
        invited_by UUID NOT NULL REFERENCES users(user_id),
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        accepted_by UUID REFERENCES users(user_id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT email_session_unique UNIQUE(email, session_id)
      )
    `);
    console.log('✓ Table created');

    // Create indexes
    await client.query('CREATE INDEX idx_invitations_email ON user_invitations(email)');
    await client.query('CREATE INDEX idx_invitations_token ON user_invitations(token)');
    await client.query('CREATE INDEX idx_invitations_session ON user_invitations(session_id)');
    await client.query('CREATE INDEX idx_invitations_expires ON user_invitations(expires_at)');
    await client.query('CREATE INDEX idx_invitations_invited_by ON user_invitations(invited_by)');
    console.log('✓ Indexes created');

    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_invitations'
      ORDER BY ordinal_position
    `);

    console.log('\n=== user_invitations table schema ===');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.column_name} ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    console.log('\n✅ user_invitations table created successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createTable().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
