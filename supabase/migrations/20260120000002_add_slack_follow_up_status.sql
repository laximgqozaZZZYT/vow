-- Migration: Add Slack follow-up status table
-- Description: Creates slack_follow_up_status table for tracking reminder and follow-up messages

-- Create slack_follow_up_status table
CREATE TABLE IF NOT EXISTS slack_follow_up_status (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_type TEXT NOT NULL DEFAULT 'user',
    owner_id TEXT NOT NULL,
    habit_id TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reminder_sent_at TIMESTAMPTZ,
    follow_up_sent_at TIMESTAMPTZ,
    skipped BOOLEAN DEFAULT FALSE,
    remind_later_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_type, owner_id, habit_id, date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_slack_follow_up_owner ON slack_follow_up_status(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_slack_follow_up_date ON slack_follow_up_status(date);
CREATE INDEX IF NOT EXISTS idx_slack_follow_up_habit ON slack_follow_up_status(habit_id);
CREATE INDEX IF NOT EXISTS idx_slack_follow_up_remind_later ON slack_follow_up_status(remind_later_at) WHERE remind_later_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE slack_follow_up_status ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own follow-up status
CREATE POLICY "Users can access own follow up status" ON slack_follow_up_status
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
    );

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_slack_follow_up_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_slack_follow_up_status_updated_at ON slack_follow_up_status;
CREATE TRIGGER trigger_slack_follow_up_status_updated_at
    BEFORE UPDATE ON slack_follow_up_status
    FOR EACH ROW
    EXECUTE FUNCTION update_slack_follow_up_status_updated_at();

-- Add comments for documentation
COMMENT ON TABLE slack_follow_up_status IS 'Tracks Slack reminder and follow-up message status per habit per day';
COMMENT ON COLUMN slack_follow_up_status.reminder_sent_at IS 'When the initial reminder was sent';
COMMENT ON COLUMN slack_follow_up_status.follow_up_sent_at IS 'When the follow-up message was sent';
COMMENT ON COLUMN slack_follow_up_status.skipped IS 'Whether user clicked Skip today';
COMMENT ON COLUMN slack_follow_up_status.remind_later_at IS 'When to send the next reminder (if user clicked Remind me later)';
