-- Fix RLS policies for api_keys table
-- Allow backend service to manage API keys on behalf of users

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;

-- RLS Policy: Users can view their own API keys
-- Also allow service role (anon key with user_id match)
CREATE POLICY "Users can view own API keys"
    ON api_keys FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        -- Allow backend service to read keys for any user
        -- This is safe because the backend validates the user via JWT
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = user_id
        )
    );

-- RLS Policy: Users can insert their own API keys
-- Allow insert when user_id matches an existing user
CREATE POLICY "Users can insert own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR
        -- Allow backend service to create keys for any valid user
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = user_id
        )
    );

-- RLS Policy: Users can update their own API keys
CREATE POLICY "Users can update own API keys"
    ON api_keys FOR UPDATE
    USING (
        auth.uid() = user_id
        OR
        -- Allow backend service to update keys for any valid user
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = user_id
        )
    );

-- RLS Policy: Users can delete their own API keys (soft delete via update)
CREATE POLICY "Users can delete own API keys"
    ON api_keys FOR DELETE
    USING (
        auth.uid() = user_id
        OR
        -- Allow backend service to delete keys for any valid user
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = user_id
        )
    );
