-- デバッグ用: 移行されたデータを確認するクエリ

-- 1. 全てのgoalsを確認
SELECT 
    id, 
    name, 
    owner_type, 
    owner_id, 
    created_at,
    updated_at
FROM goals 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. 全てのhabitsを確認
SELECT 
    id, 
    name, 
    goal_id,
    owner_type, 
    owner_id, 
    created_at,
    updated_at
FROM habits 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 全てのactivitiesを確認
SELECT 
    id, 
    habit_name, 
    owner_type, 
    owner_id, 
    timestamp
FROM activities 
ORDER BY timestamp DESC 
LIMIT 10;

-- 4. 特定ユーザーのデータを確認（ユーザーIDを置き換えてください）
-- SELECT * FROM goals WHERE owner_type = 'user' AND owner_id = 'YOUR_USER_ID';
-- SELECT * FROM habits WHERE owner_type = 'user' AND owner_id = 'YOUR_USER_ID';
-- SELECT * FROM activities WHERE owner_type = 'user' AND owner_id = 'YOUR_USER_ID';

-- 5. RLSポリシーの確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('goals', 'habits', 'activities');

-- 6. 現在の認証ユーザーIDを確認
SELECT auth.uid() as current_user_id;