# Production Environment Verification

## Current Issue
- Production OAuth login works but user data isn't displaying
- Habit/Goal creation fails in production
- Local development works fine

## Root Cause Analysis
The production environment is trying to use Express backend (`http://localhost:4000`) but needs to use Supabase Direct API instead.

## Required Fixes

### 1. Vercel Environment Variables
Set the following environment variable in Vercel Dashboard:

```
NEXT_PUBLIC_USE_SUPABASE_API=true
```

**Steps:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_USE_SUPABASE_API` = `true`
3. Redeploy the application

### 2. Supabase Database Setup
Ensure the following tables exist in your Supabase database with correct schema:

**Required Tables:**
- `goals` (with `owner_type`, `owner_id` columns)
- `habits` (with `owner_type`, `owner_id` columns)  
- `activities` (with `owner_type`, `owner_id` columns)

**To Create Tables:**
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `scripts/supabase-schema.sql`

### 3. Row Level Security (RLS)
Verify RLS policies are enabled and configured correctly:

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('goals', 'habits', 'activities');

-- Check existing policies
SELECT * FROM pg_policies 
WHERE tablename IN ('goals', 'habits', 'activities');
```

## Testing Steps

1. **Deploy Latest Changes**: ✅ Done (commit a32a908)
2. **Set Vercel Environment Variable**: `NEXT_PUBLIC_USE_SUPABASE_API=true`
3. **Verify Supabase Tables**: Run schema SQL if needed
4. **Test Production**: 
   - Login with OAuth
   - Try creating a goal/habit
   - Check browser console for errors

## Expected Behavior After Fix
- OAuth login works and user data displays
- Goal/Habit creation succeeds
- Data persists between sessions
- No "Failed to fetch" errors in console