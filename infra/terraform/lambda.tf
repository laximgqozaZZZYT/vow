# =================================================================
# Lambda + API Gateway
# Serverless backend (~$3.70/month)
# =================================================================
#
# Security Notes (M-01~M-08):
# - M-01: S3 backend configured in versions.tf (already done)
# - M-02: Runtime upgraded to nodejs22.x (AWS Lambda supported since Nov 2024)
# - M-03: All CloudWatch Log Groups have retention_in_days = 90 (already done)
# - M-04: DynamoDB IAM uses specific table ARNs in dynamodb.tf (already done)
# - M-05: API Gateway throttling added (burst=100, rate=50) via aws_api_gateway_method_settings
# - M-06: S3 MFA Delete requires manual setup — see comments in backend-resources.tf and cloudtrail.tf
# - M-07: SKIP — Development VPC is managed by CloudFormation (vow-development-network), not Terraform
# - M-08: Lambda reserved_concurrent_executions = 100 (configurable via var.lambda_reserved_concurrency)
#

# =================================================================
# Lambda Execution Role
# =================================================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-role"
  }
}

# VPC Access (only needed if using Aurora)
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = var.enable_aurora ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Basic Lambda Execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# X-Ray
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Secrets Manager Access (only if using Aurora)
resource "aws_iam_role_policy" "lambda_secrets" {
  count = var.enable_aurora ? 1 : 0
  name  = "${var.project_name}-${var.environment}-lambda-secrets"
  role  = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_rds_cluster.aurora[0].master_user_secret[0].secret_arn
        ]
      }
    ]
  })
}

# =================================================================
# Lambda Function - Node.js/TypeScript (Hono Backend)
# =================================================================

resource "aws_lambda_function" "api" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  function_name = "${var.project_name}-${var.environment}-api"
  description   = "Vow Hono Backend (Node.js/TypeScript)"
  role          = aws_iam_role.lambda.arn

  runtime     = "nodejs22.x"
  handler     = "lambda-package/lambda.handler"
  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  # M-08: Concurrency limit to prevent runaway invocations
  reserved_concurrent_executions = var.lambda_reserved_concurrency

  s3_bucket = var.lambda_s3_bucket
  s3_key    = var.lambda_s3_key

  environment {
    variables = {
      # Core settings
      ENV = var.lambda_env_env != "" ? var.lambda_env_env : var.environment

      # Authentication
      AUTH_PROVIDER = "supabase"

      # Secrets Manager ARNs (group-specific for least-privilege access)
      # Legacy combined secret (fallback during migration)
      SECRETS_ARN = aws_secretsmanager_secret.lambda_secrets[0].arn
      # Group-specific secrets
      AUTH_SECRETS_ARN        = aws_secretsmanager_secret.auth_secrets[0].arn
      SLACK_SECRETS_ARN       = aws_secretsmanager_secret.slack_secrets[0].arn
      API_SECRETS_ARN         = aws_secretsmanager_secret.api_secrets[0].arn
      CREDENTIALS_SECRETS_ARN = aws_secretsmanager_secret.credentials_secrets[0].arn

      # Slack Integration (non-secret values only)
      SLACK_CLIENT_ID    = var.slack_client_id
      SLACK_CALLBACK_URI = var.lambda_env_slack_callback_uri != "" ? var.lambda_env_slack_callback_uri : "https://${aws_api_gateway_rest_api.main[0].id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}/api/slack/callback"
      SLACK_ENABLED      = var.lambda_env_slack_enabled

      # Supabase (non-secret values only)
      SUPABASE_URL      = var.supabase_url
      SUPABASE_ANON_KEY = var.supabase_anon_key

      # Stripe (non-secret values only)
      STRIPE_PRICE_ID_BASIC = var.stripe_price_id_basic
      STRIPE_PRICE_ID_PRO   = var.stripe_price_id_pro

      # Frontend URL
      FRONTEND_URL = var.frontend_url

      # CORS
      CORS_ORIGINS = jsonencode(var.cors_origins)
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api"
  }
}

# =================================================================
# KMS Key for CloudWatch Logs Encryption
# =================================================================

resource "aws_kms_key" "cloudwatch_logs" {
  count                   = var.lambda_s3_bucket != "" ? 1 : 0
  description             = "KMS key for CloudWatch Logs encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-cloudwatch-logs-key"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_kms_alias" "cloudwatch_logs" {
  count         = var.lambda_s3_bucket != "" ? 1 : 0
  name          = "alias/${var.project_name}-${var.environment}-cloudwatch-logs"
  target_key_id = aws_kms_key.cloudwatch_logs[0].key_id
}

# =================================================================
# CloudWatch Log Group for Lambda
# =================================================================

