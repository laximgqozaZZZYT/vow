"""
Habit Completion Reporter

Service for processing habit completions from Slack interactions.

Requirements:
- 2.1: WHEN Supabaseへのリクエストが接続エラーで失敗する THEN Retry_Logic SHALL 指数バックオフで最大3回リトライする
- 2.3: WHEN 全てのリトライが失敗する THEN Retry_Logic SHALL 最終エラーを適切にログ出力して例外を発生させる
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from supabase import Client

from app.utils.retry import with_retry

logger = logging.getLogger(__name__)


class HabitCompletionReporter:
    """Service for handling habit completions via Slack."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def complete_habit_by_name(
        self,
        owner_id: str,
        habit_name: str,
        source: str = "slack",
        owner_type: str = "user",
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Find and complete a habit by name.
        
        Args:
            owner_id: User ID
            habit_name: Name of the habit to complete
            source: Source of completion (default: "slack")
            owner_type: Type of owner (default: "user")
            
        Returns:
            Tuple of (success, message, habit_data)
        """
        # Find habit by name (case-insensitive)
        habits = await self._get_habits_by_owner(owner_type, owner_id)
        
        # Try exact match first
        habit = next(
            (h for h in habits if h["name"].lower() == habit_name.lower()),
            None
        )
        
        # Try partial match if no exact match
        if not habit:
            habit = next(
                (h for h in habits if habit_name.lower() in h["name"].lower()),
                None
            )
        
        if not habit:
            # Find similar habits for suggestions
            similar = self._find_similar_habits(habit_name, habits)
            if similar:
                return False, f"Habit '{habit_name}' not found", {"suggestions": similar}
            return False, f"Habit '{habit_name}' not found", None

        return await self.complete_habit_by_id(
            owner_id, habit["id"], source, owner_type
        )

    async def complete_habit_by_id(
        self,
        owner_id: str,
        habit_id: str,
        source: str = "slack",
        owner_type: str = "user",
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Complete a habit by ID.
        
        Args:
            owner_id: User ID
            habit_id: ID of the habit to complete
            source: Source of completion (default: "slack")
            owner_type: Type of owner (default: "user")
            
        Returns:
            Tuple of (success, message, habit_data)
        """
        # Get habit details
        habit = await self._get_habit_by_id(habit_id)
        if not habit:
            return False, "Habit not found", None

        # Check if already completed today
        today = date.today()
        if await self._is_completed_today(owner_type, owner_id, habit_id, today):
            streak = await self.get_habit_streak(habit_id, owner_type, owner_id)
            return False, "Already completed today", {
                "habit": habit,
                "streak": streak,
                "already_completed": True,
            }

        # Create activity record
        # Note: activities table uses 'timestamp', 'kind', and 'habit_name' columns
        from datetime import datetime
        activity_data = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "habit_id": habit_id,
            "habit_name": habit.get("name", ""),
            "kind": "complete",
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        activity = await self._insert_activity(activity_data)
        
        if not activity:
            return False, "Failed to record completion", None

        # Calculate streak
        streak = await self.get_habit_streak(habit_id, owner_type, owner_id)
        
        return True, "Habit completed", {
            "habit": habit,
            "streak": streak,
            "activity": activity,
        }

    async def get_incomplete_habits_today(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> List[Dict[str, Any]]:
        """
        Get list of habits not yet completed today.
        
        Args:
            owner_id: User ID
            owner_type: Type of owner
            
        Returns:
            List of incomplete habit dicts
        """
        habits = await self._get_habits_by_owner(owner_type, owner_id)
        today = date.today()
        
        incomplete = []
        for habit in habits:
            if not habit.get("active", True):
                continue
                
            is_completed = await self._is_completed_today(
                owner_type, owner_id, habit["id"], today
            )
            
            if not is_completed:
                streak = await self.get_habit_streak(habit["id"], owner_type, owner_id)
                incomplete.append({
                    **habit,
                    "completed": False,
                    "streak": streak,
                })
        
        return incomplete

    async def get_all_habits_with_status(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> List[Dict[str, Any]]:
        """
        Get all habits with their completion status for today.
        
        Args:
            owner_id: User ID
            owner_type: Type of owner
            
        Returns:
            List of habit dicts with completion status
        """
        habits = await self._get_habits_by_owner(owner_type, owner_id)
        today = date.today()
        
        result = []
        for habit in habits:
            if not habit.get("active", True):
                continue
                
            is_completed = await self._is_completed_today(
                owner_type, owner_id, habit["id"], today
            )
            streak = await self.get_habit_streak(habit["id"], owner_type, owner_id)
            
            # Get goal name if available
            goal_name = None
            if habit.get("goal_id"):
                goal = await self._get_goal_by_id(habit["goal_id"])
                goal_name = goal.get("name") if goal else None
            
            result.append({
                **habit,
                "completed": is_completed,
                "streak": streak,
                "goal_name": goal_name or "No Goal",
            })
        
        return result

    @with_retry()
    async def get_habit_streak(
        self,
        habit_id: str,
        owner_type: str = "user",
        owner_id: Optional[str] = None,
    ) -> int:
        """
        Calculate current streak count for a habit.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        
        Note: activities table uses 'timestamp' and 'kind' columns
        instead of 'date' and 'completed'.
        
        Args:
            habit_id: ID of the habit
            owner_type: Type of owner
            owner_id: User ID (optional, for filtering)
            
        Returns:
            Current streak count
        """
        # Get recent activities for this habit, ordered by timestamp descending
        query = self.supabase.table("activities").select("timestamp").eq(
            "habit_id", habit_id
        ).eq("kind", "complete").order("timestamp", desc=True).limit(365)
        
        if owner_id:
            query = query.eq("owner_type", owner_type).eq("owner_id", owner_id)
        
        result = query.execute()
        
        if not result.data:
            return 0

        # Calculate streak by extracting dates from timestamps
        streak = 0
        expected_date = date.today()
        seen_dates = set()
        
        for activity in result.data:
            # Extract date from timestamp (format: 2026-01-11T16:59:28.61+00:00)
            timestamp_str = activity["timestamp"]
            activity_date = date.fromisoformat(timestamp_str[:10])
            
            # Skip if we've already counted this date
            if activity_date in seen_dates:
                continue
            seen_dates.add(activity_date)
            
            # Allow for today or yesterday as the start
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

    async def get_today_summary(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> Dict[str, Any]:
        """
        Get summary of today's habit completion.
        
        Args:
            owner_id: User ID
            owner_type: Type of owner
            
        Returns:
            Summary dict with completed, total, and habits list
        """
        habits = await self.get_all_habits_with_status(owner_id, owner_type)
        
        completed = sum(1 for h in habits if h.get("completed"))
        total = len(habits)
        
        return {
            "completed": completed,
            "total": total,
            "completion_rate": (completed / total * 100) if total > 0 else 0,
            "habits": habits,
        }

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    @with_retry()
    async def _get_habits_by_owner(
        self,
        owner_type: str,
        owner_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Get all habits for an owner.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        """
        result = self.supabase.table("habits").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        return result.data if result.data else []

    @with_retry()
    async def _get_habit_by_id(self, habit_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a habit by ID.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        """
        result = self.supabase.table("habits").select("*").eq(
            "id", habit_id
        ).execute()
        
        return result.data[0] if result.data else None

    @with_retry()
    async def _get_goal_by_id(self, goal_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a goal by ID.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        """
        result = self.supabase.table("goals").select("*").eq(
            "id", goal_id
        ).execute()
        
        return result.data[0] if result.data else None

    @with_retry()
    async def _is_completed_today(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        check_date: date,
    ) -> bool:
        """
        Check if a habit is completed for a specific date.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        
        Note: activities table uses 'timestamp' column and 'kind' column
        instead of 'date' and 'completed'.
        """
        # Filter by date range using timestamp column
        start_of_day = f"{check_date.isoformat()}T00:00:00"
        end_of_day = f"{check_date.isoformat()}T23:59:59"
        
        result = self.supabase.table("activities").select("id").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("habit_id", habit_id).eq(
            "kind", "complete"
        ).gte("timestamp", start_of_day).lte("timestamp", end_of_day).execute()
        
        return len(result.data) > 0 if result.data else False

    @with_retry()
    async def _insert_activity(
        self,
        activity_data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Insert an activity record into the database.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        
        Args:
            activity_data: Activity data to insert
            
        Returns:
            Inserted activity record or None if failed
        """
        result = self.supabase.table("activities").insert(activity_data).execute()
        return result.data[0] if result.data else None

    def _find_similar_habits(
        self,
        name: str,
        habits: List[Dict[str, Any]],
        threshold: float = 0.6,
    ) -> List[str]:
        """Find habits with similar names."""
        similar = []
        name_lower = name.lower()
        
        for habit in habits:
            habit_name = habit["name"]
            ratio = SequenceMatcher(None, name_lower, habit_name.lower()).ratio()
            if ratio >= threshold:
                similar.append(habit_name)
        
        return similar[:3]  # Return top 3 suggestions

    async def increment_habit_progress(
        self,
        owner_id: str,
        habit_id: str,
        amount: Optional[float] = None,
        source: str = "slack",
        owner_type: str = "user",
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Increment habit progress by the specified amount.
        
        Creates an activity record with the specified amount (or the habit's
        workloadPerCount if not specified) and source.
        
        Requirements:
        - 4.2: Create activity record with amount equal to habit's workloadPerCount (default: 1)
        - 4.3: Set source field to "slack" for increment button actions
        
        Args:
            owner_id: User ID
            habit_id: ID of the habit
            amount: Amount to add (defaults to workloadPerCount)
            source: Source of the increment (default: "slack")
            owner_type: Type of owner (default: "user")
            
        Returns:
            Tuple of (success, message, result_data)
            - result_data contains: habit, streak, activity, amount
        """
        # Get habit by ID
        habit = await self._get_habit_by_id(habit_id)
        if not habit:
            return False, "Habit not found", None

        # Get workload_per_count from habit (default to 1 if not set)
        # Note: Supabase column is snake_case: workload_per_count
        workload_per_count = habit.get("workload_per_count", 1)
        if workload_per_count is None:
            workload_per_count = 1

        # If amount parameter is None, use workloadPerCount
        increment_amount = amount if amount is not None else workload_per_count

        # Create activity record with amount and source
        activity_data = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "habit_id": habit_id,
            "habit_name": habit.get("name", ""),
            "kind": "complete",
            "timestamp": datetime.utcnow().isoformat(),
            "amount": increment_amount,
            "source": source,
        }

        activity = await self._insert_activity(activity_data)

        if not activity:
            return False, "Failed to record progress", None

        # Calculate new streak
        streak = await self.get_habit_streak(habit_id, owner_type, owner_id)

        return True, "Progress updated", {
            "habit": habit,
            "streak": streak,
            "activity": activity,
            "amount": increment_amount,
        }
