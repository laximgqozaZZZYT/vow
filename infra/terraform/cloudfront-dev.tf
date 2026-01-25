# CloudFront distribution for development environment with Lambda@Edge authentication
# This sits in front of Amplify to provide server-side access control

# Lambda@Edge function for authentication (must be in us-east-1)
# Lambda@Edge function for authentication (viewer-request)
resource "aws_lambda_function" "dev_auth_edge" {
  provider = aws.us_east_1
  
  filename         = "${path.module}/../lambda-edge/auth-check.zip"
  function_name    = "vow-dev-auth-edge"
  role             = aws_iam_role.lambda_edge_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  publish          = true  # Required for Lambda@Edge
  
  # Lambda@Edge has a 1MB limit and 5 second timeout for viewer request
  memory_size = 128
  timeout     = 5
  
  tags = {
    Environment = "development"
    Project     = "vow"
  }
}

# Lambda@Edge function for Host header rewrite (origin-request)
resource "aws_lambda_function" "dev_origin_edge" {
  provider = aws.us_east_1
  
  filename         = "${path.module}/../lambda-edge/origin-request.zip"
  function_name    = "vow-dev-origin-edge"
  role             = aws_iam_role.lambda_edge_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  publish          = true  # Required for Lambda@Edge
  
  # Origin request has 30 second timeout limit
  memory_size = 128
  timeout     = 5
  
  tags = {
    Environment = "development"
    Project     = "vow"
  }
}

# IAM role for Lambda@Edge
resource "aws_iam_role" "lambda_edge_role" {
  provider = aws.us_east_1
  
  name = "vow-lambda-edge-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
      }
    ]
  })
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_edge_basic" {
  provider   = aws.us_east_1
  role       = aws_iam_role.lambda_edge_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "dev_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "VOW Development Environment with Auth"
  default_root_object = ""
  price_class         = "PriceClass_200"  # US, Canada, Europe, Asia
  
  # Origin pointing to Amplify
  origin {
    domain_name = "develop.do1k9oyyorn24.amplifyapp.com"
    origin_id   = "amplify-dev"
    
    custom_header {
      name  = "X-Custom-Header"
      value = "cloudfront-dev"
    }
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "amplify-dev"
    
    forwarded_values {
      query_string = true
      headers      = ["Origin", "Authorization", "Accept", "Accept-Language"]
      
      cookies {
        forward = "all"  # Forward all cookies for Supabase auth
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0  # No caching for dynamic content
    max_ttl                = 0
    compress               = true
    
    # Lambda@Edge for authentication (viewer-request for auth check)
    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.dev_auth_edge.qualified_arn
      include_body = false
    }
    
    # Lambda@Edge for Host header rewrite (origin-request)
    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.dev_origin_edge.qualified_arn
      include_body = false
    }
  }
  
  # Cache behavior for static assets (no auth needed)
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "amplify-dev"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400
    default_ttl            = 604800
    max_ttl                = 31536000
    compress               = true
  }
  
  # Cache behavior for images
  ordered_cache_behavior {
    path_pattern     = "*.svg"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "amplify-dev"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400
    default_ttl            = 604800
    max_ttl                = 31536000
    compress               = true
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  
  tags = {
    Environment = "development"
    Project     = "vow"
  }
}

# Output the CloudFront URL
output "dev_cloudfront_url" {
  description = "CloudFront URL for development environment (use this instead of Amplify URL)"
  value       = "https://${aws_cloudfront_distribution.dev_distribution.domain_name}"
}

output "dev_cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.dev_distribution.id
}
