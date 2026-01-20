-- Migration: Add Slack connections table
-- Description: Creates slack_connections table for storing Slack OAuth tokens and user mappings

-- Create slack_connections table
CREATE TABLE IF NOT EXISTS slack_connections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_type TEXT NOT NULL DEFAULT 'user',
    owner_id TEXT NOT NULL,
    slack_user_id TEXT NOT NULL,
    slack_team_id TEXT NOT NULL,
    slack_team_name TEXT,
    slack_user_name TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    bot_access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT TRUE,
    UNIQUE(owner_type, owner_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_slack_connections_owner ON slack_connections(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_slack_connections_slack_user ON slack_connections(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_connections_team ON slack_connections(slack_team_id);

-- Enable Row Level Security
ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own Slack connections
CREATE POLICY "Users can access own slack connections" ON slack_connections
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
    );

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_slack_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_slack_connections_updated_at ON slack_connections;
CREATE TRIGGER trigger_slack_connections_updated_at
    BEFORE UPDATE ON slack_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_slack_connections_updated_at();

-- Add comment for documentation
COMMENT ON TABLE slack_connections IS 'Stores Slack OAuth connections for users';
COMMENT ON COLUMN slack_connections.access_token IS 'Encrypted user access token';
COMMENT ON COLUMN slack_connections.refresh_token IS 'Encrypted refresh token';
COMMENT ON COLUMN slack_connections.bot_access_token IS 'Encrypted bot access token';
COMMENT ON COLUMN slack_connections.is_valid IS 'Whether the connection is still valid (tokens not revoked)';
