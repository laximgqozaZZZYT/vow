-- Migration: Add Slack notification preferences
-- Description: Adds Slack-related columns to notification_preferences table

-- Create notification_preferences table if not exists
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_type TEXT NOT NULL DEFAULT 'user',
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_type, owner_id)
);

-- Add Slack notification columns
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS slack_notifications_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS weekly_slack_report_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS weekly_report_day INTEGER DEFAULT 0;

ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS weekly_report_time TIME DEFAULT '09:00';

-- Enable RLS if not already enabled
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Users can access own notification preferences" ON notification_preferences;
CREATE POLICY "Users can access own notification preferences" ON notification_preferences
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
    );

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_preferences_owner ON notification_preferences(owner_type, owner_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN notification_preferences.slack_notifications_enabled IS 'Whether to send habit reminders via Slack';
COMMENT ON COLUMN notification_preferences.weekly_slack_report_enabled IS 'Whether to send weekly reports via Slack';
COMMENT ON COLUMN notification_preferences.weekly_report_day IS 'Day of week for weekly report (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN notification_preferences.weekly_report_time IS 'Time of day for weekly report (HH:MM format)';
