-- タグシステムの追加
-- Habit と Goal に複数のタグを付与できるようにする

-- Tags テーブル（タグマスター）
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(owner_type, owner_id, name)
);

-- Habit Tags テーブル（Habit と Tag の多対多関係）
CREATE TABLE IF NOT EXISTS habit_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(habit_id, tag_id)
);

-- Goal Tags テーブル（Goal と Tag の多対多関係）
CREATE TABLE IF NOT EXISTS goal_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(goal_id, tag_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_tags_owner ON tags(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_habit_tags_habit_id ON habit_tags(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_tags_tag_id ON habit_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_habit_tags_owner ON habit_tags(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_goal_tags_goal_id ON goal_tags(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_tags_tag_id ON goal_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_goal_tags_owner ON goal_tags(owner_type, owner_id);

-- Row Level Security (RLS) 設定
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_tags ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー
CREATE POLICY "Enable all operations for authenticated users" ON tags
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

CREATE POLICY "Enable all operations for authenticated users" ON habit_tags
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

CREATE POLICY "Enable all operations for authenticated users" ON goal_tags
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
