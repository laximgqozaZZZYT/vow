-- Migration: Add habit_daily_workloads table for workload tracking
-- 
-- Creates a new table to track daily workloads per habit.
-- This replaces the cumulative columns on habits table.
--
-- Table: habit_daily_workloads
-- - habit_id: Reference to the habit
-- - date: The date of the workload
-- - workload: Total workload for that day
-- - owner_type, owner_id: For RLS

-- ============================================================================
-- Step 1: Create habit_daily_workloads table
-- ============================================================================

CREATE TABLE IF NOT EXISTS habit_daily_workloads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  workload NUMERIC NOT NULL DEFAULT 0,
  owner_type TEXT,
  owner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);

-- Add comments for documentation
COMMENT ON TABLE habit_daily_workloads IS 'Daily workload tracking per habit';
COMMENT ON COLUMN habit_daily_workloads.habit_id IS 'Reference to the habit';
COMMENT ON COLUMN habit_daily_workloads.date IS 'The date of the workload';
COMMENT ON COLUMN habit_daily_workloads.workload IS 'Total workload completed on this date';

-- ============================================================================
-- Step 2: Enable RLS
-- ============================================================================

ALTER TABLE habit_daily_workloads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own habit_daily_workloads"
  ON habit_daily_workloads FOR SELECT
  USING (owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "Users can insert their own habit_daily_workloads"
  ON habit_daily_workloads FOR INSERT
  WITH CHECK (owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "Users can update their own habit_daily_workloads"
  ON habit_daily_workloads FOR UPDATE
  USING (owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "Users can delete their own habit_daily_workloads"
  ON habit_daily_workloads FOR DELETE
  USING (owner_type = 'user' AND owner_id = auth.uid()::text);

-- ============================================================================
-- Step 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_habit_daily_workloads_habit_id 
  ON habit_daily_workloads(habit_id);

CREATE INDEX IF NOT EXISTS idx_habit_daily_workloads_date 
  ON habit_daily_workloads(date);

CREATE INDEX IF NOT EXISTS idx_habit_daily_workloads_owner 
  ON habit_daily_workloads(owner_type, owner_id);

-- ============================================================================
-- Step 4: Migrate existing data from activities
-- ============================================================================

INSERT INTO habit_daily_workloads (habit_id, date, workload, owner_type, owner_id)
SELECT 
  a.habit_id,
  DATE(a.timestamp AT TIME ZONE 'UTC') as date,
  SUM(COALESCE(a.amount, 1)) as workload,
  h.owner_type,
  h.owner_id
FROM activities a
INNER JOIN habits h ON a.habit_id = h.id
WHERE a.kind = 'complete'
GROUP BY a.habit_id, DATE(a.timestamp AT TIME ZONE 'UTC'), h.owner_type, h.owner_id
ON CONFLICT (habit_id, date) 
DO UPDATE SET workload = EXCLUDED.workload;

-- ============================================================================
-- Step 5: Remove cumulative columns from habits table (if they exist)
-- ============================================================================

ALTER TABLE habits
DROP COLUMN IF EXISTS cumulative_workload_daily,
DROP COLUMN IF EXISTS cumulative_workload_weekly,
DROP COLUMN IF EXISTS cumulative_workload_monthly;
