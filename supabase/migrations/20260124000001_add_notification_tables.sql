-- Notification System Tables Migration
-- Requirements: 12.1, 12.2, 12.3, 12.4

-- ============================================================================
-- 4. Notices Table (In-app notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'workload_coaching', 'habit_recovery', 'token_warning_70', 'token_warning_90', 'token_exhausted', 'subscription_renewed', 'subscription_payment_failed', 'habit_suggestion', 'weekly_report'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_type TEXT, -- 'coaching_proposal', 'recovery_proposal', 'token_warning', 'subscription', 'habit_suggestion'
  action_payload JSONB,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notices_user_id ON notices(user_id);
CREATE INDEX IF NOT EXISTS idx_notices_user_id_read ON notices(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notices_user_id_created ON notices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_type ON notices(type);

-- RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notices" ON notices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notices" ON notices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can manage notices" ON notices
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. Notification Preferences Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- In-app notifications
  in_app_workload_coaching BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_token_warning BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_weekly_report BOOLEAN NOT NULL DEFAULT TRUE,
  -- Slack notifications
  slack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  slack_workload_coaching BOOLEAN NOT NULL DEFAULT FALSE,
  slack_token_warning BOOLEAN NOT NULL DEFAULT TRUE,
  slack_weekly_report BOOLEAN NOT NULL DEFAULT TRUE,
  slack_notification_time TIME NOT NULL DEFAULT '09:00',
  -- Web Push notifications
  web_push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  web_push_daily_reminder BOOLEAN NOT NULL DEFAULT FALSE,
  web_push_daily_reminder_time TIME NOT NULL DEFAULT '08:00',
  web_push_workload_coaching BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can manage notification preferences" ON notification_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. Push Subscriptions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service can manage push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
