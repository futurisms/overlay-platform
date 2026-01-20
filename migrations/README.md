## Database Migrations

This folder contains SQL migration files for the Overlay Platform PostgreSQL database.

## Migration Files

1. **000_initial_schema.sql** - Creates all database tables, indexes, functions, triggers, and views
2. **001_seed_data.sql** - Inserts initial seed data for testing and demo purposes

## Database Schema Overview

### Core Tables (15 total)

1. **organizations** - Multi-tenant organization accounts
2. **users** - User accounts within organizations
3. **user_roles** - User role assignments (admin, manager, reviewer, submitter, viewer)
4. **overlays** - Document review overlay configurations
5. **evaluation_criteria** - Criteria used for evaluating documents
6. **user_sessions** - Active user sessions for authentication
7. **document_submissions** - Documents submitted for review
8. **evaluation_responses** - Responses to evaluation criteria
9. **feedback_reports** - Feedback and reports on submissions
10. **ai_analysis_results** - AI analysis results for documents
11. **audit_logs** - Complete audit trail
12. **llm_configurations** - LLM model configurations
13. **document_versions** - Document version history
14. **notifications** - User notifications

### Views

- **v_active_submissions** - Active submissions with user and overlay details
- **v_user_permissions** - User permissions summary

## Running Migrations

### Prerequisites

- Aurora Serverless v2 PostgreSQL cluster deployed
- Database credentials from AWS Secrets Manager
- PostgreSQL client (psql) or database management tool

### Step 1: Get Database Credentials

```bash
# Get Aurora endpoint
export DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name OverlayStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraClusterEndpoint`].OutputValue' \
  --output text)

# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id overlay/aurora/production/credentials \
  --query SecretString \
  --output text > credentials.json

# Extract values
export DB_USERNAME=$(cat credentials.json | jq -r .username)
export DB_PASSWORD=$(cat credentials.json | jq -r .password)
export DB_NAME=$(cat credentials.json | jq -r .dbname)

# Clean up credentials file
rm credentials.json
```

### Step 2: Connect to Database

**Option A: Using psql (requires VPN/bastion host access to VPC)**

```bash
psql -h $DB_ENDPOINT -U $DB_USERNAME -d $DB_NAME
```

**Option B: Using AWS Systems Manager Session Manager**

1. Set up a bastion host in a private subnet
2. Connect via SSM Session Manager
3. Install PostgreSQL client on bastion
4. Connect using internal VPC DNS

**Option C: Using pgAdmin or DBeaver**

1. Set up VPN connection to VPC
2. Configure connection:
   - Host: Aurora cluster endpoint
   - Port: 5432
   - Database: overlay_db
   - Username: overlay_admin
   - Password: (from Secrets Manager)

### Step 3: Run Migration Scripts

```bash
# Connect and run migrations
psql -h $DB_ENDPOINT -U $DB_USERNAME -d $DB_NAME -f 000_initial_schema.sql
psql -h $DB_ENDPOINT -U $DB_USERNAME -d $DB_NAME -f 001_seed_data.sql
```

Or interactively:

```sql
-- Connect to database first
\i 000_initial_schema.sql
\i 001_seed_data.sql
```

### Step 4: Verify Migrations

```sql
-- List all tables
\dt

-- Check table counts
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify seed data
SELECT COUNT(*) as organization_count FROM organizations;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as overlay_count FROM overlays;
SELECT COUNT(*) as criteria_count FROM evaluation_criteria;
```

## Seed Data Summary

The seed data creates:

### Organizations
- 1 demo organization: "Overlay Demo Organization"

### Users (all with password: `Password123!`)
- admin@overlay.com (Admin, Manager, Reviewer, Submitter roles)
- manager@overlay.com (Manager, Reviewer roles)
- reviewer@overlay.com (Reviewer role)
- submitter@overlay.com (Submitter role)

### Overlays (Document Templates)
1. Contract Review - Standard
2. Financial Statement Review
3. Compliance Document Review
4. General Document Review

### Evaluation Criteria
- 7 criteria for Contract Review
- 6 criteria for Financial Statement Review
- 6 criteria for Compliance Review
- 5 criteria for General Review

### LLM Configurations
1. Claude 3.5 Sonnet (default)
2. Claude 3 Opus (advanced)
3. Claude 3 Haiku (fast)

### Sample Data
- 2 sample document submissions
- 1 AI analysis result
- 2 notifications

## Database Maintenance

### Backup

```bash
# Manual backup
pg_dump -h $DB_ENDPOINT -U $DB_USERNAME -d $DB_NAME > overlay_backup_$(date +%Y%m%d).sql

# Restore
psql -h $DB_ENDPOINT -U $DB_USERNAME -d $DB_NAME < overlay_backup_20260119.sql
```

### Monitoring

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('overlay_db'));

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Security Notes

1. **Change Default Passwords**: The seed data includes demo users with the default password `Password123!`. Change these immediately in production.

2. **Rotate Credentials**: Set up automatic rotation for database credentials in AWS Secrets Manager.

3. **Access Control**: The database is only accessible from within the VPC. Use VPN or bastion host for access.

4. **Audit Logs**: All user activities are logged in the `audit_logs` table.

5. **Encryption**: All data is encrypted at rest using AWS-managed keys.

## Future Migrations

When adding new migrations:

1. Create new file: `00X_description.sql`
2. Use sequential numbering
3. Include rollback instructions in comments
4. Test on dev environment first
5. Document schema changes in this README

## Troubleshooting

### Connection Issues

```bash
# Test connectivity
nc -zv $DB_ENDPOINT 5432

# Check security group rules
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*Aurora*" \
  --query 'SecurityGroups[*].[GroupName,GroupId,IpPermissions]'
```

### Migration Errors

```sql
-- Check for existing objects
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Drop all tables (DANGER - only for development)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO overlay_admin;
```

### Performance Issues

```sql
-- Analyze tables
ANALYZE VERBOSE;

-- Reindex
REINDEX DATABASE overlay_db;

-- Vacuum
VACUUM ANALYZE;
```

## Support

For database issues:
1. Check CloudWatch Logs for PostgreSQL errors
2. Review audit logs for unusual activity
3. Verify security group rules
4. Check Aurora cluster status in RDS console
