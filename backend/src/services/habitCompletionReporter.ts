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

import type { HabitRepository } from '../repositories/habitRepository.js';
import type { ActivityRepository } from '../repositories/activityRepository.js';
import type { GoalRepository } from '../repositories/goalRepository.js';
import type { Habit, Activity } from '../schemas/habit.js';
import { DataFetchError } from '../errors/index.js';
import { withRetry } from '../utils/retry.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('habitCompletionReporter');

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
export class HabitCompletionReporter {
  private readonly habitRepo: HabitRepository;
  private readonly activityRepo: ActivityRepository;
  private readonly goalRepo: GoalRepository;

  /**
   * Initialize the HabitCompletionReporter with injected repositories.
   *
   * @param habitRepo - Repository for habit database operations.
   * @param activityRepo - Repository for activity database operations.
   * @param goalRepo - Repository for goal database operations.
   */
  constructor(
    habitRepo: HabitRepository,
    activityRepo: ActivityRepository,
    goalRepo: GoalRepository
  ) {
    this.habitRepo = habitRepo;
    this.activityRepo = activityRepo;
    this.goalRepo = goalRepo;
  }

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
  async completeHabitByName(
    ownerId: string,
    habitName: string,
    source = 'slack',
    ownerType = 'user'
  ): Promise<[boolean, string, HabitCompletionResult | HabitSuggestions | null]> {
    try {
      // Find habit by name (case-insensitive)
      const habits = await this.habitRepo.getByOwner(ownerType, ownerId);

      // Try exact match first
      let habit = habits.find(
        (h) => h.name.toLowerCase() === habitName.toLowerCase()
      );

      // Try partial match if no exact match
      if (!habit) {
        habit = habits.find((h) =>
          h.name.toLowerCase().includes(habitName.toLowerCase())
        );
      }

      if (!habit) {
        // Find similar habits for suggestions
        const similar = this.findSimilarHabits(habitName, habits);
        if (similar.length > 0) {
          return [false, `Habit '${habitName}' not found`, { suggestions: similar }];
        }
        return [false, `Habit '${habitName}' not found`, null];
      }

      return await this.completeHabitById(ownerId, habit.id, source, ownerType);
    } catch (error) {
      if (error instanceof DataFetchError) {
        throw error;
      }
      throw new DataFetchError(
        `Failed to complete habit by name: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

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
  async completeHabitById(
    ownerId: string,
    habitId: string,
    _source = 'slack',
    ownerType = 'user'
  ): Promise<CompletionResult> {
    try {
      // Get habit details using repository
      const habit = await this.habitRepo.getById(habitId);
      if (!habit) {
        return [false, 'Habit not found', null];
      }

      // Check if already completed today using JST boundaries
      const [start, end] = this.getJstDayBoundaries();
      if (await this.activityRepo.hasCompletionToday(habitId, start, end)) {
        const streak = await this.getHabitStreak(habitId, ownerType, ownerId);
        return [
          false,
          'Already completed today',
          {
            habit,
            streak,
            already_completed: true,
          },
        ];
      }

      // Create activity record using repository
      const activityData = {
        owner_type: ownerType,
        owner_id: ownerId,
        habit_id: habitId,
        habit_name: habit.name ?? '',
        kind: 'complete' as const,
        timestamp: new Date().toISOString(),
        amount: habit.workload_per_count ?? 1,
      };

      const activity = await this.activityRepo.create(activityData);

      // Calculate streak
      const streak = await this.getHabitStreak(habitId, ownerType, ownerId);

      logger.info('Habit completed', {
        habit_id: habitId,
        habit_name: habit.name,
        owner_id: ownerId,
        streak,
      });

      return [
        true,
        'Habit completed',
        {
          habit,
          streak,
          activity,
        },
      ];
    } catch (error) {
      if (error instanceof DataFetchError) {
        throw error;
      }
      throw new DataFetchError(
        `Failed to complete habit: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

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
  async getIncompleteHabitsToday(
    ownerId: string,
    ownerType = 'user'
  ): Promise<HabitWithStatus[]> {
    try {
      const habits = await this.habitRepo.getByOwner(ownerType, ownerId);
      const [start, end] = this.getJstDayBoundaries();

      const incomplete: HabitWithStatus[] = [];
      for (const habit of habits) {
        if (!habit.active) {
          continue;
        }

        const isCompleted = await this.activityRepo.hasCompletionToday(
          habit.id,
          start,
          end
        );

        if (!isCompleted) {
          const streak = await this.getHabitStreak(habit.id, ownerType, ownerId);
          incomplete.push({
            ...habit,
            completed: false,
            streak,
          });
        }
      }

      return incomplete;
    } catch (error) {
      throw new DataFetchError(
        `Failed to get incomplete habits: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

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
  async getAllHabitsWithStatus(
    ownerId: string,
    ownerType = 'user'
  ): Promise<HabitWithStatus[]> {
    try {
      const habits = await this.habitRepo.getByOwner(ownerType, ownerId);
      const [start, end] = this.getJstDayBoundaries();

      const result: HabitWithStatus[] = [];
      for (const habit of habits) {
        if (!habit.active) {
          continue;
        }

        const isCompleted = await this.activityRepo.hasCompletionToday(
          habit.id,
          start,
          end
        );
        const streak = await this.getHabitStreak(habit.id, ownerType, ownerId);

        // Get goal name if available using repository
        let goalName: string | null = null;
        if (habit.goal_id) {
          const goal = await this.goalRepo.getById(habit.goal_id);
          goalName = goal?.name ?? null;
        }

        result.push({
          ...habit,
          completed: isCompleted,
          streak,
          goal_name: goalName ?? 'No Goal',
        });
      }

      return result;
    } catch (error) {
      throw new DataFetchError(
        `Failed to get habits with status: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

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
  async getHabitStreak(
    habitId: string,
    _ownerType = 'user',
    _ownerId?: string
  ): Promise<number> {
    return withRetry(async () => {
      try {
        // Get recent activities for this habit using repository
        const activities = await this.activityRepo.getHabitActivities(
          habitId,
          'complete',
          365
        );

        if (activities.length === 0) {
          return 0;
        }

        // Calculate streak by extracting dates from timestamps
        let streak = 0;
        let expectedDate = this.getToday();
        const seenDates = new Set<string>();

        for (const activity of activities) {
          // Extract date from timestamp (format: 2026-01-11T16:59:28.61+00:00)
          const timestampStr = activity.timestamp;
          const activityDateStr = timestampStr.slice(0, 10);
          const activityDate = new Date(activityDateStr);

          // Skip if we've already counted this date
          if (seenDates.has(activityDateStr)) {
            continue;
          }
          seenDates.add(activityDateStr);

          // Allow for today or yesterday as the start
          if (streak === 0 && this.isSameDate(activityDate, expectedDate)) {
            streak = 1;
            expectedDate = this.subtractDays(expectedDate, 1);
          } else if (
            streak === 0 &&
            this.isSameDate(activityDate, this.subtractDays(expectedDate, 1))
          ) {
            streak = 1;
            expectedDate = this.subtractDays(activityDate, 1);
          } else if (this.isSameDate(activityDate, expectedDate)) {
            streak += 1;
            expectedDate = this.subtractDays(expectedDate, 1);
          } else {
            break;
          }
        }

        return streak;
      } catch (error) {
        throw new DataFetchError(
          `Failed to calculate streak: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
      }
    });
  }

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
  async getTodaySummary(ownerId: string, ownerType = 'user'): Promise<TodaySummary> {
    try {
      const habits = await this.getAllHabitsWithStatus(ownerId, ownerType);

      const completed = habits.filter((h) => h.completed).length;
      const total = habits.length;

      return {
        completed,
        total,
        completion_rate: total > 0 ? (completed / total) * 100 : 0,
        habits,
      };
    } catch (error) {
      throw new DataFetchError(
        `Failed to get today summary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

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
  async incrementHabitProgress(
    ownerId: string,
    habitId: string,
    amount?: number,
    _source = 'slack',
    ownerType = 'user'
  ): Promise<[boolean, string, IncrementResult | null]> {
    try {
      // Get habit by ID using repository
      const habit = await this.habitRepo.getById(habitId);
      if (!habit) {
        return [false, 'Habit not found', null];
      }

      // Get workload_per_count from habit (default to 1 if not set)
      const workloadPerCount = habit.workload_per_count ?? 1;

      // If amount parameter is undefined, use workloadPerCount
      const incrementAmount = amount ?? workloadPerCount;

      // Create activity record with amount using repository
      const activityData = {
        owner_type: ownerType,
        owner_id: ownerId,
        habit_id: habitId,
        habit_name: habit.name ?? '',
        kind: 'complete' as const,
        timestamp: new Date().toISOString(),
        amount: incrementAmount,
      };

      const activity = await this.activityRepo.create(activityData);

      // Calculate new streak
      const streak = await this.getHabitStreak(habitId, ownerType, ownerId);

      logger.info('Habit progress incremented', {
        habit_id: habitId,
        habit_name: habit.name,
        owner_id: ownerId,
        amount: incrementAmount,
        streak,
      });

      return [
        true,
        'Progress updated',
        {
          habit,
          streak,
          activity,
          amount: incrementAmount,
        },
      ];
    } catch (error) {
      throw new DataFetchError(
        `Failed to increment habit progress: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Get JST day start and end times.
   *
   * Returns the start (00:00:00) and end (23:59:59) times for the current
   * day in Japan Standard Time.
   *
   * @returns Tuple of [startDatetime, endDatetime] in JST.
   */
  getJstDayBoundaries(): [Date, Date] {
    // Get current time in JST
    const now = new Date();
    const jstOffset = 9 * 60; // JST is UTC+9
    const utcOffset = now.getTimezoneOffset();
    const jstTime = new Date(now.getTime() + (jstOffset + utcOffset) * 60 * 1000);

    // Create start of day in JST
    const startJst = new Date(jstTime);
    startJst.setHours(0, 0, 0, 0);

    // Create end of day in JST
    const endJst = new Date(jstTime);
    endJst.setHours(23, 59, 59, 999);

    // Convert back to UTC for database queries
    const start = new Date(startJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);
    const end = new Date(endJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);

    return [start, end];
  }

  /**
   * Get today's date (date only, no time).
   *
   * @returns Today's date at midnight.
   */
  private getToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Subtract days from a date.
   *
   * @param date - The date to subtract from.
   * @param days - Number of days to subtract.
   * @returns New date with days subtracted.
   */
  private subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  /**
   * Check if two dates are the same (ignoring time).
   *
   * @param date1 - First date.
   * @param date2 - Second date.
   * @returns True if dates are the same day.
   */
  private isSameDate(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

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
  private findSimilarHabits(
    name: string,
    habits: Habit[],
    threshold = 0.6
  ): string[] {
    const similar: string[] = [];
    const nameLower = name.toLowerCase();

    for (const habit of habits) {
      const habitName = habit.name;
      const ratio = this.calculateSimilarity(nameLower, habitName.toLowerCase());
      if (ratio >= threshold) {
        similar.push(habitName);
      }
    }

    return similar.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Calculate similarity ratio between two strings.
   *
   * Uses a simple Levenshtein-based similarity calculation.
   *
   * @param str1 - First string.
   * @param str2 - Second string.
   * @returns Similarity ratio between 0 and 1.
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings.
   *
   * @param str1 - First string.
   * @param str2 - Second string.
   * @returns Edit distance between the strings.
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create a 2D array with proper initialization
    const matrix: number[][] = Array.from({ length: n + 1 }, () =>
      Array.from({ length: m + 1 }, () => 0)
    );

    // Initialize first column
    for (let i = 0; i <= n; i++) {
      matrix[i]![0] = i;
    }

    // Initialize first row
    for (let j = 0; j <= m; j++) {
      matrix[0]![j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1 // deletion
          );
        }
      }
    }

    return matrix[n]![m]!;
  }
}
