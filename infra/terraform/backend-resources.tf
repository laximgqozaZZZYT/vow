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
      sse_algorithm = "AES256"
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

# DynamoDBテーブル: Terraformステートロック用
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "vow-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
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
