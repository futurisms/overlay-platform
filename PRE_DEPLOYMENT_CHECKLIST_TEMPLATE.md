# Pre-Deployment Checklist Template

**PURPOSE**: Complete this checklist BEFORE deploying ANY code changes to prevent regressions and cascading failures.

**INSTRUCTIONS**:
1. Copy this template for each deployment
2. Fill out ALL sections (no skipping!)
3. Get review approval if making critical changes
4. Keep completed checklist in deployment history

---

## Deployment Information

**Date**: _____________
**Developer**: _____________
**Ticket/Issue**: _____________
**Deployment Type**: [ ] Bug Fix [ ] Feature [ ] Refactor [ ] Config Change
**Risk Level**: [ ] LOW [ ] MEDIUM [ ] HIGH [ ] CRITICAL

---

## 1. Change Details

### What am I changing?

**Files Modified**:
- [ ] `_______________________________` (brief description)
- [ ] `_______________________________` (brief description)
- [ ] `_______________________________` (brief description)

**Changes Summary** (2-3 sentences):
```
[Describe what you're changing and why]
```

**Root Cause** (if bug fix):
```
[What caused the bug? Why didn't existing code work?]
```

---

## 2. Impact Analysis

### What endpoints are affected?

**Direct Impact** (endpoints you're modifying):
- [ ] `GET/POST/PUT/DELETE _________________` - Changes: __________
- [ ] `GET/POST/PUT/DELETE _________________` - Changes: __________

**Indirect Impact** (endpoints that call or depend on your changes):
- [ ] `_______________________________` - Why affected: __________
- [ ] `_______________________________` - Why affected: __________

### What could break?

**Immediate Risks**:
- [ ] Risk: __________________ | Likelihood: [ ] Low [ ] Med [ ] High
- [ ] Risk: __________________ | Likelihood: [ ] Low [ ] Med [ ] High
- [ ] Risk: __________________ | Likelihood: [ ] Low [ ] Med [ ] High

**Cascading Risks**:
- [ ] Could this affect other features? [ ] Yes [ ] No - If yes: __________
- [ ] Could this break existing integrations? [ ] Yes [ ] No - If yes: __________
- [ ] Could this cause data loss? [ ] Yes [ ] No - If yes: STOP & REVIEW

### Integration Point Check

Review [CRITICAL_INTEGRATION_POINTS.md](CRITICAL_INTEGRATION_POINTS.md) and verify:

- [ ] **#1 Criteria Persistence**: Does my change process ALL request body fields?
- [ ] **#2 React Keys**: Do my React lists have unique, stable keys?
- [ ] **#3 Status Fields**: Do I return explicit boolean values (not undefined)?
- [ ] **#4 Field Names**: Do my response field names match frontend expectations?
- [ ] **#5 Score Calculation**: Am I using the Scoring Agent's final score (not recalculating)?
- [ ] **#6 JSONB Paths**: Do my JSONB queries use COALESCE for fallback paths?
- [ ] **#7 Status Filtering**: Do my list queries filter by status/is_active?
- [ ] **#8 Complete Responses**: Do my endpoints return ALL data displayed on page?
- [ ] **#9 JSONB Casting**: Do I cast TEXT to JSONB (content::jsonb) before operators?

---

## 3. Testing Plan

### Test Case 1: Happy Path

**Scenario**: _______________________________

**Steps**:
1. _______________________________
2. _______________________________
3. _______________________________

**Expected Result**: _______________________________

**Actual Result** (after testing): [ ] PASS [ ] FAIL
- If FAIL: _______________________________

---

### Test Case 2: Edge Case

**Scenario**: _______________________________

**Steps**:
1. _______________________________
2. _______________________________
3. _______________________________

**Expected Result**: _______________________________

**Actual Result** (after testing): [ ] PASS [ ] FAIL
- If FAIL: _______________________________

---

### Test Case 3: Error Condition

**Scenario**: _______________________________

**Steps**:
1. _______________________________
2. _______________________________
3. _______________________________

**Expected Result**: _______________________________

**Actual Result** (after testing): [ ] PASS [ ] FAIL
- If FAIL: _______________________________

---

### Database Verification (if applicable)

**Before Deployment**:
```sql
-- Query to verify current state
[SQL query to check before]
```

**After Deployment**:
```sql
-- Query to verify new state
[SQL query to check after]
```

**Expected Changes**: _______________________________

---

## 4. Rollback Plan

### Rollback Strategy

**Method**: [ ] Git Revert [ ] Git Reset [ ] Deploy Previous Tag [ ] Manual Fix

**Exact Commands**:
```bash
# Command 1:
_______________________________

# Command 2:
_______________________________

# Verification:
_______________________________
```

### Rollback Triggers

Rollback IMMEDIATELY if:
- [ ] HTTP 500 errors in CloudWatch logs
- [ ] Integration tests fail (scripts/integration-test.js)
- [ ] User reports data loss or invisibility
- [ ] Critical workflow broken (auth, uploads, scores, submissions)

### Rollback Timeline

- **CRITICAL** (outage): Rollback within 5 minutes
- **HIGH** (data loss): Rollback within 15 minutes
- **MEDIUM** (UI issues): Fix forward or rollback within 1 hour

### Point of No Return

**Is this change reversible?** [ ] Yes [ ] No

**If No**, what makes it irreversible?
```
[e.g., Database migration drops columns, S3 objects deleted, etc.]
```

**Mitigation for irreversible changes**:
```
[Backup plan, data export, etc.]
```

---

## 5. Blast Radius

### Who is affected?

**User Impact**:
- [ ] All users (platform-wide)
- [ ] Specific user group: _______________________________
- [ ] Admin users only
- [ ] No user impact (backend only)

**Feature Impact**:
- [ ] Authentication
- [ ] Dashboard
- [ ] Session Management
- [ ] Document Upload
- [ ] AI Processing
- [ ] Score Display
- [ ] Overlay Management
- [ ] Other: _______________________________

### Risk Assessment

**If this deployment fails**:
- Users will experience: _______________________________
- Workaround available: [ ] Yes [ ] No - Details: __________
- Maximum downtime acceptable: _______________________________
- Revenue/SLA impact: _______________________________

### Dependencies

**This change depends on**:
- [ ] Dependency: _____________ | Status: [ ] Ready [ ] Not Ready
- [ ] Dependency: _____________ | Status: [ ] Ready [ ] Not Ready

**Other systems/services depending on this**:
- [ ] System: _______________ | Impact if we break it: __________
- [ ] System: _______________ | Impact if we break it: __________

---

## 6. Pre-Deployment Verification

### Code Review Checklist

**Code Quality**:
- [ ] Code follows existing patterns and conventions
- [ ] No hardcoded values (use environment variables)
- [ ] Error handling present for all failure modes
- [ ] Logging added for debugging (but not excessive)
- [ ] No commented-out code (delete or document why)

**Security**:
- [ ] No sensitive data in logs (tokens, passwords, PII)
- [ ] Input validation present
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize user input)
- [ ] Authorization checks present

