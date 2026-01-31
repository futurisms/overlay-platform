# Token Tracking Implementation - Prevention Plan

**Version**: 1.0
**Status**: Awaiting Approval
**Last Updated**: 2026-01-31
**Estimated Duration**: 10-13 hours across 5 phases

## Executive Summary

This plan outlines the implementation of AI token usage tracking across the Overlay Platform's 6-agent workflow. This is a **BREAKING CHANGE** that affects:
- Lambda Layer LLM client (return value structure change)
- All 6 AI agents (response handling)
- Database schema (new tables and columns)
- Frontend API client (new endpoints)
- Frontend dashboard (analytics display)

**Key Principles:**
- ✅ Test after EVERY change
- ✅ One component at a time
- ✅ Rollback capability at every phase
- ✅ Emergency stop if stuck >2 hours
- ✅ Non-blocking credits system for testing
- ✅ Dynamic agent support (no hardcoded names)

---

## Phase 0: Pre-Implementation Testing & Documentation

### Objectives
- Verify current system stability baseline
- Document current token tracking status
- Set up testing environment (Q18)
- Create rollback scripts
- Update documentation structure

### Tasks

#### 0.1 System Health Check
- [ ] Test Q12-Q17 submissions still work correctly
- [ ] Verify all 6 agents completing successfully
- [ ] Check feedback reports displaying properly
- [ ] Confirm no CloudWatch errors in last 24 hours
- [ ] Document current API response times (baseline)

#### 0.2 Database Investigation
- [ ] Run `check-token-usage.sql` queries to verify schema
- [ ] Confirm `ai_analysis_results` table exists but unused
- [ ] Check if any columns have token data (should be NULL)
- [ ] Document current `feedback_reports` structure

#### 0.3 Testing Environment Setup
- [ ] Create Q18 test session: "Token Tracking Test Session"
- [ ] Upload test document to Q18 (use small doc for fast iteration)
- [ ] DO NOT use Q12-Q17 (keep as stable baseline)
- [ ] Document Q18 submission ID for testing

#### 0.4 Create Rollback Scripts
- [ ] Create `scripts/rollback-token-tracking.sh`
- [ ] Script should restore previous Lambda versions
- [ ] Script should rollback database migrations
- [ ] Test script execution (dry-run mode)

#### 0.5 Documentation Updates
- [ ] Create `TOKEN_TRACKING_IMPLEMENTATION_SCHEDULE.md`
- [ ] Update `FUTURE_ENHANCEMENTS.md` to move token tracking to "In Progress"
- [ ] Add Phase 0 checkpoint to `CLAUDE.md`

### Success Criteria
- ✅ All Q12-Q17 submissions still completing successfully
- ✅ Q18 test session created and ready
- ✅ Rollback script tested and working
- ✅ Documentation structure in place

### Rollback Procedure
If system is unstable:
1. Document issues in `PHASE_0_ISSUES.md`
2. Run health check script: `npm run test:api`
3. Check CloudWatch logs for errors
4. Resolve stability issues before proceeding

### Emergency Stop Conditions
- More than 5 errors in CloudWatch logs (last 1 hour)
- Any Q12-Q17 submission failing
- Database connection errors
- More than 1 hour debugging Phase 0 setup

---

## Phase 1: Database Schema Updates

### Objectives
- Add token tracking columns to `feedback_reports` table
- Create `ai_token_usage` summary table
- Create `organization_credits` table
- Add database indexes for performance
- **NO CODE CHANGES** - Database only

### Tasks

#### 1.1 Create Migration Files
- [ ] Create `database/migrations/006_token_tracking.sql`
- [ ] Create `database/migrations/rollback-006_token_tracking.sql`
- [ ] Add columns: `input_tokens`, `output_tokens`, `model_used` to `feedback_reports`
- [ ] Create `ai_token_usage` table (aggregated stats by session/overlay)
- [ ] Create `organization_credits` table (tracking and limits)
- [ ] Add indexes on token columns

#### 1.2 Review Migration SQL
```sql
-- Add token columns to feedback_reports
ALTER TABLE feedback_reports
ADD COLUMN input_tokens INTEGER DEFAULT 0,
ADD COLUMN output_tokens INTEGER DEFAULT 0,
ADD COLUMN model_used VARCHAR(100);

-- Create ai_token_usage table (aggregated stats)
CREATE TABLE IF NOT EXISTS ai_token_usage (
  usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id),
  session_id UUID REFERENCES review_sessions(session_id),
  overlay_id UUID REFERENCES overlays(overlay_id),
  agent_name VARCHAR(100) NOT NULL,  -- Dynamic, no CHECK constraint
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0.00,
  analysis_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create organization_credits table
CREATE TABLE IF NOT EXISTS organization_credits (
  organization_id UUID PRIMARY KEY REFERENCES organizations(organization_id),
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  available_credits INTEGER GENERATED ALWAYS AS (total_credits - used_credits) STORED,
  is_unlimited BOOLEAN DEFAULT FALSE,  -- For testing: admin gets unlimited
  last_topup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_ai_token_usage_org ON ai_token_usage(organization_id);
CREATE INDEX idx_ai_token_usage_session ON ai_token_usage(session_id);
CREATE INDEX idx_ai_token_usage_overlay ON ai_token_usage(overlay_id);
CREATE INDEX idx_org_credits_available ON organization_credits(available_credits);
```

#### 1.3 Run Migration
- [ ] Test migration locally (if possible via Lambda)
- [ ] Run: `npm run migrate:lambda` with 006 migration
- [ ] Verify columns added: Query `feedback_reports` schema
- [ ] Verify tables created: Query `ai_token_usage` and `organization_credits`
- [ ] Check indexes created successfully

#### 1.4 Testing Checkpoint
- [ ] Run `check-token-usage.sql` to verify new columns exist
- [ ] Verify existing Q12-Q17 data intact (no data loss)
- [ ] Check all columns have correct data types
- [ ] Verify generated column `available_credits` working

#### 1.5 Seed Initial Credits
- [ ] Add unlimited credits for admin organization
```sql
INSERT INTO organization_credits (organization_id, total_credits, is_unlimited)
SELECT organization_id, 1000000, TRUE
FROM organizations
WHERE name = 'System Admin'
ON CONFLICT (organization_id) DO UPDATE
SET is_unlimited = TRUE;
```

