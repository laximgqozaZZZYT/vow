-- Admin Access Tables Migration
-- Requirements: 13.1, 13.2, 13.3

-- ============================================================================
-- 7. Admin Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = never expires
  granted_by TEXT NOT NULL DEFAULT 'database', -- 'env_config' or 'database'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_expires_at ON admin_users(expires_at);

-- RLS (service_role only - no user access)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage admin users" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 8. Admin Audit Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'ai_habit_parse', 'ai_habit_edit', 'ai_suggest', 'slack_nl', etc.
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user_id ON admin_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- RLS (service_role only - no user access)
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage admin audit logs" ON admin_audit_logs
  FOR ALL USING (auth.role() = 'service_role');
