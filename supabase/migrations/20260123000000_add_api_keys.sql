-- API Keys table for embeddable dashboard widgets
-- Stores hashed API keys for widget authentication

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix VARCHAR(8) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Unique constraint for user_id and key_hash combination
ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_key_hash_unique UNIQUE (user_id, key_hash);

-- Index for fast key lookup (only active keys)
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash) WHERE is_active = TRUE;

-- Index for user's keys listing (only active keys)
CREATE INDEX IF NOT EXISTS api_keys_user_id_active_idx ON api_keys(user_id) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own API keys
CREATE POLICY "Users can view own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own API keys
CREATE POLICY "Users can insert own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own API keys
CREATE POLICY "Users can update own API keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);
