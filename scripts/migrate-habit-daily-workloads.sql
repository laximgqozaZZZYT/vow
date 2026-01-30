-- Migration: Populate habit_daily_workloads from existing activities
-- Uses INNER JOIN to only include activities with valid (existing) habits

-- Step 1: Clear any existing data (if re-running)
TRUNCATE TABLE habit_daily_workloads;

-- Step 2: Insert aggregated daily workloads from activities
-- Only includes activities where the habit still exists (INNER JOIN)
INSERT INTO habit_daily_workloads (habit_id, date, workload, owner_type, owner_id)
SELECT 
  a.habit_id,
  DATE(a.timestamp AT TIME ZONE 'UTC') as date,
  SUM(COALESCE(a.amount, 1)) as workload,
  h.owner_type,
  h.owner_id
FROM activities a
INNER JOIN habits h ON a.habit_id = h.id  -- Only valid habits
WHERE a.kind = 'complete'
GROUP BY a.habit_id, DATE(a.timestamp AT TIME ZONE 'UTC'), h.owner_type, h.owner_id
ON CONFLICT (habit_id, date) 
DO UPDATE SET workload = EXCLUDED.workload;

-- Step 3: Verify the migration
SELECT 
  'habit_daily_workloads' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT habit_id) as unique_habits,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM habit_daily_workloads;