### Success Criteria
- ✅ Migration executes without errors
- ✅ All new columns and tables present
- ✅ Existing data unchanged (Q12-Q17 intact)
- ✅ Indexes created successfully
- ✅ Admin organization has unlimited credits

### Rollback Procedure
If migration fails:
1. Run `database/migrations/rollback-006_token_tracking.sql`
2. Verify columns removed: `SELECT * FROM information_schema.columns WHERE table_name='feedback_reports' AND column_name LIKE '%token%';`
3. Verify tables dropped: `\dt ai_token_usage` (should not exist)
4. Document error in `PHASE_1_ISSUES.md`
5. Fix migration SQL and retry

### Emergency Stop Conditions
- Migration fails to execute
- Data loss detected (any Q12-Q17 submission affected)
- More than 2 hours debugging migration errors
- Database performance degradation (query times >500ms)

---

## Phase 2: Lambda Layer LLM Client Update

### Objectives
- Modify `llm-client.js` to return both text AND usage data
- **BREAKING CHANGE**: Return value structure changes from `string` to `object`
- Deploy updated Lambda Layer
- **NO AGENT CHANGES YET** - Layer only

### Tasks

#### 2.1 Update LLM Client Code
- [ ] Open `lambda/layers/common/nodejs/llm-client.js`
- [ ] Modify `sendMessage()` to return structured response
- [ ] Update version to 2.4.0

**Before (line 75):**
```javascript
return response.content[0].text;  // ❌ Discards usage data
```

**After:**
```javascript
return {
  text: response.content[0].text,
  usage: {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  },
  model: response.model,
};
```

#### 2.2 Update getModelInfo Function
- [ ] Add token pricing information to model info
```javascript
function getModelInfo() {
  return {
    defaultModel: 'claude-sonnet-4-5-20250929',
    supportedModels: [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251101',
      'claude-3-5-sonnet-20241022',
    ],
    pricing: {
      'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },  // per 1K tokens
      'claude-opus-4-5-20251101': { input: 0.015, output: 0.075 },
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    },
    version: '2.4.0',
  };
}
```

#### 2.3 Deploy Lambda Layer
- [ ] Build Lambda Layer: `cd lambda/layers/common && npm install`
- [ ] Deploy OrchestrationStack: `cdk deploy OverlayOrchestrationStack`
- [ ] Verify deployment success in CloudFormation
- [ ] Check Lambda Layer version incremented

#### 2.4 Testing Checkpoint (CRITICAL)
**⚠️ WARNING: All agents will BREAK at this point until Phase 3 updates**

- [ ] DO NOT trigger any Q18 submissions yet
- [ ] Verify Layer deployment only (no function updates)
- [ ] Check CloudWatch logs - no new invocations
- [ ] Document Layer ARN for rollback

### Success Criteria
- ✅ LLM client code updated with new return structure
- ✅ Lambda Layer deployed successfully
- ✅ No Q18 submissions triggered (agents not updated yet)
- ✅ Layer ARN documented

### Rollback Procedure
If deployment fails:
1. Revert `llm-client.js` to previous version (git checkout)
2. Redeploy Layer: `cdk deploy OverlayOrchestrationStack`
3. Verify Layer version rolled back
4. Test with Q12 (should still work)
5. Document error in `PHASE_2_ISSUES.md`

### Emergency Stop Conditions
- Layer deployment fails
- CloudFormation stack rollback triggered
- More than 1 hour debugging deployment issues

---

## Phase 3: AI Agent Updates (One at a Time)

### Objectives
- Update each of 6 agents to handle new LLM client response structure
- Add token tracking logic to store usage data
- Test EACH agent individually before proceeding to next
- Deploy agents ONE AT A TIME

### Agent Update Order
1. **structure-validator** (simplest, least critical)
2. **grammar-checker** (simple, independent)
3. **clarification** (moderate complexity)
4. **content-analyzer** (most complex, wait until others work)
5. **scoring** (final aggregation)
6. **orchestrator** (coordinator)

### Tasks Per Agent

#### 3.1 Structure Validator Update

##### 3.1.1 Update Code
- [ ] Open `lambda/functions/step-functions/structure-validator/index.js`
- [ ] Find line where `claude.sendMessage()` is called
- [ ] Update response handling from `string` to `object`

**Before:**
```javascript
const response = await claude.sendMessage(prompt, { model, max_tokens });
// response is string
```

**After:**
```javascript
const llmResponse = await claude.sendMessage(prompt, { model, max_tokens });
const response = llmResponse.text;  // Extract text
const { input_tokens, output_tokens } = llmResponse.usage;
const model_used = llmResponse.model;
```

##### 3.1.2 Add Token Storage Logic
- [ ] After parsing JSON response, store token data
```javascript
// Store tokens in database
await dbClient.query(`
  UPDATE feedback_reports
  SET input_tokens = $1, output_tokens = $2, model_used = $3
  WHERE submission_id = $4 AND report_type = 'structure_validation'
`, [input_tokens, output_tokens, model_used, submissionId]);
```

##### 3.1.3 Deploy Structure Validator Only
- [ ] Deploy: `cdk deploy OverlayOrchestrationStack`
- [ ] Verify only structure-validator updated (check Lambda console)

##### 3.1.4 Test Structure Validator
- [ ] Trigger Q18 submission (upload small test document)
- [ ] Watch CloudWatch logs for structure-validator
- [ ] Verify token data stored in `feedback_reports`
- [ ] Check no errors in other agents (should skip)
- [ ] Query: `SELECT input_tokens, output_tokens FROM feedback_reports WHERE submission_id='Q18-id' AND report_type='structure_validation';`

##### 3.1.5 Success Criteria
- ✅ Structure validator completes without errors
- ✅ Token data stored in database (values > 0)
- ✅ Q18 submission shows structure validation completed
- ✅ Other agents not affected yet

##### 3.1.6 Rollback Procedure
If structure validator fails:
1. Check CloudWatch logs for error
2. If error is in response handling: Revert code, redeploy
3. If error is in database: Check migration, verify column types
4. Document error in `PHASE_3_STRUCTURE_VALIDATOR_ISSUES.md`
5. Fix and retry before proceeding to next agent

