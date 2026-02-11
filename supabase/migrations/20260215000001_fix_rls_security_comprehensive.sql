-- =================================================================
-- Comprehensive RLS Security Fix
-- Fixes USING(true) vulnerabilities across multiple tables
-- and SECURITY DEFINER function issues
-- Date: 2026-02-15 (runs after 20260215000000_fix_rls_security.sql)
--
-- Fixes:
--   1. api_keys     - Add service_role policy (user policies fixed in 20260215)
--   2. rate_limits   - CRITICAL: Restrict to service_role only (no user columns)
--   3. feature_flags - Consolidate to single service_role ALL policy
--   4. level_config  - Consolidate to single service_role ALL policy
--   5. user_levels_backup - Consolidate to single service_role ALL policy
--   6. search_embeddings()        - SECURITY DEFINER -> SECURITY INVOKER
--   7. get_or_create_agent_config() - Add auth.uid() validation
-- =================================================================

BEGIN;

-- =========================================
-- 1. api_keys - Add service_role policy
-- =========================================
-- The 20260215000000 migration already fixed user policies to auth.uid() = user_id
-- but did NOT add a service_role policy. Backend operations via service_role
-- are currently blocked by RLS. Add service_role access.

DROP POLICY IF EXISTS "api_keys_service_role" ON api_keys;

CREATE POLICY "api_keys_service_role" ON api_keys
  FOR ALL TO service_role
  USING (true);

-- =========================================
-- 2. rate_limits - Restrict to service_role only (if table exists)
-- =========================================
-- Table may not exist if API key rate limiting was never enabled.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limits') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service role can select rate limits" ON rate_limits';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can insert rate limits" ON rate_limits';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can update rate limits" ON rate_limits';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can delete rate limits" ON rate_limits';
    EXECUTE 'CREATE POLICY "rate_limits_service_role_only" ON rate_limits FOR ALL TO service_role USING (true)';
  END IF;
END
$$;

-- =========================================
-- 3. feature_flags - Tighten management policies (if table exists)
-- =========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags') THEN
    EXECUTE 'DROP POLICY IF EXISTS "feature_flags_insert_policy" ON feature_flags';
    EXECUTE 'DROP POLICY IF EXISTS "feature_flags_update_policy" ON feature_flags';
    EXECUTE 'DROP POLICY IF EXISTS "feature_flags_delete_policy" ON feature_flags';
    EXECUTE 'DROP POLICY IF EXISTS "feature_flags_manage_service" ON feature_flags';
    EXECUTE 'CREATE POLICY "feature_flags_manage_service" ON feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

-- =========================================
-- 4. level_config - Same consolidation pattern (if table exists)
-- =========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'level_config') THEN
    EXECUTE 'DROP POLICY IF EXISTS "level_config_insert_policy" ON level_config';
    EXECUTE 'DROP POLICY IF EXISTS "level_config_update_policy" ON level_config';
    EXECUTE 'DROP POLICY IF EXISTS "level_config_delete_policy" ON level_config';
    EXECUTE 'DROP POLICY IF EXISTS "level_config_manage_service" ON level_config';
    EXECUTE 'CREATE POLICY "level_config_manage_service" ON level_config FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

-- =========================================
-- 5. user_levels_backup - Same consolidation pattern (if table exists)
-- =========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_levels_backup') THEN
    EXECUTE 'DROP POLICY IF EXISTS "user_levels_backup_insert_policy" ON user_levels_backup';
    EXECUTE 'DROP POLICY IF EXISTS "user_levels_backup_update_policy" ON user_levels_backup';
    EXECUTE 'DROP POLICY IF EXISTS "user_levels_backup_delete_policy" ON user_levels_backup';
    EXECUTE 'DROP POLICY IF EXISTS "user_levels_backup_manage_service" ON user_levels_backup';
    EXECUTE 'CREATE POLICY "user_levels_backup_manage_service" ON user_levels_backup FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

