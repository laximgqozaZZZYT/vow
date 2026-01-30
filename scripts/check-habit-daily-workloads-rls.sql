-- Check habit_daily_workloads table and RLS policies

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'habit_daily_workloads'
) as table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'habit_daily_workloads'
ORDER BY ordinal_position;

-- 3. Check RLS status
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'habit_daily_workloads';

-- 4. Check existing policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'habit_daily_workloads';

-- 5. Check data count
SELECT COUNT(*) as total_rows FROM habit_daily_workloads;

-- 6. Sample data
SELECT * FROM habit_daily_workloads LIMIT 5;