resource "aws_cloudwatch_log_group" "lambda" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name              = "/aws/lambda/${var.project_name}-${var.environment}-api"
  retention_in_days = var.environment == "production" ? 365 : 90
  kms_key_id        = aws_kms_key.cloudwatch_logs[0].arn

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-logs"
  }
}

# =================================================================
# API Gateway REST API for Python Lambda
# =================================================================

resource "aws_api_gateway_rest_api" "main" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}-${var.environment}-api"
  description = "Vow API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-gateway"
  }
}

resource "aws_api_gateway_resource" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_rest_api.main[0].root_resource_id
  path_part   = "{proxy+}"
}

# =================================================================
# Cognito Authorizer (Defense-in-Depth, opt-in)
# =================================================================
# When enable_api_gateway_auth = true, a Cognito User Pool Authorizer is
# attached to the proxy and root methods. This provides an additional
# authentication layer at the API Gateway level, before requests reach
# the Lambda function. The Hono backend's jwtAuthMiddleware remains
# the primary authentication mechanism.
#
# Public endpoints (health, webhooks, OAuth callbacks, etc.) are split
# into separate API Gateway resources with authorization = "NONE" so
# they remain accessible without a Cognito token.
# =================================================================

resource "aws_api_gateway_authorizer" "cognito" {
  count = var.lambda_s3_bucket != "" && var.enable_api_gateway_auth ? 1 : 0

  name            = "${var.project_name}-${var.environment}-cognito-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.main[0].id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [aws_cognito_user_pool.main.arn]
  identity_source = "method.request.header.Authorization"
}

# =================================================================
# Public Endpoint Resources (no auth required)
# =================================================================
# When API Gateway auth is enabled, these paths are routed through
# separate resources with authorization = "NONE". This ensures
# health checks, webhook receivers, OAuth callbacks, and other
# public endpoints continue to work without a Cognito token.
#
# Public paths:
#   /health              — health check
#   /api/cli-tokens      — CLI token refresh (uses refresh token, not JWT)
#   /api/subscription    — Stripe webhooks (uses Stripe signature)
#   /api/slack           — Slack webhooks/OAuth (uses Slack signing secret)
#   /api/widgets         — Widget API (uses API key auth)
#   /api/agents          — Agent CLI endpoints (uses API key auth)
#   /api/jobs            — Scheduled jobs (uses service key auth)
#   /api/issues          — Issue CLI endpoints (uses API key auth)
#   /api/mcp-installer   — MCP installer (public downloads)
# =================================================================

locals {
  # Public path segments that need their own API Gateway resources (top-level)
  # These correspond to paths excluded from JWT auth in backend/src/middleware/auth.ts
  # and backend/src/index.ts (addExcludedPath calls).
  public_path_segments = var.enable_api_gateway_auth ? toset([
    "health",
  ]) : toset([])

  # Public API sub-paths under /api that need their own resources
  public_api_path_segments = var.enable_api_gateway_auth ? toset([
    "cli-tokens",
    "subscription",
    "slack",
    "widgets",
    "agents",
    "jobs",
    "issues",
    "mcp-installer",
  ]) : toset([])
}

# --- /api resource (shared parent for public API sub-paths) ---

resource "aws_api_gateway_resource" "api_parent" {
  count = var.lambda_s3_bucket != "" && var.enable_api_gateway_auth ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_rest_api.main[0].root_resource_id
  path_part   = "api"
}

# --- Top-level public paths (e.g., /health) ---

resource "aws_api_gateway_resource" "public_root" {
  for_each = var.lambda_s3_bucket != "" ? local.public_path_segments : toset([])

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_rest_api.main[0].root_resource_id
  path_part   = each.key
}

