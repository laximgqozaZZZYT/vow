-- タグシステムの統合
-- diary_tagsをtagsに統合し、diary_card_tagsテーブルを追加

-- 既存のdiary_tagsのデータをtagsに移行
INSERT INTO tags (id, name, color, owner_type, owner_id, created_at, updated_at)
SELECT id, name, color, owner_type, owner_id, created_at, updated_at
FROM diary_tags
ON CONFLICT (owner_type, owner_id, name) DO NOTHING;

-- Diary Card Tags テーブル（Diary CardとTagの多対多関係）
CREATE TABLE IF NOT EXISTS diary_card_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    diary_card_id TEXT NOT NULL REFERENCES diary_cards(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(diary_card_id, tag_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_diary_card_tags_diary_card_id ON diary_card_tags(diary_card_id);
CREATE INDEX IF NOT EXISTS idx_diary_card_tags_tag_id ON diary_card_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_diary_card_tags_owner ON diary_card_tags(owner_type, owner_id);

-- Row Level Security (RLS) 設定
ALTER TABLE diary_card_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON diary_card_tags
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

-- diary_tagsテーブルを削除（データは既にtagsに移行済み）
DROP TABLE IF EXISTS diary_tags CASCADE;
