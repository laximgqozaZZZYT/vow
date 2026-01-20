# =================================================================
# VOW Development Environment Configuration
# =================================================================

environment  = "development"
project_name = "vow"
aws_region   = "ap-northeast-1"

# =================================================================
# Network Configuration
# =================================================================

vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

# =================================================================
# Aurora Serverless v2 Configuration (Development)
# =================================================================

aurora_min_capacity = 0.5
aurora_max_capacity = 2.0
database_name       = "vow"

# =================================================================
# Lambda Configuration
# =================================================================

lambda_memory_size = 512
lambda_timeout     = 30
lambda_s3_bucket   = "vow-lambda-deployments-257784614320"
lambda_s3_key      = "development/lambda.zip"

# =================================================================
# DMS Configuration
# =================================================================

enable_dms = false

# =================================================================
# CORS Configuration
# =================================================================

cors_origins = [
  "http://localhost:3000",
  "https://main.do1k9oyyorn24.amplifyapp.com"
]
