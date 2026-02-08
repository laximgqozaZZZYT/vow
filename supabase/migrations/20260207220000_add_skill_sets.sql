-- Skill Sets機能の追加
-- Note + Sticky'nアイテムから構成されるタスクユニット

-- ============================================================================
-- 1. notes テーブル - Skill Setプロンプト用の再利用可能なMarkdownテキストブロック
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. skill_sets テーブル - Note + Sticky'nアイテムから構成されるタスクユニット
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_sets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    execution_result JSONB,
    last_executed_at TIMESTAMPTZ,
    display_order INTEGER NOT NULL DEFAULT 0,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. skill_set_stickies テーブル - skill_setsとstickiesのリンク
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_set_stickies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    skill_set_id TEXT NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(skill_set_id, sticky_id)
);

-- ============================================================================
-- 4. skill_set_goals テーブル - skill_setsとgoalsのリンク
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_set_goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    skill_set_id TEXT NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(skill_set_id, goal_id)
);

-- ============================================================================
-- 5. skill_set_habits テーブル - skill_setsとhabitsのリンク
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_set_habits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    skill_set_id TEXT NOT NULL REFERENCES skill_sets(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(skill_set_id, habit_id)
);

-- ============================================================================
-- RLSポリシーの設定
-- ============================================================================

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_set_stickies ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_set_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_set_habits ENABLE ROW LEVEL SECURITY;

-- notesテーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON notes
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

-- skill_setsテーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON skill_sets
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

-- skill_set_stickiesテーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON skill_set_stickies
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

-- skill_set_goalsテーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON skill_set_goals
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

-- skill_set_habitsテーブルのポリシー
CREATE POLICY "Enable all operations for authenticated users" ON skill_set_habits
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

-- ============================================================================
-- インデックスの作成
-- ============================================================================

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_type, owner_id);

-- skill_sets
CREATE INDEX IF NOT EXISTS idx_skill_sets_owner ON skill_sets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_skill_sets_status ON skill_sets(status);
CREATE INDEX IF NOT EXISTS idx_skill_sets_note_id ON skill_sets(note_id);

-- skill_set_stickies
CREATE INDEX IF NOT EXISTS idx_skill_set_stickies_skill_set ON skill_set_stickies(skill_set_id);
CREATE INDEX IF NOT EXISTS idx_skill_set_stickies_sticky ON skill_set_stickies(sticky_id);

-- skill_set_goals
CREATE INDEX IF NOT EXISTS idx_skill_set_goals_skill_set ON skill_set_goals(skill_set_id);
CREATE INDEX IF NOT EXISTS idx_skill_set_goals_goal ON skill_set_goals(goal_id);

-- skill_set_habits
CREATE INDEX IF NOT EXISTS idx_skill_set_habits_skill_set ON skill_set_habits(skill_set_id);
CREATE INDEX IF NOT EXISTS idx_skill_set_habits_habit ON skill_set_habits(habit_id);

-- ============================================================================
-- updated_at自動更新トリガー
-- ============================================================================

-- トリガー関数は20260124000003_add_coaching_tables.sqlで既に作成済み
-- CREATE OR REPLACE で安全に再定義（既存関数がある場合は上書き、ない場合は新規作成）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- notesテーブルにトリガーを適用
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- skill_setsテーブルにトリガーを適用
CREATE TRIGGER update_skill_sets_updated_at
    BEFORE UPDATE ON skill_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