#### 3.2 Grammar Checker Update
- [ ] Repeat steps 3.1.1 - 3.1.6 for grammar-checker
- [ ] Update `lambda/functions/step-functions/grammar-checker/index.js`
- [ ] Deploy: `cdk deploy OverlayOrchestrationStack`
- [ ] Test with NEW Q18 submission
- [ ] Verify both structure-validator AND grammar-checker store tokens

#### 3.3 Clarification Update
- [ ] Repeat steps 3.1.1 - 3.1.6 for clarification
- [ ] Update `lambda/functions/step-functions/clarification/index.js`
- [ ] Deploy: `cdk deploy OverlayOrchestrationStack`
- [ ] Test with NEW Q18 submission
- [ ] Verify 3 agents now storing tokens

#### 3.4 Content Analyzer Update
- [ ] Repeat steps 3.1.1 - 3.1.6 for content-analyzer
- [ ] Update `lambda/functions/step-functions/content-analyzer/index.js`
- [ ] Deploy: `cdk deploy OverlayOrchestrationStack`
- [ ] Test with NEW Q18 submission
- [ ] Verify 4 agents now storing tokens

#### 3.5 Scoring Update
- [ ] Repeat steps 3.1.1 - 3.1.6 for scoring
- [ ] Update `lambda/functions/step-functions/scoring/index.js`
- [ ] Deploy: `cdk deploy OverlayOrchestrationStack`
- [ ] Test with NEW Q18 submission
- [ ] Verify 5 agents now storing tokens

#### 3.6 Orchestrator Update
- [ ] Repeat steps 3.1.1 - 3.1.6 for orchestrator
- [ ] Update `lambda/functions/step-functions/orchestrator/index.js`
- [ ] Deploy: `cdk deploy OverlayOrchestrationStack`
- [ ] Test with NEW Q18 submission
- [ ] Verify ALL 6 agents now storing tokens

### Success Criteria (Phase 3 Complete)
- ✅ All 6 agents updated and deployed
- ✅ Q18 submission completes successfully end-to-end
- ✅ All 6 feedback reports have token data (input_tokens > 0, output_tokens > 0)
- ✅ No errors in CloudWatch logs
- ✅ Q12-Q17 still working (if retested)

### Rollback Procedure (Full Phase 3)
If multiple agents failing:
1. Run rollback script: `bash scripts/rollback-token-tracking.sh --phase 3`
2. Revert ALL agent code changes: `git checkout HEAD~N lambda/functions/step-functions/`
3. Redeploy: `cdk deploy OverlayOrchestrationStack`
4. Verify Q12 submission still works
5. Document errors in `PHASE_3_ROLLBACK_LOG.md`

### Emergency Stop Conditions
- Any agent fails to complete after 3 retry attempts
- Token data not storing in database after 2 agents updated
- More than 3 hours debugging Phase 3 (across all agents)
- Step Functions workflow timing out

---

## Phase 4: Backend API Endpoints

### Objectives
- Create new API endpoints for token analytics
- Add endpoints to submissions API handler
- Add credit checking logic (non-blocking for admin)
- Deploy ComputeStack
- Test endpoints manually

### Tasks

#### 4.1 Add Token Analytics Endpoint
- [ ] Open `lambda/functions/api/submissions/index.js`
- [ ] Add route handler for `/analytics/tokens` endpoint

```javascript
// GET /analytics/tokens?session_id=xxx or ?overlay_id=xxx
async function handleGetTokenAnalytics(dbClient, queryParams, userId) {
  const { session_id, overlay_id } = queryParams;

  const result = await dbClient.query(`
    SELECT
      agent_name,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      COUNT(*) as analysis_count,
      SUM(input_tokens * 0.003 / 1000 + output_tokens * 0.015 / 1000) as total_cost_usd
    FROM feedback_reports
    WHERE ($1::uuid IS NULL OR submission_id IN (
      SELECT submission_id FROM document_submissions WHERE session_id = $1
    ))
    AND ($2::uuid IS NULL OR submission_id IN (
      SELECT submission_id FROM document_submissions ds
      JOIN review_sessions rs ON ds.session_id = rs.session_id
      WHERE rs.overlay_id = $2
    ))
    GROUP BY agent_name
    ORDER BY agent_name
  `, [session_id || null, overlay_id || null]);

  return {
    statusCode: 200,
    body: JSON.stringify({
      analytics: result.rows,
      total_cost: result.rows.reduce((sum, row) => sum + parseFloat(row.total_cost_usd), 0),
    }),
  };
}
```

#### 4.2 Add Organization Credits Endpoint
- [ ] Add route handler for `/organizations/{id}/credits`

```javascript
// GET /organizations/{id}/credits
async function handleGetCredits(dbClient, pathParameters, userId) {
  const orgId = pathParameters.id;

  const result = await dbClient.query(`
    SELECT total_credits, used_credits, available_credits, is_unlimited
    FROM organization_credits
    WHERE organization_id = $1
  `, [orgId]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Organization credits not found' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ credits: result.rows[0] }),
  };
}
```

#### 4.3 Add Credit Checking Logic (Non-Blocking)
- [ ] Create utility function to check credits before analysis
```javascript
async function checkCredits(dbClient, organizationId, estimatedCost) {
  const result = await dbClient.query(`
    SELECT is_unlimited, available_credits
    FROM organization_credits
    WHERE organization_id = $1
  `, [organizationId]);

  if (result.rows.length === 0) {
    console.warn(`No credits record for org ${organizationId}, allowing analysis`);
    return { allowed: true, unlimited: false };
  }

  const { is_unlimited, available_credits } = result.rows[0];

  if (is_unlimited) {
    console.log(`Organization ${organizationId} has unlimited credits`);
    return { allowed: true, unlimited: true };
  }

  const sufficient = available_credits >= estimatedCost;
  console.log(`Credits check: available=${available_credits}, estimated=${estimatedCost}, sufficient=${sufficient}`);

  // ⚠️ NON-BLOCKING for testing: Always allow, just log warning
  if (!sufficient) {
    console.warn(`Organization ${organizationId} has insufficient credits, but allowing analysis for testing`);
  }

  return { allowed: true, unlimited: false, warning: !sufficient };
}
```

