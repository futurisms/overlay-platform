# Database Migration Status

## ✅ Migration Script Created

### Script Details
- **Location**: [scripts/run-migrations.ts](scripts/run-migrations.ts)
- **Purpose**: Automated Aurora database initialization
- **Dependencies**: ✅ Installed (`pg`, `@aws-sdk/client-secrets-manager`, `@aws-sdk/client-cloudformation`)

### What the Script Does

1. ✅ Retrieves Aurora credentials from AWS Secrets Manager
2. ✅ Connects to Aurora PostgreSQL cluster
3. ✅ Executes `000_initial_schema.sql` (15 tables, indexes, triggers, views)
4. ✅ Executes `001_seed_data.sql` (demo organizations, users, overlays)
5. ✅ Verifies successful migration

### NPM Scripts Available

```bash
# Run migrations
npm run migrate

# OR
npm run db:init
```

## ⚠️ Network Access Required

### Current Situation

Aurora is deployed in **isolated subnets** (no internet access) for security. This means:

- ❌ Cannot connect directly from local machine
- ❌ Cannot connect from Lambda without VPC configuration
- ✅ Can connect from EC2 instance in same VPC
- ✅ Can connect via VPN to VPC
- ✅ Can connect from bastion host

This is **by design** for security best practices.

## 🔧 How to Run Migrations

### Option 1: Create Bastion Host (Recommended)

**Step 1: Create Bastion Instance**

```bash
# Get private subnet ID from VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0e632941832df0af7" \
  --query 'Subnets[?MapPublicIpOnLaunch==`false`].[SubnetId,AvailabilityZone,CidrBlock]' \
  --output table

# Create bastion host
aws ec2 run-instances \
  --image-id ami-0c38b837cd80f13bb \
  --instance-type t3.micro \
  --subnet-id <private-subnet-id> \
  --iam-instance-profile Name=SSMInstanceProfile \
  --security-group-ids <aurora-security-group-id> \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=overlay-bastion}]'
```

**Step 2: Connect via Session Manager**

```bash
aws ssm start-session --target <instance-id>
```

**Step 3: Install Dependencies and Run**

```bash
# On bastion instance
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Clone and run
git clone <your-repo-url>
cd overlay-platform
npm install
npm run migrate
```

### Option 2: Manual psql Connection

If you have VPC access (VPN or bastion):

```bash
# Get credentials
aws secretsmanager get-secret-value \
  --secret-id overlay/aurora/production/credentials \
  --region eu-west-1 \
  --query SecretString --output text | jq

# Connect with psql
PGPASSWORD='<password>' psql \
  -h overlaystoragestack-auroracluster23d869c0-higkke9k7oro.cluster-chwcq22k4a75.eu-west-1.rds.amazonaws.com \
  -U overlay_admin \
  -d overlay_db \
  -f migrations/000_initial_schema.sql

PGPASSWORD='<password>' psql \
  -h overlaystoragestack-auroracluster23d869c0-higkke9k7oro.cluster-chwcq22k4a75.eu-west-1.rds.amazonaws.com \
  -U overlay_admin \
  -d overlay_db \
  -f migrations/001_seed_data.sql
```

### Option 3: Add Bastion to CDK Stack

For production, add this to your infrastructure:

```typescript
// In lib/storage-stack.ts

// Create bastion host for database access
const bastion = new ec2.BastionHostLinux(this, 'BastionHost', {
  vpc: this.vpc,
  subnetSelection: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  },
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
});

// Allow bastion to connect to Aurora
auroraSG.connections.allowFrom(
  bastion,
  ec2.Port.tcp(5432),
  'Allow PostgreSQL from bastion'
);
```

Then deploy and use:

```bash
cdk deploy OverlayStorageStack
aws ssm start-session --target <bastion-instance-id>
```

## 📊 Migration Files

### Schema Migration (000_initial_schema.sql)

Creates:
- ✅ 15 database tables
- ✅ 30+ indexes for performance
- ✅ Triggers for updated_at timestamps
- ✅ 2 views (v_active_submissions, v_user_permissions)
- ✅ Foreign key relationships
- ✅ Check constraints for data integrity

**Tables Created:**
1. organizations
2. users
3. user_roles
4. overlays
5. evaluation_criteria
6. user_sessions
7. document_submissions
8. evaluation_responses
9. feedback_reports
10. ai_analysis_results
11. audit_logs
12. llm_configurations
13. document_versions
14. notifications
15. (+ additional supporting structures)

### Seed Data (001_seed_data.sql)

Inserts:
- ✅ 1 demo organization
- ✅ 4 demo users (admin, manager, reviewer, submitter)
- ✅ 4 overlay templates (Contract, Financial, Compliance, General)
- ✅ 24 evaluation criteria
- ✅ 3 LLM configurations (Claude 3.5 Sonnet, Opus, Haiku)
- ✅ 2 sample document submissions
- ✅ 1 AI analysis result
- ✅ 2 notifications

### Demo User Credentials

All demo users have password: `Password123!`

- **admin@overlay.com** - Full admin access
- **manager@overlay.com** - Manager and reviewer
- **reviewer@overlay.com** - Reviewer only
- **submitter@overlay.com** - Document submitter

⚠️ **Important**: Change these passwords in production!

## ✅ Verification

After running migrations, verify with:

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 15

-- Check seed data
SELECT COUNT(*) FROM organizations; -- Expected: 1
SELECT COUNT(*) FROM users; -- Expected: 4
SELECT COUNT(*) FROM overlays; -- Expected: 4
SELECT COUNT(*) FROM evaluation_criteria; -- Expected: 24
SELECT COUNT(*) FROM llm_configurations; -- Expected: 3
```

## 🔐 Security Notes

1. **Database Access**: Aurora is in isolated subnets (no public access) ✅
2. **Credentials**: Stored in AWS Secrets Manager (encrypted) ✅
3. **SSL/TLS**: Enforced for all connections ✅
4. **IAM**: Can be configured for additional authentication ⏳
5. **Audit**: All queries logged to CloudWatch ✅

## 💰 Cost Implications

**Bastion Host** (if created):
- t3.micro: ~$7.50/month if running 24/7
- **Recommendation**: Stop when not in use

```bash
# Stop bastion to save costs
aws ec2 stop-instances --instance-ids i-xxxxx

# Start only when needed
aws ec2 start-instances --instance-ids i-xxxxx
```

**Alternative**: Use Lambda-based migrations (no bastion costs)

## 📚 Documentation

- [scripts/README.md](scripts/README.md) - Detailed migration guide
- [migrations/README.md](migrations/README.md) - Database schema documentation
- [scripts/run-migrations.ts](scripts/run-migrations.ts) - Migration script source

## 🎯 Next Steps

1. **Choose migration method** (bastion, VPN, or manual)
2. **Run migrations** to initialize database
3. **Verify tables** are created correctly
4. **Test connectivity** from application
5. **Deploy Phase 2** (Lambda functions, API Gateway)

## ⚠️ Important Notes

- Migrations are **idempotent** - safe to run multiple times
- Credentials are **auto-rotated** - check Secrets Manager for current values
- Database is **backed up daily** - 7-day retention
- Point-in-time recovery is **enabled** - can restore to any point in last 7 days

---

**Status**: ✅ Migration script ready, awaiting VPC access to execute

**Recommendation**: Set up bastion host or VPN for secure database access
