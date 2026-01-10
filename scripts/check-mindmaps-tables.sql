-- Mindmaps関連テーブルの存在確認とRLS状態チェック

-- テーブル存在確認
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY table_name;

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
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY tablename, policyname;

-- テーブル構造確認
\d mindmaps;
\d mindmap_nodes;
\d mindmap_connections;