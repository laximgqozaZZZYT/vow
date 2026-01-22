"""
Activity Repository

Database operations for activities table using the repository pattern.
"""

from datetime import datetime
from typing import List, Dict, Any
from supabase import Client

from .base import BaseRepository


# Type alias for Activity entity (dict from Supabase)
Activity = Dict[str, Any]


class ActivityRepository(BaseRepository[Activity]):
    """
    Repository for activity database operations.
    
    This repository encapsulates all database operations for the activities table,
    providing methods for querying activities by time range, habit, and completion status.
    
    Attributes:
        supabase: The Supabase client instance for database operations.
        table_name: The name of the database table ("activities").
    """
    
    def __init__(self, supabase: Client):
        """
        Initialize the ActivityRepository.
        
        Args:
            supabase: The Supabase client instance.
        """
        super().__init__(supabase, "activities")
    
    async def get_activities_in_range(
        self,
        owner_type: str,
        owner_id: str,
        start: datetime,
        end: datetime,
        kind: str = "complete"
    ) -> List[Activity]:
        """
        Get activities within a time range.
        
        Retrieves all activities for the specified owner within the given time range,
        filtered by activity kind. This is commonly used for daily progress tracking
        and report generation.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            start: The start datetime of the range (inclusive).
            end: The end datetime of the range (inclusive).
            kind: The type of activity to filter by. Defaults to "complete".
        
        Returns:
            List of activity dictionaries matching the criteria.
            Returns an empty list if no activities are found.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("kind", kind).gte(
            "timestamp", start.isoformat()
        ).lte("timestamp", end.isoformat()).execute()
        return result.data if result.data else []
    
    async def get_habit_activities(
        self, habit_id: str, kind: str = "complete", limit: int = 365
    ) -> List[Activity]:
        """
        Get activities for a specific habit.
        
        Retrieves activities for a specific habit, ordered by timestamp descending.
        This is commonly used for streak calculation and habit history display.
        
        Args:
            habit_id: The unique identifier of the habit.
            kind: The type of activity to filter by. Defaults to "complete".
            limit: Maximum number of activities to return. Defaults to 365.
        
        Returns:
            List of activity dictionaries for the habit, ordered by timestamp descending.
            Returns an empty list if no activities are found.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "habit_id", habit_id
        ).eq("kind", kind).order("timestamp", desc=True).limit(limit).execute()
        return result.data if result.data else []
    
    async def has_completion_today(
        self, habit_id: str, start: datetime, end: datetime
    ) -> bool:
        """
        Check if habit was completed today.
        
        Checks whether there is at least one completion activity for the specified
        habit within the given time range. This is used to prevent duplicate
        completions and to determine habit status for the current day.
        
        Args:
            habit_id: The unique identifier of the habit.
            start: The start datetime of the day (typically JST 00:00:00).
            end: The end datetime of the day (typically JST 23:59:59).
        
        Returns:
            True if the habit has at least one completion activity in the range,
            False otherwise.
        """
        result = self.supabase.table(self.table_name).select("id").eq(
            "habit_id", habit_id
        ).eq("kind", "complete").gte(
            "timestamp", start.isoformat()
        ).lte("timestamp", end.isoformat()).limit(1).execute()
        return len(result.data) > 0 if result.data else False
    
    async def has_completion_on_date(
        self,
        owner_type: str,
        owner_id: str,
        habit_id: str,
        check_date: "date",
    ) -> bool:
        """
        Check if habit was completed on a specific date.
        
        Checks whether there is at least one completion activity for the specified
        habit on the given date. This uses the 'date' field in the activities table
        rather than timestamp range.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            habit_id: The unique identifier of the habit.
            check_date: The date to check for completion.
        
        Returns:
            True if the habit has at least one completion activity on the date,
            False otherwise.
        """
        from datetime import date  # Import here to avoid circular import
        
        result = self.supabase.table(self.table_name).select("id").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("habit_id", habit_id).eq(
            "date", check_date.isoformat()
        ).eq("completed", True).limit(1).execute()
        
        return len(result.data) > 0 if result.data else False
