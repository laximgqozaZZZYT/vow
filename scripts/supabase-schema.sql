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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- User table (Supabaseのauth.usersと連携)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    supabase_user_id UUID REFERENCES auth.users(id) UNIQUE,
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
CREATE INDEX IF NOT EXISTS idx_habits_goal_id ON habits(goal_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner ON habits(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_preferences_owner ON preferences(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_cards_owner ON diary_cards(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_diary_cards_created_at ON diary_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_diary_tags_owner ON diary_tags(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_id);

-- Row Level Security (RLS) 設定
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_tags ENABLE ROW LEVEL SECURITY;

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