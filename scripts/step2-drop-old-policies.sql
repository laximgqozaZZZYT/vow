-- ステップ2: 既存のポリシーを削除
-- 注意: これは破壊的操作です。実行前にstep1で現在の状況を確認してください。

-- 既存のポリシーを削除（エラーが出ても問題なし）
DROP POLICY IF EXISTS "Users can access own goals" ON goals;
DROP POLICY IF EXISTS "Users can access own habits" ON habits;
DROP POLICY IF EXISTS "Users can access own activities" ON activities;
DROP POLICY IF EXISTS "Users can access own preferences" ON preferences;
DROP POLICY IF EXISTS "Users can access own diary cards" ON diary_cards;
DROP POLICY IF EXISTS "Users can access own diary tags" ON diary_tags;

-- 古い柔軟すぎるポリシーも削除
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON goals;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON habits;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON activities;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON preferences;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_cards;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_tags;

-- その他の可能性のあるポリシー名も削除
DROP POLICY IF EXISTS "Enable read access for all users" ON goals;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON goals;
DROP POLICY IF EXISTS "Enable update for users based on email" ON goals;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON goals;

-- 削除後の確認
SELECT 
    schemaname, 
    tablename, 
    policyname
FROM pg_policies 
WHERE tablename IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY tablename, policyname;