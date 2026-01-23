# =================================================================
# Outputs
# =================================================================

# =================================================================
# Network Outputs
# =================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "isolated_subnet_ids" {
  description = "Isolated subnet IDs"
  value       = aws_subnet.isolated[*].id
}

# =================================================================
# Aurora Outputs (only if enabled)
# =================================================================

output "aurora_cluster_endpoint" {
  description = "Aurora cluster endpoint"
  value       = var.enable_aurora ? aws_rds_cluster.aurora[0].endpoint : null
}

output "aurora_cluster_reader_endpoint" {
  description = "Aurora cluster reader endpoint"
  value       = var.enable_aurora ? aws_rds_cluster.aurora[0].reader_endpoint : null
}

output "aurora_cluster_port" {
  description = "Aurora cluster port"
  value       = var.enable_aurora ? aws_rds_cluster.aurora[0].port : null
}

output "aurora_secret_arn" {
  description = "Aurora master user secret ARN"
  value       = var.enable_aurora ? aws_rds_cluster.aurora[0].master_user_secret[0].secret_arn : null
}

output "aurora_cluster_identifier" {
  description = "Aurora cluster identifier"
  value       = var.enable_aurora ? aws_rds_cluster.aurora[0].cluster_identifier : null
}

# =================================================================
# Cognito Outputs
# =================================================================

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_issuer_url" {
  description = "Cognito issuer URL for JWT validation"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

# =================================================================
# Lambda & API Gateway Outputs (条件付き)
# =================================================================

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = var.lambda_s3_bucket != "" ? "https://${aws_api_gateway_rest_api.main[0].id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}" : null
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = var.lambda_s3_bucket != "" ? aws_lambda_function.api[0].arn : null
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = var.lambda_s3_bucket != "" ? aws_lambda_function.api[0].function_name : null
}

# =================================================================
# Hono Lambda & API Gateway Outputs (Node.js Backend)
# =================================================================

output "hono_api_gateway_url" {
  description = "Hono API Gateway URL (Node.js Backend)"
  value       = var.lambda_nodejs_s3_bucket != "" ? "https://${aws_api_gateway_rest_api.hono[0].id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}" : null
}

output "hono_lambda_function_arn" {
  description = "Hono Lambda function ARN"
  value       = var.lambda_nodejs_s3_bucket != "" ? aws_lambda_function.hono_api[0].arn : null
}

output "hono_lambda_function_name" {
  description = "Hono Lambda function name"
  value       = var.lambda_nodejs_s3_bucket != "" ? aws_lambda_function.hono_api[0].function_name : null
}

# =================================================================
# DMS Outputs (条件付き)
# =================================================================

output "dms_replication_instance_arn" {
  description = "DMS Replication Instance ARN"
  value       = var.enable_dms ? aws_dms_replication_instance.main[0].replication_instance_arn : null
}

output "dms_replication_task_arn" {
  description = "DMS Replication Task ARN"
  value       = var.enable_dms && var.supabase_host != "" ? aws_dms_replication_task.main[0].replication_task_arn : null
  sensitive   = true
}

# =================================================================
# Amplify Outputs (本番環境のみ)
# =================================================================

output "amplify_app_id" {
  description = "Amplify App ID"
  value       = var.environment == "production" && var.github_access_token != "" ? aws_amplify_app.frontend[0].id : null
  sensitive   = true
}

output "amplify_default_domain" {
  description = "Amplify default domain"
  value       = var.environment == "production" && var.github_access_token != "" ? aws_amplify_app.frontend[0].default_domain : null
  sensitive   = true
}

output "amplify_production_url" {
  description = "Amplify production URL"
  value       = var.environment == "production" && var.github_access_token != "" ? "https://main.${aws_amplify_app.frontend[0].default_domain}" : null
  sensitive   = true
}

# =================================================================
# Monitoring Outputs (本番環境のみ)
# =================================================================

output "sns_alerts_topic_arn" {
  description = "SNS Alerts Topic ARN"
  value       = var.environment == "production" ? aws_sns_topic.alerts[0].arn : null
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch Dashboard URL"
  value       = var.environment == "production" ? "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.project_name}-${var.environment}" : null
}
