-- Create prompt_templates table for system-level prompt templates (markdown format)
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ja',
  content TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one template per key + locale combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_key_locale
  ON prompt_templates(template_key, locale);

-- Index for fast lookups by key
CREATE INDEX IF NOT EXISTS idx_prompt_templates_key
  ON prompt_templates(template_key);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_templates_updated_at();

-- Enable RLS (read-only for authenticated users, admin can write)
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read templates
CREATE POLICY "prompt_templates_select_policy" ON prompt_templates
  FOR SELECT TO authenticated
  USING (true);

-- Seed: resume-conversation template (Japanese)
INSERT INTO prompt_templates (template_key, locale, content, description) VALUES
('resume-conversation', 'ja',
E'# 会話再開プロンプト\n\n以下の過去の会話の続きをお願いします。前回の提案内容や文脈を踏まえて、会話を再開してください。\n\n## 過去の会話\n\n{{conversation_history}}\n\n## 指示\n\n上記の流れを踏まえて、続きをお願いします。\n\n- 前回提案した目標や習慣があれば、その進捗確認や改善提案をしてください\n- ユーザーの状況に変化がないか確認してください\n- 必要に応じて新しい提案も行ってください\n- 前回の会話のトーンや文脈を維持してください',
'履歴タブから会話を再開する際に使用するプロンプトテンプレート')
ON CONFLICT (template_key, locale) DO NOTHING;

-- Seed: resume-conversation template (English)
INSERT INTO prompt_templates (template_key, locale, content, description) VALUES
('resume-conversation', 'en',
E'# Conversation Resume Prompt\n\nPlease continue from the following previous conversation. Resume the discussion considering the prior context and proposals.\n\n## Previous Conversation\n\n{{conversation_history}}\n\n## Instructions\n\nBased on the above context, please continue.\n\n- If there were previous goal or habit proposals, check on their progress or suggest improvements\n- Check if the user''s situation has changed\n- Make new proposals as needed\n- Maintain the tone and context from the previous conversation',
'Prompt template used when resuming a conversation from the history tab')
ON CONFLICT (template_key, locale) DO NOTHING;
