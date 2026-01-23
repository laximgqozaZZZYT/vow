/**
 * Habit Completion Reporter
 *
 * Service for processing habit completions from Slack interactions.
 *
 * This service handles habit completion logic and streak calculation,
 * delegating all database operations to injected repositories.
 *
 * Requirements:
 * - 8.1: Complete habit by ID
 * - 8.2: Calculate current streak for a habit
 * - 8.3: Detect duplicate completions
 * - 8.4: Get JST day boundaries
 * - 8.5: Get incomplete habits today
 * - 8.6: Get all habits with status
 *
 * Properties:
 * - Property 9: Streak Calculation - For any habit with activities, the streak should equal
 *   the count of consecutive days (ending today or yesterday) with at least one completion activity.
 * - Property 10: Duplicate Completion Detection - For any habit that has been completed today,
 *   attempting to complete it again should return already_completed=true without creating a new activity.
 */
import type { HabitRepository } from '../repositories/habitRepository';
import type { ActivityRepository } from '../repositories/activityRepository';
import type { GoalRepository } from '../repositories/goalRepository';
import type { Habit, Activity } from '../schemas/habit';
/**
 * Result of a habit completion operation.
 */
export interface HabitCompletionResult {
    habit: Habit;
    streak: number;
    activity?: Activity;
    already_completed?: boolean;
}
/**
 * Result of a habit completion attempt.
 */
export type CompletionResult = [boolean, string, HabitCompletionResult | null];
/**
 * Habit with completion status and streak.
 */
export interface HabitWithStatus extends Habit {
    completed: boolean;
    streak: number;
    goal_name?: string | null;
}
/**
 * Habit with suggestions for similar habits.
 */
export interface HabitSuggestions {
    suggestions: string[];
}
/**
 * Today's habit summary.
 */
export interface TodaySummary {
    completed: number;
    total: number;
    completion_rate: number;
    habits: HabitWithStatus[];
}
/**
 * Result of an increment operation.
 */
export interface IncrementResult {
    habit: Habit;
    streak: number;
    activity: Activity;
    amount: number;
}
/**
 * Service for handling habit completions via Slack.
 *
 * This service is responsible for:
 * - Completing habits by name or ID
 * - Calculating habit streaks
 * - Tracking daily completion status
 * - Generating habit summaries
 *
 * All database operations are delegated to injected repositories,
 * following the dependency injection pattern for testability.
 */
