-- Add cumulative_workload column to activities table
-- This column stores the running total of workload for a habit up to this activity
-- 
-- Column definitions:
-- - amount: workload increment (増分)
-- - prev_count: daily count before this activity (増分前の日次累計Workload)
-- - new_count: daily count after this activity (増分後の日次累計Workload)
-- - cumulative_workload: total workload from habit creation to this activity (累計Workload)

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS cumulative_workload NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN activities.cumulative_workload IS 'Running total of workload for the habit from creation to this activity';
COMMENT ON COLUMN activities.amount IS 'Workload increment for this activity';
COMMENT ON COLUMN activities.prev_count IS 'Daily count before this activity';
COMMENT ON COLUMN activities.new_count IS 'Daily count after this activity';
