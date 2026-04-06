-- Google OAuth tokens for calendar integration
-- Stores per-user tokens. RLS enabled, only user can access their own row.

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT NOT NULL,
  scope TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on user_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_user_id
  ON google_oauth_tokens(user_id);

-- RLS: only the owning user can read/write their tokens
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google tokens"
  ON google_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google tokens"
  ON google_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google tokens"
  ON google_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tokens"
  ON google_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);
