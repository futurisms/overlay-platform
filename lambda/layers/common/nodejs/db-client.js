/**
 * Database Client Utilities
 * Provides Aurora PostgreSQL connection helpers
 */

const { Client } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

let cachedCredentials = null;

/**
 * Get Aurora credentials from Secrets Manager
 */
async function getAuroraCredentials() {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const command = new GetSecretValueCommand({
    SecretId: process.env.AURORA_SECRET_ARN,
  });

  const response = await secretsManager.send(command);
  cachedCredentials = JSON.parse(response.SecretString);

  return cachedCredentials;
}

/**
 * Connect to Aurora PostgreSQL
 */
async function connectToDatabase(credentials) {
  const client = new Client({
    host: process.env.AURORA_ENDPOINT,
    port: credentials.port || 5432,
    database: credentials.dbname,
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  return client;
}

module.exports = {
  getAuroraCredentials,
  connectToDatabase,
};
