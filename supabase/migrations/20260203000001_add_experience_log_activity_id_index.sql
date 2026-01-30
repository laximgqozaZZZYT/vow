-- ============================================================================
-- Migration: Add activity_id index to experience_log table
-- Purpose: Speed up duplicate checking for XP Recovery feature
-- Requirements: 2.1 (重複付与防止)
-- ============================================================================

-- Add index on activity_id for faster duplicate checking during XP recovery
-- This index enables efficient lookups when checking if an activity has already
-- been processed for experience points
-- Note: Using IF NOT EXISTS to ensure idempotency (similar index may already exist)
CREATE INDEX IF NOT EXISTS idx_experience_log_activity_id 
  ON experience_log(activity_id) 
  WHERE activity_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_experience_log_activity_id IS 'Index for fast duplicate checking during XP recovery - validates if activity already has XP awarded';
