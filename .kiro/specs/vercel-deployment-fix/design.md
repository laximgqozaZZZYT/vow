# Design Document

## Overview

This design outlines the fix for the Vercel deployment failure by properly configuring the Vercel project, updating GitHub secrets, and modifying the deployment workflow to handle the frontend directory structure correctly.

## Architecture

The deployment architecture follows this flow:

```
GitHub Repository (main branch)
├── GitHub Actions Workflow
│   ├── Build & Test (frontend directory)
│   ├── Vercel CLI Deployment
│   └── Success Notification
├── Vercel Project Configuration
│   ├── Root Directory: frontend
│   ├── Environment Variables
│   └── Build Settings
└── Production Deployment
    └── https://vow-app.vercel.app
```

## Components and Interfaces

### Vercel Project Configuration

#### Project Settings
- **Name**: vow-app
- **Framework**: Next.js
- **Root Directory**: frontend
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

#### Environment Variables
```typescript
interface VercelEnvironment {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_USE_EDGE_FUNCTIONS: "false";
  NEXT_STATIC_EXPORT: "false";
}
```

### GitHub Secrets Configuration

#### Required Secrets
```typescript
interface GitHubSecrets {
  VERCEL_TOKEN: string;           // Personal Access Token from Vercel
  VERCEL_ORG_ID: string;         // Organization ID from Vercel
  VERCEL_PROJECT_ID: string;     // Project ID from Vercel
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}
```

### Deployment Workflow Updates

#### Workflow Structure
```yaml
jobs:
  frontend-test:
    # Build and test in frontend directory
  
  deploy-vercel:
    # Deploy using proper Vercel CLI commands
    # Handle frontend directory structure
    # Use correct project linking
```

## Data Models

### Project Configuration File
```json
{
  "projectId": "prj_xxx",
  "orgId": "team_xxx"
}
```

### Vercel CLI Commands
```bash
# Link project (one-time setup)
vercel link --yes --token=$VERCEL_TOKEN

# Deploy to production
vercel --prod --token=$VERCEL_TOKEN --yes
```

## Error Handling

### Common Deployment Errors
1. **Project not found**: Invalid project/org IDs
2. **Authentication failed**: Invalid or expired token
3. **Build failures**: Missing environment variables
4. **Directory structure**: Incorrect root directory configuration

### Recovery Strategies
- Verify project exists in Vercel dashboard
- Regenerate Vercel token if expired
- Check environment variable configuration
- Ensure frontend directory structure is correct

## Testing Strategy

### Deployment Validation
1. **Local Vercel CLI Test**: Test deployment locally
2. **GitHub Actions Test**: Trigger workflow manually
3. **Environment Verification**: Check all variables are set
4. **Build Process Test**: Ensure frontend builds successfully

### Verification Steps
1. Verify Vercel project exists and is accessible
2. Test Vercel CLI authentication with token
3. Confirm environment variables are properly set
4. Validate deployment completes successfully
5. Check deployed application functionality