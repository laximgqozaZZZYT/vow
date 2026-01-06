-- 簡単なテーブル確認クエリ
-- 基本的な情報のみを取得

-- 1. 現在のデータベースの基本情報
SELECT current_database() as database_name, current_user as current_user;

-- 2. publicスキーマのテーブル一覧（シンプル版）
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. 警告対象テーブルの存在確認（シンプル版）
SELECT 
    'users' as check_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN 'EXISTS' ELSE 'NOT EXISTS' END as status
UNION ALL
SELECT 
    'guests' as check_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'guests'
    ) THEN 'EXISTS' ELSE 'NOT EXISTS' END as status
UNION ALL
SELECT 
    'sessions' as check_table,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sessions'
    ) THEN 'EXISTS' ELSE 'NOT EXISTS' END as status;

-- 4. 既存のアプリケーションテーブル確認
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
    AND table_name IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY table_name;