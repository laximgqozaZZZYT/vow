"""
Health Check Router

Provides health check endpoints for monitoring and load balancer health checks.
"""
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings


router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str
    version: str
    service: str
    timestamp: str


class DetailedHealthResponse(HealthResponse):
    """Detailed health check response with additional info."""
    debug: bool
    database_configured: bool
    slack_enabled: bool
    openai_enabled: bool


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Basic health check endpoint.
    
    Returns 200 OK with service status information.
    Used by load balancers and monitoring systems.
    """
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        service=settings.app_name,
        timestamp=datetime.utcnow().isoformat()
    )


@router.get("/health/detailed", response_model=DetailedHealthResponse)
async def detailed_health_check() -> DetailedHealthResponse:
    """
    Detailed health check endpoint.
    
    Returns additional configuration status for debugging.
    Should be protected in production environments.
    """
    return DetailedHealthResponse(
        status="healthy",
        version=settings.app_version,
        service=settings.app_name,
        timestamp=datetime.utcnow().isoformat(),
        debug=settings.debug,
        database_configured=bool(settings.database_url),
        slack_enabled=settings.slack_enabled,
        openai_enabled=settings.openai_enabled
    )
