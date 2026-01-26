/**
 * Habit Status Utility Functions
 * 
 * Utilities for determining habit status based on today's activities
 * and grouping habits by their status for the Kanban board display.
 * 
 * @module habitStatusUtils
 */

import type { Habit, Activity } from '../types';
import { formatLocalDate } from './dateUtils';

/**
 * Habit status types for Kanban board columns
 * - planned: No activity today, or paused
 * - in_progress: Started but not completed
 * - completed_daily: Completed today
 */
export type HabitStatus = 'planned' | 'in_progress' | 'completed_daily';

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
 * Determine the status of a habit based on today's activities
 * 
 * Status determination logic:
 * 1. If there's a 'complete' activity today → 'completed_daily'
 * 2. If there's a 'start' activity today and the last activity is not 'pause' → 'in_progress'
 * 3. Otherwise → 'planned'
 * 
 * @param habit - The habit to determine status for
 * @param activities - All activities (will be filtered to today's activities)
 * @returns The habit's current status
 * 
 * @example
 * ```typescript
 * const status = getHabitStatus(habit, activities);
 * // Returns: 'planned' | 'in_progress' | 'completed_daily'
 * ```
 * 
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6
 */
export function getHabitStatus(habit: Habit, activities: Activity[]): HabitStatus {
  const today = getTodayDateString();
  const todayActivities = getTodayActivitiesForHabit(habit.id, activities, today);

  // If no activities today, habit is planned
  if (todayActivities.length === 0) {
    return 'planned';
  }

  // Check for complete activity - if exists, habit is completed_daily
  const hasComplete = todayActivities.some(a => a.kind === 'complete');
  if (hasComplete) {
    return 'completed_daily';
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

  // Default to planned (no start, or started but paused)
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
 * //   completed_daily: [...]
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
    completed_daily: []
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
 * // Returns: { planned: 5, in_progress: 2, completed_daily: 3 }
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
    completed_daily: grouped.completed_daily.length
  };
}
