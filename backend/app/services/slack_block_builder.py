"""
Slack Block Kit Message Builder

Utility for building rich Slack messages using Block Kit.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import date


@dataclass
class WeeklyReportData:
    """Data structure for weekly report."""
    total_habits: int
    completed_habits: int
    completion_rate: float
    best_streak: int
    best_streak_habit: str
    habits_needing_attention: List[str]
    week_start: date
    week_end: date


class SlackBlockBuilder:
    """Utility class for building Slack Block Kit messages."""

    @staticmethod
    def _section(text: str, accessory: Optional[Dict] = None) -> Dict[str, Any]:
        """Create a section block."""
        block = {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": text,
            },
        }
        if accessory:
            block["accessory"] = accessory
        return block

    @staticmethod
    def _divider() -> Dict[str, Any]:
        """Create a divider block."""
        return {"type": "divider"}

    @staticmethod
    def _header(text: str) -> Dict[str, Any]:
        """Create a header block."""
        return {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": text,
                "emoji": True,
            },
        }

    @staticmethod
    def _actions(elements: List[Dict]) -> Dict[str, Any]:
        """Create an actions block."""
        return {
            "type": "actions",
            "elements": elements,
        }

    @staticmethod
    def _button(
        text: str,
        action_id: str,
        value: str,
        style: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a button element."""
        button = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": text,
                "emoji": True,
            },
            "action_id": action_id,
            "value": value,
        }
        if style:
            button["style"] = style
        return button

    @staticmethod
    def _context(elements: List[str]) -> Dict[str, Any]:
        """Create a context block."""
        return {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": text}
                for text in elements
            ],
        }

    # ========================================================================
    # Habit Reminder Messages
    # ========================================================================

    @staticmethod
    def habit_reminder(
        habit_name: str,
        habit_id: str,
        trigger_message: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Build reminder message with Done/Skip/Later buttons.
        
        Args:
            habit_name: Name of the habit
            habit_id: ID of the habit
            trigger_message: Optional custom reminder message
            
        Returns:
            List of Block Kit blocks
        """
        message = trigger_message or f"Time for your habit: *{habit_name}*"
        
        return [
            SlackBlockBuilder._section(f"⏰ {message}"),
            SlackBlockBuilder._actions([
                SlackBlockBuilder._button(
                    "Done ✓",
                    f"habit_done_{habit_id}",
                    habit_id,
                    style="primary",
                ),
                SlackBlockBuilder._button(
                    "Skip today",
                    f"habit_skip_{habit_id}",
                    habit_id,
                ),
                SlackBlockBuilder._button(
                    "Remind me later",
                    f"habit_later_{habit_id}",
                    habit_id,
                ),
            ]),
        ]

    @staticmethod
    def habit_follow_up(
        habit_name: str,
        habit_id: str,
        hours_since_trigger: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Build follow-up message for incomplete habit.
        
        Args:
            habit_name: Name of the habit
            habit_id: ID of the habit
            hours_since_trigger: Hours since the trigger time
            
        Returns:
            List of Block Kit blocks
        """
        return [
            SlackBlockBuilder._section(
                f"👋 Hey! Did you complete *{habit_name}*?\n"
                f"It's been {hours_since_trigger} hours since your scheduled time."
            ),
            SlackBlockBuilder._actions([
                SlackBlockBuilder._button(
                    "Done ✓",
                    f"habit_done_{habit_id}",
                    habit_id,
                    style="primary",
                ),
                SlackBlockBuilder._button(
                    "Skip today",
                    f"habit_skip_{habit_id}",
                    habit_id,
                ),
                SlackBlockBuilder._button(
                    "Remind me later",
                    f"habit_later_{habit_id}",
                    habit_id,
                ),
            ]),
        ]

    # ========================================================================
    # Habit Completion Messages
    # ========================================================================

    @staticmethod
    def habit_completion_confirm(
        habit_name: str,
        streak: int,
    ) -> List[Dict[str, Any]]:
        """
        Build confirmation message after habit completion.
        
        Args:
            habit_name: Name of the completed habit
            streak: Current streak count
            
        Returns:
            List of Block Kit blocks
        """
        streak_emoji = "🔥" if streak >= 7 else "✨" if streak >= 3 else "👍"
        streak_text = f"{streak_emoji} {streak} day streak!" if streak > 1 else ""
        
        return [
            SlackBlockBuilder._section(
                f"✅ *{habit_name}* completed! {streak_text}"
            ),
        ]

    @staticmethod
    def habit_already_completed(habit_name: str) -> List[Dict[str, Any]]:
        """Build message for already completed habit."""
        return [
            SlackBlockBuilder._section(
                f"ℹ️ *{habit_name}* was already completed today. Keep it up!"
            ),
        ]

    @staticmethod
    def habit_skipped(habit_name: str) -> List[Dict[str, Any]]:
        """Build message for skipped habit."""
        return [
            SlackBlockBuilder._section(
                f"⏭️ *{habit_name}* skipped for today. No more reminders."
            ),
        ]

    @staticmethod
    def habit_remind_later(habit_name: str, minutes: int = 60) -> List[Dict[str, Any]]:
        """Build message for remind later."""
        return [
            SlackBlockBuilder._section(
                f"⏰ Got it! I'll remind you about *{habit_name}* in {minutes} minutes."
            ),
        ]

    # ========================================================================
    # Habit List and Status Messages
    # ========================================================================

    @staticmethod
    def habit_list(
        habits: List[Dict[str, Any]],
        show_buttons: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Build interactive list of habits with completion buttons.
        
        Args:
            habits: List of habit dicts with id, name, streak, completed, goal_name
            show_buttons: Whether to show completion buttons
            
        Returns:
            List of Block Kit blocks
        """
        if not habits:
            return [
                SlackBlockBuilder._section(
                    "📝 You don't have any habits yet. "
                    "Add some in the app to get started!"
                ),
            ]

        blocks = [SlackBlockBuilder._header("📋 Your Habits")]
        
        # Group by goal
        goals: Dict[str, List[Dict]] = {}
        for habit in habits:
            goal = habit.get("goal_name", "No Goal")
            if goal not in goals:
                goals[goal] = []
            goals[goal].append(habit)

        for goal_name, goal_habits in goals.items():
            blocks.append(SlackBlockBuilder._section(f"*{goal_name}*"))
            
            for habit in goal_habits:
                status = "✅" if habit.get("completed") else "⬜"
                streak = habit.get("streak", 0)
                streak_text = f" 🔥{streak}" if streak > 0 else ""
                
                text = f"{status} {habit['name']}{streak_text}"
                
                if show_buttons and not habit.get("completed"):
                    blocks.append(
                        SlackBlockBuilder._section(
                            text,
                            accessory=SlackBlockBuilder._button(
                                "Done",
                                f"habit_done_{habit['id']}",
                                habit["id"],
                                style="primary",
                            ),
                        )
                    )
                else:
                    blocks.append(SlackBlockBuilder._section(text))
            
            blocks.append(SlackBlockBuilder._divider())

        return blocks

    @staticmethod
    def habit_status(
        completed: int,
        total: int,
        habits: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Build status summary with habit details.
        
        Args:
            completed: Number of completed habits
            total: Total number of habits
            habits: List of habit dicts
            
        Returns:
            List of Block Kit blocks
        """
        percentage = (completed / total * 100) if total > 0 else 0
        
        # Progress bar
        filled = int(percentage / 10)
        progress = "█" * filled + "░" * (10 - filled)
        
        blocks = [
            SlackBlockBuilder._header("📊 Today's Progress"),
            SlackBlockBuilder._section(
                f"*{completed}/{total}* habits completed ({percentage:.0f}%)\n"
                f"`{progress}`"
            ),
            SlackBlockBuilder._divider(),
        ]

        # List incomplete habits
        incomplete = [h for h in habits if not h.get("completed")]
        if incomplete:
            blocks.append(SlackBlockBuilder._section("*Remaining today:*"))
            for habit in incomplete[:5]:  # Limit to 5
                blocks.append(
                    SlackBlockBuilder._section(
                        f"⬜ {habit['name']}",
                        accessory=SlackBlockBuilder._button(
                            "Done",
                            f"habit_done_{habit['id']}",
                            habit["id"],
                            style="primary",
                        ),
                    )
                )
            if len(incomplete) > 5:
                blocks.append(
                    SlackBlockBuilder._context([f"...and {len(incomplete) - 5} more"])
                )

        return blocks

    # ========================================================================
    # Weekly Report Messages
    # ========================================================================

    @staticmethod
    def weekly_report(
        report: WeeklyReportData,
        app_url: str,
    ) -> List[Dict[str, Any]]:
        """
        Build formatted weekly report with View Full Report button.
        
        Args:
            report: Weekly report data
            app_url: URL to the full report in the app
            
        Returns:
            List of Block Kit blocks
        """
        # Determine emoji based on completion rate
        if report.completion_rate >= 80:
            emoji = "🏆"
            message = "Amazing week!"
        elif report.completion_rate >= 60:
            emoji = "💪"
            message = "Good progress!"
        elif report.completion_rate >= 40:
            emoji = "📈"
            message = "Keep building momentum!"
        else:
            emoji = "🌱"
            message = "Every step counts!"

        blocks = [
            SlackBlockBuilder._header(f"{emoji} Weekly Report"),
            SlackBlockBuilder._section(
                f"*{report.week_start.strftime('%b %d')} - {report.week_end.strftime('%b %d')}*\n"
                f"{message}"
            ),
            SlackBlockBuilder._divider(),
            SlackBlockBuilder._section(
                f"*📊 Completion Rate:* {report.completion_rate:.0f}%\n"
                f"*✅ Habits Completed:* {report.completed_habits}/{report.total_habits}\n"
                f"*🔥 Best Streak:* {report.best_streak} days ({report.best_streak_habit})"
            ),
        ]

        if report.habits_needing_attention:
            attention_list = "\n".join(
                f"• {h}" for h in report.habits_needing_attention[:3]
            )
            blocks.extend([
                SlackBlockBuilder._divider(),
                SlackBlockBuilder._section(
                    f"*⚠️ Needs Attention:*\n{attention_list}"
                ),
            ])

        blocks.extend([
            SlackBlockBuilder._divider(),
            SlackBlockBuilder._actions([
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Full Report",
                        "emoji": True,
                    },
                    "url": app_url,
                    "action_id": "view_full_report",
                },
            ]),
        ])

        return blocks

    @staticmethod
    def weekly_report_no_activity(app_url: str) -> List[Dict[str, Any]]:
        """Build message for users with no activity."""
        return [
            SlackBlockBuilder._header("📊 Weekly Report"),
            SlackBlockBuilder._section(
                "You didn't track any habits this week. "
                "That's okay - every week is a fresh start! 🌱"
            ),
            SlackBlockBuilder._actions([
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Add Habits",
                        "emoji": True,
                    },
                    "url": app_url,
                    "action_id": "add_habits",
                    "style": "primary",
                },
            ]),
        ]

    # ========================================================================
    # Error Messages
    # ========================================================================

    @staticmethod
    def error_message(
        message: str,
        suggestions: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Build error message with optional suggestions.
        
        Args:
            message: Error message
            suggestions: Optional list of suggestions
            
        Returns:
            List of Block Kit blocks
        """
        blocks = [
            SlackBlockBuilder._section(f"❌ {message}"),
        ]

        if suggestions:
            suggestion_text = "\n".join(f"• {s}" for s in suggestions)
            blocks.append(
                SlackBlockBuilder._section(
                    f"*Did you mean:*\n{suggestion_text}"
                )
            )

        return blocks

    @staticmethod
    def habit_not_found(
        habit_name: str,
        similar_habits: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Build message for habit not found."""
        return SlackBlockBuilder.error_message(
            f"Couldn't find a habit named *{habit_name}*",
            suggestions=similar_habits,
        )

    @staticmethod
    def not_connected() -> List[Dict[str, Any]]:
        """Build message for user not connected to Slack."""
        return [
            SlackBlockBuilder._section(
                "🔗 Your Slack account isn't connected to VOW yet.\n"
                "Connect it in Settings to use Slack commands!"
            ),
        ]

    @staticmethod
    def available_commands() -> List[Dict[str, Any]]:
        """Build help message with available commands."""
        return [
            SlackBlockBuilder._header("📚 Available Commands"),
            SlackBlockBuilder._section(
                "*`/habit-done [name]`*\n"
                "Mark a habit as complete. Without a name, shows a list to choose from."
            ),
            SlackBlockBuilder._section(
                "*`/habit-status`*\n"
                "See today's progress and remaining habits."
            ),
            SlackBlockBuilder._section(
                "*`/habit-list`*\n"
                "View all your habits grouped by goal."
            ),
        ]
