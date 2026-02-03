# Token Tracking Implementation - Complete Summary

**Date:** February 3, 2026
**Feature:** Claude API token usage tracking for cost monitoring and analytics
**Status:** ✅ DEPLOYED TO PRODUCTION

---

## Implementation Summary

Token tracking has been successfully implemented across all AI agents to capture Claude API usage data for cost monitoring, optimization, and analytics.

### What Was Built

1. **Database Layer** (Migration 007)
   - New table: `token_usage` - Stores token data per agent invocation
   - New view: `v_token_usage_summary` - Aggregated tokens per submission
   - 5 indexes for query performance
   - Rollback migration included

2. **Lambda Layer Updates** (db-utils.js)
   - New function: `saveTokenUsage()` - Saves token data to database
   - New function: `getTokenUsageSummary()` - Retrieves aggregated data
   - Error handling: Token tracking failures don't break workflows

3. **AI Agent Updates** (6 agents)
   - orchestrator
   - scoring
   - content-analyzer
   - grammar-checker
   - structure-validator
   - clarification

4. **Analysis Tools**
   - [TOKEN_TRACKING_QUERIES.md](TOKEN_TRACKING_QUERIES.md) - 15 pre-built analysis queries
   - Cost estimation queries (Sonnet 4.5 pricing)
   - Anomaly detection queries
   - Performance monitoring queries

---

## Files Modified

### Database Migrations

| File | Purpose | Lines |
|------|---------|-------|
| `database/migrations/007_add_token_tracking.sql` | Create token_usage table + view | 69 |
| `database/migrations/rollback-007_add_token_tracking.sql` | Rollback migration | 35 |

### Lambda Layer (Shared Code)

| File | Changes | Lines Added |
|------|---------|-------------|
| `lambda/layers/common/nodejs/db-utils.js` | Added saveTokenUsage() + getTokenUsageSummary() | +65 |

### AI Agents

| File | Changes | Lines Added |
|------|---------|-------------|
| `lambda/functions/orchestrator/index.js` | Added token tracking call | +10 |
| `lambda/functions/scoring/index.js` | Added token tracking call | +12 |
| `lambda/functions/content-analyzer/index.js` | Added token tracking call | +12 |
| `lambda/functions/grammar-checker/index.js` | Added token tracking call | +11 |
| `lambda/functions/structure-validator/index.js` | Added token tracking call | +11 |
| `lambda/functions/clarification/index.js` | Added token tracking call | +11 |

### Documentation

| File | Purpose | Lines |
|------|---------|-------|
| `TOKEN_TRACKING_QUERIES.md` | 15 analysis queries with examples | 515 |
| `TOKEN_TRACKING_IMPLEMENTATION.md` | This file - implementation summary | ~300 |

---

## Deployment Status

### ✅ Completed Steps

1. **Migration 007 Applied** (overlay-database-migration Lambda)
   - Table created: `token_usage`
   - View created: `v_token_usage_summary`
   - 5 indexes created
   - Verification: 27 statements executed successfully

2. **Lambda Layer Deployed** (OverlayOrchestrationStack)
   - CommonLayer rebuilt with updated db-utils.js
   - New version published to AWS Lambda

3. **AI Agents Deployed** (OverlayOrchestrationStack)
   - All 6 agents rebuilt with token tracking code
   - Deployment status: UPDATE_COMPLETE
   - All agents now reference updated Lambda Layer

### Stack Deployment Timeline

```
[Building]  CommonLayer/Code ✅
[Building]  StructureValidatorFunction/Code ✅
[Building]  ContentAnalyzerFunction/Code ✅
[Building]  GrammarCheckerFunction/Code ✅
[Building]  OrchestratorFunction/Code ✅
[Building]  ClarificationFunction/Code ✅
[Building]  ScoringFunction/Code ✅
[Deploying] OverlayOrchestrationStack ✅
[Status]    UPDATE_COMPLETE ✅
```

---

## How It Works

### Data Flow

```
User submits document
    ↓
AI agent invokes Claude API
    ↓
Claude returns response with usage: { input_tokens, output_tokens }
    ↓
Agent calls saveTokenUsage(dbClient, {
  submissionId,
  agentName,
  inputTokens,
  outputTokens,
  modelName
})
    ↓
Token data saved to token_usage table
    ↓
Aggregated view v_token_usage_summary updated automatically
```

