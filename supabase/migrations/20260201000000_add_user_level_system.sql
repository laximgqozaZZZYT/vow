-- ============================================================================
-- User Level System Migration
-- ============================================================================
-- This migration creates the user_levels table for tracking user growth and
-- expertise, separate from the THLI-24 habit difficulty assessment system.
--
-- The User Level System tracks:
-- - Overall user level (0-199)
-- - Habit continuity power (0-100)
-- - Resilience score (0-100)
-- - Total experience points
--
-- Requirements: 1.1, 1.5
-- ============================================================================

-- ============================================================================
-- PART 1: Create user_levels Table
-- Requirements: 1.1, 1.5
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_levels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_level INTEGER NOT NULL DEFAULT 0 CHECK (overall_level >= 0 AND overall_level <= 199),
  overall_tier TEXT NOT NULL DEFAULT 'beginner' CHECK (overall_tier IN ('beginner', 'intermediate', 'advanced', 'expert')),
  habit_continuity_power INTEGER NOT NULL DEFAULT 0 CHECK (habit_continuity_power >= 0 AND habit_continuity_power <= 100),
  resilience_score INTEGER NOT NULL DEFAULT 50 CHECK (resilience_score >= 0 AND resilience_score <= 100),
  total_experience_points BIGINT NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for user_levels
CREATE INDEX IF NOT EXISTS idx_user_levels_user ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_overall ON user_levels(overall_level DESC);

-- Comments for user_levels
COMMENT ON TABLE user_levels IS 'ユーザーの総合レベルと共通スキル指標を保存';
COMMENT ON COLUMN user_levels.overall_level IS '総合ユーザーレベル (0-199)';
COMMENT ON COLUMN user_levels.overall_tier IS 'レベルティア: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN user_levels.habit_continuity_power IS '習慣継続力 (0-100)';
COMMENT ON COLUMN user_levels.resilience_score IS 'レジリエンススコア (0-100)';
COMMENT ON COLUMN user_levels.total_experience_points IS '累積経験値';
COMMENT ON COLUMN user_levels.last_calculated_at IS '最後にレベルが計算された日時';

-- ============================================================================
-- PART 2: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on user_levels
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;

-- Users can view their own user level
DROP POLICY IF EXISTS "Users can view own user level" ON user_levels;
CREATE POLICY "Users can view own user level" ON user_levels
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own user level (for initialization)
DROP POLICY IF EXISTS "Users can insert own user level" ON user_levels;
CREATE POLICY "Users can insert own user level" ON user_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own user level
DROP POLICY IF EXISTS "Users can update own user level" ON user_levels;
CREATE POLICY "Users can update own user level" ON user_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage all user levels
DROP POLICY IF EXISTS "Service can manage user levels" ON user_levels;
CREATE POLICY "Service can manage user levels" ON user_levels
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 3: Trigger for Auto-Update overall_tier
-- Requirement 1.5: Automatically calculate overall_tier based on overall_level
-- ============================================================================

-- Function to calculate user level tier (reusing existing function if available)
CREATE OR REPLACE FUNCTION calculate_user_level_tier(level_value INTEGER)
RETURNS TEXT AS $
BEGIN
  IF level_value IS NULL THEN
    RETURN 'beginner';
  ELSIF level_value >= 0 AND level_value <= 49 THEN
    RETURN 'beginner';
  ELSIF level_value >= 50 AND level_value <= 99 THEN
    RETURN 'intermediate';
  ELSIF level_value >= 100 AND level_value <= 149 THEN
    RETURN 'advanced';
  ELSIF level_value >= 150 AND level_value <= 199 THEN
    RETURN 'expert';
  ELSE
    RETURN 'beginner'; -- Default for out-of-range values
  END IF;
END;
$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_user_level_tier(INTEGER) IS 'Calculates user level tier from level value: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';

-- Trigger function to auto-update overall_tier when overall_level changes
CREATE OR REPLACE FUNCTION update_user_level_tier()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.overall_level IS DISTINCT FROM OLD.overall_level OR TG_OP = 'INSERT' THEN
    NEW.overall_tier := calculate_user_level_tier(NEW.overall_level);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_level_tier() IS 'Trigger function to automatically update overall_tier when overall_level changes on user_levels';

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_user_level_tier ON user_levels;

