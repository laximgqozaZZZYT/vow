-- Step 2: RLS状態とポリシー確認
-- 安全な確認クエリのみ

-- RLS有効状態確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY tablename;

-- 現在のRLSポリシー確認
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY tablename, policyname;