# GitHub Actions Vercel Deployment Fix

## Issue
GitHub Actions workflow was failing with "Project not found" error during Vercel deployment.

## Root Cause
The workflow was trying to deploy from the `frontend/` directory using `working-directory: frontend`, but the Vercel project was configured with `Root Directory: frontend` in the Vercel dashboard. This created a conflict where Vercel couldn't find the project configuration.

## Solution
Updated the GitHub Actions workflow (`.github/workflows/deploy.yml`) to:

1. **Deploy from repository root** - Removed `working-directory: frontend`
2. **Let Vercel handle directory structure** - Vercel project configuration (`Root Directory: frontend`) automatically handles the subdirectory
3. **Added required environment variables** - Added Supabase environment variables needed for the build process

## Key Changes

```yaml
# Before (causing issues)
- name: Build and Deploy to Vercel
  run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
  working-directory: frontend  # ❌ This caused the conflict

# After (fixed)
- name: Deploy to Vercel
  run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
  # ✅ No working-directory, runs from root
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

## Expected Result
The GitHub Actions workflow should now successfully:
1. Run frontend tests
2. Deploy to Vercel using the correct project configuration
3. Complete the CI/CD pipeline

## Next Steps
1. Monitor the GitHub Actions workflow execution
2. Verify successful deployment to Vercel
3. Test the deployed application functionality
4. Proceed with remaining deployment tasks if successful

## Verification
Check the deployment at: https://vow-app.vercel.app (or your configured Vercel URL)