#### 4.4 Update Submissions Handler Routes
- [ ] Add new routes to main handler
```javascript
if (httpMethod === 'GET' && path === '/analytics/tokens') {
  return await handleGetTokenAnalytics(dbClient, queryStringParameters, userId);
}
if (httpMethod === 'GET' && path.match(/^\/organizations\/[^\/]+\/credits$/)) {
  return await handleGetCredits(dbClient, pathParameters, userId);
}
```

#### 4.5 Deploy ComputeStack
- [ ] Deploy: `cdk deploy OverlayComputeStack`
- [ ] Verify SubmissionsHandler updated
- [ ] Check CloudFormation for successful deployment

#### 4.6 Test Endpoints Manually
- [ ] Test token analytics endpoint:
```bash
curl -H "Authorization: Bearer <token>" \
  "https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/analytics/tokens?session_id=<Q18-session-id>"
```
- [ ] Test credits endpoint:
```bash
curl -H "Authorization: Bearer <token>" \
  "https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/organizations/<admin-org-id>/credits"
```
- [ ] Verify JSON responses correct format
- [ ] Check token counts match database

### Success Criteria
- ✅ Both endpoints deployed and accessible
- ✅ Token analytics returns correct aggregated data
- ✅ Credits endpoint shows unlimited for admin org
- ✅ Credit checking logic non-blocking (allows all analyses)
- ✅ No errors in CloudWatch logs

### Rollback Procedure
If endpoints fail:
1. Check CloudWatch logs for API errors
2. Revert `submissions/index.js` changes
3. Redeploy: `cdk deploy OverlayComputeStack`
4. Verify Q18 submission still works (without analytics)
5. Document error in `PHASE_4_ISSUES.md`

### Emergency Stop Conditions
- Endpoints returning 500 errors consistently
- Database query timeout (>5 seconds)
- More than 2 hours debugging endpoint issues

---

## Phase 5: Frontend Integration

### Objectives
- Add token analytics methods to API client
- Create analytics dashboard component
- Add token usage display to submission detail page
- Add credits display to dashboard
- Deploy frontend (or test locally)

### Tasks

#### 5.1 Update API Client
- [ ] Open `frontend/lib/api-client.ts`
- [ ] Add token analytics method
```typescript
async getTokenAnalytics(sessionId?: string, overlayId?: string) {
  const params = new URLSearchParams();
  if (sessionId) params.append('session_id', sessionId);
  if (overlayId) params.append('overlay_id', overlayId);

  return this.request<{
    analytics: Array<{
      agent_name: string;
      total_input_tokens: number;
      total_output_tokens: number;
      analysis_count: number;
      total_cost_usd: number;
    }>;
    total_cost: number;
  }>(`/analytics/tokens?${params.toString()}`);
}

async getOrganizationCredits(organizationId: string) {
  return this.request<{
    credits: {
      total_credits: number;
      used_credits: number;
      available_credits: number;
      is_unlimited: boolean;
    };
  }>(`/organizations/${organizationId}/credits`);
}
```

#### 5.2 Create Token Analytics Component
- [ ] Create `frontend/components/analytics/TokenUsageCard.tsx`
```typescript
import { Card } from "@/components/ui/card";

interface TokenUsageCardProps {
  sessionId?: string;
  overlayId?: string;
}

export function TokenUsageCard({ sessionId, overlayId }: TokenUsageCardProps) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      const apiClient = new ApiClient();
      const data = await apiClient.getTokenAnalytics(sessionId, overlayId);
      setAnalytics(data);
      setLoading(false);
    }
    fetchAnalytics();
  }, [sessionId, overlayId]);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">AI Token Usage</h3>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Input Tokens</th>
            <th>Output Tokens</th>
            <th>Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
          {analytics.analytics.map(row => (
            <tr key={row.agent_name}>
              <td>{row.agent_name}</td>
              <td>{row.total_input_tokens.toLocaleString()}</td>
              <td>{row.total_output_tokens.toLocaleString()}</td>
              <td>${row.total_cost_usd.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={3}>Total Cost</td>
            <td>${analytics.total_cost.toFixed(4)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
```

#### 5.3 Add to Session Detail Page
- [ ] Open `frontend/app/session/[id]/page.tsx`
- [ ] Import `TokenUsageCard` component
- [ ] Add below submissions list
```tsx
<TokenUsageCard sessionId={session.session_id} />
```

#### 5.4 Add to Submission Detail Page
- [ ] Open `frontend/app/submission/[id]/page.tsx`
- [ ] Add token usage section after feedback display
```tsx
{feedback && (
  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded text-sm">
    <div className="flex justify-between">
      <span>Input Tokens:</span>
      <span className="font-mono">{feedback.input_tokens?.toLocaleString()}</span>
    </div>
    <div className="flex justify-between">
      <span>Output Tokens:</span>
      <span className="font-mono">{feedback.output_tokens?.toLocaleString()}</span>
    </div>
    <div className="flex justify-between">
      <span>Model:</span>
      <span className="text-xs">{feedback.model_used}</span>
    </div>
  </div>
)}
```

#### 5.5 Test Frontend Locally
- [ ] Start proxy server: `node frontend/proxy-server.js`
- [ ] Start Next.js: `npm run dev`
- [ ] Navigate to Q18 session detail page
- [ ] Verify token analytics table displays
- [ ] Navigate to Q18 submission detail page
- [ ] Verify per-agent token counts display
- [ ] Check console for errors

#### 5.6 Build and Test
- [ ] Build frontend: `npm run build`
- [ ] Verify no TypeScript errors
- [ ] Test production build: `npm start`
- [ ] Verify analytics still working in production mode

### Success Criteria
- ✅ API client methods added without errors
- ✅ Token analytics component renders correctly
- ✅ Session detail page shows aggregated token usage
- ✅ Submission detail page shows per-agent token counts
- ✅ No console errors or TypeScript errors
- ✅ Production build successful

### Rollback Procedure
If frontend issues:
1. Revert frontend changes: `git checkout HEAD~N frontend/`
2. Rebuild: `npm run build`
3. Verify frontend still works without token analytics
4. Backend endpoints still functional (Phase 4 intact)
5. Document error in `PHASE_5_ISSUES.md`

