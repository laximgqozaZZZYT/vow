-- MindMapテーブルの詳細構造確認
-- 実際のカラム名と型を確認

-- 1. mindmapsテーブルの構造
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'mindmaps'
ORDER BY ordinal_position;

-- 2. mindmap_nodesテーブルの構造
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'mindmap_nodes'
ORDER BY ordinal_position;

-- 3. mindmap_connectionsテーブルの構造
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'mindmap_connections'
ORDER BY ordinal_position;

-- 4. 実際のデータ確認（最新5件）
SELECT 'mindmaps' as table_name, count(*) as record_count FROM mindmaps
UNION ALL
SELECT 'mindmap_nodes' as table_name, count(*) as record_count FROM mindmap_nodes
UNION ALL
SELECT 'mindmap_connections' as table_name, count(*) as record_count FROM mindmap_connections;

-- 5. 最新のmindmapデータ（存在する場合）
SELECT * FROM mindmaps ORDER BY created_at DESC LIMIT 3;

-- 6. 最新のmindmap_nodesデータ（存在する場合）
SELECT * FROM mindmap_nodes ORDER BY created_at DESC LIMIT 3;

-- 7. 最新のmindmap_connectionsデータ（存在する場合）
SELECT * FROM mindmap_connections ORDER BY created_at DESC LIMIT 3;