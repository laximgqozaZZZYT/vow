# =================================================================
# Lambda + API Gateway
# Serverless backend with FastAPI (~$3.70/month)
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

# VPC Access
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# X-Ray
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Secrets Manager Access
resource "aws_iam_role_policy" "lambda_secrets" {
  name = "${var.project_name}-${var.environment}-lambda-secrets"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_rds_cluster.aurora.master_user_secret[0].secret_arn
        ]
      }
    ]
  })
}

# =================================================================
# Lambda Function (条件付き作成 - S3パッケージが指定された場合のみ)
# =================================================================

resource "aws_lambda_function" "api" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  function_name = "${var.project_name}-${var.environment}-api"
  description   = "Vow FastAPI Backend"
  role          = aws_iam_role.lambda.arn

  runtime     = "python3.12"
  handler     = "lambda_handler.handler"
  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  s3_bucket = var.lambda_s3_bucket
  s3_key    = var.lambda_s3_key

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      ENV                 = var.environment
      DATABASE_SECRET_ARN = aws_rds_cluster.aurora.master_user_secret[0].secret_arn
      DATABASE_HOST       = aws_rds_cluster.aurora.endpoint
      DATABASE_PORT       = aws_rds_cluster.aurora.port
      DATABASE_NAME       = var.database_name
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.main.id
      COGNITO_REGION       = var.aws_region
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
# CloudWatch Log Group
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
# API Gateway REST API (条件付き作成)
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

# Proxy Resource
resource "aws_api_gateway_resource" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  parent_id   = aws_api_gateway_rest_api.main[0].root_resource_id
  path_part   = "{proxy+}"
}

# ANY Method for Proxy
resource "aws_api_gateway_method" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.main[0].id
  resource_id   = aws_api_gateway_resource.proxy[0].id
  http_method   = "ANY"
  authorization = "NONE"
}

# Lambda Integration
resource "aws_api_gateway_integration" "proxy" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id             = aws_api_gateway_rest_api.main[0].id
  resource_id             = aws_api_gateway_resource.proxy[0].id
  http_method             = aws_api_gateway_method.proxy[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api[0].invoke_arn
}

# Root Method
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

# Deployment
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

# Stage
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

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main[0].execution_arn}/*/*"
}
