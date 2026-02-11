# =================================================================
# Terraform Import Blocks
# 既存AWSリソースをTerraformステートに取り込むためのimport定義
# terraform plan → terraform apply で自動importされる
# import完了後、このファイルは削除可能
# =================================================================
# 作成日: 2026-02-11
# 背景: 手動/CDKで作成されたリソースをTerraform管理に統合

# -----------------------------------------------------------------
# DynamoDB Tables
# -----------------------------------------------------------------
# Note: vow_agent_sessions はAWSに未作成 → terraform apply で新規作成される
# Note: vow-mcp-connections-dev は開発環境用テーブル（TF定義は -production）→ 名前不一致のため非対象

import {
  to = aws_dynamodb_table.user_credentials
  id = "vow_user_credentials"
}

# -----------------------------------------------------------------
# Terraform Backend Resources (S3 + DynamoDB)
# -----------------------------------------------------------------
# S3バケットとDynamoDBテーブルは既にAWSに存在するがstateに未登録

import {
  to = aws_s3_bucket.terraform_state
  id = "vow-terraform-state-257784614320"
}

import {
  to = aws_dynamodb_table.terraform_locks
  id = "vow-terraform-locks"
}

# -----------------------------------------------------------------
# CloudWatch Log Groups (Amplify)
# -----------------------------------------------------------------

import {
  to = aws_cloudwatch_log_group.amplify_production[0]
  id = "/aws/amplify/do1k9oyyorn24"
}

import {
  to = aws_cloudwatch_log_group.amplify_dev[0]
  id = "/aws/amplify/d1zmna50iwo9dv"
}

# -----------------------------------------------------------------
# 以下のリソースは既にTerraform stateに存在（import不要）
# - EventBridge Scheduler: reminder_check, follow_up_check, weekly_report
# - IAM Role: scheduler, scheduler_lambda_invoke
# - SNS Topic: alerts
# - CloudWatch: lambda_errors, lambda_duration, dashboard
# -----------------------------------------------------------------
# Note: Amplify App (do1k9oyyorn24) は github_access_token 未設定のため
#       count=0 → import不可。トークン設定後に以下を追加:
# import {
#   to = aws_amplify_app.frontend[0]
#   id = "do1k9oyyorn24"
# }
