"""
Slack OAuth Router

Handles OAuth 2.0 flow for connecting Slack workspaces.
"""

import os
import time
import secrets
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError

from ..services.slack_service import get_slack_service
from ..services.encryption import decrypt_token
from ..repositories.slack import SlackRepository
from ..schemas.slack import (
    SlackConnectionStatus,
    SlackPreferencesResponse,
    SlackPreferencesUpdate,
)
from ..config import settings

router = APIRouter(prefix="/api/slack", tags=["slack"])
logger = logging.getLogger(__name__)

# In-memory state storage (use Redis in production)
_oauth_states: dict = {}


def get_supabase():
    """Get Supabase client - implement based on your setup."""
    from ..config import get_supabase_client
    return get_supabase_client()


def get_current_user(request: Request) -> dict:
    """Get current authenticated user from JWT middleware."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Extract user ID from JWT payload (works with both Supabase and Cognito)
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    return {"id": user_id, "type": "user"}


def verify_jwt_token(token: str) -> dict:
    """Verify JWT token and extract user info."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")
        return {"id": user_id, "type": "user"}
    except JWTError as e:
        logger.error(f"JWT verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.get("/connect")
async def initiate_oauth(
    request: Request,
    redirect_uri: Optional[str] = Query(None),
    token: Optional[str] = Query(None),  # Accept token via query parameter for redirect
) -> RedirectResponse:
    """
    Initiate Slack OAuth flow.
    Redirects user to Slack authorization page.
    
    Token can be passed via:
    1. Query parameter (for redirect-based flow)
    2. Authorization header (via middleware)
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
    
    slack_service = get_slack_service()
    
    # Validate Slack configuration
    if not slack_service.client_id:
        logger.error("Slack integration not configured: missing SLACK_CLIENT_ID")
        raise HTTPException(
            status_code=500,
            detail="Slack integration is not configured. Please contact administrator."
        )
    
    # Generate state token
    state = secrets.token_urlsafe(32)
    
    # Store state with user info (expires in 10 minutes)
    _oauth_states[state] = {
        "owner_type": current_user["type"],
        "owner_id": current_user["id"],
        "redirect_uri": redirect_uri or os.environ.get("SLACK_REDIRECT_URI", ""),
        "timestamp": time.time(),
    }
    
    # Clean up old states
    current_time = time.time()
    expired_states = [
        s for s, data in _oauth_states.items()
        if current_time - data["timestamp"] > 600
    ]
    for s in expired_states:
        del _oauth_states[s]
    
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
) -> RedirectResponse:
    """
    Handle OAuth callback from Slack.
    Exchanges code for tokens and stores connection.
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
    
    # Validate state
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        logger.warning(f"Invalid OAuth state: {state}")
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
    
    # Check state expiration
    if time.time() - state_data["timestamp"] > 600:
        logger.warning("OAuth state expired")
        return RedirectResponse(
            url=get_error_redirect("state_expired", "OAuth+session+expired", frontend_base)
        )
    
    slack_service = get_slack_service()
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    
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
) -> dict:
    """
    Revoke tokens and remove Slack connection.
    """
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    slack_service = get_slack_service()
    
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
) -> SlackConnectionStatus:
    """
    Get current Slack connection status.
    """
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    
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
) -> SlackPreferencesResponse:
    """
    Get Slack notification preferences.
    """
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    
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
) -> SlackPreferencesResponse:
    """
    Update Slack notification preferences.
    """
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    
    updated = await slack_repo.update_preferences(
        current_user["type"],
        current_user["id"],
        preferences,
    )
    
    return updated


@router.post("/test")
async def test_connection(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Send a test message to verify Slack connection.
    """
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    slack_service = get_slack_service()
    
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
