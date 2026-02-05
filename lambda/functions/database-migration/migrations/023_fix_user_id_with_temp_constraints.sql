-- Migration 023: Fix Cognito user_id mismatch using deferred constraints
-- Problem: PostgreSQL user has different user_id than Cognito user
-- Cognito user_id (sub): 928514c4-f0b1-70db-85cf-8d2cd438f0eb
-- Email: bains@futurisms.ai

DO $$
DECLARE
  old_user_id UUID;
  new_user_id UUID := '928514c4-f0b1-70db-85cf-8d2cd438f0eb';
BEGIN
  -- Get the current user_id for bains@futurisms.ai
  SELECT user_id INTO old_user_id
  FROM users
  WHERE email = 'bains@futurisms.ai';

  IF old_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email bains@futurisms.ai';
  END IF;

  IF old_user_id = new_user_id THEN
    RAISE NOTICE 'User already has correct user_id: %', new_user_id;
    RETURN;
  END IF;

  RAISE NOTICE 'Updating user_id from % to %', old_user_id, new_user_id;

  -- Drop foreign key constraints temporarily
  ALTER TABLE session_participants DROP CONSTRAINT IF EXISTS session_participants_user_id_fkey;
  ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_accepted_by_fkey;

  -- Update session_participants
  UPDATE session_participants
  SET user_id = new_user_id
  WHERE user_id = old_user_id;

  -- Update user_invitations
  UPDATE user_invitations
  SET accepted_by = new_user_id
  WHERE accepted_by = old_user_id;

  -- Update users table
  UPDATE users
  SET user_id = new_user_id
  WHERE user_id = old_user_id;

  -- Re-add foreign key constraints
  ALTER TABLE session_participants
  ADD CONSTRAINT session_participants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

  ALTER TABLE user_invitations
  ADD CONSTRAINT user_invitations_accepted_by_fkey
  FOREIGN KEY (accepted_by) REFERENCES users(user_id);

  RAISE NOTICE 'User_id updated successfully';
END $$;
