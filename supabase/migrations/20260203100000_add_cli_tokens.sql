-- CLI Tokens table for JWT-based CLI authentication
-- Stores refresh token hashes for CLI authentication

-- CLI Tokens table
CREATE TABLE IF NOT EXISTS cli_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash
    scopes TEXT[] DEFAULT ARRAY['cli:read', 'cli:write'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,  -- Refresh token expiration
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast token lookup by refresh token hash
CREATE INDEX IF NOT EXISTS cli_tokens_refresh_hash_idx ON cli_tokens(refresh_token_hash) WHERE revoked_at IS NULL;

-- Index for user's tokens listing (only active tokens)
CREATE INDEX IF NOT EXISTS cli_tokens_user_id_active_idx ON cli_tokens(user_id) WHERE revoked_at IS NULL;

-- Enable Row Level Security
ALTER TABLE cli_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own CLI tokens
CREATE POLICY "Users can view own CLI tokens"
    ON cli_tokens FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own CLI tokens
CREATE POLICY "Users can insert own CLI tokens"
    ON cli_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own CLI tokens
CREATE POLICY "Users can update own CLI tokens"
    ON cli_tokens FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own CLI tokens
CREATE POLICY "Users can delete own CLI tokens"
    ON cli_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- Service role policy for backend operations (bypass RLS)
CREATE POLICY "Service role can manage all CLI tokens"
    ON cli_tokens FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
