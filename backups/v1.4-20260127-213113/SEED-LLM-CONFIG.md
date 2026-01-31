# Seeding LLM Configuration

This guide shows how to populate the DynamoDB table with LLM configuration for all 6 AI agents.

## Quick Start

```bash
# Using npm script (recommended)
npm run seed:llm-config
```

This creates configurations for:
- ✅ 2 Bedrock agents (structure_validator, grammar_checker)
- ✅ 4 Claude API agents (content_analyzer, orchestrator, clarification, scoring)

## Prerequisites

Before running this script:
1. ✅ OverlayStorageStack must be deployed
2. ✅ DynamoDB table `overlay-llm-config` must exist
3. ✅ AWS credentials configured with DynamoDB permissions

## What Gets Created

### Bedrock Agents (Fast & Cost-Effective)

| Agent | Model | Temperature | Max Tokens | Use Case |
|-------|-------|-------------|------------|----------|
| structure_validator | anthropic.claude-haiku-4-v2 | 0.3 | 4000 | Document structure validation |
| grammar_checker | anthropic.claude-haiku-4-v2 | 0.2 | 4000 | Grammar and writing quality |

### Claude API Agents (Advanced Reasoning)

| Agent | Model | Temperature | Max Tokens | Use Case |
|-------|-------|-------------|------------|----------|
| content_analyzer | claude-sonnet-4-20250514 | 0.5 | 8000 | Detailed content analysis |
| orchestrator | claude-sonnet-4-20250514 | 0.5 | 8000 | Workflow coordination |
| clarification | claude-sonnet-4-20250514 | 0.5 | 8000 | Intelligent Q&A |
| scoring | claude-sonnet-4-20250514 | 0.5 | 8000 | Final scoring & feedback |

## Configuration Schema

Each configuration includes:

```json
{
  "configId": "CONFIG#global",
  "version": 1768914558489,
  "agentName": "structure_validator",
  "sortKey": "llm_provider#structure_validator",
  "provider": "bedrock",
  "model": "anthropic.claude-haiku-4-v2",
  "temperature": 0.3,
  "maxTokens": 4000,
  "isActive": "true",
  "retryAttempts": 3,
  "timeout": 120,
  "description": "Fast document structure validation using Bedrock Claude Haiku",
  "createdAt": "2026-01-20T13:09:18.489Z",
  "lastModified": 1768914558489,
  "updatedBy": "seed-script"
}
```

## Verifying the Configuration

### List All Configurations

```bash
aws dynamodb scan \
  --table-name overlay-llm-config \
  --region eu-west-1 \
  --query 'Items[*].[agentName.S, provider.S, model.S]' \
  --output table
```

Expected output:
```
-------------------------------------------------------------------
|                              Scan                               |
+----------------------+----------+-------------------------------+
|  structure_validator |  bedrock |  anthropic.claude-haiku-4-v2  |
|  grammar_checker     |  bedrock |  anthropic.claude-haiku-4-v2  |
|  content_analyzer    |  claude  |  claude-sonnet-4-20250514     |
|  orchestrator        |  claude  |  claude-sonnet-4-20250514     |
|  clarification       |  claude  |  claude-sonnet-4-20250514     |
|  scoring             |  claude  |  claude-sonnet-4-20250514     |
+----------------------+----------+-------------------------------+
```

### Get Specific Agent Configuration

```bash
aws dynamodb scan \
  --table-name overlay-llm-config \
  --region eu-west-1 \
  --filter-expression "agentName = :name" \
  --expression-attribute-values '{":name":{"S":"structure_validator"}}' \
  --limit 1
```

### Query Active Configurations

```bash
aws dynamodb query \
  --table-name overlay-llm-config \
  --region eu-west-1 \
  --index-name ActiveConfigIndex \
  --key-condition-expression "isActive = :active" \
  --expression-attribute-values '{":active":{"S":"true"}}'
```

## Customizing Configuration

To change agent settings, edit [scripts/seed-llm-config.js](scripts/seed-llm-config.js):

