-- ============================================================
-- RLS ポリシー一括厳格化 + NOT NULL 制約追加
-- 実行日: 2026-02-11
-- 対象: 19テーブル（skill_set系4 + 他15）
-- 前提: 全テーブルで NULL owner_id/owner_type レコード 0件 確認済み
-- ============================================================

-- Phase 1: skill_sets 関連 (4テーブル)
-- 実行済み: 2026-02-11

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON skill_sets;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON skill_set_stickies;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON skill_set_goals;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON skill_set_habits;

CREATE POLICY "Users can only access their own skill_sets" ON skill_sets
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "Users can only access their own skill_set_stickies" ON skill_set_stickies
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "Users can only access their own skill_set_goals" ON skill_set_goals
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "Users can only access their own skill_set_habits" ON skill_set_habits
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

-- Phase 2: 残り15テーブル一括修正
-- 実行済み: 2026-02-11

BEGIN;

-- 旧ポリシー全削除
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON activities;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_cards;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON entity_tags;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON goals;
DROP POLICY IF EXISTS "Users can access own habit relations" ON habit_relations;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON habits;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_connections;
DROP POLICY IF EXISTS "mindmap_connections_authenticated_users_policy" ON mindmap_connections;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_nodes;
DROP POLICY IF EXISTS "mindmap_nodes_authenticated_users_policy" ON mindmap_nodes;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmaps;
DROP POLICY IF EXISTS "mindmaps_authenticated_users_policy" ON mindmaps;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON notes;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON preferences;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON stickies;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON sticky_goals;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON sticky_habits;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON sticky_tags;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON tags;

-- 厳格ポリシー作成
CREATE POLICY "strict_owner_policy" ON activities
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON diary_cards
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON entity_tags
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON goals
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON habit_relations
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON habits
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON mindmap_connections
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON mindmap_nodes
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON mindmaps
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON notes
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON preferences
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON stickies
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON sticky_goals
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON sticky_habits
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON sticky_tags
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

CREATE POLICY "strict_owner_policy" ON tags
    FOR ALL USING (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text)
    WITH CHECK (auth.uid() IS NOT NULL AND owner_type = 'user' AND owner_id = auth.uid()::text);

-- NOT NULL 制約追加（notes は既に NOT NULL）
ALTER TABLE activities ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE activities ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE diary_cards ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE diary_cards ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE entity_tags ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE entity_tags ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE goals ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE goals ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE habit_relations ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE habit_relations ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE habits ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE habits ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE mindmap_connections ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE mindmap_connections ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE mindmap_nodes ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE mindmap_nodes ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE mindmaps ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE mindmaps ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE preferences ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE preferences ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE stickies ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE stickies ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE sticky_goals ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE sticky_goals ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE sticky_habits ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE sticky_habits ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE sticky_tags ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE sticky_tags ALTER COLUMN owner_type SET NOT NULL;
ALTER TABLE tags ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE tags ALTER COLUMN owner_type SET NOT NULL;

COMMIT;
