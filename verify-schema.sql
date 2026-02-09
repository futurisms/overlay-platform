-- Comprehensive schema verification after Phase 1
SELECT 
  'Total tables' as metric,
  COUNT(*)::text as value
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
  'Total views',
  COUNT(*)::text
FROM information_schema.views
WHERE table_schema = 'public'

UNION ALL

SELECT 
  'Total indexes',
  COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public'

UNION ALL

SELECT
  'user_role column exists',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_role'
  ) THEN 'YES' ELSE 'NO' END

UNION ALL

SELECT
  'Admin users',
  COUNT(*)::text
FROM users
WHERE user_role = 'admin'

UNION ALL

SELECT
  'Analyst users',
  COUNT(*)::text
FROM users
WHERE user_role = 'analyst'

UNION ALL

SELECT
  'session_access table exists',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'session_access'
  ) THEN 'YES' ELSE 'NO' END

UNION ALL

SELECT
  'user_invitations table exists',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_invitations'
  ) THEN 'YES' ELSE 'NO' END

UNION ALL

SELECT
  'Session access rows',
  COUNT(*)::text
FROM session_access

UNION ALL

SELECT
  'Invitations',
  COUNT(*)::text
FROM user_invitations

UNION ALL

SELECT
  'Token usage records',
  COUNT(*)::text
FROM token_usage

ORDER BY metric;
