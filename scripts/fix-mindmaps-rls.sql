-- Mindmaps関連テーブルのRLSポリシー緊急修正
-- このスクリプトを直接Supabaseのクエリエディタで実行してください

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can access own mindmaps" ON mindmaps;
DROP POLICY IF EXISTS "Users can access own mindmap nodes" ON mindmap_nodes;
DROP POLICY IF EXISTS "Users can access own mindmap connections" ON mindmap_connections;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmaps;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_nodes;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_connections;

-- 新しいポリシーを作成
CREATE POLICY "Enable all operations for authenticated users" ON mindmaps
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

CREATE POLICY "Enable all operations for authenticated users" ON mindmap_nodes
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

CREATE POLICY "Enable all operations for authenticated users" ON mindmap_connections
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

-- 確認用クエリ
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY tablename, policyname;