-- =================================================================
-- AI Suggestion History Table
-- Stores AI-generated habit and goal suggestions for later reference
-- =================================================================

-- AI suggestion history table
CREATE TABLE IF NOT EXISTS ai_suggestion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('habit', 'goal')),
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  suggestion_data JSONB NOT NULL,
  -- suggestion_data structure:
  -- For habits: { name, type, frequency, suggestedTargetCount, workloadUnit, reason, confidence }
  -- For goals: { name, description, icon, reason, suggestedHabits }
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  accepted_entity_id TEXT, -- ID of created habit/goal if accepted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_history_user_id ON ai_suggestion_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_history_user_type ON ai_suggestion_history(user_id, suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_history_goal_id ON ai_suggestion_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_history_status ON ai_suggestion_history(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_history_created ON ai_suggestion_history(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE ai_suggestion_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestion history" ON ai_suggestion_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestion history" ON ai_suggestion_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can manage suggestion history" ON ai_suggestion_history
  FOR ALL USING (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE ai_suggestion_history IS 'Stores AI-generated habit and goal suggestions for user reference';
