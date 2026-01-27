-- Job Execution Log Migration
-- Requirement 17.7: Log all scheduled job executions
-- 
-- This table tracks execution of scheduled jobs for:
-- - Level-up detection (daily at 2 AM JST)
-- - Level-down detection (daily at 2 AM JST)
-- - Monthly quota reset (first day of each month)

-- ============================================================================
-- 1. Create Job Execution Log Table
-- Requirement 17.7: Log scheduled job executions
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_execution_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  habits_processed INTEGER DEFAULT 0,
  suggestions_created INTEGER DEFAULT 0,
  quotas_reset INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint for valid job names
ALTER TABLE job_execution_log ADD CONSTRAINT job_execution_log_job_name_valid
  CHECK (job_name IN (
    'level_up_detection',
    'level_down_detection',
    'monthly_quota_reset',
    'combined_level_detection'
  ));

-- Indexes for job_execution_log
CREATE INDEX IF NOT EXISTS idx_job_execution_log_job_name ON job_execution_log(job_name);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_started_at ON job_execution_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_status ON job_execution_log(status);

-- Comments for job_execution_log
COMMENT ON TABLE job_execution_log IS 'Logs all scheduled job executions for monitoring and debugging';
COMMENT ON COLUMN job_execution_log.job_name IS 'Name of the scheduled job: level_up_detection, level_down_detection, monthly_quota_reset, combined_level_detection';
COMMENT ON COLUMN job_execution_log.started_at IS 'Timestamp when the job started';
COMMENT ON COLUMN job_execution_log.completed_at IS 'Timestamp when the job completed (NULL if still running or failed)';
COMMENT ON COLUMN job_execution_log.status IS 'Job status: running, completed, or failed';
COMMENT ON COLUMN job_execution_log.habits_processed IS 'Number of habits processed during the job';
COMMENT ON COLUMN job_execution_log.suggestions_created IS 'Number of level suggestions created';
COMMENT ON COLUMN job_execution_log.quotas_reset IS 'Number of quotas reset (for monthly_quota_reset job)';
COMMENT ON COLUMN job_execution_log.errors IS 'JSON array of error messages encountered during execution';
COMMENT ON COLUMN job_execution_log.metadata IS 'Additional metadata about the job execution';

-- ============================================================================
-- 2. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on job_execution_log
ALTER TABLE job_execution_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access job execution logs
CREATE POLICY "Service can manage job execution logs" ON job_execution_log
  FOR ALL USING (auth.role() = 'service_role');

-- Admin users can view job execution logs (read-only)
CREATE POLICY "Admin can view job execution logs" ON job_execution_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

