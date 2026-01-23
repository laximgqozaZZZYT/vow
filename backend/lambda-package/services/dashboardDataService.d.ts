/**
 * Dashboard Data Service
 *
 * Platform-independent service for fetching and calculating dashboard data.
 * This service can be used by various integrations (Slack, LINE, Discord, etc.)
 * without modification.
 *
 * Requirements:
 * - 1.1: Create DashboardDataService in backend/src/services/dashboardDataService.ts
 * - 1.2: Use dependency injection for repositories
 * - 1.3: Return data in platform-agnostic JSON format
 * - 1.4: Use JST timezone for all date calculations
 * - 1.5: Reuse existing repository patterns
 *
 * Properties:
 * - Property 1: JST Day Boundary Calculation
 * - Property 2: Daily Progress Filtering
 * - Property 3: Daily Progress Schema Completeness
 * - Property 4: Daily Progress Sorting
 * - Property 5: Achievement Rate Calculation
 * - Property 6: Statistics TOP3 Selection
 * - Property 7: Next Habits Time Window Filtering
 * - Property 8: Next Habits Exclusion Rules
 * - Property 9: Next Habits Sorting and Limit
 * - Property 10: Stickies Schema and Ordering
 */
import type { HabitRepository } from '../repositories/habitRepository.js';
import type { ActivityRepository } from '../repositories/activityRepository.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import type { StickyRepository } from '../repositories/stickyRepository.js';
import type { DailyProgressData, StatisticsData, NextHabitsData, StickiesData } from '../schemas/dashboard.js';
/**
 * Platform-independent service for dashboard data.
 *
 * This service provides methods to fetch and calculate dashboard data
 * for habits, statistics, upcoming habits, and stickies. All methods
 * return platform-agnostic data structures that can be formatted
 * by integration-specific formatters (e.g., SlackBlockBuilder).
 */
export declare class DashboardDataService {
    private readonly habitRepo;
    private readonly activityRepo;
    private readonly goalRepo;
    private readonly stickyRepo;
    /**
     * Initialize the DashboardDataService with injected repositories.
     *
     * @param habitRepo - Repository for habit database operations.
     * @param activityRepo - Repository for activity database operations.
     * @param goalRepo - Repository for goal database operations.
     * @param stickyRepo - Repository for sticky database operations.
     */
    constructor(habitRepo: HabitRepository, activityRepo: ActivityRepository, goalRepo: GoalRepository, stickyRepo: StickyRepository);
    /**
     * Get the start and end datetime boundaries for the current JST day.
     *
     * Returns UTC timestamps that correspond to JST 0:00:00 and JST 23:59:59
     * of the current day.
     *
     * **Property 1: JST Day Boundary Calculation**
     *
     * @returns Tuple of [startUtc, endUtc] Date objects
     */
    getJstDayBoundaries(): [Date, Date];
    /**
     * Format the current JST date for display.
     *
     * @returns Formatted date string (e.g., "2026年1月20日（月）")
     */
    formatJstDateDisplay(): string;
    /**
     * Get the current JST date in YYYY-MM-DD format.
     *
     * @returns Date string in YYYY-MM-DD format
     */
    private getJstDateString;
    /**
     * Get the name of a goal by ID.
     *
     * @param goalId - ID of the goal (may be null/undefined)
     * @returns Goal name or "No Goal" if not found
     */
    private getGoalName;
    /**
     * Calculate current streak count for a habit.
     *
     * @param habitId - ID of the habit.
     * @returns Current streak count (0 if no completions).
     */
    private getHabitStreak;
    private getToday;
    private subtractDays;
    private isSameDate;
    /**
     * Check if a habit has reached its cumulative workload end.
     *
     * @param habit - The habit to check.
     * @param activities - All activities for the owner.
     * @returns True if the habit is cumulatively completed.
     */
    private isHabitCumulativelyCompleted;
    /**
     * Calculate workload from activities for a habit.
     *
     * @param habitId - ID of the habit.
     * @param activities - List of activities.
     * @param workloadPerCount - Default amount when activity has no amount.
     * @returns Total workload sum.
     */
    private calculateWorkload;
    /**
     * Get daily progress for all active habits.
     *
     * Requirements:
     * - 2.1: Return daily progress for all active habits with type="do"
     * - 2.2-2.4: Include all required fields
     * - 2.5: Exclude inactive habits and type="avoid"
     * - 2.6: Sort by goal name
     * - 2.7: Only include activities within JST day boundaries
     *
     * **Property 2: Daily Progress Filtering**
     * **Property 3: Daily Progress Schema Completeness**
     * **Property 4: Daily Progress Sorting**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns DailyProgressData object
     */
    getDailyProgress(ownerId: string, ownerType?: string): Promise<DailyProgressData>;
    /**
     * Get statistics summary.
     *
     * Requirements:
     * - 3.1: Return statistics summary
     * - 3.2: Include total active habits count
     * - 3.3: Include today's achievement rate
     * - 3.4: Include cumulative achievement rate
     * - 3.5: Include TOP3 habits by progress rate
     * - 3.6: Use JST timezone boundaries
     *
     * **Property 5: Achievement Rate Calculation**
     * **Property 6: Statistics TOP3 Selection**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns StatisticsData object
     */
    getStatistics(ownerId: string, ownerType?: string): Promise<StatisticsData>;
    /**
     * Get habits starting in the next 24 hours.
     *
     * Requirements:
     * - 4.1: Return habits starting in the next 24 hours
     * - 4.2-4.3: Include all required fields
     * - 4.4: Exclude completed habits and type="avoid"
     * - 4.5: Exclude cumulatively completed habits
     * - 4.6: Sort by start time ascending
     * - 4.7: Limit to 10 items
     *
     * **Property 7: Next Habits Time Window Filtering**
     * **Property 8: Next Habits Exclusion Rules**
     * **Property 9: Next Habits Sorting and Limit**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns NextHabitsData object
     */
    getNextHabits(ownerId: string, ownerType?: string): Promise<NextHabitsData>;
    /**
     * Get stickies for an owner.
     *
     * Requirements:
     * - 5.1: Return sticky notes
     * - 5.2: Include name and completion status
     * - 5.3: Include description if available
     * - 5.4: Sort by display order
     *
     * **Property 10: Stickies Schema and Ordering**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns StickiesData object
     */
    getStickies(ownerId: string, ownerType?: string): Promise<StickiesData>;
}
//# sourceMappingURL=dashboardDataService.d.ts.map