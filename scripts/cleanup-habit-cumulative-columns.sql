-- Cleanup: Remove cumulative workload columns from habits table
-- These are now stored in habit_daily_workloads table

ALTER TABLE habits
DROP COLUMN IF EXISTS cumulative_workload_daily,
DROP COLUMN IF EXISTS cumulative_workload_weekly,
DROP COLUMN IF EXISTS cumulative_workload_monthly;

-- Verify the columns are removed
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'habits'
  AND column_name LIKE 'cumulative%'
ORDER BY column_name;
