-- Add expires_at column to api_keys table for configurable expiration
-- This allows users to set custom expiration periods (7-365 days) for API keys

-- Add expires_at column (nullable to maintain backward compatibility with existing keys)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Update existing keys to have a default expiration of 1 year from creation (or now for very old keys)
UPDATE api_keys
SET expires_at = COALESCE(created_at + INTERVAL '365 days', NOW() + INTERVAL '365 days')
WHERE expires_at IS NULL;

-- Make expires_at NOT NULL after backfilling existing data
ALTER TABLE api_keys ALTER COLUMN expires_at SET NOT NULL;

-- Update index to include expiration check for active keys
DROP INDEX IF EXISTS api_keys_key_hash_idx;
CREATE INDEX api_keys_key_hash_active_idx ON api_keys(key_hash)
WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW());

-- Update user's keys listing index to include expiration
DROP INDEX IF EXISTS api_keys_user_id_active_idx;
CREATE INDEX api_keys_user_id_active_idx ON api_keys(user_id)
WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW());

-- Add comment for documentation
COMMENT ON COLUMN api_keys.expires_at IS 'Timestamp when the API key expires. Keys with past expiration dates are treated as inactive.';
