"""
Slack OAuth Router

Handles OAuth 2.0 flow for connecting Slack workspaces.

This router uses FastAPI's dependency injection for all services and repositories,
following the dependency injection pattern for testability and separation of concerns.

Requirements:
- 1.3: THE Backend_API SHALL separate business logic from HTTP handling in routers
"""

import os
import secrets
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from supabase import Client

from ..dependencies import (
    get_supabase,
    get_slack_repository,
    get_slack_service,
)
from ..services.slack_service import SlackIntegrationService
from ..services.encryption import decrypt_token
from ..repositories.slack import SlackRepository
from ..schemas.slack import (
    SlackConnectionStatus,
    SlackPreferencesResponse,
    SlackPreferencesUpdate,
)
from ..config import settings
from ..utils.structured_logger import get_logger

router = APIRouter(prefix="/api/slack", tags=["slack"])
logger = get_logger(__name__)


# =============================================================================
# OAuth State Management Helper Functions
# =============================================================================

def save_oauth_state(
    supabase: Client,
    state: str,
    owner_type: str,
    owner_id: str,
    redirect_uri: str,
) -> bool:
    """
    Save OAuth state to Supabase for Lambda stateless environment.
    
    Args:
        supabase: Supabase client instance.
        state: OAuth state token.
        owner_type: Type of owner (e.g., "user").
        owner_id: ID of the owner.
        redirect_uri: URI to redirect after OAuth completion.
        
    Returns:
        True if state was saved successfully, False otherwise.
    """
    try:
        supabase.table("slack_oauth_states").insert({
            "state": state,
            "owner_type": owner_type,
            "owner_id": owner_id,
            "redirect_uri": redirect_uri,
        }).execute()
        logger.info(f"OAuth state saved to database: {state[:8]}...")
        return True
    except Exception as e:
        logger.error(f"Failed to save OAuth state: {str(e)}")
        return False


