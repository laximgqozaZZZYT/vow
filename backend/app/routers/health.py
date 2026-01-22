"""
Health Check Router

Provides health check endpoints for monitoring and load balancer health checks.

Requirements:
- 6.1: ヘルスチェックエンドポイントが呼び出される時、Supabaseへの接続テストを実行する
- 6.2: 接続テストが成功する時、ステータス「healthy」とレイテンシを返却する
- 6.3: 接続テストが失敗する時、ステータス「unhealthy」とエラー詳細を返却する
- 6.4: 接続テストのタイムアウトを3秒に設定する
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.utils.structured_logger import get_logger


router = APIRouter()
logger = get_logger(__name__)

# Health check timeout in seconds (Requirement 6.4)
HEALTH_CHECK_TIMEOUT_SECONDS = 3.0


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


class SupabaseHealthStatus(BaseModel):
    """
    Supabase接続ヘルスチェックのレスポンススキーマ。
    
    Requirements:
    - 6.2: ステータス「healthy」とレイテンシを返却する
    - 6.3: ステータス「unhealthy」とエラー詳細を返却する
    """
    status: str  # "healthy" or "unhealthy"
    supabase_connected: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    timestamp: datetime
    instance_id: str


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


@router.get("/health/supabase", response_model=SupabaseHealthStatus)
async def check_supabase_health() -> SupabaseHealthStatus:
    """
    Supabase接続のヘルスチェックを実行する。
    
    Requirements:
    - 6.1: Supabaseへの接続テストを実行する
    - 6.2: 接続テストが成功する時、ステータス「healthy」とレイテンシを返却する
    - 6.3: 接続テストが失敗する時、ステータス「unhealthy」とエラー詳細を返却する
    - 6.4: 接続テストのタイムアウトを3秒に設定する
    
    Returns:
        SupabaseHealthStatus with connection status, latency, and error details
    """
    from app.services.supabase_connection_factory import get_connection_factory
    
    timestamp = datetime.now(timezone.utc)
    instance_id = "unknown"
    
    # Check if Supabase is configured
    if not settings.supabase_url or not settings.supabase_anon_key:
        logger.warning(
            "Supabase health check failed: not configured",
            supabase_url_set=bool(settings.supabase_url),
            supabase_key_set=bool(settings.supabase_anon_key),
        )
        return SupabaseHealthStatus(
            status="unhealthy",
            supabase_connected=False,
            error="Supabase is not configured (SUPABASE_URL or SUPABASE_ANON_KEY missing)",
            timestamp=timestamp,
            instance_id=instance_id,
        )
    
    try:
        # Get the connection factory
        factory = get_connection_factory(
            supabase_url=settings.supabase_url,
            supabase_key=settings.supabase_anon_key,
        )
        instance_id = factory.instance_id
        
        # Execute connection test with timeout (Requirement 6.4)
        start_time = datetime.now(timezone.utc)
        
        # Run the connection test with a 3-second timeout
        latency_ms = await asyncio.wait_for(
            _execute_supabase_connection_test(factory),
            timeout=HEALTH_CHECK_TIMEOUT_SECONDS,
        )
        
        # Connection successful (Requirement 6.2)
        logger.info(
            "Supabase health check successful",
            instance_id=instance_id,
            latency_ms=latency_ms,
        )
        
        return SupabaseHealthStatus(
            status="healthy",
            supabase_connected=True,
            latency_ms=latency_ms,
            timestamp=timestamp,
            instance_id=instance_id,
        )
        
    except asyncio.TimeoutError:
        # Timeout error (Requirement 6.3, 6.4)
        error_message = f"Connection test timed out after {HEALTH_CHECK_TIMEOUT_SECONDS} seconds"
        logger.error(
            "Supabase health check timeout",
            instance_id=instance_id,
            timeout_seconds=HEALTH_CHECK_TIMEOUT_SECONDS,
        )
        
        return SupabaseHealthStatus(
            status="unhealthy",
            supabase_connected=False,
            error=error_message,
            timestamp=timestamp,
            instance_id=instance_id,
        )
        
    except Exception as e:
        # Other errors (Requirement 6.3)
        error_message = f"{type(e).__name__}: {str(e)}"
        logger.error(
            "Supabase health check failed",
            error=e,
            instance_id=instance_id,
        )
        
        return SupabaseHealthStatus(
            status="unhealthy",
            supabase_connected=False,
            error=error_message,
            timestamp=timestamp,
            instance_id=instance_id,
        )


async def _execute_supabase_connection_test(factory) -> float:
    """
    Execute a lightweight Supabase connection test.
    
    Requirement 6.1: Supabaseへの接続テストを実行する
    
    Args:
        factory: SupabaseConnectionFactory instance
        
    Returns:
        Latency in milliseconds
        
    Raises:
        Exception: If connection test fails
    """
    start_time = datetime.now(timezone.utc)
    
    # Get the client (this validates the connection)
    client = factory.get_client()
    
    # Execute a lightweight query to verify the connection is working
    # Using a simple select with limit 1 to minimize overhead
    result = await asyncio.to_thread(
        lambda: client.table("habits").select("id").limit(1).execute()
    )
    
    # Calculate latency
    end_time = datetime.now(timezone.utc)
    latency_ms = (end_time - start_time).total_seconds() * 1000
    
    return latency_ms
