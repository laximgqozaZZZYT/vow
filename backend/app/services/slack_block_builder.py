"""
Slack Block Kit Message Builder

Utility for building rich Slack messages using Block Kit.
"""

from typing import List, Dict, Any, Optional, TYPE_CHECKING
from dataclasses import dataclass
from datetime import date

if TYPE_CHECKING:
    from app.services.daily_progress_calculator import HabitProgress


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
    def _progress_bar(progress_rate: float) -> str:
        """
        Generate a text-based progress bar with color coding.
        
        Args:
            progress_rate: Progress percentage (0-100+)
            
        Returns:
            String with colored block characters (10 segments)
            
        Color coding:
            - >= 100%: 🟩 (green)
            - 75-99%: 🟦 (blue)
            - 50-74%: 🟨 (yellow)
            - < 50%: 🟥 (red)
            
        Empty segments use ⬜
        """
        import math
        
        # Calculate filled segments: min(10, max(0, floor(progress_rate / 10)))
        # max(0, ...) ensures negative values result in 0 filled segments
        filled_segments = min(10, max(0, math.floor(progress_rate / 10)))
        empty_segments = 10 - filled_segments
        
        # Determine color based on progress_rate
        if progress_rate >= 100:
            filled_char = "🟩"  # Green
        elif progress_rate >= 75:
            filled_char = "🟦"  # Blue
        elif progress_rate >= 50:
            filled_char = "🟨"  # Yellow
        else:
            filled_char = "🟥"  # Red
        
        empty_char = "⬜"
        
        # Build progress bar string
        progress_bar = (filled_char * filled_segments) + (empty_char * empty_segments)
        
        return progress_bar

    @staticmethod
    def _streak_display(streak: int) -> str:
        """
        Generate streak display string with appropriate emoji.
        
        Args:
            streak: Current streak count (number of consecutive days)
            
        Returns:
            Formatted string with streak count and emoji:
            - streak >= 7: "🔥{streak}日"
            - streak 3-6: "✨{streak}日"
            - streak 1-2: "{streak}日"
            - streak 0: "" (empty string)
            
        Requirements: 10.1, 10.2, 10.3, 10.4
        Property 15: Streak Display with Emoji
        """
        if streak <= 0:
            return ""
        elif streak >= 7:
            return f"🔥{streak}日"
        elif streak >= 3:
            return f"✨{streak}日"
        else:
            # streak is 1 or 2
            return f"{streak}日"

    @staticmethod
    def _increment_button(
        habit_id: str,
        workload_per_count: float,
        workload_unit: Optional[str],
    ) -> Dict[str, Any]:
        """
        Build an increment button with common "✓" label.
        
        Args:
            habit_id: ID of the habit
            workload_per_count: Amount to add per click (not used for label anymore)
            workload_unit: Unit of measurement (not used for label anymore)
            
        Returns:
            Block Kit button element with "✓" label
        """
        return {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "✓",
                "emoji": True,
            },
            "action_id": f"habit_increment_{habit_id}",
            "value": habit_id,
        }

    @staticmethod
    def _habit_progress_section(
        habit: "HabitProgress",
    ) -> Dict[str, Any]:
        """
        Build a section block for a single habit with progress and button.
        
        Args:
            habit: Habit progress data (HabitProgress dataclass)
            
        Returns:
            Block Kit section with accessory button
            
        Output format:
            ⬜ *朝のストレッチ* (5回/日) 🔥3日
            2/5 回 (40%)
            `🟨🟨🟨🟨⬜⬜⬜⬜⬜⬜`
        """
        # Determine completion indicator
        completion_indicator = "✅" if habit.completed else "⬜"
        
        # Get streak display
        streak_text = SlackBlockBuilder._streak_display(habit.streak)
        streak_suffix = f" {streak_text}" if streak_text else ""
        
        # Build workload total display for title
        # Format: (total_count unit/日) or (total_count/日) if no unit
        if habit.total_count == int(habit.total_count):
            total_str = str(int(habit.total_count))
        else:
            total_str = str(habit.total_count)
        
        if habit.workload_unit:
            workload_display = f"({total_str}{habit.workload_unit}/日)"
        else:
            workload_display = f"({total_str}/日)"
        
        # Build first line: completion indicator, habit name (bold), workload total, streak
        first_line = f"{completion_indicator} *{habit.habit_name}* {workload_display}{streak_suffix}"
        
        # Build progress text
        if habit.current_count == int(habit.current_count):
            current_str = str(int(habit.current_count))
        else:
            current_str = str(habit.current_count)
        
        # Format progress rate as integer percentage
        progress_rate_int = int(habit.progress_rate)
        
        # Build progress text based on whether workload_unit is defined
        if habit.workload_unit:
            progress_text = f"{current_str}/{total_str} {habit.workload_unit} ({progress_rate_int}%)"
        else:
            progress_text = f"{current_str}/{total_str} ({progress_rate_int}%)"
        
        # Get progress bar
        progress_bar = SlackBlockBuilder._progress_bar(habit.progress_rate)
        
        # Build full section text
        section_text = f"{first_line}\n{progress_text}\n`{progress_bar}`"
        
        # Build increment button
        increment_button = SlackBlockBuilder._increment_button(
            habit.habit_id,
            habit.workload_per_count,
            habit.workload_unit,
        )
        
        # Return section block with accessory button
        return {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": section_text,
            },
            "accessory": increment_button,
        }

    @staticmethod
    def habit_dashboard(
        progress_list: List["HabitProgress"],
        summary: "DashboardSummary",
    ) -> List[Dict[str, Any]]:
        """
        Build the unified dashboard view with progress bars and buttons.
        
        Args:
            progress_list: List of habit progress data
            summary: Overall summary statistics
            
        Returns:
            List of Block Kit blocks
            
        Note: Completed habits (progress_rate >= 100%) are excluded from display.
        """
        # Import DashboardSummary for type checking
        from app.services.daily_progress_calculator import DashboardSummary, HabitProgress
        
        blocks: List[Dict[str, Any]] = []
        
        # 1. Header with date
        header_text = f"📊 今日の進捗 - {summary.date_display}"
        blocks.append(SlackBlockBuilder._header(header_text))
        
        # 2. Summary section with completion count and overall progress bar
        completion_rate_int = int(summary.completion_rate)
        overall_progress_bar = SlackBlockBuilder._progress_bar(summary.completion_rate)
        summary_text = (
            f"*{summary.completed_habits}/{summary.total_habits}* 習慣を完了 ({completion_rate_int}%)\n"
            f"`{overall_progress_bar}`"
        )
        blocks.append(SlackBlockBuilder._section(summary_text))
        
        # 3. Divider after summary
        blocks.append(SlackBlockBuilder._divider())
        
        # 4. Filter out completed habits (progress_rate >= 100%)
        incomplete_habits = [h for h in progress_list if not h.completed]
        
        # If all habits are completed, show a congratulations message
        if not incomplete_habits:
            blocks.append(SlackBlockBuilder._section(
                "🎉 今日の習慣をすべて達成しました！素晴らしい！"
            ))
            return blocks
        
        # 5. Group incomplete habits by goal_name
        goals: Dict[str, List["HabitProgress"]] = {}
        for habit in incomplete_habits:
            goal_name = habit.goal_name
            if goal_name not in goals:
                goals[goal_name] = []
            goals[goal_name].append(habit)
        
        # 6. For each goal group, add goal name section and habit progress sections
        for goal_name, goal_habits in goals.items():
            # Goal name section in bold
            blocks.append(SlackBlockBuilder._section(f"*{goal_name}*"))
            
            # All habit progress sections for this goal
            for habit in goal_habits:
                habit_section = SlackBlockBuilder._habit_progress_section(habit)
                blocks.append(habit_section)
            
            # Divider after each goal group
            blocks.append(SlackBlockBuilder._divider())
        
        return blocks

    @staticmethod
    def dashboard_empty() -> List[Dict[str, Any]]:
        """
        Build dashboard message for users with no active habits.
        
        Returns:
            List of Block Kit blocks with encouraging message to add habits
            
        Requirements: 1.5
        WHEN a user has no active habits, THE Slack_Dashboard_Command SHALL 
        display a message encouraging them to add habits via the app.
        """
        return [
            SlackBlockBuilder._header("📊 今日の進捗"),
            SlackBlockBuilder._section(
                "📝 まだ習慣が登録されていません。\n"
                "アプリで習慣を追加して始めましょう！"
            ),
        ]

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
        message = trigger_message or f"習慣の時間です: *{habit_name}*"
        
        return [
            SlackBlockBuilder._section(f"⏰ {message}"),
            SlackBlockBuilder._actions([
                SlackBlockBuilder._button(
                    "完了 ✓",
                    f"habit_done_{habit_id}",
                    habit_id,
                    style="primary",
                ),
                SlackBlockBuilder._button(
                    "今日はスキップ",
                    f"habit_skip_{habit_id}",
                    habit_id,
                ),
                SlackBlockBuilder._button(
                    "後でリマインド",
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
                f"👋 *{habit_name}* は完了しましたか？\n"
                f"予定時刻から{hours_since_trigger}時間が経過しています。"
            ),
            SlackBlockBuilder._actions([
                SlackBlockBuilder._button(
                    "完了 ✓",
                    f"habit_done_{habit_id}",
                    habit_id,
                    style="primary",
                ),
                SlackBlockBuilder._button(
                    "今日はスキップ",
                    f"habit_skip_{habit_id}",
                    habit_id,
                ),
                SlackBlockBuilder._button(
                    "後でリマインド",
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
        streak_text = f"{streak_emoji} {streak}日連続達成！" if streak > 1 else ""
        
        return [
            SlackBlockBuilder._section(
                f"✅ *{habit_name}* を完了しました！ {streak_text}"
            ),
        ]

    @staticmethod
    def habit_already_completed(habit_name: str) -> List[Dict[str, Any]]:
        """Build message for already completed habit."""
        return [
            SlackBlockBuilder._section(
                f"ℹ️ *{habit_name}* は今日すでに完了しています。その調子で頑張りましょう！"
            ),
        ]

    @staticmethod
    def habit_skipped(habit_name: str) -> List[Dict[str, Any]]:
        """Build message for skipped habit."""
        return [
            SlackBlockBuilder._section(
                f"⏭️ *{habit_name}* を今日はスキップしました。これ以上リマインドしません。"
            ),
        ]

    @staticmethod
    def habit_remind_later(habit_name: str, minutes: int = 60) -> List[Dict[str, Any]]:
        """Build message for remind later."""
        return [
            SlackBlockBuilder._section(
                f"⏰ 了解しました！{minutes}分後に *{habit_name}* をリマインドします。"
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
                    "📝 まだ習慣が登録されていません。"
                    "アプリで習慣を追加して始めましょう！"
                ),
            ]

        blocks = [SlackBlockBuilder._header("📋 あなたの習慣")]
        
        # Group by goal
        goals: Dict[str, List[Dict]] = {}
        for habit in habits:
            goal = habit.get("goal_name", "ゴールなし")
            if goal not in goals:
                goals[goal] = []
            goals[goal].append(habit)

        for goal_name, goal_habits in goals.items():
            blocks.append(SlackBlockBuilder._section(f"*{goal_name}*"))
            
            for habit in goal_habits:
                status = "✅" if habit.get("completed") else "⬜"
                streak = habit.get("streak", 0)
                streak_text = f" 🔥{streak}日" if streak > 0 else ""
                
                text = f"{status} {habit['name']}{streak_text}"
                
                if show_buttons and not habit.get("completed"):
                    blocks.append(
                        SlackBlockBuilder._section(
                            text,
                            accessory=SlackBlockBuilder._button(
                                "完了",
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
            SlackBlockBuilder._header("📊 今日の進捗"),
            SlackBlockBuilder._section(
                f"*{completed}/{total}* 習慣を完了 ({percentage:.0f}%)\n"
                f"`{progress}`"
            ),
            SlackBlockBuilder._divider(),
        ]

        # List incomplete habits
        incomplete = [h for h in habits if not h.get("completed")]
        if incomplete:
            blocks.append(SlackBlockBuilder._section("*今日の残り:*"))
            for habit in incomplete[:5]:  # Limit to 5
                blocks.append(
                    SlackBlockBuilder._section(
                        f"⬜ {habit['name']}",
                        accessory=SlackBlockBuilder._button(
                            "完了",
                            f"habit_done_{habit['id']}",
                            habit["id"],
                            style="primary",
                        ),
                    )
                )
            if len(incomplete) > 5:
                blocks.append(
                    SlackBlockBuilder._context([f"...他{len(incomplete) - 5}件"])
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
            message = "素晴らしい一週間でした！"
        elif report.completion_rate >= 60:
            emoji = "💪"
            message = "良い進捗です！"
        elif report.completion_rate >= 40:
            emoji = "📈"
            message = "勢いをつけていきましょう！"
        else:
            emoji = "🌱"
            message = "一歩一歩が大切です！"

        blocks = [
            SlackBlockBuilder._header(f"{emoji} 週次レポート"),
            SlackBlockBuilder._section(
                f"*{report.week_start.strftime('%m/%d')} - {report.week_end.strftime('%m/%d')}*\n"
                f"{message}"
            ),
            SlackBlockBuilder._divider(),
            SlackBlockBuilder._section(
                f"*📊 達成率:* {report.completion_rate:.0f}%\n"
                f"*✅ 完了した習慣:* {report.completed_habits}/{report.total_habits}\n"
                f"*🔥 最長ストリーク:* {report.best_streak}日 ({report.best_streak_habit})"
            ),
        ]

        if report.habits_needing_attention:
            attention_list = "\n".join(
                f"• {h}" for h in report.habits_needing_attention[:3]
            )
            blocks.extend([
                SlackBlockBuilder._divider(),
                SlackBlockBuilder._section(
                    f"*⚠️ 注意が必要な習慣:*\n{attention_list}"
                ),
            ])

        blocks.extend([
            SlackBlockBuilder._divider(),
            SlackBlockBuilder._actions([
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "詳細レポートを見る",
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
            SlackBlockBuilder._header("📊 週次レポート"),
            SlackBlockBuilder._section(
                "今週は習慣を記録していませんでした。"
                "大丈夫です - 毎週が新しいスタートです！🌱"
            ),
            SlackBlockBuilder._actions([
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "習慣を追加",
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
                    f"*もしかして:*\n{suggestion_text}"
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
            f"*{habit_name}* という名前の習慣が見つかりませんでした",
            suggestions=similar_habits,
        )

    @staticmethod
    def not_connected() -> List[Dict[str, Any]]:
        """Build message for user not connected to Slack."""
        return [
            SlackBlockBuilder._section(
                "🔗 SlackアカウントがまだVOWに接続されていません。\n"
                "設定画面から接続して、Slackコマンドを使えるようにしましょう！"
            ),
        ]

    @staticmethod
    def dashboard_error(message: str) -> List[Dict[str, Any]]:
        """
        Build error message for dashboard errors.
        
        Args:
            message: Error message to display
            
        Returns:
            List of Block Kit blocks with error message prefixed with ❌
            
        Requirements: 9.1, 9.2, 9.3, 9.5
        - 9.1: Display message with instructions when Slack account not connected
        - 9.2: Display friendly error message when database query fails
        - 9.3: Display error message when increment action fails
        - 9.5: Display message when habit referenced in interaction no longer exists
        """
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"❌ {message}"
                }
            }
        ]

    @staticmethod
    def habit_increment_success(habit_name: str, streak: int) -> List[Dict[str, Any]]:
        """
        Build celebration message when habit progress reaches 100%.
        
        Args:
            habit_name: Name of the completed habit
            streak: Current streak count (consecutive days)
            
        Returns:
            List of Block Kit blocks with celebration message including streak count
            
        Output format:
            🎉 *{habit_name}* を達成しました！ 🔥{streak}日連続！
            
        Requirements: 4.5
        WHEN progressRate reaches 100% after an increment, THE Slack_Bot SHALL 
        display a completion celebration message with streak count.
        
        Property 11: Completion Celebration on Reaching 100%
        For any increment action that causes progressRate to reach or exceed 100% 
        (from below 100%), the response SHALL include a celebration message 
        containing the streak count.
        """
        # Build celebration message with habit name and streak count
        celebration_text = f"🎉 *{habit_name}* を達成しました！ 🔥{streak}日連続！"
        
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": celebration_text
                }
            }
        ]

    @staticmethod
    def available_commands() -> List[Dict[str, Any]]:
        """Build help message with available commands."""
        return [
            SlackBlockBuilder._header("📚 利用可能なコマンド"),
            SlackBlockBuilder._section(
                "*`/habit-done [名前]`*\n"
                "習慣を完了としてマークします。名前を省略すると、選択リストが表示されます。"
            ),
            SlackBlockBuilder._section(
                "*`/habit-status`*\n"
                "今日の進捗と残りの習慣を確認します。"
            ),
            SlackBlockBuilder._section(
                "*`/habit-list`*\n"
                "ゴール別にグループ化された習慣一覧を表示します。"
            ),
        ]