**Performance**:
- [ ] No N+1 queries (use JOINs or batch queries)
- [ ] Indexes present for filtered columns
- [ ] Query timeout handling
- [ ] Connection pool cleanup (finally blocks)

**Backend Changes**:
- [ ] Response field names match frontend expectations
- [ ] Boolean flags have explicit values (not undefined)
- [ ] List queries filter by status/is_active
- [ ] JSONB queries use ::jsonb cast and COALESCE
- [ ] All request body fields processed
- [ ] Endpoints return complete data for page display

**Frontend Changes**:
- [ ] React lists have unique keys
- [ ] Field names match backend response
- [ ] Handle undefined/null values gracefully
- [ ] Loading states shown during API calls
- [ ] Error states shown on failures

### Testing Checklist

**Manual Testing**:
- [ ] Tested happy path (3 test cases documented above)
- [ ] Tested edge cases (empty data, null values, missing fields)
- [ ] Tested error conditions (500 errors, validation failures)
- [ ] Tested in Chrome
- [ ] Tested in Firefox or Safari
- [ ] Tested on mobile (if UI changes)
- [ ] Browser console clean (no errors or warnings)

**Database Testing**:
- [ ] Queries tested in psql before deployment
- [ ] Column types verified (`\d table_name`)
- [ ] Tested with realistic data volumes
- [ ] Tested with edge cases (empty results, null values)

**Integration Testing**:
- [ ] Automated tests pass: `node scripts/integration-test.js`
- [ ] All 9 integration points verified (if touching those areas)
- [ ] API contract maintained (no breaking changes)
- [ ] Backward compatibility verified

---

## 7. Deployment Execution

### Pre-Deployment Steps

- [ ] Branch up to date with main
- [ ] All tests passing locally
- [ ] CloudWatch dashboard open (ready to monitor)
- [ ] Rollback commands prepared and tested
- [ ] Team notified of deployment window

### Deployment Commands

```bash
# 1. Verify current state
git status
git log -1

# 2. Deploy
cdk deploy OverlayComputeStack --require-approval never

# 3. Note deployment time
echo "Deployed at: $(date)"
```

**Deployment Started**: _____________ (timestamp)
**Deployment Completed**: _____________ (timestamp)
**Duration**: _____________ seconds

---

## 8. Post-Deployment Verification

