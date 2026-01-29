-- Migration: Add User Notes Table
-- Purpose: Store saved notes from review sessions
-- Date: January 29, 2026

CREATE TABLE IF NOT EXISTS user_notes (
  note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID REFERENCES review_sessions(session_id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created_at ON user_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notes_session_id ON user_notes(session_id) WHERE session_id IS NOT NULL;

-- Comments for documentation
COMMENT ON TABLE user_notes IS 'User-created notes from reviewing AI feedback';
COMMENT ON COLUMN user_notes.user_id IS 'User who created the note';
COMMENT ON COLUMN user_notes.session_id IS 'Optional link to review session';
COMMENT ON COLUMN user_notes.title IS 'User-provided title for the note';
COMMENT ON COLUMN user_notes.content IS 'Note content (accumulated text from selections)';
COMMENT ON COLUMN user_notes.ai_summary IS 'Optional AI-generated summary of notes (Phase 4)';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notes_updated_at();

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_notes'
  ) THEN
    RAISE EXCEPTION 'Migration failed: user_notes table not created';
  END IF;

  RAISE NOTICE 'Migration successful: user_notes table created';
END $$;
