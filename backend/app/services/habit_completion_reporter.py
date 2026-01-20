"""
Habit Completion Reporter

Service for processing habit completions from Slack interactions.
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from supabase import Client


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
        activity_data = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "habit_id": habit_id,
            "date": today.isoformat(),
            "completed": True,
            "source": source,
        }
        
        result = self.supabase.table("activities").insert(activity_data).execute()
        
        if not result.data:
            return False, "Failed to record completion", None

        # Calculate streak
        streak = await self.get_habit_streak(habit_id, owner_type, owner_id)
        
        return True, "Habit completed", {
            "habit": habit,
            "streak": streak,
            "activity": result.data[0],
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

    async def get_habit_streak(
        self,
        habit_id: str,
        owner_type: str = "user",
        owner_id: Optional[str] = None,
    ) -> int:
        """
        Calculate current streak count for a habit.
        
        Args:
            habit_id: ID of the habit
            owner_type: Type of owner
            owner_id: User ID (optional, for filtering)
            
        Returns:
            Current streak count
        """
        # Get recent activities for this habit, ordered by date descending
        query = self.supabase.table("activities").select("date, completed").eq(
            "habit_id", habit_id
        ).eq("completed", True).order("date", desc=True).limit(365)
        
        if owner_id:
            query = query.eq("owner_type", owner_type).eq("owner_id", owner_id)
        
        result = query.execute()
        
        if not result.data:
            return 0

        # Calculate streak
        streak = 0
        expected_date = date.today()
        
        for activity in result.data:
            activity_date = date.fromisoformat(activity["date"])
            
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

    async def _get_habits_by_owner(
        self,
        owner_type: str,
        owner_id: str,
    ) -> List[Dict[str, Any]]:
        """Get all habits for an owner."""
        result = self.supabase.table("habits").select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        
        return result.data if result.data else []

    async def _get_habit_by_id(self, habit_id: str) -> Optional[Dict[str, Any]]:
        """Get a habit by ID."""
        result = self.supabase.table("habits").select("*").eq(
            "id", habit_id
        ).execute()
        
        return result.data[0] if result.data else None

    async def _get_goal_by_id(self, goal_id: str) -> Optional[Dict[str, Any]]:
        """Get a goal by ID."""
        result = self.supabase.table("goals").select("*").eq(
            "id", goal_id
        ).execute()
        
        return result.data[0] if result.data else None

    async def _is_completed_today(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        check_date: date,
    ) -> bool:
        """Check if a habit is completed for a specific date."""
        result = self.supabase.table("activities").select("id").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("habit_id", habit_id).eq(
            "date", check_date.isoformat()
        ).eq("completed", True).execute()
        
        return len(result.data) > 0 if result.data else False

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
