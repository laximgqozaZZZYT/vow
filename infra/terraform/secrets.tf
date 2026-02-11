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
# シークレットグループ (権限分離):
#   vow-auth-secrets:        JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY
#   vow-slack-secrets:       SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, TOKEN_ENCRYPTION_KEY
#   vow-api-secrets:         OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
#   vow-credentials-secrets: CREDENTIALS_ENCRYPTION_KEY
#
# レガシー (後方互換):
#   lambda-secrets:          全9キー (移行期間中のフォールバック)
#
# =================================================================
# シークレットローテーション手順 (手動)
# =================================================================
# AWS Secrets Managerの自動ローテーションにはカスタムLambda関数が必要なため、
# 現時点では手動ローテーションを推奨する。
#
# ローテーション推奨頻度:
#   - JWT_SECRET:                90日ごと (認証トークンの安全性確保)
#   - SUPABASE_SERVICE_ROLE_KEY: Supabaseダッシュボードから再生成時
#   - SLACK_CLIENT_SECRET:       90日ごと (Slack App設定画面から再生成)
#   - SLACK_SIGNING_SECRET:      90日ごと (Slack App設定画面から再生成)
#   - TOKEN_ENCRYPTION_KEY:      180日ごと (既存トークンの再暗号化が必要)
#   - OPENAI_API_KEY:            90日ごと (OpenAIダッシュボードから再生成)
#   - STRIPE_SECRET_KEY:         90日ごと (Stripeダッシュボードからロール)
#   - STRIPE_WEBHOOK_SECRET:     Webhook endpoint再作成時
#   - CREDENTIALS_ENCRYPTION_KEY: 180日ごと (既存データの再暗号化が必要)
#
# ローテーション手順:
#   1. 新しい値を生成/取得
#   2. terraform.tfvars の該当変数を更新
#   3. terraform apply で Secrets Manager に反映
#   4. Lambda関数が次回起動時に新しい値を取得
#   5. 旧値を使用するセッション/トークンが失効するまで待機
#   6. 動作確認 (ヘルスチェック、認証フロー、Slack連携、決済)
#
# 自動ローテーション導入時の参考:
#   - Lambda関数を作成し rotation_lambda_arn に指定
#   - aws_secretsmanager_secret_rotation リソースを追加
#   - 詳細: https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html
#
# 運用手順書: scripts/security/secrets-rotation-runbook.sh
# =================================================================

# =================================================================
# Legacy Secret (backward compatibility - all keys in one secret)
# =================================================================
# 移行期間中のフォールバックとして保持。新コードは個別グループを使用する。

resource "aws_secretsmanager_secret" "lambda_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}/${var.environment}/lambda-secrets"
  description = "[LEGACY] Lambda function secrets for ${var.project_name} ${var.environment} - Use group-specific secrets instead"

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-secrets"
    Status = "legacy"
  }
}

resource "aws_secretsmanager_secret_version" "lambda_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

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
# Group-Specific Secrets (principle of least privilege)
# =================================================================

# --- Auth Secrets: JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY ---

resource "aws_secretsmanager_secret" "auth_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}/${var.environment}/auth-secrets"
  description = "Authentication secrets (JWT, Supabase) for ${var.project_name} ${var.environment}"

  tags = {
    Name  = "${var.project_name}-${var.environment}-auth-secrets"
    Group = "auth"
  }
}

resource "aws_secretsmanager_secret_version" "auth_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.auth_secrets[0].id
  secret_string = jsonencode({
    JWT_SECRET                = var.jwt_secret
    SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
  })
}

# --- Slack Secrets: SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, TOKEN_ENCRYPTION_KEY ---

resource "aws_secretsmanager_secret" "slack_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}/${var.environment}/slack-secrets"
  description = "Slack integration secrets for ${var.project_name} ${var.environment}"

  tags = {
    Name  = "${var.project_name}-${var.environment}-slack-secrets"
    Group = "slack"
  }
}

resource "aws_secretsmanager_secret_version" "slack_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.slack_secrets[0].id
  secret_string = jsonencode({
    SLACK_CLIENT_SECRET  = var.slack_client_secret
    SLACK_SIGNING_SECRET = var.slack_signing_secret
    TOKEN_ENCRYPTION_KEY = var.token_encryption_key
  })
}

