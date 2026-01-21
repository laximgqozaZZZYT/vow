"""
Vow Backend API - FastAPI Application Entry Point

This module initializes the FastAPI application with:
- CORS middleware for frontend communication
- JWT authentication middleware
- API routers for various endpoints
- Database lifecycle management
- AWS Lambda compatibility via Mangum
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health
from app.routers import slack_oauth, slack_webhook, slack_interactions
from app.middleware.auth import JWTAuthMiddleware

# Check if running in Lambda environment
IS_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    # Startup
    if not IS_LAMBDA:
        print(f"Starting {settings.app_name} v{settings.app_version}")
    yield
    # Shutdown
    if not IS_LAMBDA:
        print(f"Shutting down {settings.app_name}")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Vow Habit Tracking Backend API",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Authentication Middleware
# Note: Add after CORS middleware so CORS headers are always included
app.add_middleware(JWTAuthMiddleware)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(slack_oauth.router, tags=["slack"])
app.include_router(slack_webhook.router, tags=["slack"])
app.include_router(slack_interactions.router, tags=["slack-interactions"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }
