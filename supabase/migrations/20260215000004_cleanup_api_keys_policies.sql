-- =================================================================
-- Cleanup: Remove any residual USING(true) or overly-permissive
-- RLS policies on api_keys table
-- =================================================================
-- Background:
--   - 20260123000000: Created proper auth.uid() = user_id policies
--   - 20260123000002: Replaced with EXISTS(auth.users) policies (too broad)
--   - 20260123000003: Replaced with USING(true) policies (CRITICAL vuln)
--   - 20260215000000: Fixed to auth.uid() = user_id
--   - 20260215000001: Added service_role policy
--
-- This migration ensures no stale policies remain from partial
-- or out-of-order migration runs. It is fully idempotent.
-- =================================================================

BEGIN;

DO $$
BEGIN
  -- Guard: only proceed if api_keys table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'api_keys'
  ) THEN
    RAISE NOTICE 'api_keys table does not exist, skipping cleanup';
    RETURN;
  END IF;

  -- =============================================
  -- Phase 1: Drop ALL known historical policy names
  -- (idempotent: DROP POLICY IF EXISTS)
  -- =============================================

  -- From 20260123000000 / 20260123000002 (old naming convention)
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own API keys" ON api_keys';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys';

  -- From 20260123000003 (USING(true) — the dangerous ones)
  -- These should already be gone via 20260215000000, but be defensive
  EXECUTE 'DROP POLICY IF EXISTS "api_keys_select_policy" ON api_keys';
  EXECUTE 'DROP POLICY IF EXISTS "api_keys_insert_policy" ON api_keys';
  EXECUTE 'DROP POLICY IF EXISTS "api_keys_update_policy" ON api_keys';
  EXECUTE 'DROP POLICY IF EXISTS "api_keys_delete_policy" ON api_keys';

  -- Service role policy (will be recreated below)
  EXECUTE 'DROP POLICY IF EXISTS "api_keys_service_role" ON api_keys';

  -- =============================================
  -- Phase 2: Ensure RLS is enabled
  -- =============================================
  EXECUTE 'ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY';

  -- =============================================
  -- Phase 3: Recreate correct policies
  -- =============================================

  -- User-scoped policies: auth.uid() = user_id
  EXECUTE '
    CREATE POLICY "api_keys_select_policy" ON api_keys
      FOR SELECT
      USING (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "api_keys_insert_policy" ON api_keys
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "api_keys_update_policy" ON api_keys
      FOR UPDATE
      USING (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "api_keys_delete_policy" ON api_keys
      FOR DELETE
      USING (auth.uid() = user_id)';

  -- Service role: full access (backend operations)
  EXECUTE '
    CREATE POLICY "api_keys_service_role" ON api_keys
      FOR ALL TO service_role
      USING (true)';

  RAISE NOTICE 'api_keys RLS policies cleaned up and recreated successfully';
END
$$;

COMMIT;
