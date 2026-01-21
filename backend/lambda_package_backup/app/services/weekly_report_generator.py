"""
Weekly Report Generator

Compiles and sends weekly summary reports via Slack.
Supports timezone-aware report scheduling.

Requirements:
- 4.1: Send weekly report when user's weekly_report_day and weekly_report_time arrive
- 4.2: Include completion rate, completed/total count, best streak, habits needing attention
- 4.3: Do not send report if weekly_slack_report_enabled is false
- 4.4: Include link button to detailed report in app
- 4.5: Send encouragement message if user has no habits tracked this week
- 7.3: Calculate weekly report send time based on user's timezone
"""

from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from collections import defaultdict
import pytz
from supabase import Client

from .slack_service import SlackIntegrationService, get_slack_service
from .slack_block_builder import SlackBlockBuilder, WeeklyReportData
from .encryption import decrypt_token
from ..repositories.slack import SlackRepository
from ..schemas.slack import SlackMessage


class WeeklyReportGenerator:
    """Service for generating and sending weekly habit reports."""

    def __init__(
        self,
        supabase: Client,
        slack_service: Optional[SlackIntegrationService] = None,
        app_url: str = "https://vow.app",
    ):
        self.supabase = supabase
        self.slack_service = slack_service or get_slack_service()
        self.slack_repo = SlackRepository(supabase)
        self.app_url = app_url

    async def generate_report(
        self,
        owner_id: str,
        owner_type: str = "user",
        week_end: Optional[date] = None,
    ) -> WeeklyReportData:
        """
        Generate weekly statistics for a user.
        
        Args:
            owner_id: User ID
            owner_type: Type of owner
            week_end: End date of the week (default: today)
            
        Returns:
            WeeklyReportData with statistics
        """
        if week_end is None:
            week_end = date.today()
        
        # Calculate week start (Monday)
        week_start = week_end - timedelta(days=week_end.weekday())
        
        # Get all habits for the user
        habits = await self._get_habits_by_owner(owner_type, owner_id)
        
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

        # Get activities for the week
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

    async def send_weekly_report(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> bool:
        """
        Generate and send weekly report to a user via Slack.
        
        Args:
            owner_id: User ID
            owner_type: Type of owner
            
        Returns:
            True if sent successfully
        """
        # Check user preferences
        prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
        if not prefs or not prefs.weekly_slack_report_enabled:
            return False

        # Get Slack connection
        connection = await self.slack_repo.get_connection_with_tokens(
            owner_type, owner_id
        )
        if not connection or not connection.get("is_valid"):
            return False

        try:
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
            print(f"Error sending weekly report: {e}")
            return False

    async def send_all_weekly_reports(self) -> int:
        """
        Send weekly reports to all users with enabled preference.
        
        This method checks each user's timezone and sends reports
        when the user's local time matches their configured weekly_report_day
        and weekly_report_time.
        
        Requirement 7.3: Calculate weekly report send time based on user's timezone.
        
        Returns:
            Count of reports sent
        """
        sent_count = 0

        # Get all valid Slack connections with report preferences
        connections = await self._get_connections_for_weekly_reports()

        for connection in connections:
            owner_type = connection.get("owner_type", "user")
            owner_id = connection["owner_id"]

            try:
                # Check preferences
                prefs = await self.slack_repo.get_preferences(owner_type, owner_id)
                if not prefs:
                    continue

                if not prefs.weekly_slack_report_enabled:
                    continue

                # Get user's timezone (Requirement 7.3)
                user_tz = await self._get_user_timezone(owner_id)
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
                print(f"Error processing weekly report for {owner_id}: {e}")
                continue

        return sent_count

    async def _get_user_timezone(self, user_id: str) -> str:
        """
        Get user's timezone setting.
        
        Requirement 7.2: Use Asia/Tokyo as default timezone if not set.
        
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

    async def _get_connections_for_weekly_reports(self) -> List[Dict[str, Any]]:
        """
        Get all valid Slack connections for weekly report processing.
        
        Returns:
            List of connection dictionaries with owner_type and owner_id
        """
        result = self.supabase.table("slack_connections").select(
            "owner_type, owner_id"
        ).eq("is_valid", True).execute()
        
        return result.data if result.data else []

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    async def _get_habits_by_owner(
        self,
        owner_type: str,
        owner_id: str,
    ) -> List[Dict[str, Any]]:
        """Get all active habits for an owner."""
        result = self.supabase.table("habits").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("active", True).execute()
        
        return result.data if result.data else []

    async def _get_activities_for_week(
        self,
        owner_type: str,
        owner_id: str,
        week_start: date,
        week_end: date,
    ) -> List[Dict[str, Any]]:
        """Get all activities for a week."""
        result = self.supabase.table("activities").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).gte(
            "date", week_start.isoformat()
        ).lte("date", week_end.isoformat()).execute()
        
        return result.data if result.data else []

    async def _calculate_streak(
        self,
        habit_id: str,
        owner_type: str,
        owner_id: str,
    ) -> int:
        """Calculate current streak for a habit."""
        result = self.supabase.table("activities").select("date, completed").eq(
            "habit_id", habit_id
        ).eq("owner_type", owner_type).eq("owner_id", owner_id).eq(
            "completed", True
        ).order("date", desc=True).limit(365).execute()
        
        if not result.data:
            return 0

        streak = 0
        expected_date = date.today()
        
        for activity in result.data:
            activity_date = date.fromisoformat(activity["date"])
            
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