### Emergency Stop Conditions
- TypeScript compilation errors blocking build
- Frontend crashes on page load
- More than 2 hours debugging frontend issues

---

## Integration Points Map

### Critical Integration Points (Where Things Can Break)

#### Integration Point 1: LLM Client → AI Agents
**Location**: `lambda/layers/common/nodejs/llm-client.js` → All 6 agent functions
**Change**: Return value structure changes from `string` to `object`
**Risk**: HIGH - Breaking change affects all agents
**Testing**: Phase 3, test each agent individually
**Rollback**: Revert Layer + redeploy agents

#### Integration Point 2: AI Agents → Database
**Location**: All 6 agent functions → Aurora PostgreSQL `feedback_reports` table
**Change**: New columns `input_tokens`, `output_tokens`, `model_used`
**Risk**: MEDIUM - Database schema change
**Testing**: Phase 1, verify columns exist before agent updates
**Rollback**: Run migration rollback SQL

#### Integration Point 3: API Handlers → Database
**Location**: `lambda/functions/api/submissions/index.js` → Aurora PostgreSQL
**Change**: New analytics queries joining multiple tables
**Risk**: LOW - Read-only queries, no writes
**Testing**: Phase 4, test endpoints manually with curl
**Rollback**: Remove endpoints, redeploy ComputeStack

#### Integration Point 4: Frontend → API Gateway
**Location**: `frontend/lib/api-client.ts` → API Gateway `/analytics/tokens`
**Change**: New API methods calling new endpoints
**Risk**: LOW - Frontend-only, no backend impact
**Testing**: Phase 5, test UI manually
**Rollback**: Revert frontend code, rebuild

#### Integration Point 5: Step Functions → Updated Agents
**Location**: Step Functions state machine → Lambda agent invocations
**Change**: Agents now write token data during execution
**Risk**: MEDIUM - Workflow timing may change slightly
**Testing**: Phase 3, monitor Step Functions execution times
**Rollback**: Revert agents, redeploy OrchestrationStack

#### Integration Point 6: Credits System → Submission Flow
**Location**: Submission handler → `organization_credits` table
**Change**: Credit checking before triggering workflow
**Risk**: LOW - Non-blocking for testing (always allows)
**Testing**: Phase 4, verify credit check logs in CloudWatch
**Rollback**: Remove credit check logic, redeploy

---

## Rollback Strategy

### Per-Phase Rollback Procedures

#### Phase 0 Rollback
**Scenario**: System unstable before starting
**Procedure**:
1. Document issues in `PHASE_0_ISSUES.md`
2. Run health check: `npm run test:api`
3. Fix stability issues before proceeding
4. No code changes to rollback

#### Phase 1 Rollback (Database)
**Scenario**: Migration fails or corrupts data
**Procedure**:
```bash
# 1. Run rollback migration
npm run migrate:lambda -- --file=rollback-006_token_tracking.sql

# 2. Verify columns removed
aws lambda invoke --function-name overlay-database-migration \
  --payload '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name='"'"'feedback_reports'"'"' AND column_name LIKE '"'"'%token%'"'"'"}' \
  response.json

# 3. Verify tables dropped
aws lambda invoke --function-name overlay-database-migration \
  --payload '{"query": "SELECT table_name FROM information_schema.tables WHERE table_name IN ('"'"'ai_token_usage'"'"', '"'"'organization_credits'"'"')"}' \
  response.json

# 4. Check Q12-Q17 still working
npm run test:submission -- --submission-id=<Q12-id>
```

#### Phase 2 Rollback (Lambda Layer)
**Scenario**: Layer deployment fails or agents break
**Procedure**:
```bash
# 1. Revert LLM client code
cd lambda/layers/common/nodejs
git checkout HEAD~1 llm-client.js

# 2. Redeploy Layer
cdk deploy OverlayOrchestrationStack

# 3. Verify Layer version rolled back
aws lambda list-layer-versions --layer-name overlay-common-layer

# 4. Test with Q12 submission
# Should complete successfully with old Layer
```

#### Phase 3 Rollback (AI Agents)
**Scenario**: One or more agents failing
**Procedure**:
```bash
# 1. Identify failing agent from CloudWatch logs
# 2. Revert specific agent code
cd lambda/functions/step-functions/<agent-name>
git checkout HEAD~1 index.js

# 3. Or revert all agents
cd lambda/functions/step-functions
git checkout HEAD~N */index.js

# 4. Redeploy OrchestrationStack
cdk deploy OverlayOrchestrationStack

# 5. Test with Q18 submission
# Should complete without token tracking
```

#### Phase 4 Rollback (API Endpoints)
**Scenario**: Endpoints returning errors
**Procedure**:
```bash
# 1. Revert submissions handler
cd lambda/functions/api/submissions
git checkout HEAD~1 index.js

# 2. Redeploy ComputeStack
cdk deploy OverlayComputeStack

# 3. Verify Q18 submission still works
# Analytics endpoints will 404, but submission flow intact
```

#### Phase 5 Rollback (Frontend)
**Scenario**: Frontend build errors or crashes
**Procedure**:
```bash
# 1. Revert frontend changes
cd frontend
git checkout HEAD~N lib/api-client.ts app/ components/

# 2. Rebuild
npm run build

# 3. Test locally
npm run dev

# 4. Verify pages load without token analytics
# Backend still functional from Phase 4
```

### Full System Rollback Script

**File**: `scripts/rollback-token-tracking.sh`

