"""
Follow-Up Agent

Monitors incomplete habits and sends follow-up messages via Slack.

This service handles reminder and follow-up logic, delegating all database
operations to injected repositories.

Requirements:
- 2.5: THE Follow_Up_Agent SHALL handle only reminder and follow-up logic
- 2.6: WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies
"""

from typing import List, Dict, Any, Optional
from datetime import date, datetime, time, timedelta

from .slack_service import SlackIntegrationService, get_slack_service
from .slack_block_builder import SlackBlockBuilder
from .encryption import decrypt_token
from ..repositories.slack import SlackRepository
from ..repositories.habit import HabitRepository
from ..repositories.activity import ActivityRepository
from ..schemas.slack import SlackMessage
from ..utils.structured_logger import get_logger

logger = get_logger(__name__)


class FollowUpAgent:
    """
    Agent for sending habit reminders and follow-ups via Slack.
    
    This service is responsible for:
    - Checking habits with trigger times and sending reminders
    - Sending follow-up messages for incomplete habits
    - Handling "remind later" requests
    - Recording skipped habits
    
    All database operations are delegated to injected repositories,
    following the dependency injection pattern for testability.
    
    Requirements:
    - 2.5: THE Follow_Up_Agent SHALL handle only reminder and follow-up logic
    
    Attributes:
        slack_repo: Repository for Slack-related database operations.
        habit_repo: Repository for habit database operations.
        activity_repo: Repository for activity database operations.
        slack_service: Service for Slack API interactions.
    """

    def __init__(
        self,
        slack_repo: SlackRepository,
        habit_repo: Optional[HabitRepository] = None,
        activity_repo: Optional[ActivityRepository] = None,
        slack_service: Optional[SlackIntegrationService] = None,
    ):
        """
        Initialize the FollowUpAgent with injected repositories.
        
        Args:
            slack_repo: Repository for Slack-related database operations.
            habit_repo: Repository for habit database operations (optional).
            activity_repo: Repository for activity database operations (optional).
            slack_service: Service for Slack API interactions (optional).
        """
        self.slack_repo = slack_repo
        self.habit_repo = habit_repo
        self.activity_repo = activity_repo
        self.slack_service = slack_service or get_slack_service()

    async def check_and_send_reminders(self) -> int:
        """
        Check all habits with trigger times and send reminders.
        
        Iterates through all active habits with trigger_time set, checks if
        the trigger time has passed, and sends reminders via Slack if the
        habit hasn't been completed yet.
        
        Returns:
            Count of reminders sent.
        """
        current_time = datetime.now()
        today = date.today()
        sent_count = 0

        # Get all habits with trigger_time set using repository
        if self.habit_repo is None:
            logger.warning("HabitRepository not injected, cannot check reminders")
            return 0
            
        habits = await self.habit_repo.get_habits_with_triggers()

        for habit in habits:
            owner_type = habit.get("owner_type", "user")
            owner_id = habit["owner_id"]
            habit_id = habit["id"]

            # Check if reminder already sent today
            status = await self.slack_repo.get_follow_up_status(
                owner_type, owner_id, habit_id, today
            )
            if status and status.reminder_sent_at:
                continue

            # Check if habit is already completed
            if await self._is_habit_completed_today(owner_type, owner_id, habit_id, today):
                continue

            # Check if trigger time has passed
            trigger_time = self._parse_time(habit.get("trigger_time"))
            if not trigger_time or current_time.time() < trigger_time:
                continue

            # Check user preferences
            prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
            if not prefs or not prefs.slack_notifications_enabled:
                continue

            # Get Slack connection
            connection = await self.slack_repo.get_connection_with_tokens(
                owner_type, owner_id
            )
            if not connection or not connection.get("is_valid"):
                # Fall back to in-app notification
                await self._send_in_app_notification(owner_type, owner_id, habit)
                continue

            # Send Slack reminder
            success = await self._send_reminder(connection, habit)
            if success:
                await self.slack_repo.mark_reminder_sent(
                    owner_type, owner_id, habit_id, today
                )
                sent_count += 1

        return sent_count

    async def check_and_send_follow_ups(self) -> int:
        """
        Check habits that are 2+ hours past trigger time and incomplete.
        Send follow-up messages.
        
        Returns:
            Count of follow-ups sent.
        """
        current_time = datetime.now()
        today = date.today()
        sent_count = 0

        # Get all habits with trigger_time set using repository
        if self.habit_repo is None:
            logger.warning("HabitRepository not injected, cannot check follow-ups")
            return 0
            
        habits = await self.habit_repo.get_habits_with_triggers()

        for habit in habits:
            owner_type = habit.get("owner_type", "user")
            owner_id = habit["owner_id"]
            habit_id = habit["id"]

            # Check if follow-up already sent or skipped today
            status = await self.slack_repo.get_follow_up_status(
                owner_type, owner_id, habit_id, today
            )
            if status:
                if status.follow_up_sent_at or status.skipped:
                    continue

            # Check if habit is already completed
            if await self._is_habit_completed_today(owner_type, owner_id, habit_id, today):
                continue

            # Check if 2+ hours past trigger time
            trigger_time = self._parse_time(habit.get("trigger_time"))
            if not trigger_time:
                continue

            trigger_datetime = datetime.combine(today, trigger_time)
            hours_since_trigger = (current_time - trigger_datetime).total_seconds() / 3600
            
            if hours_since_trigger < 2:
                continue

            # Check user preferences
            prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
            if not prefs or not prefs.slack_notifications_enabled:
                continue

            # Get Slack connection
            connection = await self.slack_repo.get_connection_with_tokens(
                owner_type, owner_id
            )
            if not connection or not connection.get("is_valid"):
                # Fall back to in-app notification
                await self._send_in_app_notification(owner_type, owner_id, habit)
                continue

            # Send Slack follow-up
            success = await self._send_follow_up(
                connection, habit, int(hours_since_trigger)
            )
            if success:
                await self.slack_repo.mark_follow_up_sent(
                    owner_type, owner_id, habit_id, today
                )
                sent_count += 1

        return sent_count

    async def check_remind_later(self) -> int:
        """
        Check for habits where remind_later_at has passed.
        
        Returns:
            Count of reminders sent.
        """
        current_time = datetime.now()
        sent_count = 0

        # Get habits needing remind later using repository
        statuses = await self.slack_repo.get_habits_needing_remind_later(current_time)

        for status in statuses:
            owner_type = status.get("owner_type", "user")
            owner_id = status["owner_id"]
            habit_id = status["habit_id"]

            # Get habit details using repository
            habit = await self._get_habit_by_id(habit_id)
            if not habit:
                continue

            # Check if habit is already completed
            today = date.today()
            if await self._is_habit_completed_today(owner_type, owner_id, habit_id, today):
                continue

            # Get Slack connection
            connection = await self.slack_repo.get_connection_with_tokens(
                owner_type, owner_id
            )
            if not connection or not connection.get("is_valid"):
                continue

            # Send reminder
            success = await self._send_reminder(connection, habit)
            if success:
                # Clear remind_later_at
                await self.slack_repo.create_or_update_follow_up_status(
                    owner_type, owner_id, habit_id, today,
                    {"remind_later_at": None}
                )
                sent_count += 1

        return sent_count

    async def schedule_reminder_later(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        delay_minutes: int = 60,
    ) -> bool:
        """
        Schedule a reminder for later.
        
        Args:
            owner_type: Type of owner.
            owner_id: User ID.
            habit_id: Habit ID.
            delay_minutes: Minutes to delay (default: 60).
            
        Returns:
            True if scheduled successfully.
        """
        remind_at = datetime.now() + timedelta(minutes=delay_minutes)
        today = date.today()

        await self.slack_repo.set_remind_later(
            owner_type, owner_id, habit_id, today, remind_at
        )
        return True

    async def skip_habit_today(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
    ) -> bool:
        """
        Record that user skipped this habit today.
        
        Args:
            owner_type: Type of owner.
            owner_id: User ID.
            habit_id: Habit ID.
            
        Returns:
            True if recorded successfully.
        """
        today = date.today()
        await self.slack_repo.mark_skipped(owner_type, owner_id, habit_id, today)
        return True

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    async def _send_reminder(
        self,
        connection: Dict[str, Any],
        habit: Dict[str, Any],
    ) -> bool:
        """Send a Slack reminder for a habit."""
        try:
            token = decrypt_token(connection["access_token"])
            slack_user_id = connection["slack_user_id"]

            # Get DM channel
            channel = await self.slack_service.get_user_dm_channel(token, slack_user_id)
            if not channel:
                return False

            # Build message
            blocks = SlackBlockBuilder.habit_reminder(
                habit["name"],
                habit["id"],
                habit.get("trigger_message"),
            )

            message = SlackMessage(
                channel=channel,
                text=f"Time for your habit: {habit['name']}",
                blocks=blocks,
            )

            response = await self.slack_service.send_message(token, message)
            return response.ok

        except Exception as e:
            logger.error(f"Error sending reminder: {e}")
            return False

    async def _send_follow_up(
        self,
        connection: Dict[str, Any],
        habit: Dict[str, Any],
        hours_since_trigger: int,
    ) -> bool:
        """Send a Slack follow-up for an incomplete habit."""
        try:
            token = decrypt_token(connection["access_token"])
            slack_user_id = connection["slack_user_id"]

            # Get DM channel
            channel = await self.slack_service.get_user_dm_channel(token, slack_user_id)
            if not channel:
                return False

            # Build message
            blocks = SlackBlockBuilder.habit_follow_up(
                habit["name"],
                habit["id"],
                hours_since_trigger,
            )

            message = SlackMessage(
                channel=channel,
                text=f"Did you complete {habit['name']}?",
                blocks=blocks,
            )

            response = await self.slack_service.send_message(token, message)
            return response.ok

        except Exception as e:
            logger.error(f"Error sending follow-up: {e}")
            return False

    async def _send_in_app_notification(
        self,
        owner_type: str,
        owner_id: str,
        habit: Dict[str, Any],
    ) -> bool:
        """
        Fall back to in-app notification when Slack is unavailable.
        This is a placeholder - implement based on your notification system.
        """
        # TODO: Implement in-app notification
        logger.info(f"In-app notification for {owner_id}: {habit['name']}")
        return True

    async def _get_habit_by_id(self, habit_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a habit by ID using the habit repository.
        
        Args:
            habit_id: The unique identifier of the habit.
            
        Returns:
            The habit dictionary if found, None otherwise.
        """
        if self.habit_repo is None:
            logger.warning("HabitRepository not injected, cannot get habit by ID")
            return None
            
        return await self.habit_repo.get_by_id(habit_id)

    async def _is_habit_completed_today(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        check_date: date,
    ) -> bool:
        """
        Check if a habit is completed for a specific date using the activity repository.
        
        Args:
            owner_type: Type of owner.
            owner_id: User ID.
            habit_id: Habit ID.
            check_date: The date to check.
            
        Returns:
            True if the habit is completed, False otherwise.
        """
        if self.activity_repo is None:
            logger.warning("ActivityRepository not injected, cannot check completion")
            return False
            
        return await self.activity_repo.has_completion_on_date(
            owner_type, owner_id, habit_id, check_date
        )

    def _parse_time(self, time_str: Optional[str]) -> Optional[time]:
        """Parse time string to time object."""
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
