"""
Slack Webhook Router

Processes incoming events from Slack (slash commands, interactive components).
"""

import json
from typing import Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, Request, HTTPException, Response

from ..services.slack_service import get_slack_service
from ..services.slack_block_builder import SlackBlockBuilder
from ..services.habit_completion_reporter import HabitCompletionReporter
from ..services.follow_up_agent import FollowUpAgent
from ..repositories.slack import SlackRepository
from ..schemas.slack import SlashCommandPayload, InteractionPayload, SlackEventPayload

router = APIRouter(prefix="/api/slack", tags=["slack"])


def get_supabase():
    """Get Supabase client - implement based on your setup."""
    from ..config import get_supabase_client
    return get_supabase_client()


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
    """
    body = await verify_slack_request(request)
    
    # Parse form data
    form_data = parse_qs(body.decode())
    
    command = form_data.get("command", [""])[0]
    text = form_data.get("text", [""])[0].strip()
    user_id = form_data.get("user_id", [""])[0]
    team_id = form_data.get("team_id", [""])[0]
    response_url = form_data.get("response_url", [""])[0]
    
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    
    # Find user by Slack ID
    connection = await slack_repo.get_connection_by_slack_user(user_id, team_id)
    if not connection:
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.not_connected(),
        }
    
    owner_type = "user"
    owner_id = connection.slack_user_id  # This should be the app user ID
    
    # Get the actual owner_id from the connection
    conn_data = await slack_repo.get_connection_with_tokens(owner_type, owner_id)
    if conn_data:
        owner_id = conn_data.get("owner_id", owner_id)
    
    habit_reporter = HabitCompletionReporter(supabase)
    
    if command == "/habit-done":
        return await _handle_habit_done(habit_reporter, owner_id, owner_type, text)
    
    elif command == "/habit-status":
        return await _handle_habit_status(habit_reporter, owner_id, owner_type)
    
    elif command == "/habit-list":
        return await _handle_habit_list(habit_reporter, owner_id, owner_type)
    
    else:
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.available_commands(),
        }


async def _handle_habit_done(
    reporter: HabitCompletionReporter,
    owner_id: str,
    owner_type: str,
    habit_name: str,
) -> dict:
    """Handle /habit-done command."""
    if not habit_name:
        # Show list of incomplete habits
        habits = await reporter.get_incomplete_habits_today(owner_id, owner_type)
        if not habits:
            return {
                "response_type": "ephemeral",
                "text": "🎉 All habits completed for today!",
            }
        
        return {
            "response_type": "ephemeral",
            "blocks": SlackBlockBuilder.habit_list(habits, show_buttons=True),
        }
    
    # Complete specific habit
    success, message, data = await reporter.complete_habit_by_name(
        owner_id, habit_name, source="slack", owner_type=owner_type
    )
    
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
    """Handle /habit-status command."""
    summary = await reporter.get_today_summary(owner_id, owner_type)
    
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
    """Handle /habit-list command."""
    habits = await reporter.get_all_habits_with_status(owner_id, owner_type)
    
    return {
        "response_type": "ephemeral",
        "blocks": SlackBlockBuilder.habit_list(habits, show_buttons=True),
    }


@router.post("/interactions")
async def handle_interaction(request: Request) -> Response:
    """
    Handle interactive component callbacks (button clicks).
    """
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
    
    supabase = get_supabase()
    slack_repo = SlackRepository(supabase)
    slack_service = get_slack_service()
    
    # Find user
    connection = await slack_repo.get_connection_by_slack_user(
        user.get("id", ""),
        team.get("id", ""),
    )
    
    if not connection:
        await slack_service.send_response(
            response_url,
            "Please connect your Slack account first.",
            replace_original=False,
        )
        return Response(status_code=200)
    
    # Get owner info
    conn_data = await slack_repo.get_connection_with_tokens("user", connection.slack_user_id)
    owner_id = conn_data.get("owner_id") if conn_data else connection.slack_user_id
    owner_type = "user"
    
    habit_reporter = HabitCompletionReporter(supabase)
    follow_up_agent = FollowUpAgent(supabase, slack_service)
    
    # Handle different actions
    if action_id.startswith("habit_done_"):
        habit_id = value or action_id.replace("habit_done_", "")
        success, message, data = await habit_reporter.complete_habit_by_id(
            owner_id, habit_id, source="slack", owner_type=owner_type
        )
        
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
        await follow_up_agent.skip_habit_today(owner_type, owner_id, habit_id)
        
        # Get habit name
        habit = await habit_reporter._get_habit_by_id(habit_id)
        habit_name = habit.get("name", "Habit") if habit else "Habit"
        
        blocks = SlackBlockBuilder.habit_skipped(habit_name)
        await slack_service.send_response(
            response_url,
            f"⏭️ {habit_name} skipped for today.",
            blocks=blocks,
            replace_original=True,
        )
    
    elif action_id.startswith("habit_later_"):
        habit_id = value or action_id.replace("habit_later_", "")
        await follow_up_agent.schedule_reminder_later(
            owner_type, owner_id, habit_id, delay_minutes=60
        )
        
        # Get habit name
        habit = await habit_reporter._get_habit_by_id(habit_id)
        habit_name = habit.get("name", "Habit") if habit else "Habit"
        
        blocks = SlackBlockBuilder.habit_remind_later(habit_name, 60)
        await slack_service.send_response(
            response_url,
            f"⏰ I'll remind you about {habit_name} in 60 minutes.",
            blocks=blocks,
            replace_original=True,
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
