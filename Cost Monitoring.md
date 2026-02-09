---
name: cost-monitoring
description: Token tracking and cost analytics patterns for AI-powered applications. Use when adding AI features that consume tokens, tracking API usage costs, building cost analytics dashboards, optimizing model selection (Haiku vs Sonnet), or implementing usage reporting. Covers token capture patterns, cost calculation formulas, analytics queries, budget alerts, and model optimization strategies. Prevents runaway costs, provides visibility into AI spending, and enables data-driven optimization. Essential for any application using Claude API or similar AI services.
---

# Cost Monitoring

Token tracking and cost analytics from production AI systems.

## Core Principles

### 1. Track Every AI Call
**Capture tokens for all AI interactions:**
- Never make untracked AI calls
- Log both input and output tokens
- Associate with user/submission/session

### 2. Calculate Costs in Real-Time
**Know costs immediately:**
- Use current pricing
- Calculate per-agent costs
- Aggregate by various dimensions

### 3. Make Data Actionable
**Use metrics to drive decisions:**
- Which agents are most expensive?
- Which users consume most tokens?
- Where can we optimize?

## Token Tracking Implementation

### Database Schema
```sql
CREATE TABLE token_usage (
  usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES document_submissions(submission_id) ON DELETE CASCADE,
  agent_name VARCHAR(50) NOT NULL,
  model_name VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd DECIMAL(10, 6) GENERATED ALWAYS AS (
    CASE model_name
      WHEN 'claude-sonnet-4-5-20250929' THEN (input_tokens * 0.000003 + output_tokens * 0.000015)
      WHEN 'claude-haiku-4-5-20251001' THEN (input_tokens * 0.0000008 + output_tokens * 0.000004)
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT check_positive_tokens CHECK (input_tokens >= 0 AND output_tokens >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_token_usage_submission ON token_usage(submission_id);
CREATE INDEX idx_token_usage_agent ON token_usage(agent_name);
CREATE INDEX idx_token_usage_model ON token_usage(model_name);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX idx_token_usage_submission_agent ON token_usage(submission_id, agent_name);
CREATE INDEX idx_token_usage_created_at_desc ON token_usage(created_at DESC);

-- Summary view for analytics
CREATE VIEW v_token_usage_summary AS
SELECT 
  DATE(created_at) as usage_date,
  agent_name,
  model_name,
  COUNT(*) as call_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(total_tokens) as avg_tokens_per_call,
  AVG(cost_usd) as avg_cost_per_call
FROM token_usage
GROUP BY DATE(created_at), agent_name, model_name;
```

