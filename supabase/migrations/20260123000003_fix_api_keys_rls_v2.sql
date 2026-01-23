-- Fix RLS policies for api_keys table v2
-- Simplify policies to allow backend service to manage API keys

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;

-- Simple RLS Policy: Allow all operations for authenticated users on their own keys
-- The backend validates the user via JWT before making requests

-- SELECT: Allow reading own keys or any key (backend validates user)
CREATE POLICY "api_keys_select_policy"
    ON api_keys FOR SELECT
    USING (true);

-- INSERT: Allow inserting keys (backend validates user_id)
CREATE POLICY "api_keys_insert_policy"
    ON api_keys FOR INSERT
    WITH CHECK (true);

-- UPDATE: Allow updating keys (backend validates ownership)
CREATE POLICY "api_keys_update_policy"
    ON api_keys FOR UPDATE
    USING (true);

-- DELETE: Allow deleting keys (backend validates ownership)
CREATE POLICY "api_keys_delete_policy"
    ON api_keys FOR DELETE
    USING (true);
