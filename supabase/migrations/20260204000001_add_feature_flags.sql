-- Migration: Add feature_flags table for Level System Rebalancing
-- Requirements: 11.2, 11.3
-- Description: Creates the feature_flags table for feature flag management
--              and inserts initial flags for level rebalancing rollout

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  flag_name TEXT NOT NULL UNIQUE,
  flag_value BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient flag lookup
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);

-- Add table and column comments
COMMENT ON TABLE feature_flags IS 'フィーチャーフラグ管理';
COMMENT ON COLUMN feature_flags.id IS '一意識別子';
COMMENT ON COLUMN feature_flags.flag_name IS 'フラグ名（一意）';
COMMENT ON COLUMN feature_flags.flag_value IS 'フラグ値（true/false）';
COMMENT ON COLUMN feature_flags.description IS 'フラグの説明';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'ロールアウト率（0-100%）、A/Bテスト用';
COMMENT ON COLUMN feature_flags.created_at IS '作成日時';
COMMENT ON COLUMN feature_flags.updated_at IS '更新日時';

-- Insert initial feature flags for level rebalancing
INSERT INTO feature_flags (flag_name, flag_value, description) VALUES
('level_rebalancing_enabled', false, 'リバランスされたレベル計算式を有効化'),
('migration_in_progress', false, '移行ジョブが実行中'),
('new_xp_formula_enabled', false, '新しいXP計算式を有効化'),
('thli_recalibration_enabled', false, 'THLI-24再評価機能を有効化');

-- Enable Row Level Security
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow all authenticated users to read feature_flags (public configuration)
CREATE POLICY "feature_flags_select_policy" ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete (admin operations)
CREATE POLICY "feature_flags_insert_policy" ON feature_flags
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "feature_flags_update_policy" ON feature_flags
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "feature_flags_delete_policy" ON feature_flags
  FOR DELETE
  TO service_role
  USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();
