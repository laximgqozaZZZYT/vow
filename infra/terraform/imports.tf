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
# EventBridge Scheduler
# -----------------------------------------------------------------

import {
  to = aws_scheduler_schedule.reminder_check[0]
  id = "default/vow-production-reminder-check"
}

import {
  to = aws_scheduler_schedule.follow_up_check[0]
  id = "default/vow-production-follow-up-check"
}

import {
  to = aws_scheduler_schedule.weekly_report[0]
  id = "default/vow-production-weekly-report"
}

# EventBridge Scheduler IAM Role
import {
  to = aws_iam_role.scheduler[0]
  id = "vow-production-scheduler-role"
}

import {
  to = aws_iam_role_policy.scheduler_lambda_invoke[0]
  id = "vow-production-scheduler-role:vow-production-scheduler-lambda-invoke"
}

# -----------------------------------------------------------------
# SNS Topic
# -----------------------------------------------------------------

import {
  to = aws_sns_topic.alerts[0]
  id = "arn:aws:sns:ap-northeast-1:257784614320:vow-production-alerts"
}

# -----------------------------------------------------------------
# Amplify App
# -----------------------------------------------------------------

import {
  to = aws_amplify_app.frontend[0]
  id = "do1k9oyyorn24"
}

# -----------------------------------------------------------------
# CloudWatch Monitoring
# -----------------------------------------------------------------

import {
  to = aws_cloudwatch_metric_alarm.lambda_errors[0]
  id = "vow-production-lambda-errors"
}

import {
  to = aws_cloudwatch_metric_alarm.lambda_duration[0]
  id = "vow-production-lambda-duration"
}

import {
  to = aws_cloudwatch_dashboard.main[0]
  id = "vow-production"
}
