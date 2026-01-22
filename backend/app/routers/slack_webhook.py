"""
Slack Webhook Router

Processes incoming events from Slack (slash commands, interactive components).

Requirements:
- 4.4: Slackコマンドが処理される時、リクエストID、処理時間、結果ステータスを含む構造化ログを出力する
"""

import json
import time
from typing import Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, Request, HTTPException, Response

from ..services.slack_service import get_slack_service
from ..services.slack_block_builder import SlackBlockBuilder
from ..services.habit_completion_reporter import HabitCompletionReporter
from ..services.follow_up_agent import FollowUpAgent
from ..services.slack_error_handler import SlackErrorHandler, DataFetchError
from ..repositories.slack import SlackRepository
from ..schemas.slack import SlashCommandPayload, InteractionPayload, SlackEventPayload
from ..utils.structured_logger import get_logger

router = APIRouter(prefix="/api/slack", tags=["slack"])

# Initialize structured logger for this module
logger = get_logger(__name__)


def get_supabase():
    """Get Supabase client - implement based on your setup."""
    from ..config import get_supabase_client
    return get_supabase_client()


def get_supabase_with_retry():
    """
    Get Supabase client with automatic retry on connection failure.
    
    If the initial connection fails, forces a new connection and retries.
    """
    from ..config import get_supabase_client
    try:
        return get_supabase_client()
    except Exception as e:
        logger.warning(
            "Initial Supabase connection failed, forcing new connection",
            error_type=type(e).__name__,
            error_message=str(e),
        )
        return get_supabase_client(force_new=True)


async def verify_slack_request(request: Request) -> bytes:
    """
    Verify Slack request signature.
    Returns raw body if valid, raises HTTPException if invalid.
    """
    slack_service = get_slack_service()
    
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    body = await request.body()
    
    if not slack_service.verify_signature(timestamp, body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    return body


@router.post("/commands")
async def handle_slash_command(request: Request) -> dict:
    """
    Handle slash commands: /habit-done, /habit-status, /habit-list
    Must respond within 3 seconds.
    
    Requirement 4.4: リクエストID、処理時間、結果ステータスを含む構造化ログを出力する
    """
    start_time = time.time()
    result_status = "success"
    
    body = await verify_slack_request(request)
    
    # Parse form data
    form_data = parse_qs(body.decode())
    
    command = form_data.get("command", [""])[0]
    text = form_data.get("text", [""])[0].strip()
    user_id = form_data.get("user_id", [""])[0]
    team_id = form_data.get("team_id", [""])[0]
    response_url = form_data.get("response_url", [""])[0]
    
    # Log command receipt with structured logging (Requirement 4.4)
    logger.info(
        "Slack command received",
        command=command,
        slack_user_id=user_id,
        team_id=team_id,
    )
    
    # Use get_supabase_with_retry to handle stale connections
    supabase = get_supabase_with_retry()
    slack_repo = SlackRepository(supabase)
    
    # Find user by Slack ID
    connection = await slack_repo.get_connection_by_slack_user(user_id, team_id)
    
    # Log connection lookup result with structured logging
    if connection:
        logger.info(
            "Connection lookup successful",
            slack_user_id=user_id,
            owner_id=connection.owner_id,
            owner_type=connection.owner_type,
        )
    else:
        result_status = "not_found"
        processing_time_ms = (time.time() - start_time) * 1000
        logger.warning(
            "Connection lookup failed - no connection found",
            slack_user_id=user_id,
            team_id=team_id,
        )
        # Log command completion with structured logging (Requirement 4.4)
        logger.log_slack_command(
            command=command,
            processing_time_ms=processing_time_ms,
            result_status=result_status,
            slack_user_id=user_id,
            team_id=team_id,
        )
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.not_connected(),
        }
    
    # Use owner_id directly from connection (VOW user UUID)
    owner_type = connection.owner_type
    owner_id = connection.owner_id
    
    # Log owner resolution with structured logging
    logger.info(
        "Slack command owner resolved",
        slack_user_id=user_id,
        owner_id=owner_id,
        owner_type=owner_type,
        command=command,
    )
    
    habit_reporter = HabitCompletionReporter(supabase)
    
    try:
        if command == "/habit-done":
            result = await _handle_habit_done(habit_reporter, owner_id, owner_type, text)
        elif command == "/habit-status":
            result = await _handle_habit_status(habit_reporter, owner_id, owner_type)
        elif command == "/habit-list":
            result = await _handle_habit_list(habit_reporter, owner_id, owner_type)
        else:
            result = {
                "response_type": "ephemeral",
                "blocks": SlackBlockBuilder.available_commands(),
            }
        
        # Log command completion with structured logging (Requirement 4.4)
        processing_time_ms = (time.time() - start_time) * 1000
        logger.log_slack_command(
            command=command,
            processing_time_ms=processing_time_ms,
            result_status=result_status,
            slack_user_id=user_id,
            owner_id=owner_id,
            owner_type=owner_type,
        )
        
        return result
        
    except Exception as e:
        result_status = "error"
        processing_time_ms = (time.time() - start_time) * 1000
        
        # Log command completion with error status (Requirement 4.4)
        logger.log_slack_command(
            command=command,
            processing_time_ms=processing_time_ms,
            result_status=result_status,
            slack_user_id=user_id,
            owner_id=owner_id,
            owner_type=owner_type,
        )
        
        # Use SlackErrorHandler to return user-friendly error message
        # (Requirements 3.1, 3.2, 3.3)
        # Technical details are logged by SlackErrorHandler, user sees friendly message
        return SlackErrorHandler.handle_error(
            e,
            context={
                "command": command,
                "slack_user_id": user_id,
                "owner_id": owner_id,
                "owner_type": owner_type,
            },
        )


