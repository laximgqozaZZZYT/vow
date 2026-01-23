/**
 * Activity Repository
 *
 * Database operations for activities table using the repository pattern.
 *
 * Requirements: 3.5
 */
import { BaseRepository } from './base.js';
/**
 * Repository for activity database operations.
 *
 * This repository encapsulates all database operations for the activities table,
 * providing methods for querying activities by time range, habit, and completion status.
 */
export class ActivityRepository extends BaseRepository {
    /**
     * Initialize the ActivityRepository.
     *
     * @param supabase - The Supabase client instance.
     */
    constructor(supabase) {
        super(supabase, 'activities');
    }
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
    async getActivitiesInRange(ownerType, ownerId, start, end, kind = 'complete') {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('kind', kind)
            .gte('timestamp', start.toISOString())
            .lte('timestamp', end.toISOString());
        if (error || !data) {
            return [];
        }
        return data;
    }
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
    async getHabitActivities(habitId, kind = 'complete', limit = 365) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('habit_id', habitId)
            .eq('kind', kind)
            .order('timestamp', { ascending: false })
            .limit(limit);
        if (error || !data) {
            return [];
        }
        return data;
    }
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
    async hasCompletionToday(habitId, start, end) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('id')
            .eq('habit_id', habitId)
            .eq('kind', 'complete')
            .gte('timestamp', start.toISOString())
            .lte('timestamp', end.toISOString())
            .limit(1);
        if (error) {
            return false;
        }
        return Array.isArray(data) && data.length > 0;
    }
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
    async hasCompletionOnDate(ownerType, ownerId, habitId, checkDate) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('id')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('habit_id', habitId)
            .eq('date', checkDate)
            .eq('completed', true)
            .limit(1);
        if (error) {
            return false;
        }
        return Array.isArray(data) && data.length > 0;
    }
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
    async getActivitiesByOwnerInRange(ownerType, ownerId, start, end) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .gte('timestamp', start.toISOString())
            .lte('timestamp', end.toISOString())
            .order('timestamp', { ascending: false });
        if (error || !data) {
            return [];
        }
        return data;
    }
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
    async getLatestActivity(habitId, kind = 'complete') {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('habit_id', habitId)
            .eq('kind', kind)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
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
    async countActivitiesInRange(habitId, start, end, kind = 'complete') {
        const { count, error } = await this.supabase
            .from(this.tableName)
            .select('id', { count: 'exact', head: true })
            .eq('habit_id', habitId)
            .eq('kind', kind)
            .gte('timestamp', start.toISOString())
            .lte('timestamp', end.toISOString());
        if (error || count === null) {
            return 0;
        }
        return count;
    }
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
    async sumAmountInRange(habitId, start, end, kind = 'complete') {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('amount')
            .eq('habit_id', habitId)
            .eq('kind', kind)
            .gte('timestamp', start.toISOString())
            .lte('timestamp', end.toISOString());
        if (error || !data) {
            return 0;
        }
        return data.reduce((sum, activity) => sum + (activity.amount ?? 1), 0);
    }
}
//# sourceMappingURL=activityRepository.js.map