### Example Agent Code

```javascript
// After Claude API call
const llmResponse = await claude.sendMessage(prompt, {
  model: process.env.MODEL_ID,
  max_tokens: 4096,
});

// Extract token usage
const { input_tokens, output_tokens } = llmResponse.usage;
const model_used = llmResponse.model;

console.log(`Token usage: ${input_tokens} input, ${output_tokens} output`);

// Save to database
if (submissionId) {
  await saveTokenUsage(dbClient, {
    submissionId,
    agentName: 'orchestrator',  // or 'scoring', 'content-analyzer', etc.
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    modelName: model_used,
  });
}
```

---

## Testing Instructions

### Step 1: Submit a Test Document

1. **Navigate to:** http://localhost:3000
2. **Login:** admin@example.com / TestPassword123!
3. **Go to Dashboard** → Select a session
4. **Upload a document** (or paste text)
5. **Wait for AI analysis** to complete (status: pending → in_progress → completed)
6. **Expected time:** 30-90 seconds

### Step 2: Check CloudWatch Logs

**Verify agents are tracking tokens:**

1. Go to AWS CloudWatch Console
2. Navigate to Log groups: `/aws/lambda/overlay-*`
3. Check recent logs for each agent:
   - `/aws/lambda/overlay-orchestrator`
   - `/aws/lambda/overlay-scoring`
   - `/aws/lambda/overlay-content-analyzer`
   - `/aws/lambda/overlay-grammar-checker`
   - `/aws/lambda/overlay-structure-validator`
   - `/aws/lambda/overlay-clarification`

4. **Look for log messages:**
   ```
   Token usage: 1234 input, 567 output
   [Token Tracking] Saving tokens for orchestrator: input=1234, output=567, model=claude-sonnet-4-5-20250929
   [Token Tracking] Saved successfully: 1801 total tokens
   ```

5. **Expected:** All agents show token tracking logs with no errors

### Step 3: Verify Database Records

**Query token_usage table:**

```bash
# Create query file
cat > query-tokens.sql <<'EOF'
SELECT
  agent_name,
  input_tokens,
  output_tokens,
  total_tokens,
  model_name,
  created_at
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
EOF

# Execute via migration Lambda
aws lambda invoke \
  --function-name overlay-database-migration \
  --payload "$(cat query-tokens.sql | jq -Rs '{migrationSQL: .}')" \
  --cli-binary-format raw-in-base64-out \
  tokens-result.json

cat tokens-result.json
```

**Expected Results:**
- Multiple rows (3-6) for your test submission
- One row per agent invocation
- `total_tokens` values ranging from 500-10,000+ depending on document size
- `model_name` should be `claude-sonnet-4-5-20250929` or similar

### Step 4: View Aggregated Summary

```bash
# Query aggregated view
cat > query-summary.sql <<'EOF'
SELECT
  submission_id,
  agent_calls,
  total_input_tokens,
  total_output_tokens,
  total_tokens,
  agents_used,
  last_agent_call
FROM v_token_usage_summary
WHERE last_agent_call >= NOW() - INTERVAL '1 hour'
ORDER BY last_agent_call DESC
LIMIT 5;
EOF

aws lambda invoke \
  --function-name overlay-database-migration \
  --payload "$(cat query-summary.sql | jq -Rs '{migrationSQL: .}')" \
  --cli-binary-format raw-in-base64-out \
  summary-result.json

cat summary-result.json
```

**Expected Results:**
- `agent_calls`: 3-6 (depending on workflow path)
- `total_tokens`: 2,000-50,000+ (varies by document size)
- `agents_used`: Array like `['structure-validator', 'content-analyzer', 'grammar-checker', 'orchestrator', 'scoring']`

---

## Success Criteria

✅ **All criteria must be met:**

1. **Migration Applied**
   - ✅ Table `token_usage` exists
   - ✅ View `v_token_usage_summary` exists
   - ✅ 5 indexes created

