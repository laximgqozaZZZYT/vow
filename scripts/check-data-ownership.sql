-- データの所有者確認スクリプト
-- ゲストデータとユーザーデータの分布を確認

-- 1. 現在の認証状態
SELECT 
    CASE 
        WHEN auth.uid() IS NULL THEN 'GUEST (Not logged in)'
        ELSE 'USER (Logged in as: ' || auth.uid()::text || ')'
    END as auth_status;

-- 2. 各テーブルのデータ所有者分布
SELECT 
    'goals' as table_name,
    owner_type,
    CASE 
        WHEN owner_id IS NULL THEN 'NULL'
        ELSE 'SET'
    END as owner_id_status,
    count(*) as record_count
FROM goals
GROUP BY owner_type, CASE WHEN owner_id IS NULL THEN 'NULL' ELSE 'SET' END

UNION ALL

SELECT 
    'habits' as table_name,
    owner_type,
    CASE 
        WHEN owner_id IS NULL THEN 'NULL'
        ELSE 'SET'
    END as owner_id_status,
    count(*) as record_count
FROM habits
GROUP BY owner_type, CASE WHEN owner_id IS NULL THEN 'NULL' ELSE 'SET' END

UNION ALL

SELECT 
    'activities' as table_name,
    owner_type,
    CASE 
        WHEN owner_id IS NULL THEN 'NULL'
        ELSE 'SET'
    END as owner_id_status,
    count(*) as record_count
FROM activities
GROUP BY owner_type, CASE WHEN owner_id IS NULL THEN 'NULL' ELSE 'SET' END

ORDER BY table_name, owner_type;

-- 3. 現在のユーザーがアクセスできるデータ数
SELECT 
    'goals' as table_name,
    count(*) as accessible_records
FROM goals
WHERE (auth.uid() IS NULL AND (owner_type IS NULL OR owner_id IS NULL))
   OR (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)

UNION ALL

SELECT 
    'habits' as table_name,
    count(*) as accessible_records
FROM habits
WHERE (auth.uid() IS NULL AND (owner_type IS NULL OR owner_id IS NULL))
   OR (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)

UNION ALL

SELECT 
    'activities' as table_name,
    count(*) as accessible_records
FROM activities
WHERE (auth.uid() IS NULL AND (owner_type IS NULL OR owner_id IS NULL))
   OR (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

-- 4. サンプルデータの確認（最新5件）
SELECT 
    'goals' as table_name,
    id,
    name,
    owner_type,
    CASE 
        WHEN owner_id IS NULL THEN 'NULL'
        WHEN length(owner_id) > 10 THEN left(owner_id, 8) || '...'
        ELSE owner_id
    END as owner_id_preview,
    created_at
FROM goals
ORDER BY created_at DESC
LIMIT 5;