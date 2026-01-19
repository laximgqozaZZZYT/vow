# =================================================================
# VOW Production Environment Configuration
# =================================================================

environment  = "production"
project_name = "vow"
aws_region   = "ap-northeast-1"

# =================================================================
# Network Configuration
# =================================================================

vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

# =================================================================
# Aurora Serverless v2 Configuration (Production)
# =================================================================

aurora_min_capacity = 0.5  # ~$44/month minimum
aurora_max_capacity = 4.0  # Scale up for production load
database_name       = "vow"

# =================================================================
# Cognito OAuth Configuration
# Update these with your actual OAuth credentials
# =================================================================

# Google OAuth (from GCP Console)
google_client_id     = ""  # Set via environment variable or secrets
google_client_secret = ""  # Set via environment variable or secrets

# GitHub OAuth (from GitHub Developer Settings)
github_client_id     = ""  # Set via environment variable or secrets
github_client_secret = ""  # Set via environment variable or secrets

# OAuth Callback URLs (include both old and new for migration)
callback_urls = [
  "https://main.d1zmna50iwo9dv.amplifyapp.com/auth/callback",  # Amplify production
  "http://localhost:3000/auth/callback"                         # Local development
]

logout_urls = [
  "https://main.d1zmna50iwo9dv.amplifyapp.com",
  "http://localhost:3000"
]

# =================================================================
# Lambda Configuration
# =================================================================

lambda_memory_size = 512
lambda_timeout     = 30
lambda_s3_bucket   = ""  # Set when deploying Lambda
lambda_s3_key      = ""  # Set when deploying Lambda

# =================================================================
# DMS Configuration (for Supabase to Aurora migration)
# =================================================================

enable_dms = true

# Supabase connection details (set via environment variables for security)
# supabase_host     = "db.jamiyzsyclvlvstmeeir.supabase.co"
# supabase_database = "postgres"
# supabase_username = "postgres"
# supabase_password = ""  # Set via TF_VAR_supabase_password

# =================================================================
# Amplify Configuration
# =================================================================

github_repository_url = "https://github.com/laximgqozaZZZYT/vow"
github_access_token   = ""  # Set via environment variable or secrets

# Custom domain (optional - leave empty to use Amplify default domain)
custom_domain = ""

# =================================================================
# Monitoring Configuration
# =================================================================

alert_email = ""  # Set to receive CloudWatch alerts