2. **Agents Deployed**
   - ✅ Lambda Layer updated with saveTokenUsage()
   - ✅ All 6 agents rebuilt with token tracking
   - ✅ CloudFormation stack status: UPDATE_COMPLETE

3. **Data Collection**
   - ⏳ CloudWatch logs show "Token usage:" messages
   - ⏳ CloudWatch logs show "[Token Tracking] Saved successfully"
   - ⏳ Database query returns token records
   - ⏳ Aggregated view shows correct totals

4. **No Regressions**
   - ⏳ AI workflow completes successfully
   - ⏳ Submissions reach "completed" status
   - ⏳ Token tracking failures don't break workflow

**Status:** Steps 1-2 complete, Steps 3-4 require user testing

---

## Analysis Queries

See [TOKEN_TRACKING_QUERIES.md](TOKEN_TRACKING_QUERIES.md) for 15 pre-built queries including:

1. Total tokens by submission
2. Recent token usage (last 24 hours)
3. Token usage by agent
4. Daily usage trends
5. **Cost estimation** (Sonnet 4.5 pricing)
6. Token usage by model
7. Top 10 highest token submissions
8. Average tokens per agent
9. Token usage by user
10. Token usage by overlay type
11. Detailed breakdown for single submission
12. **Anomaly detection** (high usage alerts)
13. Monthly cost report
14. Agent performance matrix
15. **Verification query** (check tracking is working)

---

## Cost Monitoring

### Current Pricing (Claude Sonnet 4.5)

- **Input tokens:** $0.003 per 1,000 tokens
- **Output tokens:** $0.015 per 1,000 tokens

### Example Cost Calculation

**Typical submission** (6 agents):
- Structure Validator: 2,000 input + 500 output = 2,500 tokens = $0.01
- Content Analyzer: 5,000 input + 2,000 output = 7,000 tokens = $0.05
- Grammar Checker: 3,000 input + 1,000 output = 4,000 tokens = $0.02
- Orchestrator: 1,000 input + 500 output = 1,500 tokens = $0.01
- Clarification: 1,500 input + 800 output = 2,300 tokens = $0.02
- Scoring: 6,000 input + 3,000 output = 9,000 tokens = $0.06
- **Total: 26,300 tokens ≈ $0.17 per submission**

**Monthly estimate** (1,000 submissions):
- 1,000 submissions × $0.17 = **$170/month**

### Cost Optimization Tips

1. **Monitor high-usage agents** (Query 14 - Agent Performance Matrix)
2. **Reduce prompt sizes** where possible
3. **Use Haiku for simple tasks** (grammar, structure) - 5-10x cheaper
4. **Set max_tokens limits** to prevent runaway costs
5. **Cache frequently used prompts** (when Claude caching becomes available)

---

## Troubleshooting

### Issue: No Token Data in Database

**Symptoms:**
- Query returns 0 rows for recent submissions
- CloudWatch logs don't show "[Token Tracking] Saved successfully"

**Diagnosis:**

1. **Check CloudWatch logs** for errors:
   ```
   Error saving tokens for orchestrator: [error message]
   ```

2. **Verify migration applied:**
   ```bash
   aws lambda invoke \
     --function-name overlay-database-migration \
     --payload '{"migrationSQL": "SELECT table_name FROM information_schema.tables WHERE table_name = '\''token_usage'\''"}' \
     --cli-binary-format raw-in-base64-out \
     check-table.json

   cat check-table.json
   ```

3. **Verify agents deployed:**
   ```bash
   aws lambda get-function --function-name overlay-orchestrator \
     --query 'Configuration.[FunctionName,LastModified,State]' \
     --output table
   ```

**Fix:**
- Re-deploy OverlayOrchestrationStack: `cdk deploy OverlayOrchestrationStack`

---

### Issue: Token Counts Seem Wrong

**Symptoms:**
- Total tokens much higher/lower than expected
- Some agents missing from agents_used array

**Diagnosis:**

1. **Check individual agent calls:**
   ```sql
   SELECT * FROM token_usage
   WHERE submission_id = 'YOUR_ID'
   ORDER BY created_at;
   ```

2. **Verify all agents ran:**
   - Check Step Functions execution in AWS Console
   - Some agents may be skipped (clarification only runs if orchestrator requests it)

