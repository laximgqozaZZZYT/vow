"""
Reminder Service

Service for checking and sending habit reminders via Slack.
Supports timezone-aware reminder scheduling.

Requirements:
- 1.1: Send Slack DM reminders when habit trigger_time arrives
- 1.3: Do not send reminders if slack_notifications_enabled is false
- 1.4: Do not send reminders if habit is already completed today
- 1.5: Prevent duplicate reminder sending for the same habit on the same day
- 1.6: Fall back to in-app notification if Slack connection is invalid
- 7.1: Consider user's timezone setting when calculating reminder time
- 7.2: Use Asia/Tokyo as default timezone if not set
"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo
from supabase import Client

from .slack_service import SlackIntegrationService, get_slack_service
from .slack_block_builder import SlackBlockBuilder
from .encryption import decrypt_token
from ..repositories.slack import SlackRepository
from ..schemas.slack import SlackMessage


class ReminderService:
    """
    Service for managing habit reminder notifications.
    
    This service checks all habits with trigger_time set and sends
    reminders to users via Slack DM when the trigger time arrives.
    """

    def __init__(
        self,
        supabase: Client,
        slack_service: Optional[SlackIntegrationService] = None,
    ):
        """
        Initialize the ReminderService.
        
        Args:
            supabase: Supabase client for database operations
            slack_service: Optional Slack service instance (uses default if not provided)
        """
        self.supabase = supabase
        self.slack_service = slack_service or get_slack_service()
        self.slack_repo = SlackRepository(supabase)

    async def check_and_send_reminders(self) -> Dict[str, int]:
        """
        Check all habits and send reminders for those whose trigger_time has arrived.
        
        This method:
        1. Gets all active habits with trigger_time set
        2. For each habit, checks if reminder should be sent based on:
           - User's timezone
           - Whether trigger_time has passed
           - Whether reminder was already sent today
           - Whether habit is already completed today
           - User's notification preferences
           - Slack connection validity
        3. Sends reminders via Slack DM or falls back to in-app notification
        
        Returns:
            Dict containing:
                - reminders_sent: Number of reminders successfully sent
                - errors: Number of errors encountered
        """
        sent_count = 0
        error_count = 0
        today = date.today()

        # Get all active habits with trigger_time set
        habits = await self._get_habits_with_triggers()

        for habit in habits:
            try:
                owner_type = habit.get("owner_type", "user")
                owner_id = habit["owner_id"]
                habit_id = habit["id"]

                # Get user's timezone (Requirement 7.1, 7.2)
                user_tz = await self._get_user_timezone(owner_id)
                current_time = datetime.now(ZoneInfo(user_tz))

                # Parse trigger_time and check if it has arrived
                trigger_time = self._parse_time(habit.get("trigger_time"))
                if not trigger_time:
                    continue

                # Skip if trigger_time hasn't arrived yet
                if current_time.time() < trigger_time:
                    continue

                # Check if reminder already sent today (Requirement 1.5)
                status = await self.slack_repo.get_follow_up_status(
                    owner_type, owner_id, habit_id, today
                )
                if status and status.reminder_sent_at:
                    continue

                # Check if habit is already completed today (Requirement 1.4)
                if await self._is_habit_completed_today(owner_type, owner_id, habit_id, today):
                    continue

                # Check user's notification preferences (Requirement 1.3)
                prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
                if not prefs or not prefs.slack_notifications_enabled:
                    continue

                # Get Slack connection
                connection = await self.slack_repo.get_connection_with_tokens(
                    owner_type, owner_id
                )
                
                if not connection or not connection.get("is_valid"):
                    # Fall back to in-app notification (Requirement 1.6)
                    await self._send_in_app_notification(owner_type, owner_id, habit)
                    continue

                # Send Slack reminder (Requirement 1.1)
                success = await self._send_reminder(connection, habit)
                if success:
                    await self.slack_repo.mark_reminder_sent(
                        owner_type, owner_id, habit_id, today
                    )
                    sent_count += 1
                else:
                    error_count += 1

            except Exception as e:
                print(f"Error processing habit {habit.get('id')}: {e}")
                error_count += 1

        return {
            "reminders_sent": sent_count,
            "errors": error_count,
        }

    async def _get_user_timezone(self, user_id: str) -> str:
        """
        Get user's timezone setting.
        
        Args:
            user_id: User ID to look up
            
        Returns:
            Timezone string (defaults to 'Asia/Tokyo' if not set)
        """
        result = self.supabase.table("users").select("timezone").eq(
            "id", user_id
        ).execute()
        
        if result.data and result.data[0].get("timezone"):
            return result.data[0]["timezone"]
        return "Asia/Tokyo"

    async def _send_reminder(
        self,
        connection: Dict[str, Any],
        habit: Dict[str, Any],
    ) -> bool:
        """
        Send a Slack reminder for a habit.
        
        Args:
            connection: Slack connection details with tokens
            habit: Habit data including name and ID
            
        Returns:
            True if reminder was sent successfully, False otherwise
        """
        try:
            token = decrypt_token(connection["access_token"])
            slack_user_id = connection["slack_user_id"]

            # Get DM channel
            channel = await self.slack_service.get_user_dm_channel(token, slack_user_id)
            if not channel:
                return False

            # Build message with interactive buttons (Requirement 1.2)
            blocks = SlackBlockBuilder.habit_reminder(
                habit["name"],
                habit["id"],
                habit.get("trigger_message"),
            )

            message = SlackMessage(
                channel=channel,
                text=f"習慣のリマインダー: {habit['name']}",
                blocks=blocks,
            )

            response = await self.slack_service.send_message(token, message)
            return response.ok

        except Exception as e:
            print(f"Error sending reminder: {e}")
            return False

    async def _send_in_app_notification(
        self,
        owner_type: str,
        owner_id: str,
        habit: Dict[str, Any],
    ) -> bool:
        """
        Fall back to in-app notification when Slack is unavailable.
        
        Args:
            owner_type: Type of owner (e.g., "user")
            owner_id: Owner ID
            habit: Habit data
            
        Returns:
            True if notification was sent successfully
        """
        # TODO: Implement in-app notification system
        print(f"In-app notification for {owner_id}: {habit['name']}")
        return True

    async def _get_habits_with_triggers(self) -> List[Dict[str, Any]]:
        """
        Get all active habits with trigger_time set.
        
        Returns:
            List of habit dictionaries
        """
        result = self.supabase.table("habits").select("*").not_.is_(
            "trigger_time", "null"
        ).eq("active", True).execute()
        
        return result.data if result.data else []

    async def _is_habit_completed_today(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        check_date: date,
    ) -> bool:
        """
        Check if a habit is completed for a specific date.
        
        Args:
            owner_type: Type of owner
            owner_id: Owner ID
            habit_id: Habit ID
            check_date: Date to check
            
        Returns:
            True if habit is completed, False otherwise
        """
        result = self.supabase.table("activities").select("id").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("habit_id", habit_id).eq(
            "date", check_date.isoformat()
        ).eq("completed", True).execute()
        
        return len(result.data) > 0 if result.data else False

    def _parse_time(self, time_str: Optional[str]) -> Optional[time]:
        """
        Parse time string to time object.
        
        Supports formats:
        - HH:MM:SS
        - HH:MM
        - HH:MM AM/PM
        
        Args:
            time_str: Time string to parse
            
        Returns:
            time object or None if parsing fails
        """
        if not time_str:
            return None
        
        try:
            if isinstance(time_str, time):
                return time_str
            
            # Handle various formats
            for fmt in ["%H:%M:%S", "%H:%M", "%I:%M %p"]:
                try:
                    return datetime.strptime(time_str, fmt).time()
                except ValueError:
                    continue
            
            return None
        except Exception:
            return None
