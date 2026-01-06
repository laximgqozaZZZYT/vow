-- ステップ2: インデックス最適化（安全な操作）
-- 新しいインデックスの作成のみ（削除は含まない）

-- 1. RLSクエリ最適化用の複合インデックス作成
-- owner_type + owner_id の組み合わせでよく検索されるため

CREATE INDEX IF NOT EXISTS idx_goals_owner_rls ON goals(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_habits_owner_rls ON habits(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_owner_rls ON activities(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_preferences_owner_rls ON preferences(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diary_cards_owner_rls ON diary_cards(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diary_tags_owner_rls ON diary_tags(owner_type, owner_id) 
WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;

-- 2. 日付範囲クエリ用のインデックス
-- 降順でよく検索されるため

CREATE INDEX IF NOT EXISTS idx_activities_timestamp_rls ON activities(timestamp DESC) 
WHERE timestamp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_created_rls ON goals(created_at DESC) 
WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_habits_created_rls ON habits(created_at DESC) 
WHERE created_at IS NOT NULL;

-- 3. 作成されたインデックスの確認
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
    AND indexname LIKE '%_rls'
ORDER BY tablename, indexname;

-- 4. インデックス作成後の統計情報更新
ANALYZE goals;
ANALYZE habits;
ANALYZE activities;
ANALYZE preferences;
ANALYZE diary_cards;
ANALYZE diary_tags;