/**
 * LLM Client Abstraction Layer
 * Provides unified interface for Claude API and Bedrock
 * Version: 2.4.0 - Added token usage tracking and pricing info
 */

const Anthropic = require('@anthropic-ai/sdk');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

let cachedApiKey = null;
let claudeClientInstance = null;

/**
 * Get model information with pricing
 */
function getModelInfo() {
  return {
    defaultModel: 'claude-sonnet-4-5-20250929',
    supportedModels: [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251101',
      'claude-3-5-sonnet-20241022',
    ],
    pricing: {
      'claude-sonnet-4-5-20250929': {
        input: 0.003,   // USD per 1K tokens
        output: 0.015,  // USD per 1K tokens
      },
      'claude-opus-4-5-20251101': {
        input: 0.015,
        output: 0.075,
      },
      'claude-3-5-sonnet-20241022': {
        input: 0.003,
        output: 0.015,
      },
    },
    version: '2.4.0',
  };
}

/**
 * Get Claude API key from Secrets Manager
 */
async function getClaudeApiKey() {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const command = new GetSecretValueCommand({
    SecretId: process.env.CLAUDE_API_KEY_SECRET,
  });

  const response = await secretsManager.send(command);
  const secret = JSON.parse(response.SecretString);
  cachedApiKey = secret.apiKey;

  return cachedApiKey;
}

/**
 * Get Claude client instance with sendMessage wrapper
 */
async function getClaudeClient() {
  if (claudeClientInstance) {
    return claudeClientInstance;
  }

  const apiKey = await getClaudeApiKey();
  const anthropicClient = new Anthropic({ apiKey });

  // Create wrapper object with sendMessage method
  claudeClientInstance = {
    sendMessage: async (prompt, options = {}) => {
      const response = await anthropicClient.messages.create({
        model: options.model || 'claude-sonnet-4-5-20250929',
        max_tokens: options.max_tokens || 2048,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      // Validate response structure before accessing
      if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
        console.error('Claude API returned unexpected response structure:', JSON.stringify(response, null, 2));
        throw new Error(`Claude API returned empty or invalid content array. Response: ${JSON.stringify({
          id: response.id,
          model: response.model,
          stop_reason: response.stop_reason,
          content_length: response.content?.length || 0
        })}`);
      }

      if (!response.content[0].text) {
        console.error('Claude API content block missing text:', JSON.stringify(response.content[0], null, 2));
        throw new Error(`Claude API content block does not contain text. Type: ${response.content[0].type}`);
      }

      // Return structured response with text, usage, and model info
      // ⚠️ BREAKING CHANGE: Previously returned string, now returns object
      return {
        text: response.content[0].text,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
        model: response.model,
      };
    },
    getModelInfo: () => getModelInfo(),
  };

  return claudeClientInstance;
}

/**
 * Get LLM configuration from DynamoDB
 */
async function getLLMConfig(configId) {
  const command = new GetCommand({
    TableName: process.env.LLM_CONFIG_TABLE,
    Key: { configId },
  });

  const response = await dynamodb.send(command);
  return response.Item;
}

module.exports = {
  getClaudeClient,
  getClaudeApiKey,
  getLLMConfig,
  getModelInfo,
};
