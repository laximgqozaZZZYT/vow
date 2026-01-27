-- Level System Migration for THLI-24 Habit Assessment
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7

-- ============================================================================
-- 1. Extend Habits Table with Level Fields
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
-- ============================================================================

-- Add level field (0-199 scale, NULL for pending assessment)
-- Requirement 1.1: Initialize to NULL when habit is created
-- Requirement 1.2: Store level as integer between 0 and 199
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level INTEGER;

-- Add level_tier field with constraint
-- Requirement 1.3: Automatically calculate tier based on level
-- beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level_tier TEXT 
  CHECK (level_tier IN ('beginner', 'intermediate', 'advanced', 'expert'));

-- Add level_assessment_data JSONB field
-- Requirement 1.4: Store THLI-24 audit results with all 24 variables, ICI, AB_used, prompt version
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level_assessment_data JSONB;

-- Add level_last_assessed_at timestamp
ALTER TABLE habits ADD COLUMN IF NOT EXISTS level_last_assessed_at TIMESTAMPTZ;

-- Add constraint to ensure level is within valid range (0-199)
ALTER TABLE habits ADD CONSTRAINT habits_level_range 
  CHECK (level IS NULL OR (level >= 0 AND level <= 199));

-- Add constraint to ensure level_tier matches level value
ALTER TABLE habits ADD CONSTRAINT habits_level_tier_consistency
  CHECK (
    (level IS NULL AND level_tier IS NULL) OR
    (level IS NOT NULL AND level_tier IS NOT NULL AND (
      (level >= 0 AND level <= 49 AND level_tier = 'beginner') OR
      (level >= 50 AND level <= 99 AND level_tier = 'intermediate') OR
      (level >= 100 AND level <= 149 AND level_tier = 'advanced') OR
      (level >= 150 AND level <= 199 AND level_tier = 'expert')
    ))
  );

-- Indexes for habits level fields
CREATE INDEX IF NOT EXISTS idx_habits_level ON habits(level);
CREATE INDEX IF NOT EXISTS idx_habits_level_tier ON habits(level_tier);
CREATE INDEX IF NOT EXISTS idx_habits_level_assessed ON habits(level_last_assessed_at);

-- Comments for habits level fields
COMMENT ON COLUMN habits.level IS 'THLI-24 level (0-199 scale). NULL indicates pending assessment.';
COMMENT ON COLUMN habits.level_tier IS 'Level tier: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN habits.level_assessment_data IS 'Full THLI-24 assessment data including all 24 variables, ICI, AB_used, O/E/C estimates, cross-framework scores';
COMMENT ON COLUMN habits.level_last_assessed_at IS 'Timestamp of the last THLI-24 assessment';

-- ============================================================================
-- 2. Extend Goals Table with Level Fields
-- Requirement 1.6: Add level fields to goals table
-- ============================================================================

-- Add level field (aggregated from child habits as MAX)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level INTEGER;

-- Add level_tier field with constraint
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level_tier TEXT 
  CHECK (level_tier IN ('beginner', 'intermediate', 'advanced', 'expert'));

-- Add level_last_assessed_at timestamp
ALTER TABLE goals ADD COLUMN IF NOT EXISTS level_last_assessed_at TIMESTAMPTZ;

-- Add constraint to ensure level is within valid range (0-199)
ALTER TABLE goals ADD CONSTRAINT goals_level_range 
  CHECK (level IS NULL OR (level >= 0 AND level <= 199));

-- Add constraint to ensure level_tier matches level value
ALTER TABLE goals ADD CONSTRAINT goals_level_tier_consistency
  CHECK (
    (level IS NULL AND level_tier IS NULL) OR
    (level IS NOT NULL AND level_tier IS NOT NULL AND (
      (level >= 0 AND level <= 49 AND level_tier = 'beginner') OR
      (level >= 50 AND level <= 99 AND level_tier = 'intermediate') OR
      (level >= 100 AND level <= 149 AND level_tier = 'advanced') OR
      (level >= 150 AND level <= 199 AND level_tier = 'expert')
    ))
  );

-- Indexes for goals level fields
CREATE INDEX IF NOT EXISTS idx_goals_level ON goals(level);

-- Comments for goals level fields
COMMENT ON COLUMN goals.level IS 'Aggregated level from child habits (MAX). NULL if no child habits have levels.';
COMMENT ON COLUMN goals.level_tier IS 'Level tier: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN goals.level_last_assessed_at IS 'Timestamp of the last level aggregation update';

