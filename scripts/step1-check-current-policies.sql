-- ステップ1: 現在のRLSポリシー状況を確認
-- 安全な確認クエリのみ（破壊的操作なし）

-- 1. 現在のポリシー一覧を確認
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY tablename, policyname;

-- 2. RLS有効化状況を確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY tablename;

-- 3. 各テーブルのデータ状況を確認
SELECT 
    'goals' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records,
    count(*) FILTER (WHERE owner_type IS NULL) as null_type_records
FROM goals
UNION ALL
SELECT 
    'habits' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records,
    count(*) FILTER (WHERE owner_type IS NULL) as null_type_records
FROM habits
UNION ALL
SELECT 
    'activities' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records,
    count(*) FILTER (WHERE owner_type IS NULL) as null_type_records
FROM activities
UNION ALL
SELECT 
    'preferences' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records,
    count(*) FILTER (WHERE owner_type IS NULL) as null_type_records
FROM preferences
UNION ALL
SELECT 
    'diary_cards' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records,
    count(*) FILTER (WHERE owner_type IS NULL) as null_type_records
FROM diary_cards
UNION ALL
SELECT 
    'diary_tags' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records,
    count(*) FILTER (WHERE owner_type IS NULL) as null_type_records
FROM diary_tags;

-- 4. 認証ユーザー情報を確認
SELECT 
    id as user_id,
    email,
    created_at,
    updated_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;