-- Add memo column to activities table
-- Run this in Supabase SQL Editor

ALTER TABLE activities ADD COLUMN IF NOT EXISTS memo TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'activities' 
ORDER BY ordinal_position;