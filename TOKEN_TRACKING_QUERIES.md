# Token Usage Tracking - Analysis Queries

**Date:** February 3, 2026
**Feature:** Claude API token usage tracking for cost monitoring
**Migration:** 007_add_token_tracking.sql

---

## Overview

The token tracking system captures Claude API usage for every AI agent invocation:
- **table:** `token_usage` - Raw token data per agent call
- **view:** `v_token_usage_summary` - Aggregated tokens per submission
- **Agents tracked:** orchestrator, scoring, content-analyzer, grammar-checker, structure-validator, clarification

---

## Quick Reference Queries

### 1. Total Tokens by Submission

```sql
SELECT * FROM v_token_usage_summary
WHERE submission_id = 'YOUR_SUBMISSION_ID'
ORDER BY last_agent_call DESC;
```

**Returns:**
- `agent_calls` - Number of AI agents invoked
- `total_input_tokens` - Sum of input tokens
- `total_output_tokens` - Sum of output tokens
- `total_tokens` - Combined total
- `agents_used` - Array of agent names
- `last_agent_call` - Timestamp of most recent call

---

### 2. Recent Token Usage (Last 24 Hours)

```sql
SELECT
  submission_id,
  agent_name,
  input_tokens,
  output_tokens,
  total_tokens,
  model_name,
  created_at
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

---

### 3. Token Usage by Agent (Summary)

```sql
SELECT
  agent_name,
  COUNT(*) as invocations,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total_tokens,
  ROUND(AVG(input_tokens)) as avg_input,
  ROUND(AVG(output_tokens)) as avg_output,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM token_usage
GROUP BY agent_name
ORDER BY total_tokens DESC;
```

---

### 4. Daily Token Usage Trends

```sql
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT submission_id) as submissions,
  COUNT(*) as agent_calls,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total_tokens,
  ROUND(AVG(total_tokens)) as avg_per_call
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

### 5. Cost Estimation (Sonnet 4.5 Pricing)

```sql
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT submission_id) as submissions,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total_tokens,
  -- Sonnet 4.5: $0.003/1K input, $0.015/1K output
  ROUND((SUM(input_tokens) * 0.003 / 1000.0) +
        (SUM(output_tokens) * 0.015 / 1000.0), 4) as estimated_cost_usd
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Pricing Reference:**
- Claude Sonnet 4.5: $0.003/1K input + $0.015/1K output
- Claude Opus 4.5: $0.015/1K input + $0.075/1K output
- Claude 3.5 Sonnet: $0.003/1K input + $0.015/1K output

---

### 6. Token Usage by Model

```sql
SELECT
  model_name,
  COUNT(*) as calls,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total_tokens,
  ROUND(AVG(total_tokens)) as avg_tokens_per_call
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY model_name
ORDER BY total_tokens DESC;
```

---

### 7. Top 10 Highest Token Submissions

```sql
SELECT
  ds.submission_id,
  ds.document_name,
  ds.submitted_at,
  vtu.total_tokens,
  vtu.total_input_tokens,
  vtu.total_output_tokens,
  vtu.agent_calls,
  vtu.agents_used
FROM v_token_usage_summary vtu
JOIN document_submissions ds ON vtu.submission_id = ds.submission_id
ORDER BY vtu.total_tokens DESC
LIMIT 10;
```

---

### 8. Average Tokens per Agent (Last 7 Days)

```sql
SELECT
  agent_name,
  COUNT(*) as calls,
  ROUND(AVG(input_tokens)) as avg_input,
  ROUND(AVG(output_tokens)) as avg_output,
  ROUND(AVG(total_tokens)) as avg_total,
  MIN(total_tokens) as min_tokens,
  MAX(total_tokens) as max_tokens,
  STDDEV_POP(total_tokens) as token_stddev
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY avg_total DESC;
```

---

### 9. Token Usage by User (via Submissions)

```sql
SELECT
  u.email,
  u.user_id,
  COUNT(DISTINCT ds.submission_id) as submissions,
  SUM(vtu.total_tokens) as total_tokens,
  SUM(vtu.total_input_tokens) as total_input,
  SUM(vtu.total_output_tokens) as total_output,
  ROUND(AVG(vtu.total_tokens)) as avg_tokens_per_submission
FROM users u
JOIN document_submissions ds ON u.user_id = ds.submitted_by
JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
WHERE ds.submitted_at >= NOW() - INTERVAL '30 days'
GROUP BY u.email, u.user_id
ORDER BY total_tokens DESC;
```

---

### 10. Token Usage by Overlay Type

```sql
SELECT
  o.name as overlay_name,
  o.document_type,
  COUNT(DISTINCT ds.submission_id) as submissions,
  SUM(vtu.total_tokens) as total_tokens,
  ROUND(AVG(vtu.total_tokens)) as avg_tokens_per_submission,
  ROUND(AVG(vtu.agent_calls)) as avg_agents_per_submission
FROM overlays o
JOIN document_submissions ds ON o.overlay_id = ds.overlay_id
JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
WHERE ds.submitted_at >= NOW() - INTERVAL '30 days'
GROUP BY o.name, o.document_type
ORDER BY total_tokens DESC;
```

---

### 11. Detailed Token Breakdown for Single Submission

```sql
WITH submission_tokens AS (
  SELECT
    agent_name,
    input_tokens,
    output_tokens,
    total_tokens,
    model_name,
    created_at,
    -- Calculate percentage of total
    ROUND(100.0 * total_tokens / SUM(total_tokens) OVER(), 2) as pct_of_total
  FROM token_usage
  WHERE submission_id = 'YOUR_SUBMISSION_ID'
)
SELECT
  agent_name,
  input_tokens,
  output_tokens,
  total_tokens,
  pct_of_total || '%' as percentage,
  model_name,
  created_at