```bash
#!/bin/bash

set -e

echo "🔄 Rolling back token tracking implementation..."

PHASE=${1:-all}

rollback_phase_1() {
  echo "📦 Rolling back Phase 1 (Database)..."
  aws lambda invoke \
    --function-name overlay-database-migration \
    --payload file://database/migrations/rollback-006_token_tracking.sql \
    --cli-binary-format raw-in-base64-out \
    response.json

  echo "✅ Phase 1 rollback complete"
}

rollback_phase_2() {
  echo "📦 Rolling back Phase 2 (Lambda Layer)..."
  cd lambda/layers/common/nodejs
  git checkout HEAD~1 llm-client.js
  cd ../../../..
  cdk deploy OverlayOrchestrationStack --require-approval never
  echo "✅ Phase 2 rollback complete"
}

rollback_phase_3() {
  echo "📦 Rolling back Phase 3 (AI Agents)..."
  cd lambda/functions/step-functions
  for agent in structure-validator grammar-checker clarification content-analyzer scoring orchestrator; do
    cd $agent
    git checkout HEAD~1 index.js
    cd ..
  done
  cd ../../..
  cdk deploy OverlayOrchestrationStack --require-approval never
  echo "✅ Phase 3 rollback complete"
}

rollback_phase_4() {
  echo "📦 Rolling back Phase 4 (API Endpoints)..."
  cd lambda/functions/api/submissions
  git checkout HEAD~1 index.js
  cd ../../../..
  cdk deploy OverlayComputeStack --require-approval never
  echo "✅ Phase 4 rollback complete"
}

rollback_phase_5() {
  echo "📦 Rolling back Phase 5 (Frontend)..."
  cd frontend
  git checkout HEAD~N lib/api-client.ts
  git checkout HEAD~N app/session/
  git checkout HEAD~N app/submission/
  git checkout HEAD~N components/analytics/
  npm run build
  echo "✅ Phase 5 rollback complete"
}

case $PHASE in
  1)
    rollback_phase_1
    ;;
  2)
    rollback_phase_2
    ;;
  3)
    rollback_phase_3
    ;;
  4)
    rollback_phase_4
    ;;
  5)
    rollback_phase_5
    ;;
  all)
    rollback_phase_5
    rollback_phase_4
    rollback_phase_3
    rollback_phase_2
    rollback_phase_1
    echo "🎉 Full rollback complete"
    ;;
  *)
    echo "Usage: $0 {1|2|3|4|5|all}"
    exit 1
    ;;
esac

echo "✅ Rollback complete. Test system stability."
```

---

## Emergency Stop Conditions

### Global Emergency Stop Triggers

**STOP IMMEDIATELY if any of these occur:**

1. **Data Loss Detected**
   - Any Q12-Q17 submission data corrupted or missing
   - `feedback_reports` table data lost
   - `document_submissions` table affected

2. **System Downtime >15 Minutes**
   - API Gateway returning 503 errors
   - Step Functions workflow not triggering
   - Database connection failures

3. **Debugging Time Exceeded**
   - More than 2 hours debugging a single phase
   - More than 5 hours total debugging across all phases
   - Repeated failures after 3 retry attempts

4. **Breaking Changes Cascading**
   - Multiple agents failing simultaneously
   - Frontend build errors persisting after 1 hour
   - Database migration affecting other tables

5. **Production Impact**
   - Q12-Q17 submissions failing
   - Admin user cannot login
   - Dashboard pages crashing

### Emergency Stop Procedure

1. **Immediate Actions**
   - Stop current deployment: `aws cloudformation cancel-update-stack`
   - Document issue in `EMERGENCY_STOP_LOG.md`
   - Run rollback script: `bash scripts/rollback-token-tracking.sh all`

2. **Verify Rollback Success**
   - Test Q12 submission: Should complete successfully
   - Check CloudWatch: No new errors in last 5 minutes
   - Test dashboard: Pages loading correctly

3. **Post-Mortem Analysis**
   - Review CloudWatch logs for root cause
   - Document lessons learned in `LESSONS_LEARNED.md`
   - Update prevention plan with new safeguards
   - Schedule retry after fixes implemented

---

## Success Metrics

### Phase 0 Success Metrics
- ✅ System health check passes (all green)
- ✅ Q18 test session created
- ✅ Rollback script executable
- ✅ Documentation structure in place

### Phase 1 Success Metrics
- ✅ Migration executes in <30 seconds
- ✅ All new columns present in `feedback_reports`
- ✅ All new tables created (`ai_token_usage`, `organization_credits`)
- ✅ Indexes created successfully
- ✅ Admin org has unlimited credits
- ✅ Q12-Q17 data unchanged (verify with SQL query)

### Phase 2 Success Metrics
- ✅ LLM client returns object structure (not string)
- ✅ Lambda Layer deployed successfully
- ✅ Layer version incremented
- ✅ No Q18 submissions triggered yet

### Phase 3 Success Metrics (Per Agent)
- ✅ Agent completes without errors
- ✅ Token data stored in database (input_tokens > 0, output_tokens > 0)
- ✅ Model name stored correctly
- ✅ CloudWatch logs show no errors
- ✅ Step Functions workflow continues to next agent

### Phase 3 Success Metrics (All Agents)
- ✅ All 6 agents storing token data
- ✅ Q18 submission completes end-to-end
- ✅ Total execution time <5 minutes (similar to before)
- ✅ All feedback reports have token columns populated

### Phase 4 Success Metrics
- ✅ Token analytics endpoint returns 200 OK
- ✅ Credits endpoint returns 200 OK
- ✅ Analytics data matches database queries
- ✅ Credit check logs appear in CloudWatch
- ✅ Q18 submission still works with credit checking

### Phase 5 Success Metrics
- ✅ Frontend builds without TypeScript errors
- ✅ Token analytics component renders
- ✅ Session detail page shows aggregated usage
- ✅ Submission detail page shows per-agent tokens
- ✅ Production build successful
- ✅ No console errors

### Overall Implementation Success
- ✅ All 5 phases completed
- ✅ Q18 submission showing complete token data
- ✅ Analytics dashboard displaying correctly
- ✅ Q12-Q17 still working (regression test)
- ✅ No CloudWatch errors in last 24 hours
- ✅ Database queries performing well (<500ms)
- ✅ Documentation updated (CLAUDE.md, TESTING_CHECKLIST.md)

---

## Enhanced Token Tracking Design

### Dynamic Agent Support (No Hardcoded Names)

**Principle**: Database schema should support future custom agents without schema changes.

#### Database Design
```sql
-- ✅ CORRECT: No CHECK constraint on agent_name
CREATE TABLE ai_token_usage (
  agent_name VARCHAR(100) NOT NULL,  -- Dynamic, accepts any agent name
  ...
);

-- ❌ WRONG: Hardcoded agent names
CREATE TABLE ai_token_usage (
  agent_name VARCHAR(100) CHECK (agent_name IN ('structure-validator', 'content-analyzer', ...)),
  ...
);
```

