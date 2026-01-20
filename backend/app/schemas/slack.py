"""
Slack Integration Schemas

Pydantic models for Slack OAuth, webhooks, and preferences.
"""

from pydantic import BaseModel, Field
from datetime import datetime, time
from typing import Optional, List, Dict, Any


# ============================================================================
# Slack Connection Schemas
# ============================================================================

class SlackConnectionCreate(BaseModel):
    """Schema for creating a new Slack connection."""
    slack_user_id: str = Field(..., description="Slack user ID")
    slack_team_id: str = Field(..., description="Slack workspace/team ID")
    slack_team_name: Optional[str] = Field(None, description="Slack workspace name")
    slack_user_name: Optional[str] = Field(None, description="Slack username")
    access_token: str = Field(..., description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    bot_access_token: Optional[str] = Field(None, description="Bot access token")
    token_expires_at: Optional[datetime] = Field(None, description="Token expiration time")


class SlackConnectionResponse(BaseModel):
    """Schema for Slack connection response (excludes sensitive tokens)."""
    id: str
    slack_user_id: str
    slack_team_id: str
    slack_team_name: Optional[str]
    slack_user_name: Optional[str]
    connected_at: datetime
    is_valid: bool

    class Config:
        from_attributes = True


class SlackConnectionStatus(BaseModel):
    """Schema for checking Slack connection status."""
    connected: bool
    connection: Optional[SlackConnectionResponse] = None
    preferences: Optional['SlackPreferencesResponse'] = None


# ============================================================================
# Slack Preferences Schemas
# ============================================================================

class SlackPreferencesUpdate(BaseModel):
    """Schema for updating Slack notification preferences."""
    slack_notifications_enabled: Optional[bool] = Field(
        None, description="Enable/disable Slack notifications for habits"
    )
    weekly_slack_report_enabled: Optional[bool] = Field(
        None, description="Enable/disable weekly Slack reports"
    )
    weekly_report_day: Optional[int] = Field(
        None, ge=0, le=6, description="Day of week for weekly report (0=Sunday, 6=Saturday)"
    )
    weekly_report_time: Optional[time] = Field(
        None, description="Time of day for weekly report"
    )


class SlackPreferencesResponse(BaseModel):
    """Schema for Slack preferences response."""
    slack_notifications_enabled: bool = False
    weekly_slack_report_enabled: bool = False
    weekly_report_day: int = 0
    weekly_report_time: str = "09:00"

    class Config:
        from_attributes = True


# ============================================================================
# Slack Webhook Schemas
# ============================================================================

class SlashCommandPayload(BaseModel):
    """Schema for Slack slash command payload."""
    command: str = Field(..., description="The slash command (e.g., /habit-done)")
    text: str = Field("", description="Text after the command")
    user_id: str = Field(..., description="Slack user ID who triggered the command")
    team_id: str = Field(..., description="Slack workspace ID")
    channel_id: str = Field(..., description="Channel where command was triggered")
    response_url: str = Field(..., description="URL to send delayed responses")
    trigger_id: Optional[str] = Field(None, description="Trigger ID for modals")


class InteractionUser(BaseModel):
    """Schema for user info in interaction payload."""
    id: str
    username: Optional[str] = None
    name: Optional[str] = None


class InteractionTeam(BaseModel):
    """Schema for team info in interaction payload."""
    id: str
    domain: Optional[str] = None


class InteractionAction(BaseModel):
    """Schema for action in interaction payload."""
    action_id: str
    block_id: Optional[str] = None
    type: str
    value: Optional[str] = None
    selected_option: Optional[Dict[str, Any]] = None


class InteractionPayload(BaseModel):
    """Schema for Slack interactive component payload."""
    type: str = Field(..., description="Interaction type (e.g., block_actions)")
    user: InteractionUser
    team: InteractionTeam
    actions: List[InteractionAction]
    response_url: str
    trigger_id: str
    container: Optional[Dict[str, Any]] = None
    message: Optional[Dict[str, Any]] = None


class SlackEventPayload(BaseModel):
    """Schema for Slack Events API payload."""
    type: str = Field(..., description="Event type")
    challenge: Optional[str] = Field(None, description="URL verification challenge")
    token: Optional[str] = None
    team_id: Optional[str] = None
    event: Optional[Dict[str, Any]] = None


# ============================================================================
# Slack Message Schemas
# ============================================================================

class SlackMessage(BaseModel):
    """Schema for sending a Slack message."""
    channel: str = Field(..., description="Channel ID or user ID for DM")
    text: str = Field(..., description="Fallback text for notifications")
    blocks: Optional[List[Dict[str, Any]]] = Field(
        None, description="Block Kit blocks for rich formatting"
    )
    thread_ts: Optional[str] = Field(None, description="Thread timestamp for replies")


class SlackMessageResponse(BaseModel):
    """Schema for Slack message send response."""
    ok: bool
    channel: Optional[str] = None
    ts: Optional[str] = None
    message: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ============================================================================
# Follow-Up Status Schemas
# ============================================================================

class SlackFollowUpStatusCreate(BaseModel):
    """Schema for creating follow-up status record."""
    habit_id: str
    date: Optional[str] = None  # YYYY-MM-DD format


class SlackFollowUpStatusResponse(BaseModel):
    """Schema for follow-up status response."""
    id: str
    habit_id: str
    date: str
    reminder_sent_at: Optional[datetime] = None
    follow_up_sent_at: Optional[datetime] = None
    skipped: bool = False
    remind_later_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# OAuth Schemas
# ============================================================================

class SlackOAuthState(BaseModel):
    """Schema for OAuth state parameter."""
    owner_type: str = "user"
    owner_id: str
    redirect_uri: str
    timestamp: int


class SlackOAuthTokenResponse(BaseModel):
    """Schema for Slack OAuth token exchange response."""
    ok: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: Optional[str] = None
    scope: Optional[str] = None
    bot_user_id: Optional[str] = None
    app_id: Optional[str] = None
    team: Optional[Dict[str, str]] = None
    authed_user: Optional[Dict[str, str]] = None
    error: Optional[str] = None


# Update forward references
SlackConnectionStatus.model_rebuild()