FROM submission_tokens
ORDER BY created_at;
```

---

### 12. Monitor for Anomalies (High Token Usage)

```sql
WITH agent_stats AS (
  SELECT
    agent_name,
    AVG(total_tokens) as avg_tokens,
    STDDEV_POP(total_tokens) as stddev_tokens
  FROM token_usage
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY agent_name
)
SELECT
  tu.submission_id,
  tu.agent_name,
  tu.total_tokens,
  ast.avg_tokens,
  ROUND((tu.total_tokens - ast.avg_tokens) / NULLIF(ast.stddev_tokens, 0), 2) as std_deviations,
  tu.created_at
FROM token_usage tu
JOIN agent_stats ast ON tu.agent_name = ast.agent_name
WHERE tu.created_at >= NOW() - INTERVAL '24 hours'
  AND tu.total_tokens > ast.avg_tokens + (2 * ast.stddev_tokens)  -- More than 2 std devs above mean
ORDER BY std_deviations DESC;
```

---

### 13. Monthly Cost Report

```sql
SELECT
  TO_CHAR(created_at, 'YYYY-MM') as month,
  COUNT(DISTINCT submission_id) as submissions,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total_tokens,
  -- Sonnet 4.5 pricing
  ROUND((SUM(input_tokens) * 0.003 / 1000.0) +
        (SUM(output_tokens) * 0.015 / 1000.0), 2) as cost_usd
FROM token_usage
WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY month DESC;
```

---

### 14. Agent Performance Matrix

```sql
SELECT
  agent_name,
  COUNT(*) as total_calls,
  ROUND(AVG(input_tokens)) as avg_input,
  ROUND(AVG(output_tokens)) as avg_output,
  ROUND(AVG(total_tokens)) as avg_total,
  ROUND(AVG(output_tokens::numeric / NULLIF(input_tokens, 0)), 2) as output_to_input_ratio,
  -- Estimated cost per call (Sonnet 4.5)
  ROUND(AVG((input_tokens * 0.003 / 1000.0) + (output_tokens * 0.015 / 1000.0)), 4) as avg_cost_per_call
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY avg_total DESC;
```

---

### 15. Verify Token Tracking is Working

```sql
-- Check recent submissions have token data
SELECT
  ds.submission_id,
  ds.document_name,
  ds.ai_analysis_status,
  ds.ai_analysis_completed_at,
  COALESCE(vtu.total_tokens, 0) as total_tokens,
  COALESCE(vtu.agent_calls, 0) as agent_calls,
  vtu.agents_used
FROM document_submissions ds
LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
WHERE ds.submitted_at >= NOW() - INTERVAL '24 hours'
ORDER BY ds.submitted_at DESC
LIMIT 20;
```

**Expected Results:**
- Submissions with `ai_analysis_status = 'completed'` should have `total_tokens > 0`
- `agent_calls` should be 3-6 (depending on workflow path)
- `agents_used` array should include active agents

---

## Usage via Lambda Migration Function

Run queries directly via the migration Lambda:

```bash
# Example: Check token usage for a specific submission
aws lambda invoke \
  --function-name overlay-database-migration \
  --payload '{"migrationSQL": "SELECT * FROM v_token_usage_summary WHERE submission_id = '\''YOUR_ID'\''"}' \
  --cli-binary-format raw-in-base64-out \
  query-result.json

cat query-result.json
```

---

## Alerting Thresholds (Recommendations)

Set up monitoring alerts for:

1. **Daily spend exceeds $X**
   - Query 5 (Cost Estimation) > threshold

2. **Single submission uses > 100K tokens**
   - Query 7 (Top 10 Highest) > 100,000

3. **Agent averages spike > 2 std devs**
   - Query 12 (Monitor Anomalies)

4. **No token data for completed submissions**
   - Query 15 (Verify Tracking) shows 0 tokens for completed submissions

---

## Troubleshooting

### No Token Data for Recent Submissions

**Check:**
1. Migration 007 applied successfully
2. Lambda Layer deployed with updated db-utils.js
3. AI agents deployed with token tracking code
4. CloudWatch logs show "Token usage: X input, Y output" messages

**Query to diagnose:**
```sql
SELECT
  ds.submission_id,
  ds.ai_analysis_status,
  ds.ai_analysis_completed_at,
  vtu.total_tokens
FROM document_submissions ds
LEFT JOIN v_token_usage_summary vtu ON ds.submission_id = vtu.submission_id
WHERE ds.ai_analysis_status = 'completed'
  AND ds.ai_analysis_completed_at >= NOW() - INTERVAL '1 hour'
  AND (vtu.total_tokens IS NULL OR vtu.total_tokens = 0);
```

If query returns rows, token tracking is not working.

---

## Next Steps

1. **Baseline Establishment**: Run queries 3, 4, 8 after first week to establish baselines
2. **Budget Planning**: Use query 13 (Monthly Cost Report) for budget forecasting
3. **Optimization**: Use query 14 (Agent Performance Matrix) to identify optimization opportunities
4. **Monitoring Dashboard**: Create visualization dashboard using queries 2, 4, 5

---

**END OF QUERIES**
