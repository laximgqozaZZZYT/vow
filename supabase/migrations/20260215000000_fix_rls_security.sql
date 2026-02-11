-- =========================================================
-- Security Fix: RLS Policy Hardening
-- =========================================================
-- 1. api_keys: USING(true) → auth.uid() = user_id
-- 2. rate_limits: スキップ（テーブル不在 — oauth_rate_limitsに改名済み）
-- 3. goals等: owner_id IS NULL フォールバック削除
-- 4. diary_tags: スキップ（テーブル不在 — tags/entity_tagsに改名済み）
-- =========================================================

BEGIN;

-- =========================================
-- 1. api_keys: ユーザースコープに制限
-- =========================================
DROP POLICY IF EXISTS "api_keys_select_policy" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert_policy" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update_policy" ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete_policy" ON api_keys;

CREATE POLICY "api_keys_select_policy" ON api_keys FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "api_keys_insert_policy" ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_keys_update_policy" ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "api_keys_delete_policy" ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- =========================================
-- 2. rate_limits: スキップ
-- テーブル「rate_limits」は存在しない（oauth_rate_limitsに改名済み）
-- oauth_rate_limitsはanon keyでアクセス不可を確認済み
-- =========================================

-- =========================================
-- 3. goals等: owner_id IS NULL フォールバック削除
-- NULL owner_idレコードが0件であることを確認済み (2026-02-11)
-- =========================================

-- habits/activities: マイグレーション外の不明ポリシーが残存していたため全削除
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies
               WHERE schemaname = 'public' AND tablename IN ('habits', 'activities')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 全テーブルのRLSを確実に有効化（冪等操作）
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_connections ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除して再作成
-- goals
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON goals;
CREATE POLICY "Enable all operations for authenticated users" ON goals
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- habits
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON habits;
CREATE POLICY "Enable all operations for authenticated users" ON habits
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- activities
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON activities;
CREATE POLICY "Enable all operations for authenticated users" ON activities
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- preferences
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON preferences;
CREATE POLICY "Enable all operations for authenticated users" ON preferences
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- diary_cards
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_cards;
CREATE POLICY "Enable all operations for authenticated users" ON diary_cards
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- diary_tags: スキップ（テーブル不在 — tags/entity_tagsに改名済み）

-- mindmaps
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmaps;
CREATE POLICY "Enable all operations for authenticated users" ON mindmaps
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- mindmap_nodes
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_nodes;
CREATE POLICY "Enable all operations for authenticated users" ON mindmap_nodes
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

-- mindmap_connections
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON mindmap_connections;
CREATE POLICY "Enable all operations for authenticated users" ON mindmap_connections
    FOR ALL USING (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            owner_type = 'user' AND owner_id = auth.uid()::text
            OR owner_type IS NULL
        )
    );

COMMIT;
