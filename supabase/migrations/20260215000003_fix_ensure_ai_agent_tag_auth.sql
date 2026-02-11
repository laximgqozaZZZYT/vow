-- Fix: Add auth.uid() check to ensure_ai_agent_tag()
-- Security audit finding: SECURITY DEFINER function lacks caller identity verification.
-- Without this check, any authenticated user could pass another user's ID and
-- create/retrieve AI agent tags for that user.

BEGIN;

-- Guard: only proceed if the function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'ensure_ai_agent_tag'
  ) THEN
    RAISE NOTICE 'Function ensure_ai_agent_tag does not exist, skipping.';
    RETURN;
  END IF;

  -- Recreate the function with auth.uid() validation
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION ensure_ai_agent_tag(user_id_param TEXT)
    RETURNS TEXT
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body$
    DECLARE
      tag_id TEXT;
    BEGIN
      -- Verify the caller is the user they claim to be
      IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated: auth.uid() is NULL';
      END IF;

      IF auth.uid()::text != user_id_param THEN
        RAISE EXCEPTION 'Forbidden: auth.uid() does not match user_id_param';
      END IF;

      -- Existing logic: find the AI agent tag for this user
      SELECT id INTO tag_id
      FROM tags
      WHERE name = 'AIエージェント'
        AND owner_type = 'user'
        AND owner_id = user_id_param;

      -- Create the tag if it does not exist
      IF tag_id IS NULL THEN
        INSERT INTO tags (
          id,
          name,
          color,
          icon,
          is_system,
          owner_type,
          owner_id,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid()::text,
          'AIエージェント',
          '#9333ea',  -- Purple
          'robot',
          TRUE,
          'user',
          user_id_param,
          NOW(),
          NOW()
        )
        RETURNING id INTO tag_id;
      END IF;

      RETURN tag_id;
    END;
    $body$;
  $fn$;

END;
$$;

COMMIT;
