/**
 * Sticky Reset Utilities
 *
 * Handles resetting reusable Sticky'n items when linked recurring habits
 * enter a new period (daily/weekly/monthly).
 */

import type { Habit, Sticky } from '../types';

/**
 * Check if a habit is a recurring type
 */
export function isRecurringHabit(habit: Habit): boolean {
  if (!habit.repeat) return false;
  const repeatLower = habit.repeat.toLowerCase();
  return ['daily', 'weekly', 'monthly', '毎日', '毎週', '毎月'].some(r =>
    repeatLower.includes(r)
  );
}

/**
 * Get the current period start date for a habit's repeat type
 */
export function getPeriodStart(repeat: string): Date {
  const now = new Date();
  const repeatLower = repeat.toLowerCase();

  if (repeatLower.includes('daily') || repeatLower.includes('毎日')) {
    // Start of today
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (repeatLower.includes('weekly') || repeatLower.includes('毎週')) {
    // Start of this week (Monday)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff);
  }

  if (repeatLower.includes('monthly') || repeatLower.includes('毎月')) {
    // Start of this month
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return now;
}

/**
 * Check if a sticky should be reset based on its completion time and habit period
 */
export function shouldResetSticky(sticky: Sticky, habit: Habit): boolean {
  // Only reset reusable stickies that are completed
  if (!sticky.isReusable || !sticky.completed || !sticky.completedAt) {
    return false;
  }

  // Only for recurring habits
  if (!isRecurringHabit(habit)) {
    return false;
  }

  const completedAt = new Date(sticky.completedAt);
  const periodStart = getPeriodStart(habit.repeat!);

  // If completed before current period started, should reset
  return completedAt < periodStart;
}

/**
 * Get all stickies that need to be reset for a habit
 */
export function getStickiesToReset(
  stickies: Sticky[],
  habit: Habit
): Sticky[] {
  // Get stickies related to this habit
  const relatedStickies = stickies.filter(s =>
    s.habits?.some(h => h.id === habit.id)
  );

  return relatedStickies.filter(s => shouldResetSticky(s, habit));
}
