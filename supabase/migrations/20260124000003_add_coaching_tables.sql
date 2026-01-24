-- Workload Coaching Tables Migration
-- Requirements: 10.1, 10.2, 10.3, 10.4, 10.5

-- ============================================================================
-- 9. Coaching Proposals Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS coaching_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('workload_adjustment', 'baby_step', 'partial_recovery', 'full_recovery')),
  current_target_count INTEGER NOT NULL,
  proposed_target_count INTEGER NOT NULL,
  original_target_count INTEGER, -- For recovery proposals
  workload_unit TEXT,
  reason TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'snoozed', 'expired')),
  dismiss_count INTEGER NOT NULL DEFAULT 0,
  dismissed_until TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_user_id ON coaching_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_habit_id ON coaching_proposals(habit_id);
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_status ON coaching_proposals(status);
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_user_status ON coaching_proposals(user_id, status);

-- RLS
ALTER TABLE coaching_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coaching proposals" ON coaching_proposals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own coaching proposals" ON coaching_proposals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can manage coaching proposals" ON coaching_proposals
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 10. Workload Coaching History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS workload_coaching_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES coaching_proposals(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('adjustment_applied', 'baby_step_applied', 'recovery_applied', 'dismissed', 'snoozed')),
  previous_target_count INTEGER NOT NULL,
  new_target_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workload_coaching_history_user_id ON workload_coaching_history(user_id);
CREATE INDEX IF NOT EXISTS idx_workload_coaching_history_habit_id ON workload_coaching_history(habit_id);
CREATE INDEX IF NOT EXISTS idx_workload_coaching_history_created_at ON workload_coaching_history(created_at);

-- RLS
ALTER TABLE workload_coaching_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coaching history" ON workload_coaching_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage coaching history" ON workload_coaching_history
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Helper function to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_token_quotas_updated_at
  BEFORE UPDATE ON token_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coaching_proposals_updated_at
  BEFORE UPDATE ON coaching_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
