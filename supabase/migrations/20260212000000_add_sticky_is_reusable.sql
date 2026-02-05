-- Add is_reusable column to stickies table
-- This enables the "使いまわし" (reusable) feature for Sticky'n items
-- When true, completed state resets when linked recurring Habit's period resets

ALTER TABLE stickies ADD COLUMN IF NOT EXISTS is_reusable BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN stickies.is_reusable IS 'When true, sticky completion resets with linked recurring habit period';