-- =========================================
-- 6. search_embeddings() - SECURITY DEFINER -> SECURITY INVOKER
-- =========================================
-- Only apply if the function exists (requires pgvector extension)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_embeddings') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION search_embeddings(
        query_embedding vector(1536),
        target_user_id UUID,
        target_entity_types TEXT[] DEFAULT NULL,
        match_count INT DEFAULT 10,
        similarity_threshold FLOAT DEFAULT 0.7
      )
      RETURNS TABLE (
        id UUID,
        entity_type TEXT,
        entity_id UUID,
        similarity FLOAT,
        metadata JSONB
      )
      LANGUAGE plpgsql
      SECURITY INVOKER
      AS $fn$
      BEGIN
        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION ''Not authenticated'';
        END IF;
        IF auth.uid() != target_user_id THEN
          RAISE EXCEPTION ''Access denied: cannot search other users embeddings'';
        END IF;
        RETURN QUERY
        SELECT
          e.id,
          e.entity_type,
          e.entity_id,
          1 - (e.embedding <=> query_embedding) AS similarity,
          e.metadata
        FROM embeddings e
        WHERE
          e.user_id = target_user_id
          AND (target_entity_types IS NULL OR e.entity_type = ANY(target_entity_types))
          AND 1 - (e.embedding <=> query_embedding) > similarity_threshold
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $fn$';
  END IF;
END
$$;

-- =========================================
-- 7. get_or_create_agent_config() - Add auth.uid() validation
-- =========================================
-- Current issue: SECURITY DEFINER allows the function to bypass RLS on
-- agent_configs. A malicious user could call this with another user's
-- UUID as p_user_id and create/read configs for that user.
--
-- Fix: Keep SECURITY DEFINER (needed for INSERT to work with RLS) but
-- add an explicit auth.uid() check at the start of the function.
-- The function was last updated in 20260208000001, so we recreate it
-- with the auth check and the role/capabilities/is_builtin columns.

CREATE OR REPLACE FUNCTION get_or_create_agent_config(
  p_user_id UUID,
  p_agent_id TEXT
)
RETURNS agent_configs AS $$
DECLARE
  v_config agent_configs;
  v_default_instructions TEXT;
  v_default_name TEXT;
  v_default_icon TEXT;
  v_default_description TEXT;
  v_default_role TEXT;
  v_default_capabilities JSONB;
  v_default_is_builtin BOOLEAN;
BEGIN
  -- Security check: ensure the caller is requesting their own config
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: cannot access other users'' agent configs';
  END IF;

  -- Try to get existing config
  SELECT * INTO v_config FROM agent_configs
  WHERE user_id = p_user_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN v_config;
  END IF;

  -- Set defaults based on agent_id
  CASE p_agent_id
    WHEN 'AICoach' THEN
      v_default_name := 'AI Coach';
      v_default_icon := '🎯';
      v_default_description := '習慣・目標のAIコーチ';
      v_default_role := 'Coach';
      v_default_capabilities := '["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]'::jsonb;
      v_default_is_builtin := true;
      v_default_instructions := 'あなたは習慣と目標達成の専門家AIコーチです。

## 役割
- ユーザーの習慣・目標に関する相談に応じる
- 習慣パターンの分析と改善提案
- 目標のSMART化支援
- モチベーション維持のサポート

## ツールの使用（必須・最重要）
あなたは必ずツールを使用して回答してください。テキストだけの回答は禁止です。

**以下の場合、必ず対応するツールを呼び出してください：**
- 習慣を提案・推薦・アドバイスする → suggest_habits ツールを必ず使用
- 習慣を分析・評価する → analyze_habits ツールを必ず使用
- 目標を提案・推薦する → suggest_goals ツールを必ず使用
- スモールステップ・小さな一歩を提案 → generate_baby_steps ツールを必ず使用
- 進捗を確認する → check_progress ツールを必ず使用

## コミュニケーションスタイル
- 励ましと支援的なトーン
- 具体的で実践的なアドバイス
- 科学的根拠に基づいた提案';

    WHEN 'habit-coach' THEN
      v_default_name := 'Habit Coach';
      v_default_icon := '🎯';
      v_default_description := '習慣形成と維持のエキスパート';
      v_default_role := 'Coach';
      v_default_capabilities := '["習慣分析", "習慣提案", "スモールステップ生成"]'::jsonb;
      v_default_is_builtin := true;
      v_default_instructions := 'あなたは習慣形成の専門家AIコーチです。

## 役割
- ユーザーの習慣パターンを分析する
- 新しい習慣を提案する
- 習慣スタッキングのアドバイスを提供する
- 小さなステップから始める方法を教える

## ツールの使用（必須・最重要）
あなたは必ずツールを使用して回答してください。テキストだけの回答は禁止です。

