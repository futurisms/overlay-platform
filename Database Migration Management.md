---
name: database-migration-management
description: Safe database schema evolution with rollback capabilities. Use when creating new tables, adding/modifying columns, creating indexes, adding foreign keys, or any schema changes. Covers migration naming conventions, transaction wrapping, rollback scripts, index creation best practices, and migration verification. Prevents breaking changes, data loss, and production issues. Essential for all database schema modifications.
---

# Database Migration Management

Safe schema evolution patterns from production systems.

## Core Principles

### 1. Every Change Gets a Migration
**Never edit database directly in production:**
- ❌ Connecting to production DB and running ALTER TABLE
- ✅ Creating migration file, testing locally, deploying via script

### 2. Migrations Are Immutable
**Once deployed, never edit:**
- ❌ Editing migration_005.sql after it's been run
- ✅ Creating migration_006.sql to fix issues

### 3. Always Include Rollback
**Every migration needs its reverse:**
- Create: `001_add_user_role.sql`
- Rollback: `rollback-001_add_user_role.sql`

### 4. Test Locally First
**Verify before production:**
1. Apply migration locally
2. Test application works
3. Run rollback
4. Verify application still works
5. Re-apply migration
6. Then deploy to production

## Migration Naming Convention

### Standard Format
```
XXX_descriptive_name.sql

Where:
- XXX = Zero-padded sequential number (001, 002, ... 010, 011)
- descriptive_name = What the migration does (snake_case)
```

### Good Examples
```
001_create_users_table.sql
002_add_user_role_column.sql
003_create_session_access_table.sql
010_add_is_active_to_sessions.sql
```

### Bad Examples
```
add_column.sql          ❌ No number
5_users.sql             ❌ Not zero-padded
002-add-column.sql      ❌ Use underscore not dash
002_AddColumn.sql       ❌ Use snake_case not CamelCase
```

## Migration File Structure

### Standard Template
```sql
-- Migration XXX: Brief Description
-- Purpose: Detailed explanation of why this change
-- Author: Name
-- Date: YYYY-MM-DD

BEGIN;

-- Main changes here
ALTER TABLE ...;
CREATE TABLE ...;
CREATE INDEX ...;

-- Update migration tracking
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('XXX_descriptive_name', CURRENT_TIMESTAMP)
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
```

### Why BEGINCOMMIT?
- All-or-nothing: Either entire migration succeeds or none of it
- Prevents partial migrations that leave DB in bad state
- Automatically rolls back on any error

## Common Migration Types

### Adding a Column
```sql
-- Migration 010: Add is_archived column
BEGIN;

ALTER TABLE review_sessions 
  ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;

-- Add index if column will be filtered
CREATE INDEX idx_review_sessions_is_archived 
  ON review_sessions(is_archived);

-- Migration tracking
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('010_add_is_archived_to_sessions', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

COMMIT;
```

**Rollback:**
```sql
-- Rollback 010
BEGIN;

DROP INDEX IF EXISTS idx_review_sessions_is_archived;
ALTER TABLE review_sessions DROP COLUMN IF EXISTS is_archived;

DELETE FROM schema_migrations 
WHERE migration_name = '010_add_is_archived_to_sessions';

COMMIT;
```

### Creating a Table
```sql
-- Migration 011: Create session_access table
BEGIN;

CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(user_id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, session_id)
);

-- Indexes for common queries
CREATE INDEX idx_session_access_user ON session_access(user_id);
CREATE INDEX idx_session_access_session ON session_access(session_id);
CREATE INDEX idx_session_access_granted_by ON session_access(granted_by);

-- Comments for documentation
COMMENT ON TABLE session_access IS 'Controls which analysts can access which sessions';
COMMENT ON COLUMN session_access.granted_by IS 'Admin who granted access';

-- Migration tracking
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('011_create_session_access', CURRENT_TIMESTAMP);

COMMIT;
```

**Rollback:**
```sql
-- Rollback 011
BEGIN;

DROP TABLE IF EXISTS session_access CASCADE;

DELETE FROM schema_migrations 
WHERE migration_name = '011_create_session_access';

COMMIT;
```

### Adding Foreign Key
```sql
-- Migration 012: Add foreign key to submissions
BEGIN;

-- Add foreign key with ON DELETE CASCADE
ALTER TABLE document_submissions
  ADD CONSTRAINT fk_submissions_session
  FOREIGN KEY (session_id)
  REFERENCES review_sessions(session_id)
  ON DELETE CASCADE;

-- Migration tracking
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('012_add_submissions_fk', CURRENT_TIMESTAMP);

COMMIT;
```

