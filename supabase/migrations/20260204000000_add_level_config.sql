-- Migration: Add level_config table for Level System Rebalancing
-- Requirements: 1.7, 11.1
-- Description: Creates the level_config table to store calculation formula parameters
--              and inserts initial v2.0 configuration data

-- Create level_config table
CREATE TABLE IF NOT EXISTS level_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  version TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_level_config_key ON level_config(config_key);
CREATE INDEX IF NOT EXISTS idx_level_config_effective ON level_config(effective_from, effective_to);

-- Add table and column comments
COMMENT ON TABLE level_config IS 'レベル計算式とパラメータの設定';
COMMENT ON COLUMN level_config.id IS '一意識別子';
COMMENT ON COLUMN level_config.config_key IS '設定キー: expertise_formula, xp_formula, xp_multipliers, decay_settings, tier_boundaries';
COMMENT ON COLUMN level_config.config_value IS '設定値（JSON形式）';
COMMENT ON COLUMN level_config.version IS '設定バージョン（例: v2.0）';
COMMENT ON COLUMN level_config.effective_from IS '有効開始日時';
COMMENT ON COLUMN level_config.effective_to IS '有効終了日時（NULLの場合は現在有効）';
COMMENT ON COLUMN level_config.created_by IS '作成者';
COMMENT ON COLUMN level_config.created_at IS '作成日時';
COMMENT ON COLUMN level_config.updated_at IS '更新日時';

-- Insert initial v2.0 configuration data
-- 新しいレベル計算式パラメータ
INSERT INTO level_config (config_key, config_value, version) VALUES
('expertise_formula', '{"multiplier": 5, "divisor": 1000, "maxLevel": 9999}', 'v2.0'),
('xp_formula', '{"habitLevelMultiplier": 2, "defaultHabitLevel": 25, "streakMaxBonus": 30, "streakMultiplier": 1, "dailyCapPerHabit": 100}', 'v2.0'),
('xp_multipliers', '{"tier0_49": 0.2, "tier50_79": 0.5, "tier80_99": 0.8, "tier100_120": 1.0, "tier121_150": 0.85, "tier151_plus": 0.6}', 'v2.0'),
('decay_settings', '{"gracePeriodDays": 21, "decayPerWeek": 0.5, "maxDecayPercent": 0.15, "recoveryBonusMultiplier": 1.5, "recoveryBonusDays": 7}', 'v2.0'),
('tier_boundaries', '{"beginner": {"min": 0, "max": 49}, "intermediate": {"min": 50, "max": 99}, "advanced": {"min": 100, "max": 499}, "expert": {"min": 500, "max": 9999}}', 'v2.0');

-- Enable Row Level Security
ALTER TABLE level_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow all authenticated users to read level_config (public configuration)
CREATE POLICY "level_config_select_policy" ON level_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete (admin operations)
CREATE POLICY "level_config_insert_policy" ON level_config
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "level_config_update_policy" ON level_config
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "level_config_delete_policy" ON level_config
  FOR DELETE
  TO service_role
  USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_level_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_level_config_updated_at
  BEFORE UPDATE ON level_config
  FOR EACH ROW
  EXECUTE FUNCTION update_level_config_updated_at();