resource "aws_api_gateway_resource" "public_root_proxy" {
  for_each = var.lambda_s3_bucket != "" ? local.public_path_segments : toset([])

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_resource.public_root[each.key].id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "public_root" {
  for_each = var.lambda_s3_bucket != "" ? local.public_path_segments : toset([])

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.public_root[each.key].id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "public_root_proxy" {
  for_each = var.lambda_s3_bucket != "" ? local.public_path_segments : toset([])

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.public_root_proxy[each.key].id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "public_root" {
  for_each = var.lambda_s3_bucket != "" ? local.public_path_segments : toset([])

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_resource.public_root[each.key].id
  http_method             = aws_api_gateway_method.public_root[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

resource "aws_api_gateway_integration" "public_root_proxy" {
  for_each = var.lambda_s3_bucket != "" ? local.public_path_segments : toset([])

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_resource.public_root_proxy[each.key].id
  http_method             = aws_api_gateway_method.public_root_proxy[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

# --- Public API sub-paths (e.g., /api/slack, /api/widgets) ---

resource "aws_api_gateway_resource" "public_api" {
  for_each = var.lambda_s3_bucket != "" ? local.public_api_path_segments : toset([])

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_resource.api_parent[0].id
  path_part   = each.key
}

resource "aws_api_gateway_resource" "public_api_proxy" {
  for_each = var.lambda_s3_bucket != "" ? local.public_api_path_segments : toset([])

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_resource.public_api[each.key].id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "public_api" {
  for_each = var.lambda_s3_bucket != "" ? local.public_api_path_segments : toset([])

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.public_api[each.key].id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "public_api_proxy" {
  for_each = var.lambda_s3_bucket != "" ? local.public_api_path_segments : toset([])

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.public_api_proxy[each.key].id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "public_api" {
  for_each = var.lambda_s3_bucket != "" ? local.public_api_path_segments : toset([])

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_resource.public_api[each.key].id
  http_method             = aws_api_gateway_method.public_api[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

resource "aws_api_gateway_integration" "public_api_proxy" {
  for_each = var.lambda_s3_bucket != "" ? local.public_api_path_segments : toset([])

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_resource.public_api_proxy[each.key].id
  http_method             = aws_api_gateway_method.public_api_proxy[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

# =================================================================
# Proxy Method (catch-all for {proxy+})
# =================================================================
# When enable_api_gateway_auth = false (default):
#   authorization = "NONE" -- auth is handled by the Hono backend (JWT middleware).
#   Edge-level protection is provided by WAF (waf.tf) + API Gateway throttling.
#
# When enable_api_gateway_auth = true:
#   authorization = "COGNITO_USER_POOLS" -- Cognito Authorizer validates the
#   JWT in the Authorization header before the request reaches Lambda.
#   Public endpoints are routed through separate resources (above) with "NONE",
#   which take priority over the {proxy+} catch-all due to API Gateway's
#   most-specific-match routing behavior.
# =================================================================
resource "aws_api_gateway_method" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.proxy[0].id
  http_method   = "ANY"
  authorization = var.enable_api_gateway_auth ? "COGNITO_USER_POOLS" : "NONE"
  authorizer_id = var.enable_api_gateway_auth ? aws_api_gateway_authorizer.cognito[0].id : null
}

resource "aws_api_gateway_integration" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_resource.proxy[0].id
  http_method             = aws_api_gateway_method.proxy[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

# Root method (/) -- always public (serves API info endpoint)
resource "aws_api_gateway_method" "root" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_rest_api.main[0].root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_rest_api.main[0].root_resource_id
  http_method             = aws_api_gateway_method.root[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

resource "aws_api_gateway_deployment" "main" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.main[0].id

  depends_on = [
    aws_api_gateway_integration.proxy,
    aws_api_gateway_integration.root,
    aws_api_gateway_integration.public_root,
    aws_api_gateway_integration.public_root_proxy,
    aws_api_gateway_integration.public_api,
    aws_api_gateway_integration.public_api_proxy,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "main" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  deployment_id = aws_api_gateway_deployment.main[0].id
  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  stage_name    = var.environment

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_access_logs[0].arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      userAgent      = "$context.identity.userAgent"
      errorMessage   = "$context.error.message"
      integrationLatency = "$context.integration.latency"
    })
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-stage"
  }

  depends_on = [aws_api_gateway_account.main]
}

# =================================================================
# M-05: API Gateway Throttling (Default: burst=100, rate=50 rps)
# Prevents abuse and protects downstream Lambda from traffic spikes
# =================================================================

resource "aws_api_gateway_method_settings" "all" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  stage_name  = aws_api_gateway_stage.main[0].stage_name
  method_path = "*/*"

  settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }
}

# =================================================================
# CloudWatch Log Group for API Gateway Access Logs
# =================================================================

resource "aws_cloudwatch_log_group" "api_gateway_access_logs" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name              = "/aws/apigateway/${var.project_name}-${var.environment}-api/access-logs"
  retention_in_days = var.environment == "production" ? 365 : 90
  kms_key_id        = aws_kms_key.cloudwatch_logs[0].arn

  tags = {
    Name = "${var.project_name}-${var.environment}-api-gateway-access-logs"
  }
}

# =================================================================
# API Gateway Account Settings (CloudWatch Logs Role)
# Required for API Gateway to write access logs to CloudWatch
# =================================================================

resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn
}

resource "aws_iam_role" "api_gateway_cloudwatch" {
  name = "${var.project_name}-${var.environment}-apigw-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-apigw-cloudwatch-role"
  }
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_lambda_permission" "api_gateway" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main[0].execution_arn}/*/*"
}