### Capture Tokens in Lambda
```javascript
// In AI agent Lambda function
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const pool = new Pool({
  host: process.env.DB_HOST,
  // ... other config
});

async function processWithClaude(prompt, submissionId, agentName) {
  const modelName = 'claude-sonnet-4-5-20250929'; // or Haiku
  
  // Call Claude API
  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });
  
  // Extract token usage from response
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  
  // Save to database
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO token_usage (
        submission_id,
        agent_name,
        model_name,
        input_tokens,
        output_tokens
      ) VALUES ($1, $2, $3, $4, $5)
    `, [submissionId, agentName, modelName, inputTokens, outputTokens]);
  } finally {
    client.release();
  }
  
  return response.content[0].text;
}
```

### Batch Insert for Performance
```javascript
// When processing multiple agents
async function saveTokenUsageBatch(usageRecords) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const query = `
      INSERT INTO token_usage (
        submission_id, agent_name, model_name, 
        input_tokens, output_tokens
      ) VALUES ($1, $2, $3, $4, $5)
    `;
    
    for (const record of usageRecords) {
      await client.query(query, [
        record.submissionId,
        record.agentName,
        record.modelName,
        record.inputTokens,
        record.outputTokens
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Cost Calculation Patterns

### Pricing Constants
```javascript
// Keep pricing centralized and up-to-date
const PRICING = {
  'claude-sonnet-4-5-20250929': {
    input: 0.000003,  // $3 per million input tokens
    output: 0.000015  // $15 per million output tokens
  },
  'claude-haiku-4-5-20251001': {
    input: 0.0000008,  // $0.80 per million input tokens
    output: 0.000004   // $4 per million output tokens
  },
  'claude-opus-4-5-20251101': {
    input: 0.000015,   // $15 per million input tokens
    output: 0.000075   // $75 per million output tokens
  }
};

function calculateCost(modelName, inputTokens, outputTokens) {
  const pricing = PRICING[modelName];
  if (!pricing) {
    throw new Error(`Unknown model: ${modelName}`);
  }
  
  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  
  return inputCost + outputCost;
}

// Calculate cost for entire submission
async function getSubmissionCost(submissionId) {
  const result = await pool.query(`
    SELECT SUM(cost_usd) as total_cost
    FROM token_usage
    WHERE submission_id = $1
  `, [submissionId]);
  
  return result.rows[0]?.total_cost || 0;
}
```

## Analytics Queries

### Query 1: Total Cost by Date
```sql
SELECT 
  DATE(created_at) as date,
  SUM(cost_usd) as total_cost,
  SUM(total_tokens) as total_tokens,
  COUNT(DISTINCT submission_id) as submission_count
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Query 2: Cost by Agent
```sql
SELECT 
  agent_name,
  COUNT(*) as calls,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost_per_call,
  ROUND((SUM(cost_usd) / (SELECT SUM(cost_usd) FROM token_usage) * 100)::numeric, 2) as cost_percentage
FROM token_usage
GROUP BY agent_name
ORDER BY total_cost DESC;
```

### Query 3: Cost by User
```sql
SELECT 
  u.email,
  u.user_role,
  COUNT(DISTINCT ds.submission_id) as submission_count,
  SUM(tu.total_tokens) as total_tokens,
  SUM(tu.cost_usd) as total_cost,
  AVG(tu.cost_usd) as avg_cost_per_call
FROM users u
JOIN document_submissions ds ON u.user_id = ds.submitted_by
JOIN token_usage tu ON ds.submission_id = tu.submission_id
GROUP BY u.user_id, u.email, u.user_role
ORDER BY total_cost DESC;
```

### Query 4: Cost by Session
```sql
SELECT 
  rs.name as session_name,
  COUNT(DISTINCT ds.submission_id) as submission_count,
  SUM(tu.total_tokens) as total_tokens,
  SUM(tu.cost_usd) as total_cost,
  AVG(tu.cost_usd) as avg_cost_per_submission
FROM review_sessions rs
JOIN document_submissions ds ON rs.session_id = ds.session_id
JOIN token_usage tu ON ds.submission_id = tu.submission_id
GROUP BY rs.session_id, rs.name
ORDER BY total_cost DESC;
```

### Query 5: Model Comparison
```sql
SELECT 
  model_name,
  COUNT(*) as calls,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost,
  AVG(total_tokens) as avg_tokens,
  AVG(cost_usd) as avg_cost
FROM token_usage
GROUP BY model_name
ORDER BY total_cost DESC;
```

### Query 6: Top 10 Expensive Submissions
```sql
SELECT 
  ds.submission_id,
  ds.title,
  u.email as submitted_by,
  rs.name as session_name,
  SUM(tu.total_tokens) as total_tokens,
  SUM(tu.cost_usd) as total_cost,
  ds.created_at
FROM document_submissions ds
JOIN users u ON ds.submitted_by = u.user_id
JOIN review_sessions rs ON ds.session_id = rs.session_id
JOIN token_usage tu ON ds.submission_id = tu.submission_id
GROUP BY ds.submission_id, ds.title, u.email, rs.name, ds.created_at
ORDER BY total_cost DESC
LIMIT 10;
```

### Query 7: Daily Cost Trends
```sql
SELECT 
  DATE(created_at) as date,
  SUM(cost_usd) as daily_cost,
  COUNT(DISTINCT submission_id) as submissions,
  AVG(cost_usd) as avg_cost_per_call,
  SUM(cost_usd) / COUNT(DISTINCT submission_id) as avg_cost_per_submission
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Query 8: Hourly Usage Patterns
```sql
SELECT 
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(*) as call_count,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;
```

## Model Optimization Patterns

### Smart Model Selection
```javascript
// Choose model based on task complexity
function selectModel(task) {
  const HAIKU = 'claude-haiku-4-5-20251001';
  const SONNET = 'claude-sonnet-4-5-20250929';
  
  // Simple validation tasks → Haiku (80% cost savings)
  if (task === 'structure-validation' || 
      task === 'grammar-check' ||
      task === 'format-validation') {
    return HAIKU;
  }
  
  // Complex analysis → Sonnet (better quality)
  if (task === 'content-analysis' ||
      task === 'scoring' ||
      task === 'recommendations') {
    return SONNET;
  }
  
  return SONNET; // Default to quality
}

// Example usage
const model = selectModel('grammar-check');
const response = await anthropic.messages.create({
  model: model,
  // ...
});
```

### Cost vs Quality Trade-offs
```javascript
// Track quality metrics alongside cost
async function logQualityMetrics(submissionId, agentName, score, cost) {
  await pool.query(`
    INSERT INTO quality_metrics (
      submission_id,
      agent_name,
      quality_score,
      cost_usd,
      cost_per_quality_point
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    submissionId,
    agentName,
    score,
    cost,
    cost / score
  ]);
}

// Analyze cost-effectiveness
const costEffectiveness = await pool.query(`
  SELECT 
    agent_name,
    model_name,
    AVG(quality_score) as avg_quality,
    AVG(cost_usd) as avg_cost,
    AVG(cost_per_quality_point) as avg_cost_per_point
  FROM quality_metrics
  GROUP BY agent_name, model_name
  ORDER BY avg_cost_per_point ASC
`);
```

## Budget Alert Patterns

### Daily Budget Check
```javascript
async function checkDailyBudget() {
  const result = await pool.query(`
    SELECT SUM(cost_usd) as today_cost
    FROM token_usage
    WHERE DATE(created_at) = CURRENT_DATE
  `);
  
  const todayCost = result.rows[0]?.today_cost || 0;
  const dailyBudget = 50; // $50 per day
  
  if (todayCost > dailyBudget) {
    await sendAlert({
      type: 'BUDGET_EXCEEDED',
      message: `Daily budget exceeded: $${todayCost.toFixed(2)} > $${dailyBudget}`,
      severity: 'HIGH'
    });
  } else if (todayCost > dailyBudget * 0.8) {
    await sendAlert({
      type: 'BUDGET_WARNING',
      message: `Approaching daily budget: $${todayCost.toFixed(2)} (${((todayCost/dailyBudget)*100).toFixed(0)}%)`,
      severity: 'MEDIUM'
    });
  }
}
```

### Monthly Budget Tracking
```javascript
async function getMonthlySpend() {
  const result = await pool.query(`
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      SUM(cost_usd) as monthly_cost,
      COUNT(DISTINCT submission_id) as submission_count
    FROM token_usage
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
  `);
  
  return result.rows;
}

// Forecast next month based on trend
async function forecastNextMonth() {
  const historicalData = await getMonthlySpend();
  
  if (historicalData.length < 3) {
    return null; // Not enough data
  }
  
  // Simple average of last 3 months
  const recentMonths = historicalData.slice(0, 3);
  const avgCost = recentMonths.reduce((sum, m) => sum + parseFloat(m.monthly_cost), 0) / 3;
  
  return avgCost;
}
```

## Dashboard Component Patterns

### Cost Summary Widget
```javascript
function CostSummaryWidget() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetchCostStats();
  }, []);
  
  async function fetchCostStats() {
    const response = await fetch('/api/analytics/cost-summary');
    const data = await response.json();
    setStats(data);
  }
  
  if (!stats) return <div>Loading...</div>;
  
  return (
    <div className="cost-summary">
      <h2>Cost Overview</h2>
      
      <div className="stat-grid">
        <StatCard 
          title="Today" 
          value={`$${stats.todayCost.toFixed(2)}`}
          trend={stats.todayTrend}
        />
        
        <StatCard 
          title="This Week" 
          value={`$${stats.weekCost.toFixed(2)}`}
          trend={stats.weekTrend}
        />
        
        <StatCard 
          title="This Month" 
          value={`$${stats.monthCost.toFixed(2)}`}
          budget={stats.monthlyBudget}
        />
        
        <StatCard 
          title="Avg per Submission" 
          value={`$${stats.avgPerSubmission.toFixed(3)}`}
        />
      </div>
      
      <CostChart data={stats.dailyCosts} />
    </div>
  );
}
```

### Cost Breakdown Chart
```javascript
function CostBreakdownChart({ dateRange = 30 }) {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    fetchBreakdown();
  }, [dateRange]);
  
  async function fetchBreakdown() {
    const response = await fetch(`/api/analytics/cost-breakdown?days=${dateRange}`);
    const data = await response.json();
    setData(data);
  }
  
  return (
    <div className="chart-container">
      <h3>Cost by Agent (Last {dateRange} days)</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="agent_name" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
          <Bar dataKey="total_cost" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
      
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Calls</th>
            <th>Total Tokens</th>
            <th>Total Cost</th>
            <th>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.agent_name}>
              <td>{row.agent_name}</td>
              <td>{row.calls.toLocaleString()}</td>
              <td>{row.total_tokens.toLocaleString()}</td>
              <td>${row.total_cost.toFixed(2)}</td>
              <td>{row.cost_percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Optimization Strategies

### Strategy 1: Cache Common Responses
```javascript
// Cache structure validation results (rarely change)
const cache = new Map();

async function validateWithCache(document, submissionId) {
  const cacheKey = hashDocument(document);
  
  if (cache.has(cacheKey)) {
    console.log('Using cached validation result');
    return cache.get(cacheKey);
  }
  
  // Call Claude API
  const result = await validateStructure(document, submissionId);
  
  // Cache for 1 hour
  cache.set(cacheKey, result);
  setTimeout(() => cache.delete(cacheKey), 3600000);
  
  return result;
}
```

### Strategy 2: Batch Similar Requests
```javascript
// Process multiple documents in one API call when possible
async function batchAnalyze(documents) {
  const combinedPrompt = documents.map((doc, i) => 
    `Document ${i + 1}:\n${doc.content}\n---\n`
  ).join('\n');
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Analyze these ${documents.length} documents:\n\n${combinedPrompt}`
    }]
  });
  
  // One API call instead of N calls
  // But: Track tokens appropriately
  const tokensPerDoc = response.usage.total_tokens / documents.length;
  
  for (const doc of documents) {
    await saveTokenUsage(doc.submissionId, 'batch-analyzer', 
      Math.round(tokensPerDoc), response.usage.output_tokens / documents.length);
  }
}
```

### Strategy 3: Use Prompt Caching (if available)
```javascript
// Leverage Claude's prompt caching for repeated prompts
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4000,
  system: [{
    type: 'text',
    text: longSystemPrompt, // This gets cached
    cache_control: { type: 'ephemeral' }
  }],
  messages: [{
    role: 'user',
    content: userInput // This varies
  }]
});

