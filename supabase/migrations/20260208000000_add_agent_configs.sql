-- Agent Configurations Table
-- Stores user-customizable agent settings (instructions, model, tools)

CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,  -- e.g., 'habit-coach', 'goal-planner', 'progress-tracker'

  -- Agent metadata
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🤖',

  -- Agent behavior configuration (AGENTS.md equivalent)
  instructions TEXT NOT NULL,  -- System prompt / AGENTS.md content
  model TEXT DEFAULT 'gpt-4o',  -- AI model to use
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,

  -- Tools configuration (JSON array of enabled tool IDs)
  enabled_tools JSONB DEFAULT '[]'::jsonb,

  -- Custom tools defined by user (future feature)
  custom_tools JSONB DEFAULT '[]'::jsonb,

  -- Agent state
  enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique agent per user
  UNIQUE(user_id, agent_id)
);

-- Create index for faster lookups
CREATE INDEX idx_agent_configs_user_id ON agent_configs(user_id);
CREATE INDEX idx_agent_configs_agent_id ON agent_configs(agent_id);

-- Enable RLS
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own agent configs"
  ON agent_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent configs"
  ON agent_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent configs"
  ON agent_configs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own agent configs"
  ON agent_configs FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agent_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_configs_updated_at
  BEFORE UPDATE ON agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_configs_updated_at();

-- Insert default agent configurations (as system defaults, not user-specific)
-- Users will get these as templates when they first access agent settings

-- Create a function to get or create user's agent config with defaults
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
BEGIN
  -- Try to get existing config
  SELECT * INTO v_config FROM agent_configs
  WHERE user_id = p_user_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN v_config;
  END IF;

  -- Set defaults based on agent_id
  CASE p_agent_id
    WHEN 'habit-coach' THEN
      v_default_name := 'Habit Coach';
      v_default_icon := '🎯';
      v_default_description := '習慣形成と維持のエキスパート';
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

**ツールを使用する理由：**
ツールを使用することで、フロントエンドに候補ボタンが表示され、ユーザーがワンクリックで習慣を追加できます。

**禁止事項：**
- 習慣をテキストだけで列挙すること
- ツールを使わずにアドバイスを返すこと

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
- 列挙型の回答（「〇〇がおすすめです」など）→ 必ず suggest_goals ツールを使用

**ツールを使用する理由：**
ツールを使用することで、フロントエンドに候補ボタンが表示され、ユーザーがワンクリックで目標を追加できます。

**禁止事項：**
- 目標やマイルストーンをテキストだけで列挙すること
- ツールを使わずにアドバイスを返すこと

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
- 進捗データを提示する → 必ずツールを使用してデータを取得

**ツールを使用する理由：**
ツールを使用することで、フロントエンドに構造化されたデータが表示され、ユーザーが視覚的に進捗を確認できます。

**禁止事項：**
- 進捗データをテキストだけで説明すること
- ツールを使わずに分析結果を返すこと

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
      v_default_instructions := 'あなたはVOWアプリのAIアシスタントです。ユーザーの質問に丁寧に回答してください。';
  END CASE;

  -- Create new config with defaults
  INSERT INTO agent_configs (
    user_id, agent_id, name, description, icon, instructions
  ) VALUES (
    p_user_id, p_agent_id, v_default_name, v_default_description, v_default_icon, v_default_instructions
  )
  RETURNING * INTO v_config;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_agent_config TO authenticated;

COMMENT ON TABLE agent_configs IS 'User-customizable AI agent configurations';
COMMENT ON COLUMN agent_configs.instructions IS 'System prompt / AGENTS.md content for the agent';
COMMENT ON COLUMN agent_configs.enabled_tools IS 'Array of tool IDs that are enabled for this agent';
