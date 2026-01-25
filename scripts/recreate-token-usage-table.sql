-- Recreate token_usage table with correct structure
-- Run this in Supabase SQL Editor

-- First, check current structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'token_usage' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Drop and recreate the table (WARNING: This will delete all existing data)
DROP TABLE IF EXISTS token_usage CASCADE;

CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX idx_token_usage_user_id_created ON token_usage(user_id, created_at);
CREATE INDEX idx_token_usage_feature ON token_usage(feature);

-- Enable RLS
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own token usage" ON token_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage token usage" ON token_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Verify the new structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'token_usage' 
AND table_schema = 'public'
ORDER BY ordinal_position;
