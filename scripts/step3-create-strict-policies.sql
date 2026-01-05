-- ステップ3: 厳密なデータ分離ポリシーを作成
-- 各ユーザーは自分のデータのみアクセス可能

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

-- 作成後の確認
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