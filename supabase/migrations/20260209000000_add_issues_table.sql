-- Issues Table
-- Stores issue reports from the chat interface with conversation references

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Issue content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cause TEXT,  -- 原因/問題の説明

  -- Conversation reference
  conversation_id UUID,  -- Reference to conversation if available
  message_ids TEXT[],    -- Array of message IDs for context

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Categorization
  category TEXT DEFAULT 'general' CHECK (category IN ('bug', 'feature', 'question', 'feedback', 'general')),

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_issues_user_id ON issues(user_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX idx_issues_conversation_id ON issues(conversation_id) WHERE conversation_id IS NOT NULL;

-- Enable RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can manage their own issues
CREATE POLICY "Users can view own issues"
  ON issues FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own issues"
  ON issues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issues"
  ON issues FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own issues"
  ON issues FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can read all issues (for CLI access)
CREATE POLICY "Service role can view all issues"
  ON issues FOR SELECT
  USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_issues_updated_at();

COMMENT ON TABLE issues IS 'Issue reports from chat interface with conversation references';
COMMENT ON COLUMN issues.cause IS 'Root cause or problem description from the user';
COMMENT ON COLUMN issues.conversation_id IS 'Reference to the conversation where the issue was reported';
COMMENT ON COLUMN issues.message_ids IS 'Array of message IDs that provide context for the issue';
