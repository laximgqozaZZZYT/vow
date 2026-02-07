-- Add role, capabilities, and is_builtin columns to agent_configs
-- Supports custom role management via backend API

-- New columns
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN DEFAULT false;

-- Set built-in flag and role for existing default agents
UPDATE agent_configs SET role = 'Coach', is_builtin = true,
  capabilities = '["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]'::jsonb
  WHERE agent_id = 'AICoach';

UPDATE agent_configs SET role = 'Coach', is_builtin = true,
  capabilities = '["習慣分析", "習慣提案", "スモールステップ生成"]'::jsonb
  WHERE agent_id = 'habit-coach';

UPDATE agent_configs SET role = 'Planner', is_builtin = true,
  capabilities = '["SMART目標作成", "目標提案", "マイルストーン分解", "優先順位付け"]'::jsonb
  WHERE agent_id = 'goal-planner';

UPDATE agent_configs SET role = 'Tracker', is_builtin = true,
  capabilities = '["進捗追跡", "レポート生成", "トレンド分析"]'::jsonb
  WHERE agent_id = 'progress-tracker';

-- Update the get_or_create_agent_config function to include new columns
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

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_agent_configs_role ON agent_configs(role);
CREATE INDEX IF NOT EXISTS idx_agent_configs_is_builtin ON agent_configs(is_builtin);

COMMENT ON COLUMN agent_configs.role IS 'Agent role type (Coach, Planner, Tracker, custom, etc.)';
COMMENT ON COLUMN agent_configs.capabilities IS 'JSON array of capability labels for display';
COMMENT ON COLUMN agent_configs.is_builtin IS 'Whether this is a built-in system agent (not deletable)';
