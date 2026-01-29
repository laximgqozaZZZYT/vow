-- Fix RLS policies for habit_daily_workloads table
-- Run this in Supabase SQL Editor

-- First, check if the table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'habit_daily_workloads'
) AS table_exists;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own habit_daily_workloads" ON habit_daily_workloads;
DROP POLICY IF EXISTS "Users can insert their own habit_daily_workloads" ON habit_daily_workloads;
DROP POLICY IF EXISTS "Users can update their own habit_daily_workloads" ON habit_daily_workloads;
DROP POLICY IF EXISTS "Users can delete their own habit_daily_workloads" ON habit_daily_workloads;

-- Ensure RLS is enabled
ALTER TABLE habit_daily_workloads ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies
-- SELECT policy
CREATE POLICY "Users can view their own habit_daily_workloads"
  ON habit_daily_workloads FOR SELECT
  USING (owner_type = 'user' AND owner_id = auth.uid()::text);

-- INSERT policy
CREATE POLICY "Users can insert their own habit_daily_workloads"
  ON habit_daily_workloads FOR INSERT
  WITH CHECK (owner_type = 'user' AND owner_id = auth.uid()::text);

-- UPDATE policy
CREATE POLICY "Users can update their own habit_daily_workloads"
  ON habit_daily_workloads FOR UPDATE
  USING (owner_type = 'user' AND owner_id = auth.uid()::text)
  WITH CHECK (owner_type = 'user' AND owner_id = auth.uid()::text);

-- DELETE policy
CREATE POLICY "Users can delete their own habit_daily_workloads"
  ON habit_daily_workloads FOR DELETE
  USING (owner_type = 'user' AND owner_id = auth.uid()::text);

-- Verify policies
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
WHERE tablename = 'habit_daily_workloads';
