-- Migration: Add deferred suggestions table for MOC section
-- Description: Create table to store AI suggestions that users defer for later review

-- =============================================================================
-- Create deferred_suggestions table
-- =============================================================================

CREATE TABLE IF NOT EXISTS deferred_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Suggestion details
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('habit', 'goal')),
  suggestion_data JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'coach' CHECK (source IN ('coach', 'manager', 'analysis', 'manual')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'snoozed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Related entities
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  accepted_entity_id UUID, -- ID of habit/goal created from this suggestion

  -- Snooze and expiration
  snooze_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- User notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Create indexes
-- =============================================================================

-- User lookup with status filter (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_deferred_suggestions_user_status
  ON deferred_suggestions(user_id, status);

-- User lookup with type filter
CREATE INDEX IF NOT EXISTS idx_deferred_suggestions_user_type
  ON deferred_suggestions(user_id, suggestion_type);

-- User lookup ordered by creation
CREATE INDEX IF NOT EXISTS idx_deferred_suggestions_user_created
  ON deferred_suggestions(user_id, created_at DESC);

-- Snoozed suggestions due check
CREATE INDEX IF NOT EXISTS idx_deferred_suggestions_snooze
  ON deferred_suggestions(status, snooze_until)
  WHERE status = 'snoozed';

-- Expired suggestions cleanup
CREATE INDEX IF NOT EXISTS idx_deferred_suggestions_expires
  ON deferred_suggestions(expires_at)
  WHERE expires_at IS NOT NULL;

-- =============================================================================
-- Create trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_deferred_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deferred_suggestions_updated_at ON deferred_suggestions;
CREATE TRIGGER trigger_deferred_suggestions_updated_at
  BEFORE UPDATE ON deferred_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_deferred_suggestions_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE deferred_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON deferred_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own suggestions
CREATE POLICY "Users can create own suggestions"
  ON deferred_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own suggestions
CREATE POLICY "Users can update own suggestions"
  ON deferred_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own suggestions
CREATE POLICY "Users can delete own suggestions"
  ON deferred_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "Service role has full access to suggestions"
  ON deferred_suggestions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE deferred_suggestions IS 'Stores AI suggestions deferred by users for later review (MOC feature)';
COMMENT ON COLUMN deferred_suggestions.suggestion_type IS 'Type of suggestion: habit or goal';
COMMENT ON COLUMN deferred_suggestions.suggestion_data IS 'JSON data containing the suggestion details';
COMMENT ON COLUMN deferred_suggestions.source IS 'Source of the suggestion: coach, manager, analysis, or manual';
COMMENT ON COLUMN deferred_suggestions.status IS 'Current status: pending, accepted, dismissed, or snoozed';
COMMENT ON COLUMN deferred_suggestions.priority IS 'Suggestion priority: low, medium, or high';
COMMENT ON COLUMN deferred_suggestions.snooze_until IS 'When snoozed, the timestamp when to resurface';
COMMENT ON COLUMN deferred_suggestions.expires_at IS 'Optional expiration timestamp for time-sensitive suggestions';
COMMENT ON COLUMN deferred_suggestions.accepted_entity_id IS 'UUID of the habit/goal created when suggestion was accepted';
