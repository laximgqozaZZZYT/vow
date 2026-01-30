-- ============================================================================
-- Add Rebalancing Columns to Existing Tables
-- ============================================================================
-- This migration adds new columns to user_levels and habits tables to support
-- the level system rebalancing feature.
--
-- Changes to user_levels:
-- - formula_version: Tracks which formula version is being used
-- - is_migrated: Flag indicating if user has been migrated to new system
-- - migration_date: When the migration occurred
-- - pioneer_badge_awarded: Flag for Pioneer Badge recognition
--
-- Changes to habits:
-- - needs_recalibration: Flag for THLI-24 recalibration
-- - recalibrated_at: When recalibration occurred
-- - old_level_assessment_data: Preserved original assessment data
--
-- Requirements: 6.1, 6.7
-- ============================================================================

-- ============================================================================
-- PART 1: Add Columns to user_levels Table
-- Requirements: 6.1, 6.7
-- ============================================================================

-- Add formula_version column to track which calculation formula is being used
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS formula_version TEXT DEFAULT 'v1.0';

-- Add is_migrated flag to indicate if user has been migrated to new level system
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS is_migrated BOOLEAN DEFAULT false;

-- Add migration_date to record when the migration occurred
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS migration_date TIMESTAMPTZ;

-- Add pioneer_badge_awarded flag for users who reached Lv.100+ before rebalancing
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS pioneer_badge_awarded BOOLEAN DEFAULT false;

-- Create index for efficient querying of migrated users
CREATE INDEX IF NOT EXISTS idx_user_levels_migrated ON user_levels(is_migrated);

-- Add comments for documentation
COMMENT ON COLUMN user_levels.formula_version IS '使用中の計算式バージョン';
COMMENT ON COLUMN user_levels.is_migrated IS 'リバランス移行済みフラグ';
COMMENT ON COLUMN user_levels.migration_date IS '移行日時';
COMMENT ON COLUMN user_levels.pioneer_badge_awarded IS 'Pioneer Badge授与済みフラグ';

-- ============================================================================
-- PART 2: Add Columns to habits Table
-- Requirements: 6.1, 6.7
-- ============================================================================

-- Add needs_recalibration flag to indicate if habit needs THLI-24 recalibration
ALTER TABLE habits ADD COLUMN IF NOT EXISTS needs_recalibration BOOLEAN DEFAULT false;

-- Add recalibrated_at to record when recalibration occurred
ALTER TABLE habits ADD COLUMN IF NOT EXISTS recalibrated_at TIMESTAMPTZ;

-- Add old_level_assessment_data to preserve original assessment data for comparison
ALTER TABLE habits ADD COLUMN IF NOT EXISTS old_level_assessment_data JSONB;

-- Create partial index for efficient querying of habits needing recalibration
CREATE INDEX IF NOT EXISTS idx_habits_recalibration ON habits(needs_recalibration) WHERE needs_recalibration = true;

-- Add comments for documentation
COMMENT ON COLUMN habits.needs_recalibration IS 'THLI-24再評価が必要フラグ';
COMMENT ON COLUMN habits.recalibrated_at IS '再評価日時';
COMMENT ON COLUMN habits.old_level_assessment_data IS '再評価前の評価データ（比較用）';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Columns added to user_levels:
-- - formula_version (TEXT DEFAULT 'v1.0')
-- - is_migrated (BOOLEAN DEFAULT false)
-- - migration_date (TIMESTAMPTZ)
-- - pioneer_badge_awarded (BOOLEAN DEFAULT false)
--
-- Indexes created on user_levels:
-- - idx_user_levels_migrated (is_migrated)
--
-- Columns added to habits:
-- - needs_recalibration (BOOLEAN DEFAULT false)
-- - recalibrated_at (TIMESTAMPTZ)
-- - old_level_assessment_data (JSONB)
--
-- Indexes created on habits:
-- - idx_habits_recalibration (partial index on needs_recalibration = true)
--
-- ============================================================================
