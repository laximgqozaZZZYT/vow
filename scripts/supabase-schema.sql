-- Supabase用テーブル作成スクリプト
-- SQL Editorで実行

-- Goal table
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    details TEXT,
    due_date TIMESTAMPTZ,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    parent_id TEXT REFERENCES goals(id),
    owner_type TEXT,
    owner_id TEXT,
    domain_codes TEXT[] DEFAULT '{}', -- 関連する職業分類ドメインコードの配列
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habit table
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    goal_id TEXT NOT NULL REFERENCES goals(id),
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    must INTEGER,
    duration INTEGER,
    reminders JSONB,
    due_date TIMESTAMPTZ,
    time TEXT,
    end_time TEXT,
    repeat TEXT,
    timings JSONB,
    outdates JSONB,
    all_day BOOLEAN,
    notes TEXT,
    workload_unit TEXT,
    workload_total INTEGER,
    workload_per_count INTEGER,
    completed BOOLEAN DEFAULT false,
    last_completed_at TIMESTAMPTZ,
    owner_type TEXT,
    owner_id TEXT,
    domain_codes TEXT[] DEFAULT '{}', -- 関連する職業分類ドメインコードの配列
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for habits domain_codes
CREATE INDEX IF NOT EXISTS idx_habits_domains ON habits USING GIN(domain_codes);

-- Activity table
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    kind TEXT NOT NULL,
    habit_id TEXT NOT NULL,
    habit_name TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    amount INTEGER,
    prev_count INTEGER,
    new_count INTEGER,
    duration_seconds INTEGER,
    memo TEXT,
    owner_type TEXT,
    owner_id TEXT
);

-- Preference table
CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(key, owner_type, owner_id)
);

-- DiaryCard table
CREATE TABLE IF NOT EXISTS diary_cards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    front_md TEXT NOT NULL,
    back_md TEXT NOT NULL,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DiaryTag table
CREATE TABLE IF NOT EXISTS diary_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    color TEXT,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(owner_type, owner_id, name)
);

-- Mindmap tables
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

-- User table (Supabaseのauth.usersと連携)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    supabase_user_id UUID REFERENCES auth.users(id) UNIQUE,
    timezone TEXT DEFAULT 'Asia/Tokyo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guest table
CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    merged_into_user_id TEXT,
    merged_at TIMESTAMPTZ
);

-- Session table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    guest_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_goals_parent_id ON goals(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_goals_domains ON goals USING GIN(domain_codes);
CREATE INDEX IF NOT EXISTS idx_habits_goal_id ON habits(goal_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner ON habits(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_preferences_owner ON preferences(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_cards_owner ON diary_cards(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_cards_created_at ON diary_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_diary_tags_owner ON diary_tags(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_id);
CREATE INDEX IF NOT EXISTS idx_mindmaps_owner ON mindmaps(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_mindmap_id ON mindmap_nodes(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_owner ON mindmap_nodes(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_connections_mindmap_id ON mindmap_connections(mindmap_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_connections_owner ON mindmap_connections(owner_type, owner_id);

-- Row Level Security (RLS) 設定
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_connections ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー（認証ユーザーは自分のデータのみアクセス可能）
CREATE POLICY "Users can access own goals" ON goals
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL  -- ゲストデータ
    );

CREATE POLICY "Users can access own habits" ON habits
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own activities" ON activities
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own preferences" ON preferences
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own diary cards" ON diary_cards
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own diary tags" ON diary_tags
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own mindmaps" ON mindmaps
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own mindmap nodes" ON mindmap_nodes
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

CREATE POLICY "Users can access own mindmap connections" ON mindmap_connections
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );

-- Habit relations table (related habits)
CREATE TABLE IF NOT EXISTS habit_relations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    related_habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    relation TEXT NOT NULL CHECK (relation IN ('main','sub','next')),
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_relations_habit_id ON habit_relations(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_relations_related_habit_id ON habit_relations(related_habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_relations_owner ON habit_relations(owner_type, owner_id);

ALTER TABLE habit_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own habit relations" ON habit_relations
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );