"""
Habit Repository

Database operations for habits table using the repository pattern.
"""

from typing import List, Optional, Dict, Any
from supabase import Client

from .base import BaseRepository


# Type alias for Habit entity (dict from Supabase)
Habit = Dict[str, Any]


class HabitRepository(BaseRepository[Habit]):
    """
    Repository for habit database operations.
    
    This repository encapsulates all database operations for the habits table,
    providing methods for querying habits by owner, name, and status.
    
    Attributes:
        supabase: The Supabase client instance for database operations.
        table_name: The name of the database table ("habits").
    """
    
    def __init__(self, supabase: Client):
        """
        Initialize the HabitRepository.
        
        Args:
            supabase: The Supabase client instance.
        """
        super().__init__(supabase, "habits")
    
    async def get_active_do_habits(
        self, owner_type: str, owner_id: str
    ) -> List[Habit]:
        """
        Get active habits with type='do' for an owner.
        
        Retrieves all habits that are active and have type 'do' (as opposed to 'avoid')
        for the specified owner. This is commonly used for daily progress tracking
        and habit completion workflows.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            List of habit dictionaries matching the criteria.
            Returns an empty list if no habits are found.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("active", True).eq("type", "do").execute()
        return result.data if result.data else []
    
    async def find_by_name(
        self, owner_type: str, owner_id: str, name: str
    ) -> Optional[Habit]:
        """
        Find habit by exact name match (case-insensitive).
        
        Searches for a habit with the exact name for the specified owner.
        The search is case-insensitive using ILIKE.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            name: The exact name of the habit to find.
        
        Returns:
            The habit dictionary if found, None otherwise.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).ilike("name", name).execute()
        return result.data[0] if result.data else None
    
    async def search_by_name(
        self, owner_type: str, owner_id: str, query: str, limit: int = 5
    ) -> List[Habit]:
        """
        Search habits by partial name match for suggestions.
        
        Performs a partial match search on habit names using ILIKE with wildcards.
        This is useful for autocomplete/suggestion features in the UI.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            query: The search query string to match against habit names.
            limit: Maximum number of results to return. Defaults to 5.
        
        Returns:
            List of habit dictionaries matching the search query.
            Returns an empty list if no habits match.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).ilike("name", f"%{query}%").limit(limit).execute()
        return result.data if result.data else []
    
    async def get_by_owner(
        self, owner_type: str, owner_id: str, active_only: bool = False
    ) -> List[Habit]:
        """
        Get all habits for an owner.
        
        Retrieves all habits belonging to the specified owner, optionally
        filtering to only active habits.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            active_only: If True, only return active habits. Defaults to False.
        
        Returns:
            List of habit dictionaries for the owner.
            Returns an empty list if no habits are found.
        """
        query = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id)
        
        if active_only:
            query = query.eq("active", True)
        
        result = query.execute()
        return result.data if result.data else []
    
    async def get_habits_by_goal(
        self, goal_id: str, active_only: bool = True
    ) -> List[Habit]:
        """
        Get all habits associated with a specific goal.
        
        Args:
            goal_id: The unique identifier of the goal.
            active_only: If True, only return active habits. Defaults to True.
        
        Returns:
            List of habit dictionaries associated with the goal.
            Returns an empty list if no habits are found.
        """
        query = self.supabase.table(self.table_name).select("*").eq(
            "goal_id", goal_id
        )
        
        if active_only:
            query = query.eq("active", True)
        
        result = query.execute()
        return result.data if result.data else []
    
    async def get_habits_with_triggers(self) -> List[Habit]:
        """
        Get all active habits with trigger_time set.
        
        Retrieves all habits that are active and have a trigger_time configured.
        This is used by the FollowUpAgent to determine which habits need
        reminders and follow-ups.
        
        Returns:
            List of habit dictionaries with trigger_time set.
            Returns an empty list if no habits are found.
        """
        result = self.supabase.table(self.table_name).select("*").not_.is_(
            "trigger_time", "null"
        ).eq("active", True).execute()
        
        return result.data if result.data else []
