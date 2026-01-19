# =================================================================
# Terraform Configuration
# =================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # 本番環境では S3 バックエンドを使用
  # backend "s3" {
  #   bucket         = "vow-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   encrypt        = true
  #   dynamodb_table = "vow-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "vow"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
