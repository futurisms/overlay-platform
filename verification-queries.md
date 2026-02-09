# Verification Queries Reference

Quick copy-paste SQL queries for common verification tasks.

## Database Object Verification

### Check if tables exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'sessions', 'invitations');
```

### Check if columns exist
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('user_role', 'is_active');
```

### Check if indexes exist
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY indexname;
```

### Check foreign keys
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'session_access';
```

## Data Isolation Verification

### Count records by role
```sql
-- All records (admin view)
SELECT COUNT(*) as total_records
FROM submissions;

-- User's records only
SELECT COUNT(*) as user_records
FROM submissions
WHERE submitted_by = 'user-id-here';

-- Verify isolation
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE submitted_by = 'user-id') as user_only,
  COUNT(*) - COUNT(*) FILTER (WHERE submitted_by = 'user-id') as other_users
FROM submissions;
```

### Verify session access filtering
```sql
-- Sessions accessible to user
SELECT s.session_id, s.name
FROM review_sessions s
LEFT JOIN session_access sa ON s.session_id = sa.session_id
WHERE sa.user_id = 'user-id-here'
   OR 'admin' = (SELECT user_role FROM users WHERE user_id = 'user-id-here');
```

### Check notes isolation
```sql
-- Notes visible to user
SELECT COUNT(*) as visible_notes
FROM user_notes
WHERE created_by = 'user-id-here';

-- All notes (admin view)
SELECT COUNT(*) as all_notes
FROM user_notes;
```

## Permission Verification

### Check user roles
```sql
SELECT user_id, email, user_role, created_at
FROM users
ORDER BY created_at DESC;
```

### Check session access grants
```sql
SELECT 
  u.email,
  s.name as session_name,
  sa.granted_at,
  granter.email as granted_by
FROM session_access sa
JOIN users u ON sa.user_id = u.user_id
JOIN review_sessions s ON sa.session_id = s.session_id
JOIN users granter ON sa.granted_by = granter.user_id
ORDER BY sa.granted_at DESC;
```

### Check invitation status
```sql
SELECT 
  email,
  session_id,
  expires_at,
  accepted_at,
  CASE 
    WHEN accepted_at IS NOT NULL THEN 'Accepted'
    WHEN expires_at < NOW() THEN 'Expired'
    ELSE 'Pending'
  END as status
FROM user_invitations
ORDER BY created_at DESC;
```

## Performance Verification

### Check index usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check table sizes
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Migration Verification

### Check migration history
```sql
SELECT migration_name, executed_at
FROM schema_migrations
ORDER BY executed_at DESC;
```

### Count database objects
```sql
SELECT 
  'Tables' as object_type,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'

UNION ALL

SELECT 'Views', COUNT(*)
FROM information_schema.views
WHERE table_schema = 'public'

UNION ALL

SELECT 'Indexes', COUNT(*)
FROM pg_indexes
WHERE schemaname = 'public'

UNION ALL

SELECT 'Foreign Keys', COUNT(*)
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';
```

## Testing Queries

### Insert test data
```sql
-- Insert test user
INSERT INTO users (email, name, user_role)
VALUES ('test@example.com', 'Test User', 'analyst')
RETURNING user_id;

-- Grant session access
INSERT INTO session_access (user_id, session_id, granted_by)
VALUES ('user-id', 'session-id', 'admin-id');
```

### Clean up test data
```sql
-- Delete test submissions
DELETE FROM document_submissions 
WHERE submitted_by = 'test-user-id';

-- Delete test user
DELETE FROM users 
WHERE email = 'test@example.com';
```

## Error Testing

### Test constraint violations
```sql
-- Should fail: Invalid role
INSERT INTO users (email, name, user_role)
VALUES ('bad@example.com', 'Bad', 'invalid_role');

-- Should fail: Duplicate email
INSERT INTO users (email, name, user_role)
VALUES ('existing@example.com', 'Duplicate', 'analyst');

-- Should fail: Foreign key violation
INSERT INTO session_access (user_id, session_id, granted_by)
VALUES ('nonexistent-id', 'session-id', 'admin-id');
```

## Quick Diagnostic Queries

### Recent activity
```sql
-- Recent submissions
SELECT 
  ds.submission_id,
  u.email,
  u.user_role,
  s.name as session_name,
  ds.created_at
FROM document_submissions ds
JOIN users u ON ds.submitted_by = u.user_id
JOIN review_sessions s ON ds.session_id = s.session_id
ORDER BY ds.created_at DESC
LIMIT 10;

-- Recent invitations
SELECT 
  email,
  session_id,
  created_at,
  accepted_at
FROM user_invitations
ORDER BY created_at DESC
LIMIT 10;
```

### System health check
```sql
-- Quick status
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE user_role = 'admin') as admins,
  (SELECT COUNT(*) FROM users WHERE user_role = 'analyst') as analysts,
  (SELECT COUNT(*) FROM review_sessions WHERE is_active = true) as active_sessions,
  (SELECT COUNT(*) FROM session_access) as access_grants,
  (SELECT COUNT(*) FROM document_submissions) as total_submissions;
```
