"""
Daily Progress Calculator

Service for calculating daily workload-based progress for habits.

Requirements:
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

from supabase import Client


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
    
    Requirements:
    - 6.1: Calculate progress based on activities within JST 0:00-23:59
    """
    
    def __init__(self, supabase: Client):
        """
        Initialize the DailyProgressCalculator.
        
        Args:
            supabase: Supabase client for database operations
        """
        self.supabase = supabase
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
        
        Queries the activities table for all completion activities within
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
        # Get JST day boundaries in UTC
        start_utc, end_utc = self._get_jst_day_boundaries()
        
        # Format timestamps for database query
        start_iso = start_utc.isoformat()
        end_iso = end_utc.isoformat()
        
        # Query activities table with filters:
        # - owner_type and owner_id for user filtering
        # - kind="complete" for completion activities only
        # - timestamp within JST day boundaries
        result = self.supabase.table("activities").select("*").eq(
            "owner_type", owner_type
        ).eq(
            "owner_id", owner_id
        ).eq(
            "kind", "complete"
        ).gte(
            "timestamp", start_iso
        ).lte(
            "timestamp", end_iso
        ).execute()
        
        return result.data if result.data else []

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
        
        for activity in activities:
            # Filter by habit_id
            if activity.get("habit_id") != habit_id:
                continue
            
            # Get amount from activity, use workload_per_count as default if None
            amount = activity.get("amount")
            if amount is None:
                amount = workload_per_count
            
            total_workload += float(amount)
        
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
        # Import HabitCompletionReporter for streak calculation
        from app.services.habit_completion_reporter import HabitCompletionReporter
        
        # Create instance for streak calculation
        completion_reporter = HabitCompletionReporter(self.supabase)
        
        # Query active habits with type="do" (Requirements 6.5, 6.6)
        habits = await self._get_active_do_habits(owner_id, owner_type)
        
        # Get today's activities
        activities = await self._get_today_activities(owner_id, owner_type)
        
        # Build progress list
        progress_list: List[HabitProgress] = []
        
        for habit in habits:
            habit_id = habit.get("id", "")
            habit_name = habit.get("name", "")
            
            # Get goal name (default to "No Goal" if not set)
            goal_name = await self._get_goal_name(habit.get("goal_id"))
            
            # Get workload_per_count (default to 1)
            workload_per_count = float(habit.get("workloadPerCount") or 1)
            
            # Calculate current count from today's activities
            current_count = self._calculate_workload(
                habit_id, activities, workload_per_count
            )
            
            # Determine total count: use workloadTotal if set, otherwise fall back to must
            # (Requirement 2.4)
            workload_total = habit.get("workloadTotal")
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
            workload_unit = habit.get("workloadUnit")
            
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

    async def _get_active_do_habits(
        self,
        owner_id: str,
        owner_type: str,
    ) -> List[Dict[str, Any]]:
        """
        Get active habits with type="do" for an owner.
        
        Requirements:
        - 6.5: THE Daily_Progress_Calculator SHALL exclude inactive habits
        - 6.6: THE Daily_Progress_Calculator SHALL exclude habits with type="avoid"
        
        Args:
            owner_id: User ID
            owner_type: Type of owner
            
        Returns:
            List of active habit records with type="do"
        """
        result = self.supabase.table("habits").select("*").eq(
            "owner_type", owner_type
        ).eq(
            "owner_id", owner_id
        ).eq(
            "active", True
        ).eq(
            "type", "do"
        ).execute()
        
        return result.data if result.data else []

    async def _get_goal_name(self, goal_id: Optional[str]) -> str:
        """
        Get the name of a goal by ID.
        
        Args:
            goal_id: ID of the goal (may be None)
            
        Returns:
            Goal name or "No Goal" if not found
        """
        if not goal_id:
            return "No Goal"
        
        result = self.supabase.table("goals").select("name").eq(
            "id", goal_id
        ).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0].get("name", "No Goal")
        
        return "No Goal"
