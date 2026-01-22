"""
Daily Progress Calculator

Service for calculating daily workload-based progress for habits.

This service handles progress calculation logic, delegating all database
operations to injected repositories.

Requirements:
- 2.3: THE Daily_Progress_Calculator SHALL handle only progress calculation logic
- 2.6: WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies
- 6.1: THE Daily_Progress_Calculator SHALL calculate progress based on activities 
       within JST 0:00-23:59 of the current day
- 6.4: THE Daily_Progress_Calculator SHALL return progress data including: habitId, habitName, 
       currentCount, totalCount, progressRate, workloadUnit, workloadPerCount, and completed status
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from ..repositories.habit import HabitRepository
from ..repositories.activity import ActivityRepository
from ..repositories.goal import GoalRepository
from ..errors import DataFetchError
from ..utils.structured_logger import get_logger

logger = get_logger(__name__)


@dataclass
class HabitProgress:
    """
    Progress data for a single habit.
    
    Attributes:
        habit_id: Unique identifier for the habit
        habit_name: Display name of the habit
        goal_name: Name of the associated goal
        current_count: Sum of today's activity amounts
        total_count: Target count (workloadTotal or must field)
        progress_rate: Percentage of progress (current_count / total_count) * 100
        workload_unit: Unit of measurement (e.g., "回", "分", "ページ")
        workload_per_count: Amount added per increment (default: 1)
        streak: Current streak count in days
        completed: True if progress_rate >= 100
    """
    habit_id: str
    habit_name: str
    goal_name: str
    current_count: float
    total_count: float
    progress_rate: float
    workload_unit: Optional[str]
    workload_per_count: float
    streak: int
    completed: bool


@dataclass
class DashboardSummary:
    """
    Summary statistics for the dashboard.
    
    Attributes:
        total_habits: Total number of active habits
        completed_habits: Number of habits with progress_rate >= 100
        completion_rate: Percentage of completed habits
        date_display: Formatted date string (e.g., "2026年1月20日（月）")
    """
    total_habits: int
    completed_habits: int
    completion_rate: float
    date_display: str


class DailyProgressCalculator:
    """
    Service for calculating daily workload progress.
    
    This service calculates workload-based progress for habits based on
    activities within JST 0:00-23:59 of the current day.
    
    All database operations are delegated to injected repositories,
    following the dependency injection pattern for testability.
    
    Requirements:
    - 2.3: THE Daily_Progress_Calculator SHALL handle only progress calculation logic
    - 6.1: Calculate progress based on activities within JST 0:00-23:59
    
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
        Initialize the DailyProgressCalculator with injected repositories.
        
        Args:
            habit_repo: Repository for habit database operations.
            activity_repo: Repository for activity database operations.
            goal_repo: Repository for goal database operations.
        """
        self.habit_repo = habit_repo
        self.activity_repo = activity_repo
        self.goal_repo = goal_repo
        self.jst = ZoneInfo("Asia/Tokyo")
    
    def _get_jst_day_boundaries(self) -> Tuple[datetime, datetime]:
        """
        Get the start and end datetime boundaries for the current JST day.
        
        Returns UTC timestamps that correspond to JST 0:00:00 and JST 23:59:59
        of the current day. These timestamps can be used for database queries
        to filter activities within the JST day.
        
        Requirements:
        - 6.1: THE Daily_Progress_Calculator SHALL calculate progress based on 
               activities within JST 0:00-23:59 of the current day
        
        Returns:
            Tuple of (start_utc, end_utc) datetime objects representing
            JST 0:00:00 and JST 23:59:59 in UTC
        """
        # Get current time in JST
        now_jst = datetime.now(self.jst)
        
        # Create JST day boundaries (0:00:00 and 23:59:59)
        start_jst = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
        end_jst = now_jst.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert to UTC for database queries
        # JST is UTC+9, so we need to convert to UTC
        utc = ZoneInfo("UTC")
        start_utc = start_jst.astimezone(utc)
        end_utc = end_jst.astimezone(utc)
        
        return start_utc, end_utc

    async def _get_today_activities(
        self,
        owner_id: str,
        owner_type: str,
    ) -> List[Dict[str, Any]]:
        """
        Get activities within JST 0:00-23:59 today.
        
        Uses the ActivityRepository to query completion activities within
        the current JST day boundaries.
        
        Requirements:
        - 6.1: THE Daily_Progress_Calculator SHALL calculate progress based on 
               activities within JST 0:00-23:59 of the current day
        - 6.2: WHEN calculating progress, THE Daily_Progress_Calculator SHALL 
               sum the amount field from activities with kind="complete"
        
        Args:
            owner_id: User ID
            owner_type: Type of owner (e.g., "user")
            
        Returns:
            List of activity records with kind="complete" within JST day boundaries
        """
        try:
            # Get JST day boundaries in UTC
            start_utc, end_utc = self._get_jst_day_boundaries()
            
            logger.debug(
                f"Querying activities for owner {owner_id}: "
                f"start={start_utc.isoformat()}, end={end_utc.isoformat()}"
            )
            
            # Use repository to get activities in range
            activities = await self.activity_repo.get_activities_in_range(
                owner_type=owner_type,
                owner_id=owner_id,
                start=start_utc,
                end=end_utc,
                kind="complete"
            )
            
            logger.debug(
                f"Found {len(activities)} activities within time range for owner {owner_id}"
            )
            
            return activities
        except Exception as e:
            raise DataFetchError(f"Failed to get today's activities: {e}", e)

    def _calculate_workload(
        self,
        habit_id: str,
        activities: List[Dict[str, Any]],
        workload_per_count: float,
    ) -> float:
        """
        Sum workload from activities for a habit.
        
        Filters activities by habit_id and sums the amount field from each
        matching activity. If an activity has no amount field (None), uses
        workload_per_count as the default amount.
        
        Requirements:
        - 2.2: WHEN calculating currentCount, THE Daily_Progress_Calculator SHALL 
               sum the amount field from today's activities (JST 0:00-23:59) for each habit
        - 6.2: WHEN calculating progress, THE Daily_Progress_Calculator SHALL 
               sum the amount field from activities with kind="complete"
        - 6.3: WHEN an activity has no amount field, THE Daily_Progress_Calculator 
               SHALL use the habit's workloadPerCount as the default amount
        
        Args:
            habit_id: ID of the habit to calculate workload for
            activities: List of activity records (already filtered by kind="complete")
            workload_per_count: Default amount to use when activity has no amount field
            
        Returns:
            Total workload sum for the habit
        """
        total_workload = 0.0
        matching_count = 0
        
        for activity in activities:
            # Filter by habit_id
            if activity.get("habit_id") != habit_id:
                continue
            
            matching_count += 1
            
            # Get amount from activity, use workload_per_count as default if None
            amount = activity.get("amount")
            if amount is None:
                amount = workload_per_count
            
            total_workload += float(amount)
        
        logger.debug(
            f"Workload for habit {habit_id}: {matching_count} activities, total={total_workload}"
        )
        
        return total_workload

    async def get_daily_progress(
        self,
        owner_id: str,
        owner_type: str = "user",
    ) -> List[HabitProgress]:
        """
        Calculate daily progress for all active habits.
        
        Queries active habits with type="do" for the given owner, calculates
        progress for each habit based on today's activities, and returns
        sorted results by goal name.
        
        Requirements:
        - 6.4: THE Daily_Progress_Calculator SHALL return progress data including: 
               habitId, habitName, currentCount, totalCount, progressRate, 
               workloadUnit, workloadPerCount, and completed status
        - 6.5: THE Daily_Progress_Calculator SHALL exclude inactive habits from 
               the progress calculation
        - 6.6: THE Daily_Progress_Calculator SHALL exclude habits with type="avoid" 
               from the progress display
        
        Args:
            owner_id: User ID
            owner_type: Type of owner (default: "user")
            
        Returns:
            List of HabitProgress objects sorted by goal_name
        """
        try:
            # Import HabitCompletionReporter for streak calculation
            # Note: We create a local instance with the same repositories
            from app.services.habit_completion_reporter import HabitCompletionReporter
            
            # Create instance for streak calculation with injected repositories
            completion_reporter = HabitCompletionReporter(
                self.habit_repo,
                self.activity_repo,
                self.goal_repo
            )
            
            # Query active habits with type="do" using repository (Requirements 6.5, 6.6)
            habits = await self.habit_repo.get_active_do_habits(owner_type, owner_id)
            
            # Get today's activities
            activities = await self._get_today_activities(owner_id, owner_type)
            
            # Build progress list
            progress_list: List[HabitProgress] = []
            
            for habit in habits:
                habit_id = habit.get("id", "")
                habit_name = habit.get("name", "")
                
                # Get goal name using repository (default to "No Goal" if not set)
                goal_name = await self._get_goal_name(habit.get("goal_id"))
                
                # Get workload_per_count (default to 1)
                # Note: Supabase column is snake_case: workload_per_count
                workload_per_count = float(habit.get("workload_per_count") or 1)
                
                # Calculate current count from today's activities
                current_count = self._calculate_workload(
                    habit_id, activities, workload_per_count
                )
                
                # Determine total count: use workload_total if set, otherwise fall back to must
                # Note: Supabase column is snake_case: workload_total
                # (Requirement 2.4)
                workload_total = habit.get("workload_total")
                must = habit.get("must")
                
                if workload_total is not None and workload_total > 0:
                    total_count = float(workload_total)
                elif must is not None and must > 0:
                    total_count = float(must)
                else:
                    # Default to 1 if neither is set
                    total_count = 1.0
                
                # Calculate progress rate
                progress_rate = (current_count / total_count) * 100 if total_count > 0 else 0.0
                
                # Get workload unit (may be None)
                # Note: Supabase column is snake_case: workload_unit
                workload_unit = habit.get("workload_unit")
                
                # Get streak count using existing method
                streak = await completion_reporter.get_habit_streak(
                    habit_id, owner_type, owner_id
                )
                
                # Determine if completed (progress_rate >= 100)
                completed = progress_rate >= 100
                
                # Create HabitProgress object
                progress = HabitProgress(
                    habit_id=habit_id,
                    habit_name=habit_name,
                    goal_name=goal_name,
                    current_count=current_count,
                    total_count=total_count,
                    progress_rate=progress_rate,
                    workload_unit=workload_unit,
                    workload_per_count=workload_per_count,
                    streak=streak,
                    completed=completed,
                )
                
                progress_list.append(progress)
            
            # Sort by goal_name
            progress_list.sort(key=lambda p: p.goal_name)
            
            return progress_list
        except DataFetchError:
            raise
        except Exception as e:
            raise DataFetchError(f"Failed to calculate daily progress: {e}", e)

    async def _get_goal_name(self, goal_id: Optional[str]) -> str:
        """
        Get the name of a goal by ID using the repository.
        
        Args:
            goal_id: ID of the goal (may be None)
            
        Returns:
            Goal name or "No Goal" if not found
        """
        if not goal_id:
            return "No Goal"
        
        try:
            goal = await self.goal_repo.get_by_id(goal_id)
            if goal:
                return goal.get("name", "No Goal")
            return "No Goal"
        except Exception as e:
            logger.warning(f"Failed to get goal name for {goal_id}: {e}")
            return "No Goal"
