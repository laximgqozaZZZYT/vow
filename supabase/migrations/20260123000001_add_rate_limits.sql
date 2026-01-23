-- Rate Limits table for API key rate limiting
-- Stores request counts per API key per time window for sliding window rate limiting

-- Rate Limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1
);

-- Unique constraint on (key_id, window_start) to ensure one record per key per window
ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_key_window_unique UNIQUE (key_id, window_start);

-- Index for fast rate limit checks (lookup by key_id and window_start)
CREATE INDEX IF NOT EXISTS rate_limits_key_window_idx ON rate_limits(key_id, window_start);

-- Note: Cleanup old rate limit records periodically with:
-- DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';

-- Enable Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage rate limits (no user-level access needed)
-- Rate limits are managed by the backend service, not directly by users
-- The backend uses service role to read/write rate limit records

-- Policy for service role to select rate limits
CREATE POLICY "Service role can select rate limits"
    ON rate_limits FOR SELECT
    USING (true);

-- Policy for service role to insert rate limits
CREATE POLICY "Service role can insert rate limits"
    ON rate_limits FOR INSERT
    WITH CHECK (true);

-- Policy for service role to update rate limits
CREATE POLICY "Service role can update rate limits"
    ON rate_limits FOR UPDATE
    USING (true);

-- Policy for service role to delete rate limits (for cleanup)
CREATE POLICY "Service role can delete rate limits"
    ON rate_limits FOR DELETE
    USING (true);