**Rollback:**
```sql
-- Rollback 012
BEGIN;

ALTER TABLE document_submissions
  DROP CONSTRAINT IF EXISTS fk_submissions_session;

DELETE FROM schema_migrations 
WHERE migration_name = '012_add_submissions_fk';

COMMIT;
```

### Creating Index
```sql
-- Migration 013: Add index for notes filtering
BEGIN;

-- Single column index
CREATE INDEX idx_user_notes_created_by 
  ON user_notes(created_by);

-- Composite index for common query pattern
CREATE INDEX idx_user_notes_submission_creator 
  ON user_notes(submission_id, created_by);

-- Migration tracking
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('013_add_notes_indexes', CURRENT_TIMESTAMP);

COMMIT;
```

**Rollback:**
```sql
-- Rollback 013
BEGIN;

DROP INDEX IF EXISTS idx_user_notes_created_by;
DROP INDEX IF EXISTS idx_user_notes_submission_creator;

DELETE FROM schema_migrations 
WHERE migration_name = '013_add_notes_indexes';

COMMIT;
```

## Index Best Practices

### When to Create Indexes
**Create indexes on columns used in:**
- WHERE clauses (frequently filtered)
- JOIN conditions (foreign keys)
- ORDER BY clauses (sorted results)
- UNIQUE constraints

**Example queries that need indexes:**
```sql
-- Needs index on user_id
SELECT * FROM submissions WHERE user_id = 'xxx';

-- Needs index on (submission_id, created_by)
SELECT * FROM notes WHERE submission_id = 'xxx' AND created_by = 'yyy';

-- Needs index on created_at
SELECT * FROM submissions ORDER BY created_at DESC LIMIT 10;
```

### Index Naming Convention
```
idx_<table>_<column(s)>

Examples:
idx_users_email
idx_submissions_user
idx_notes_submission_creator
```

### Composite Index Order
**Put most selective column first:**
```sql
-- Good: Most queries filter by submission_id
CREATE INDEX idx_notes_submission_creator 
  ON user_notes(submission_id, created_by);

-- Bad: Rarely filter by created_by alone
CREATE INDEX idx_notes_creator_submission
  ON user_notes(created_by, submission_id);
```

## Foreign Key Best Practices

### Always Specify ON DELETE Behavior
```sql
-- Cascade: Delete children when parent deleted
FOREIGN KEY (session_id) 
  REFERENCES review_sessions(session_id) 
  ON DELETE CASCADE

-- Restrict: Prevent deletion if children exist
FOREIGN KEY (user_id)
  REFERENCES users(user_id)
  ON DELETE RESTRICT

-- Set NULL: Set to NULL when parent deleted
FOREIGN KEY (invited_by)
  REFERENCES users(user_id)
  ON DELETE SET NULL
```

### Common Patterns
**Use CASCADE for:**
- Child records that don't make sense without parent
- Example: submissions for a deleted session

**Use RESTRICT for:**
- Parent records that shouldn't be deleted if children exist
- Example: user who created submissions

**Use SET NULL for:**
- Optional relationships
- Example: invited_by user (record keeps even if inviter deleted)

## Data Migration Patterns

### Adding Column with Data
```sql
-- Migration 014: Add email_verified column
BEGIN;

-- Step 1: Add nullable column
ALTER TABLE users ADD COLUMN email_verified BOOLEAN;

-- Step 2: Populate existing rows
UPDATE users SET email_verified = true WHERE created_at < '2026-01-01';
UPDATE users SET email_verified = false WHERE created_at >= '2026-01-01';

-- Step 3: Make NOT NULL
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;

-- Step 4: Add default for new rows
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

-- Migration tracking
INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('014_add_email_verified', CURRENT_TIMESTAMP);

COMMIT;
```

### Renaming Column (Safe Pattern)
```sql
-- Don't rename directly! Add new, migrate, drop old

-- Migration 015: Rename user_name to full_name
BEGIN;

-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Step 2: Copy data
UPDATE users SET full_name = user_name;

-- Step 3: Make NOT NULL
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Note: Don't drop old column yet! Let it coexist.
-- Drop in next migration after verifying application works.

INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('015_add_full_name_column', CURRENT_TIMESTAMP);

COMMIT;
```

