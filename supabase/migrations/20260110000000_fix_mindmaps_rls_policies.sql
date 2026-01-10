-- Mindmaps関連テーブルのRLSポリシー修正
-- 既存のポリシーを削除（エラーが出ても問題なし）
DROP POLICY IF EXISTS "Users can access own mindmaps" ON mindmaps;
DROP POLICY IF EXISTS "Users can access own mindmap nodes" ON mindmap_nodes;
DROP POLICY IF EXISTS "Users can access own mindmap connections" ON mindmap_connections;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmaps;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_nodes;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_connections;

-- Mindmapsテーブルのポリシー
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

-- Mindmap Nodesテーブルのポリシー
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

-- Mindmap Connectionsテーブルのポリシー
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