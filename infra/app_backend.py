#!/usr/bin/env python3
"""
CDK App for Backend Lambda Deployment

Usage:
  cd infra
  cdk deploy -a "python app_backend.py" VowBackendStack \
    -c supabase_url="https://xxx.supabase.co" \
    -c supabase_service_role_key="eyJ..." \
    -c jwt_secret="your-jwt-secret" \
    -c slack_client_id="your-slack-client-id" \
    -c slack_client_secret="your-slack-client-secret" \
    -c slack_signing_secret="your-slack-signing-secret" \
    -c token_encryption_key="your-32-byte-hex-key"

Or set environment variables via AWS Console after deployment.
"""

import os
import aws_cdk as cdk
from stacks.backend_lambda_stack import BackendLambdaStack


app = cdk.App()

# Get configuration from context or environment
supabase_url = app.node.try_get_context("supabase_url") or os.environ.get("SUPABASE_URL", "")
supabase_service_role_key = app.node.try_get_context("supabase_service_role_key") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
jwt_secret = app.node.try_get_context("jwt_secret") or os.environ.get("JWT_SECRET", "")
slack_client_id = app.node.try_get_context("slack_client_id") or os.environ.get("SLACK_CLIENT_ID", "")
slack_client_secret = app.node.try_get_context("slack_client_secret") or os.environ.get("SLACK_CLIENT_SECRET", "")
slack_signing_secret = app.node.try_get_context("slack_signing_secret") or os.environ.get("SLACK_SIGNING_SECRET", "")
token_encryption_key = app.node.try_get_context("token_encryption_key") or os.environ.get("TOKEN_ENCRYPTION_KEY", "")

# CORS origins - add your frontend URLs
cors_origins = [
    "http://localhost:3000",
    "https://develop.d1234567890.amplifyapp.com",  # Update with actual Amplify URL
]

# Create the stack
BackendLambdaStack(
    app,
    "VowBackendStack",
    supabase_url=supabase_url,
    supabase_service_role_key=supabase_service_role_key,
    jwt_secret=jwt_secret,
    slack_client_id=slack_client_id,
    slack_client_secret=slack_client_secret,
    slack_signing_secret=slack_signing_secret,
    token_encryption_key=token_encryption_key,
    cors_origins=cors_origins,
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=os.environ.get("CDK_DEFAULT_REGION", "ap-northeast-1"),
    ),
    description="Backend Lambda Stack for Vow Habit Tracking",
)

app.synth()
