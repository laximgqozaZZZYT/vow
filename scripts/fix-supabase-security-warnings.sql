-- Supabaseセキュリティ警告修正スクリプト（修正版）
-- Supabase SQL Editorで実行

-- 1. 現在のテーブル状況を確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('users', 'guests', 'sessions')
ORDER BY tablename;

-- 2. 存在するテーブルのみRLS有効化
-- まず、どのテーブルが実際に存在するかを確認してから実行してください

-- usersテーブル（存在する場合）
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- guestsテーブル（存在する場合）
-- ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- sessionsテーブル（存在する場合）
-- ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 3. 存在するテーブルに対するRLSポリシー作成
-- 以下は例です。実際のテーブル構造に合わせて調整してください

-- usersテーブル用ポリシー（存在する場合）
-- CREATE POLICY "Users can view own data" ON public.users
--     FOR SELECT USING (auth.uid()::text = id OR auth.uid()::text = user_id);

-- CREATE POLICY "Users can update own data" ON public.users
--     FOR UPDATE USING (auth.uid()::text = id OR auth.uid()::text = user_id);

-- guestsテーブル用ポリシー（存在する場合）
-- CREATE POLICY "Guests can view own data" ON public.guests
--     FOR SELECT USING (auth.uid()::text = user_id);

-- sessionsテーブル用ポリシー（存在する場合）
-- CREATE POLICY "Users can view own sessions" ON public.sessions
--     FOR SELECT USING (auth.uid()::text = user_id);

-- 4. 不要なインデックスの確認と削除
-- 使用状況を確認するクエリ
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
    AND idx_scan = 0  -- 一度も使用されていないインデックス
ORDER BY pg_relation_size(indexrelid) DESC;

-- 5. パフォーマンス最適化のための有用なインデックス作成
-- RLSクエリ最適化用の複合インデックス

-- owner_id + owner_typeの複合インデックス（既存の場合はスキップ）
CREATE INDEX IF NOT EXISTS idx_goals_owner_optimized ON goals(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_habits_owner_optimized ON habits(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_owner_optimized ON activities(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_preferences_owner_optimized ON preferences(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diary_cards_owner_optimized ON diary_cards(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diary_tags_owner_optimized ON diary_tags(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

-- 6. 日付範囲クエリ用のインデックス（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_activities_timestamp_desc ON activities(timestamp DESC) 
WHERE timestamp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_created_at_desc ON goals(created_at DESC) 
WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_habits_created_at_desc ON habits(created_at DESC) 
WHERE created_at IS NOT NULL;

-- 7. 現在のRLS状況確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;

-- 8. 作成されたインデックスの確認
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
    AND indexname LIKE '%_optimized'
ORDER BY tablename, indexname;