-- Fix workload column naming and add workload_total_end
-- Current state (incorrect):
--   workload_total contains "Load per Count" values
--   workload_per_count contains "Load Total(Day)" values
-- Target state (correct):
--   workload_per_count should contain "Load per Count" values
--   workload_total should contain "Load Total(Day)" values
--   workload_total_end should contain "Load Total(End)" values (new)

-- Step 1: Add temporary column to hold workload_total values
ALTER TABLE habits ADD COLUMN IF NOT EXISTS workload_total_temp INTEGER;

-- Step 2: Copy current data to temp column
UPDATE habits SET workload_total_temp = workload_total WHERE workload_total IS NOT NULL;

-- Step 3: Swap the values
-- Move workload_per_count (which has Load Total(Day)) to workload_total
UPDATE habits SET workload_total = workload_per_count WHERE workload_per_count IS NOT NULL;

-- Move workload_total_temp (which has Load per Count) to workload_per_count
UPDATE habits SET workload_per_count = workload_total_temp WHERE workload_total_temp IS NOT NULL;

-- Step 4: Drop temporary column
ALTER TABLE habits DROP COLUMN IF EXISTS workload_total_temp;

-- Step 5: Add the new workload_total_end column
ALTER TABLE habits ADD COLUMN IF NOT EXISTS workload_total_end INTEGER;

-- Add comments to describe the columns
COMMENT ON COLUMN habits.workload_per_count IS 'Workload amount per single count/set (e.g., 1 hour per session)';
COMMENT ON COLUMN habits.workload_total IS 'Target total workload per day (e.g., 8 hours per day)';
COMMENT ON COLUMN habits.workload_total_end IS 'Optional target total workload to reach by the end (used for estimating days to completion)';
