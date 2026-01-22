"""
Habit Completion Reporter

Service for processing habit completions from Slack interactions.

This service handles habit completion logic and streak calculation,
delegating all database operations to injected repositories.

Requirements:
- 2.2: THE Habit_Completion_Reporter SHALL handle only habit completion logic and streak calculation
- 2.6: WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from zoneinfo import ZoneInfo

from ..repositories.habit import HabitRepository
from ..repositories.activity import ActivityRepository
from ..repositories.goal import GoalRepository
from ..errors import DataFetchError
from ..utils.retry import with_retry
from ..utils.structured_logger import get_logger

logger = get_logger(__name__)


class HabitCompletionReporter:
    """
    Service for handling habit completions via Slack.
    
    This service is responsible for:
    - Completing habits by name or ID
    - Calculating habit streaks
    - Tracking daily completion status
    - Generating habit summaries
    
    All database operations are delegated to injected repositories,
    following the dependency injection pattern for testability.
    
    Attributes:
        habit_repo: Repository for habit database operations.
        activity_repo: Repository for activity database operations.
        goal_repo: Repository for goal database operations.
        jst: Japan Standard Time timezone for date calculations.
    """

    def __init__(
        self,
        habit_repo: HabitRepository,
        activity_repo: ActivityRepository,
        goal_repo: GoalRepository,
    ):
        """
        Initialize the HabitCompletionReporter with injected repositories.
        
        Args:
            habit_repo: Repository for habit database operations.
            activity_repo: Repository for activity database operations.
            goal_repo: Repository for goal database operations.
        """
        self.habit_repo = habit_repo
        self.activity_repo = activity_repo
        self.goal_repo = goal_repo
        self.jst = ZoneInfo("Asia/Tokyo")

    async def complete_habit_by_name(
        self,
        owner_id: str,
        habit_name: str,
        source: str = "slack",
        owner_type: str = "user",
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Find and complete a habit by name.
        
        Searches for a habit by name (case-insensitive) and completes it if found.
        If no exact match is found, attempts a partial match. If still not found,
        returns suggestions for similar habit names.
        
        Args:
            owner_id: User ID.
            habit_name: Name of the habit to complete.
            source: Source of completion (default: "slack").
            owner_type: Type of owner (default: "user").
            
        Returns:
            Tuple of (success, message, habit_data).
            - success: True if habit was completed, False otherwise.
            - message: Description of the result.
            - habit_data: Dictionary with habit details, or suggestions if not found.
        """
        try:
            # Find habit by name (case-insensitive)
            habits = await self.habit_repo.get_by_owner(owner_type, owner_id)
            
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
        except Exception as e:
            raise DataFetchError(f"Failed to complete habit by name: {e}", e)

    async def complete_habit_by_id(
        self,
        owner_id: str,
        habit_id: str,
        source: str = "slack",
        owner_type: str = "user",
    ) -> Tuple[bool, str, Optional[Dict]]:
        """
        Complete a habit by ID.
        
        Creates a completion activity for the specified habit if it hasn't
        already been completed today. Returns the habit details and current streak.
        
        Args:
            owner_id: User ID.
            habit_id: ID of the habit to complete.
            source: Source of completion (default: "slack").
            owner_type: Type of owner (default: "user").
            
        Returns:
            Tuple of (success, message, habit_data).
            - success: True if habit was completed, False otherwise.
            - message: Description of the result.
            - habit_data: Dictionary with habit, streak, and activity details.
        """
        try:
            # Get habit details using repository
            habit = await self.habit_repo.get_by_id(habit_id)
            if not habit:
                return False, "Habit not found", None

            # Check if already completed today using JST boundaries
            start, end = self._get_jst_day_boundaries()
            if await self.activity_repo.has_completion_today(habit_id, start, end):
                streak = await self.get_habit_streak(habit_id, owner_type, owner_id)
                return False, "Already completed today", {
                    "habit": habit,
                    "streak": streak,
                    "already_completed": True,
                }

            # Create activity record using repository
            activity_data = {
                "owner_type": owner_type,
                "owner_id": owner_id,
                "habit_id": habit_id,
                "habit_name": habit.get("name", ""),
                "kind": "complete",
                "timestamp": datetime.utcnow().isoformat(),
            }
            
            activity = await self.activity_repo.create(activity_data)

            # Calculate streak
            streak = await self.get_habit_streak(habit_id, owner_type, owner_id)
            
            return True, "Habit completed", {
                "habit": habit,
                "streak": streak,
                "activity": activity,
            }
        except DataFetchError:
            raise
        except Exception as e:
            raise DataFetchError(f"Failed to complete habit: {e}", e)

    async def get_incomplete_habits_today(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> List[Dict[str, Any]]:
        """
        Get list of habits not yet completed today.
        
        Returns all active habits for the owner that have not been completed
        today, along with their current streak counts.
        
        Args:
            owner_id: User ID.
            owner_type: Type of owner.
            
        Returns:
            List of incomplete habit dicts with completion status and streak.
        """
        try:
            habits = await self.habit_repo.get_by_owner(owner_type, owner_id)
            start, end = self._get_jst_day_boundaries()
            
            incomplete = []
            for habit in habits:
                if not habit.get("active", True):
                    continue
                    
                is_completed = await self.activity_repo.has_completion_today(
                    habit["id"], start, end
                )
                
                if not is_completed:
                    streak = await self.get_habit_streak(habit["id"], owner_type, owner_id)
                    incomplete.append({
                        **habit,
                        "completed": False,
                        "streak": streak,
                    })
            
            return incomplete
        except Exception as e:
            raise DataFetchError(f"Failed to get incomplete habits: {e}", e)

    async def get_all_habits_with_status(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> List[Dict[str, Any]]:
        """
        Get all habits with their completion status for today.
        
        Returns all active habits for the owner with their completion status,
        streak count, and associated goal name.
        
        Args:
            owner_id: User ID.
            owner_type: Type of owner.
            
        Returns:
            List of habit dicts with completion status, streak, and goal name.
        """
        try:
            habits = await self.habit_repo.get_by_owner(owner_type, owner_id)
            start, end = self._get_jst_day_boundaries()
            
            result = []
            for habit in habits:
                if not habit.get("active", True):
                    continue
                    
                is_completed = await self.activity_repo.has_completion_today(
                    habit["id"], start, end
                )
                streak = await self.get_habit_streak(habit["id"], owner_type, owner_id)
                
                # Get goal name if available using repository
                goal_name = None
                if habit.get("goal_id"):
                    goal = await self.goal_repo.get_by_id(habit["goal_id"])
                    goal_name = goal.get("name") if goal else None
                
                result.append({
                    **habit,
                    "completed": is_completed,
                    "streak": streak,
                    "goal_name": goal_name or "No Goal",
                })
            
            return result
        except Exception as e:
            raise DataFetchError(f"Failed to get habits with status: {e}", e)

    @with_retry()
    async def get_habit_streak(
        self,
        habit_id: str,
        owner_type: str = "user",
        owner_id: Optional[str] = None,
    ) -> int:
        """
        Calculate current streak count for a habit.
        
        Calculates the number of consecutive days the habit has been completed,
        ending today or yesterday. Uses the activity repository to fetch
        completion history.
        
        Applies retry logic for transient connection errors.
        Requirements: 2.1, 2.3
        
        Args:
            habit_id: ID of the habit.
            owner_type: Type of owner.
            owner_id: User ID (optional, for filtering).
            
        Returns:
            Current streak count (0 if no completions).
        """
        try:
            # Get recent activities for this habit using repository
            activities = await self.activity_repo.get_habit_activities(
                habit_id, kind="complete", limit=365
            )
            
            if not activities:
                return 0

            # Calculate streak by extracting dates from timestamps
            streak = 0
            expected_date = date.today()
            seen_dates = set()
            
            for activity in activities:
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
        except Exception as e:
            raise DataFetchError(f"Failed to calculate streak: {e}", e)

    async def get_today_summary(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> Dict[str, Any]:
        """
        Get summary of today's habit completion.
        
        Returns a summary including the number of completed habits,
        total habits, completion rate, and detailed habit list.
        
        Args:
            owner_id: User ID.
            owner_type: Type of owner.
            
        Returns:
            Summary dict with completed, total, completion_rate, and habits list.
        """
        try:
            habits = await self.get_all_habits_with_status(owner_id, owner_type)
            
            completed = sum(1 for h in habits if h.get("completed"))
            total = len(habits)
            
            return {
                "completed": completed,
                "total": total,
                "completion_rate": (completed / total * 100) if total > 0 else 0,
                "habits": habits,
            }
        except Exception as e:
            raise DataFetchError(f"Failed to get today summary: {e}", e)

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
            owner_id: User ID.
            habit_id: ID of the habit.
            amount: Amount to add (defaults to workloadPerCount).
            source: Source of the increment (default: "slack").
            owner_type: Type of owner (default: "user").
            
        Returns:
            Tuple of (success, message, result_data).
            - result_data contains: habit, streak, activity, amount.
        """
        try:
            # Get habit by ID using repository
            habit = await self.habit_repo.get_by_id(habit_id)
            if not habit:
                return False, "Habit not found", None

            # Get workload_per_count from habit (default to 1 if not set)
            workload_per_count = habit.get("workload_per_count", 1)
            if workload_per_count is None:
                workload_per_count = 1

            # If amount parameter is None, use workloadPerCount
            increment_amount = amount if amount is not None else workload_per_count

            # Create activity record with amount using repository
            # Note: source field removed as it doesn't exist in activities table
            activity_data = {
                "owner_type": owner_type,
                "owner_id": owner_id,
                "habit_id": habit_id,
                "habit_name": habit.get("name", ""),
                "kind": "complete",
                "timestamp": datetime.utcnow().isoformat(),
                "amount": increment_amount,
            }

            activity = await self.activity_repo.create(activity_data)

            # Calculate new streak
            streak = await self.get_habit_streak(habit_id, owner_type, owner_id)

            return True, "Progress updated", {
                "habit": habit,
                "streak": streak,
                "activity": activity,
                "amount": increment_amount,
            }
        except Exception as e:
            raise DataFetchError(f"Failed to increment habit progress: {e}", e)

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _get_jst_day_boundaries(self) -> Tuple[datetime, datetime]:
        """
        Get JST day start and end times.
        
        Returns the start (00:00:00) and end (23:59:59) times for the current
        day in Japan Standard Time.
        
        Returns:
            Tuple of (start_datetime, end_datetime) in JST.
        """
        now_jst = datetime.now(self.jst)
        start = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now_jst.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start, end

    def _find_similar_habits(
        self,
        name: str,
        habits: List[Dict[str, Any]],
        threshold: float = 0.6,
    ) -> List[str]:
        """
        Find habits with similar names.
        
        Uses sequence matching to find habits with names similar to the
        provided name, useful for providing suggestions when a habit is not found.
        
        Args:
            name: The name to search for.
            habits: List of habit dictionaries to search.
            threshold: Minimum similarity ratio (0.0 to 1.0). Defaults to 0.6.
            
        Returns:
            List of similar habit names (up to 3 suggestions).
        """
        similar = []
        name_lower = name.lower()
        
        for habit in habits:
            habit_name = habit["name"]
            ratio = SequenceMatcher(None, name_lower, habit_name.lower()).ratio()
            if ratio >= threshold:
                similar.append(habit_name)
        
        return similar[:3]  # Return top 3 suggestions
