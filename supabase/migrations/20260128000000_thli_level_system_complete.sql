-- ============================================================================
-- THLI-24 Level System Complete Migration
-- ============================================================================
-- This migration creates all tables and functions needed for the 
-- Habit and Goal Level System with THLI-24 assessment framework.
--
-- Tables created:
-- 1. level_history - Tracks level changes for habits
-- 2. thli_assessment_quotas - Manages assessment quotas per user
-- 3. job_execution_log - Logs scheduled job executions
-- 4. failed_assessments - Stores failed assessment state for resumption
-- 5. level_suggestions - Stores level-up/level-down suggestions
-- 6. thli_validation_log - Logs cross-framework validation results
--
-- Also adds columns to existing habits and goals tables.
-- ============================================================================

-- ============================================================================
-- PART 1: Add Level Columns to Habits Table
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
-- ============================================================================

ALTER TABLE habits
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_tier TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_assessed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_assessment_raw JSONB DEFAULT NULL;

-- Add constraint for level_tier values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habits_level_tier_check'
  ) THEN
    ALTER TABLE habits ADD CONSTRAINT habits_level_tier_check
      CHECK (level_tier IS NULL OR level_tier IN ('beginner', 'intermediate', 'advanced', 'expert'));
  END IF;
END $$;

-- Add constraint for level range (0-199)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habits_level_range_check'
  ) THEN
    ALTER TABLE habits ADD CONSTRAINT habits_level_range_check
      CHECK (level IS NULL OR (level >= 0 AND level <= 199));
  END IF;
END $$;

-- Indexes for habits level columns
CREATE INDEX IF NOT EXISTS idx_habits_level ON habits(level);
CREATE INDEX IF NOT EXISTS idx_habits_level_tier ON habits(level_tier);
CREATE INDEX IF NOT EXISTS idx_habits_level_assessed ON habits(level_assessed_at);

-- Comments
COMMENT ON COLUMN habits.level IS 'THLI-24 level (0-199 scale)';
COMMENT ON COLUMN habits.level_tier IS 'Level tier: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN habits.level_assessed_at IS 'Timestamp of last level assessment';
COMMENT ON COLUMN habits.level_assessment_raw IS 'Full THLI-24 assessment data including all 24 variables, ICI, AB_used, O/E/C estimates';

-- ============================================================================
-- PART 2: Add Level Columns to Goals Table
-- Requirements: 1.6
-- ============================================================================

ALTER TABLE goals
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_tier TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS level_assessed_at TIMESTAMPTZ DEFAULT NULL;

-- Add constraint for goals level_tier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'goals_level_tier_check'
  ) THEN
    ALTER TABLE goals ADD CONSTRAINT goals_level_tier_check
      CHECK (level_tier IS NULL OR level_tier IN ('beginner', 'intermediate', 'advanced', 'expert'));
  END IF;
END $$;

-- Add constraint for goals level range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'goals_level_range_check'
  ) THEN
    ALTER TABLE goals ADD CONSTRAINT goals_level_range_check
      CHECK (level IS NULL OR (level >= 0 AND level <= 199));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goals_level ON goals(level);

COMMENT ON COLUMN goals.level IS 'Aggregated level from child habits (MAX of child levels)';


-- ============================================================================
-- PART 3: Create Level History Table
-- Requirements: 1.5, 1.7
-- ============================================================================

CREATE TABLE IF NOT EXISTS level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_level INTEGER,
  new_level INTEGER NOT NULL,
  change_reason TEXT NOT NULL,
  assessment_raw JSONB,
  workload_delta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraint for change_reason values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'level_history_change_reason_check'
  ) THEN
    ALTER TABLE level_history ADD CONSTRAINT level_history_change_reason_check
      CHECK (change_reason IN (
        'initial_assessment',
        're_assessment', 
        'level_up_progression',
        'level_down_baby_step_lv50',
        'level_down_baby_step_lv10',
        'manual_adjustment'
      ));
  END IF;
END $$;

-- Indexes for level_history
CREATE INDEX IF NOT EXISTS idx_level_history_habit_id ON level_history(habit_id);
CREATE INDEX IF NOT EXISTS idx_level_history_user_id ON level_history(user_id);
CREATE INDEX IF NOT EXISTS idx_level_history_created_at ON level_history(created_at DESC);

