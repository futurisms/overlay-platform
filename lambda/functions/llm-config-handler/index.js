/**
 * LLM Configuration Handler
 * Manage LLM agent configurations stored in DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.LLM_CONFIG_TABLE || 'overlay-llm-config';

exports.handler = async (event) => {
  console.log('LLM Config Handler:', JSON.stringify(event));

  const { httpMethod, pathParameters, body: requestBody, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub;

  // Only admins can access LLM config
  const userGroups = requestContext?.authorizer?.claims?.['cognito:groups'] || '';
  const groupsList = typeof userGroups === 'string' ? userGroups.split(',') : userGroups;
  const isAdmin = groupsList.some(g => g === 'Admins' || g === 'system_admin' || g === 'admins');

  if (!isAdmin) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Access denied. Admin role required.' })
    };
  }

  try {
    switch (httpMethod) {
      case 'GET':
        return pathParameters?.agentName
          ? await handleGetConfig(pathParameters.agentName)
          : await handleListConfigs();
      case 'PUT':
        return await handleUpdateConfig(pathParameters, requestBody, userId);
      default:
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function handleListConfigs() {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'configId = :configId',
    ExpressionAttributeValues: {
      ':configId': 'CONFIG#global'
    }
  });

  const result = await docClient.send(command);

  const configs = result.Items.map(item => ({
    agent_name: item.agentName,
    provider: item.provider,
    model: item.model,
    temperature: item.temperature,
    max_tokens: item.maxTokens,
    is_active: item.isActive === 'true',
    timeout: item.timeout,
    retry_attempts: item.retryAttempts,
    description: item.description,
    updated_at: item.lastModified,
    updated_by: item.updatedBy
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      configs,
      total: configs.length
    })
  };
}

async function handleGetConfig(agentName) {
  // Query for specific agent by scanning with filter
  // (simpler than Query since we need to filter by agentName, not the partition key)
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'configId = :configId AND agentName = :agentName',
    ExpressionAttributeValues: {
      ':configId': 'CONFIG#global',
      ':agentName': agentName
    },
    Limit: 1
  });

  const result = await docClient.send(command);

  if (!result.Items || result.Items.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Configuration not found' })
    };
  }

  const item = result.Items[0];
  const config = {
    agent_name: item.agentName,
    provider: item.provider,
    model: item.model,
    temperature: item.temperature,
    max_tokens: item.maxTokens,
    is_active: item.isActive === 'true',
    timeout: item.timeout,
    retry_attempts: item.retryAttempts,
    description: item.description,
    updated_at: item.lastModified,
    updated_by: item.updatedBy
  };

  return {
    statusCode: 200,
    body: JSON.stringify(config)
  };
}

async function handleUpdateConfig(pathParameters, requestBody, userId) {
  const agentName = pathParameters?.agentName;

  if (!agentName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Agent name required' })
    };
  }

  const data = JSON.parse(requestBody);
  const { provider, model, temperature, max_tokens, timeout, retry_attempts, is_active, description } = data;

  // Validate provider
  const validProviders = ['claude', 'bedrock', 'openai'];
  if (provider && !validProviders.includes(provider)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
      })
    };
  }

  // Validate temperature range
  if (temperature !== undefined && (temperature < 0 || temperature > 1)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Temperature must be between 0 and 1' })
    };
  }

  // Check if config exists by scanning
  const scanCommand = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'configId = :configId AND agentName = :agentName',
    ExpressionAttributeValues: {
      ':configId': 'CONFIG#global',
      ':agentName': agentName
    },
    Limit: 1
  });

  const existing = await docClient.send(scanCommand);

  if (!existing.Items || existing.Items.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Configuration not found. Please create configurations via the seed script.' })
    };
  }

  // Update existing config using the actual schema
  const item = existing.Items[0];
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  if (provider) {
    updateExpressions.push('#provider = :provider');
    expressionAttributeNames['#provider'] = 'provider';
    expressionAttributeValues[':provider'] = provider;
  }

  if (model) {
    updateExpressions.push('#model = :model');
    expressionAttributeNames['#model'] = 'model';
    expressionAttributeValues[':model'] = model;
  }

  if (temperature !== undefined) {
    updateExpressions.push('#temperature = :temperature');
    expressionAttributeNames['#temperature'] = 'temperature';
    expressionAttributeValues[':temperature'] = temperature;
  }

  if (max_tokens) {
    updateExpressions.push('#maxTokens = :maxTokens');
    expressionAttributeNames['#maxTokens'] = 'maxTokens';
    expressionAttributeValues[':maxTokens'] = max_tokens;
  }

  if (timeout) {
    updateExpressions.push('#timeout = :timeout');
    expressionAttributeNames['#timeout'] = 'timeout';
    expressionAttributeValues[':timeout'] = timeout;
  }

  if (retry_attempts) {
    updateExpressions.push('#retryAttempts = :retryAttempts');
    expressionAttributeNames['#retryAttempts'] = 'retryAttempts';
    expressionAttributeValues[':retryAttempts'] = retry_attempts;
  }

  if (is_active !== undefined) {
    updateExpressions.push('#isActive = :isActive');
    expressionAttributeNames['#isActive'] = 'isActive';
    expressionAttributeValues[':isActive'] = is_active ? 'true' : 'false';
  }

  if (description !== undefined) {
    updateExpressions.push('#description = :description');
    expressionAttributeNames['#description'] = 'description';
    expressionAttributeValues[':description'] = description;
  }

  // Always update timestamp and user
  const now = Date.now();
  updateExpressions.push('#lastModified = :lastModified');
  updateExpressions.push('#updatedBy = :updatedBy');
  expressionAttributeNames['#lastModified'] = 'lastModified';
  expressionAttributeNames['#updatedBy'] = 'updatedBy';
  expressionAttributeValues[':lastModified'] = now;
  expressionAttributeValues[':updatedBy'] = userId;

  const updateCommand = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      configId: item.configId,
      version: item.version
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });

  const result = await docClient.send(updateCommand);

  // Transform response to match API format
  const updatedConfig = {
    agent_name: result.Attributes.agentName,
    provider: result.Attributes.provider,
    model: result.Attributes.model,
    temperature: result.Attributes.temperature,
    max_tokens: result.Attributes.maxTokens,
    is_active: result.Attributes.isActive === 'true',
    timeout: result.Attributes.timeout,
    retry_attempts: result.Attributes.retryAttempts,
    description: result.Attributes.description,
    updated_at: result.Attributes.lastModified,
    updated_by: result.Attributes.updatedBy
  };

  console.log(`Updated LLM config for agent: ${agentName}`);
  return {
    statusCode: 200,
    body: JSON.stringify(updatedConfig)
  };
}