// Subsequent calls with same system prompt use cache
// Significant cost savings on input tokens
```

## Reporting Patterns

### Generate Monthly Report
```javascript
async function generateMonthlyReport(year, month) {
  const report = {
    period: `${year}-${month}`,
    summary: await getMonthSummary(year, month),
    byAgent: await getCostByAgent(year, month),
    byUser: await getCostByUser(year, month),
    bySession: await getCostBySession(year, month),
    topExpensive: await getTopExpensiveSubmissions(year, month),
    trends: await getDailyTrends(year, month)
  };
  
  return report;
}

// API endpoint
app.get('/api/reports/monthly/:year/:month', async (req, res) => {
  const report = await generateMonthlyReport(
    parseInt(req.params.year),
    parseInt(req.params.month)
  );
  res.json(report);
});
```

### Export to CSV
```javascript
async function exportCostData(startDate, endDate) {
  const data = await pool.query(`
    SELECT 
      tu.created_at,
      ds.title as submission_title,
      u.email as user_email,
      rs.name as session_name,
      tu.agent_name,
      tu.model_name,
      tu.input_tokens,
      tu.output_tokens,
      tu.total_tokens,
      tu.cost_usd
    FROM token_usage tu
    JOIN document_submissions ds ON tu.submission_id = ds.submission_id
    JOIN users u ON ds.submitted_by = u.user_id
    JOIN review_sessions rs ON ds.session_id = rs.session_id
    WHERE tu.created_at BETWEEN $1 AND $2
    ORDER BY tu.created_at DESC
  `, [startDate, endDate]);
  
  // Convert to CSV
  const csv = convertToCSV(data.rows);
  return csv;
}
```

## Best Practices

### 1. Always Track Tokens
```javascript
// ✅ Good: Track every call
const response = await callClaude(prompt);
await saveTokenUsage(submissionId, agentName, 
  response.usage.input_tokens, response.usage.output_tokens);

