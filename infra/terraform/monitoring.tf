# =================================================================
# CloudWatch Monitoring and Alarms for Production
# =================================================================

# =================================================================
# SNS Topic for Alerts
# =================================================================

resource "aws_sns_topic" "alerts" {
  count = var.environment == "production" ? 1 : 0

  name = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Name = "${var.project_name}-${var.environment}-alerts"
  }
}

# Email subscription (optional)
resource "aws_sns_topic_subscription" "email" {
  count = var.environment == "production" && var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# =================================================================
# CloudWatch Dashboard
# =================================================================

resource "aws_cloudwatch_dashboard" "main" {
  count = var.environment == "production" ? 1 : 0

  dashboard_name = "${var.project_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # Lambda Metrics Row
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Invocations"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-${var.environment}-api", { stat = "Sum", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Errors"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-${var.environment}-api", { stat = "Sum", period = 300, color = "#d62728" }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Duration (p50/p99)"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "${var.project_name}-${var.environment}-api", { stat = "p50", period = 300 }],
            ["...", { stat = "p99", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      # Aurora Metrics Row
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Aurora CPU Utilization"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBClusterIdentifier", aws_rds_cluster.aurora.cluster_identifier, { stat = "Average", period = 300 }]
          ]
          view   = "timeSeries"
          yAxis  = { left = { min = 0, max = 100 } }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Aurora Connections"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", aws_rds_cluster.aurora.cluster_identifier, { stat = "Average", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Aurora ACU Capacity"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "ServerlessDatabaseCapacity", "DBClusterIdentifier", aws_rds_cluster.aurora.cluster_identifier, { stat = "Average", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      # API Gateway Metrics Row
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "API Gateway Requests"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", "${var.project_name}-${var.environment}-api", { stat = "Sum", period = 300 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "API Gateway Latency"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiName", "${var.project_name}-${var.environment}-api", { stat = "p50", period = 300 }],
            ["...", { stat = "p99", period = 300 }]
          ]
          view = "timeSeries"
        }
      }
    ]
  })
}

# =================================================================
# CloudWatch Alarms
# =================================================================

# Lambda Error Alarm
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.environment == "production" ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Lambda function error rate exceeded threshold (>5 errors in 10 minutes)"

  dimensions = {
    FunctionName = "${var.project_name}-${var.environment}-api"
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]
  ok_actions    = [aws_sns_topic.alerts[0].arn]

  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-errors-alarm"
  }
}

# Lambda Duration Alarm (p99 > 2s)
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  count = var.environment == "production" ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p99"
  threshold           = 2000 # 2 seconds
  alarm_description   = "Lambda p99 latency exceeded 2 seconds"

  dimensions = {
    FunctionName = "${var.project_name}-${var.environment}-api"
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]

  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-duration-alarm"
  }
}

# Aurora CPU Alarm
resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  count = var.environment == "production" ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-aurora-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Aurora CPU utilization exceeded 80%"

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.aurora.cluster_identifier
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]

  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora-cpu-alarm"
  }
}

# Aurora Connections Alarm
resource "aws_cloudwatch_metric_alarm" "aurora_connections" {
  count = var.environment == "production" ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-aurora-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 50
  alarm_description   = "Aurora database connections exceeded 50"

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.aurora.cluster_identifier
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]

  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora-connections-alarm"
  }
}
