-- データクリーンアップスクリプト
-- owner_id が NULL のデータを調査・修正

-- 1. 現在のNULLデータの状況を確認
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

-- 2. 具体的なNULLデータの内容を確認（サンプル）
SELECT 'goals' as table_name, id, name, owner_type, owner_id, created_at 
FROM goals 
WHERE owner_id IS NULL 
LIMIT 5;

SELECT 'habits' as table_name, id, name, owner_type, owner_id, created_at 
FROM habits 
WHERE owner_id IS NULL 
LIMIT 5;

-- 3. ユーザー情報の確認
SELECT 
    id as user_id,
    email,
    created_at,
    updated_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 4. データクリーンアップ（慎重に実行）
-- 注意: 実行前に必ずデータをバックアップしてください

-- オプション A: NULLデータを削除
-- DELETE FROM goals WHERE owner_id IS NULL;
-- DELETE FROM habits WHERE owner_id IS NULL;
-- DELETE FROM activities WHERE owner_id IS NULL;
-- DELETE FROM preferences WHERE owner_id IS NULL;
-- DELETE FROM diary_cards WHERE owner_id IS NULL;
-- DELETE FROM diary_tags WHERE owner_id IS NULL;

-- オプション B: 特定のユーザーにNULLデータを割り当て
-- 最初のユーザーIDを取得して、NULLデータを割り当てる例
-- WITH first_user AS (
--     SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
-- )
-- UPDATE goals SET 
--     owner_type = 'user',
--     owner_id = (SELECT id FROM first_user)
-- WHERE owner_id IS NULL;

-- 5. クリーンアップ後の確認
-- SELECT 
--     'goals' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM goals
-- UNION ALL
-- SELECT 
--     'habits' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM habits;

-- 6. RLS有効化の確認
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY tablename;