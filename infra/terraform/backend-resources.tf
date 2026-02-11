# =================================================================
# Terraform Backend Resources
# =================================================================
# このファイルはTerraformのステート管理用リソースを定義します。
# 初回は手動でこれらのリソースを作成してから、S3バックエンドを有効化してください。
#
# 初期化手順:
# 1. このファイルのみを適用: terraform apply -target=aws_s3_bucket.terraform_state -target=aws_dynamodb_table.terraform_locks
# 2. versions.tf のS3バックエンド設定を有効化
# 3. terraform init -migrate-state でステートを移行
# =================================================================

# S3バケット: Terraformステートファイル保存用
resource "aws_s3_bucket" "terraform_state" {
  bucket = "vow-terraform-state-${data.aws_caller_identity.current.account_id}"

  # 誤削除防止
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "vow-terraform-state"
    Purpose     = "Terraform State Storage"
    Environment = "shared"
  }
}

# S3バケットのバージョニング設定
# M-06: MFA Delete は手動で有効化が必要 (Terraformでは設定不可)
# 手順:
#   1. ルートアカウントの MFA デバイスを用意
#   2. AWS CLI でルートアカウント認証情報を使用:
#      aws s3api put-bucket-versioning \
#        --bucket vow-terraform-state-ACCOUNTID \
#        --versioning-configuration Status=Enabled,MFADelete=Enabled \
#        --mfa "arn:aws:iam::ACCOUNTID:mfa/root-account-mfa-device TOTP_CODE"
#   3. 設定確認:
#      aws s3api get-bucket-versioning --bucket vow-terraform-state-ACCOUNTID
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3バケットの暗号化設定
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

# S3バケットのパブリックアクセスブロック
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =================================================================
# S3 Access Logging (optional)
# =================================================================
# S3アクセスログを有効化するための専用バケットとlogging設定。
# var.enable_s3_access_logging = true の場合のみ作成される。
# コスト増加の可能性があるためデフォルトは無効。

resource "aws_s3_bucket" "s3_access_logs" {
  count  = (var.environment == "production" || var.enable_s3_access_logging) ? 1 : 0
  bucket = "vow-s3-access-logs-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "vow-s3-access-logs"
    Purpose     = "S3 Access Logging"
    Environment = "shared"
  }
}

resource "aws_s3_bucket_versioning" "s3_access_logs" {
  count  = (var.environment == "production" || var.enable_s3_access_logging) ? 1 : 0
  bucket = aws_s3_bucket.s3_access_logs[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "s3_access_logs" {
  count  = (var.environment == "production" || var.enable_s3_access_logging) ? 1 : 0
  bucket = aws_s3_bucket.s3_access_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "s3_access_logs" {
  count  = (var.environment == "production" || var.enable_s3_access_logging) ? 1 : 0
  bucket = aws_s3_bucket.s3_access_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "s3_access_logs" {
  count  = (var.environment == "production" || var.enable_s3_access_logging) ? 1 : 0
  bucket = aws_s3_bucket.s3_access_logs[0].id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    expiration {
      days = 90
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

# Terraform state バケットのアクセスログ設定
resource "aws_s3_bucket_logging" "terraform_state" {
  count  = (var.environment == "production" || var.enable_s3_access_logging) ? 1 : 0
  bucket = aws_s3_bucket.terraform_state.id

  target_bucket = aws_s3_bucket.s3_access_logs[0].id
  target_prefix = "terraform-state/"
}

# DynamoDBテーブル: Terraformステートロック用
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "vow-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "vow-terraform-locks"
    Purpose     = "Terraform State Locking"
    Environment = "shared"
  }
}

# 現在のAWSアカウントID取得用
data "aws_caller_identity" "current" {}

# =================================================================
# Outputs
# =================================================================

output "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_locks_table" {
  description = "DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}
