"""
Dependency Injection Module

Provides FastAPI dependency injection functions for services and repositories.
This module centralizes all dependency creation to enable:
- Consistent dependency injection across routers
- Easy testing with mock dependencies
- Proper separation of concerns

Requirements:
- 2.2: WHEN a service needs another service, THE Backend_API SHALL inject it as a dependency
- 2.6: WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies
"""

from functools import lru_cache
from typing import TYPE_CHECKING

from fastapi import Depends
from supabase import Client

from .config import get_supabase_client
from .repositories.slack import SlackRepository
from .repositories.habit import HabitRepository
from .repositories.activity import ActivityRepository
from .repositories.goal import GoalRepository

# Type checking imports for services that may not be fully refactored yet
if TYPE_CHECKING:
    from .services.slack_service import SlackIntegrationService
    from .services.habit_completion_reporter import HabitCompletionReporter
    from .services.daily_progress_calculator import DailyProgressCalculator
    from .services.weekly_report_generator import WeeklyReportGenerator
    from .services.follow_up_agent import FollowUpAgent


# =============================================================================
# Database Client Dependencies
# =============================================================================

def get_supabase() -> Client:
    """
    Get Supabase client dependency.
    
    Provides a Supabase client instance for database operations.
    Uses the connection factory from config module which handles:
    - Connection validation before use
    - Automatic reconnection for invalid connections
    - Resource cleanup on recreation
    - Optimized timeouts for Lambda environment
    
    Returns:
        Supabase client instance.
        
    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_ANON_KEY are not configured.
    """
    return get_supabase_client()


# =============================================================================
# Repository Dependencies
# =============================================================================

def get_slack_repository(
    supabase: Client = Depends(get_supabase)
) -> SlackRepository:
    """
    Get Slack repository dependency.
    
    Provides a SlackRepository instance for Slack-related database operations
    including connections, notification preferences, and follow-up status.
    
    Args:
        supabase: Supabase client (injected via Depends).
        
    Returns:
        SlackRepository instance.
    """
    return SlackRepository(supabase)


def get_habit_repository(
    supabase: Client = Depends(get_supabase)
) -> HabitRepository:
    """
    Get Habit repository dependency.
    
    Provides a HabitRepository instance for habit-related database operations
    including querying habits by owner, name, and status.
    
    Args:
        supabase: Supabase client (injected via Depends).
        
    Returns:
        HabitRepository instance.
    """
    return HabitRepository(supabase)


def get_activity_repository(
    supabase: Client = Depends(get_supabase)
) -> ActivityRepository:
    """
    Get Activity repository dependency.
    
    Provides an ActivityRepository instance for activity-related database operations
    including querying activities by time range, habit, and completion status.
    
    Args:
        supabase: Supabase client (injected via Depends).
        
    Returns:
        ActivityRepository instance.
    """
    return ActivityRepository(supabase)


def get_goal_repository(
    supabase: Client = Depends(get_supabase)
) -> GoalRepository:
    """
    Get Goal repository dependency.
    
    Provides a GoalRepository instance for goal-related database operations
    including querying goals by owner and ID.
    
    Args:
        supabase: Supabase client (injected via Depends).
        
    Returns:
        GoalRepository instance.
    """
    return GoalRepository(supabase)


# =============================================================================
# Service Dependencies
# =============================================================================

@lru_cache()
def get_slack_service() -> "SlackIntegrationService":
    """
    Get Slack integration service (singleton).
    
    Provides a singleton SlackIntegrationService instance for Slack API
    interactions including OAuth, messaging, and webhook handling.
    
    The service is cached using lru_cache to ensure only one instance
    is created per process, which is important for:
    - Maintaining circuit breaker state
    - Reusing HTTP client connections
    - Consistent rate limiting behavior
    
    Returns:
        SlackIntegrationService singleton instance.
    """
    from .services.slack_service import SlackIntegrationService
    return SlackIntegrationService()


