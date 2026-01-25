-- Fix token_usage table - add missing feature column
-- Run this in Supabase SQL Editor

-- Check current table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'token_usage' 
AND table_schema = 'public';

-- Add feature column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'token_usage' 
    AND column_name = 'feature'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE token_usage ADD COLUMN feature TEXT NOT NULL DEFAULT 'unknown';
    CREATE INDEX IF NOT EXISTS idx_token_usage_feature ON token_usage(feature);
    RAISE NOTICE 'Added feature column to token_usage table';
  ELSE
    RAISE NOTICE 'feature column already exists';
  END IF;
END $$;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'token_usage' 
AND table_schema = 'public';
