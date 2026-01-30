/**
 * Activity Repository
 *
 * Database operations for activities table using the repository pattern.
 *
 * Requirements: 3.5, XP Recovery 1.1
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.js';
import type { Activity } from '../schemas/habit.js';
/**
 * Activity with associated habit information.
 * Used for XP recovery calculation to access habit's THLI level and domain codes.
 */
export interface ActivityWithHabit {
    id: string;
    habitId: string;
    habitName: string;
    timestamp: Date;
    amount: number | null;
    habit: {
        id: string;
        name: string;
        thliLevel: number | null;
        domainCodes: string[];
    };
}
/**
 * Options for retrieving completed activities.
 */
export interface GetCompletedActivitiesOptions {
    limit?: number;
    offset?: number;
    excludeActivityIds?: string[];
}
/**
 * Repository for activity database operations.
 *
 * This repository encapsulates all database operations for the activities table,
 * providing methods for querying activities by time range, habit, and completion status.
 */
export declare class ActivityRepository extends BaseRepository<Activity> {
    /**
     * Initialize the ActivityRepository.
     *
     * @param supabase - The Supabase client instance.
     */
    constructor(supabase: SupabaseClient);
    /**
     * Get activities within a time range.
     *
     * Retrieves all activities for the specified owner within the given time range,
     * filtered by activity kind. This is commonly used for daily progress tracking
     * and report generation.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param start - The start datetime of the range (inclusive).
     * @param end - The end datetime of the range (inclusive).
     * @param kind - The type of activity to filter by. Defaults to "complete".
     * @returns List of activity objects matching the criteria. Returns an empty list if no activities are found.
     */
    getActivitiesInRange(ownerType: string, ownerId: string, start: Date, end: Date, kind?: 'complete' | 'skip' | 'partial'): Promise<Activity[]>;
    /**
     * Get activities for a specific habit.
     *
     * Retrieves activities for a specific habit, ordered by timestamp descending.
     * This is commonly used for streak calculation and habit history display.
     *
     * @param habitId - The unique identifier of the habit.
     * @param kind - The type of activity to filter by. Defaults to "complete".
     * @param limit - Maximum number of activities to return. Defaults to 365.
     * @returns List of activity objects for the habit, ordered by timestamp descending. Returns an empty list if no activities are found.
     */
    getHabitActivities(habitId: string, kind?: 'complete' | 'skip' | 'partial', limit?: number): Promise<Activity[]>;
    /**
     * Check if habit was completed today.
     *
     * Checks whether there is at least one completion activity for the specified
     * habit within the given time range. This is used to prevent duplicate
     * completions and to determine habit status for the current day.
     *
     * @param habitId - The unique identifier of the habit.
     * @param start - The start datetime of the day (typically JST 00:00:00).
     * @param end - The end datetime of the day (typically JST 23:59:59).
     * @returns True if the habit has at least one completion activity in the range, false otherwise.
     */
    hasCompletionToday(habitId: string, start: Date, end: Date): Promise<boolean>;
    /**
     * Check if habit was completed on a specific date.
     *
     * Checks whether there is at least one completion activity for the specified
     * habit on the given date. This uses the 'date' field in the activities table
     * rather than timestamp range.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param habitId - The unique identifier of the habit.
     * @param checkDate - The date to check for completion (YYYY-MM-DD format string).
     * @returns True if the habit has at least one completion activity on the date, false otherwise.
     */
    hasCompletionOnDate(ownerType: string, ownerId: string, habitId: string, checkDate: string): Promise<boolean>;
    /**
     * Get activities for an owner within a time range, grouped by habit.
     *
     * Retrieves all activities for the specified owner within the given time range.
     * This is useful for generating reports and calculating progress across multiple habits.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param start - The start datetime of the range (inclusive).
     * @param end - The end datetime of the range (inclusive).
     * @returns List of activity objects matching the criteria. Returns an empty list if no activities are found.
     */
    getActivitiesByOwnerInRange(ownerType: string, ownerId: string, start: Date, end: Date): Promise<Activity[]>;
    /**
     * Get the most recent activity for a habit.
     *
     * Retrieves the most recent activity for the specified habit.
     * This is useful for displaying the last completion time.
     *
     * @param habitId - The unique identifier of the habit.
     * @param kind - The type of activity to filter by. Defaults to "complete".
     * @returns The most recent activity if found, null otherwise.
     */
    getLatestActivity(habitId: string, kind?: 'complete' | 'skip' | 'partial'): Promise<Activity | null>;
    /**
     * Count activities for a habit within a time range.
     *
     * Counts the number of activities for the specified habit within the given time range.
     * This is useful for calculating completion rates and progress.
     *
     * @param habitId - The unique identifier of the habit.
     * @param start - The start datetime of the range (inclusive).
     * @param end - The end datetime of the range (inclusive).
     * @param kind - The type of activity to filter by. Defaults to "complete".
     * @returns The count of activities matching the criteria.
     */
    countActivitiesInRange(habitId: string, start: Date, end: Date, kind?: 'complete' | 'skip' | 'partial'): Promise<number>;
    /**
     * Sum the amount of activities for a habit within a time range.
     *
     * Calculates the total amount (workload) of activities for the specified habit
     * within the given time range. This is used for progress calculation.
     *
     * @param habitId - The unique identifier of the habit.
     * @param start - The start datetime of the range (inclusive).
     * @param end - The end datetime of the range (inclusive).
     * @param kind - The type of activity to filter by. Defaults to "complete".
     * @returns The sum of amounts for activities matching the criteria.
     */
    sumAmountInRange(habitId: string, start: Date, end: Date, kind?: 'complete' | 'skip' | 'partial'): Promise<number>;
    /**
     * Get completed activities for a user with associated habit information.
     *
     * Retrieves all activities with kind='complete' for the specified user,
     * including the associated habit's THLI level and domain codes.
     * This is used for XP recovery calculation.
     *
     * Note: Since there's no foreign key constraint between activities and habits,
     * we query them separately and join in application code.
     *
     * @param userId - The unique identifier of the user.
     * @param options - Optional parameters for pagination and filtering.
     * @param options.limit - Maximum number of activities to return.
     * @param options.offset - Number of activities to skip for pagination.
     * @param options.excludeActivityIds - Activity IDs to exclude from results.
     * @returns List of activities with habit information. Returns an empty list if no activities are found.
     *
     * Requirements: XP Recovery 1.1 - activitiesテーブルからkind='complete'のレコードを全て取得する
     */
    getCompletedActivities(userId: string, options?: GetCompletedActivitiesOptions): Promise<ActivityWithHabit[]>;
    /**
     * Count completed activities for a user.
     *
     * Counts the total number of activities with kind='complete' for the specified user.
     * This is used to determine batch processing requirements for XP recovery.
     *
     * @param userId - The unique identifier of the user.
     * @returns The count of completed activities.
     *
     * Requirements: XP Recovery 1.1
     */
    countCompletedActivities(userId: string): Promise<number>;
}
//# sourceMappingURL=activityRepository.d.ts.map