"""
Lambda Handler for FastAPI Application

This module provides the AWS Lambda entry point using Mangum adapter.
Mangum translates API Gateway events to ASGI requests for FastAPI.
"""
import os

# Set Lambda-specific environment variables before importing app
os.environ.setdefault("AWS_LAMBDA_FUNCTION_NAME", "vow-api")

from mangum import Mangum
from app.main import app

# Mangum adapter configuration
# lifespan="off" is recommended for Lambda to avoid cold start issues
handler = Mangum(app, lifespan="off")