-- ============================================================================
-- 3. Create Level History Table
-- Requirement 1.5, 1.7: Record level changes with timestamp, old_level, new_level, reason, workload_delta
-- ============================================================================

CREATE TABLE IF NOT EXISTS level_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('habit', 'goal')),
  entity_id TEXT NOT NULL,
  old_level INTEGER,
  new_level INTEGER NOT NULL,
  reason TEXT NOT NULL,
  workload_delta JSONB,
  assessed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint to ensure new_level is within valid range
ALTER TABLE level_history ADD CONSTRAINT level_history_new_level_range 
  CHECK (new_level >= 0 AND new_level <= 199);

-- Add constraint to ensure old_level is within valid range when not NULL
ALTER TABLE level_history ADD CONSTRAINT level_history_old_level_range 
  CHECK (old_level IS NULL OR (old_level >= 0 AND old_level <= 199));

-- Indexes for level_history
CREATE INDEX IF NOT EXISTS idx_level_history_entity ON level_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_level_history_assessed ON level_history(assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_level_history_reason ON level_history(reason);

-- Comments for level_history
COMMENT ON TABLE level_history IS 'Tracks all level changes for habits and goals';
COMMENT ON COLUMN level_history.entity_type IS 'Type of entity: habit or goal';
COMMENT ON COLUMN level_history.entity_id IS 'ID of the habit or goal';
COMMENT ON COLUMN level_history.old_level IS 'Previous level value (NULL for initial assessment)';
COMMENT ON COLUMN level_history.new_level IS 'New level value (0-199)';
COMMENT ON COLUMN level_history.reason IS 'Reason for level change: initial_assessment, re_assessment, level_up_progression, level_down_baby_step_lv50, level_down_baby_step_lv10';
COMMENT ON COLUMN level_history.workload_delta IS 'JSON object containing workload changes: {workloadPerCount: {old, new, changePercent}, frequency: {old, new}, duration: {old, new}}';
COMMENT ON COLUMN level_history.assessed_at IS 'Timestamp when the level change was assessed';

-- ============================================================================
-- 4. Create Level Suggestions Table
-- For storing detected level-up and level-down suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS level_suggestions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('level_up', 'level_down')),
  current_level INTEGER NOT NULL,
  target_level INTEGER NOT NULL,
  proposed_changes JSONB NOT NULL,
  reason TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints for level values
ALTER TABLE level_suggestions ADD CONSTRAINT level_suggestions_current_level_range 
  CHECK (current_level >= 0 AND current_level <= 199);

ALTER TABLE level_suggestions ADD CONSTRAINT level_suggestions_target_level_range 
  CHECK (target_level >= 0 AND target_level <= 199);

