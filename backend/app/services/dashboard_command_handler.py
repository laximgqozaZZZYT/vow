"""
Dashboard Command Handler

Handler for the /habit-dashboard slash command that provides a unified view
of habit progress with workload-based tracking.

Requirements:
- 1.1: WHEN a user types `/habit-dashboard`, THE Slack_Dashboard_Command SHALL 
       respond with a combined view of habit list and progress status
- 1.2: WHEN displaying the dashboard, THE Slack_Block_Builder SHALL show a header 
       with today's date and overall completion summary
- 1.3: WHEN displaying the dashboard, THE Slack_Block_Builder SHALL group habits 
       by their associated goals
- 9.1: IF the user's Slack account is not connected, THEN THE Slack_Dashboard_Command 
       SHALL display a message with instructions to connect via the app settings
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from supabase import Client

from app.services.daily_progress_calculator import (
    DailyProgressCalculator,
    DashboardSummary,
)
from app.services.habit_completion_reporter import HabitCompletionReporter
from app.services.slack_block_builder import SlackBlockBuilder
from app.services.slack_service import SlackIntegrationService

logger = logging.getLogger(__name__)


class DashboardCommandHandler:
    """
    Handler for the /habit-dashboard slash command.
    
    This handler coordinates between the DailyProgressCalculator for fetching
    progress data, HabitCompletionReporter for handling increment actions,
    and SlackIntegrationService for sending responses to Slack.
    
    Requirements:
    - 1.1: Respond with a combined view of habit list and progress status
    - 9.1: Display connection instructions if user not connected
    """
    
    def __init__(
        self,
        supabase: Client,
        slack_service: SlackIntegrationService,
    ):
        """
        Initialize the DashboardCommandHandler.
        
        Args:
            supabase: Supabase client for database operations
            slack_service: SlackIntegrationService for Slack API interactions
        """
        self.progress_calculator = DailyProgressCalculator(supabase)
        self.completion_reporter = HabitCompletionReporter(supabase)
        self.slack_service = slack_service

    async def _get_owner_id_from_slack(self, slack_user_id: str) -> Optional[str]:
        """
        Get the owner_id for a Slack user from the slack_connections table.
        
        This method queries the slack_connections table to find the owner_id
        associated with a given Slack user ID. This is used to map Slack users
        to their corresponding app user accounts.
        
        Args:
            slack_user_id: The Slack user ID (e.g., "U12345678")
            
        Returns:
            The owner_id (user UUID) if the Slack account is connected,
            or None if no connection exists.
            
        Requirements:
        - 9.1: IF the user's Slack account is not connected, THEN THE 
               Slack_Dashboard_Command SHALL display a message with 
               instructions to connect via the app settings
        """
        result = self.progress_calculator.supabase.table("slack_connections").select(
            "owner_id"
        ).eq("slack_user_id", slack_user_id).eq("is_valid", True).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0].get("owner_id")
        
        return None

    async def handle_command(
        self,
        slack_user_id: str,
        response_url: str,
    ) -> Dict[str, Any]:
        """
        Handle the /habit-dashboard command.
        
        This method processes the dashboard command by:
        1. Looking up the owner_id from the slack_user_id
        2. Returning an error if the user is not connected
        3. Getting daily progress from the calculator
        4. Building and sending the dashboard message
        
        Args:
            slack_user_id: Slack user ID from the command
            response_url: URL for sending responses
            
        Returns:
            Immediate acknowledgment response (empty dict for Slack)
            
        Requirements:
        - 1.1: WHEN a user types `/habit-dashboard`, THE Slack_Dashboard_Command 
               SHALL respond with a combined view of habit list and progress status
        - 1.2: WHEN displaying the dashboard, THE Slack_Block_Builder SHALL show 
               a header with today's date and overall completion summary
        - 1.3: WHEN displaying the dashboard, THE Slack_Block_Builder SHALL group 
               habits by their associated goals
        - 9.1: IF the user's Slack account is not connected, THEN THE 
               Slack_Dashboard_Command SHALL display a message with instructions 
               to connect via the app settings
        """
        # Process the dashboard command directly
        # Note: In Lambda environment, asyncio.create_task() doesn't work
        # because the function exits before the background task completes.
        # We process synchronously and return the result.
        await self._process_dashboard_command(slack_user_id, response_url)
        
        # Return empty dict as acknowledgment (actual response sent via response_url)
        return {}

    async def _process_dashboard_command(
        self,
        slack_user_id: str,
        response_url: str,
    ) -> None:
        """
        Process the dashboard command asynchronously.
        
        This is the actual implementation that runs in the background
        after the immediate acknowledgment is sent to Slack.
        
        Args:
            slack_user_id: Slack user ID from the command
            response_url: URL for sending responses
        """
        try:
            # Step 1: Look up owner_id from slack_user_id (Requirement 9.1)
            owner_id = await self._get_owner_id_from_slack(slack_user_id)
            
            if owner_id is None:
                # User not connected - send error message with instructions
                logger.info(
                    f"Dashboard command from unconnected Slack user: {slack_user_id}"
                )
                blocks = SlackBlockBuilder.not_connected()
                await self.slack_service.send_response(
                    response_url,
                    "SlackアカウントがVOWに接続されていません。",
                    blocks=blocks,
                    replace_original=False,
                )
                return
            
            # Step 2: Get daily progress from calculator (Requirements 1.1, 1.3)
            progress_list = await self.progress_calculator.get_daily_progress(
                owner_id=owner_id,
                owner_type="user",
            )
            
            # Step 3: Check if user has no habits (Requirement 1.5)
            if not progress_list:
                logger.info(f"Dashboard command for user with no habits: {owner_id}")
                blocks = SlackBlockBuilder.dashboard_empty()
                await self.slack_service.send_response(
                    response_url,
                    "まだ習慣が登録されていません。",
                    blocks=blocks,
                    replace_original=False,
                )
                return
            
            # Step 4: Build DashboardSummary (Requirement 1.2)
            total_habits = len(progress_list)
            completed_habits = sum(1 for p in progress_list if p.completed)
            completion_rate = (
                (completed_habits / total_habits) * 100 if total_habits > 0 else 0.0
            )
            
            # Format date in JST (e.g., "2026年1月20日（月）")
            jst = ZoneInfo("Asia/Tokyo")
            now_jst = datetime.now(jst)
            
            # Japanese weekday names
            weekday_names = ["月", "火", "水", "木", "金", "土", "日"]
            weekday = weekday_names[now_jst.weekday()]
            
            date_display = f"{now_jst.year}年{now_jst.month}月{now_jst.day}日（{weekday}）"
            
            summary = DashboardSummary(
                total_habits=total_habits,
                completed_habits=completed_habits,
                completion_rate=completion_rate,
                date_display=date_display,
            )
            
            # Step 5: Build dashboard message (Requirements 1.1, 1.2, 1.3)
            blocks = SlackBlockBuilder.habit_dashboard(progress_list, summary)
            
            # Step 6: Send response via response_url
            await self.slack_service.send_response(
                response_url,
                f"今日の進捗: {completed_habits}/{total_habits} 習慣を完了",
                blocks=blocks,
                replace_original=False,
            )
            
            logger.info(
                f"Dashboard sent for user {owner_id}: "
                f"{completed_habits}/{total_habits} habits completed"
            )
            
        except Exception as e:
            # Log error and send error message to user (Requirement 9.2)
            logger.error(
                f"Error processing dashboard command for Slack user {slack_user_id}: {e}",
                exc_info=True,
            )
            
            blocks = SlackBlockBuilder.dashboard_error(
                "一時的なエラーが発生しました。再度お試しください。"
            )
            await self.slack_service.send_response(
                response_url,
                "エラーが発生しました。",
                blocks=blocks,
                replace_original=False,
            )

    async def handle_increment(
        self,
        habit_id: str,
        owner_id: str,
        response_url: str,
    ) -> bool:
        """
        Handle increment button click.
        
        Simplified version that just increments and sends a confirmation.
        The user can use /habit-dashboard again to see updated progress.
        """
        try:
            # Step 1: Call increment_habit_progress
            success, message, result_data = await self.completion_reporter.increment_habit_progress(
                owner_id=owner_id,
                habit_id=habit_id,
                source="slack",
                owner_type="user",
            )
            
            # Step 2: Handle failure - habit not found
            if not success:
                logger.warning(
                    f"Increment failed for habit {habit_id}, owner {owner_id}: {message}"
                )
                
                error_blocks = SlackBlockBuilder.dashboard_error(
                    "この習慣は見つかりませんでした。"
                )
                await self.slack_service.send_response(
                    response_url,
                    "習慣が見つかりません。",
                    blocks=error_blocks,
                    replace_original=False,
                )
                return False
            
            # Step 3: Send simple confirmation message
            habit = result_data.get("habit", {})
            habit_name = habit.get("name", "")
            amount = result_data.get("amount", 1)
            
            # Get workload_unit from habit
            workload_unit = habit.get("workload_unit", "")
            
            # Build confirmation message
            if workload_unit:
                if amount == int(amount):
                    amount_str = str(int(amount))
                else:
                    amount_str = str(amount)
                confirm_text = f"✅ *{habit_name}* に +{amount_str} {workload_unit} を記録しました"
            else:
                confirm_text = f"✅ *{habit_name}* を記録しました"
            
            # Send confirmation as a new message (don't replace dashboard)
            await self.slack_service.send_response(
                response_url,
                confirm_text,
                blocks=[{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": confirm_text
                    }
                }],
                replace_original=False,
            )
            
            logger.info(
                f"Increment successful for habit {habit_id}, owner {owner_id}"
            )
            
            return True
            
        except Exception as e:
            logger.error(
                f"Error handling increment for habit {habit_id}, owner {owner_id}: {e}",
                exc_info=True,
            )
            
            error_blocks = SlackBlockBuilder.dashboard_error(
                "進捗の更新中にエラーが発生しました。再度お試しください。"
            )
            await self.slack_service.send_response(
                response_url,
                "エラーが発生しました。",
                blocks=error_blocks,
                replace_original=False,
            )
            
            return False
