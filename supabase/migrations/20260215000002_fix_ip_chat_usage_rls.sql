-- =========================================================
-- Security Fix: ip_chat_usage RLS Policy Hardening
-- =========================================================
-- Issue: ip_chat_usage table has a permissive RLS policy that
--        allows any authenticated user to read all IP usage data.
--        The table has no user_id column (tracks by ip_address),
--        so it should only be accessible via service_role.
--
-- Fix:
--   1. Drop ALL existing RLS policies on ip_chat_usage
--   2. Create a single service_role-only ALL policy
--   3. Ensure RLS is enabled
--
-- Date: 2026-02-15 (runs after 20260215000001)
-- =========================================================

BEGIN;

DO $$
DECLARE
    pol record;
BEGIN
    -- Guard: skip if table does not exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ip_chat_usage'
    ) THEN
        RAISE NOTICE 'Table ip_chat_usage does not exist, skipping migration';
        RETURN;
    END IF;

    -- Step 1: Drop ALL existing policies on ip_chat_usage
    -- This ensures no stale USING(true) or overly permissive policies remain
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'ip_chat_usage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON ip_chat_usage', pol.policyname);
    END LOOP;

    -- Step 2: Ensure RLS is enabled (idempotent)
    EXECUTE 'ALTER TABLE ip_chat_usage ENABLE ROW LEVEL SECURITY';

    -- Step 3: Force RLS for table owner as well (prevents bypassing RLS)
    EXECUTE 'ALTER TABLE ip_chat_usage FORCE ROW LEVEL SECURITY';

    -- Step 4: Create service_role-only ALL policy
    -- The ip_chat_usage table has no user_id column; it tracks usage by
    -- IP address. Only the backend (via service_role key) should access it.
    -- Using "TO service_role" restricts the policy to the service_role role,
    -- meaning anon and authenticated roles get zero access.
    EXECUTE 'CREATE POLICY "ip_chat_usage_service_role_only" ON ip_chat_usage
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)';

    RAISE NOTICE 'ip_chat_usage RLS policies updated: service_role only';
END
$$;

COMMIT;