export declare class HabitCompletionReporter {
    private readonly habitRepo;
    private readonly activityRepo;
    private readonly goalRepo;
    /**
     * Initialize the HabitCompletionReporter with injected repositories.
     *
     * @param habitRepo - Repository for habit database operations.
     * @param activityRepo - Repository for activity database operations.
     * @param goalRepo - Repository for goal database operations.
     */
    constructor(habitRepo: HabitRepository, activityRepo: ActivityRepository, goalRepo: GoalRepository);
    /**
     * Find and complete a habit by name.
     *
     * Searches for a habit by name (case-insensitive) and completes it if found.
     * If no exact match is found, attempts a partial match. If still not found,
     * returns suggestions for similar habit names.
     *
     * @param ownerId - User ID.
     * @param habitName - Name of the habit to complete.
     * @param source - Source of completion (default: "slack").
     * @param ownerType - Type of owner (default: "user").
     * @returns Tuple of [success, message, habitData].
     */
    completeHabitByName(ownerId: string, habitName: string, source?: string, ownerType?: string): Promise<[boolean, string, HabitCompletionResult | HabitSuggestions | null]>;
    /**
     * Complete a habit by ID.
     *
     * Creates a completion activity for the specified habit if it hasn't
     * already been completed today. Returns the habit details and current streak.
     *
     * **Property 10: Duplicate Completion Detection**
     * For any habit that has been completed today, attempting to complete it again
     * should return already_completed=true without creating a new activity.
     *
     * @param ownerId - User ID.
     * @param habitId - ID of the habit to complete.
     * @param source - Source of completion (default: "slack").
     * @param ownerType - Type of owner (default: "user").
     * @returns Tuple of [success, message, habitData].
     */
    completeHabitById(ownerId: string, habitId: string, _source?: string, ownerType?: string): Promise<CompletionResult>;
    /**
     * Get list of habits not yet completed today.
     *
     * Returns all active habits for the owner that have not been completed
     * today, along with their current streak counts.
     *
     * @param ownerId - User ID.
     * @param ownerType - Type of owner.
     * @returns List of incomplete habit objects with completion status and streak.
     */
    getIncompleteHabitsToday(ownerId: string, ownerType?: string): Promise<HabitWithStatus[]>;
    /**
     * Get all habits with their completion status for today.
     *
     * Returns all active habits for the owner with their completion status,
     * streak count, and associated goal name.
     *
     * @param ownerId - User ID.
     * @param ownerType - Type of owner.
     * @returns List of habit objects with completion status, streak, and goal name.
     */
    getAllHabitsWithStatus(ownerId: string, ownerType?: string): Promise<HabitWithStatus[]>;
    /**
     * Calculate current streak count for a habit.
     *
     * Calculates the number of consecutive days the habit has been completed,
     * ending today or yesterday. Uses the activity repository to fetch
     * completion history.
     *
     * **Property 9: Streak Calculation**
     * For any habit with activities, the streak should equal the count of consecutive
     * days (ending today or yesterday) with at least one completion activity.
     *
     * Applies retry logic for transient connection errors.
     *
     * @param habitId - ID of the habit.
     * @param ownerType - Type of owner.
     * @param ownerId - User ID (optional, for filtering).
     * @returns Current streak count (0 if no completions).
     */
    getHabitStreak(habitId: string, _ownerType?: string, _ownerId?: string): Promise<number>;
    /**
     * Get summary of today's habit completion.
     *
     * Returns a summary including the number of completed habits,
     * total habits, completion rate, and detailed habit list.
     *
     * @param ownerId - User ID.
     * @param ownerType - Type of owner.
     * @returns Summary object with completed, total, completion_rate, and habits list.
     */
    getTodaySummary(ownerId: string, ownerType?: string): Promise<TodaySummary>;
    /**
     * Increment habit progress by the specified amount.
     *
     * Creates an activity record with the specified amount (or the habit's
     * workloadPerCount if not specified) and source.
     *
     * @param ownerId - User ID.
     * @param habitId - ID of the habit.
     * @param amount - Amount to add (defaults to workloadPerCount).
     * @param source - Source of the increment (default: "slack").
     * @param ownerType - Type of owner (default: "user").
     * @returns Tuple of [success, message, resultData].
     */
    incrementHabitProgress(ownerId: string, habitId: string, amount?: number, _source?: string, ownerType?: string): Promise<[boolean, string, IncrementResult | null]>;
    /**
     * Get JST day start and end times.
     *
     * Returns the start (00:00:00) and end (23:59:59) times for the current
     * day in Japan Standard Time.
     *
     * @returns Tuple of [startDatetime, endDatetime] in JST.
     */
    getJstDayBoundaries(): [Date, Date];
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
     * Find habits with similar names.
     *
     * Uses sequence matching to find habits with names similar to the
     * provided name, useful for providing suggestions when a habit is not found.
     *
     * @param name - The name to search for.
     * @param habits - List of habit objects to search.
     * @param threshold - Minimum similarity ratio (0.0 to 1.0). Defaults to 0.6.
     * @returns List of similar habit names (up to 3 suggestions).
     */
    private findSimilarHabits;
    /**
     * Calculate similarity ratio between two strings.
     *
     * Uses a simple Levenshtein-based similarity calculation.
     *
     * @param str1 - First string.
     * @param str2 - Second string.
     * @returns Similarity ratio between 0 and 1.
     */
    private calculateSimilarity;
    /**
     * Calculate Levenshtein distance between two strings.
     *
     * @param str1 - First string.
     * @param str2 - Second string.
     * @returns Edit distance between the strings.
     */
    private levenshteinDistance;
}
//# sourceMappingURL=habitCompletionReporter.d.ts.map