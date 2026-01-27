-- Failed Assessments Table Migration
-- Requirements: 18.2, 18.7
-- Stores conversation state when THLI-24 assessments fail after retries
-- Enables assessment resumption from last question

-- ============================================================================
-- 1. Create Failed Assessments Table
-- Requirements: 18.2 - Save conversation state to failed_assessments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS failed_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  gathered_facts JSONB NOT NULL DEFAULT '{}',
  current_step TEXT NOT NULL CHECK (current_step IN ('audit', 'score', 'validation')),
  conversation_history JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resumption_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'resumed', 'completed', 'expired')),
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for failed_assessments
CREATE INDEX IF NOT EXISTS idx_failed_assessments_user ON failed_assessments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_habit ON failed_assessments(habit_id);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_token ON failed_assessments(resumption_token);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_expires ON failed_assessments(expires_at);
CREATE INDEX IF NOT EXISTS idx_failed_assessments_status ON failed_assessments(status);

-- Comments for failed_assessments
COMMENT ON TABLE failed_assessments IS 'Stores conversation state when THLI-24 assessments fail after retries, enabling resumption';
COMMENT ON COLUMN failed_assessments.conversation_id IS 'ID of the conversation for this assessment';
COMMENT ON COLUMN failed_assessments.session_id IS 'ID of the assessment session';
COMMENT ON COLUMN failed_assessments.gathered_facts IS 'JSON object containing facts gathered before failure (F01-F16)';
COMMENT ON COLUMN failed_assessments.current_step IS 'Current step in assessment: audit, score, or validation';
COMMENT ON COLUMN failed_assessments.conversation_history IS 'JSON array of conversation messages for resumption';
COMMENT ON COLUMN failed_assessments.error_message IS 'User-friendly error message';
COMMENT ON COLUMN failed_assessments.error_code IS 'Machine-readable error code';
COMMENT ON COLUMN failed_assessments.retry_count IS 'Number of retry attempts before failure';
COMMENT ON COLUMN failed_assessments.resumption_token IS 'Unique token for resuming the assessment (fa_xxx format)';
COMMENT ON COLUMN failed_assessments.status IS 'Status: failed (can resume), resumed (in progress), completed, expired';
COMMENT ON COLUMN failed_assessments.failed_at IS 'Timestamp when the assessment failed';
COMMENT ON COLUMN failed_assessments.resumed_at IS 'Timestamp when the assessment was resumed';
COMMENT ON COLUMN failed_assessments.expires_at IS 'Timestamp when the resumption token expires (7 days from failure)';

-- ============================================================================
-- 2. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on failed_assessments
ALTER TABLE failed_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policy for failed_assessments
-- Users can access their own failed assessments
CREATE POLICY "Users can access own failed assessments" ON failed_assessments
  FOR ALL USING (auth.uid() = user_id);

-- Service role can manage all failed assessments
CREATE POLICY "Service can manage failed assessments" ON failed_assessments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. Helper Function to Generate Resumption Token
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_resumption_token()
RETURNS TEXT AS $$
BEGIN
  RETURN 'fa_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_resumption_token() IS 'Generates a unique resumption token for failed assessments (fa_xxx format)';

-- ============================================================================
-- 4. Function to Clean Up Expired Failed Assessments
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_failed_assessments()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE failed_assessments
  SET status = 'expired'
  WHERE status = 'failed'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_failed_assessments() IS 'Marks expired failed assessments as expired (called by scheduled job)';
