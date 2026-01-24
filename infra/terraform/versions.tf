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

  # =================================================================
  # S3 Backend Configuration
  # =================================================================
  # 初期セットアップ手順:
  # 1. まずローカルステートでbackend-resources.tfを適用してS3/DynamoDBを作成
  # 2. 下記のbackendブロックのコメントを解除
  # 3. terraform init -migrate-state を実行してステートを移行
  #
  # 環境切り替え:
  # - 開発環境: terraform workspace select development
  # - 本番環境: terraform workspace select production
  # =================================================================
  
  # backend "s3" {
  #   bucket         = "vow-terraform-state-257784614320"  # AWSアカウントIDを含むバケット名
  #   key            = "terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   encrypt        = true
  #   dynamodb_table = "vow-terraform-locks"
  #   
  #   # Workspaceを使用して環境を分離
  #   # ステートファイルパス: env:/{workspace}/terraform.tfstate
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
