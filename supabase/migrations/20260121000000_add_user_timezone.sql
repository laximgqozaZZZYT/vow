-- Migration: Add timezone column to users table
-- Description: Adds timezone column for user-specific timezone settings
-- Requirements: 7.1, 7.2 - Timezone handling for reminders

-- Add timezone column to users table
-- Default to 'Asia/Tokyo' as per requirement 7.2
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Tokyo';

-- Add comment for documentation
COMMENT ON COLUMN users.timezone IS 'User timezone setting for notification scheduling (IANA timezone format, e.g., Asia/Tokyo)';

-- Create index for efficient timezone-based queries
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
