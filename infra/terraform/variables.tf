# =================================================================
# Variables
# =================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "vow"
}

# =================================================================
# Network Variables
# =================================================================

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

# =================================================================
# Aurora Variables
# =================================================================

variable "aurora_min_capacity" {
  description = "Aurora Serverless v2 minimum ACU (0.5 = ~$44/month)"
  type        = number
  default     = 0.5
}

variable "aurora_max_capacity" {
  description = "Aurora Serverless v2 maximum ACU"
  type        = number
  default     = 2.0
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "vow"
}

variable "enable_aurora" {
  description = "Enable Aurora Serverless v2 (set to false if using Supabase)"
  type        = bool
  default     = false
}

# =================================================================
# Cognito Variables
# =================================================================

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_client_id" {
  description = "GitHub OAuth Client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_client_secret" {
  description = "GitHub OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "callback_urls" {
  description = "OAuth callback URLs"
  type        = list(string)
  default     = ["http://localhost:3000/auth/callback"]
  # 本番環境では追加: "https://your-domain.com/auth/callback"
}

variable "logout_urls" {
  description = "OAuth logout URLs"
  type        = list(string)
  default     = ["http://localhost:3000"]
  # 本番環境では追加: "https://your-domain.com"
}

# =================================================================
# Lambda Variables
# =================================================================

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_s3_bucket" {
  description = "S3 bucket for Lambda deployment package"
  type        = string
  default     = ""
}

variable "lambda_s3_key" {
  description = "S3 key for Lambda deployment package"
  type        = string
  default     = ""
}

variable "lambda_nodejs_s3_bucket" {
  description = "S3 bucket for Node.js Lambda deployment package"
  type        = string
  default     = ""
}

variable "lambda_nodejs_s3_key" {
  description = "S3 key for Node.js Lambda deployment package"
  type        = string
  default     = ""
}

variable "supabase_service_role_key" {
  description = "Supabase service role key for server-side operations"
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for token verification"
  type        = string
  default     = ""
  sensitive   = true
}


# =================================================================
# DMS Variables (for Supabase to Aurora migration)
# =================================================================

variable "enable_dms" {
  description = "Enable DMS for database migration"
  type        = bool
  default     = false
}

variable "supabase_host" {
  description = "Supabase PostgreSQL host (direct, IPv6 only)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "supabase_pooler_host" {
  description = "Supabase Pooler host (IPv4 compatible, required for DMS)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "supabase_database" {
  description = "Supabase database name"
  type        = string
  default     = "postgres"
}

variable "supabase_username" {
  description = "Supabase database username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "supabase_password" {
  description = "Supabase database password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "aurora_master_username" {
  description = "Aurora master username (for DMS target)"
  type        = string
  default     = "vowadmin"
  sensitive   = true
}

variable "aurora_master_password" {
  description = "Aurora master password (from Secrets Manager)"
  type        = string
  default     = ""
  sensitive   = true
}

# =================================================================
# Amplify Variables
# =================================================================

variable "github_repository_url" {
  description = "GitHub repository URL for Amplify"
  type        = string
  default     = ""
}

variable "github_access_token" {
  description = "GitHub access token for Amplify"
  type        = string
  default     = ""
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain for Amplify (optional)"
  type        = string
  default     = ""
}

# =================================================================
# Monitoring Variables
# =================================================================

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = ""
}

# =================================================================
# Slack Integration Variables
# =================================================================

variable "slack_client_id" {
  description = "Slack App Client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "slack_client_secret" {
  description = "Slack App Client Secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "slack_signing_secret" {
  description = "Slack Signing Secret for request verification"
  type        = string
  default     = ""
  sensitive   = true
}

variable "token_encryption_key" {
  description = "Fernet key for encrypting Slack tokens"
  type        = string
  default     = ""
  sensitive   = true
}

# =================================================================
# Supabase Variables (for Slack connection storage)
# =================================================================

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  default     = ""
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  default     = ""
  sensitive   = true
}

# =================================================================
# CORS Variables
# =================================================================

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = [
    "http://localhost:3000",
    "https://main.do1k9oyyorn24.amplifyapp.com"
  ]
}

variable "frontend_url" {
  description = "Frontend URL for OAuth redirects"
  type        = string
  default     = "https://main.do1k9oyyorn24.amplifyapp.com"
}

# =================================================================
# Lambda Environment Variables (Override)
# =================================================================

variable "lambda_env_cognito_client_id" {
  description = "Override: Cognito Client ID for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_cognito_region" {
  description = "Override: Cognito Region for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_cognito_user_pool_id" {
  description = "Override: Cognito User Pool ID for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_database_host" {
  description = "Override: Database Host for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_database_name" {
  description = "Override: Database Name for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_database_port" {
  description = "Override: Database Port for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_database_secret_arn" {
  description = "Override: Database Secret ARN for Lambda"
  type        = string
  default     = ""
  sensitive   = true
}

variable "lambda_env_env" {
  description = "Override: ENV for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_slack_callback_uri" {
  description = "Override: Slack Callback URI for Lambda"
  type        = string
  default     = ""
}

variable "lambda_env_slack_enabled" {
  description = "Override: Slack Enabled for Lambda"
  type        = string
  default     = "true"
}

# =================================================================
# Amplify Environment Variables
# =================================================================

variable "amplify_env_monorepo_app_root" {
  description = "Amplify: AMPLIFY_MONOREPO_APP_ROOT"
  type        = string
  default     = "frontend"
}

variable "amplify_env_next_public_api_url" {
  description = "Amplify: NEXT_PUBLIC_API_URL"
  type        = string
  default     = ""
}

variable "amplify_env_next_public_site_url" {
  description = "Amplify: NEXT_PUBLIC_SITE_URL"
  type        = string
  default     = ""
}

variable "amplify_env_next_public_slack_api_url" {
  description = "Amplify: NEXT_PUBLIC_SLACK_API_URL"
  type        = string
  default     = ""
}

variable "amplify_env_next_public_supabase_anon_key" {
  description = "Amplify: NEXT_PUBLIC_SUPABASE_ANON_KEY"
  type        = string
  default     = ""
  sensitive   = true
}

variable "amplify_env_next_public_supabase_url" {
  description = "Amplify: NEXT_PUBLIC_SUPABASE_URL"
  type        = string
  default     = ""
}

variable "amplify_env_next_public_use_edge_functions" {
  description = "Amplify: NEXT_PUBLIC_USE_EDGE_FUNCTIONS"
  type        = string
  default     = "false"
}

variable "amplify_env_next_public_use_supabase_api" {
  description = "Amplify: NEXT_PUBLIC_USE_SUPABASE_API"
  type        = string
  default     = "true"
}

variable "amplify_env_next_public_backend_api_url" {
  description = "Amplify: NEXT_PUBLIC_BACKEND_API_URL for API key management"
  type        = string
  default     = ""
}
