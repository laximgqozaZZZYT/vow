"""
Slack Interactions Router

Handles Slack interactive components (button clicks) and slash commands.
Implements signature verification and background task processing.

Requirements:
- 3.1: Done button click → mark habit complete, return confirmation
- 3.2: Skip button click → record skip, return confirmation
- 3.3: Remind Later button click → set remind_later_at, return confirmation
- 3.4: Include streak count in completion confirmation
- 3.5: Handle already completed habits
- 3.6: Log errors and return error messages on Slack API errors
- 5.1: /habit-done [name] → mark specified habit as complete
- 5.2: /habit-done (no name) → show incomplete habits list with buttons
- 5.3: /habit-status → show today's progress summary
- 5.4: /habit-list → show habits grouped by goal
- 5.5: Suggest similar habit names when not found
- 5.6: Return connection prompt when user not connected
"""

import json
import urllib.parse
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from ..services.slack_service import (
    SlackIntegrationService,
    get_slack_service,
    SlackAPIError,
)
from ..services.habit_completion_reporter import HabitCompletionReporter
from ..services.follow_up_agent import FollowUpAgent
from ..services.slack_block_builder import SlackBlockBuilder
from ..repositories.slack import SlackRepository
from ..config import get_supabase_client
from ..utils.structured_logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/slack", tags=["slack-interactions"])


