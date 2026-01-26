/**
 * Habit Status Utility Functions
 * 
 * Utilities for determining habit status based on today's activities
 * and grouping habits by their status for the Kanban board display.
 * 
 * @module habitStatusUtils
 */

import type { Habit, Activity, Sticky } from '../types';
import { formatLocalDate } from './dateUtils';

/**
 * Habit status types for Kanban board columns
 * - planned: No activity today, or paused
 * - in_progress: Started but not completed
 * - completed_daily: Daily workload target achieved today
 * - completed: Fully completed (cumulative workload >= workloadTotalEnd)
 * - stickies: Sticky notes (separate column)
 */
export type HabitStatus = 'planned' | 'in_progress' | 'completed_daily' | 'completed' | 'stickies';

/**
 * Get today's date in YYYY-MM-DD format using local timezone
 * 
 * @returns Today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Filter activities to get only today's activities for a specific habit
 * 
 * @param habitId - The habit ID to filter activities for
 * @param activities - All activities to filter from
 * @param todayStr - Today's date string in YYYY-MM-DD format
 * @returns Array of today's activities for the specified habit
 */
export function getTodayActivitiesForHabit(
  habitId: string,
  activities: Activity[],
  todayStr: string
): Activity[] {
  return activities.filter(a => 
    a.habitId === habitId && 
    a.timestamp.slice(0, 10) === todayStr
  );
}

/**
 * Calculate today's workload from activities (JST-based)
 * 
 * @param habitId - The habit ID to calculate workload for
 * @param activities - All activities
 * @returns Total workload completed today
 */
export function calculateTodayWorkload(habitId: string, activities: Activity[]): number {
  const today = getTodayDateString();
  const todayActivities = getTodayActivitiesForHabit(habitId, activities, today);
  
  return todayActivities
    .filter(activity => activity.kind === 'complete')
    .reduce((sum, activity) => sum + (activity.amount || 1), 0);
}

/**
 * Check if a habit is fully completed (cumulative workload >= workloadTotalEnd)
 * 
 * @param habit - The habit to check
 * @returns True if the habit is fully completed
 */
export function isHabitFullyCompleted(habit: Habit): boolean {
  // Check workloadTotalEnd first (cumulative completion target)
  const workloadTotalEnd = habit.workloadTotalEnd ?? 0;
  if (workloadTotalEnd > 0) {
    const currentCount = habit.count ?? 0;
    return currentCount >= workloadTotalEnd;
  }
  
  // Fallback to completed flag
  return habit.completed === true;
}

/**
 * Check if today's daily workload target is achieved
 * 
 * @param habit - The habit to check
 * @param activities - All activities
 * @returns True if today's workload >= daily target (workloadTotal or must)
 */
export function isDailyTargetAchieved(habit: Habit, activities: Activity[]): boolean {
  const dailyTarget = habit.workloadTotal ?? habit.must ?? 0;
  
  // If no daily target is set, check if there's any complete activity today
  if (dailyTarget <= 0) {
    const today = getTodayDateString();
    const todayActivities = getTodayActivitiesForHabit(habit.id, activities, today);
    return todayActivities.some(a => a.kind === 'complete');
  }
  
  const todayWorkload = calculateTodayWorkload(habit.id, activities);
  return todayWorkload >= dailyTarget;
}

/**
 * Determine the status of a habit based on today's activities
 * 
 * Status determination logic:
 * 1. If habit is fully completed (count >= workloadTotalEnd) → 'completed'
 * 2. If today's workload >= daily target (workloadTotal or must) → 'completed_daily'
 * 3. If there's a 'start' activity today and the last activity is not 'pause' → 'in_progress'
 * 4. Otherwise → 'planned'
 * 
 * Note: Simply pressing the [✓] button does NOT move to completed_daily.
 * The habit only moves to completed_daily when the daily target is actually achieved.
 * 
 * @param habit - The habit to determine status for
 * @param activities - All activities (will be filtered to today's activities)
 * @returns The habit's current status
 * 
 * @example
 * ```typescript
 * const status = getHabitStatus(habit, activities);
 * // Returns: 'planned' | 'in_progress' | 'completed_daily' | 'completed'
 * ```
 * 
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6
 */
export function getHabitStatus(habit: Habit, activities: Activity[]): HabitStatus {
  // Check if habit is fully completed first (cumulative completion)
  if (isHabitFullyCompleted(habit)) {
    return 'completed';
  }
  
  // Check if today's daily target is achieved
  if (isDailyTargetAchieved(habit, activities)) {
    return 'completed_daily';
  }
  
  const today = getTodayDateString();
  const todayActivities = getTodayActivitiesForHabit(habit.id, activities, today);

  // If no activities today, habit is planned
  if (todayActivities.length === 0) {
    return 'planned';
  }

  // Check for start activity
  const hasStart = todayActivities.some(a => a.kind === 'start');
  
  if (hasStart) {
    // Sort activities by timestamp (newest first) to find the last activity
    const sortedActivities = [...todayActivities].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastActivity = sortedActivities[0];
    
    // If the last activity is not 'pause', habit is in progress
    if (lastActivity && lastActivity.kind !== 'pause') {
      return 'in_progress';
    }
  }

  // Default to planned (no start, or started but paused, or partial completion)
  return 'planned';
}

/**
 * Group habits by their status for Kanban board display
 * 
 * @param habits - Array of habits to group
 * @param activities - All activities (used to determine each habit's status)
 * @returns Object with habits grouped by status
 * 
 * @example
 * ```typescript
 * const grouped = groupHabitsByStatus(habits, activities);
 * // Returns: {
 * //   planned: [...],
 * //   in_progress: [...],
 * //   completed_daily: [...],
 * //   completed: [...],
 * //   stickies: []
 * // }
 * ```
 * 
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6
 */
export function groupHabitsByStatus(
  habits: Habit[], 
  activities: Activity[]
): Record<HabitStatus, Habit[]> {
  const result: Record<HabitStatus, Habit[]> = {
    planned: [],
    in_progress: [],
    completed_daily: [],
    completed: [],
    stickies: []
  };

  for (const habit of habits) {
    const status = getHabitStatus(habit, activities);
    result[status].push(habit);
  }

  return result;
}

/**
 * Get the count of habits in each status category
 * 
 * @param habits - Array of habits to count
 * @param activities - All activities (used to determine each habit's status)
 * @returns Object with count of habits in each status
 * 
 * @example
 * ```typescript
 * const counts = getHabitStatusCounts(habits, activities);
 * // Returns: { planned: 5, in_progress: 2, completed_daily: 3, completed: 1, stickies: 0 }
 * ```
 */
export function getHabitStatusCounts(
  habits: Habit[],
  activities: Activity[]
): Record<HabitStatus, number> {
  const grouped = groupHabitsByStatus(habits, activities);
  return {
    planned: grouped.planned.length,
    in_progress: grouped.in_progress.length,
    completed_daily: grouped.completed_daily.length,
    completed: grouped.completed.length,
    stickies: grouped.stickies.length
  };
}

/**
 * Group stickies by completion status
 * 
 * @param stickies - Array of stickies to group
 * @returns Object with stickies grouped by completion status
 */
export function groupStickiesByStatus(
  stickies: Sticky[]
): { pending: Sticky[]; completed: Sticky[] } {
  const pending: Sticky[] = [];
  const completed: Sticky[] = [];
  
  for (const sticky of stickies) {
    if (sticky.completed) {
      completed.push(sticky);
    } else {
      pending.push(sticky);
    }
  }
  
  return { pending, completed };
}
