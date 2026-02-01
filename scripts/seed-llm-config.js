#!/usr/bin/env node

/**
 * Seed LLM Configuration Table
 *
 * This script populates the overlay-llm-config DynamoDB table with
 * configuration for all 6 AI agents in the document analysis workflow.
 *
 * Usage:
 *   node scripts/seed-llm-config.js
 *   npm run seed:llm-config
 *
 * The script creates configurations for:
 * - structure_validator (Bedrock Claude Haiku)
 * - grammar_checker (Bedrock Claude Haiku)
 * - content_analyzer (Claude API Sonnet)
 * - orchestrator (Claude API Sonnet)
 * - clarification (Claude API Sonnet)
 * - scoring (Claude API Sonnet)
 */

const {
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
} = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// Configuration
const REGION = 'eu-west-1';
const TABLE_NAME = 'overlay-llm-config';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: REGION });

// AI Agent Configurations
const agentConfigurations = [
  {
    configId: 'CONFIG#global',
    version: Date.now(),
    agentName: 'structure_validator',
    provider: 'bedrock',
    model: 'anthropic.claude-3-haiku-20240307-v1:0',
    temperature: 0.3,
    maxTokens: 4000,
    description: 'Fast document structure validation using Bedrock Claude Haiku',
    isActive: true,
    retryAttempts: 3,
    timeout: 120, // seconds
  },
  {
    configId: 'CONFIG#global',
    version: Date.now() + 1,
    agentName: 'grammar_checker',
    provider: 'bedrock',
    model: 'anthropic.claude-3-haiku-20240307-v1:0',
    temperature: 0.2,
    maxTokens: 4000,
    description: 'Grammar and writing quality check using Bedrock Claude Haiku',
    isActive: true,
    retryAttempts: 3,
    timeout: 120, // seconds
  },
  {
    configId: 'CONFIG#global',
    version: Date.now() + 2,
    agentName: 'content_analyzer',
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0.5,
    maxTokens: 8000,
    description: 'Detailed content analysis using Claude API Sonnet',
    isActive: true,
    retryAttempts: 3,
    timeout: 300, // seconds
  },
  {
    configId: 'CONFIG#global',
    version: Date.now() + 3,
    agentName: 'orchestrator',
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0.5,
    maxTokens: 8000,
    description: 'Workflow coordination and decision-making using Claude API Sonnet',
    isActive: true,
    retryAttempts: 3,
    timeout: 300, // seconds
  },
  {
    configId: 'CONFIG#global',
    version: Date.now() + 4,
    agentName: 'clarification',
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0.5,
    maxTokens: 8000,
    description: 'Intelligent Q&A and clarification using Claude API Sonnet',
    isActive: true,
    retryAttempts: 3,
    timeout: 180, // seconds
  },
  {
    configId: 'CONFIG#global',
    version: Date.now() + 5,
    agentName: 'scoring',
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0.5,
    maxTokens: 8000,
    description: 'Final scoring and feedback generation using Claude API Sonnet',
    isActive: true,
    retryAttempts: 3,
    timeout: 180, // seconds
  },
];

// Add sort key format as specified: llm_provider#{agent_name}
// Note: isActive must be STRING for GSI, lastModified must be NUMBER (timestamp)
const configurationsWithSortKey = agentConfigurations.map(config => ({
  ...config,
  isActive: config.isActive ? 'true' : 'false', // Convert boolean to string for GSI
  sortKey: `llm_provider#${config.agentName}`,
  createdAt: new Date().toISOString(),
  lastModified: Date.now(), // Unix timestamp in milliseconds (NUMBER type for GSI)
  updatedBy: 'seed-script',
}));

async function checkExistingConfigs() {
  try {
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: 10,
    });

    const response = await dynamoClient.send(scanCommand);
    return response.Items || [];
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.error(`❌ Error: Table '${TABLE_NAME}' not found.`);
      console.error('   Please ensure the OverlayStorageStack has been deployed.\n');
      throw error;
    }
    throw error;
  }
}

