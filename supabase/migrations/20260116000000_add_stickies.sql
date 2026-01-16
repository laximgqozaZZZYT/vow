-- Sticky'n機能の追加
-- 一回性のTODO管理機能

-- Sticky'nテーブル
CREATE TABLE IF NOT EXISTS stickies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    display_order INTEGER DEFAULT 0
);

-- Sticky'n と Goal の関連テーブル
CREATE TABLE IF NOT EXISTS sticky_goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    UNIQUE(sticky_id, goal_id)
);

-- Sticky'n と Habit の関連テーブル
CREATE TABLE IF NOT EXISTS sticky_habits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    UNIQUE(sticky_id, habit_id)
);

-- Sticky'n と Tag の関連テーブル
CREATE TABLE IF NOT EXISTS sticky_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    UNIQUE(sticky_id, tag_id)
);

-- RLSポリシーの設定
ALTER TABLE stickies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticky_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticky_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticky_tags ENABLE ROW LEVEL SECURITY;

-- Sticky'nテーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON stickies
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

-- Sticky'n Goals関連テーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON sticky_goals
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

-- Sticky'n Habits関連テーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON sticky_habits
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

-- Sticky'n Tags関連テーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON sticky_tags
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

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_stickies_owner ON stickies(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_stickies_completed ON stickies(completed);
CREATE INDEX IF NOT EXISTS idx_stickies_display_order ON stickies(display_order);
CREATE INDEX IF NOT EXISTS idx_sticky_goals_sticky ON sticky_goals(sticky_id);
CREATE INDEX IF NOT EXISTS idx_sticky_goals_goal ON sticky_goals(goal_id);
CREATE INDEX IF NOT EXISTS idx_sticky_habits_sticky ON sticky_habits(sticky_id);
CREATE INDEX IF NOT EXISTS idx_sticky_habits_habit ON sticky_habits(habit_id);
CREATE INDEX IF NOT EXISTS idx_sticky_tags_sticky ON sticky_tags(sticky_id);
CREATE INDEX IF NOT EXISTS idx_sticky_tags_tag ON sticky_tags(tag_id);