// ❌ Bad: Untracked call
const response = await callClaude(prompt);
// No tracking!
```

### 2. Use Generated Columns for Cost
```sql
-- ✅ Good: Database calculates cost
cost_usd DECIMAL(10, 6) GENERATED ALWAYS AS (
  CASE model_name
    WHEN 'claude-sonnet-4-5-20250929' THEN (input_tokens * 0.000003 + output_tokens * 0.000015)
  END
) STORED

-- ❌ Bad: Manual calculation (error-prone)
cost_usd DECIMAL(10, 6)
```

### 3. Monitor Regularly
```javascript
// Set up daily cost checks
cron.schedule('0 9 * * *', async () => {
  await checkDailyBudget();
  await generateDailyReport();
});
```

### 4. Optimize High-Cost Agents
```sql
-- Find expensive agents
SELECT 
  agent_name,
  SUM(cost_usd) as total_cost,
  COUNT(*) as calls,
  AVG(total_tokens) as avg_tokens
FROM token_usage
GROUP BY agent_name
ORDER BY total_cost DESC;

-- Consider: Can we use Haiku instead of Sonnet?
```

## Quick Reference

### Pricing (as of Feb 2026)
```
Claude Sonnet 4.5:
- Input: $3 per million tokens
- Output: $15 per million tokens

Claude Haiku 4.5:
- Input: $0.80 per million tokens
- Output: $4 per million tokens

Savings: Haiku is ~73-80% cheaper than Sonnet
```

### Common Queries
See `references/analytics-queries.md` for 15+ pre-written queries.

---

**Remember:** Token tracking is essential for cost control. Track everything, monitor regularly, and optimize based on data!
