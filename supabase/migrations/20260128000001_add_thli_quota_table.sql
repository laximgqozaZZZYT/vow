-- THLI Assessment Quota Table Migration
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7

-- ============================================================================
-- 1. Create THLI Assessment Quotas Table
-- Separate from token_quotas to manage THLI-24 assessment limits
-- Requirements: 7.1, 7.2
-- ============================================================================

CREATE TABLE IF NOT EXISTS thli_assessment_quotas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL DEFAULT 'thli_assessments',
  quota_used INTEGER NOT NULL DEFAULT 0,
  quota_limit INTEGER NOT NULL DEFAULT 10,  -- Free users: 10, Premium: -1 (unlimited)
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one quota record per user per period
  CONSTRAINT thli_assessment_quotas_user_period_unique 
    UNIQUE (user_id, period_start)
);

-- Add constraint for quota_used (must be non-negative)
ALTER TABLE thli_assessment_quotas ADD CONSTRAINT thli_assessment_quotas_used_non_negative
  CHECK (quota_used >= 0);

-- Add constraint for quota_limit (-1 for unlimited, or positive)
ALTER TABLE thli_assessment_quotas ADD CONSTRAINT thli_assessment_quotas_limit_valid
  CHECK (quota_limit = -1 OR quota_limit > 0);

-- Indexes for thli_assessment_quotas
CREATE INDEX IF NOT EXISTS idx_thli_quotas_user_id ON thli_assessment_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_thli_quotas_period ON thli_assessment_quotas(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_thli_quotas_user_period ON thli_assessment_quotas(user_id, period_start DESC);

-- Comments for thli_assessment_quotas
COMMENT ON TABLE thli_assessment_quotas IS 'Manages THLI-24 assessment quotas for users. Free users get 10/month, premium users get unlimited (-1).';
COMMENT ON COLUMN thli_assessment_quotas.quota_type IS 'Type of quota: thli_assessments';
COMMENT ON COLUMN thli_assessment_quotas.quota_used IS 'Number of assessments used in current period';
COMMENT ON COLUMN thli_assessment_quotas.quota_limit IS 'Maximum assessments allowed. -1 indicates unlimited (premium users)';
COMMENT ON COLUMN thli_assessment_quotas.period_start IS 'Start of the quota period (first day of month)';
COMMENT ON COLUMN thli_assessment_quotas.period_end IS 'End of the quota period (last day of month)';

-- ============================================================================
-- 2. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE thli_assessment_quotas ENABLE ROW LEVEL SECURITY;

-- Users can view their own quota
CREATE POLICY "Users can view own thli quota" ON thli_assessment_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all quotas
CREATE POLICY "Service can manage thli quotas" ON thli_assessment_quotas
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_thli_quota_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thli_quota_updated_at ON thli_assessment_quotas;

CREATE TRIGGER trigger_update_thli_quota_updated_at
  BEFORE UPDATE ON thli_assessment_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_thli_quota_updated_at();

-- ============================================================================
-- 4. Helper Function to Get Current Month Period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_month_period()
RETURNS TABLE (period_start TIMESTAMPTZ, period_end TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT 
    date_trunc('month', NOW())::TIMESTAMPTZ AS period_start,
    (date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second')::TIMESTAMPTZ AS period_end;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_month_period() IS 'Returns the start and end timestamps for the current month period';

-- ============================================================================
-- 5. Function to Initialize Quota for New User
-- Requirements: 7.1, 7.2
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_thli_quota(
  p_user_id UUID,
  p_is_premium BOOLEAN DEFAULT FALSE
)
RETURNS thli_assessment_quotas AS $$
DECLARE
  v_quota_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_result thli_assessment_quotas;
BEGIN
  -- Set quota limit based on plan
  -- Requirement 7.1: Free users get 10 assessments/month
  -- Requirement 7.2: Premium users get unlimited (-1)
  IF p_is_premium THEN
    v_quota_limit := -1;
  ELSE
    v_quota_limit := 10;
  END IF;
  
  -- Get current month period
  SELECT * INTO v_period_start, v_period_end FROM get_current_month_period();
  
  -- Insert or update quota record
  INSERT INTO thli_assessment_quotas (
    user_id,
    quota_type,
    quota_used,
    quota_limit,
    period_start,
    period_end
  ) VALUES (
    p_user_id,
    'thli_assessments',
    0,
    v_quota_limit,
    v_period_start,
    v_period_end
  )
  ON CONFLICT (user_id, period_start) 
  DO UPDATE SET
    quota_limit = v_quota_limit,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_thli_quota(UUID, BOOLEAN) IS 'Initializes THLI assessment quota for a user. Free users get 10/month, premium users get unlimited.';