# --- API Secrets: OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET ---

resource "aws_secretsmanager_secret" "api_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}/${var.environment}/api-secrets"
  description = "Third-party API secrets (OpenAI, Stripe) for ${var.project_name} ${var.environment}"

  tags = {
    Name  = "${var.project_name}-${var.environment}-api-secrets"
    Group = "api"
  }
}

resource "aws_secretsmanager_secret_version" "api_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.api_secrets[0].id
  secret_string = jsonencode({
    OPENAI_API_KEY        = var.openai_api_key
    STRIPE_SECRET_KEY     = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
  })
}

# --- Credentials Secrets: CREDENTIALS_ENCRYPTION_KEY ---

resource "aws_secretsmanager_secret" "credentials_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}/${var.environment}/credentials-secrets"
  description = "Credentials encryption secrets for ${var.project_name} ${var.environment}"

  tags = {
    Name  = "${var.project_name}-${var.environment}-credentials-secrets"
    Group = "credentials"
  }
}

resource "aws_secretsmanager_secret_version" "credentials_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  secret_id = aws_secretsmanager_secret.credentials_secrets[0].id
  secret_string = jsonencode({
    CREDENTIALS_ENCRYPTION_KEY = var.credentials_encryption_key
  })
}

# =================================================================
# IAM Policies - Secrets Manager Access for Lambda
# =================================================================
# Note: aws_iam_role_policy.lambda_secrets (Aurora用) は lambda.tf に既存。
# こちらは Lambda 環境変数シークレット用のポリシー群。

# Legacy policy: access to the combined secret (backward compatibility)
resource "aws_iam_role_policy" "lambda_secrets_manager" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

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

# Group-specific policies: each grants access only to the relevant secret group

resource "aws_iam_role_policy" "lambda_auth_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-lambda-auth-secrets"
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
          aws_secretsmanager_secret.auth_secrets[0].arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_slack_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-lambda-slack-secrets"
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
          aws_secretsmanager_secret.slack_secrets[0].arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_api_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-lambda-api-secrets"
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
          aws_secretsmanager_secret.api_secrets[0].arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_credentials_secrets" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-lambda-credentials-secrets"
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
          aws_secretsmanager_secret.credentials_secrets[0].arn
        ]
      }
    ]
  })
}

# =================================================================
# Outputs
# =================================================================

# Legacy (backward compatibility)
output "lambda_secrets_arn" {
  description = "[LEGACY] Secrets Manager ARN for all Lambda secrets (combined)"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.lambda_secrets[0].arn : null
  sensitive   = true
}

output "lambda_secrets_name" {
  description = "[LEGACY] Secrets Manager name for all Lambda secrets (combined)"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.lambda_secrets[0].name : null
}

# Group-specific outputs
output "auth_secrets_arn" {
  description = "Secrets Manager ARN for auth secrets (JWT, Supabase)"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.auth_secrets[0].arn : null
  sensitive   = true
}

output "auth_secrets_name" {
  description = "Secrets Manager name for auth secrets"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.auth_secrets[0].name : null
}

output "slack_secrets_arn" {
  description = "Secrets Manager ARN for Slack integration secrets"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.slack_secrets[0].arn : null
  sensitive   = true
}

output "slack_secrets_name" {
  description = "Secrets Manager name for Slack integration secrets"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.slack_secrets[0].name : null
}

output "api_secrets_arn" {
  description = "Secrets Manager ARN for third-party API secrets (OpenAI, Stripe)"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.api_secrets[0].arn : null
  sensitive   = true
}

output "api_secrets_name" {
  description = "Secrets Manager name for third-party API secrets"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.api_secrets[0].name : null
}

output "credentials_secrets_arn" {
  description = "Secrets Manager ARN for credentials encryption secrets"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.credentials_secrets[0].arn : null
  sensitive   = true
}

output "credentials_secrets_name" {
  description = "Secrets Manager name for credentials encryption secrets"
  value       = var.lambda_s3_bucket != "" ? aws_secretsmanager_secret.credentials_secrets[0].name : null
}