async def _handle_habit_done(
    reporter: HabitCompletionReporter,
    owner_id: str,
    owner_type: str,
    habit_name: str,
) -> dict:
    """
    Handle /habit-done command.
    
    Requirements:
    - 3.1: 接続エラー時にユーザーフレンドリーメッセージを返却
    - 3.2: データ取得失敗時に「データの取得に失敗しました」を表示
    - 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
    """
    if not habit_name:
        # Log before habit query with structured logging
        logger.info(
            "Habit query: get_incomplete_habits_today",
            owner_id=owner_id,
            owner_type=owner_type,
        )
        try:
            # Show list of incomplete habits
            habits = await reporter.get_incomplete_habits_today(owner_id, owner_type)
        except Exception as e:
            # Wrap data fetch errors (Requirement 3.2)
            raise DataFetchError(
                f"Failed to fetch incomplete habits for owner {owner_id}",
                original_error=e,
            ) from e
        
        if not habits:
            return {
                "response_type": "ephemeral",
                "text": "🎉 All habits completed for today!",
            }
        
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.habit_list(habits, show_buttons=True),
        }
    
    # Log before habit query with structured logging
    logger.info(
        "Habit query: complete_habit_by_name",
        owner_id=owner_id,
        owner_type=owner_type,
        habit_name=habit_name,
    )
    try:
        # Complete specific habit
        success, message, data = await reporter.complete_habit_by_name(
            owner_id, habit_name, source="slack", owner_type=owner_type
        )
    except Exception as e:
        # Wrap data fetch errors (Requirement 3.2)
        raise DataFetchError(
            f"Failed to complete habit '{habit_name}' for owner {owner_id}",
            original_error=e,
        ) from e
    
    if success:
        habit = data.get("habit", {})
        streak = data.get("streak", 0)
        return {
            "response_type": "in_channel",
            "blocks": SlackBlockBuilder.habit_completion_confirm(
                habit.get("name", habit_name),
                streak,
            ),
        }
    
    if data and data.get("already_completed"):
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.habit_already_completed(habit_name),
        }
    
    if data and data.get("suggestions"):
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.habit_not_found(
                habit_name,
                data["suggestions"],
            ),
        }
    
    return {
        "response_type": "ephemeral",
        "blocks": SlackBlockBuilder.error_message(message),
    }


async def _handle_habit_status(
    reporter: HabitCompletionReporter,
    owner_id: str,
    owner_type: str,
) -> dict:
    """
    Handle /habit-status command.
    
    Requirements:
    - 3.1: 接続エラー時にユーザーフレンドリーメッセージを返却
    - 3.2: データ取得失敗時に「データの取得に失敗しました」を表示
    - 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
    """
    # Log before habit query with structured logging
    logger.info(
        "Habit query: get_today_summary",
        owner_id=owner_id,
        owner_type=owner_type,
    )
    try:
        summary = await reporter.get_today_summary(owner_id, owner_type)
    except Exception as e:
        # Wrap data fetch errors (Requirement 3.2)
        raise DataFetchError(
            f"Failed to fetch today's summary for owner {owner_id}",
            original_error=e,
        ) from e
    
    return {
        "response_type": "ephemeral",
        "blocks": SlackBlockBuilder.habit_status(
            summary["completed"],
            summary["total"],
            summary["habits"],
        ),
    }