**以下の場合、必ず対応するツールを呼び出してください：**
- 習慣を提案・推薦・アドバイスする → suggest_habits ツールを必ず使用
- 習慣を分析・評価する → analyze_habits ツールを必ず使用
- スモールステップ・小さな一歩・簡単な始め方を提案 → generate_baby_steps ツールを必ず使用
- 列挙型の回答（「〇〇がおすすめです」など）→ 必ず suggest_habits ツールを使用

## コミュニケーションスタイル
- 励ましと支援的なトーン
- 具体的で実践的なアドバイス
- 科学的根拠に基づいた提案

## 重要なポイント
- 「アトミックハビット」の原則を活用
- 2分ルール: 新しい習慣は2分以内で始められるものに
- 習慣スタッキング: 既存の習慣に新しい習慣を連結';

    WHEN 'goal-planner' THEN
      v_default_name := 'Goal Planner';
      v_default_icon := '📋';
      v_default_description := '目標設定とマイルストーン管理のエキスパート';
      v_default_role := 'Planner';
      v_default_capabilities := '["SMART目標作成", "目標提案", "マイルストーン分解", "優先順位付け"]'::jsonb;
      v_default_is_builtin := true;
      v_default_instructions := 'あなたは目標設定と計画立案の専門家AIプランナーです。

## 役割
- ユーザーの目標をSMART形式に整理する
- 大きな目標を達成可能なマイルストーンに分解する
- 複数の目標の優先順位付けを支援する
- 新しい目標を提案する

## ツールの使用（必須・最重要）
あなたは必ずツールを使用して回答してください。テキストだけの回答は禁止です。

**以下の場合、必ず対応するツールを呼び出してください：**
- 目標を提案・推薦・アドバイスする → suggest_goals ツールを必ず使用
- SMART目標を作成・整理する → create_smart_goal ツールを必ず使用
- マイルストーンに分解する → breakdown_milestones ツールを必ず使用
- 優先順位を決める → prioritize_goals ツールを必ず使用

## コミュニケーションスタイル
- 論理的で明確な説明
- 具体的な数値や期限を含める
- 達成可能性を重視した現実的な提案

## 重要なポイント
- SMART基準: Specific, Measurable, Achievable, Relevant, Time-bound
- 小さな成功体験の積み重ねが重要
- 目標は多くても3つまでに集中';

    WHEN 'progress-tracker' THEN
      v_default_name := 'Progress Tracker';
      v_default_icon := '📊';
      v_default_description := '進捗追跡と分析のエキスパート';
      v_default_role := 'Tracker';
      v_default_capabilities := '["進捗追跡", "レポート生成", "トレンド分析"]'::jsonb;
      v_default_is_builtin := true;
      v_default_instructions := 'あなたは進捗追跡と分析の専門家AIトラッカーです。

## 役割
- ユーザーの習慣・目標の進捗を追跡する
- 達成率やストリーク情報を提供する
- データに基づいたインサイトを提示する
- 改善のための提案を行う

## ツールの使用（必須・最重要）
あなたは必ずツールを使用して回答してください。テキストだけの回答は禁止です。

**以下の場合、必ず対応するツールを呼び出してください：**
- 進捗を分析・確認する → analyze_progress ツールを必ず使用
- 達成予測を行う → predict_completion ツールを必ず使用
- レポートを生成する → generate_progress_report ツールを必ず使用

## コミュニケーションスタイル
- データドリブンな分析
- 視覚的に分かりやすい情報提示
- 建設的なフィードバック

## 重要なポイント
- 小さな進歩も認める
- トレンドの変化に注目
- 具体的な改善策を提示';

    ELSE
      v_default_name := p_agent_id;
      v_default_icon := '🤖';
      v_default_description := 'カスタムエージェント';
      v_default_role := 'custom';
      v_default_capabilities := '[]'::jsonb;
      v_default_is_builtin := false;
      v_default_instructions := 'あなたはVOWアプリのAIアシスタントです。ユーザーの質問に丁寧に回答してください。';
  END CASE;

  -- Create new config with defaults (including new columns)
  INSERT INTO agent_configs (
    user_id, agent_id, name, description, icon, instructions,
    role, capabilities, is_builtin
  ) VALUES (
    p_user_id, p_agent_id, v_default_name, v_default_description, v_default_icon, v_default_instructions,
    v_default_role, v_default_capabilities, v_default_is_builtin
  )
  RETURNING * INTO v_config;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