```sql
-- Migration 016: Drop old user_name column
BEGIN;

-- Now safe to drop after full_name is in use
ALTER TABLE users DROP COLUMN user_name;

INSERT INTO schema_migrations (migration_name, executed_at)
VALUES ('016_drop_user_name_column', CURRENT_TIMESTAMP);

COMMIT;
```

## Migration Tracking Table

### Schema
```sql
CREATE TABLE schema_migrations (
  migration_id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Check Applied Migrations
```sql
SELECT migration_name, executed_at
FROM schema_migrations
ORDER BY migration_id;
```

### Check Pending Migrations
```bash
# List migration files
ls database/migrations/*.sql

# Compare with applied migrations
psql -c "SELECT migration_name FROM schema_migrations"
```

## Verification Queries

### After Adding Column
```sql
-- Verify column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'user_role';

-- Verify data populated
SELECT user_role, COUNT(*) 
FROM users 
GROUP BY user_role;
```

### After Creating Table
```sql
-- Verify table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'session_access';

-- Verify structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'session_access';

-- Verify constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'session_access';
```

### After Creating Index
```sql
-- Verify index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_notes';

-- Check index usage (after some queries)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'user_notes';
```

## Common Pitfalls

### Pitfall 1: Forgetting NOT NULL
```sql
-- Bad: Allows NULL unexpectedly
ALTER TABLE users ADD COLUMN user_role VARCHAR(50);

-- Good: Explicit NULL handling
ALTER TABLE users ADD COLUMN user_role VARCHAR(50) DEFAULT 'admin' NOT NULL;
```

### Pitfall 2: Missing Index on Foreign Key
```sql
-- Bad: Foreign key without index (slow JOINs)
FOREIGN KEY (user_id) REFERENCES users(user_id)

-- Good: Add index
CREATE INDEX idx_submissions_user ON submissions(user_id);
FOREIGN KEY (user_id) REFERENCES users(user_id);
```

### Pitfall 3: Not Testing Rollback
```sql
-- Always test:
1. Apply migration
2. Run application tests
3. Run rollback
4. Verify application works without migration
5. Re-apply migration
```

### Pitfall 4: Changing Data in Schema Migration
```sql
-- Bad: Mixing schema and data changes
BEGIN;
ALTER TABLE users ADD COLUMN status VARCHAR(20);
UPDATE users SET status = 'active';
COMMIT;

-- Good: Separate migrations
-- Migration 020: Add status column
ALTER TABLE users ADD COLUMN status VARCHAR(20);

-- Migration 021: Populate status
UPDATE users SET status = 'active' WHERE last_login > NOW() - INTERVAL '30 days';
```

## Deployment Checklist

### Before Deploying Migration
- [ ] Migration file created with proper number
- [ ] Rollback file created
- [ ] Tested locally (apply + rollback + re-apply)
- [ ] Application code updated to handle new schema
- [ ] Verified queries use new indexes
- [ ] Backup taken

### Deployment Steps
1. Take database snapshot/backup
2. Deploy migration via Lambda or script
3. Verify migration applied successfully
4. Query migration tracking table
5. Test application functionality
6. Monitor for errors

### If Migration Fails
1. Check error logs
2. Run rollback script
3. Verify rollback succeeded
4. Fix migration script
5. Test locally again
6. Re-deploy

## Tools & Scripts

### Apply Migration Script
```bash
#!/bin/bash
# apply-migration.sh
MIGRATION=$1
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/migrations/$MIGRATION

if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully"
else
  echo "❌ Migration failed"
  exit 1
fi
```

### Rollback Script
```bash
#!/bin/bash
# rollback-migration.sh
MIGRATION=$1
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/migrations/rollback-$MIGRATION

if [ $? -eq 0 ]; then
  echo "✅ Rollback successful"
else
  echo "❌ Rollback failed"
  exit 1
fi
```

### Verify Migration Script
```bash
#!/bin/bash
# verify-migration.sh
echo "Applied migrations:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT migration_name, executed_at 
  FROM schema_migrations 
  ORDER BY executed_at DESC 
  LIMIT 10
"
```

## Quick Reference

### Common Commands
```sql
-- List all tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- List all columns in table
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';

-- List all indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';

-- List all foreign keys
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'submissions' AND constraint_type = 'FOREIGN KEY';

-- Check migration history
SELECT * FROM schema_migrations ORDER BY executed_at DESC;
```

---

**Remember:** Migrations are permanent records of schema evolution. Take time to get them right!
