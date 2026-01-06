-- Supabaseの認証スキーマ確認
-- auth スキーマのテーブル構造を確認

-- 1. authスキーマのテーブル一覧
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 2. auth.usersテーブルの構造確認
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'auth' 
    AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. 現在のユーザー情報確認
SELECT 
    id,
    email,
    created_at,
    updated_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 4. 認証関連の統計
SELECT 
    'Total Users' as metric,
    count(*) as value
FROM auth.users
UNION ALL
SELECT 
    'Confirmed Users' as metric,
    count(*) as value
FROM auth.users 
WHERE email_confirmed_at IS NOT NULL
UNION ALL
SELECT 
    'Recent Logins (24h)' as metric,
    count(*) as value
FROM auth.users 
WHERE last_sign_in_at > NOW() - INTERVAL '24 hours';

-- 5. 現在の認証ユーザー（実行中のセッション）
SELECT 
    auth.uid() as current_user_id,
    auth.email() as current_user_email,
    auth.role() as current_user_role;