async def _handle_habit_list(
    reporter: HabitCompletionReporter,
    owner_id: str,
    owner_type: str,
) -> dict:
    """
    Handle /habit-list command.
    
    Requirements:
    - 3.1: 接続エラー時にユーザーフレンドリーメッセージを返却
    - 3.2: データ取得失敗時に「データの取得に失敗しました」を表示
    - 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
    """
    # Log before habit query with structured logging
    logger.info(
        "Habit query: get_all_habits_with_status",
        owner_id=owner_id,
        owner_type=owner_type,
    )
    try:
        habits = await reporter.get_all_habits_with_status(owner_id, owner_type)
    except Exception as e:
        # Wrap data fetch errors (Requirement 3.2)
        raise DataFetchError(
            f"Failed to fetch habits list for owner {owner_id}",
            original_error=e,
        ) from e
    
    return {
        "response_type": "ephemeral",
        "blocks": SlackBlockBuilder.habit_list(habits, show_buttons=True),
    }


@router.post("/interactions")
async def handle_interaction(request: Request) -> Response:
    """
    Handle interactive component callbacks (button clicks).
    
    Requirements:
    - 3.1: 接続エラー時にユーザーフレンドリーメッセージを返却
    - 3.2: データ取得失敗時に「データの取得に失敗しました」を表示
    - 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
    """
    start_time = time.time()
    result_status = "success"
    
    body = await verify_slack_request(request)
    
    # Parse payload
    form_data = parse_qs(body.decode())
    payload_str = form_data.get("payload", ["{}"])[0]
    payload = json.loads(payload_str)
    
    interaction_type = payload.get("type")
    user = payload.get("user", {})
    team = payload.get("team", {})
    actions = payload.get("actions", [])
    response_url = payload.get("response_url", "")
    
    if not actions:
        return Response(status_code=200)
    
    action = actions[0]
    action_id = action.get("action_id", "")
    value = action.get("value", "")
    
    # Use get_supabase_with_retry to handle stale connections
    supabase = get_supabase_with_retry()
    slack_repo = SlackRepository(supabase)
    slack_service = get_slack_service()
    
    slack_user_id = user.get("id", "")
    slack_team_id = team.get("id", "")
    
    # Find user
    connection = await slack_repo.get_connection_by_slack_user(
        slack_user_id,
        slack_team_id,
    )
    
    # Log connection lookup result with structured logging
    if connection:
        logger.info(
            "Interaction connection lookup successful",
            slack_user_id=slack_user_id,
            owner_id=connection.owner_id,
            owner_type=connection.owner_type,
            action_id=action_id,
        )
    else:
        logger.warning(
            "Interaction connection lookup failed - no connection found",
            slack_user_id=slack_user_id,
            team_id=slack_team_id,
            action_id=action_id,
        )
        await slack_service.send_response(
            response_url,
            "Please connect your Slack account first.",
            replace_original=False,
        )
        return Response(status_code=200)
    
    # Use owner_id directly from connection (VOW user UUID)
    owner_type = connection.owner_type
    owner_id = connection.owner_id
    
    logger.info(
        "Slack interaction owner resolved",
        slack_user_id=slack_user_id,
        owner_id=owner_id,
        owner_type=owner_type,
        action_id=action_id,
    )
    
    habit_reporter = HabitCompletionReporter(supabase)
    follow_up_agent = FollowUpAgent(supabase, slack_service)
    
    try:
        # Handle different actions
        if action_id.startswith("habit_done_"):
            habit_id = value or action_id.replace("habit_done_", "")
            # Log before habit query with structured logging
            logger.info(
                "Habit query: complete_habit_by_id",
                owner_id=owner_id,
                owner_type=owner_type,
                habit_id=habit_id,
            )
            try:
                success, message, data = await habit_reporter.complete_habit_by_id(
                    owner_id, habit_id, source="slack", owner_type=owner_type
                )
            except Exception as e:
                raise DataFetchError(
                    f"Failed to complete habit {habit_id}",
                    original_error=e,
                ) from e
            
            if success:
                habit = data.get("habit", {})
                streak = data.get("streak", 0)
                blocks = SlackBlockBuilder.habit_completion_confirm(
                    habit.get("name", "Habit"),
                    streak,
                )
                await slack_service.send_response(
                    response_url,
                    f"✅ {habit.get('name', 'Habit')} completed!",
                    blocks=blocks,
                    replace_original=True,
                )
            else:
                await slack_service.send_response(
                    response_url,
                    message,
                    replace_original=False,
                )
        
        elif action_id.startswith("habit_skip_"):
            habit_id = value or action_id.replace("habit_skip_", "")
            # Log before habit query with structured logging
            logger.info(
                "Habit query: skip_habit_today",
                owner_id=owner_id,
                owner_type=owner_type,
                habit_id=habit_id,
            )
            try:
                await follow_up_agent.skip_habit_today(owner_type, owner_id, habit_id)
                
                # Get habit name
                habit = await habit_reporter._get_habit_by_id(habit_id)
                habit_name = habit.get("name", "Habit") if habit else "Habit"
            except Exception as e:
                raise DataFetchError(
                    f"Failed to skip habit {habit_id}",
                    original_error=e,
                ) from e
            
            blocks = SlackBlockBuilder.habit_skipped(habit_name)
            await slack_service.send_response(
                response_url,
                f"⏭️ {habit_name} skipped for today.",
                blocks=blocks,
                replace_original=True,
            )
        
        elif action_id.startswith("habit_later_"):
            habit_id = value or action_id.replace("habit_later_", "")
            # Log before habit query with structured logging
            logger.info(
                "Habit query: schedule_reminder_later",
                owner_id=owner_id,
                owner_type=owner_type,
                habit_id=habit_id,
            )
            try:
                await follow_up_agent.schedule_reminder_later(
                    owner_type, owner_id, habit_id, delay_minutes=60
                )
                
                # Get habit name
                habit = await habit_reporter._get_habit_by_id(habit_id)
                habit_name = habit.get("name", "Habit") if habit else "Habit"
            except Exception as e:
                raise DataFetchError(
                    f"Failed to schedule reminder for habit {habit_id}",
                    original_error=e,
                ) from e
            
            blocks = SlackBlockBuilder.habit_remind_later(habit_name, 60)
            await slack_service.send_response(
                response_url,
                f"⏰ I'll remind you about {habit_name} in 60 minutes.",
                blocks=blocks,
                replace_original=True,
            )
        
        # Log interaction completion with structured logging (Requirement 4.4)
        processing_time_ms = (time.time() - start_time) * 1000
        logger.log_slack_command(
            command=f"interaction:{action_id}",
            processing_time_ms=processing_time_ms,
            result_status=result_status,
            slack_user_id=slack_user_id,
            owner_id=owner_id,
            owner_type=owner_type,
        )
        
    except Exception as e:
        result_status = "error"
        processing_time_ms = (time.time() - start_time) * 1000
        
        # Log interaction completion with error status (Requirement 4.4)
        logger.log_slack_command(
            command=f"interaction:{action_id}",
            processing_time_ms=processing_time_ms,
            result_status=result_status,
            slack_user_id=slack_user_id,
            owner_id=owner_id,
            owner_type=owner_type,
        )
        
        # Use SlackErrorHandler to return user-friendly error message
        # (Requirements 3.1, 3.2, 3.3)
        error_response = SlackErrorHandler.handle_error(
            e,
            context={
                "action_id": action_id,
                "slack_user_id": slack_user_id,
                "owner_id": owner_id,
                "owner_type": owner_type,
            },
        )
        
        # Send error response via response_url
        await slack_service.send_response(
            response_url,
            error_response.get("text", "An error occurred"),
            blocks=error_response.get("blocks"),
            replace_original=False,
        )
    
    return Response(status_code=200)


@router.post("/events")
async def handle_event(request: Request) -> dict:
    """
    Handle Slack Events API (URL verification, app mentions).
    """
    body = await request.body()
    
    # Parse JSON
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Handle URL verification challenge
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}
    
    # Verify signature for other events
    slack_service = get_slack_service()
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    
    if not slack_service.verify_signature(timestamp, body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Handle events
    event = payload.get("event", {})
    event_type = event.get("type")
    
    if event_type == "app_mention":
        # Handle app mentions if needed
        pass
    
    return {"ok": True}
