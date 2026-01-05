-- RLS（Row Level Security）ポリシー修正スクリプト
-- Supabase SQL Editorで実行

-- 既存のポリシーを削除（エラーが出ても問題なし）
DROP POLICY IF EXISTS "Users can access own goals" ON goals;
DROP POLICY IF EXISTS "Users can access own habits" ON habits;
DROP POLICY IF EXISTS "Users can access own activities" ON activities;
DROP POLICY IF EXISTS "Users can access own preferences" ON preferences;
DROP POLICY IF EXISTS "Users can access own diary cards" ON diary_cards;
DROP POLICY IF EXISTS "Users can access own diary tags" ON diary_tags;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON goals;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON habits;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON activities;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON preferences;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_cards;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_tags;

-- 厳密なデータ分離ポリシーを作成
-- 問題の原因だった "OR owner_id IS NULL" 条件を削除

-- Goals テーブル
CREATE POLICY "Users can only access their own goals" ON goals
    FOR ALL USING (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    );

-- Habits テーブル
CREATE POLICY "Users can only access their own habits" ON habits
    FOR ALL USING (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    );

-- Activities テーブル
CREATE POLICY "Users can only access their own activities" ON activities
    FOR ALL USING (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    );

-- Preferences テーブル
CREATE POLICY "Users can only access their own preferences" ON preferences
    FOR ALL USING (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    );

-- Diary Cards テーブル
CREATE POLICY "Users can only access their own diary cards" ON diary_cards
    FOR ALL USING (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    );

-- Diary Tags テーブル
CREATE POLICY "Users can only access their own diary tags" ON diary_tags
    FOR ALL USING (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND 
        owner_type = 'user' AND 
        owner_id = auth.uid()::text
    );

-- 既存のNULLデータをクリーンアップ（オプション）
-- 注意: 実行前にデータをバックアップしてください

-- 1. owner_id が NULL のデータを確認
SELECT 'goals' as table_name, count(*) as null_owner_count FROM goals WHERE owner_id IS NULL
UNION ALL
SELECT 'habits' as table_name, count(*) as null_owner_count FROM habits WHERE owner_id IS NULL
UNION ALL
SELECT 'activities' as table_name, count(*) as null_owner_count FROM activities WHERE owner_id IS NULL
UNION ALL
SELECT 'preferences' as table_name, count(*) as null_owner_count FROM preferences WHERE owner_id IS NULL
UNION ALL
SELECT 'diary_cards' as table_name, count(*) as null_owner_count FROM diary_cards WHERE owner_id IS NULL
UNION ALL
SELECT 'diary_tags' as table_name, count(*) as null_owner_count FROM diary_tags WHERE owner_id IS NULL;

-- 2. NULLデータの削除（慎重に実行）
-- DELETE FROM goals WHERE owner_id IS NULL;
-- DELETE FROM habits WHERE owner_id IS NULL;
-- DELETE FROM activities WHERE owner_id IS NULL;
-- DELETE FROM preferences WHERE owner_id IS NULL;
-- DELETE FROM diary_cards WHERE owner_id IS NULL;
-- DELETE FROM diary_tags WHERE owner_id IS NULL;

-- 現在のポリシー確認
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('goals', 'habits', 'activities', 'preferences', 'diary_cards', 'diary_tags')
ORDER BY tablename, policyname;