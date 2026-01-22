"""
Weekly Report Generator

Compiles and sends weekly summary reports via Slack.
Supports timezone-aware report scheduling.

This service handles report generation and scheduling logic,
delegating all database operations to injected repositories.

Requirements:
- 2.4: THE Weekly_Report_Generator SHALL handle only report generation and scheduling
- 2.6: WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies
- 4.1: Send weekly report when user's weekly_report_day and weekly_report_time arrive
- 4.2: Include completion rate, completed/total count, best streak, habits needing attention
- 4.3: Do not send report if weekly_slack_report_enabled is false
- 4.4: Include link button to detailed report in app
- 4.5: Send encouragement message if user has no habits tracked this week
- 7.3: Calculate weekly report send time based on user's timezone
"""

from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
import pytz

from .slack_service import SlackIntegrationService, get_slack_service
from .slack_block_builder import SlackBlockBuilder, WeeklyReportData
from .encryption import decrypt_token
from ..repositories.slack import SlackRepository
from ..repositories.habit import HabitRepository
from ..repositories.activity import ActivityRepository
from ..schemas.slack import SlackMessage
from ..errors import DataFetchError
from ..utils.structured_logger import get_logger

logger = get_logger(__name__)


class WeeklyReportGenerator:
    """
    Service for generating and sending weekly habit reports.
    
    This service is responsible for:
    - Generating weekly statistics for habits
    - Sending weekly reports via Slack
    - Scheduling reports based on user timezone and preferences
    
    All database operations are delegated to injected repositories,
    following the dependency injection pattern for testability.
    
    Requirements:
    - 2.4: THE Weekly_Report_Generator SHALL handle only report generation and scheduling
    
    Attributes:
        slack_repo: Repository for Slack-related database operations.
        habit_repo: Repository for habit database operations.
        activity_repo: Repository for activity database operations.
        slack_service: Service for Slack API interactions.
        app_url: Base URL for the application (used in report links).
    """

    def __init__(
        self,
        slack_repo: SlackRepository,
        habit_repo: HabitRepository,
        activity_repo: ActivityRepository,
        slack_service: Optional[SlackIntegrationService] = None,
        app_url: str = "https://vow.app",
    ):
        """
        Initialize the WeeklyReportGenerator with injected repositories.
        
        Args:
            slack_repo: Repository for Slack-related database operations.
            habit_repo: Repository for habit database operations.
            activity_repo: Repository for activity database operations.
            slack_service: Service for Slack API interactions (optional, uses singleton if not provided).
            app_url: Base URL for the application (default: "https://vow.app").
        """
        self.slack_repo = slack_repo
        self.habit_repo = habit_repo
        self.activity_repo = activity_repo
        self.slack_service = slack_service or get_slack_service()
        self.app_url = app_url

    async def generate_report(
        self,
        owner_id: str,
        owner_type: str = "user",
        week_end: Optional[date] = None,
    ) -> WeeklyReportData:
        """
        Generate weekly statistics for a user.
        
        Calculates completion rate, best streak, and identifies habits needing
        attention for the specified week. Uses injected repositories for all
        database operations.
        
        Args:
            owner_id: User ID.
            owner_type: Type of owner (default: "user").
            week_end: End date of the week (default: today).
            
        Returns:
            WeeklyReportData with statistics including completion rate,
            best streak, and habits needing attention.
            
        Raises:
            DataFetchError: If database operations fail.
        """
        try:
            if week_end is None:
                week_end = date.today()
            
            # Calculate week start (Monday)
            week_start = week_end - timedelta(days=week_end.weekday())
            
            # Get all habits for the user using repository
            habits = await self.habit_repo.get_by_owner(owner_type, owner_id, active_only=True)
            
            if not habits:
                return WeeklyReportData(
                    total_habits=0,
                    completed_habits=0,
                    completion_rate=0.0,
                    best_streak=0,
                    best_streak_habit="",
                    habits_needing_attention=[],
                    week_start=week_start,
                    week_end=week_end,
                )

            # Get activities for the week using repository
            activities = await self._get_activities_for_week(
                owner_type, owner_id, week_start, week_end
            )

            # Calculate statistics
            total_possible = len(habits) * 7  # 7 days
            completed_count = len([a for a in activities if a.get("completed")])
            completion_rate = (completed_count / total_possible * 100) if total_possible > 0 else 0

            # Calculate streaks and find best
            best_streak = 0
            best_streak_habit = ""
            habits_needing_attention = []

            for habit in habits:
                streak = await self._calculate_streak(habit["id"], owner_type, owner_id)
                if streak > best_streak:
                    best_streak = streak
                    best_streak_habit = habit["name"]

                # Check if habit needs attention (completed less than 50% this week)
                habit_activities = [
                    a for a in activities 
                    if a.get("habit_id") == habit["id"] and a.get("completed")
                ]
                if len(habit_activities) < 4:  # Less than 4 out of 7 days
                    habits_needing_attention.append(habit["name"])

            return WeeklyReportData(
                total_habits=total_possible,
                completed_habits=completed_count,
                completion_rate=completion_rate,
                best_streak=best_streak,
                best_streak_habit=best_streak_habit,
                habits_needing_attention=habits_needing_attention[:5],  # Limit to 5
                week_start=week_start,
                week_end=week_end,
            )
        except Exception as e:
            raise DataFetchError(f"Failed to generate weekly report: {e}", e)

    async def send_weekly_report(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> bool:
        """
        Generate and send weekly report to a user via Slack.
        
        Checks user preferences, retrieves Slack connection, generates the report,
        and sends it via Slack DM. Uses injected repositories for all database
        operations.
        
        Requirements:
        - 4.3: Do not send report if weekly_slack_report_enabled is false
        - 4.4: Include link button to detailed report in app
        - 4.5: Send encouragement message if user has no habits tracked this week
        
        Args:
            owner_id: User ID.
            owner_type: Type of owner (default: "user").
            
        Returns:
            True if sent successfully, False otherwise.
        """
        try:
            # Check user preferences using repository
            prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
            if not prefs or not prefs.weekly_slack_report_enabled:
                return False

            # Get Slack connection using repository
            connection = await self.slack_repo.get_connection_with_tokens(
                owner_type, owner_id
            )
            if not connection or not connection.get("is_valid"):
                return False

            token = decrypt_token(connection["access_token"])
            slack_user_id = connection["slack_user_id"]

            # Get DM channel
            channel = await self.slack_service.get_user_dm_channel(token, slack_user_id)
            if not channel:
                return False

            # Generate report
            report = await self.generate_report(owner_id, owner_type)

            # Build message
            report_url = f"{self.app_url}/dashboard?view=weekly-review"
            
            if report.total_habits == 0:
                blocks = SlackBlockBuilder.weekly_report_no_activity(
                    f"{self.app_url}/dashboard"
                )
                text = "Your weekly report is ready!"
            else:
                blocks = SlackBlockBuilder.weekly_report(report, report_url)
                text = f"Weekly Report: {report.completion_rate:.0f}% completion rate"

            message = SlackMessage(
                channel=channel,
                text=text,
                blocks=blocks,
            )

            response = await self.slack_service.send_message(token, message)
            return response.ok

        except Exception as e:
            logger.error(f"Error sending weekly report for {owner_id}: {e}")
            return False

    async def send_all_weekly_reports(self, supabase_client=None) -> int:
        """
        Send weekly reports to all users with enabled preference.
        
        This method checks each user's timezone and sends reports
        when the user's local time matches their configured weekly_report_day
        and weekly_report_time.
        
        Requirements:
        - 4.1: Send weekly report when user's weekly_report_day and weekly_report_time arrive
        - 7.3: Calculate weekly report send time based on user's timezone.
        
        Args:
            supabase_client: Optional Supabase client for user timezone lookup.
                           If not provided, uses default timezone.
        
        Returns:
            Count of reports sent.
        """
        sent_count = 0

        # Get all valid Slack connections with report preferences using repository
        connections = await self.slack_repo.get_valid_connections_for_reports(
            report_day=0,  # Filtering done in service layer
            report_time="00:00"  # Filtering done in service layer
        )

        for connection in connections:
            owner_type = connection.get("owner_type", "user")
            owner_id = connection["owner_id"]

            try:
                # Check preferences using repository
                prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
                if not prefs:
                    continue

                if not prefs.weekly_slack_report_enabled:
                    continue

                # Get user's timezone (Requirement 7.3)
                user_tz = await self._get_user_timezone(owner_id, supabase_client)
                user_timezone = pytz.timezone(user_tz)
                
                # Calculate current time in user's timezone
                current_time_utc = datetime.now(pytz.UTC)
                current_time_local = current_time_utc.astimezone(user_timezone)
                
                # Get current day in user's timezone
                # Convert Python weekday (0=Monday) to our format (0=Sunday)
                current_day = (current_time_local.weekday() + 1) % 7

                # Check if it's the right day
                if prefs.weekly_report_day != current_day:
                    continue

                # Check time (within 15 minute window)
                report_time = prefs.weekly_report_time
                try:
                    report_hour, report_minute = map(int, report_time.split(":"))
                    current_hour = current_time_local.hour
                    current_minute = current_time_local.minute

                    # Check if within 15 minute window
                    report_minutes = report_hour * 60 + report_minute
                    current_minutes = current_hour * 60 + current_minute

                    if abs(current_minutes - report_minutes) > 15:
                        continue
                except (ValueError, AttributeError):
                    continue

                # Send report
                success = await self.send_weekly_report(owner_id, owner_type)
                if success:
                    sent_count += 1

            except Exception as e:
                logger.error(f"Error processing weekly report for {owner_id}: {e}")
                continue

        return sent_count

    async def _get_user_timezone(
        self,
        user_id: str,
        supabase_client=None,
    ) -> str:
        """
        Get user's timezone setting.
        
        Note: This method requires a Supabase client for user table access.
        The user table is not managed by the repositories in this service,
        so we accept an optional client parameter for this lookup.
        
        Requirement 7.2: Use Asia/Tokyo as default timezone if not set.
        
        Args:
            user_id: User ID to look up.
            supabase_client: Optional Supabase client for user lookup.
            
        Returns:
            Timezone string (defaults to 'Asia/Tokyo' if not set or client not provided).
        """
        if supabase_client is None:
            return "Asia/Tokyo"
        
        try:
            result = supabase_client.table("users").select("timezone").eq(
                "id", user_id
            ).execute()
            
            if result.data and result.data[0].get("timezone"):
                return result.data[0]["timezone"]
        except Exception as e:
            logger.warning(f"Failed to get timezone for user {user_id}: {e}")
        
        return "Asia/Tokyo"

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    async def _get_activities_for_week(
        self,
        owner_type: str,
        owner_id: str,
        week_start: date,
        week_end: date,
    ) -> List[Dict[str, Any]]:
        """
        Get all activities for a week using the activity repository.
        
        Converts date boundaries to datetime for the repository query.
        
        Args:
            owner_type: Type of owner (e.g., "user").
            owner_id: User ID.
            week_start: Start date of the week (Monday).
            week_end: End date of the week.
            
        Returns:
            List of activity dictionaries for the week.
        """
        try:
            # Convert dates to datetime for repository query
            start_dt = datetime.combine(week_start, datetime.min.time())
            end_dt = datetime.combine(week_end, datetime.max.time())
            
            # Use activity repository to get activities in range
            activities = await self.activity_repo.get_activities_in_range(
                owner_type=owner_type,
                owner_id=owner_id,
                start=start_dt,
                end=end_dt,
                kind="complete"
            )
            
            return activities
        except Exception as e:
            logger.warning(f"Failed to get activities for week: {e}")
            return []

    async def _calculate_streak(
        self,
        habit_id: str,
        owner_type: str,
        owner_id: str,
    ) -> int:
        """
        Calculate current streak for a habit using the activity repository.
        
        Counts consecutive days with at least one completion activity,
        ending today or yesterday.
        
        Args:
            habit_id: ID of the habit.
            owner_type: Type of owner.
            owner_id: User ID.
            
        Returns:
            Current streak count (0 if no completions).
        """
        try:
            # Use activity repository to get habit activities
            activities = await self.activity_repo.get_habit_activities(
                habit_id=habit_id,
                kind="complete",
                limit=365
            )
            
            if not activities:
                return 0

            streak = 0
            expected_date = date.today()
            seen_dates = set()
            
            for activity in activities:
                # Extract date from timestamp
                timestamp_str = activity.get("timestamp", "")
                if not timestamp_str:
                    continue
                    
                try:
                    activity_date = date.fromisoformat(timestamp_str[:10])
                except (ValueError, TypeError):
                    continue
                
                # Skip if we've already counted this date
                if activity_date in seen_dates:
                    continue
                seen_dates.add(activity_date)
                
                if streak == 0 and activity_date == expected_date:
                    streak = 1
                    expected_date = expected_date - timedelta(days=1)
                elif streak == 0 and activity_date == expected_date - timedelta(days=1):
                    streak = 1
                    expected_date = activity_date - timedelta(days=1)
                elif activity_date == expected_date:
                    streak += 1
                    expected_date = expected_date - timedelta(days=1)
                else:
                    break
            
            return streak
        except Exception as e:
            logger.warning(f"Failed to calculate streak for habit {habit_id}: {e}")
            return 0
