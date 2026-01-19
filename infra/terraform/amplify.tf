# =================================================================
# AWS Amplify Hosting for Production Frontend
# Next.js SSR support with GitHub integration
# =================================================================

# =================================================================
# Amplify App
# =================================================================

resource "aws_amplify_app" "frontend" {
  count = var.environment == "production" && var.github_access_token != "" ? 1 : 0

  name       = "${var.project_name}-${var.environment}"
  repository = var.github_repository_url

  # GitHub OAuth token for repository access
  access_token = var.github_access_token

  platform = "WEB_COMPUTE" # SSR support for Next.js

  # Build specification
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci --cache .npm --prefer-offline
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/.next
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
          - frontend/.next/cache/**/*
          - frontend/.npm/**/*
  EOT

  # Environment variables
  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT        = "frontend"
    NEXT_PUBLIC_USE_SUPABASE_API     = "false"
    NEXT_PUBLIC_USE_COGNITO          = "true"
    NEXT_PUBLIC_COGNITO_REGION       = var.aws_region
    NEXT_PUBLIC_COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    NEXT_PUBLIC_COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.main.id
    NEXT_PUBLIC_COGNITO_DOMAIN       = "${var.project_name}-auth-${var.environment}.auth.${var.aws_region}.amazoncognito.com"
  }

  # Auto branch creation disabled for production
  enable_auto_branch_creation = false

  # Custom rules for SPA routing
  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"
  }

  # Redirect www to non-www (if custom domain is set)
  dynamic "custom_rule" {
    for_each = var.custom_domain != "" ? [1] : []
    content {
      source = "https://www.${var.custom_domain}"
      status = "301"
      target = "https://${var.custom_domain}"
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-amplify"
  }
}

# =================================================================
# Production Branch (main)
# =================================================================

resource "aws_amplify_branch" "main" {
  count = var.environment == "production" && var.github_access_token != "" ? 1 : 0

  app_id      = aws_amplify_app.frontend[0].id
  branch_name = "main"

  framework = "Next.js - SSR"
  stage     = "PRODUCTION"

  enable_auto_build = true

  environment_variables = {
    NODE_ENV = "production"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-main-branch"
  }
}

# =================================================================
# Custom Domain Association (Optional)
# =================================================================

resource "aws_amplify_domain_association" "main" {
  count = var.environment == "production" && var.github_access_token != "" && var.custom_domain != "" ? 1 : 0

  app_id      = aws_amplify_app.frontend[0].id
  domain_name = var.custom_domain

  # Root domain
  sub_domain {
    branch_name = aws_amplify_branch.main[0].branch_name
    prefix      = ""
  }

  # www subdomain
  sub_domain {
    branch_name = aws_amplify_branch.main[0].branch_name
    prefix      = "www"
  }

  wait_for_verification = false
}
