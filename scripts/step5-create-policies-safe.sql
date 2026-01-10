-- Step 5: RLSポリシー作成（安全版）
-- DROP文を使わずに新しいポリシーのみ作成

-- Mindmapsテーブルのポリシー
CREATE POLICY "mindmaps_authenticated_users_policy" ON mindmaps
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
CREATE POLICY "mindmap_nodes_authenticated_users_policy" ON mindmap_nodes
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
CREATE POLICY "mindmap_connections_authenticated_users_policy" ON mindmap_connections
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