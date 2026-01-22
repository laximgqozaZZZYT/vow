"""
Slack Repository

Database operations for Slack connections, notification preferences, and follow-up status.

This repository manages multiple related tables:
- slack_connections: Stores Slack OAuth connections linking owners to Slack workspaces
- notification_preferences: Stores user preferences for Slack notifications
- slack_follow_up_status: Tracks reminder and follow-up message status per habit per day
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from supabase import Client

from ..schemas.slack import (
    SlackConnectionCreate,
    SlackConnectionResponse,
    SlackFollowUpStatusResponse,
    SlackPreferencesResponse,
    SlackPreferencesUpdate,
)


# Type aliases for entities (dict from Supabase)
SlackConnection = Dict[str, Any]
SlackPreferences = Dict[str, Any]
SlackFollowUpStatus = Dict[str, Any]


class SlackRepository:
    """
    Repository for Slack-related database operations.
    
    This repository encapsulates all database operations for Slack integration,
    including connection management, notification preferences, and follow-up tracking.
    Unlike other repositories, this class manages multiple related tables rather than
    extending BaseRepository, as the Slack integration requires coordinated operations
    across several tables.
    
    Attributes:
        supabase: The Supabase client instance for database operations.
    
    Tables Managed:
        - slack_connections: OAuth connections between owners and Slack workspaces
        - notification_preferences: User preferences for Slack notifications
        - slack_follow_up_status: Daily tracking of reminder/follow-up message status
    """

    def __init__(self, supabase: Client):
        """
        Initialize the SlackRepository.
        
        Args:
            supabase: The Supabase client instance.
        """
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
        """
        Create a new Slack connection or update existing one.
        
        Creates a new connection between an owner and a Slack workspace. If a connection
        already exists for the owner, it will be updated (upsert behavior).
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            connection_data: The Slack connection data including tokens and workspace info.
        
        Returns:
            SlackConnectionResponse containing the created/updated connection details.
        
        Raises:
            Exception: If the connection creation fails.
        """
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
        """
        Get Slack connection for an owner.
        
        Retrieves the Slack connection associated with the specified owner.
        This is commonly used to check if a user has connected their Slack account.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            SlackConnectionResponse if a connection exists, None otherwise.
        """
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
        """
        Get Slack connection by Slack user and team ID.
        
        Retrieves the connection associated with a specific Slack user in a specific
        workspace. This is used when processing incoming Slack events to identify
        the owner associated with the Slack user.
        
        Args:
            slack_user_id: The Slack user ID (e.g., "U12345678").
            slack_team_id: The Slack team/workspace ID (e.g., "T12345678").
        
        Returns:
            SlackConnectionResponse if a connection exists, None otherwise.
        """
        result = self.supabase.table("slack_connections").select("*").eq(
            "slack_user_id", slack_user_id
        ).eq("slack_team_id", slack_team_id).execute()
        
        if result.data:
            return SlackConnectionResponse(**result.data[0])
        return None

    async def get_connection_by_slack_user_id(
        self,
        slack_user_id: str,
    ) -> Optional[SlackConnection]:
        """
        Get Slack connection by Slack user ID only.
        
        Retrieves the connection associated with a specific Slack user, regardless
        of workspace. This is used when processing commands where only the user ID
        is available.
        
        Note:
            If a user has connections in multiple workspaces, this returns the first
            valid connection found.
        
        Args:
            slack_user_id: The Slack user ID (e.g., "U12345678").
        
        Returns:
            Dictionary containing the connection record if found, None otherwise.
        """
        result = self.supabase.table("slack_connections").select("*").eq(
            "slack_user_id", slack_user_id
        ).eq("is_valid", True).limit(1).execute()
        
        if result.data:
            return result.data[0]
        return None

    async def get_connection_with_tokens(
        self,
        owner_type: str,
        owner_id: str,
    ) -> Optional[SlackConnection]:
        """
        Get Slack connection including encrypted tokens.
        
        Retrieves the full connection record including encrypted access and refresh
        tokens. This is for internal use when making Slack API calls that require
        authentication.
        
        Note:
            This method returns raw data including sensitive tokens. Use with caution
            and ensure tokens are properly decrypted before use.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            Dictionary containing the full connection record including tokens,
            or None if no connection exists.
        """
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
        updates: Dict[str, Any],
    ) -> Optional[SlackConnectionResponse]:
        """
        Update a Slack connection.
        
        Updates specific fields of an existing Slack connection. This is commonly
        used to refresh tokens or update workspace information.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            updates: Dictionary containing the fields to update.
        
        Returns:
            SlackConnectionResponse with updated data if the connection exists,
            None otherwise.
        """
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
        """
        Delete a Slack connection.
        
        Removes the Slack connection for the specified owner. This is used when
        a user disconnects their Slack account or revokes access.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            True if the connection was deleted, False if no connection existed.
        """
        result = self.supabase.table("slack_connections").delete().eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        return len(result.data) > 0 if result.data else False

    async def mark_connection_invalid(
        self,
        owner_type: str,
        owner_id: str,
    ) -> bool:
        """
        Mark a Slack connection as invalid.
        
        Sets the is_valid flag to False for the specified connection. This is used
        when token refresh fails or when Slack reports the token as revoked.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            True if the connection was updated, False if no connection existed.
        """
        result = self.supabase.table("slack_connections").update({
            "is_valid": False
        }).eq("owner_type", owner_type).eq("owner_id", owner_id).execute()
        
        return len(result.data) > 0 if result.data else False

    async def get_valid_connections_for_reports(
        self,
        report_day: int,
        report_time: str,
    ) -> List[SlackConnection]:
        """
        Get all valid connections with weekly reports enabled for given day/time.
        
        Retrieves connections that are valid and have weekly reports scheduled for
        the specified day and time. This is used by the weekly report generator
        to determine which users should receive reports.
        
        Note:
            Currently returns all valid connections. Filtering by report_day and
            report_time should be done in the service layer by joining with
            notification_preferences.
        
        Args:
            report_day: The day of the week (0=Monday, 6=Sunday).
            report_time: The time in HH:MM format (e.g., "09:00").
        
        Returns:
            List of connection dictionaries for valid connections.
            Returns an empty list if no connections are found.
        """
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
        """
        Get Slack notification preferences.
        
        Retrieves the notification preferences for the specified owner, including
        settings for Slack notifications and weekly reports.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            SlackPreferencesResponse containing the preference settings,
            or None if no preferences exist.
        """
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
        """
        Update Slack notification preferences.
        
        Updates the notification preferences for the specified owner. If no preferences
        exist, they will be created (upsert behavior).
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            preferences: The preference updates to apply.
        
        Returns:
            SlackPreferencesResponse containing the updated preference settings.
        
        Raises:
            Exception: If the preference update fails.
        """
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
        """
        Get follow-up status for a habit on a specific date.
        
        Retrieves the follow-up tracking status for a specific habit on a specific
        date. This is used to determine if reminders or follow-ups have been sent.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            status_date: The date to check status for.
        
        Returns:
            SlackFollowUpStatusResponse containing the status details,
            or None if no status record exists.
        """
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
        updates: Dict[str, Any],
    ) -> SlackFollowUpStatusResponse:
        """
        Create or update follow-up status.
        
        Creates a new follow-up status record or updates an existing one for the
        specified habit and date. This is the core method used by other follow-up
        tracking methods.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            status_date: The date for the status record.
            updates: Dictionary containing the fields to set/update.
        
        Returns:
            SlackFollowUpStatusResponse containing the created/updated status.
        
        Raises:
            Exception: If the status creation/update fails.
        """
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
        """
        Mark that a reminder was sent.
        
        Records that a reminder message was sent for the specified habit on the
        specified date. This prevents duplicate reminders from being sent.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            status_date: The date the reminder was sent for.
        
        Returns:
            SlackFollowUpStatusResponse containing the updated status.
        """
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
        """
        Mark that a follow-up was sent.
        
        Records that a follow-up message was sent for the specified habit on the
        specified date. This prevents duplicate follow-ups from being sent.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            status_date: The date the follow-up was sent for.
        
        Returns:
            SlackFollowUpStatusResponse containing the updated status.
        """
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
        """
        Mark that user skipped this habit today.
        
        Records that the user chose to skip the specified habit for the specified
        date. Skipped habits will not receive follow-up messages.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            status_date: The date the habit was skipped for.
        
        Returns:
            SlackFollowUpStatusResponse containing the updated status.
        """
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
        """
        Set remind later time.
        
        Records that the user requested to be reminded later about the specified
        habit. The system will send a reminder at the specified time.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            status_date: The date for the status record.
            remind_at: The datetime when the reminder should be sent.
        
        Returns:
            SlackFollowUpStatusResponse containing the updated status.
        """
        return await self.create_or_update_follow_up_status(
            owner_type, owner_id, habit_id, status_date,
            {"remind_later_at": remind_at.isoformat()}
        )

    async def get_habits_needing_follow_up(
        self,
        status_date: date,
    ) -> List[SlackFollowUpStatus]:
        """
        Get habits that need follow-up messages.
        
        Retrieves all follow-up status records for the specified date where a
        follow-up has not been sent and the habit has not been skipped. This is
        used by the follow-up agent to determine which habits need attention.
        
        Args:
            status_date: The date to check for pending follow-ups.
        
        Returns:
            List of follow-up status dictionaries for habits needing follow-up.
            Returns an empty list if no habits need follow-up.
        """
        # Get all follow-up statuses for today where follow-up not sent and not skipped
        result = self.supabase.table("slack_follow_up_status").select("*").eq(
            "date", status_date.isoformat()
        ).is_("follow_up_sent_at", "null").eq("skipped", False).execute()
        
        return result.data if result.data else []

    async def get_habits_needing_remind_later(
        self,
        current_time: datetime,
    ) -> List[SlackFollowUpStatus]:
        """
        Get habits where remind_later_at has passed.
        
        Retrieves all follow-up status records where the remind_later_at time has
        passed and a follow-up has not been sent. This is used to send delayed
        reminders that users requested.
        
        Args:
            current_time: The current datetime to compare against remind_later_at.
        
        Returns:
            List of follow-up status dictionaries for habits with pending reminders.
            Returns an empty list if no habits have pending reminders.
        """
        result = self.supabase.table("slack_follow_up_status").select("*").lte(
            "remind_later_at", current_time.isoformat()
        ).is_("follow_up_sent_at", "null").eq("skipped", False).execute()
        
        return result.data if result.data else []