-- Enable RLS on level_history
ALTER TABLE level_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for level_history
DROP POLICY IF EXISTS "Users can view their own level history" ON level_history;
CREATE POLICY "Users can view their own level history"
  ON level_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own level history" ON level_history;
CREATE POLICY "Users can insert their own level history"
  ON level_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage level history" ON level_history;
CREATE POLICY "Service can manage level history"
  ON level_history FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE level_history IS 'Tracks level changes for habits using THLI-24 assessment system';
COMMENT ON COLUMN level_history.change_reason IS 'Reason for level change: initial_assessment, re_assessment, level_up_progression, level_down_baby_step_lv50, level_down_baby_step_lv10, manual_adjustment';
COMMENT ON COLUMN level_history.workload_delta IS 'JSON object containing workload changes: {workloadPerCount: {old, new}, frequency: {old, new}, duration: {old, new}}';

-- ============================================================================
-- PART 4: Create THLI Assessment Quotas Table
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
-- ============================================================================

CREATE TABLE IF NOT EXISTS thli_assessment_quotas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL DEFAULT 'thli_assessments',
  quota_used INTEGER NOT NULL DEFAULT 0,
  quota_limit INTEGER NOT NULL DEFAULT 10,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT thli_assessment_quotas_user_period_unique 
    UNIQUE (user_id, period_start)
);

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thli_assessment_quotas_used_non_negative'
  ) THEN
    ALTER TABLE thli_assessment_quotas ADD CONSTRAINT thli_assessment_quotas_used_non_negative
      CHECK (quota_used >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thli_assessment_quotas_limit_valid'
  ) THEN
    ALTER TABLE thli_assessment_quotas ADD CONSTRAINT thli_assessment_quotas_limit_valid
      CHECK (quota_limit = -1 OR quota_limit > 0);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thli_quotas_user_id ON thli_assessment_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_thli_quotas_period ON thli_assessment_quotas(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_thli_quotas_user_period ON thli_assessment_quotas(user_id, period_start DESC);

-- Enable RLS
ALTER TABLE thli_assessment_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own thli quota" ON thli_assessment_quotas;
CREATE POLICY "Users can view own thli quota" ON thli_assessment_quotas
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage thli quotas" ON thli_assessment_quotas;
CREATE POLICY "Service can manage thli quotas" ON thli_assessment_quotas
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE thli_assessment_quotas IS 'Manages THLI-24 assessment quotas. Free users: 10/month, Premium: unlimited (-1)';
COMMENT ON COLUMN thli_assessment_quotas.quota_limit IS 'Maximum assessments allowed. -1 indicates unlimited (premium users)';


-- ============================================================================
-- PART 5: Create Level Suggestions Table
-- Requirements: 17.4, 17.5
-- ============================================================================

CREATE TABLE IF NOT EXISTS level_suggestions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  current_level INTEGER NOT NULL,
  target_level INTEGER NOT NULL,
  proposed_changes JSONB NOT NULL,
  reason TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'level_suggestions_type_check'
  ) THEN
    ALTER TABLE level_suggestions ADD CONSTRAINT level_suggestions_type_check
      CHECK (suggestion_type IN ('level_up', 'level_down'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'level_suggestions_status_check'
  ) THEN
    ALTER TABLE level_suggestions ADD CONSTRAINT level_suggestions_status_check
      CHECK (status IN ('pending', 'accepted', 'dismissed'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_level_suggestions_user ON level_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_habit ON level_suggestions(habit_id);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_detected ON level_suggestions(detected_at DESC);

-- Enable RLS
ALTER TABLE level_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own level suggestions" ON level_suggestions;
CREATE POLICY "Users can view own level suggestions" ON level_suggestions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own level suggestions" ON level_suggestions;
CREATE POLICY "Users can update own level suggestions" ON level_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage level suggestions" ON level_suggestions;
CREATE POLICY "Service can manage level suggestions" ON level_suggestions
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE level_suggestions IS 'Stores detected level-up and level-down suggestions from scheduled jobs';

-- ============================================================================
-- PART 6: Create THLI Validation Log Table
-- Requirements: 12.4
-- ============================================================================

CREATE TABLE IF NOT EXISTS thli_validation_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thli_score INTEGER NOT NULL,
  tlx_score INTEGER,
  srbai_score INTEGER,
  comb_score INTEGER,
  gate_status TEXT NOT NULL,
  discrepancy_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thli_validation_log_gate_status_check'
  ) THEN
    ALTER TABLE thli_validation_log ADD CONSTRAINT thli_validation_log_gate_status_check
      CHECK (gate_status IN ('pass', 'fail'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thli_validation_habit ON thli_validation_log(habit_id);
CREATE INDEX IF NOT EXISTS idx_thli_validation_gate ON thli_validation_log(gate_status);
CREATE INDEX IF NOT EXISTS idx_thli_validation_created ON thli_validation_log(created_at DESC);

-- Enable RLS
ALTER TABLE thli_validation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own validation logs" ON thli_validation_log;
CREATE POLICY "Users can view own validation logs" ON thli_validation_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage validation logs" ON thli_validation_log;
CREATE POLICY "Service can manage validation logs" ON thli_validation_log
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE thli_validation_log IS 'Logs cross-framework validation results (NASA-TLX, SRBAI, COM-B) for quality monitoring';


-- ============================================================================
-- PART 7: Create Job Execution Log Table
-- Requirements: 17.7
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_execution_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  habits_processed INTEGER DEFAULT 0,
  suggestions_created INTEGER DEFAULT 0,
  quotas_reset INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_execution_log_status_check'
  ) THEN
    ALTER TABLE job_execution_log ADD CONSTRAINT job_execution_log_status_check
      CHECK (status IN ('running', 'completed', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_execution_log_job_name_valid'
  ) THEN
    ALTER TABLE job_execution_log ADD CONSTRAINT job_execution_log_job_name_valid
      CHECK (job_name IN (
        'level_up_detection',
        'level_down_detection',
        'monthly_quota_reset',
        'combined_level_detection'
      ));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_execution_log_job_name ON job_execution_log(job_name);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_started_at ON job_execution_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_status ON job_execution_log(status);

-- Enable RLS
ALTER TABLE job_execution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage job execution logs" ON job_execution_log;
CREATE POLICY "Service can manage job execution logs" ON job_execution_log
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admin can view job execution logs" ON job_execution_log;
CREATE POLICY "Admin can view job execution logs" ON job_execution_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE job_execution_log IS 'Logs all scheduled job executions for monitoring and debugging';

-- ============================================================================
-- PART 8: Create Failed Assessments Table
-- Requirements: 18.2, 18.7
-- ============================================================================

CREATE TABLE IF NOT EXISTS failed_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  gathered_facts JSONB NOT NULL DEFAULT '{}',
  current_step TEXT NOT NULL,
  conversation_history JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resumption_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'failed',
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'failed_assessments_step_check'
  ) THEN
    ALTER TABLE failed_assessments ADD CONSTRAINT failed_assessments_step_check
      CHECK (current_step IN ('audit', 'score', 'validation'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'failed_assessments_status_check'
  ) THEN
    ALTER TABLE failed_assessments ADD CONSTRAINT failed_assessments_status_check
      CHECK (status IN ('failed', 'resumed', 'completed', 'expired'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_failed_assessments_user ON failed_assessments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_habit ON failed_assessments(habit_id);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_token ON failed_assessments(resumption_token);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_expires ON failed_assessments(expires_at);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_status ON failed_assessments(status);

-- Enable RLS
ALTER TABLE failed_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access own failed assessments" ON failed_assessments;
CREATE POLICY "Users can access own failed assessments" ON failed_assessments
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can manage failed assessments" ON failed_assessments;
CREATE POLICY "Service can manage failed assessments" ON failed_assessments
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE failed_assessments IS 'Stores conversation state when THLI-24 assessments fail, enabling resumption';
COMMENT ON COLUMN failed_assessments.resumption_token IS 'Unique token for resuming the assessment (fa_xxx format)';
COMMENT ON COLUMN failed_assessments.expires_at IS 'Resumption token expires 7 days after failure';


-- ============================================================================
-- PART 9: Helper Functions
-- ============================================================================

-- Function to get current month period
CREATE OR REPLACE FUNCTION get_current_month_period()
RETURNS TABLE (period_start TIMESTAMPTZ, period_end TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT 
    date_trunc('month', NOW())::TIMESTAMPTZ AS period_start,
    (date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second')::TIMESTAMPTZ AS period_end;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_month_period() IS 'Returns the start and end timestamps for the current month period';

-- Function to initialize quota for new user
CREATE OR REPLACE FUNCTION initialize_thli_quota(
  p_user_id UUID,
  p_is_premium BOOLEAN DEFAULT FALSE
)
RETURNS thli_assessment_quotas AS $$
DECLARE
  v_quota_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_result thli_assessment_quotas;
BEGIN
  IF p_is_premium THEN
    v_quota_limit := -1;
  ELSE
    v_quota_limit := 10;
  END IF;
  
  SELECT * INTO v_period_start, v_period_end FROM get_current_month_period();
  
  INSERT INTO thli_assessment_quotas (
    user_id, quota_type, quota_used, quota_limit, period_start, period_end
  ) VALUES (
    p_user_id, 'thli_assessments', 0, v_quota_limit, v_period_start, v_period_end
  )
  ON CONFLICT (user_id, period_start) 
  DO UPDATE SET quota_limit = v_quota_limit, updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_thli_quota(UUID, BOOLEAN) IS 'Initializes THLI assessment quota. Free: 10/month, Premium: unlimited';

-- Function to generate resumption token
CREATE OR REPLACE FUNCTION generate_resumption_token()
RETURNS TEXT AS $$
BEGIN
  RETURN 'fa_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_resumption_token() IS 'Generates a unique resumption token for failed assessments';

-- Function to cleanup expired failed assessments
CREATE OR REPLACE FUNCTION cleanup_expired_failed_assessments()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE failed_assessments
  SET status = 'expired'
  WHERE status = 'failed'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_failed_assessments() IS 'Marks expired failed assessments as expired';

-- Function to calculate level tier from level value
CREATE OR REPLACE FUNCTION calculate_level_tier(p_level INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF p_level IS NULL THEN
    RETURN NULL;
  ELSIF p_level >= 0 AND p_level <= 49 THEN
    RETURN 'beginner';
  ELSIF p_level >= 50 AND p_level <= 99 THEN
    RETURN 'intermediate';
  ELSIF p_level >= 100 AND p_level <= 149 THEN
    RETURN 'advanced';
  ELSIF p_level >= 150 AND p_level <= 199 THEN
    RETURN 'expert';
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_level_tier(INTEGER) IS 'Calculates level tier from level value: beginner(0-49), intermediate(50-99), advanced(100-149), expert(150-199)';

-- Trigger to auto-update level_tier when level changes
CREATE OR REPLACE FUNCTION update_habit_level_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level_tier := calculate_level_tier(NEW.level);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_habit_level_tier ON habits;
CREATE TRIGGER trigger_update_habit_level_tier
  BEFORE INSERT OR UPDATE OF level ON habits
  FOR EACH ROW
  EXECUTE FUNCTION update_habit_level_tier();

-- Trigger to auto-update level_tier for goals
DROP TRIGGER IF EXISTS trigger_update_goal_level_tier ON goals;
CREATE TRIGGER trigger_update_goal_level_tier
  BEFORE INSERT OR UPDATE OF level ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_habit_level_tier();

-- Trigger to update updated_at on thli_assessment_quotas
CREATE OR REPLACE FUNCTION update_thli_quota_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thli_quota_updated_at ON thli_assessment_quotas;
CREATE TRIGGER trigger_update_thli_quota_updated_at
  BEFORE UPDATE ON thli_assessment_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_thli_quota_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Tables created:
-- - level_history
-- - thli_assessment_quotas
-- - level_suggestions
-- - thli_validation_log
-- - job_execution_log
-- - failed_assessments
--
-- Columns added to habits:
-- - level (INTEGER, 0-199)
-- - level_tier (TEXT: beginner/intermediate/advanced/expert)
-- - level_assessed_at (TIMESTAMPTZ)
-- - level_assessment_raw (JSONB)
--
-- Columns added to goals:
-- - level (INTEGER, 0-199)
-- - level_tier (TEXT)
-- - level_assessed_at (TIMESTAMPTZ)
--
-- Functions created:
-- - get_current_month_period()
-- - initialize_thli_quota(UUID, BOOLEAN)
-- - generate_resumption_token()
-- - cleanup_expired_failed_assessments()
-- - calculate_level_tier(INTEGER)
--
-- ============================================================================
