"""
Base Repository

Abstract base class for repository pattern implementation with generic CRUD operations.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List, Dict, Any
from supabase import Client

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    """
    Base repository with common CRUD operations.
    
    This abstract base class provides a consistent interface for database operations
    across all repositories. It uses the Supabase client for data access and supports
    generic typing for type-safe operations.
    
    Attributes:
        supabase: The Supabase client instance for database operations.
        table_name: The name of the database table this repository manages.
    
    Type Parameters:
        T: The type of entity this repository manages.
    """
    
    def __init__(self, supabase: Client, table_name: str):
        """
        Initialize the base repository.
        
        Args:
            supabase: The Supabase client instance.
            table_name: The name of the database table.
        """
        self.supabase = supabase
        self.table_name = table_name
    
    async def get_by_id(self, id: str) -> Optional[T]:
        """
        Retrieve an entity by its ID.
        
        Args:
            id: The unique identifier of the entity.
        
        Returns:
            The entity if found, None otherwise.
        """
        result = self.supabase.table(self.table_name).select("*").eq("id", id).execute()
        return result.data[0] if result.data else None
    
    async def get_all(self, limit: int = 100) -> List[T]:
        """
        Retrieve all entities with optional limit.
        
        Args:
            limit: Maximum number of entities to retrieve. Defaults to 100.
        
        Returns:
            List of entities.
        """
        result = self.supabase.table(self.table_name).select("*").limit(limit).execute()
        return result.data if result.data else []
    
    async def create(self, data: Dict[str, Any]) -> T:
        """
        Create a new entity.
        
        Args:
            data: Dictionary containing the entity data.
        
        Returns:
            The created entity.
        
        Raises:
            Exception: If the creation fails.
        """
        result = self.supabase.table(self.table_name).insert(data).execute()
        if result.data:
            return result.data[0]
        raise Exception(f"Failed to create entity in {self.table_name}")
    
    async def update(self, id: str, data: Dict[str, Any]) -> Optional[T]:
        """
        Update an existing entity.
        
        Args:
            id: The unique identifier of the entity to update.
            data: Dictionary containing the fields to update.
        
        Returns:
            The updated entity if found, None otherwise.
        """
        result = self.supabase.table(self.table_name).update(data).eq("id", id).execute()
        return result.data[0] if result.data else None
    
    async def delete(self, id: str) -> bool:
        """
        Delete an entity by its ID.
        
        Args:
            id: The unique identifier of the entity to delete.
        
        Returns:
            True if the entity was deleted, False otherwise.
        """
        result = self.supabase.table(self.table_name).delete().eq("id", id).execute()
        return len(result.data) > 0 if result.data else False
    
    async def exists(self, id: str) -> bool:
        """
        Check if an entity exists by its ID.
        
        Args:
            id: The unique identifier of the entity.
        
        Returns:
            True if the entity exists, False otherwise.
        """
        result = self.supabase.table(self.table_name).select("id").eq("id", id).limit(1).execute()
        return len(result.data) > 0 if result.data else False
    
    async def count(self) -> int:
        """
        Count the total number of entities in the table.
        
        Returns:
            The total count of entities.
        """
        result = self.supabase.table(self.table_name).select("id", count="exact").execute()
        return result.count if result.count is not None else 0
