"""
Goal Repository

Database operations for goals table using the repository pattern.
"""

from typing import List, Dict, Any, Optional
from supabase import Client

from .base import BaseRepository


# Type alias for Goal entity (dict from Supabase)
Goal = Dict[str, Any]


class GoalRepository(BaseRepository[Goal]):
    """
    Repository for goal database operations.
    
    This repository encapsulates all database operations for the goals table,
    providing methods for querying goals by owner and ID.
    
    Attributes:
        supabase: The Supabase client instance for database operations.
        table_name: The name of the database table ("goals").
    """
    
    def __init__(self, supabase: Client):
        """
        Initialize the GoalRepository.
        
        Args:
            supabase: The Supabase client instance.
        """
        super().__init__(supabase, "goals")
    
    async def get_by_owner(
        self, owner_type: str, owner_id: str
    ) -> List[Goal]:
        """
        Get all goals for an owner.
        
        Retrieves all goals belonging to the specified owner. This is commonly
        used for displaying goal lists and associating habits with goals.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            List of goal dictionaries for the owner.
            Returns an empty list if no goals are found.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).execute()
        return result.data if result.data else []
    
    async def get_active_goals(
        self, owner_type: str, owner_id: str
    ) -> List[Goal]:
        """
        Get all active goals for an owner.
        
        Retrieves all goals that are currently active for the specified owner.
        Active goals are those that have not been archived or completed.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
        
        Returns:
            List of active goal dictionaries for the owner.
            Returns an empty list if no active goals are found.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).eq("active", True).execute()
        return result.data if result.data else []
    
    async def find_by_name(
        self, owner_type: str, owner_id: str, name: str
    ) -> Optional[Goal]:
        """
        Find goal by exact name match (case-insensitive).
        
        Searches for a goal with the exact name for the specified owner.
        The search is case-insensitive using ILIKE.
        
        Args:
            owner_type: The type of owner (e.g., "user", "team").
            owner_id: The unique identifier of the owner.
            name: The exact name of the goal to find.
        
        Returns:
            The goal dictionary if found, None otherwise.
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "owner_type", owner_type
        ).eq("owner_id", owner_id).ilike("name", name).execute()
        return result.data[0] if result.data else None
