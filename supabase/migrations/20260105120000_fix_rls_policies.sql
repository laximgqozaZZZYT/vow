-- RLS（Row Level Security）ポリシー修正
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

-- より柔軟なRLSポリシーを作成

-- Goals テーブル
CREATE POLICY "Enable all operations for authenticated users" ON goals
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

-- Habits テーブル
CREATE POLICY "Enable all operations for authenticated users" ON habits
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

-- Activities テーブル
CREATE POLICY "Enable all operations for authenticated users" ON activities
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

-- Preferences テーブル
CREATE POLICY "Enable all operations for authenticated users" ON preferences
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

-- Diary Cards テーブル
CREATE POLICY "Enable all operations for authenticated users" ON diary_cards
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );

-- Diary Tags テーブル
CREATE POLICY "Enable all operations for authenticated users" ON diary_tags
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
            OR owner_id IS NULL
        )
    );