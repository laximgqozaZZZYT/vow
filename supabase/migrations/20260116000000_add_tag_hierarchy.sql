-- タグの親子関係を追加
-- タグ間の階層構造を実現する

-- tagsテーブルにparent_idカラムを追加
ALTER TABLE tags ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES tags(id) ON DELETE SET NULL;

-- parent_idのインデックスを作成
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);

-- 循環参照を防ぐための関数
CREATE OR REPLACE FUNCTION check_tag_hierarchy_cycle()
RETURNS TRIGGER AS $$
DECLARE
  current_id TEXT;
  visited_ids TEXT[];
BEGIN
  -- parent_idがNULLの場合は問題なし
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 自分自身を親にすることはできない
  IF NEW.id = NEW.parent_id THEN
    RAISE EXCEPTION 'A tag cannot be its own parent';
  END IF;

  -- 循環参照チェック
  current_id := NEW.parent_id;
  visited_ids := ARRAY[NEW.id];

  WHILE current_id IS NOT NULL LOOP
    -- 既に訪問したIDに到達したら循環参照
    IF current_id = ANY(visited_ids) THEN
      RAISE EXCEPTION 'Circular reference detected in tag hierarchy';
    END IF;

    visited_ids := array_append(visited_ids, current_id);

    -- 次の親を取得
    SELECT parent_id INTO current_id FROM tags WHERE id = current_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
DROP TRIGGER IF EXISTS check_tag_hierarchy_cycle_trigger ON tags;
CREATE TRIGGER check_tag_hierarchy_cycle_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON tags
  FOR EACH ROW
  EXECUTE FUNCTION check_tag_hierarchy_cycle();