-- Indexes for level_suggestions
CREATE INDEX IF NOT EXISTS idx_level_suggestions_user ON level_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_habit ON level_suggestions(habit_id);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_detected ON level_suggestions(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_level_suggestions_status ON level_suggestions(status);

-- Comments for level_suggestions
COMMENT ON TABLE level_suggestions IS 'Stores detected level-up and level-down suggestions for habits';
COMMENT ON COLUMN level_suggestions.suggestion_type IS 'Type of suggestion: level_up or level_down';
COMMENT ON COLUMN level_suggestions.current_level IS 'Current level of the habit (0-199)';
COMMENT ON COLUMN level_suggestions.target_level IS 'Suggested target level (0-199)';
COMMENT ON COLUMN level_suggestions.proposed_changes IS 'JSON object containing proposed workload changes or baby step plans';
COMMENT ON COLUMN level_suggestions.reason IS 'Reason for the suggestion (e.g., high completion rate, low completion rate)';
COMMENT ON COLUMN level_suggestions.status IS 'Status of the suggestion: pending, accepted, or dismissed';
COMMENT ON COLUMN level_suggestions.responded_at IS 'Timestamp when user responded to the suggestion';

-- ============================================================================
-- 5. Create THLI Validation Log Table
-- Requirement 12.4: Log cross-framework validation results for quality monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS thli_validation_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thli_score INTEGER NOT NULL,
  tlx_score INTEGER,
  srbai_score INTEGER,
  comb_score INTEGER,
  gate_status TEXT NOT NULL CHECK (gate_status IN ('pass', 'fail')),
  discrepancy_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint for thli_score range
ALTER TABLE thli_validation_log ADD CONSTRAINT thli_validation_log_thli_score_range 
  CHECK (thli_score >= 0 AND thli_score <= 199);

-- Indexes for thli_validation_log
CREATE INDEX IF NOT EXISTS idx_thli_validation_habit ON thli_validation_log(habit_id);
CREATE INDEX IF NOT EXISTS idx_thli_validation_user ON thli_validation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_thli_validation_gate ON thli_validation_log(gate_status);
CREATE INDEX IF NOT EXISTS idx_thli_validation_created ON thli_validation_log(created_at DESC);

-- Comments for thli_validation_log
COMMENT ON TABLE thli_validation_log IS 'Logs cross-framework validation results for THLI-24 assessments';
COMMENT ON COLUMN thli_validation_log.thli_score IS 'THLI-24 score (0-199)';
COMMENT ON COLUMN thli_validation_log.tlx_score IS 'NASA-TLX score for cross-validation';
COMMENT ON COLUMN thli_validation_log.srbai_score IS 'SRBAI automaticity score for cross-validation';
COMMENT ON COLUMN thli_validation_log.comb_score IS 'COM-B framework score for cross-validation';
COMMENT ON COLUMN thli_validation_log.gate_status IS 'Validation gate status: pass if all scores within 20 points, fail otherwise';
COMMENT ON COLUMN thli_validation_log.discrepancy_details IS 'JSON object containing details about score discrepancies when gate fails';

-- ============================================================================
-- 6. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE level_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thli_validation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy for level_history
-- Users can access level history for their own habits/goals
CREATE POLICY "Users can access own level history" ON level_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM habits h 
      WHERE h.id = level_history.entity_id 
        AND level_history.entity_type = 'habit'
        AND h.owner_type = 'user' 
        AND h.owner_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM goals g 
      WHERE g.id = level_history.entity_id 
        AND level_history.entity_type = 'goal'
        AND g.owner_type = 'user' 
        AND g.owner_id = auth.uid()::text
    )
  );

-- Service role can manage all level history
CREATE POLICY "Service can manage level history" ON level_history
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policy for level_suggestions
-- Users can access their own level suggestions
CREATE POLICY "Users can access own level suggestions" ON level_suggestions
  FOR ALL USING (auth.uid() = user_id);

-- Service role can manage all level suggestions
CREATE POLICY "Service can manage level suggestions" ON level_suggestions
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policy for thli_validation_log
-- Users can view their own validation logs
CREATE POLICY "Users can view own validation logs" ON thli_validation_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all validation logs
CREATE POLICY "Service can manage validation logs" ON thli_validation_log
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 7. Helper Function for Level Tier Calculation
-- Requirement 1.3: Automatically calculate level_tier based on level value
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_level_tier(level_value INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF level_value IS NULL THEN
    RETURN NULL;
  ELSIF level_value >= 0 AND level_value <= 49 THEN
    RETURN 'beginner';
  ELSIF level_value >= 50 AND level_value <= 99 THEN
    RETURN 'intermediate';
  ELSIF level_value >= 100 AND level_value <= 149 THEN
    RETURN 'advanced';
  ELSIF level_value >= 150 AND level_value <= 199 THEN
    RETURN 'expert';
  ELSE
    RAISE EXCEPTION 'Invalid level value: %. Must be between 0 and 199.', level_value;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_level_tier(INTEGER) IS 'Calculates level tier from level value: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';

-- ============================================================================
-- 8. Trigger to Auto-Update level_tier When level Changes
-- Requirement 1.3: Automatically calculate and store level_tier
-- ============================================================================

CREATE OR REPLACE FUNCTION update_habit_level_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.level IS DISTINCT FROM OLD.level THEN
    NEW.level_tier := calculate_level_tier(NEW.level);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_goal_level_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.level IS DISTINCT FROM OLD.level THEN
    NEW.level_tier := calculate_level_tier(NEW.level);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_habit_level_tier ON habits;
DROP TRIGGER IF EXISTS trigger_update_goal_level_tier ON goals;

-- Create triggers
CREATE TRIGGER trigger_update_habit_level_tier
  BEFORE INSERT OR UPDATE OF level ON habits
  FOR EACH ROW
  EXECUTE FUNCTION update_habit_level_tier();

CREATE TRIGGER trigger_update_goal_level_tier
  BEFORE INSERT OR UPDATE OF level ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_level_tier();

COMMENT ON FUNCTION update_habit_level_tier() IS 'Trigger function to automatically update level_tier when level changes on habits';
COMMENT ON FUNCTION update_goal_level_tier() IS 'Trigger function to automatically update level_tier when level changes on goals';
