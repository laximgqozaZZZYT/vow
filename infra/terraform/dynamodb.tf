# =================================================================
# DynamoDB Tables
# Application data storage tables
# =================================================================

# =================================================================
# Agent Sessions Table
# Stores AI Coach agent session data with TTL-based expiration
# =================================================================

resource "aws_dynamodb_table" "agent_sessions" {
  name         = "vow_agent_sessions"
  billing_mode = "PAY_PER_REQUEST"

  # Primary Key: sessionId (partition key)
  hash_key = "sessionId"

  # Sort Key: userId
  range_key = "userId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "S"
  }

  # TTL configuration for automatic session expiration (24 hours)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # GSI for querying sessions by userId (ordered by updatedAt)
  global_secondary_index {
    name            = "userId-updatedAt-index"
    hash_key        = "userId"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "vow-agent-sessions"
    Purpose     = "AI Coach Agent Session Storage"
    Environment = var.environment
  }
}

# =================================================================
# MCP Connections Table
# Stores user MCP server connection settings
# =================================================================

resource "aws_dynamodb_table" "mcp_connections" {
  name         = "vow-mcp-connections-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"

  # Primary Key: userId
  hash_key = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "vow-mcp-connections-${var.environment}"
    Purpose     = "MCP Server Connection Settings"
    Environment = var.environment
  }
}

# =================================================================
# User Credentials Table
# Stores encrypted user API credentials (OpenAI, Anthropic, etc.)
# =================================================================

resource "aws_dynamodb_table" "user_credentials" {
  name         = "vow_user_credentials"
  billing_mode = "PAY_PER_REQUEST"

  # Primary Key: userId
  hash_key = "userId"

  # Sort Key: credentialType (openai, anthropic, gemini, codex, custom)
  range_key = "credentialType"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "credentialType"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "vow-user-credentials"
    Purpose     = "User API Credentials Storage"
    Environment = var.environment
  }
}

# =================================================================
# IAM Policy for Lambda DynamoDB Access
# =================================================================

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.project_name}-${var.environment}-lambda-dynamodb"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.agent_sessions.arn,
          "${aws_dynamodb_table.agent_sessions.arn}/index/*",
          aws_dynamodb_table.mcp_connections.arn,
          aws_dynamodb_table.user_credentials.arn
        ]
      }
    ]
  })
}

# =================================================================
# Outputs
# =================================================================

output "agent_sessions_table_name" {
  description = "DynamoDB table name for agent sessions"
  value       = aws_dynamodb_table.agent_sessions.name
}

output "agent_sessions_table_arn" {
  description = "DynamoDB table ARN for agent sessions"
  value       = aws_dynamodb_table.agent_sessions.arn
}

output "mcp_connections_table_name" {
  description = "DynamoDB table name for MCP connections"
  value       = aws_dynamodb_table.mcp_connections.name
}

output "mcp_connections_table_arn" {
  description = "DynamoDB table ARN for MCP connections"
  value       = aws_dynamodb_table.mcp_connections.arn
}

output "user_credentials_table_name" {
  description = "DynamoDB table name for user credentials"
  value       = aws_dynamodb_table.user_credentials.name
}

output "user_credentials_table_arn" {
  description = "DynamoDB table ARN for user credentials"
  value       = aws_dynamodb_table.user_credentials.arn
}
