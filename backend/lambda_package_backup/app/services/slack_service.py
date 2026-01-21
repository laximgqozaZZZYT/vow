"""
Slack Integration Service

Core service for Slack API interactions including OAuth, messaging, and webhook handling.
"""

import os
import hmac
import hashlib
import time
import asyncio
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import httpx

from ..schemas.slack import (
    SlackMessage,
    SlackMessageResponse,
    SlackOAuthTokenResponse,
    SlackConnectionCreate,
)
from .encryption import encrypt_token, decrypt_token


class SlackAPIError(Exception):
    """Exception for Slack API errors."""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.error_code = error_code


class RateLimitError(SlackAPIError):
    """Exception for rate limit errors."""
    def __init__(self, retry_after: int = 1):
        super().__init__(f"Rate limited. Retry after {retry_after} seconds")
        self.retry_after = retry_after


class TokenExpiredError(SlackAPIError):
    """Exception for expired token errors."""
    pass


class CircuitBreaker:
    """Simple circuit breaker implementation."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 30,
    ):
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.failures = 0
        self.successes = 0
        self.state = "closed"  # closed, open, half-open
        self.last_failure_time: Optional[float] = None

    def record_success(self):
        """Record a successful call."""
        if self.state == "half-open":
            self.successes += 1
            if self.successes >= self.success_threshold:
                self.state = "closed"
                self.failures = 0
                self.successes = 0
        elif self.state == "closed":
            self.failures = 0

    def record_failure(self):
        """Record a failed call."""
        self.failures += 1
        self.successes = 0
        self.last_failure_time = time.time()
        
        if self.failures >= self.failure_threshold:
            self.state = "open"

    def can_execute(self) -> bool:
        """Check if a call can be executed."""
        if self.state == "closed":
            return True
        
        if self.state == "open":
            if self.last_failure_time and (time.time() - self.last_failure_time) > self.timeout:
                self.state = "half-open"
                return True
            return False
        
        # half-open
        return True


class SlackIntegrationService:
    """Service for Slack API interactions."""

    SLACK_API_BASE = "https://slack.com/api"
    SLACK_OAUTH_AUTHORIZE = "https://slack.com/oauth/v2/authorize"

    def __init__(self):
        self.client_id = os.environ.get("SLACK_CLIENT_ID", "")
        self.client_secret = os.environ.get("SLACK_CLIENT_SECRET", "")
        self.signing_secret = os.environ.get("SLACK_SIGNING_SECRET", "")
        self.bot_token = os.environ.get("SLACK_BOT_TOKEN", "")
        self.circuit_breaker = CircuitBreaker()
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def close(self):
        """Close HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    # ========================================================================
    # OAuth Methods
    # ========================================================================

    def get_oauth_url(
        self,
        redirect_uri: str,
        state: str,
        scopes: Optional[list] = None,
    ) -> str:
        """Generate Slack OAuth authorization URL."""
        if scopes is None:
            scopes = ["chat:write", "commands", "users:read", "im:write"]
        
        params = {
            "client_id": self.client_id,
            "scope": ",".join(scopes),
            "redirect_uri": redirect_uri,
            "state": state,
        }
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.SLACK_OAUTH_AUTHORIZE}?{query}"

    async def exchange_code_for_tokens(
        self,
        code: str,
        redirect_uri: str,
    ) -> SlackOAuthTokenResponse:
        """Exchange OAuth code for access tokens."""
        client = await self._get_client()
        
        response = await client.post(
            f"{self.SLACK_API_BASE}/oauth.v2.access",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        
        data = response.json()
        return SlackOAuthTokenResponse(**data)

    async def revoke_token(self, token: str) -> bool:
        """Revoke an access token."""
        client = await self._get_client()
        
        response = await client.post(
            f"{self.SLACK_API_BASE}/auth.revoke",
            headers={"Authorization": f"Bearer {token}"},
        )
        
        data = response.json()
        return data.get("ok", False)

    async def refresh_token(self, refresh_token: str) -> Optional[SlackOAuthTokenResponse]:
        """Refresh an expired access token."""
        client = await self._get_client()
        
        response = await client.post(
            f"{self.SLACK_API_BASE}/oauth.v2.access",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )
        
        data = response.json()
        if data.get("ok"):
            return SlackOAuthTokenResponse(**data)
        return None

    # ========================================================================
    # Messaging Methods
    # ========================================================================

    async def send_message(
        self,
        token: str,
        message: SlackMessage,
        retry_count: int = 3,
    ) -> SlackMessageResponse:
        """
        Send a message to Slack.
        
        Args:
            token: Bot or user access token
            message: Message to send
            retry_count: Number of retries on rate limit
            
        Returns:
            SlackMessageResponse with result
        """
        if not self.circuit_breaker.can_execute():
            raise SlackAPIError("Circuit breaker is open")

        client = await self._get_client()
        
        payload = {
            "channel": message.channel,
            "text": message.text,
        }
        
        if message.blocks:
            payload["blocks"] = message.blocks
        
        if message.thread_ts:
            payload["thread_ts"] = message.thread_ts

        for attempt in range(retry_count):
            try:
                response = await client.post(
                    f"{self.SLACK_API_BASE}/chat.postMessage",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                
                data = response.json()
                
                if data.get("ok"):
                    self.circuit_breaker.record_success()
                    return SlackMessageResponse(**data)
                
                error = data.get("error", "unknown_error")
                
                if error == "ratelimited":
                    retry_after = int(response.headers.get("Retry-After", 1))
                    if attempt < retry_count - 1:
                        await asyncio.sleep(retry_after * (2 ** attempt))
                        continue
                    raise RateLimitError(retry_after)
                
                if error in ("token_expired", "invalid_auth"):
                    raise TokenExpiredError(f"Token error: {error}")
                
                self.circuit_breaker.record_failure()
                return SlackMessageResponse(ok=False, error=error)
                
            except httpx.RequestError as e:
                self.circuit_breaker.record_failure()
                if attempt < retry_count - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise SlackAPIError(f"Request failed: {str(e)}")

        raise SlackAPIError("Max retries exceeded")

    async def send_response(
        self,
        response_url: str,
        text: str,
        blocks: Optional[list] = None,
        replace_original: bool = False,
    ) -> bool:
        """
        Send a response to a Slack interaction via response_url.
        
        Args:
            response_url: The response URL from the interaction
            text: Fallback text
            blocks: Optional Block Kit blocks
            replace_original: Whether to replace the original message
            
        Returns:
            True if successful
        """
        client = await self._get_client()
        
        payload = {
            "text": text,
            "replace_original": replace_original,
        }
        
        if blocks:
            payload["blocks"] = blocks

        response = await client.post(response_url, json=payload)
        return response.status_code == 200

    # ========================================================================
    # Webhook Security
    # ========================================================================

    def verify_signature(
        self,
        timestamp: str,
        body: bytes,
        signature: str,
    ) -> bool:
        """
        Verify Slack request signature using HMAC-SHA256.
        
        Args:
            timestamp: X-Slack-Request-Timestamp header
            body: Raw request body
            signature: X-Slack-Signature header
            
        Returns:
            True if signature is valid
        """
        if not self.signing_secret:
            return False

        # Check timestamp to prevent replay attacks (5 minute window)
        try:
            request_time = int(timestamp)
            current_time = int(time.time())
            if abs(current_time - request_time) > 300:  # 5 minutes
                return False
        except ValueError:
            return False

        # Compute expected signature
        sig_basestring = f"v0:{timestamp}:{body.decode()}"
        expected_signature = "v0=" + hmac.new(
            self.signing_secret.encode(),
            sig_basestring.encode(),
            hashlib.sha256,
        ).hexdigest()

        # Compare signatures using constant-time comparison
        return hmac.compare_digest(expected_signature, signature)

    # ========================================================================
    # User Info Methods
    # ========================================================================

    async def get_user_info(self, token: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get Slack user information."""
        client = await self._get_client()
        
        response = await client.get(
            f"{self.SLACK_API_BASE}/users.info",
            headers={"Authorization": f"Bearer {token}"},
            params={"user": user_id},
        )
        
        data = response.json()
        if data.get("ok"):
            return data.get("user")
        return None

    async def get_user_dm_channel(self, token: str, user_id: str) -> Optional[str]:
        """Open or get DM channel with a user."""
        client = await self._get_client()
        
        response = await client.post(
            f"{self.SLACK_API_BASE}/conversations.open",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"users": user_id},
        )
        
        data = response.json()
        if data.get("ok"):
            return data.get("channel", {}).get("id")
        return None

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def create_connection_from_oauth(
        self,
        token_response: SlackOAuthTokenResponse,
    ) -> SlackConnectionCreate:
        """Create a SlackConnectionCreate from OAuth token response."""
        team = token_response.team or {}
        authed_user = token_response.authed_user or {}
        
        return SlackConnectionCreate(
            slack_user_id=authed_user.get("id", ""),
            slack_team_id=team.get("id", ""),
            slack_team_name=team.get("name"),
            slack_user_name=None,  # Can be fetched separately
            access_token=encrypt_token(token_response.access_token or ""),
            refresh_token=encrypt_token(token_response.refresh_token or "") if token_response.refresh_token else None,
            bot_access_token=None,  # Set if using bot token
            token_expires_at=None,  # Set based on token type
        )


# Singleton instance
_slack_service: Optional[SlackIntegrationService] = None


def get_slack_service() -> SlackIntegrationService:
    """Get or create the singleton Slack service instance."""
    global _slack_service
    if _slack_service is None:
        _slack_service = SlackIntegrationService()
    return _slack_service
