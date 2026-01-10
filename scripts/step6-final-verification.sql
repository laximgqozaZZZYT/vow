-- Step 6: 最終確認
-- 修正が正しく適用されたかの確認

-- テーブル存在確認
SELECT 'Tables exist:' as status;
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY table_name;

-- RLS状態確認
SELECT 'RLS Status:' as status;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY tablename;

-- ポリシー確認
SELECT 'Policies:' as status;
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY tablename, policyname;