#### Code Implementation
```javascript
// ✅ CORRECT: Read agent name from environment or event
const agentName = process.env.AGENT_NAME || 'unknown';
await dbClient.query(`
  INSERT INTO ai_token_usage (agent_name, ...) VALUES ($1, ...)
`, [agentName, ...]);

// ❌ WRONG: Hardcoded string
await dbClient.query(`
  INSERT INTO ai_token_usage (agent_name, ...) VALUES ('structure-validator', ...)
`);
```

#### Frontend Display
```typescript
// ✅ CORRECT: Display any agent name dynamically
{analytics.map(row => (
  <tr key={row.agent_name}>
    <td>{row.agent_name}</td>  {/* Works for custom agents */}
    ...
  </tr>
))}

// ❌ WRONG: Switch statement with hardcoded names
function getAgentDisplayName(name: string) {
  switch(name) {
    case 'structure-validator': return 'Structure Validator';
    case 'content-analyzer': return 'Content Analyzer';
    default: return name;  // Breaks for custom agents
  }
}
```

### Credits System Design (Non-Blocking for Testing)

**Principle**: Credit system should log warnings but NEVER block analysis during testing phase.

#### Credit Check Implementation
```javascript
async function checkCredits(dbClient, organizationId, estimatedTokens) {
  const result = await dbClient.query(`
    SELECT is_unlimited, available_credits, total_credits
    FROM organization_credits
    WHERE organization_id = $1
  `, [organizationId]);

  // Handle missing credits record (new orgs)
  if (result.rows.length === 0) {
    console.warn(`⚠️ No credits record for org ${organizationId} - allowing analysis (non-blocking)`);
    // TODO: Auto-create credits record with default 1000 credits
    return { allowed: true, warning: 'no_credits_record' };
  }

  const { is_unlimited, available_credits, total_credits } = result.rows[0];

  // Admin users get unlimited credits
  if (is_unlimited) {
    console.log(`✅ Organization ${organizationId} has unlimited credits`);
    return { allowed: true, unlimited: true };
  }

  // Calculate estimated cost (Sonnet 4.5 pricing)
  const estimatedCost = estimatedTokens * 0.003 / 1000;  // $0.003 per 1K input tokens
  const creditsNeeded = Math.ceil(estimatedCost * 100);  // 1 credit = $0.01

  // Check if sufficient credits
  const sufficient = available_credits >= creditsNeeded;

  if (!sufficient) {
    console.warn(`⚠️ Organization ${organizationId} has insufficient credits:`);
    console.warn(`   Available: ${available_credits}, Needed: ${creditsNeeded}`);
    console.warn(`   🚨 ALLOWING ANALYSIS ANYWAY (non-blocking for testing)`);

    // TODO: Send email notification to org admin about low credits
    // TODO: Log to analytics for monitoring
  } else {
    console.log(`✅ Credits check passed: ${available_credits} available, ${creditsNeeded} needed`);
  }

  // ⚠️ ALWAYS ALLOW during testing phase
  return {
    allowed: true,
    unlimited: false,
    warning: !sufficient ? 'insufficient_credits' : null,
    available_credits,
    credits_needed: creditsNeeded,
  };
}
```

#### Credits Update After Analysis
```javascript
async function updateCreditsAfterAnalysis(dbClient, organizationId, actualTokenUsage) {
  const { input_tokens, output_tokens } = actualTokenUsage;

  // Calculate actual cost (Sonnet 4.5 pricing)
  const inputCost = (input_tokens * 0.003) / 1000;
  const outputCost = (output_tokens * 0.015) / 1000;
  const totalCost = inputCost + outputCost;
  const creditsUsed = Math.ceil(totalCost * 100);  // 1 credit = $0.01

  // Update used_credits (generated column will auto-calculate available_credits)
  await dbClient.query(`
    UPDATE organization_credits
    SET
      used_credits = used_credits + $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = $2
    AND is_unlimited = FALSE  -- Don't update unlimited orgs
  `, [creditsUsed, organizationId]);

  console.log(`💰 Updated credits for org ${organizationId}: used ${creditsUsed} credits ($${totalCost.toFixed(4)})`);
}
```

#### Admin Unlimited Credits Setup
```sql
-- Run after Phase 1 migration
INSERT INTO organization_credits (organization_id, total_credits, is_unlimited)
SELECT organization_id, 1000000, TRUE
FROM organizations
WHERE name = 'System Admin'
ON CONFLICT (organization_id) DO UPDATE
SET is_unlimited = TRUE, total_credits = 1000000;

-- Verify admin has unlimited
SELECT o.name, oc.is_unlimited, oc.available_credits
FROM organizations o
JOIN organization_credits oc ON o.organization_id = oc.organization_id
WHERE o.name = 'System Admin';
```

### Token Pricing Configuration

**Centralized pricing in LLM client:**

```javascript
// lambda/layers/common/nodejs/llm-client.js
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
        input: 0.003,   // per 1K tokens
        output: 0.015,  // per 1K tokens
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

// Usage in agents:
const modelInfo = claude.getModelInfo();
const pricing = modelInfo.pricing[model_used];
const cost = (input_tokens * pricing.input + output_tokens * pricing.output) / 1000;
```

---

## Documentation Updates

### Files to Update After Implementation

#### 1. CLAUDE.md
- [ ] Update "Current Version" to v1.7
- [ ] Add "Token Tracking (v1.7)" section
- [ ] Update testing checklist with token analytics tests
- [ ] Add credits system documentation
- [ ] Update architecture diagram (if exists)

#### 2. TESTING_CHECKLIST.md
- [ ] Add Phase 0-5 test cases
- [ ] Add token analytics verification steps
- [ ] Add credits system test cases
- [ ] Add regression tests for Q12-Q17

