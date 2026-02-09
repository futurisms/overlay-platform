-- Verify Phase 1 migrations
SELECT 
  'user_role column' as check_name,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'user_role'
UNION ALL
SELECT 
  'session_access table',
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
FROM information_schema.tables
WHERE table_name = 'session_access'
UNION ALL
SELECT
  'user_invitations table',
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
FROM information_schema.tables
WHERE table_name = 'user_invitations'
UNION ALL
SELECT
  'idx_users_role index',
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END
FROM pg_indexes
WHERE indexname = 'idx_users_role'
UNION ALL
SELECT
  'idx_user_notes_user_id index',
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END  
FROM pg_indexes
WHERE indexname = 'idx_user_notes_user_id';