3. **Compare with CloudWatch logs:**
   - Log message: "Token usage: X input, Y output"
   - Should match database values

---

### Issue: Agents Fail After Deployment

**Symptoms:**
- AI workflow stuck in "in_progress"
- CloudWatch logs show errors related to saveTokenUsage

**Fix:**
```javascript
// Token tracking has try-catch to prevent failures
// Check logs for specific error message
// Common issues:
// - Database connection timeout (check VPC security groups)
// - Invalid submission_id (check workflow passes submissionId correctly)
```

---

## Next Steps

### Immediate (Next 24 Hours)

1. ✅ Deploy token tracking to production
2. ⏳ **Test with real submission** (see Testing Instructions above)
3. ⏳ **Verify data collection** (check CloudWatch + database)
4. ⏳ **Run verification query** (Query #15 in TOKEN_TRACKING_QUERIES.md)

### Short-term (Next Week)

1. **Establish baselines:**
   - Run Query #3 (Token Usage by Agent)
   - Run Query #8 (Average Tokens per Agent)
   - Document typical token ranges per agent

2. **Set up monitoring:**
   - Create CloudWatch dashboard with token metrics
   - Set alert for daily spend > $X
   - Set alert for anomalous token usage (Query #12)

3. **Cost analysis:**
   - Run Query #5 (Cost Estimation) daily
   - Compare actual vs estimated costs
   - Identify optimization opportunities

### Long-term (Next Month)

1. **Optimization:**
   - Use Query #14 (Agent Performance Matrix) to identify inefficiencies
   - Test Haiku for simpler agents (grammar, structure)
   - Reduce prompt sizes where possible

2. **Analytics:**
   - Build visualization dashboard (Grafana or similar)
   - Track cost trends over time
   - Correlate token usage with document types/sizes

3. **Budgeting:**
   - Use Query #13 (Monthly Cost Report) for budget planning
   - Set per-user or per-overlay token limits if needed
   - Implement usage quotas for free tier users

---

## Rollback Plan

If token tracking causes issues:

```bash
# 1. Rollback database migration
aws lambda invoke \
  --function-name overlay-database-migration \
  --payload '{"migrationSQL": "$(cat database/migrations/rollback-007_add_token_tracking.sql)"}' \
  --cli-binary-format raw-in-base64-out \
  rollback-result.json

# 2. Revert code changes
git revert HEAD~6  # Or specific commit

# 3. Re-deploy agents
cdk deploy OverlayOrchestrationStack
```

Token tracking is **non-blocking** - failures won't break AI workflow.

---

## Architecture Benefits

**Before Token Tracking:**
- ❌ No visibility into Claude API costs
- ❌ Can't identify expensive agents
- ❌ No way to optimize prompts
- ❌ Can't predict monthly spend
- ❌ No anomaly detection

**After Token Tracking:**
- ✅ Real-time cost monitoring
- ✅ Per-agent cost breakdown
- ✅ Identify optimization opportunities
- ✅ Accurate budget forecasting
- ✅ Anomaly detection and alerts
- ✅ User/overlay cost attribution
- ✅ Historical trend analysis

---

## Key Metrics to Track

### Daily

1. **Total tokens consumed** (Query #2)
2. **Estimated daily cost** (Query #5)
3. **Active submissions** (Query #15)

### Weekly

1. **Token usage by agent** (Query #3)
2. **Average tokens per submission** (Query #8)
3. **Top 10 highest usage submissions** (Query #7)

### Monthly

1. **Monthly cost report** (Query #13)
2. **Usage trends** (Query #4)
3. **Cost per user/overlay** (Queries #9, #10)

---

## Support and Documentation

- **Implementation Guide:** This file
- **Analysis Queries:** [TOKEN_TRACKING_QUERIES.md](TOKEN_TRACKING_QUERIES.md)
- **Migration Files:** `database/migrations/007_*.sql`
- **Shared Code:** `lambda/layers/common/nodejs/db-utils.js`
- **CloudWatch Logs:** `/aws/lambda/overlay-*`

---

**Implementation Complete ✅**

**Next Action:** Test with real submission and verify token data collection

---

**END OF IMPLEMENTATION SUMMARY**
