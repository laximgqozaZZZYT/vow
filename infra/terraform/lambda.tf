# =================================================================
# Lambda + API Gateway
# Serverless backend (~$3.70/month)
# =================================================================

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

  runtime     = "nodejs20.x"
  handler     = "lambda-package/lambda.handler"
  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  s3_bucket = var.lambda_s3_bucket
  s3_key    = var.lambda_s3_key

  environment {
    variables = {
      # Core settings
      ENV = var.lambda_env_env != "" ? var.lambda_env_env : var.environment
      
      # Authentication (Supabase)
      AUTH_PROVIDER = "supabase"
      JWT_SECRET    = var.jwt_secret
      
      # Slack Integration
      SLACK_CLIENT_ID      = var.slack_client_id
      SLACK_CLIENT_SECRET  = var.slack_client_secret
      SLACK_SIGNING_SECRET = var.slack_signing_secret
      SLACK_CALLBACK_URI   = var.lambda_env_slack_callback_uri != "" ? var.lambda_env_slack_callback_uri : "https://${aws_api_gateway_rest_api.main[0].id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}/api/slack/callback"
      SLACK_ENABLED        = var.lambda_env_slack_enabled
      TOKEN_ENCRYPTION_KEY = var.token_encryption_key
      
      # Supabase
      SUPABASE_URL      = var.supabase_url
      SUPABASE_ANON_KEY = var.supabase_anon_key
      
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
# Lambda Function - Node.js Hono Backend (TypeScript)
# =================================================================

resource "aws_lambda_function" "hono_api" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  function_name = "${var.project_name}-${var.environment}-hono-api"
  description   = "Vow Hono Backend (Node.js/TypeScript)"
  role          = aws_iam_role.lambda.arn

  runtime     = "nodejs20.x"
  handler     = "lambda.handler"
  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  s3_bucket = var.lambda_nodejs_s3_bucket
  s3_key    = var.lambda_nodejs_s3_key

  environment {
    variables = {
      NODE_ENV = var.environment
      
      # Supabase
      SUPABASE_URL              = var.supabase_url
      SUPABASE_ANON_KEY         = var.supabase_anon_key
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      
      # JWT Authentication
      JWT_SECRET = var.jwt_secret
      
      # Slack Integration
      SLACK_CLIENT_ID      = var.slack_client_id
      SLACK_CLIENT_SECRET  = var.slack_client_secret
      SLACK_SIGNING_SECRET = var.slack_signing_secret
      TOKEN_ENCRYPTION_KEY = var.token_encryption_key
      
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
    Name = "${var.project_name}-${var.environment}-hono-api"
  }
}

# CloudWatch Log Group for Hono Lambda
resource "aws_cloudwatch_log_group" "hono_lambda" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  name              = "/aws/lambda/${var.project_name}-${var.environment}-hono-api"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-hono-lambda-logs"
  }
}

# =================================================================
# API Gateway for Hono Lambda
# =================================================================

resource "aws_api_gateway_rest_api" "hono" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}-${var.environment}-hono-api"
  description = "Vow Hono API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-hono-api-gateway"
  }
}

resource "aws_api_gateway_resource" "hono_proxy" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.hono[0].id
  parent_id   = aws_api_gateway_rest_api.hono[0].root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "hono_proxy" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.hono[0].id
  resource_id   = aws_api_gateway_resource.hono_proxy[0].id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "hono_proxy" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  rest_api_id             = aws_api_gateway_rest_api.hono[0].id
  resource_id             = aws_api_gateway_resource.hono_proxy[0].id
  http_method             = aws_api_gateway_method.hono_proxy[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.hono_api[0].invoke_arn
}

resource "aws_api_gateway_method" "hono_root" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.hono[0].id
  resource_id   = aws_api_gateway_rest_api.hono[0].root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "hono_root" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  rest_api_id             = aws_api_gateway_rest_api.hono[0].id
  resource_id             = aws_api_gateway_rest_api.hono[0].root_resource_id
  http_method             = aws_api_gateway_method.hono_root[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.hono_api[0].invoke_arn
}

resource "aws_api_gateway_deployment" "hono" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.hono[0].id

  depends_on = [
    aws_api_gateway_integration.hono_proxy,
    aws_api_gateway_integration.hono_root
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "hono" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  deployment_id = aws_api_gateway_deployment.hono[0].id
  rest_api_id   = aws_api_gateway_rest_api.hono[0].id
  stage_name    = var.environment

  xray_tracing_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-hono-api-stage"
  }
}

resource "aws_lambda_permission" "hono_api_gateway" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.hono_api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.hono[0].execution_arn}/*/*"
}

# =================================================================
# CloudWatch Log Group for Python Lambda
# =================================================================

resource "aws_cloudwatch_log_group" "lambda" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name              = "/aws/lambda/${var.project_name}-${var.environment}-api"
  retention_in_days = 30

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

resource "aws_api_gateway_method" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.proxy[0].id
  http_method   = "ANY"
  authorization = "NONE"
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
    aws_api_gateway_integration.root
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

  tags = {
    Name = "${var.project_name}-${var.environment}-api-stage"
  }
}

resource "aws_lambda_permission" "api_gateway" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main[0].execution_arn}/*/*"
}