@router.post("/interactions")
async def handle_slack_interaction(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Handle Slack interactive component payloads (button clicks).
    
    This endpoint receives POST requests from Slack when users interact
    with buttons in messages. It must respond within 3 seconds, so actual
    processing is done in background tasks.
    
    Note: In Lambda environment, we process synchronously because background
    tasks don't work reliably when the Lambda function exits.
    
    Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
    """
    import os
    IS_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    
    slack_service = get_slack_service()
    
    # Get headers for signature verification
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    body = await request.body()
    
    # Verify Slack signature to ensure request authenticity
    if not slack_service.verify_signature(timestamp, body, signature):
        logger.warning("Invalid Slack signature received")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Parse the payload from form data
    try:
        form_data = urllib.parse.parse_qs(body.decode())
        payload_str = form_data.get("payload", ["{}"])[0]
        payload = json.loads(payload_str)
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to parse Slack payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload format")
    
    action_type = payload.get("type")
    
    if action_type == "block_actions":
        if IS_LAMBDA:
            # In Lambda, process synchronously to ensure completion
            await process_block_action(payload)
        else:
            # In non-Lambda environments, use background tasks
            background_tasks.add_task(
                process_block_action,
                payload,
            )
        # Return empty response immediately (Slack requirement)
        return JSONResponse(content={})
    
    logger.warning(f"Unknown Slack action type: {action_type}")
    return JSONResponse(content={"error": "Unknown action type"})


async def process_block_action(payload: Dict[str, Any]) -> None:
    """
    Process block actions (button clicks) from Slack.
    
    Handles:
    - habit_done_* : Mark habit as complete (Req 3.1, 3.4, 3.5)
    - habit_skip_* : Skip habit for today (Req 3.2)
    - habit_later_* : Remind later (Req 3.3)
    
    Args:
        payload: Slack interaction payload containing user, actions, and response_url.
        
    Returns:
        None. Responses are sent via the response_url.
    """
    try:
        supabase = get_supabase_client()
        slack_repo = SlackRepository(supabase)
        completion_reporter = HabitCompletionReporter(supabase)
        follow_up_agent = FollowUpAgent(supabase)
        slack_service = get_slack_service()

        user = payload.get("user", {})
        slack_user_id = user.get("id")
        team = payload.get("team", {})
        slack_team_id = team.get("id", "")
        actions = payload.get("actions", [])
        response_url = payload.get("response_url")

        if not actions or not response_url:
            logger.warning("Missing actions or response_url in payload")
            return

        action = actions[0]
        action_id = action.get("action_id", "")
        habit_id = action.get("value", "")

        # Get VOW user from Slack user ID
        connection = await slack_repo.get_connection_by_slack_user(
            slack_user_id,
            slack_team_id,
        )
        
        if not connection:
            logger.info(f"No VOW connection found for Slack user {slack_user_id}")
            await _send_not_connected_response(slack_service, response_url)
            return

        owner_type = connection.owner_type
        owner_id = connection.owner_id

        # Route to appropriate handler based on action
        if action_id.startswith("habit_done_"):
            await _handle_habit_done(
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
                habit_id,
            )
        elif action_id.startswith("habit_skip_"):
            await _handle_habit_skip(
                follow_up_agent,
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
                habit_id,
            )
        elif action_id.startswith("habit_later_"):
            await _handle_habit_later(
                follow_up_agent,
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
                habit_id,
            )
        elif action_id.startswith("habit_increment_"):
            await _handle_habit_increment(
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
                habit_id,
            )
        else:
            logger.warning(f"Unknown action_id: {action_id}")

    except SlackAPIError as e:
        # Requirement 3.6: Log Slack API errors
        logger.error(f"Slack API error processing block action: {e}")
        try:
            slack_service = get_slack_service()
            await slack_service.send_response(
                response_url,
                "エラーが発生しました。しばらくしてからもう一度お試しください。",
                blocks=SlackBlockBuilder.error_message(
                    "Slack APIエラーが発生しました。しばらくしてからもう一度お試しください。"
                ),
                replace_original=True,
            )
        except Exception:
            pass
    except Exception as e:
        # Requirement 3.6: Log unexpected errors
        logger.error(f"Error processing block action: {e}", exc_info=True)
        try:
            slack_service = get_slack_service()
            await slack_service.send_response(
                response_url,
                "予期しないエラーが発生しました。",
                blocks=SlackBlockBuilder.error_message(
                    "予期しないエラーが発生しました。しばらくしてからもう一度お試しください。"
                ),
                replace_original=True,
            )
        except Exception:
            pass


async def _handle_habit_done(
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
    habit_id: str,
) -> None:
    """
    Handle Done button click.
    
    Marks the specified habit as complete and sends a confirmation message
    to the user via Slack. Includes streak count in the confirmation.
    
    Args:
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        habit_id: Unique identifier of the habit to complete.
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirements:
    - 3.1: Mark habit as complete and return confirmation
    - 3.4: Include streak count in confirmation
    - 3.5: Handle already completed habits
    """
    success, message, data = await completion_reporter.complete_habit_by_id(
        owner_id, habit_id, source="slack", owner_type=owner_type
    )
    
    if success:
        # Requirement 3.4: Include streak in confirmation
        streak = data.get("streak", 0) if data else 0
        habit_name = data.get("habit", {}).get("name", "") if data else ""
        blocks = SlackBlockBuilder.habit_completion_confirm(habit_name, streak)
        response_text = f"✅ {habit_name}を完了しました！"
        if streak > 1:
            response_text += f" 🔥 {streak}日連続！"
    elif data and data.get("already_completed"):
        # Requirement 3.5: Already completed message
        habit_name = data.get("habit", {}).get("name", "") if data else ""
        blocks = SlackBlockBuilder.habit_already_completed(habit_name)
        response_text = f"ℹ️ {habit_name}は既に今日完了しています。"
    else:
        # Error case
        blocks = SlackBlockBuilder.error_message(message or "習慣の完了に失敗しました。")
        response_text = message or "習慣の完了に失敗しました。"
    
    await slack_service.send_response(
        response_url,
        response_text,
        blocks=blocks,
        replace_original=True,
    )


async def _handle_habit_skip(
    follow_up_agent: FollowUpAgent,
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
    habit_id: str,
) -> None:
    """
    Handle Skip button click.
    
    Records that the user skipped the specified habit for today and sends
    a confirmation message. Skipped habits will not receive follow-up messages.
    
    Args:
        follow_up_agent: Agent for managing habit reminders and follow-ups.
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        habit_id: Unique identifier of the habit to skip.
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirement 3.2: Record skip and return confirmation
    """
    await follow_up_agent.skip_habit_today(owner_type, owner_id, habit_id)
    
    # Get habit name for confirmation message
    habit = await completion_reporter._get_habit_by_id(habit_id)
    habit_name = habit.get("name", "") if habit else ""
    
    blocks = SlackBlockBuilder.habit_skipped(habit_name)
    response_text = f"⏭️ {habit_name}を今日はスキップしました。"
    
    await slack_service.send_response(
        response_url,
        response_text,
        blocks=blocks,
        replace_original=True,
    )


async def _handle_habit_later(
    follow_up_agent: FollowUpAgent,
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
    habit_id: str,
) -> None:
    """
    Handle Remind Later button click.
    
    Schedules a reminder for the specified habit to be sent later (default: 60 minutes)
    and sends a confirmation message to the user.
    
    Args:
        follow_up_agent: Agent for managing habit reminders and follow-ups.
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        habit_id: Unique identifier of the habit to remind later.
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirement 3.3: Set remind_later_at and return confirmation
    """
    delay_minutes = 60  # Default delay
    await follow_up_agent.schedule_reminder_later(
        owner_type, owner_id, habit_id, delay_minutes=delay_minutes
    )
    
    # Get habit name for confirmation message
    habit = await completion_reporter._get_habit_by_id(habit_id)
    habit_name = habit.get("name", "") if habit else ""
    
    blocks = SlackBlockBuilder.habit_remind_later(habit_name, delay_minutes)
    response_text = f"⏰ {delay_minutes}分後に{habit_name}をリマインドします。"
    
    await slack_service.send_response(
        response_url,
        response_text,
        blocks=blocks,
        replace_original=True,
    )


async def _handle_habit_increment(
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
    habit_id: str,
) -> None:
    """
    Handle Increment button click from dashboard.
    
    Increments the habit progress by the workload_per_count amount and sends
    a confirmation message. This is used for the [✓] or [+N unit] buttons
    in the dashboard view.
    
    Args:
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        habit_id: Unique identifier of the habit to increment.
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirements:
    - 4.1: Include increment button for incomplete habits
    - 4.2: Increment by workload_per_count when button is clicked
    - 4.5: Display celebration message when reaching 100%
    """
    try:
        # Call increment_habit_progress
        success, message, result_data = await completion_reporter.increment_habit_progress(
            owner_id=owner_id,
            habit_id=habit_id,
            source="slack",
            owner_type=owner_type,
        )
        
        if not success:
            # Habit not found or other error
            logger.warning(
                f"Increment failed for habit {habit_id}: {message}",
                extra={
                    "habit_id": habit_id,
                    "owner_id": owner_id,
                    "message": message,
                }
            )
            
            error_blocks = SlackBlockBuilder.dashboard_error(
                message or "この習慣は見つかりませんでした。"
            )
            await slack_service.send_response(
                response_url,
                "習慣が見つかりません。",
                blocks=error_blocks,
                replace_original=False,
            )
            return
        
        # Build confirmation message
        habit = result_data.get("habit", {}) if result_data else {}
        habit_name = habit.get("name", "")
        amount = result_data.get("amount", 1) if result_data else 1
        workload_unit = habit.get("workload_unit", "")
        new_progress_rate = result_data.get("new_progress_rate", 0) if result_data else 0
        streak = result_data.get("streak", 0) if result_data else 0
        just_completed = result_data.get("just_completed", False) if result_data else False
        
        # Check if habit just reached 100% (Requirement 4.5)
        if just_completed:
            # Celebration message
            blocks = SlackBlockBuilder.habit_increment_success(habit_name, streak)
            response_text = f"🎉 {habit_name}を達成しました！ 🔥{streak}日連続！"
        else:
            # Normal confirmation message
            if workload_unit:
                if amount == int(amount):
                    amount_str = str(int(amount))
                else:
                    amount_str = str(amount)
                confirm_text = f"✅ *{habit_name}* に +{amount_str} {workload_unit} を記録しました"
            else:
                confirm_text = f"✅ *{habit_name}* を記録しました"
            
            blocks = [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": confirm_text
                }
            }]
            response_text = confirm_text
        
        # Send confirmation (don't replace original dashboard)
        await slack_service.send_response(
            response_url,
            response_text,
            blocks=blocks,
            replace_original=False,
        )
        
        logger.info(
            f"Increment successful for habit {habit_id}",
            extra={
                "habit_id": habit_id,
                "owner_id": owner_id,
                "new_progress_rate": new_progress_rate,
            }
        )
        
    except Exception as e:
        logger.error(
            f"Error handling increment for habit {habit_id}: {e}",
            exc_info=True,
            extra={
                "habit_id": habit_id,
                "owner_id": owner_id,
            }
        )
        
        error_blocks = SlackBlockBuilder.dashboard_error(
            "進捗の更新中にエラーが発生しました。再度お試しください。"
        )
        await slack_service.send_response(
            response_url,
            "エラーが発生しました。",
            blocks=error_blocks,
            replace_original=False,
        )


async def _send_not_connected_response(
    slack_service: SlackIntegrationService,
    response_url: str,
) -> None:
    """
    Send response for users not connected to VOW.
    
    Sends a message to the user indicating that their Slack account is not
    connected to VOW and provides instructions for connecting.
    
    Args:
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        
    Returns:
        None. Response is sent via the response_url.
    """
    blocks = SlackBlockBuilder.not_connected()
    await slack_service.send_response(
        response_url,
        "VOWアカウントとの接続が見つかりません。",
        blocks=blocks,
        replace_original=True,
    )


# ========================================================================
# Slash Command Handling
# ========================================================================


@router.post("/commands")
async def handle_slash_command(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Handle Slack slash commands.
    
    This endpoint receives POST requests from Slack when users execute
    slash commands. It must respond within 3 seconds, so actual
    processing is done in background tasks.
    
    Note: In Lambda environment, we process synchronously because background
    tasks don't work reliably when the Lambda function exits.
    
    Supported commands:
    - /habit-done [name]: Mark a habit as complete (Req 5.1, 5.2, 5.5)
    - /habit-status: Show today's progress (Req 5.3)
    - /habit-list: Show all habits grouped by goal (Req 5.4)
    
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
    """
    import os
    IS_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    
    slack_service = get_slack_service()
    
    # Get headers for signature verification
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    body = await request.body()
    
    # Verify Slack signature to ensure request authenticity
    if not slack_service.verify_signature(timestamp, body, signature):
        logger.warning("Invalid Slack signature received for slash command")
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Parse form data from Slack
    try:
        form_data = urllib.parse.parse_qs(body.decode())
        command = form_data.get("command", [""])[0]
        text = form_data.get("text", [""])[0]
        user_id = form_data.get("user_id", [""])[0]
        team_id = form_data.get("team_id", [""])[0]
        response_url = form_data.get("response_url", [""])[0]
    except Exception as e:
        logger.error(f"Failed to parse slash command form data: {e}")
        raise HTTPException(status_code=400, detail="Invalid form data")

    logger.info(f"Received slash command: {command} with text: '{text}' from user: {user_id}")

    if IS_LAMBDA:
        # In Lambda, process synchronously to ensure completion
        await process_slash_command(
            command,
            text,
            user_id,
            team_id,
            response_url,
        )
    else:
        # In non-Lambda environments, use background tasks
        background_tasks.add_task(
            process_slash_command,
            command,
            text,
            user_id,
            team_id,
            response_url,
        )
    
    # Return ephemeral response type immediately (Slack requirement)
    return JSONResponse(content={"response_type": "ephemeral"})


async def process_slash_command(
    command: str,
    text: str,
    slack_user_id: str,
    team_id: str,
    response_url: str,
) -> None:
    """
    Process slash commands from Slack.
    
    Routes the command to the appropriate handler based on the command type.
    Handles user authentication via Slack connection lookup.
    
    Handles:
    - /habit-done [name]: Mark habit as complete or show list (Req 5.1, 5.2)
    - /habit-status: Show today's progress (Req 5.3)
    - /habit-list: Show habits grouped by goal (Req 5.4)
    
    Args:
        command: The slash command (e.g., "/habit-done").
        text: The text after the command (habit name or empty).
        slack_user_id: Slack user ID (e.g., "U12345678").
        team_id: Slack team/workspace ID (e.g., "T12345678").
        response_url: URL to send response to.
        
    Returns:
        None. Responses are sent via the response_url.
    """
    try:
        supabase = get_supabase_client()
        slack_repo = SlackRepository(supabase)
        completion_reporter = HabitCompletionReporter(supabase)
        slack_service = get_slack_service()

        # Get VOW user from Slack user ID (Requirement 5.6)
        connection = await slack_repo.get_connection_by_slack_user(
            slack_user_id,
            team_id,
        )
        
        if not connection:
            # Requirement 5.6: Return connection prompt when user not connected
            logger.info(f"No VOW connection found for Slack user {slack_user_id}")
            await slack_service.send_response(
                response_url,
                "VOWアカウントとの接続が見つかりません。",
                blocks=SlackBlockBuilder.not_connected(),
            )
            return

        owner_type = connection.owner_type
        owner_id = connection.owner_id

        # Route to appropriate handler based on command
        if command == "/habit-done":
            await _handle_habit_done_command(
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
                text.strip(),
            )
        elif command == "/habit-status":
            await _handle_habit_status_command(
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
            )
        elif command == "/habit-list":
            await _handle_habit_list_command(
                completion_reporter,
                slack_service,
                response_url,
                owner_type,
                owner_id,
            )
        else:
            # Unknown command - show available commands
            logger.warning(f"Unknown slash command: {command}")
            await slack_service.send_response(
                response_url,
                "利用可能なコマンド",
                blocks=SlackBlockBuilder.available_commands(),
            )

    except SlackAPIError as e:
        logger.error(f"Slack API error processing slash command: {e}")
        try:
            slack_service = get_slack_service()
            await slack_service.send_response(
                response_url,
                "エラーが発生しました。しばらくしてからもう一度お試しください。",
                blocks=SlackBlockBuilder.error_message(
                    "Slack APIエラーが発生しました。しばらくしてからもう一度お試しください。"
                ),
            )
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Error processing slash command: {e}", exc_info=True)
        try:
            slack_service = get_slack_service()
            await slack_service.send_response(
                response_url,
                "予期しないエラーが発生しました。",
                blocks=SlackBlockBuilder.error_message(
                    "予期しないエラーが発生しました。しばらくしてからもう一度お試しください。"
                ),
            )
        except Exception:
            pass


async def _handle_habit_done_command(
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
    habit_name: str,
) -> None:
    """
    Handle /habit-done command.
    
    If a habit name is provided, attempts to complete that habit. If no name
    is provided, shows a list of incomplete habits with completion buttons.
    Suggests similar habit names when the specified habit is not found.
    
    Args:
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        habit_name: Name of the habit to complete (may be empty).
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirements:
    - 5.1: /habit-done [name] → mark specified habit as complete
    - 5.2: /habit-done (no name) → show incomplete habits list with buttons
    - 5.5: Suggest similar habit names when not found
    """
    if habit_name:
        # Requirement 5.1: Complete habit by name
        success, message, data = await completion_reporter.complete_habit_by_name(
            owner_id, habit_name, source="slack", owner_type=owner_type
        )
        
        if success:
            # Habit completed successfully
            streak = data.get("streak", 0) if data else 0
            completed_habit_name = data.get("habit", {}).get("name", habit_name) if data else habit_name
            blocks = SlackBlockBuilder.habit_completion_confirm(completed_habit_name, streak)
            response_text = f"✅ {completed_habit_name}を完了しました！"
            if streak > 1:
                response_text += f" 🔥 {streak}日連続！"
        elif data and data.get("already_completed"):
            # Already completed today
            completed_habit_name = data.get("habit", {}).get("name", habit_name) if data else habit_name
            blocks = SlackBlockBuilder.habit_already_completed(completed_habit_name)
            response_text = f"ℹ️ {completed_habit_name}は既に今日完了しています。"
        elif data and data.get("suggestions"):
            # Requirement 5.5: Suggest similar habit names
            blocks = SlackBlockBuilder.habit_not_found(habit_name, data["suggestions"])
            response_text = f"「{habit_name}」という習慣が見つかりませんでした。"
        else:
            # Habit not found, no suggestions
            blocks = SlackBlockBuilder.error_message(
                f"「{habit_name}」という習慣が見つかりませんでした。"
            )
            response_text = f"「{habit_name}」という習慣が見つかりませんでした。"
        
        await slack_service.send_response(response_url, response_text, blocks=blocks)
    else:
        # Requirement 5.2: Show incomplete habits list with buttons
        habits = await completion_reporter.get_incomplete_habits_today(owner_id, owner_type)
        
        if not habits:
            # All habits completed
            blocks = [
                SlackBlockBuilder._section(
                    "🎉 素晴らしい！今日の習慣はすべて完了しています！"
                )
            ]
            response_text = "今日の習慣はすべて完了しています！"
        else:
            # Build habit list with goal names
            habits_with_goals = await _add_goal_names_to_habits(
                completion_reporter, habits
            )
            blocks = SlackBlockBuilder.habit_list(habits_with_goals, show_buttons=True)
            response_text = "完了する習慣を選択してください"
        
        await slack_service.send_response(response_url, response_text, blocks=blocks)


async def _handle_habit_status_command(
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
) -> None:
    """
    Handle /habit-status command.
    
    Shows today's progress summary including completed/total habits count,
    completion percentage, and a list of remaining habits.
    
    Args:
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirement 5.3: Show today's progress summary
    """
    summary = await completion_reporter.get_today_summary(owner_id, owner_type)
    
    blocks = SlackBlockBuilder.habit_status(
        summary["completed"],
        summary["total"],
        summary["habits"],
    )
    
    response_text = f"今日の進捗: {summary['completed']}/{summary['total']}"
    
    await slack_service.send_response(response_url, response_text, blocks=blocks)


async def _handle_habit_list_command(
    completion_reporter: HabitCompletionReporter,
    slack_service: SlackIntegrationService,
    response_url: str,
    owner_type: str,
    owner_id: str,
) -> None:
    """
    Handle /habit-list command.
    
    Shows all habits grouped by their associated goals, with completion
    status and interactive buttons for completing habits.
    
    Args:
        completion_reporter: Service for handling habit completions.
        slack_service: Service for Slack API interactions.
        response_url: URL for sending the response to Slack.
        owner_type: Type of owner (e.g., "user").
        owner_id: Unique identifier of the owner.
        
    Returns:
        None. Response is sent via the response_url.
        
    Requirement 5.4: Show habits grouped by goal
    """
    habits = await completion_reporter.get_all_habits_with_status(owner_id, owner_type)
    
    blocks = SlackBlockBuilder.habit_list(habits, show_buttons=True)
    
    response_text = "あなたの習慣一覧"
    
    await slack_service.send_response(response_url, response_text, blocks=blocks)


async def _add_goal_names_to_habits(
    completion_reporter: HabitCompletionReporter,
    habits: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Add goal names to habits for display.
    
    Args:
        completion_reporter: HabitCompletionReporter instance
        habits: List of habit dicts
        
    Returns:
        List of habits with goal_name added
    """
    result = []
    for habit in habits:
        goal_name = None
        if habit.get("goal_id"):
            goal = await completion_reporter._get_goal_by_id(habit["goal_id"])
            goal_name = goal.get("name") if goal else None
        
        result.append({
            **habit,
            "goal_name": goal_name or "No Goal",
        })
    
    return result
