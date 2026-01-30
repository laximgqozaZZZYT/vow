-- XP Recovery Job Types Migration
-- Requirements 7.1, 7.2: Add job types for XP recovery processing
-- 
-- This migration adds new job types to the job_execution_log table:
-- - xp_recovery: For batch XP recovery processing (all users)
-- - xp_recovery_single: For single user XP recovery processing

-- ============================================================================
-- 1. Update job_execution_log constraint to add XP recovery job types
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE job_execution_log DROP CONSTRAINT IF EXISTS job_execution_log_job_name_valid;

-- Add the updated constraint with new job types
ALTER TABLE job_execution_log ADD CONSTRAINT job_execution_log_job_name_valid
  CHECK (job_name IN (
    'level_up_detection',
    'level_down_detection',
    'monthly_quota_reset',
    'combined_level_detection',
    'xp_recovery',           -- 新規追加: 全ユーザーXPリカバリー
    'xp_recovery_single'     -- 新規追加: 単一ユーザーXPリカバリー
  ));

-- Update the comment to reflect new job types
COMMENT ON COLUMN job_execution_log.job_name IS 'Name of the scheduled job: level_up_detection, level_down_detection, monthly_quota_reset, combined_level_detection, xp_recovery, xp_recovery_single';
