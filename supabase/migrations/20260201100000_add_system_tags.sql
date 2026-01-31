-- システムタグ機能の追加
-- AI エージェントが作成したアイテムを識別するためのタグシステム

-- Tags テーブルにシステムタグ関連のカラムを追加
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon TEXT;

-- インデックス作成（システムタグの検索を高速化）
CREATE INDEX IF NOT EXISTS idx_tags_is_system ON tags(is_system) WHERE is_system = TRUE;

-- コメント追加
COMMENT ON COLUMN tags.is_system IS 'システムが自動作成したタグかどうか。TRUEの場合は削除不可';
COMMENT ON COLUMN tags.icon IS 'タグのアイコン（絵文字または識別子）';

-- AIエージェントシステムタグを作成する関数
-- ユーザーがログインした際に呼び出される
CREATE OR REPLACE FUNCTION ensure_ai_agent_tag(user_id_param TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tag_id TEXT;
BEGIN
  -- 既存のAIエージェントタグを検索
  SELECT id INTO tag_id
  FROM tags
  WHERE name = 'AIエージェント'
    AND owner_type = 'user'
    AND owner_id = user_id_param;

  -- タグが存在しない場合は作成
  IF tag_id IS NULL THEN
    INSERT INTO tags (
      id,
      name,
      color,
      icon,
      is_system,
      owner_type,
      owner_id,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid()::text,
      'AIエージェント',
      '#9333ea',  -- Purple
      'robot',
      TRUE,
      'user',
      user_id_param,
      NOW(),
      NOW()
    )
    RETURNING id INTO tag_id;
  END IF;

  RETURN tag_id;
END;
$$;

-- システムタグの削除を防ぐトリガー関数
CREATE OR REPLACE FUNCTION prevent_system_tag_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = TRUE THEN
    RAISE EXCEPTION 'System tags cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

-- トリガーを作成（存在する場合は置き換え）
DROP TRIGGER IF EXISTS prevent_system_tag_delete ON tags;
CREATE TRIGGER prevent_system_tag_delete
  BEFORE DELETE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_tag_deletion();
