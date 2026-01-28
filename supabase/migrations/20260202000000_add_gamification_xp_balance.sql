-- ============================================================================
-- Gamification XP Balance Migration
-- ============================================================================
-- This migration adds support for:
-- 1. Behavioral science-based XP multiplier system
-- 2. User level vs habit level mismatch detection
-- 3. Level mismatch logging and tracking
--
-- Requirements: 1.1-1.9, 2.1-2.8, 3.6, 6.4, 7.5
-- ============================================================================

-- ============================================================================
-- PART 1: Add XP Multiplier Columns to experience_log Table
-- Requirements: 6.4
-- ============================================================================

ALTER TABLE experience_log
ADD COLUMN IF NOT EXISTS completion_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS applied_multiplier DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS multiplier_tier VARCHAR(20),
ADD COLUMN IF NOT EXISTS multiplier_reason VARCHAR(50);

-- Add constraint for multiplier_tier values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'experience_log_multiplier_tier_check'
  ) THEN
    ALTER TABLE experience_log ADD CONSTRAINT experience_log_multiplier_tier_check
      CHECK (multiplier_tier IS NULL OR multiplier_tier IN (
        'minimal',      -- 0-49%: 0.3x
        'partial',      -- 50-79%: 0.6x
        'near',         -- 80-99%: 0.8x
        'optimal',      -- 100-120%: 1.0x
        'mild_over',    -- 121-150%: 0.9x
        'over'          -- 151%+: 0.7x
      ));
  END IF;
END $$;

-- Add constraint for multiplier_reason values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'experience_log_multiplier_reason_check'
  ) THEN
    ALTER TABLE experience_log ADD CONSTRAINT experience_log_multiplier_reason_check
      CHECK (multiplier_reason IS NULL OR multiplier_reason IN (
        'minimal_effort',
        'partial_reinforcement',
        'near_completion',
        'plan_adherence',
        'mild_overachievement',
        'burnout_prevention'
      ));
  END IF;
END $$;

-- Comments for new columns
COMMENT ON COLUMN experience_log.completion_rate IS '達成率（0-500%）- (actual / target) * 100';
COMMENT ON COLUMN experience_log.applied_multiplier IS '適用された経験値倍率（0.3-1.0）';
COMMENT ON COLUMN experience_log.multiplier_tier IS '倍率ティア: minimal(0.3), partial(0.6), near(0.8), optimal(1.0), mild_over(0.9), over(0.7)';
COMMENT ON COLUMN experience_log.multiplier_reason IS '倍率の行動科学的理由: minimal_effort, partial_reinforcement, near_completion, plan_adherence, mild_overachievement, burnout_prevention';

-- Index for multiplier analysis
CREATE INDEX IF NOT EXISTS idx_experience_log_multiplier_tier ON experience_log(multiplier_tier);

-- ============================================================================
-- PART 2: Add Mismatch Acknowledgment Columns to habits Table
-- Requirements: 3.6
-- ============================================================================

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS mismatch_acknowledged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mismatch_acknowledged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_level_gap INTEGER;

-- Comments for mismatch columns
COMMENT ON COLUMN habits.mismatch_acknowledged IS 'ユーザーがレベルミスマッチを承認して習慣を作成したか';
COMMENT ON COLUMN habits.mismatch_acknowledged_at IS 'ミスマッチ承認日時';
COMMENT ON COLUMN habits.original_level_gap IS '作成時のレベルギャップ（習慣レベル - ユーザーレベル）';

-- Index for mismatch tracking
CREATE INDEX IF NOT EXISTS idx_habits_mismatch_acknowledged ON habits(mismatch_acknowledged) WHERE mismatch_acknowledged = TRUE;

-- ============================================================================
-- PART 3: Create level_mismatch_log Table
-- Requirements: 7.5
-- ============================================================================

CREATE TABLE IF NOT EXISTS level_mismatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_level INTEGER NOT NULL,
  habit_level INTEGER NOT NULL,
  level_gap INTEGER NOT NULL,
  severity VARCHAR(20) NOT NULL,
  action_taken VARCHAR(50),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint for severity values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'level_mismatch_log_severity_check'
  ) THEN
    ALTER TABLE level_mismatch_log ADD CONSTRAINT level_mismatch_log_severity_check
      CHECK (severity IN ('none', 'mild', 'moderate', 'severe'));
  END IF;
END $$;

-- Add constraint for action_taken values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'level_mismatch_log_action_check'
  ) THEN
    ALTER TABLE level_mismatch_log ADD CONSTRAINT level_mismatch_log_action_check
      CHECK (action_taken IS NULL OR action_taken IN (
        'proceeded',
        'baby_step_lv50',
        'baby_step_lv10',
        'cancelled',
        'ai_suggested_baby_step'
      ));
  END IF;
END $$;

