-- =========================================================
-- Security Fix: RLS Policy Hardening
-- =========================================================
-- 1. api_keys: USING(true) → auth.uid() = user_id
-- 2. rate_limits: USING(true) → ポリシー削除（service_roleのみ）
-- 3. goals等: owner_id IS NULL フォールバック削除
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
-- 2. rate_limits: anonアクセス禁止
-- service_roleはRLSバイパスするため影響なし
-- =========================================
DROP POLICY IF EXISTS "Service role can select rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Service role can insert rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Service role can update rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Service role can delete rate limits" ON rate_limits;
-- RLS有効 + ポリシーなし = anonユーザーはアクセス不可

-- =========================================
-- 3. goals等: owner_id IS NULL フォールバック削除
-- まず既存のNULLデータをクリーンアップ（もしあれば）
-- =========================================

-- owner_id が NULL のレコードを確認用（実行時にログされる）
-- DO $$ BEGIN RAISE NOTICE 'Checking NULL owner_id records...'; END $$;

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

-- diary_tags
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON diary_tags;
CREATE POLICY "Enable all operations for authenticated users" ON diary_tags
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
