-- Migration 018: Fix analyst session access
-- Purpose: Create missing session_participants entries for analysts who signed up
--          before the Cognito integration was deployed
-- Date: February 5, 2026

-- Insert session_participants entries for analysts who have accepted invitations
-- but don't have session_participants entries
INSERT INTO session_participants (user_id, session_id, invited_by, role, status)
SELECT
  u.user_id,
  ui.session_id,
  ui.invited_by,
  'reviewer' as role,
  'active' as status
FROM users u
INNER JOIN user_invitations ui ON u.email = ui.email
WHERE ui.accepted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.user_id = u.user_id AND sp.session_id = ui.session_id
  );

-- Verification: Check that session_participants entries were created
DO $$
DECLARE
  analyst_count INTEGER;
  participant_count INTEGER;
BEGIN
  -- Count analysts who accepted invitations
  SELECT COUNT(*) INTO analyst_count
  FROM users u
  INNER JOIN user_invitations ui ON u.email = ui.email
  WHERE ui.accepted_at IS NOT NULL;

  -- Count their session_participants entries
  SELECT COUNT(*) INTO participant_count
  FROM users u
  INNER JOIN user_invitations ui ON u.email = ui.email
  INNER JOIN session_participants sp ON u.user_id = sp.user_id AND ui.session_id = sp.session_id
  WHERE ui.accepted_at IS NOT NULL;

  RAISE NOTICE 'Migration 018: Found % analysts with accepted invitations', analyst_count;
  RAISE NOTICE 'Migration 018: Created/verified % session_participants entries', participant_count;

  IF analyst_count > 0 AND participant_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: No session_participants entries created';
  END IF;

  RAISE NOTICE 'Migration 018 successful: Analyst session access fixed';
END $$;
