-- Add issue_id column for human-readable Issue IDs
-- Format: ISS-YYYYMMDD-NNN (e.g., ISS-20260203-001)

-- Add the issue_id column
ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_issues_issue_id ON issues(issue_id);

-- Add unique constraint
ALTER TABLE issues ADD CONSTRAINT unique_issue_id UNIQUE (issue_id);

-- Create sequence table for daily counters
CREATE TABLE IF NOT EXISTS issue_daily_sequences (
  date_key DATE PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS for sequence table
ALTER TABLE issue_daily_sequences ENABLE ROW LEVEL SECURITY;

-- Allow service role to access sequence table
CREATE POLICY "Service role can manage sequences"
  ON issue_daily_sequences FOR ALL
  USING (auth.role() = 'service_role');

-- Function to generate next issue_id
CREATE OR REPLACE FUNCTION generate_issue_id()
RETURNS TEXT AS $$
DECLARE
  today DATE := CURRENT_DATE;
  date_str TEXT := TO_CHAR(today, 'YYYYMMDD');
  new_seq INTEGER;
BEGIN
  -- Insert or update the sequence for today
  INSERT INTO issue_daily_sequences (date_key, last_sequence)
  VALUES (today, 1)
  ON CONFLICT (date_key)
  DO UPDATE SET last_sequence = issue_daily_sequences.last_sequence + 1
  RETURNING last_sequence INTO new_seq;

  -- Return formatted issue_id: ISS-YYYYMMDD-NNN
  RETURN 'ISS-' || date_str || '-' || LPAD(new_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate issue_id on insert
CREATE OR REPLACE FUNCTION trigger_set_issue_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.issue_id IS NULL THEN
    NEW.issue_id := generate_issue_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_issues_set_issue_id
  BEFORE INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_issue_id();

-- Update existing issues with issue_ids (if any exist)
DO $$
DECLARE
  issue_record RECORD;
  seq_num INTEGER := 0;
  current_date_key DATE;
  last_date_key DATE := NULL;
BEGIN
  FOR issue_record IN
    SELECT id, created_at
    FROM issues
    WHERE issue_id IS NULL
    ORDER BY created_at
  LOOP
    current_date_key := issue_record.created_at::DATE;

    IF last_date_key IS NULL OR current_date_key != last_date_key THEN
      seq_num := 1;
      last_date_key := current_date_key;
    ELSE
      seq_num := seq_num + 1;
    END IF;

    UPDATE issues
    SET issue_id = 'ISS-' || TO_CHAR(current_date_key, 'YYYYMMDD') || '-' || LPAD(seq_num::TEXT, 3, '0')
    WHERE id = issue_record.id;
  END LOOP;
END $$;

COMMENT ON COLUMN issues.issue_id IS 'Human-readable Issue ID in format ISS-YYYYMMDD-NNN';
COMMENT ON TABLE issue_daily_sequences IS 'Daily sequence counter for issue IDs';
