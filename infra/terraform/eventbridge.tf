# =================================================================
# EventBridge Scheduler
# Scheduled triggers for Slack notification Lambda functions
# =================================================================

# =================================================================
# EventBridge Scheduler IAM Role
# =================================================================

resource "aws_iam_role" "scheduler" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-scheduler-role"
  }
}

resource "aws_iam_role_policy" "scheduler_lambda_invoke" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name = "${var.project_name}-${var.environment}-scheduler-lambda-invoke"
  role = aws_iam_role.scheduler[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.api[0].arn
      }
    ]
  })
}

# =================================================================
# リマインダーチェック（5分間隔）
# Requirements: 6.1 - 5分間隔でリマインダーチェックLambda関数を実行する
# =================================================================

resource "aws_scheduler_schedule" "reminder_check" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name       = "${var.project_name}-${var.environment}-reminder-check"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(5 minutes)"

  target {
    arn      = aws_lambda_function.api[0].arn
    role_arn = aws_iam_role.scheduler[0].arn

    input = jsonencode({
      source      = "aws.scheduler"
      detail-type = "reminder-check"
    })
  }
}

# =================================================================
# フォローアップチェック（15分間隔）
# Requirements: 6.2 - 15分間隔でフォローアップチェックLambda関数を実行する
# Requirements: 6.3 - 15分間隔でRemind Laterチェックを実行する
# =================================================================

resource "aws_scheduler_schedule" "follow_up_check" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name       = "${var.project_name}-${var.environment}-follow-up-check"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(15 minutes)"

  target {
    arn      = aws_lambda_function.api[0].arn
    role_arn = aws_iam_role.scheduler[0].arn

    input = jsonencode({
      source      = "aws.scheduler"
      detail-type = "follow-up-check"
    })
  }
}

# =================================================================
# 週次レポート（15分間隔）
# Requirements: 6.4 - 15分間隔で週次レポート送信チェックを実行する
# =================================================================

resource "aws_scheduler_schedule" "weekly_report" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name       = "${var.project_name}-${var.environment}-weekly-report"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(15 minutes)"

  target {
    arn      = aws_lambda_function.api[0].arn
    role_arn = aws_iam_role.scheduler[0].arn

    input = jsonencode({
      source      = "aws.scheduler"
      detail-type = "weekly-report"
    })
  }
}
