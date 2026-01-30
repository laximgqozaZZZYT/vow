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
export class ActivityRepository extends BaseRepository<Activity> {
  /**
   * Initialize the ActivityRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
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
  async getActivitiesInRange(
    ownerType: string,
    ownerId: string,
    start: Date,
    end: Date,
    kind: 'complete' | 'skip' | 'partial' = 'complete'
  ): Promise<Activity[]> {
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
    return data as Activity[];
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
  async getHabitActivities(
    habitId: string,
    kind: 'complete' | 'skip' | 'partial' = 'complete',
    limit = 365
  ): Promise<Activity[]> {
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
    return data as Activity[];
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
  async hasCompletionToday(habitId: string, start: Date, end: Date): Promise<boolean> {
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
  async hasCompletionOnDate(
    ownerType: string,
    ownerId: string,
    habitId: string,
    checkDate: string
  ): Promise<boolean> {
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
  async getActivitiesByOwnerInRange(
    ownerType: string,
    ownerId: string,
    start: Date,
    end: Date
  ): Promise<Activity[]> {
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
    return data as Activity[];
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
  async getLatestActivity(
    habitId: string,
    kind: 'complete' | 'skip' | 'partial' = 'complete'
  ): Promise<Activity | null> {
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
    return data as Activity;
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
  async countActivitiesInRange(
    habitId: string,
    start: Date,
    end: Date,
    kind: 'complete' | 'skip' | 'partial' = 'complete'
  ): Promise<number> {
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
  async sumAmountInRange(
    habitId: string,
    start: Date,
    end: Date,
    kind: 'complete' | 'skip' | 'partial' = 'complete'
  ): Promise<number> {
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

  // ============================================================================
  // XP Recovery Methods (Requirements: XP Recovery 1.1)
  // ============================================================================

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
  async getCompletedActivities(
    userId: string,
    options?: GetCompletedActivitiesOptions
  ): Promise<ActivityWithHabit[]> {
    const { limit, offset, excludeActivityIds } = options ?? {};

    // Step 1: Query activities (without join since no FK constraint exists)
    let query = this.supabase
      .from(this.tableName)
      .select('id, habit_id, habit_name, timestamp, amount')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('kind', 'complete')
      .order('timestamp', { ascending: true });

    // Apply exclusion filter if provided
    if (excludeActivityIds && excludeActivityIds.length > 0) {
      query = query.not('id', 'in', `(${excludeActivityIds.join(',')})`);
    }

    // Apply pagination
    if (offset !== undefined) {
      query = query.range(offset, offset + (limit ?? 100) - 1);
    } else if (limit !== undefined) {
      query = query.limit(limit);
    }

    const { data: activities, error: activitiesError } = await query;

    if (activitiesError || !activities || activities.length === 0) {
      return [];
    }

    // Step 2: Get unique habit IDs and fetch habit data
    const habitIds = [...new Set(activities.map((a) => a.habit_id as string))];
    
    const { data: habits, error: habitsError } = await this.supabase
      .from('habits')
      .select('id, name, level, domain_codes')
      .in('id', habitIds);

    if (habitsError) {
      // Log error but continue - we can still process activities with default values
      console.error('Failed to fetch habits for XP recovery:', habitsError);
    }

    // Create a map of habit ID to habit data for quick lookup
    const habitMap = new Map<string, { id: string; name: string; level: number | null; domain_codes: string[] }>();
    if (habits) {
      for (const habit of habits) {
        habitMap.set(habit.id as string, {
          id: habit.id as string,
          name: habit.name as string,
          level: habit.level as number | null,
          domain_codes: (habit.domain_codes as string[]) ?? [],
        });
      }
    }

    // Step 3: Transform and join data in application code
    return activities.map((row) => {
      const habitId = row.habit_id as string;
      const habit = habitMap.get(habitId);

      return {
        id: row.id as string,
        habitId,
        habitName: (row.habit_name as string) ?? habit?.name ?? 'Unknown Habit',
        timestamp: new Date(row.timestamp as string),
        amount: row.amount as number | null,
        habit: {
          id: habit?.id ?? habitId,
          name: habit?.name ?? (row.habit_name as string) ?? 'Unknown Habit',
          thliLevel: habit?.level ?? null,
          domainCodes: habit?.domain_codes ?? [],
        },
      };
    });
  }

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
  async countCompletedActivities(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact', head: true })
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('kind', 'complete');

    if (error || count === null) {
      return 0;
    }
    return count;
  }
}
