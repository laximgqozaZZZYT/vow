# =================================================================
# WAF v2 + API Gateway Throttling
# =================================================================

# WAF Web ACL
resource "aws_wafv2_web_acl" "api" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  name        = "${var.project_name}-${var.environment}-api-waf"
  description = "WAF for Vow API Gateway"
  scope       = "REGIONAL"

  # Default action: Allow — managed rules (Common, BadInputs, SQLi) block known
  # attack patterns; rate limiting handles volumetric abuse. An explicit allowlist
  # approach is impractical for API backends with diverse legitimate traffic.
  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        # Security: 300 requests per 5 minutes (~1 req/sec) to mitigate
        # brute-force and credential-stuffing attacks against API endpoints.
        # Previous value of 1000 was too permissive for this API's traffic profile.
        limit              = 300
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common
  rule {
    name     = "aws-managed-common"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "aws-managed-bad-inputs"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - SQL Injection
  rule {
    name     = "aws-managed-sqli"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-sqli"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-${var.environment}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-api-waf"
  }
}

# WAF → API Gateway Association
resource "aws_wafv2_web_acl_association" "api" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  resource_arn = aws_api_gateway_stage.main[0].arn
  web_acl_arn  = aws_wafv2_web_acl.api[0].arn
}

# API Gateway Throttling
resource "aws_api_gateway_method_settings" "api_throttling" {
  count = var.lambda_s3_bucket != "" ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.main[0].id
  stage_name  = aws_api_gateway_stage.main[0].stage_name
  method_path = "*/*"

  settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }
}
