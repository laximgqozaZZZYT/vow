-- Fix RLS policies for notification_preferences table
-- The service role key should bypass RLS automatically, so we don't need a special policy for it
-- The current policy using auth.jwt() ->> 'role' = 'service_role' doesn't work correctly

-- Step 1: Drop the problematic service role policy
DROP POLICY IF EXISTS "Service role full access to notification_preferences" ON notification_preferences;

-- Step 2: Verify remaining policies are correct
-- Users should be able to:
-- - SELECT their own preferences
-- - INSERT their own preferences  
-- - UPDATE their own preferences

-- Check if policies exist, if not create them
DO $$
BEGIN
  -- Create SELECT policy if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_preferences' 
    AND policyname = 'Users can view own notification preferences'
  ) THEN
    CREATE POLICY "Users can view own notification preferences" 
    ON notification_preferences FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;

  -- Create INSERT policy if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_preferences' 
    AND policyname = 'Users can insert own notification preferences'
  ) THEN
    CREATE POLICY "Users can insert own notification preferences" 
    ON notification_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Create UPDATE policy if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_preferences' 
    AND policyname = 'Users can update own notification preferences'
  ) THEN
    CREATE POLICY "Users can update own notification preferences" 
    ON notification_preferences FOR UPDATE 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Step 3: Verify RLS is enabled
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'notification_preferences';