-- Create trigger
CREATE TRIGGER trigger_update_user_level_tier
  BEFORE INSERT OR UPDATE ON user_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_user_level_tier();

-- ============================================================================
-- PART 4: Create user_expertise Table
-- Requirements: 1.2
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_expertise (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_code TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  expertise_level INTEGER NOT NULL DEFAULT 0 CHECK (expertise_level >= 0 AND expertise_level <= 199),
  expertise_tier TEXT NOT NULL DEFAULT 'beginner' CHECK (expertise_tier IN ('beginner', 'intermediate', 'advanced', 'expert')),
  experience_points BIGINT NOT NULL DEFAULT 0,
  habit_count INTEGER NOT NULL DEFAULT 0,
  task_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, domain_code)
);

-- Indexes for user_expertise
CREATE INDEX IF NOT EXISTS idx_user_expertise_user ON user_expertise(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expertise_domain ON user_expertise(domain_code);
CREATE INDEX IF NOT EXISTS idx_user_expertise_level ON user_expertise(expertise_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_expertise_activity ON user_expertise(last_activity_at DESC);

-- Comments for user_expertise
COMMENT ON TABLE user_expertise IS 'ユーザーの各ドメインにおける専門性レベル';
COMMENT ON COLUMN user_expertise.domain_code IS 'JSCO小分類コード (例: B-11-111)';
COMMENT ON COLUMN user_expertise.domain_name IS 'ドメイン名 (例: システムエンジニア)';
COMMENT ON COLUMN user_expertise.expertise_level IS '専門性レベル (0-199)';
COMMENT ON COLUMN user_expertise.expertise_tier IS 'レベルティア: beginner (0-49), intermediate (50-99), advanced (100-149), expert (150-199)';
COMMENT ON COLUMN user_expertise.experience_points IS '累積経験値';
COMMENT ON COLUMN user_expertise.habit_count IS 'このドメインに関連する習慣の数';
COMMENT ON COLUMN user_expertise.task_count IS 'このドメインに関連するタスクの数';
COMMENT ON COLUMN user_expertise.last_activity_at IS '最後にこのドメインで活動した日時';

-- ============================================================================
-- PART 5: Row Level Security (RLS) Policies for user_expertise
-- ============================================================================

-- Enable RLS on user_expertise
ALTER TABLE user_expertise ENABLE ROW LEVEL SECURITY;

-- Users can view their own expertise
DROP POLICY IF EXISTS "Users can view own expertise" ON user_expertise;
CREATE POLICY "Users can view own expertise" ON user_expertise
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own expertise (for initialization)
DROP POLICY IF EXISTS "Users can insert own expertise" ON user_expertise;
CREATE POLICY "Users can insert own expertise" ON user_expertise
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own expertise
DROP POLICY IF EXISTS "Users can update own expertise" ON user_expertise;
CREATE POLICY "Users can update own expertise" ON user_expertise
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own expertise
DROP POLICY IF EXISTS "Users can delete own expertise" ON user_expertise;
CREATE POLICY "Users can delete own expertise" ON user_expertise
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all user expertise
DROP POLICY IF EXISTS "Service can manage user expertise" ON user_expertise;
CREATE POLICY "Service can manage user expertise" ON user_expertise
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 6: Trigger for Auto-Update expertise_tier
-- Requirement 1.2: Automatically calculate expertise_tier based on expertise_level
-- (Similar to user_levels tier calculation)
-- ============================================================================

-- Trigger function to auto-update expertise_tier when expertise_level changes
CREATE OR REPLACE FUNCTION update_user_expertise_tier()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.expertise_level IS DISTINCT FROM OLD.expertise_level OR TG_OP = 'INSERT' THEN
    NEW.expertise_tier := calculate_user_level_tier(NEW.expertise_level);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_user_expertise_tier() IS 'Trigger function to automatically update expertise_tier when expertise_level changes on user_expertise';

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_user_expertise_tier ON user_expertise;

-- Create trigger
CREATE TRIGGER trigger_update_user_expertise_tier
  BEFORE INSERT OR UPDATE ON user_expertise
  FOR EACH ROW
  EXECUTE FUNCTION update_user_expertise_tier();

-- ============================================================================
-- PART 7: Create user_level_history Table
-- Requirements: 1.3
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_level_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('overall', 'expertise', 'continuity', 'resilience')),
  domain_code TEXT, -- NULL for overall/continuity/resilience changes
  old_level INTEGER,
  new_level INTEGER NOT NULL,
  change_reason TEXT NOT NULL,
  metrics_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for user_level_history
CREATE INDEX IF NOT EXISTS idx_user_level_history_user ON user_level_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_level_history_created ON user_level_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_level_history_type ON user_level_history(change_type);
CREATE INDEX IF NOT EXISTS idx_user_level_history_domain ON user_level_history(domain_code) WHERE domain_code IS NOT NULL;

-- Comments for user_level_history
COMMENT ON TABLE user_level_history IS 'ユーザーレベル変更の履歴';
COMMENT ON COLUMN user_level_history.change_type IS '変更タイプ: overall (総合レベル), expertise (専門性), continuity (継続力), resilience (レジリエンス)';
COMMENT ON COLUMN user_level_history.domain_code IS '専門性変更の場合のドメインコード (overall/continuity/resilienceの場合はNULL)';
COMMENT ON COLUMN user_level_history.old_level IS '変更前のレベル (新規作成の場合はNULL)';
COMMENT ON COLUMN user_level_history.new_level IS '変更後のレベル';
COMMENT ON COLUMN user_level_history.change_reason IS '変更理由: expertise_gain, level_decay, continuity_change, resilience_change, level_recalculation';
COMMENT ON COLUMN user_level_history.metrics_snapshot IS '変更時のメトリクススナップショット (JSONB)';

-- ============================================================================
-- PART 8: Row Level Security (RLS) Policies for user_level_history
-- ============================================================================

-- Enable RLS on user_level_history
ALTER TABLE user_level_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own level history
DROP POLICY IF EXISTS "Users can view own level history" ON user_level_history;
CREATE POLICY "Users can view own level history" ON user_level_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own level history (for recording changes)
DROP POLICY IF EXISTS "Users can insert own level history" ON user_level_history;
CREATE POLICY "Users can insert own level history" ON user_level_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all level history
DROP POLICY IF EXISTS "Service can manage level history" ON user_level_history;
CREATE POLICY "Service can manage level history" ON user_level_history
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 9: Create occupation_domains Table
-- Requirements: 1.4
-- ============================================================================
-- This is a master data table containing JSCO (厚生労働省編職業分類) occupation
-- domains. It stores the hierarchical classification (大分類 > 中分類 > 小分類)
-- and keywords for matching habits/tasks to domains.
-- ============================================================================

CREATE TABLE IF NOT EXISTS occupation_domains (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  major_code TEXT NOT NULL, -- 大分類コード (A-K)
  major_name TEXT NOT NULL, -- 大分類名
  middle_code TEXT NOT NULL, -- 中分類コード
  middle_name TEXT NOT NULL, -- 中分類名
  minor_code TEXT NOT NULL UNIQUE, -- 小分類コード (ユニーク)
  minor_name TEXT NOT NULL, -- 小分類名
  keywords TEXT[] NOT NULL DEFAULT '{}', -- マッチング用キーワード
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for occupation_domains
CREATE INDEX IF NOT EXISTS idx_occupation_domains_major ON occupation_domains(major_code);
CREATE INDEX IF NOT EXISTS idx_occupation_domains_minor ON occupation_domains(minor_code);
CREATE INDEX IF NOT EXISTS idx_occupation_domains_keywords ON occupation_domains USING GIN(keywords);

-- Comments for occupation_domains
COMMENT ON TABLE occupation_domains IS '厚生労働省編職業分類（JSCO）マスターデータ';
COMMENT ON COLUMN occupation_domains.major_code IS '大分類コード (A: 管理的職業, B: 専門的・技術的職業, C: 事務的職業, D: 販売の職業, E: サービスの職業, F: 保安の職業, G: 農林漁業の職業, H: 生産工程の職業, I: 輸送・機械運転の職業, J: 建設・採掘の職業, K: 運搬・清掃・包装等の職業)';
COMMENT ON COLUMN occupation_domains.major_name IS '大分類名';
COMMENT ON COLUMN occupation_domains.middle_code IS '中分類コード';
COMMENT ON COLUMN occupation_domains.middle_name IS '中分類名';
COMMENT ON COLUMN occupation_domains.minor_code IS '小分類コード (ユニーク)';
COMMENT ON COLUMN occupation_domains.minor_name IS '小分類名';
COMMENT ON COLUMN occupation_domains.keywords IS 'マッチング用キーワード配列（日本語・英語）';

-- ============================================================================
-- PART 10: Row Level Security (RLS) Policies for occupation_domains
-- ============================================================================
-- This is a master data table, so all authenticated users can read it.
-- Only service role can insert/update/delete (for seeding and maintenance).
-- ============================================================================

-- Enable RLS on occupation_domains
ALTER TABLE occupation_domains ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view occupation domains (master data)
DROP POLICY IF EXISTS "Authenticated users can view occupation domains" ON occupation_domains;
CREATE POLICY "Authenticated users can view occupation domains" ON occupation_domains
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage all occupation domains (for seeding and maintenance)
DROP POLICY IF EXISTS "Service can manage occupation domains" ON occupation_domains;
CREATE POLICY "Service can manage occupation domains" ON occupation_domains
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 11: Create experience_log Table
-- Requirements: 13.5
-- ============================================================================
-- This table stores audit logs for all experience point awards. It tracks
-- which habit/activity triggered the award, the domain that received points,
-- and the calculation parameters used (habit level, quality multiplier,
-- frequency bonus).
-- ============================================================================

CREATE TABLE IF NOT EXISTS experience_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id TEXT REFERENCES habits(id) ON DELETE SET NULL,
  activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
  domain_code TEXT NOT NULL,
  points_awarded INTEGER NOT NULL,
  habit_level INTEGER, -- THLI-24 level at time of award (NULL if not assessed)
  quality_multiplier DECIMAL(3,2) NOT NULL,
  frequency_bonus DECIMAL(3,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for experience_log
CREATE INDEX IF NOT EXISTS idx_experience_log_user ON experience_log(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_log_domain ON experience_log(domain_code);
CREATE INDEX IF NOT EXISTS idx_experience_log_created ON experience_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experience_log_habit ON experience_log(habit_id) WHERE habit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experience_log_activity ON experience_log(activity_id) WHERE activity_id IS NOT NULL;

-- Comments for experience_log
COMMENT ON TABLE experience_log IS '経験値付与の監査ログ';
COMMENT ON COLUMN experience_log.user_id IS '経験値を獲得したユーザーのID';
COMMENT ON COLUMN experience_log.habit_id IS '経験値の元となった習慣のID (削除された場合はNULL)';
COMMENT ON COLUMN experience_log.activity_id IS '経験値の元となったアクティビティのID (削除された場合はNULL)';
COMMENT ON COLUMN experience_log.domain_code IS '経験値が付与されたドメインコード';
COMMENT ON COLUMN experience_log.points_awarded IS '付与された経験値ポイント';
COMMENT ON COLUMN experience_log.habit_level IS '付与時の習慣のTHLI-24レベル (未評価の場合はNULL、デフォルト50として計算)';
COMMENT ON COLUMN experience_log.quality_multiplier IS '完了品質の乗数 (1.0: 通常, 1.2: 超過達成, 0.8: 部分完了)';
COMMENT ON COLUMN experience_log.frequency_bonus IS '頻度ボーナス (1.0: 当日初回, 0.5: 当日2回目以降)';

-- ============================================================================
-- PART 12: Row Level Security (RLS) Policies for experience_log
-- ============================================================================

-- Enable RLS on experience_log
ALTER TABLE experience_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own experience log
DROP POLICY IF EXISTS "Users can view own experience log" ON experience_log;
CREATE POLICY "Users can view own experience log" ON experience_log
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own experience log (for recording awards)
DROP POLICY IF EXISTS "Users can insert own experience log" ON experience_log;
CREATE POLICY "Users can insert own experience log" ON experience_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all experience logs
DROP POLICY IF EXISTS "Service can manage experience logs" ON experience_log;
CREATE POLICY "Service can manage experience logs" ON experience_log
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Tables created:
-- - user_levels (id, user_id, overall_level, overall_tier, habit_continuity_power,
--                resilience_score, total_experience_points, last_calculated_at,
--                created_at, updated_at)
-- - user_expertise (id, user_id, domain_code, domain_name, expertise_level,
--                   expertise_tier, experience_points, habit_count, task_count,
--                   last_activity_at, created_at, updated_at)
-- - user_level_history (id, user_id, change_type, domain_code, old_level,
--                       new_level, change_reason, metrics_snapshot, created_at)
-- - occupation_domains (id, major_code, major_name, middle_code, middle_name,
--                       minor_code, minor_name, keywords, created_at)
-- - experience_log (id, user_id, habit_id, activity_id, domain_code,
--                   points_awarded, habit_level, quality_multiplier,
--                   frequency_bonus, created_at)
--
-- RLS Policies:
-- - Users can view/insert/update their own user level
-- - Users can view/insert/update/delete their own expertise
-- - Users can view/insert their own level history
-- - All authenticated users can view occupation domains (master data)
-- - Users can view/insert their own experience log
-- - Service role can manage all user levels, expertise, history, domains, and logs
--
-- Functions created:
-- - calculate_user_level_tier(INTEGER) - Calculates tier from level
-- - update_user_level_tier() - Trigger function for auto-updating tier on user_levels
-- - update_user_expertise_tier() - Trigger function for auto-updating tier on user_expertise
--
-- Triggers created:
-- - trigger_update_user_level_tier - Auto-updates overall_tier on level change
-- - trigger_update_user_expertise_tier - Auto-updates expertise_tier on level change
--
-- ============================================================================


-- ============================================================================
-- PART 13: Add domain_codes Column to habits Table
-- Requirements: 1.6
-- ============================================================================
-- This adds a domain_codes column to the existing habits table to store
-- associated occupation domain codes. This allows habits to be linked to
-- multiple JSCO occupation domains for experience point distribution.
-- ============================================================================

-- Add domain_codes column to habits table
ALTER TABLE habits ADD COLUMN IF NOT EXISTS domain_codes TEXT[] DEFAULT '{}';

-- Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_habits_domains ON habits USING GIN(domain_codes);

-- Add comment for documentation
COMMENT ON COLUMN habits.domain_codes IS '関連する職業分類ドメインコードの配列';

-- ============================================================================
-- PART 13 COMPLETE
-- ============================================================================
-- 
-- Column added:
-- - habits.domain_codes (TEXT[] DEFAULT '{}')
--
-- Index created:
-- - idx_habits_domains (GIN index for efficient array queries)
--
-- This allows habits to be associated with multiple occupation domains
-- for experience point distribution when habits are completed.
-- ============================================================================


-- ============================================================================
-- PART 14: Add domain_codes Column to goals Table
-- Requirements: 1.7
-- ============================================================================
-- This adds a domain_codes column to the existing goals table to store
-- associated occupation domain codes. This allows goals to be linked to
-- multiple JSCO occupation domains for experience point distribution.
-- ============================================================================

-- Add domain_codes column to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS domain_codes TEXT[] DEFAULT '{}';

-- Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_goals_domains ON goals USING GIN(domain_codes);

-- Add comment for documentation
COMMENT ON COLUMN goals.domain_codes IS '関連する職業分類ドメインコードの配列';

-- ============================================================================
-- PART 14 COMPLETE
-- ============================================================================
-- 
-- Column added:
-- - goals.domain_codes (TEXT[] DEFAULT '{}')
--
-- Index created:
-- - idx_goals_domains (GIN index for efficient array queries)
--
-- This allows goals to be associated with multiple occupation domains
-- for experience point distribution when related habits are completed.
-- ============================================================================
