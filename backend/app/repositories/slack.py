"""
Slack Repository

Database operations for Slack connections and follow-up status.
"""

from typing import Optional, List
from datetime import date, datetime
from supabase import Client

from ..schemas.slack import (
    SlackConnectionCreate,
    SlackConnectionResponse,
    SlackFollowUpStatusResponse,
    SlackPreferencesResponse,
    SlackPreferencesUpdate,
)


class SlackRepository:
    """Repository for Slack-related database operations."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    # ========================================================================
    # Slack Connections
    # ========================================================================

    async def create_connection(
        self,
        owner_type: str,
        owner_id: str,
        connection_data: SlackConnectionCreate,
    ) -> SlackConnectionResponse:
        """Create a new Slack connection."""
        data = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            **connection_data.model_dump(),
        }
        
        result = self.supabase.table("slack_connections").upsert(
            data,
            on_conflict="owner_type,owner_id"
        ).execute()
        
        if result.data:
            return SlackConnectionResponse(**result.data[0])
        raise Exception("Failed to create Slack connection")

    async def get_connection(
        self,
        owner_type: str,
        owner_id: str,
    ) -> Optional[SlackConnectionResponse]:
        """Get Slack connection for an owner."""
        result = self.supabase.table("slack_connections").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        if result.data:
            return SlackConnectionResponse(**result.data[0])
        return None

    async def get_connection_by_slack_user(
        self,
        slack_user_id: str,
        slack_team_id: str,
    ) -> Optional[SlackConnectionResponse]:
        """Get Slack connection by Slack user and team ID."""
        result = self.supabase.table("slack_connections").select("*").eq(
            "slack_user_id", slack_user_id
        ).eq("slack_team_id", slack_team_id).execute()
        
        if result.data:
            return SlackConnectionResponse(**result.data[0])
        return None

    async def get_connection_with_tokens(
        self,
        owner_type: str,
        owner_id: str,
    ) -> Optional[dict]:
        """Get Slack connection including encrypted tokens (for internal use)."""
        result = self.supabase.table("slack_connections").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        if result.data:
            return result.data[0]
        return None

    async def update_connection(
        self,
        owner_type: str,
        owner_id: str,
        updates: dict,
    ) -> Optional[SlackConnectionResponse]:
        """Update a Slack connection."""
        result = self.supabase.table("slack_connections").update(updates).eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        if result.data:
            return SlackConnectionResponse(**result.data[0])
        return None

    async def delete_connection(
        self,
        owner_type: str,
        owner_id: str,
    ) -> bool:
        """Delete a Slack connection."""
        result = self.supabase.table("slack_connections").delete().eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        return len(result.data) > 0 if result.data else False

    async def mark_connection_invalid(
        self,
        owner_type: str,
        owner_id: str,
    ) -> bool:
        """Mark a Slack connection as invalid."""
        result = self.supabase.table("slack_connections").update({
            "is_valid": False
        }).eq("owner_type", owner_type).eq("owner_id", owner_id).execute()
        
        return len(result.data) > 0 if result.data else False

    async def get_valid_connections_for_reports(
        self,
        report_day: int,
        report_time: str,
    ) -> List[dict]:
        """Get all valid connections with weekly reports enabled for given day/time."""
        # This requires a join with notification_preferences
        # For now, return connections and filter in service layer
        result = self.supabase.table("slack_connections").select("*").eq(
            "is_valid", True
        ).execute()
        
        return result.data if result.data else []

    # ========================================================================
    # Notification Preferences
    # ========================================================================

    async def get_preferences(
        self,
        owner_type: str,
        owner_id: str,
    ) -> Optional[SlackPreferencesResponse]:
        """Get Slack notification preferences."""
        result = self.supabase.table("notification_preferences").select(
            "slack_notifications_enabled, weekly_slack_report_enabled, "
            "weekly_report_day, weekly_report_time"
        ).eq("owner_type", owner_type).eq("owner_id", owner_id).execute()
        
        if result.data:
            data = result.data[0]
            return SlackPreferencesResponse(
                slack_notifications_enabled=data.get("slack_notifications_enabled", False),
                weekly_slack_report_enabled=data.get("weekly_slack_report_enabled", False),
                weekly_report_day=data.get("weekly_report_day", 0),
                weekly_report_time=str(data.get("weekly_report_time", "09:00")),
            )
        return None

    async def update_preferences(
        self,
        owner_type: str,
        owner_id: str,
        preferences: SlackPreferencesUpdate,
    ) -> SlackPreferencesResponse:
        """Update Slack notification preferences."""
        updates = {k: v for k, v in preferences.model_dump().items() if v is not None}
        
        if updates.get("weekly_report_time"):
            updates["weekly_report_time"] = str(updates["weekly_report_time"])
        
        # Upsert to create if not exists
        data = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            **updates,
        }
        
        result = self.supabase.table("notification_preferences").upsert(
            data,
            on_conflict="owner_type,owner_id"
        ).execute()
        
        if result.data:
            row = result.data[0]
            return SlackPreferencesResponse(
                slack_notifications_enabled=row.get("slack_notifications_enabled", False),
                weekly_slack_report_enabled=row.get("weekly_slack_report_enabled", False),
                weekly_report_day=row.get("weekly_report_day", 0),
                weekly_report_time=str(row.get("weekly_report_time", "09:00")),
            )
        raise Exception("Failed to update preferences")

    # ========================================================================
    # Follow-Up Status
    # ========================================================================

    async def get_follow_up_status(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        status_date: date,
    ) -> Optional[SlackFollowUpStatusResponse]:
        """Get follow-up status for a habit on a specific date."""
        result = self.supabase.table("slack_follow_up_status").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("habit_id", habit_id).eq(
            "date", status_date.isoformat()
        ).execute()
        
        if result.data:
            return SlackFollowUpStatusResponse(**result.data[0])
        return None

    async def create_or_update_follow_up_status(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        status_date: date,
        updates: dict,
    ) -> SlackFollowUpStatusResponse:
        """Create or update follow-up status."""
        data = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "habit_id": habit_id,
            "date": status_date.isoformat(),
            **updates,
        }
        
        result = self.supabase.table("slack_follow_up_status").upsert(
            data,
            on_conflict="owner_type,owner_id,habit_id,date"
        ).execute()
        
        if result.data:
            return SlackFollowUpStatusResponse(**result.data[0])
        raise Exception("Failed to update follow-up status")

    async def mark_reminder_sent(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        status_date: date,
    ) -> SlackFollowUpStatusResponse:
        """Mark that a reminder was sent."""
        return await self.create_or_update_follow_up_status(
            owner_type, owner_id, habit_id, status_date,
            {"reminder_sent_at": datetime.utcnow().isoformat()}
        )

    async def mark_follow_up_sent(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        status_date: date,
    ) -> SlackFollowUpStatusResponse:
        """Mark that a follow-up was sent."""
        return await self.create_or_update_follow_up_status(
            owner_type, owner_id, habit_id, status_date,
            {"follow_up_sent_at": datetime.utcnow().isoformat()}
        )

    async def mark_skipped(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        status_date: date,
    ) -> SlackFollowUpStatusResponse:
        """Mark that user skipped this habit today."""
        return await self.create_or_update_follow_up_status(
            owner_type, owner_id, habit_id, status_date,
            {"skipped": True}
        )

    async def set_remind_later(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        status_date: date,
        remind_at: datetime,
    ) -> SlackFollowUpStatusResponse:
        """Set remind later time."""
        return await self.create_or_update_follow_up_status(
            owner_type, owner_id, habit_id, status_date,
            {"remind_later_at": remind_at.isoformat()}
        )

    async def get_habits_needing_follow_up(
        self,
        status_date: date,
    ) -> List[dict]:
        """Get habits that need follow-up messages."""
        # Get all follow-up statuses for today where follow-up not sent and not skipped
        result = self.supabase.table("slack_follow_up_status").select("*").eq(
            "date", status_date.isoformat()
        ).is_("follow_up_sent_at", "null").eq("skipped", False).execute()
        
        return result.data if result.data else []

    async def get_habits_needing_remind_later(
        self,
        current_time: datetime,
    ) -> List[dict]:
        """Get habits where remind_later_at has passed."""
        result = self.supabase.table("slack_follow_up_status").select("*").lte(
            "remind_later_at", current_time.isoformat()
        ).is_("follow_up_sent_at", "null").eq("skipped", False).execute()
        
        return result.data if result.data else []
