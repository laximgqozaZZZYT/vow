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
import type { Habit, Activity } from '../schemas/habit.js';
import { DataFetchError } from '../errors/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('dailyProgressCalculator');

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
export class DailyProgressCalculator {
  private readonly habitRepo: HabitRepository;
  private readonly activityRepo: ActivityRepository;
  private readonly goalRepo: GoalRepository;

  /**
   * Initialize the DailyProgressCalculator with injected repositories.
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
  getJstDayBoundaries(): [Date, Date] {
    // Get current time
    const now = new Date();

    // JST is UTC+9
    const jstOffset = 9 * 60; // minutes
    const utcOffset = now.getTimezoneOffset(); // minutes (negative for east of UTC)

    // Calculate current time in JST
    const jstTime = new Date(now.getTime() + (jstOffset + utcOffset) * 60 * 1000);

    // Create JST day boundaries (0:00:00 and 23:59:59)
    const startJst = new Date(jstTime);
    startJst.setHours(0, 0, 0, 0);

    const endJst = new Date(jstTime);
    endJst.setHours(23, 59, 59, 999);

    // Convert back to UTC for database queries
    const startUtc = new Date(startJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);
    const endUtc = new Date(endJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);

    return [startUtc, endUtc];
  }

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
  private async getTodayActivities(
    ownerId: string,
    ownerType: string
  ): Promise<Activity[]> {
    try {
      // Get JST day boundaries in UTC
      const [startUtc, endUtc] = this.getJstDayBoundaries();

      logger.debug('Querying activities', {
        owner_id: ownerId,
        start: startUtc.toISOString(),
        end: endUtc.toISOString(),
      });

      // Use repository to get activities in range
      const activities = await this.activityRepo.getActivitiesInRange(
        ownerType,
        ownerId,
        startUtc,
        endUtc,
        'complete'
      );

      logger.debug('Found activities', {
        owner_id: ownerId,
        count: activities.length,
      });

      return activities;
    } catch (error) {
      throw new DataFetchError(
        `Failed to get today's activities: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

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
  private calculateWorkload(
    habitId: string,
    activities: Activity[],
    workloadPerCount: number
  ): number {
    let totalWorkload = 0;
    let matchingCount = 0;

    for (const activity of activities) {
      // Filter by habit_id
      if (activity.habit_id !== habitId) {
        continue;
      }

      matchingCount++;

      // Get amount from activity, use workloadPerCount as default if null/undefined
      const amount = activity.amount ?? workloadPerCount;
      totalWorkload += amount;
    }

    logger.debug('Workload calculated', {
      habit_id: habitId,
      matching_activities: matchingCount,
      total_workload: totalWorkload,
    });

    return totalWorkload;
  }

  /**
   * Get the name of a goal by ID using the repository.
   *
   * @param goalId - ID of the goal (may be null/undefined)
   * @returns Goal name or "No Goal" if not found
   */
  private async getGoalName(goalId: string | null | undefined): Promise<string> {
    if (!goalId) {
      return 'No Goal';
    }

    try {
      const goal = await this.goalRepo.getById(goalId);
      if (goal) {
        return goal.name ?? 'No Goal';
      }
      return 'No Goal';
    } catch (error) {
      logger.warning('Failed to get goal name', {
        goal_id: goalId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'No Goal';
    }
  }

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
  private async getHabitStreak(
    habitId: string,
    _ownerType: string,
    _ownerId: string
  ): Promise<number> {
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
      logger.warning('Failed to calculate streak', {
        habit_id: habitId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
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
  async getDailyProgress(
    ownerId: string,
    ownerType = 'user'
  ): Promise<HabitProgress[]> {
    try {
      // Query active habits with type="do" using repository (Requirements 7.5, 7.6)
      const habits = await this.habitRepo.getActiveDoHabits(ownerType, ownerId);

      // Get today's activities
      const activities = await this.getTodayActivities(ownerId, ownerType);

      // Build progress list
      const progressList: HabitProgress[] = [];

      for (const habit of habits) {
        const habitId = habit.id;
        const habitName = habit.name;

        // Get goal name using repository (default to "No Goal" if not set)
        const goalName = await this.getGoalName(habit.goal_id);

        // Get workload_per_count (default to 1)
        const workloadPerCount = habit.workload_per_count ?? 1;

        // Calculate current count from today's activities
        const currentCount = this.calculateWorkload(
          habitId,
          activities,
          workloadPerCount
        );

        // Determine total count: use workload_total if set, otherwise fall back to target_count
        // Note: The Python version uses workload_total or must field
        // In TypeScript schema, we have target_count
        const workloadTotal = (habit as Habit & { workload_total?: number }).workload_total;
        const must = (habit as Habit & { must?: number }).must;

        let totalCount: number;
        if (workloadTotal !== undefined && workloadTotal !== null && workloadTotal > 0) {
          totalCount = workloadTotal;
        } else if (must !== undefined && must !== null && must > 0) {
          totalCount = must;
        } else if (habit.target_count && habit.target_count > 0) {
          totalCount = habit.target_count;
        } else {
          // Default to 1 if neither is set
          totalCount = 1;
        }

        // Calculate progress rate
        const progressRate = totalCount > 0 ? (currentCount / totalCount) * 100 : 0;

        // Get workload unit (may be null)
        const workloadUnit = habit.workload_unit ?? null;

        // Get streak count
        const streak = await this.getHabitStreak(habitId, ownerType, ownerId);

        // Determine if completed (progressRate >= 100)
        const completed = progressRate >= 100;

        // Create HabitProgress object
        const progress: HabitProgress = {
          habitId,
          habitName,
          goalName,
          currentCount,
          totalCount,
          progressRate,
          workloadUnit,
          workloadPerCount,
          streak,
          completed,
        };

        progressList.push(progress);
      }

      // Sort by goalName (Requirement 7.7)
      progressList.sort((a, b) => a.goalName.localeCompare(b.goalName));

      return progressList;
    } catch (error) {
      if (error instanceof DataFetchError) {
        throw error;
      }
      throw new DataFetchError(
        `Failed to calculate daily progress: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Calculate progress for a specific habit.
   *
   * @param ownerId - User ID
   * @param habitId - ID of the habit
   * @param ownerType - Type of owner (default: "user")
   * @returns HabitProgress object or null if habit not found
   */
  async getHabitProgress(
    ownerId: string,
    habitId: string,
    ownerType = 'user'
  ): Promise<HabitProgress | null> {
    try {
      // Get habit by ID
      const habit = await this.habitRepo.getById(habitId);
      if (!habit) {
        return null;
      }

      // Get today's activities
      const activities = await this.getTodayActivities(ownerId, ownerType);

      // Get goal name
      const goalName = await this.getGoalName(habit.goal_id);

      // Get workload_per_count (default to 1)
      const workloadPerCount = habit.workload_per_count ?? 1;

      // Calculate current count from today's activities
      const currentCount = this.calculateWorkload(
        habitId,
        activities,
        workloadPerCount
      );

      // Determine total count
      const workloadTotal = (habit as Habit & { workload_total?: number }).workload_total;
      const must = (habit as Habit & { must?: number }).must;

      let totalCount: number;
      if (workloadTotal !== undefined && workloadTotal !== null && workloadTotal > 0) {
        totalCount = workloadTotal;
      } else if (must !== undefined && must !== null && must > 0) {
        totalCount = must;
      } else if (habit.target_count && habit.target_count > 0) {
        totalCount = habit.target_count;
      } else {
        totalCount = 1;
      }

      // Calculate progress rate
      const progressRate = totalCount > 0 ? (currentCount / totalCount) * 100 : 0;

      // Get workload unit
      const workloadUnit = habit.workload_unit ?? null;

      // Get streak count
      const streak = await this.getHabitStreak(habitId, ownerType, ownerId);

      // Determine if completed
      const completed = progressRate >= 100;

      return {
        habitId,
        habitName: habit.name,
        goalName,
        currentCount,
        totalCount,
        progressRate,
        workloadUnit,
        workloadPerCount,
        streak,
        completed,
      };
    } catch (error) {
      if (error instanceof DataFetchError) {
        throw error;
      }
      throw new DataFetchError(
        `Failed to get habit progress: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get dashboard summary for the current day.
   *
   * @param ownerId - User ID
   * @param ownerType - Type of owner (default: "user")
   * @returns DashboardSummary object
   */
  async getDashboardSummary(
    ownerId: string,
    ownerType = 'user'
  ): Promise<DashboardSummary> {
    try {
      // Get daily progress for all habits
      const progressList = await this.getDailyProgress(ownerId, ownerType);

      const totalHabits = progressList.length;
      const completedHabits = progressList.filter((p) => p.completed).length;
      const completionRate = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;

      // Format date display in Japanese
      const dateDisplay = this.formatJstDateDisplay();

      return {
        totalHabits,
        completedHabits,
        completionRate,
        dateDisplay,
      };
    } catch (error) {
      if (error instanceof DataFetchError) {
        throw error;
      }
      throw new DataFetchError(
        `Failed to get dashboard summary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Format the current JST date for display.
   *
   * @returns Formatted date string (e.g., "2026年1月20日（月）")
   */
  private formatJstDateDisplay(): string {
    // Get current time in JST
    const now = new Date();
    const jstOffset = 9 * 60; // minutes
    const utcOffset = now.getTimezoneOffset();
    const jstTime = new Date(now.getTime() + (jstOffset + utcOffset) * 60 * 1000);

    const year = jstTime.getFullYear();
    const month = jstTime.getMonth() + 1;
    const day = jstTime.getDate();

    // Japanese day of week names
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[jstTime.getDay()];

    return `${year}年${month}月${day}日（${dayOfWeek}）`;
  }
}
