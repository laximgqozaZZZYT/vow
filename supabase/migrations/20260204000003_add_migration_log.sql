-- Migration: Add migration_log table for level system rebalancing
-- Requirements: 5.4, 12.5
-- Description: 移行ログ用テーブル - レベルリバランシング、THLI再評価、ロールバックの記録

CREATE TABLE IF NOT EXISTS migration_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  migration_type TEXT NOT NULL CHECK (migration_type IN ('level_rebalancing', 'thli_recalibration', 'rollback')),
  old_level INTEGER,
  new_level INTEGER,
  compression_rate DECIMAL(3,2),
  pioneer_badge_awarded BOOLEAN DEFAULT false,
  details JSONB,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_migration_log_user ON migration_log(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_type ON migration_log(migration_type);
CREATE INDEX IF NOT EXISTS idx_migration_log_migrated ON migration_log(migrated_at DESC);

-- Table and column comments
COMMENT ON TABLE migration_log IS '移行ログ';
COMMENT ON COLUMN migration_log.id IS '移行ログID';
COMMENT ON COLUMN migration_log.user_id IS 'ユーザーID';
COMMENT ON COLUMN migration_log.migration_type IS '移行タイプ: level_rebalancing, thli_recalibration, rollback';
COMMENT ON COLUMN migration_log.old_level IS '移行前レベル';
COMMENT ON COLUMN migration_log.new_level IS '移行後レベル';
COMMENT ON COLUMN migration_log.compression_rate IS '圧縮率（例: 0.50 = 50%圧縮）';
COMMENT ON COLUMN migration_log.pioneer_badge_awarded IS 'Pioneer Badge授与フラグ';
COMMENT ON COLUMN migration_log.details IS '移行詳細（JSONB形式）';
COMMENT ON COLUMN migration_log.migrated_at IS '移行実行日時';
COMMENT ON COLUMN migration_log.created_at IS 'レコード作成日時';

-- Enable Row Level Security
ALTER TABLE migration_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own migration logs
CREATE POLICY "Users can view own migration logs"
  ON migration_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only system (service role) can insert migration logs
CREATE POLICY "Service role can insert migration logs"
  ON migration_log
  FOR INSERT
  WITH CHECK (true);

-- Only system (service role) can update migration logs
CREATE POLICY "Service role can update migration logs"
  ON migration_log
  FOR UPDATE
  USING (true);