#### 3. Create TOKEN_TRACKING_IMPLEMENTATION_SCHEDULE.md
```markdown
# Token Tracking Implementation Schedule

## Timeline
- Phase 0: 1 hour (Pre-implementation)
- Phase 1: 1.5 hours (Database)
- Phase 2: 1 hour (Lambda Layer)
- Phase 3: 4 hours (AI Agents - 40 min per agent)
- Phase 4: 2 hours (API Endpoints)
- Phase 5: 2.5 hours (Frontend)
- **Total**: 10-13 hours

## Completed Phases
- [x] Phase 0: 2026-01-31 10:00 - 11:00
- [ ] Phase 1: 2026-01-31 11:00 - 12:30
- [ ] Phase 2: 2026-01-31 13:00 - 14:00
- [ ] Phase 3: 2026-01-31 14:00 - 18:00
- [ ] Phase 4: 2026-01-31 18:30 - 20:30
- [ ] Phase 5: 2026-01-31 21:00 - 23:30

## Issues Encountered
- None yet

## Rollback History
- None yet
```

#### 4. Update FUTURE_ENHANCEMENTS.md
- [ ] Move "Token Tracking" from "Planned" to "Completed"
- [ ] Add "Credits Enforcement" to "Planned" (currently non-blocking)
- [ ] Add "Custom Agents Framework" to "Planned"

#### 5. Create LESSONS_LEARNED_TOKEN_TRACKING.md
- [ ] Document issues encountered during each phase
- [ ] Document debugging strategies that worked
- [ ] Document prevention measures for future breaking changes
- [ ] Update after completion

---

## Testing Environment

### Q18 Test Session Details

**Session Name**: Token Tracking Test Session
**Overlay**: Use existing overlay (e.g., "Q12 Overlay")
**Purpose**: Isolated testing environment for token tracking implementation

### Test Documents
- **Primary**: Small text file (500-1000 words) for fast iteration
- **Secondary**: Medium PDF (5-10 pages) for realistic testing
- **Tertiary**: Multi-document with appendices (full feature test)

### Testing Strategy Per Phase

#### Phase 0 Testing
- Verify Q12-Q17 still working (baseline)
- Create Q18 session
- Upload small test document
- Verify completion without token tracking

#### Phase 1 Testing
- Run migration
- Verify schema changes
- Check Q12-Q17 unaffected
- Do NOT upload to Q18 yet

#### Phase 2 Testing
- Deploy Layer
- Do NOT upload to Q18 yet (agents will break)
- Verify Layer version incremented

#### Phase 3 Testing (Per Agent)
- Upload NEW test document to Q18 after EACH agent update
- Verify agent completes
- Verify token data stored
- Move to next agent only if current agent working

#### Phase 4 Testing
- Test analytics endpoint with curl
- Test credits endpoint with curl
- Verify responses match database queries

#### Phase 5 Testing
- Test locally with proxy + dev server
- Verify UI components render
- Test production build
- Verify analytics dashboard functional

### Regression Testing
After each phase, verify:
- Q12 still works (structure-validator through scoring)
- Q13 still works (grammar-checker)
- Q14 still works (clarification)
- Q15 still works (content-analyzer)
- Q16 still works (scoring)
- Q17 still works (orchestrator)

---

## Approval Checklist

Before proceeding with implementation, confirm:

- [ ] I have read and understood all 5 phases
- [ ] I understand the integration points and risks
- [ ] I agree with the rollback strategy per phase
- [ ] I commit to testing after EVERY change
- [ ] I will stop immediately if emergency conditions met
- [ ] I will use Q18 for testing (not Q12-Q17)
- [ ] I understand this is a breaking change across all 6 agents
- [ ] I approve the dynamic agent support design (no hardcoded names)
- [ ] I approve the non-blocking credits system for testing
- [ ] I am ready to begin Phase 0

**Implementation Start Authorization**: _______________ (User signature/approval)

---

## Phase Execution Log

### Phase 0 Log
- Started: ___________
- Completed: ___________
- Issues: ___________
- Rollback Required: Yes / No

### Phase 1 Log
- Started: ___________
- Completed: ___________
- Migration Time: ___________
- Issues: ___________
- Rollback Required: Yes / No

### Phase 2 Log
- Started: ___________
- Completed: ___________
- Deployment Time: ___________
- Issues: ___________
- Rollback Required: Yes / No

### Phase 3 Log
#### Structure Validator
- Started: ___________
- Completed: ___________
- Q18 Submission ID: ___________
- Issues: ___________

#### Grammar Checker
- Started: ___________
- Completed: ___________
- Q18 Submission ID: ___________
- Issues: ___________

#### Clarification
- Started: ___________
- Completed: ___________
- Q18 Submission ID: ___________
- Issues: ___________

#### Content Analyzer
- Started: ___________
- Completed: ___________
- Q18 Submission ID: ___________
- Issues: ___________

#### Scoring
- Started: ___________
- Completed: ___________
- Q18 Submission ID: ___________
- Issues: ___________

#### Orchestrator
- Started: ___________
- Completed: ___________
- Q18 Submission ID: ___________
- Issues: ___________

### Phase 4 Log
- Started: ___________
- Completed: ___________
- Endpoints Tested: ___________
- Issues: ___________
- Rollback Required: Yes / No

### Phase 5 Log
- Started: ___________
- Completed: ___________
- Build Time: ___________
- Issues: ___________
- Rollback Required: Yes / No

---

## Post-Implementation Tasks

After all phases complete:

- [ ] Run full regression test on Q12-Q17
- [ ] Verify Q18 showing complete token analytics
- [ ] Update CLAUDE.md with v1.7 documentation
- [ ] Update TESTING_CHECKLIST.md
- [ ] Create git commit with detailed changelog
- [ ] Push to GitHub
- [ ] Create backup: `backups/v1.7-token-tracking/`
- [ ] Update LESSONS_LEARNED.md
- [ ] Mark "Token Tracking" complete in project tracker

---

## Questions and Clarifications

Before approval, please clarify:

1. **Q18 Overlay**: Should I use existing overlay or create new one?
2. **Testing Document**: Do you have a preferred test document, or should I use a simple text file?
3. **Credits Initial Amount**: Should non-admin orgs get default credits? How many?
4. **Analytics Dashboard Location**: Should token analytics be on Dashboard home page or only Session/Submission pages?
5. **Email Notifications**: Should low credits trigger email notifications? (Can be Phase 6)

---

## End of Prevention Plan

**Status**: ⏳ Awaiting User Approval
**Next Action**: User reviews plan and provides approval or requests changes
**Implementation Start**: After explicit approval only

---
