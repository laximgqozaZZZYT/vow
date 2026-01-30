-- Migration: Add user_levels_backup table for Level System Rebalancing
-- Requirements: 12.1, 12.2
-- Description: Creates the user_levels_backup table to store pre-migration user level data
--              for backup and potential rollback purposes

-- Create user_levels_backup table
CREATE TABLE IF NOT EXISTS user_levels_backup (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_overall_level INTEGER NOT NULL,
  old_overall_tier TEXT NOT NULL,
  old_habit_continuity_power INTEGER NOT NULL,
  old_resilience_score INTEGER NOT NULL,
  old_total_experience_points BIGINT NOT NULL,
  old_expertise_levels JSONB NOT NULL, -- Array of {domain_code, level, xp}
  backup_reason TEXT NOT NULL DEFAULT 'system_rebalancing',
  backup_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_levels_backup_user ON user_levels_backup(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_backup_timestamp ON user_levels_backup(backup_timestamp DESC);

-- Add table and column comments
COMMENT ON TABLE user_levels_backup IS '移行前のユーザーレベルバックアップ';
COMMENT ON COLUMN user_levels_backup.id IS '一意識別子';
COMMENT ON COLUMN user_levels_backup.user_id IS 'ユーザーID（auth.usersへの外部キー）';
COMMENT ON COLUMN user_levels_backup.old_overall_level IS '移行前の総合レベル';
COMMENT ON COLUMN user_levels_backup.old_overall_tier IS '移行前のティア（beginner/intermediate/advanced/expert）';
COMMENT ON COLUMN user_levels_backup.old_habit_continuity_power IS '移行前の習慣継続力';
COMMENT ON COLUMN user_levels_backup.old_resilience_score IS '移行前のレジリエンススコア';
COMMENT ON COLUMN user_levels_backup.old_total_experience_points IS '移行前の総経験値';
COMMENT ON COLUMN user_levels_backup.old_expertise_levels IS '移行前の専門性レベル（JSON配列: {domain_code, level, xp}）';
COMMENT ON COLUMN user_levels_backup.backup_reason IS 'バックアップ理由（system_rebalancing等）';
COMMENT ON COLUMN user_levels_backup.backup_timestamp IS 'バックアップ作成日時';
COMMENT ON COLUMN user_levels_backup.restored_at IS 'リストア日時（NULLの場合は未リストア）';
COMMENT ON COLUMN user_levels_backup.created_at IS 'レコード作成日時';

-- Enable Row Level Security
ALTER TABLE user_levels_backup ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only read their own backup data
CREATE POLICY "user_levels_backup_select_policy" ON user_levels_backup
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert (backup operations are system-level)
CREATE POLICY "user_levels_backup_insert_policy" ON user_levels_backup
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service role can update (restore operations are system-level)
CREATE POLICY "user_levels_backup_update_policy" ON user_levels_backup
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only service role can delete (cleanup operations are system-level)
CREATE POLICY "user_levels_backup_delete_policy" ON user_levels_backup
  FOR DELETE
  TO service_role
  USING (true);
