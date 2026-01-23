/**
 * Daily Progress Calculator
 *
 * Service for calculating daily workload-based progress for habits.
 *
 * This service handles progress calculation logic, delegating all database
 * operations to injected repositories.
 *
 * Requirements:
 * - 7.1: Calculate progress based on activities within JST 0:00-23:59 of the current day
 * - 7.2: Sum the amount field from activities with kind="complete"
 * - 7.3: Use workload_per_count as default when amount is null
 * - 7.4: Return progress data including habitId, habitName, currentCount, totalCount, etc.
 * - 7.5: Exclude inactive habits from progress calculation
 * - 7.6: Exclude habits with type="avoid" from progress display
 * - 7.7: Sort results by goal name
 *
 * Properties:
 * - Property 7: Daily Progress Calculation - Time Boundaries
 *   For any set of activities, only activities with timestamps within JST 0:00:00 to
 *   JST 23:59:59 of the current day should be included in the progress calculation.
 *
 * - Property 8: Daily Progress Calculation - Amount Summation
 *   For any habit with activities, the currentCount should equal the sum of amount
 *   fields from activities with kind="complete". When amount is null, workload_per_count
 *   should be used as the default.
 */
import type { HabitRepository } from '../repositories/habitRepository.js';
import type { ActivityRepository } from '../repositories/activityRepository.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
/**
 * Progress data for a single habit.
 */
export interface HabitProgress {
    /** Unique identifier for the habit */
    habitId: string;
    /** Display name of the habit */
    habitName: string;
    /** Name of the associated goal */
    goalName: string;
    /** Sum of today's activity amounts */
    currentCount: number;
    /** Target count (workloadTotal or must field) */
    totalCount: number;
    /** Percentage of progress (currentCount / totalCount) * 100 */
    progressRate: number;
    /** Unit of measurement (e.g., "回", "分", "ページ") */
    workloadUnit: string | null;
    /** Amount added per increment (default: 1) */
    workloadPerCount: number;
    /** Current streak count in days */
    streak: number;
    /** True if progressRate >= 100 */
    completed: boolean;
}
/**
 * Summary statistics for the dashboard.
 */
export interface DashboardSummary {
    /** Total number of active habits */
    totalHabits: number;
    /** Number of habits with progressRate >= 100 */
    completedHabits: number;
    /** Percentage of completed habits */
    completionRate: number;
    /** Formatted date string (e.g., "2026年1月20日（月）") */
    dateDisplay: string;
}
/**
 * Service for calculating daily workload progress.
 *
 * This service calculates workload-based progress for habits based on
 * activities within JST 0:00-23:59 of the current day.
 *
 * All database operations are delegated to injected repositories,
 * following the dependency injection pattern for testability.
 */
export declare class DailyProgressCalculator {
    private readonly habitRepo;
    private readonly activityRepo;
    private readonly goalRepo;
    /**
     * Initialize the DailyProgressCalculator with injected repositories.
     *
     * @param habitRepo - Repository for habit database operations.
     * @param activityRepo - Repository for activity database operations.
     * @param goalRepo - Repository for goal database operations.
     */
    constructor(habitRepo: HabitRepository, activityRepo: ActivityRepository, goalRepo: GoalRepository);
    /**
     * Get the start and end datetime boundaries for the current JST day.
     *
     * Returns UTC timestamps that correspond to JST 0:00:00 and JST 23:59:59
     * of the current day. These timestamps can be used for database queries
     * to filter activities within the JST day.
     *
     * **Property 7: Daily Progress Calculation - Time Boundaries**
     * For any set of activities, only activities with timestamps within JST 0:00:00
     * to JST 23:59:59 of the current day should be included in the progress calculation.
     *
     * @returns Tuple of [startUtc, endUtc] Date objects representing
     *          JST 0:00:00 and JST 23:59:59 in UTC
     */
    getJstDayBoundaries(): [Date, Date];
    /**
     * Get activities within JST 0:00-23:59 today.
     *
     * Uses the ActivityRepository to query completion activities within
     * the current JST day boundaries.
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (e.g., "user")
     * @returns List of activity records with kind="complete" within JST day boundaries
     */
    private getTodayActivities;
    /**
     * Sum workload from activities for a habit.
     *
     * Filters activities by habitId and sums the amount field from each
     * matching activity. If an activity has no amount field (null/undefined),
     * uses workloadPerCount as the default amount.
     *
     * **Property 8: Daily Progress Calculation - Amount Summation**
     * For any habit with activities, the currentCount should equal the sum of
     * amount fields from activities with kind="complete". When amount is null,
     * workload_per_count should be used as the default.
     *
     * @param habitId - ID of the habit to calculate workload for
     * @param activities - List of activity records (already filtered by kind="complete")
     * @param workloadPerCount - Default amount to use when activity has no amount field
     * @returns Total workload sum for the habit
     */
    private calculateWorkload;
    /**
     * Get the name of a goal by ID using the repository.
     *
     * @param goalId - ID of the goal (may be null/undefined)
     * @returns Goal name or "No Goal" if not found
     */
    private getGoalName;
    /**
     * Calculate current streak count for a habit.
     *
     * Calculates the number of consecutive days the habit has been completed,
     * ending today or yesterday.
     *
     * @param habitId - ID of the habit.
     * @param ownerType - Type of owner.
     * @param ownerId - User ID.
     * @returns Current streak count (0 if no completions).
     */
    private getHabitStreak;
    /**
     * Get today's date (date only, no time).
     *
     * @returns Today's date at midnight.
     */
    private getToday;
    /**
     * Subtract days from a date.
     *
     * @param date - The date to subtract from.
     * @param days - Number of days to subtract.
     * @returns New date with days subtracted.
     */
    private subtractDays;
    /**
     * Check if two dates are the same (ignoring time).
     *
     * @param date1 - First date.
     * @param date2 - Second date.
     * @returns True if dates are the same day.
     */
    private isSameDate;
    /**
     * Calculate daily progress for all active habits.
     *
     * Queries active habits with type="do" for the given owner, calculates
     * progress for each habit based on today's activities, and returns
     * sorted results by goal name.
     *
     * Requirements:
     * - 7.4: Return progress data including habitId, habitName, currentCount, etc.
     * - 7.5: Exclude inactive habits from progress calculation
     * - 7.6: Exclude habits with type="avoid" from progress display
     * - 7.7: Sort results by goal name
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns List of HabitProgress objects sorted by goalName
     */
    getDailyProgress(ownerId: string, ownerType?: string): Promise<HabitProgress[]>;
    /**
     * Calculate progress for a specific habit.
     *
     * @param ownerId - User ID
     * @param habitId - ID of the habit
     * @param ownerType - Type of owner (default: "user")
     * @returns HabitProgress object or null if habit not found
     */
    getHabitProgress(ownerId: string, habitId: string, ownerType?: string): Promise<HabitProgress | null>;
    /**
     * Get dashboard summary for the current day.
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns DashboardSummary object
     */
    getDashboardSummary(ownerId: string, ownerType?: string): Promise<DashboardSummary>;
    /**
     * Format the current JST date for display.
     *
     * @returns Formatted date string (e.g., "2026年1月20日（月）")
     */
    private formatJstDateDisplay;
}
//# sourceMappingURL=dailyProgressCalculator.d.ts.map