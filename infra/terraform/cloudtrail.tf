# =================================================================
# CloudTrail - Audit Trail
# API activity logging for security and compliance
# =================================================================

# =================================================================
# S3 Bucket for CloudTrail Logs
# =================================================================

resource "aws_s3_bucket" "cloudtrail_logs" {
  bucket = "${var.project_name}-${var.environment}-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name    = "${var.project_name}-${var.environment}-cloudtrail-logs"
    Purpose = "CloudTrail audit log storage"
  }
}

# M-06: MFA Delete は手動で有効化が必要 (Terraformでは設定不可)
# 手順:
#   1. ルートアカウントの MFA デバイスを用意
#   2. AWS CLI でルートアカウント認証情報を使用:
#      aws s3api put-bucket-versioning \
#        --bucket <this-bucket-name> \
#        --versioning-configuration Status=Enabled,MFADelete=Enabled \
#        --mfa "arn:aws:iam::ACCOUNTID:mfa/root-account-mfa-device TOTP_CODE"
resource "aws_s3_bucket_versioning" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    expiration {
      days = 365
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }
}

# CloudTrail logs バケットのアクセスログ設定 (optional)
resource "aws_s3_bucket_logging" "cloudtrail_logs" {
  count  = var.enable_s3_access_logging ? 1 : 0
  bucket = aws_s3_bucket.cloudtrail_logs.id

  target_bucket = aws_s3_bucket.s3_access_logs[0].id
  target_prefix = "cloudtrail-logs/"
}

# =================================================================
# S3 Bucket Policy for CloudTrail
# =================================================================

resource "aws_s3_bucket_policy" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail_logs.arn
        Condition = {
          StringEquals = {
            "aws:SourceArn" = "arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-audit-trail"
          }
        }
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl"  = "bucket-owner-full-control"
            "aws:SourceArn" = "arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-audit-trail"
          }
        }
      }
    ]
  })
}

# =================================================================
# CloudTrail
# =================================================================

resource "aws_cloudtrail" "main" {
  name                          = "${var.project_name}-audit-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail_logs.id
  include_global_service_events = true
  is_multi_region_trail         = var.environment == "production" ? true : false
  enable_logging                = true
  enable_log_file_validation    = true

  # Log management events (API calls)
  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  tags = {
    Name    = "${var.project_name}-audit-trail"
    Purpose = "Security audit trail"
  }

  depends_on = [aws_s3_bucket_policy.cloudtrail_logs]
}

# =================================================================
# Outputs
# =================================================================

output "cloudtrail_name" {
  description = "CloudTrail trail name"
  value       = aws_cloudtrail.main.name
}

output "cloudtrail_s3_bucket" {
  description = "S3 bucket for CloudTrail logs"
  value       = aws_s3_bucket.cloudtrail_logs.id
}