```javascript
{
  agentName: 'structure_validator',
  provider: 'bedrock',
  model: 'anthropic.claude-haiku-4-v2',  // Change model here
  temperature: 0.3,                       // Adjust temperature
  maxTokens: 4000,                        // Adjust token limit
  retryAttempts: 3,                       // Retry logic
  timeout: 120,                           // Function timeout
}
```

Common customizations:

### Update Model Versions

```javascript
// Switch to newer Claude Haiku version
model: 'anthropic.claude-haiku-5-v1',

// Switch to Claude Opus for better quality
model: 'claude-opus-4-20250514',
```

### Adjust Temperature

```javascript
// More deterministic (0.0 - 0.3)
temperature: 0.1,

// More creative (0.5 - 1.0)
temperature: 0.8,
```

### Change Token Limits

```javascript
// Shorter responses
maxTokens: 2000,

// Longer responses
maxTokens: 16000,
```

## Troubleshooting

### Table Not Found

If you see:
```
❌ Error: Table 'overlay-llm-config' not found.
```

Deploy the storage stack first:
```bash
npx cdk deploy OverlayStorageStack
```

### Access Denied

If you see:
```
❌ Error: AccessDeniedException
```

Configure AWS credentials:
```bash
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=eu-west-1
```

### Validation Error

If you see:
```
❌ Error: ValidationException
   Type mismatch for Index Key
```

This indicates the table schema doesn't match. Ensure:
- Table was created by OverlayStorageStack
- No manual schema modifications were made

## Re-running the Script

You can run the script multiple times safely. Each run creates configurations with new version numbers (timestamps).

To clean up old versions:

```bash
# Delete specific version
aws dynamodb delete-item \
  --table-name overlay-llm-config \
  --region eu-west-1 \
  --key '{"configId":{"S":"CONFIG#global"},"version":{"N":"1768914558489"}}'
```

## DynamoDB Schema

**Primary Key**:
- Partition Key: `configId` (STRING) - Always `CONFIG#global`
- Sort Key: `version` (NUMBER) - Unix timestamp in milliseconds

**Global Secondary Index** (ActiveConfigIndex):
- Partition Key: `isActive` (STRING) - `"true"` or `"false"`
- Sort Key: `lastModified` (NUMBER) - Unix timestamp in milliseconds

**Attributes**:
- `agentName` (STRING) - Agent identifier
- `sortKey` (STRING) - Format: `llm_provider#{agentName}`
- `provider` (STRING) - `"bedrock"` or `"claude"`
- `model` (STRING) - Model identifier
- `temperature` (NUMBER) - Sampling temperature (0.0 - 1.0)
- `maxTokens` (NUMBER) - Maximum output tokens
- `retryAttempts` (NUMBER) - Number of retry attempts
- `timeout` (NUMBER) - Function timeout in seconds
- `description` (STRING) - Human-readable description
- `createdAt` (STRING) - ISO 8601 timestamp
- `updatedBy` (STRING) - User/script that created the config

## Cost Implications

### Bedrock Agents (2)
- **Claude Haiku**: ~$0.25/MTok input, ~$1.25/MTok output
- **Use case**: Fast, cost-effective validation
- **Estimated cost**: ~$10-30/month for 1000 documents

### Claude API Agents (4)
- **Claude Sonnet**: ~$3/MTok input, ~$15/MTok output
- **Use case**: Advanced reasoning and analysis
- **Estimated cost**: ~$50-150/month for 1000 documents

**Total LLM Cost**: ~$60-180/month (depending on document volume and complexity)

## Next Steps

After seeding configurations:

1. ✅ Verify configurations in DynamoDB
2. ✅ Update Claude API key in Secrets Manager
3. ✅ Test AI agent Lambda functions
4. ✅ Upload test document to trigger workflow
5. ✅ Monitor CloudWatch Logs for agent execution

---

**Table**: `overlay-llm-config`  
**Region**: `eu-west-1`  
**Script**: `scripts/seed-llm-config.js`  
**npm command**: `npm run seed:llm-config`
