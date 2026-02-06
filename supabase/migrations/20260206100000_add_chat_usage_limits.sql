-- Migration: Chat Usage Rate Limiting for Free/Guest Users
-- Purpose: Track MOC chat usage per user and IP to enforce rate limits
-- Date: 2026-02-06
--
-- Rate limits for free users:
-- - Daily limit: 5 chats per day
-- - Total limit: 100 chats cumulative
-- - IP daily limit: 20 chats per IP (prevents abuse via IP changes)

-- User-based chat usage tracking
CREATE TABLE IF NOT EXISTS chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- IP-based chat usage tracking (separate table for cleaner management)
CREATE TABLE IF NOT EXISTS ip_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ip_address, date)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date ON chat_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_id ON chat_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_chat_usage_ip_date ON ip_chat_usage(ip_address, date);
CREATE INDEX IF NOT EXISTS idx_ip_chat_usage_date ON ip_chat_usage(date);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_usage_updated_at_trigger
  BEFORE UPDATE ON chat_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_usage_updated_at();

CREATE TRIGGER update_ip_chat_usage_updated_at_trigger
  BEFORE UPDATE ON ip_chat_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_usage_updated_at();

-- Enable RLS
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_chat_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_usage: Users can only see their own usage
CREATE POLICY chat_usage_select_own
  ON chat_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY chat_usage_insert_own
  ON chat_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_usage_update_own
  ON chat_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for ip_chat_usage: Allow service role access only
-- (users should not directly access IP tracking)
CREATE POLICY ip_chat_usage_service_role
  ON ip_chat_usage
  USING (auth.role() = 'service_role');

-- Grant service role full access (backend uses service role key)
GRANT ALL ON chat_usage TO service_role;
GRANT ALL ON ip_chat_usage TO service_role;

-- Add comments for documentation
COMMENT ON TABLE chat_usage IS 'Tracks per-user chat usage for rate limiting (free users: 5/day, 100 total)';
COMMENT ON TABLE ip_chat_usage IS 'Tracks per-IP chat usage to prevent abuse (limit: 20/day per IP)';
COMMENT ON COLUMN chat_usage.daily_count IS 'Number of chats used today (resets daily)';
COMMENT ON COLUMN chat_usage.total_count IS 'Cumulative total chats since account creation';
COMMENT ON COLUMN ip_chat_usage.count IS 'Number of chats from this IP today (resets daily)';
