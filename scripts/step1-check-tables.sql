-- ステップ1: テーブル存在確認とRLS状況チェック（修正版）
-- 安全な確認クエリのみ（変更なし）

-- 1. publicスキーマのテーブル一覧とRLS状況
SELECT 
    n.nspname as schemaname,
    c.relname as tablename,
    c.relrowsecurity as rls_enabled,
    pg_get_userbyid(c.relowner) as tableowner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
    AND c.relkind = 'r'  -- regular tables only
ORDER BY c.relname;

-- 2. 警告対象のテーブルが存在するかチェック
SELECT 
    'users' as table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r'
    ) THEN 'EXISTS' ELSE 'NOT EXISTS' END as status
UNION ALL
SELECT 
    'guests' as table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' AND c.relname = 'guests' AND c.relkind = 'r'
    ) THEN 'EXISTS' ELSE 'NOT EXISTS' END as status
UNION ALL
SELECT 
    'sessions' as table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' AND c.relname = 'sessions' AND c.relkind = 'r'
    ) THEN 'EXISTS' ELSE 'NOT EXISTS' END as status;

-- 3. 現在のポリシー数（存在する場合）
SELECT 
    schemaname,
    tablename,
    count(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 4. 現在のインデックス状況
SELECT 
    n.nspname as schemaname,
    t.relname as tablename,
    i.relname as indexname,
    COALESCE(s.idx_scan, 0) as times_used,
    pg_size_pretty(pg_relation_size(i.oid)) as index_size
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
WHERE n.nspname = 'public'
    AND i.relkind = 'i'  -- indexes only
ORDER BY t.relname, i.relname;