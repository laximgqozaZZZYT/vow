# =================================================================
# Secrets Manager for Lambda Environment Variables
# Migrate sensitive Lambda env vars to AWS Secrets Manager
# =================================================================
#
# 移行手順:
# 1. terraform apply でSecrets Managerリソースを作成
# 2. バックエンドコードにSecrets Manager読み取りロジックを追加
# 3. Lambda環境変数からシークレットを削除し、SECRET_ARN環境変数に置き換え
# 4. terraform apply で反映
#
# 対象シークレット (hono_api Lambda):
#   - JWT_SECRET
#   - STRIPE_SECRET_KEY
#   - STRIPE_WEBHOOK_SECRET
#   - SUPABASE_SERVICE_ROLE_KEY
#   - SLACK_CLIENT_SECRET
#   - SLACK_SIGNING_SECRET
#   - TOKEN_ENCRYPTION_KEY
#   - CREDENTIALS_ENCRYPTION_KEY
#   - OPENAI_API_KEY
# =================================================================

# =================================================================
# Secrets Manager Secret
# =================================================================
# 1つのSecretに全シークレットをJSON形式で格納（コスト削減のため個別Secretにしない）

resource "aws_secretsmanager_secret" "lambda_secrets" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}/${var.environment}/lambda-secrets"
  description = "Lambda function secrets for ${var.project_name} ${var.environment}"

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "lambda_secrets" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.lambda_secrets[0].id
  secret_string = jsonencode({
    JWT_SECRET                 = var.jwt_secret
    STRIPE_SECRET_KEY          = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET      = var.stripe_webhook_secret
    SUPABASE_SERVICE_ROLE_KEY  = var.supabase_service_role_key
    SLACK_CLIENT_SECRET        = var.slack_client_secret
    SLACK_SIGNING_SECRET       = var.slack_signing_secret
    TOKEN_ENCRYPTION_KEY       = var.token_encryption_key
    CREDENTIALS_ENCRYPTION_KEY = var.credentials_encryption_key
    OPENAI_API_KEY             = var.openai_api_key
  })
}

# =================================================================
# IAM Policy - Secrets Manager Access for Lambda
# =================================================================
# Note: aws_iam_role_policy.lambda_secrets (Aurora用) は lambda.tf に既存。
# こちらは Lambda 環境変数シークレット用の別ポリシー。

resource "aws_iam_role_policy" "lambda_secrets_manager" {
  count = var.lambda_nodejs_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-lambda-secrets-manager"
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
          aws_secretsmanager_secret.lambda_secrets[0].arn
        ]
      }
    ]
  })
}

# =================================================================
# Outputs
# =================================================================

output "lambda_secrets_arn" {
  description = "Secrets Manager ARN for Lambda secrets"
  value       = var.lambda_nodejs_s3_bucket != "" ? aws_secretsmanager_secret.lambda_secrets[0].arn : null
  sensitive   = true
}

output "lambda_secrets_name" {
  description = "Secrets Manager name for Lambda secrets"
  value       = var.lambda_nodejs_s3_bucket != "" ? aws_secretsmanager_secret.lambda_secrets[0].name : null
}
