-- Fix analyst session access
-- This script manually creates the session_participants entry for analysts
-- who signed up before the Cognito integration was fixed

-- First, let's see what we have
SELECT 'USER CHECK' as step;
SELECT user_id, email, username, first_name, last_name, user_role
FROM users WHERE email = 'bains@futurisms.ai';

SELECT 'INVITATION CHECK' as step;
SELECT invitation_id, email, session_id, invited_by, accepted_at, accepted_by
FROM user_invitations WHERE email = 'bains@futurisms.ai';

SELECT 'SESSION CHECK' as step;
SELECT session_id, name, is_active
FROM review_sessions
WHERE session_id = (SELECT session_id FROM user_invitations WHERE email = 'bains@futurisms.ai' LIMIT 1);

SELECT 'PARTICIPANT CHECK' as step;
SELECT sp.participant_id, sp.session_id, sp.user_id, sp.role, sp.status
FROM session_participants sp
WHERE sp.user_id = (SELECT user_id FROM users WHERE email = 'bains@futurisms.ai');

-- If no session_participants entry exists, create it:
INSERT INTO session_participants (user_id, session_id, invited_by, role, status)
SELECT
  u.user_id,
  ui.session_id,
  ui.invited_by,
  'reviewer' as role,
  'active' as status
FROM users u
CROSS JOIN user_invitations ui
WHERE u.email = 'bains@futurisms.ai'
  AND ui.email = 'bains@futurisms.ai'
  AND NOT EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.user_id = u.user_id AND sp.session_id = ui.session_id
  );

-- Verify the fix
SELECT 'VERIFICATION' as step;
SELECT
  sp.participant_id,
  sp.user_id,
  sp.session_id,
  sp.role,
  sp.status,
  rs.name as session_name,
  u.email
FROM session_participants sp
JOIN users u ON sp.user_id = u.user_id
JOIN review_sessions rs ON sp.session_id = rs.session_id
WHERE u.email = 'bains@futurisms.ai';