def get_habit_completion_reporter(
    habit_repo: HabitRepository = Depends(get_habit_repository),
    activity_repo: ActivityRepository = Depends(get_activity_repository),
    goal_repo: GoalRepository = Depends(get_goal_repository),
) -> "HabitCompletionReporter":
    """
    Get Habit completion reporter with injected repositories.
    
    Provides a HabitCompletionReporter instance for handling habit completions.
    The service receives injected repositories for database operations,
    following the dependency injection pattern for testability.
    
    Args:
        habit_repo: HabitRepository for habit operations (injected via Depends).
        activity_repo: ActivityRepository for activity operations (injected via Depends).
        goal_repo: GoalRepository for goal operations (injected via Depends).
        
    Returns:
        HabitCompletionReporter instance with injected repositories.
    """
    from .services.habit_completion_reporter import HabitCompletionReporter
    return HabitCompletionReporter(habit_repo, activity_repo, goal_repo)


def get_daily_progress_calculator(
    habit_repo: HabitRepository = Depends(get_habit_repository),
    activity_repo: ActivityRepository = Depends(get_activity_repository),
    goal_repo: GoalRepository = Depends(get_goal_repository),
) -> "DailyProgressCalculator":
    """
    Get Daily progress calculator with injected repositories.
    
    Provides a DailyProgressCalculator instance for calculating daily
    workload-based progress for habits. The service receives injected
    repositories for database operations, following the dependency
    injection pattern for testability.
    
    Args:
        habit_repo: HabitRepository for habit operations (injected via Depends).
        activity_repo: ActivityRepository for activity operations (injected via Depends).
        goal_repo: GoalRepository for goal operations (injected via Depends).
        
    Returns:
        DailyProgressCalculator instance with injected repositories.
    """
    from .services.daily_progress_calculator import DailyProgressCalculator
    return DailyProgressCalculator(habit_repo, activity_repo, goal_repo)


# =============================================================================
# Future Service Dependencies (to be implemented in Task 5)
# =============================================================================

# Task 5.1 (HabitCompletionReporter) is complete - now uses repositories.
# Task 5.2 (DailyProgressCalculator) is complete - now uses repositories.
# Task 5.3 (WeeklyReportGenerator) is complete - now uses repositories.
# Task 5.4 (FollowUpAgent) is complete - now uses repositories.


def get_weekly_report_generator(
    slack_repo: SlackRepository = Depends(get_slack_repository),
    habit_repo: HabitRepository = Depends(get_habit_repository),
    activity_repo: ActivityRepository = Depends(get_activity_repository),
) -> "WeeklyReportGenerator":
    """
    Get Weekly report generator with injected repositories.
    
    Provides a WeeklyReportGenerator instance for generating and sending
    weekly habit reports via Slack. The service receives injected
    repositories for database operations, following the dependency
    injection pattern for testability.
    
    Args:
        slack_repo: SlackRepository for Slack-related operations (injected via Depends).
        habit_repo: HabitRepository for habit operations (injected via Depends).
        activity_repo: ActivityRepository for activity operations (injected via Depends).
        
    Returns:
        WeeklyReportGenerator instance with injected repositories.
    """
    from .services.weekly_report_generator import WeeklyReportGenerator
    return WeeklyReportGenerator(slack_repo, habit_repo, activity_repo)


def get_follow_up_agent(
    slack_repo: SlackRepository = Depends(get_slack_repository),
    habit_repo: HabitRepository = Depends(get_habit_repository),
    activity_repo: ActivityRepository = Depends(get_activity_repository),
) -> "FollowUpAgent":
    """
    Get Follow-up agent with injected repositories.
    
    Provides a FollowUpAgent instance for managing habit reminders and
    follow-up messages via Slack. The service receives injected
    repositories for database operations, following the dependency
    injection pattern for testability.
    
    Args:
        slack_repo: SlackRepository for Slack-related operations (injected via Depends).
        habit_repo: HabitRepository for habit operations (injected via Depends).
        activity_repo: ActivityRepository for activity operations (injected via Depends).
        
    Returns:
        FollowUpAgent instance with injected repositories.
    """
    from .services.follow_up_agent import FollowUpAgent
    return FollowUpAgent(slack_repo, habit_repo, activity_repo)