def get_and_delete_oauth_state(supabase: Client, state: str) -> Optional[dict]:
    """
    Get and delete OAuth state from Supabase (atomic operation).
    
    Args:
        supabase: Supabase client instance.
        state: OAuth state token to retrieve and delete.
        
    Returns:
        State data dict if found and valid, None otherwise.
    """
    try:
        # Get the state
        result = supabase.table("slack_oauth_states").select("*").eq("state", state).execute()
        
        if not result.data:
            logger.warning(f"OAuth state not found: {state[:8]}...")
            return None
        
        state_data = result.data[0]
        
        # Check expiration
        expires_at = datetime.fromisoformat(state_data["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            logger.warning(f"OAuth state expired: {state[:8]}...")
            # Delete expired state
            supabase.table("slack_oauth_states").delete().eq("state", state).execute()
            return None
        
        # Delete the state (one-time use)
        supabase.table("slack_oauth_states").delete().eq("state", state).execute()
        logger.info(f"OAuth state retrieved and deleted: {state[:8]}...")
        
        return {
            "owner_type": state_data["owner_type"],
            "owner_id": state_data["owner_id"],
            "redirect_uri": state_data.get("redirect_uri", ""),
            "timestamp": datetime.fromisoformat(state_data["created_at"].replace("Z", "+00:00")).timestamp(),
        }
    except Exception as e:
        logger.error(f"Failed to get OAuth state: {str(e)}")
        return None


def cleanup_expired_oauth_states(supabase: Client) -> None:
    """
    Clean up expired OAuth states from database.
    
    Args:
        supabase: Supabase client instance.
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("slack_oauth_states").delete().lt("expires_at", now).execute()
    except Exception as e:
        logger.warning(f"Failed to cleanup expired OAuth states: {str(e)}")


# =============================================================================
# JWT Verification Functions (no DI needed - stateless utilities)
# =============================================================================

def get_current_user(request: Request) -> dict:
    """
    Get current authenticated user from JWT middleware.
    
    Args:
        request: The incoming FastAPI request.
        
    Returns:
        Dict with user id and type.
        
    Raises:
        HTTPException: If user is not authenticated or user ID not found.
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Extract user ID from JWT payload (works with both Supabase and Cognito)
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    return {"id": user_id, "type": "user"}


def verify_jwt_token(token: str) -> dict:
    """
    Verify JWT token and extract user info.
    
    Supports both:
    - ES256 (asymmetric): Uses JWKS endpoint to get public key
    - HS256 (symmetric): Uses JWT_SECRET for verification
    
    Args:
        token: JWT token string.
        
    Returns:
        Dict with user id and type.
        
    Raises:
        HTTPException: If token is invalid or expired.
    """
    try:
        # Get token header to check algorithm
        headers = jwt.get_unverified_headers(token)
        token_alg = headers.get("alg", "unknown")
        token_kid = headers.get("kid")
        logger.info(f"Token algorithm: {token_alg}, kid: {token_kid}")
        
        # Determine verification method based on algorithm
        if token_alg in ["ES256", "ES384", "ES512", "RS256", "RS384", "RS512"]:
            # Asymmetric algorithm - use JWKS
            payload = _verify_with_jwks(token, token_alg, token_kid)
        else:
            # Symmetric algorithm (HS256, etc.) - use JWT_SECRET
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience=settings.jwt_audience,
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")
        return {"id": user_id, "type": "user"}
    except JWTError as e:
        logger.error(f"JWT verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        logger.error(f"Unexpected error during JWT verification: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# Cache for JWKS
_supabase_jwks_cache: dict = {}
_supabase_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour


def _get_supabase_jwks() -> dict:
    """Fetch and cache Supabase JWKS."""
    import time
    import json
    from urllib.request import urlopen
    
    global _supabase_jwks_cache, _supabase_jwks_cache_time
    
    current_time = time.time()
    if _supabase_jwks_cache and (current_time - _supabase_jwks_cache_time) < JWKS_CACHE_TTL:
        return _supabase_jwks_cache
    
    if not settings.supabase_url:
        raise ValueError("SUPABASE_URL is not configured")
    
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    logger.info(f"Fetching JWKS from: {jwks_url}")
    
    with urlopen(jwks_url, timeout=10) as response:
        _supabase_jwks_cache = json.loads(response.read().decode("utf-8"))
        _supabase_jwks_cache_time = current_time
    
    logger.info(f"JWKS fetched, keys count: {len(_supabase_jwks_cache.get('keys', []))}")
    return _supabase_jwks_cache


def _verify_with_jwks(token: str, alg: str, kid: str) -> dict:
    """Verify JWT using JWKS public key."""
    from jose import jwk
    
    jwks = _get_supabase_jwks()
    
    # Find the key with matching kid
    public_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            public_key = jwk.construct(key).to_pem().decode("utf-8")
            break
    
    if not public_key:
        # If no kid match, try the first key
        if jwks.get("keys"):
            logger.warning(f"No key found with kid={kid}, using first available key")
            public_key = jwk.construct(jwks["keys"][0]).to_pem().decode("utf-8")
        else:
            raise JWTError("No public keys available in JWKS")
    
    # Verify token with public key
    return jwt.decode(
        token,
        public_key,
        algorithms=[alg],
        audience=settings.jwt_audience,
        options={
            "verify_aud": True,
            "verify_exp": True,
        }
    )


# =============================================================================
# Route Handlers with Dependency Injection
# =============================================================================

@router.get("/connect")
async def initiate_oauth(
    request: Request,
    redirect_uri: Optional[str] = Query(None),
    token: Optional[str] = Query(None),  # Accept token via query parameter for redirect
    supabase: Client = Depends(get_supabase),
    slack_service: SlackIntegrationService = Depends(get_slack_service),
) -> RedirectResponse:
    """
    Initiate Slack OAuth flow.
    Redirects user to Slack authorization page.
    
    Token can be passed via:
    1. Query parameter (for redirect-based flow)
    2. Authorization header (via middleware)
    
    Args:
        request: The incoming FastAPI request.
        redirect_uri: Optional redirect URI after OAuth completion.
        token: Optional JWT token via query parameter.
        supabase: Supabase client (injected via Depends).
        slack_service: SlackIntegrationService (injected via Depends).
        
    Returns:
        RedirectResponse to Slack OAuth URL.
        
    Raises:
        HTTPException: If not authenticated or Slack not configured.
    """
    # Get user from token (query param) or middleware
    if token:
        current_user = verify_jwt_token(token)
    else:
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated. Please provide token.")
        user_id = user.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
        current_user = {"id": user_id, "type": "user"}
    
    # Validate Slack configuration
    if not slack_service.client_id:
        logger.error("Slack integration not configured: missing SLACK_CLIENT_ID")
        raise HTTPException(
            status_code=500,
            detail="Slack integration is not configured. Please contact administrator."
        )
    
    # Generate state token
    state = secrets.token_urlsafe(32)
    
    # Store state in database (for Lambda stateless environment)
    redirect_uri_value = redirect_uri or os.environ.get("SLACK_REDIRECT_URI", "")
    if not save_oauth_state(supabase, state, current_user["type"], current_user["id"], redirect_uri_value):
        raise HTTPException(
            status_code=500,
            detail="Failed to initialize OAuth flow. Please try again."
        )
    
    # Clean up expired states in background
    cleanup_expired_oauth_states(supabase)
    
    # Get OAuth URL
    callback_uri = os.environ.get(
        "SLACK_CALLBACK_URI",
        f"{request.base_url}api/slack/callback"
    )
    
    oauth_url = slack_service.get_oauth_url(
        redirect_uri=callback_uri,
        state=state,
    )
    
    return RedirectResponse(url=oauth_url)


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
    supabase: Client = Depends(get_supabase),
    slack_repo: SlackRepository = Depends(get_slack_repository),
    slack_service: SlackIntegrationService = Depends(get_slack_service),
) -> RedirectResponse:
    """
    Handle OAuth callback from Slack.
    Exchanges code for tokens and stores connection.
    
    Args:
        code: Authorization code from Slack.
        state: OAuth state token.
        error: Optional error from Slack.
        supabase: Supabase client (injected via Depends).
        slack_repo: SlackRepository (injected via Depends).
        slack_service: SlackIntegrationService (injected via Depends).
        
    Returns:
        RedirectResponse to frontend with success or error.
    """
    # Get frontend URL from state data or use default
    def get_error_redirect(error_code: str, message: str, redirect_base: str = None) -> str:
        base = redirect_base or os.environ.get("FRONTEND_URL", "https://main.do1k9oyyorn24.amplifyapp.com")
        return f"{base}/settings?error={error_code}&message={message}"
    
    # Check for error from Slack
    if error:
        logger.warning(f"Slack OAuth denied: {error}")
        return RedirectResponse(
            url=get_error_redirect("slack_oauth_denied", error)
        )
    
    # Validate state from database
    state_data = get_and_delete_oauth_state(supabase, state)
    if not state_data:
        logger.warning(f"Invalid OAuth state: {state[:8]}...")
        return RedirectResponse(
            url=get_error_redirect("invalid_state", "OAuth+state+invalid+or+expired")
        )
    
    # Get redirect URI from state
    redirect_uri = state_data.get("redirect_uri", "")
    # Extract base URL from redirect_uri (e.g., https://main.do1k9oyyorn24.amplifyapp.com/settings -> https://main.do1k9oyyorn24.amplifyapp.com)
    if redirect_uri:
        from urllib.parse import urlparse
        parsed = urlparse(redirect_uri)
        frontend_base = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
    else:
        frontend_base = None
    
    # Exchange code for tokens
    callback_uri = os.environ.get("SLACK_CALLBACK_URI", "")
    try:
        token_response = await slack_service.exchange_code_for_tokens(code, callback_uri)
    except Exception as e:
        logger.error(f"Token exchange failed: {str(e)}")
        return RedirectResponse(
            url=get_error_redirect("token_exchange_failed", str(e), frontend_base)
        )
    
    if not token_response.ok:
        logger.error(f"Token exchange failed: {token_response.error}")
        return RedirectResponse(
            url=get_error_redirect("token_exchange_failed", token_response.error or "Unknown+error", frontend_base)
        )
    
    # Create connection
    connection_data = slack_service.create_connection_from_oauth(token_response)
    
    try:
        await slack_repo.create_connection(
            owner_type=state_data["owner_type"],
            owner_id=state_data["owner_id"],
            connection_data=connection_data,
        )
        logger.info(f"Slack connection created for user {state_data['owner_id']}")
    except Exception as e:
        logger.error(f"Failed to save connection: {str(e)}")
        return RedirectResponse(
            url=get_error_redirect("connection_failed", str(e), frontend_base)
        )
    
    # Redirect to settings with success
    final_redirect = redirect_uri if redirect_uri else f"{frontend_base or 'https://main.do1k9oyyorn24.amplifyapp.com'}/settings"
    return RedirectResponse(url=f"{final_redirect}?slack_connected=true")


@router.post("/disconnect")
async def disconnect_slack(
    current_user: dict = Depends(get_current_user),
    slack_repo: SlackRepository = Depends(get_slack_repository),
    slack_service: SlackIntegrationService = Depends(get_slack_service),
) -> dict:
    """
    Revoke tokens and remove Slack connection.
    
    Args:
        current_user: Current authenticated user (injected via Depends).
        slack_repo: SlackRepository (injected via Depends).
        slack_service: SlackIntegrationService (injected via Depends).
        
    Returns:
        Success response dict.
        
    Raises:
        HTTPException: If no Slack connection found.
    """
    # Get current connection
    connection = await slack_repo.get_connection_with_tokens(
        current_user["type"],
        current_user["id"],
    )
    
    if not connection:
        raise HTTPException(status_code=404, detail="No Slack connection found")
    
    # Revoke token
    try:
        token = decrypt_token(connection["access_token"])
        await slack_service.revoke_token(token)
    except Exception:
        pass  # Continue even if revocation fails
    
    # Delete connection
    await slack_repo.delete_connection(
        current_user["type"],
        current_user["id"],
    )
    
    return {"success": True, "message": "Slack disconnected"}


@router.get("/status")
async def get_connection_status(
    current_user: dict = Depends(get_current_user),
    slack_repo: SlackRepository = Depends(get_slack_repository),
) -> SlackConnectionStatus:
    """
    Get current Slack connection status.
    
    Args:
        current_user: Current authenticated user (injected via Depends).
        slack_repo: SlackRepository (injected via Depends).
        
    Returns:
        SlackConnectionStatus with connection and preferences info.
    """
    connection = await slack_repo.get_connection(
        current_user["type"],
        current_user["id"],
    )
    
    preferences = await slack_repo.get_preferences(
        current_user["type"],
        current_user["id"],
    )
    
    return SlackConnectionStatus(
        connected=connection is not None and connection.is_valid,
        connection=connection,
        preferences=preferences,
    )


@router.get("/preferences")
async def get_preferences(
    current_user: dict = Depends(get_current_user),
    slack_repo: SlackRepository = Depends(get_slack_repository),
) -> SlackPreferencesResponse:
    """
    Get Slack notification preferences.
    
    Args:
        current_user: Current authenticated user (injected via Depends).
        slack_repo: SlackRepository (injected via Depends).
        
    Returns:
        SlackPreferencesResponse with notification preferences.
    """
    preferences = await slack_repo.get_preferences(
        current_user["type"],
        current_user["id"],
    )
    
    if not preferences:
        return SlackPreferencesResponse()
    
    return preferences


@router.put("/preferences")
async def update_preferences(
    preferences: SlackPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    slack_repo: SlackRepository = Depends(get_slack_repository),
) -> SlackPreferencesResponse:
    """
    Update Slack notification preferences.
    
    Args:
        preferences: New preferences to update.
        current_user: Current authenticated user (injected via Depends).
        slack_repo: SlackRepository (injected via Depends).
        
    Returns:
        Updated SlackPreferencesResponse.
    """
    updated = await slack_repo.update_preferences(
        current_user["type"],
        current_user["id"],
        preferences,
    )
    
    return updated


@router.post("/test")
async def test_connection(
    current_user: dict = Depends(get_current_user),
    slack_repo: SlackRepository = Depends(get_slack_repository),
    slack_service: SlackIntegrationService = Depends(get_slack_service),
) -> dict:
    """
    Send a test message to verify Slack connection.
    
    Args:
        current_user: Current authenticated user (injected via Depends).
        slack_repo: SlackRepository (injected via Depends).
        slack_service: SlackIntegrationService (injected via Depends).
        
    Returns:
        Success response dict.
        
    Raises:
        HTTPException: If no connection found, connection invalid, or message fails.
    """
    # Get connection
    connection = await slack_repo.get_connection_with_tokens(
        current_user["type"],
        current_user["id"],
    )
    
    if not connection:
        raise HTTPException(status_code=404, detail="No Slack connection found")
    
    if not connection.get("is_valid"):
        raise HTTPException(status_code=400, detail="Slack connection is invalid")
    
    try:
        token = decrypt_token(connection["access_token"])
        slack_user_id = connection["slack_user_id"]
        
        # Get DM channel
        channel = await slack_service.get_user_dm_channel(token, slack_user_id)
        if not channel:
            raise HTTPException(status_code=400, detail="Could not open DM channel")
        
        # Send test message
        from ..schemas.slack import SlackMessage
        
        message = SlackMessage(
            channel=channel,
            text="🎉 Test message from VOW! Your Slack integration is working.",
            blocks=[
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "🎉 *Test message from VOW!*\n\nYour Slack integration is working correctly. You'll receive habit reminders and weekly reports here.",
                    },
                },
            ],
        )
        
        response = await slack_service.send_message(token, message)
        
        if response.ok:
            return {"success": True, "message": "Test message sent!"}
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send message: {response.error}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
