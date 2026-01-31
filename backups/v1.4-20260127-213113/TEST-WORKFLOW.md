# End-to-End Workflow Test

Quick reference guide for testing the complete document analysis workflow.

## Quick Start

```bash
npm run test:workflow
```

## What It Tests

1. ✅ **Document Creation** - Creates test contract with grammar errors
2. ✅ **S3 Upload** - Uploads to `overlay-docs-975050116849/submissions/`
3. ✅ **S3 Event Trigger** - Waits for Step Functions to start
4. ✅ **Step Functions Execution** - Monitors all states in real-time
5. ✅ **AI Agent Processing** - Tracks parallel analysis (structure, content, grammar)
6. ✅ **Database Writes** - Verifies results in Aurora
7. ✅ **Results Retrieval** - Queries and displays comprehensive results

## Expected Output

```
✅ Test document created
✅ Document uploaded to S3
✅ Step Functions execution started!
  🔄 Extract Document - STARTED
  ✅ Extract Document - COMPLETED
  🔄 Parallel Analysis - STARTED
  ✅ Structure Validator - COMPLETED
  ✅ Content Analyzer - COMPLETED
  ✅ Grammar Checker - COMPLETED
  ✅ Orchestrator Decision - COMPLETED
  ✅ Final Scoring - COMPLETED
✅ Execution completed successfully!
✅ Submission found - Overall Score: 78/100
✅ End-to-end workflow test completed successfully!
```

## Common Options

```bash
# Use specific overlay
npm run test:workflow -- --overlay-id 20000000-0000-0000-0000-000000000001

# Monitor existing execution
npm run test:workflow -- --skip-upload --execution-arn arn:aws:states:...
```

## Prerequisites

- [x] All CDK stacks deployed
- [x] Aurora migrations completed
- [x] S3 event notifications configured
- [x] Lambda functions deployed
- [x] At least one active overlay exists

## Troubleshooting

### No Execution Found

**Problem**: Script waits 30 seconds but no execution starts

**Fix**: Check S3 event notifications and EventBridge rules:

```bash
aws s3api get-bucket-notification-configuration \
  --bucket overlay-docs-975050116849 \
  --region eu-west-1

aws events list-rules --region eu-west-1
```

### Execution Failed

**Problem**: Step Functions execution fails

**Fix**: Check CloudWatch Logs:

```bash
aws logs tail /aws/lambda/overlay-structure-validator --follow --region eu-west-1
```

### Database Connection Failed

**Problem**: Cannot connect to Aurora

**Fix**: Aurora is in private subnets. Run from EC2/bastion in VPC, or:
- Set up VPN to VPC
- Use AWS Systems Manager Session Manager
- Deploy Lambda to query results

### No Results Found

**Problem**: Execution succeeds but no data in Aurora

**Fix**: Check Lambda database permissions and VPC connectivity:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/overlay-api-overlays --follow --region eu-west-1

# Verify security groups allow Lambda → Aurora
```

## Results Format

The test displays:

**Overall Results**
- Submission ID
- Status (pending/completed/failed)
- Overall Score (0-100)
- Structure Compliant (Yes/No)

**Criterion Scores**
- Content Quality: 18/20 (90%)
- Grammar and Style: 12/20 (60%)
- Completeness: 19/20 (95%)
- Legal Compliance: 17/20 (85%)
- Formatting: 12/20 (60%)

**Detailed Feedback**
- Overall assessment
- Strengths (what's good)
- Areas for improvement (what needs work)
- Recommendations (actionable steps)

## Next Steps

After successful test:

1. ✅ Infrastructure validated
2. ✅ Workflow functioning end-to-end
3. ⏳ Optimize Lambda performance
4. ⏳ Add more test cases
5. ⏳ Implement full AI agent logic
6. ⏳ Add real DOCX processing
7. ⏳ Production deployment

## Advanced Usage

### Monitor Multiple Executions

```bash
# Run test multiple times
for i in {1..5}; do
  echo "Test run $i"
  npm run test:workflow
  sleep 10
done
```

### Custom Test Document

Edit `scripts/test-workflow.js` to customize the test content:

```javascript
const content = `Your Custom Contract Text Here...`;
```

### Performance Testing

```bash
# Measure execution time
time npm run test:workflow
```

## See Also

- [scripts/README.md](scripts/README.md#end-to-end-workflow-testing) - Detailed documentation
- [scripts/test-api.js](scripts/test-api.js) - API testing
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
