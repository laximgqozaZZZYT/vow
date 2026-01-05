-- ステップ4: NULLデータのクリーンアップ
-- 注意: 実行前に必ずデータをバックアップしてください

-- 1. クリーンアップ前の状況確認
SELECT 
    'Before cleanup' as status,
    'goals' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
FROM goals
UNION ALL
SELECT 
    'Before cleanup' as status,
    'habits' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
FROM habits
UNION ALL
SELECT 
    'Before cleanup' as status,
    'activities' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
FROM activities
UNION ALL
SELECT 
    'Before cleanup' as status,
    'preferences' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
FROM preferences
UNION ALL
SELECT 
    'Before cleanup' as status,
    'diary_cards' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
FROM diary_cards
UNION ALL
SELECT 
    'Before cleanup' as status,
    'diary_tags' as table_name, 
    count(*) as total_records,
    count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
FROM diary_tags;

-- 2. NULLデータの削除（慎重に実行）
-- 注意: 以下のコメントを外して実行してください

-- DELETE FROM goals WHERE owner_id IS NULL;
-- DELETE FROM habits WHERE owner_id IS NULL;
-- DELETE FROM activities WHERE owner_id IS NULL;
-- DELETE FROM preferences WHERE owner_id IS NULL;
-- DELETE FROM diary_cards WHERE owner_id IS NULL;
-- DELETE FROM diary_tags WHERE owner_id IS NULL;

-- 3. クリーンアップ後の確認（上記のDELETE文を実行した後にコメントを外す）
-- SELECT 
--     'After cleanup' as status,
--     'goals' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM goals
-- UNION ALL
-- SELECT 
--     'After cleanup' as status,
--     'habits' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM habits
-- UNION ALL
-- SELECT 
--     'After cleanup' as status,
--     'activities' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM activities
-- UNION ALL
-- SELECT 
--     'After cleanup' as status,
--     'preferences' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM preferences
-- UNION ALL
-- SELECT 
--     'After cleanup' as status,
--     'diary_cards' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM diary_cards
-- UNION ALL
-- SELECT 
--     'After cleanup' as status,
--     'diary_tags' as table_name, 
--     count(*) as total_records,
--     count(*) FILTER (WHERE owner_id IS NULL) as null_owner_records
-- FROM diary_tags;