async function seedConfiguration(config) {
  const item = {
    configId: config.configId,
    version: config.version,
    agentName: config.agentName,
    sortKey: config.sortKey,
    provider: config.provider,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    description: config.description,
    isActive: config.isActive,
    retryAttempts: config.retryAttempts,
    timeout: config.timeout,
    createdAt: config.createdAt,
    lastModified: config.lastModified,
    updatedBy: config.updatedBy,
  };

  const putCommand = new PutItemCommand({
    TableName: TABLE_NAME,
    Item: marshall(item, { removeUndefinedValues: true }),
  });

  await dynamoClient.send(putCommand);
}

async function seedAllConfigurations() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Seeding LLM Configuration Table');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Region: ${REGION}`);
  console.log(`Agents: ${configurationsWithSortKey.length}\n`);

  try {
    // Check if table exists and if there are existing configs
    console.log('Checking for existing configurations...');
    const existingItems = await checkExistingConfigs();

    if (existingItems.length > 0) {
      console.log(`⚠️  Found ${existingItems.length} existing configuration(s) in the table.`);
      console.log('   This script will add new configurations with unique version numbers.\n');
    } else {
      console.log('✅ No existing configurations found. Starting fresh.\n');
    }

    // Seed each configuration
    console.log('Seeding configurations:\n');

    for (const config of configurationsWithSortKey) {
      console.log(`  Seeding ${config.agentName}...`);
      console.log(`    Provider: ${config.provider}`);
      console.log(`    Model: ${config.model}`);
      console.log(`    Temperature: ${config.temperature}`);
      console.log(`    Max Tokens: ${config.maxTokens}`);
      console.log(`    Sort Key: ${config.sortKey}`);

      await seedConfiguration(config);
      console.log(`  ✅ ${config.agentName} seeded successfully\n`);
    }

    // Success summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ All configurations seeded successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Configuration Summary:\n');

    // Group by provider
    const bedrockAgents = configurationsWithSortKey.filter(c => c.provider === 'bedrock');
    const claudeAgents = configurationsWithSortKey.filter(c => c.provider === 'claude');

    console.log(`Bedrock Agents (${bedrockAgents.length}):`);
    bedrockAgents.forEach(agent => {
      console.log(`  - ${agent.agentName}: ${agent.model}`);
    });

    console.log(`\nClaude API Agents (${claudeAgents.length}):`);
    claudeAgents.forEach(agent => {
      console.log(`  - ${agent.agentName}: ${agent.model}`);
    });

    console.log('\nNext Steps:');
    console.log('  1. Verify configurations in DynamoDB console');
    console.log('  2. Update Claude API key in Secrets Manager if not already done');
    console.log('  3. Test AI agent Lambda functions');
    console.log('  4. Upload a test document to trigger the workflow\n');

    console.log('Verify configurations:');
    console.log(`  aws dynamodb scan --table-name ${TABLE_NAME} --region ${REGION}\n`);

  } catch (error) {
    console.error('❌ Error seeding configurations:\n');

    if (error.name === 'ResourceNotFoundException') {
      console.error('   Table not found. Deploy OverlayStorageStack first:');
      console.error('   npx cdk deploy OverlayStorageStack\n');
    } else if (error.name === 'AccessDeniedException') {
      console.error('   Access denied. Check IAM permissions for DynamoDB:');
      console.error('   - dynamodb:PutItem');
      console.error('   - dynamodb:Scan\n');
    } else if (error.name === 'ValidationException') {
      console.error('   Validation error:', error.message);
      console.error('   Check that the table schema matches the expected format.\n');
    } else {
      console.error('   Error:', error.name);
      console.error('   Message:', error.message);
      console.error('\n   Full error:', error);
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  seedAllConfigurations().catch(console.error);
}

module.exports = { seedAllConfigurations, agentConfigurations };
