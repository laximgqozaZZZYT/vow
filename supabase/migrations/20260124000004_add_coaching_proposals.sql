-- =================================================================
-- Coaching Proposals Table
-- Stores workload coaching proposals for habits
-- =================================================================

-- Coaching proposals table
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
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_user_id ON coaching_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_habit_id ON coaching_proposals(habit_id);
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_status ON coaching_proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coaching_proposals_expires ON coaching_proposals(expires_at) WHERE status = 'pending';

-- RLS Policies
ALTER TABLE coaching_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coaching proposals" ON coaching_proposals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own coaching proposals" ON coaching_proposals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can manage coaching proposals" ON coaching_proposals
  FOR ALL USING (auth.role() = 'service_role');

-- =================================================================
-- Workload Coaching History Table
-- Tracks all coaching actions for analytics
-- =================================================================

CREATE TABLE IF NOT EXISTS workload_coaching_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES coaching_proposals(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('adjustment_applied', 'baby_step_applied', 'recovery_applied', 'dismissed', 'snoozed', 'expired')),
  previous_target_count INTEGER NOT NULL,
  new_target_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coaching_history_user_id ON workload_coaching_history(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_history_habit_id ON workload_coaching_history(habit_id);
CREATE INDEX IF NOT EXISTS idx_coaching_history_created ON workload_coaching_history(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE workload_coaching_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coaching history" ON workload_coaching_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage coaching history" ON workload_coaching_history
  FOR ALL USING (auth.role() = 'service_role');

-- =================================================================
-- Add original_target_count to habits table for recovery tracking
-- =================================================================

ALTER TABLE habits ADD COLUMN IF NOT EXISTS original_target_count INTEGER;

-- Comment
COMMENT ON TABLE coaching_proposals IS 'Stores workload coaching proposals for habits';
COMMENT ON TABLE workload_coaching_history IS 'Tracks all coaching actions for analytics';
COMMENT ON COLUMN habits.original_target_count IS 'Original target count before coaching adjustment, used for recovery';
