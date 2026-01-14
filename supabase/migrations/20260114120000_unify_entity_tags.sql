-- エンティティタグテーブルの統合
-- diary_card_tags, goal_tags, habit_tags を entity_tags に統合

-- 汎用的なエンティティタグテーブルを作成
CREATE TABLE IF NOT EXISTS entity_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('diary_card', 'goal', 'habit', 'activity', 'mindmap')),
    entity_id TEXT NOT NULL,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_type, entity_id, tag_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_owner ON entity_tags(owner_type, owner_id);

-- Row Level Security (RLS) 設定
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON entity_tags
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

-- 既存のデータを移行
-- diary_card_tags から entity_tags へ
INSERT INTO entity_tags (id, entity_type, entity_id, tag_id, owner_type, owner_id, created_at)
SELECT id, 'diary_card', diary_card_id, tag_id, owner_type, owner_id, created_at
FROM diary_card_tags
ON CONFLICT (entity_type, entity_id, tag_id) DO NOTHING;

-- goal_tags から entity_tags へ
INSERT INTO entity_tags (id, entity_type, entity_id, tag_id, owner_type, owner_id, created_at)
SELECT id, 'goal', goal_id, tag_id, owner_type, owner_id, created_at
FROM goal_tags
ON CONFLICT (entity_type, entity_id, tag_id) DO NOTHING;

-- habit_tags から entity_tags へ
INSERT INTO entity_tags (id, entity_type, entity_id, tag_id, owner_type, owner_id, created_at)
SELECT id, 'habit', habit_id, tag_id, owner_type, owner_id, created_at
FROM habit_tags
ON CONFLICT (entity_type, entity_id, tag_id) DO NOTHING;

-- 古いテーブルを削除
DROP TABLE IF EXISTS diary_card_tags CASCADE;
DROP TABLE IF EXISTS goal_tags CASCADE;
DROP TABLE IF EXISTS habit_tags CASCADE;
