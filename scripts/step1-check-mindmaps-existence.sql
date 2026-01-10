-- Step 1: Mindmapsテーブルの存在確認
-- 安全な確認クエリのみ

-- テーブル存在確認
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('mindmaps', 'mindmap_nodes', 'mindmap_connections')
ORDER BY table_name;