-- Indexes for level_mismatch_log
CREATE INDEX IF NOT EXISTS idx_level_mismatch_log_user ON level_mismatch_log(user_id);
CREATE INDEX IF NOT EXISTS idx_level_mismatch_log_habit ON level_mismatch_log(habit_id);
CREATE INDEX IF NOT EXISTS idx_level_mismatch_log_detected ON level_mismatch_log(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_level_mismatch_log_severity ON level_mismatch_log(severity);

-- Enable RLS on level_mismatch_log
ALTER TABLE level_mismatch_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for level_mismatch_log
DROP POLICY IF EXISTS "Users can view their own mismatch logs" ON level_mismatch_log;
CREATE POLICY "Users can view their own mismatch logs"
  ON level_mismatch_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own mismatch logs" ON level_mismatch_log;
CREATE POLICY "Users can insert their own mismatch logs"
  ON level_mismatch_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage mismatch logs" ON level_mismatch_log;
CREATE POLICY "Service can manage mismatch logs"
  ON level_mismatch_log FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for level_mismatch_log
COMMENT ON TABLE level_mismatch_log IS 'ユーザーレベルと習慣レベルのミスマッチ検出履歴';
COMMENT ON COLUMN level_mismatch_log.user_level IS '検出時のユーザーレベル（0-199）';
COMMENT ON COLUMN level_mismatch_log.habit_level IS '習慣のTHLI-24レベル（0-199）';
COMMENT ON COLUMN level_mismatch_log.level_gap IS 'レベルギャップ（habit_level - user_level）';
COMMENT ON COLUMN level_mismatch_log.severity IS 'ミスマッチの深刻度: none(<50), mild(50-75), moderate(76-100), severe(>100)';
COMMENT ON COLUMN level_mismatch_log.action_taken IS 'ユーザーが取ったアクション: proceeded, baby_step_lv50, baby_step_lv10, cancelled, ai_suggested_baby_step';

-- ============================================================================
-- PART 4: Update job_execution_log constraint to include new job type
-- Requirements: 7.1
-- ============================================================================

-- Drop existing constraint and recreate with new job type
ALTER TABLE job_execution_log DROP CONSTRAINT IF EXISTS job_execution_log_job_name_valid;

ALTER TABLE job_execution_log ADD CONSTRAINT job_execution_log_job_name_valid
  CHECK (job_name IN (
    'level_up_detection',
    'level_down_detection',
    'monthly_quota_reset',
    'combined_level_detection',
    'level_mismatch_detection'  -- New job type for daily mismatch check
  ));

-- ============================================================================
-- PART 5: Helper Functions for XP Multiplier Calculation
-- ============================================================================

-- Function to calculate XP multiplier tier from completion rate
CREATE OR REPLACE FUNCTION calculate_xp_multiplier_tier(p_completion_rate DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF p_completion_rate IS NULL OR p_completion_rate < 0 THEN
    RETURN 'minimal';
  ELSIF p_completion_rate < 50 THEN
    RETURN 'minimal';
  ELSIF p_completion_rate < 80 THEN
    RETURN 'partial';
  ELSIF p_completion_rate < 100 THEN
    RETURN 'near';
  ELSIF p_completion_rate <= 120 THEN
    RETURN 'optimal';
  ELSIF p_completion_rate <= 150 THEN
    RETURN 'mild_over';
  ELSE
    RETURN 'over';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_xp_multiplier_tier(DECIMAL) IS 'Calculates XP multiplier tier from completion rate based on behavioral science principles';

-- Function to get XP multiplier value from tier
CREATE OR REPLACE FUNCTION get_xp_multiplier_value(p_tier VARCHAR(20))
RETURNS DECIMAL(3,2) AS $$
BEGIN
  CASE p_tier
    WHEN 'minimal' THEN RETURN 0.30;
    WHEN 'partial' THEN RETURN 0.60;
    WHEN 'near' THEN RETURN 0.80;
    WHEN 'optimal' THEN RETURN 1.00;
    WHEN 'mild_over' THEN RETURN 0.90;
    WHEN 'over' THEN RETURN 0.70;
    ELSE RETURN 1.00;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_xp_multiplier_value(VARCHAR) IS 'Returns XP multiplier value (0.3-1.0) for a given tier';

-- Function to get multiplier reason from tier
CREATE OR REPLACE FUNCTION get_xp_multiplier_reason(p_tier VARCHAR(20))
RETURNS VARCHAR(50) AS $$
BEGIN
  CASE p_tier
    WHEN 'minimal' THEN RETURN 'minimal_effort';
    WHEN 'partial' THEN RETURN 'partial_reinforcement';
    WHEN 'near' THEN RETURN 'near_completion';
    WHEN 'optimal' THEN RETURN 'plan_adherence';
    WHEN 'mild_over' THEN RETURN 'mild_overachievement';
    WHEN 'over' THEN RETURN 'burnout_prevention';
    ELSE RETURN 'plan_adherence';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_xp_multiplier_reason(VARCHAR) IS 'Returns behavioral science rationale for XP multiplier tier';

-- Function to calculate mismatch severity from level gap
CREATE OR REPLACE FUNCTION calculate_mismatch_severity(p_level_gap INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF p_level_gap IS NULL OR p_level_gap < 50 THEN
    RETURN 'none';
  ELSIF p_level_gap <= 75 THEN
    RETURN 'mild';
  ELSIF p_level_gap <= 100 THEN
    RETURN 'moderate';
  ELSE
    RETURN 'severe';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_mismatch_severity(INTEGER) IS 'Calculates mismatch severity from level gap: none(<50), mild(50-75), moderate(76-100), severe(>100)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Columns added to experience_log:
-- - completion_rate (DECIMAL 5,2)
-- - applied_multiplier (DECIMAL 3,2)
-- - multiplier_tier (VARCHAR 20)
-- - multiplier_reason (VARCHAR 50)
--
-- Columns added to habits:
-- - mismatch_acknowledged (BOOLEAN)
-- - mismatch_acknowledged_at (TIMESTAMPTZ)
-- - original_level_gap (INTEGER)
--
-- Tables created:
-- - level_mismatch_log
--
-- Functions created:
-- - calculate_xp_multiplier_tier(DECIMAL)
-- - get_xp_multiplier_value(VARCHAR)
-- - get_xp_multiplier_reason(VARCHAR)
-- - calculate_mismatch_severity(INTEGER)
--
-- ============================================================================
