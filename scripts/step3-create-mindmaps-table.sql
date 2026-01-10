-- Step 3: Mindmapsテーブルが存在しない場合の作成
-- テーブルが存在しない場合のみ実行

CREATE TABLE IF NOT EXISTS mindmaps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mindmap_id TEXT NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT DEFAULT 120,
    height FLOAT DEFAULT 60,
    color TEXT DEFAULT '#ffffff',
    goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
    habit_id TEXT REFERENCES habits(id) ON DELETE SET NULL,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mindmap_connections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mindmap_id TEXT NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
    from_node_id TEXT NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    to_node_id TEXT NOT NULL REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_mindmaps_owner ON mindmaps(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_mindmap_id ON mindmap_nodes(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_owner ON mindmap_nodes(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_connections_mindmap_id ON mindmap_connections(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_connections_owner ON mindmap_connections(owner_type, owner_id);