### Immediate Checks (< 5 minutes)

**Automated Tests**:
```bash
export AUTH_TOKEN='...'
node scripts/integration-test.js
```
- [ ] Result: [ ] ALL PASS [ ] SOME FAIL (details: _________)

**CloudWatch Logs**:
```bash
aws logs tail /aws/lambda/overlay-api-sessions --since 5m --format short
```
- [ ] No errors in last 5 minutes
- [ ] No "operator does not exist" errors
- [ ] No "undefined" or "null" errors
- [ ] Response times normal (< 1000ms)

**Manual Smoke Test** (5 minutes):
- [ ] Login works
- [ ] Dashboard loads with sessions
- [ ] Session detail shows submissions
- [ ] Scores display correctly (list matches detail)
- [ ] Create overlay → Add criterion → Criterion persists

### Extended Verification (< 15 minutes)

**Critical Workflows**:
- [ ] User can upload document
- [ ] AI processing completes
- [ ] Feedback displays correctly
- [ ] Scores accurate and consistent

**Database Verification**:
```sql
-- Run verification query from section 3
[Paste query result here]
```
- [ ] Result matches expected state

### Monitoring Setup

**CloudWatch Alarms** (if not already set):
- [ ] Alarm for Lambda errors > 5 in 5 minutes
- [ ] Alarm for API Gateway 5xx > 10 in 5 minutes
- [ ] Alarm for average response time > 2000ms

**Next Check-In**: _____________ (30 min, 1 hour, 2 hours)

---

## 9. Post-Deployment Actions

### Communication

**Team Notification**:
- [ ] Slack/Teams message: "Deployment complete - [Status]"
- [ ] Include: What changed, test results, any issues

**Documentation Updates**:
- [ ] Update CLAUDE.md if new features
- [ ] Update API documentation if endpoints changed
- [ ] Add entry to CHANGELOG.md
- [ ] Update version tag if major release

### Lessons Learned

**What went well**:
```
_______________________________
```

**What could be improved**:
```
_______________________________
```

**New risks discovered**:
```
_______________________________
```

**Action items for next time**:
- [ ] _______________________________
- [ ] _______________________________

---

## 10. Sign-Off

### Approvals

**Code Review**: _____________ (name) - Date: _____________
**Testing Sign-Off**: _____________ (name) - Date: _____________
**Deployment Sign-Off**: _____________ (name) - Date: _____________

### Deployment Status

**Final Status**: [ ] SUCCESS [ ] SUCCESS WITH ISSUES [ ] ROLLED BACK [ ] FAILED

**Issues Encountered**:
```
[List any issues, even if resolved]
```

**Resolution**:
```
[How issues were resolved]
```

### Confidence Level

On a scale of 1-5, how confident are you this deployment is stable?

[ ] 1 - Not confident (consider rollback)
[ ] 2 - Somewhat confident (monitor closely)
[ ] 3 - Moderately confident (standard monitoring)
[ ] 4 - Confident (routine deployment)
[ ] 5 - Very confident (tested thoroughly, low risk)

**If < 3**, explain why and mitigation plan:
```
_______________________________
```

---

## Checklist Summary

**BEFORE DEPLOYING**, verify ALL critical items:

- [ ] All 9 integration points checked
- [ ] 3 test cases documented and passed
- [ ] Rollback plan ready
- [ ] CloudWatch dashboard open
- [ ] Automated tests pass
- [ ] No data loss risk OR backup created
- [ ] Team notified
- [ ] Blast radius understood and acceptable

**AFTER DEPLOYING**:

- [ ] Automated tests pass (< 5 min)
- [ ] CloudWatch logs clean (< 5 min)
- [ ] Manual smoke test pass (< 5 min)
- [ ] Extended verification pass (< 15 min)
- [ ] Team notified of results

---

## Reference Documents

Before deploying, review these documents:

1. **[CRITICAL_INTEGRATION_POINTS.md](CRITICAL_INTEGRATION_POINTS.md)** - All 9 integration points
2. **[TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)** - Comprehensive testing procedures
3. **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Deployment procedures
4. **[RELEASE_v1.2.md](RELEASE_v1.2.md)** - Recent bugs and fixes

---

## Example: Completed Checklist

See [EXAMPLE_DEPLOYMENT.md](EXAMPLE_DEPLOYMENT.md) for a filled-out example based on the v1.2 SQL operator fix.

---

**Remember**: Spending 30 minutes on this checklist can save 6 hours of debugging cascading failures.

**The goal is not bureaucracy - it's preventing the cascade of regressions we saw in v1.2.**

---

**Last Updated**: January 26, 2026
**Maintained By**: Development Team
**Review Schedule**: Update after each major incident or release
