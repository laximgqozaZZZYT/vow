/**
 * useHabitSubtasks Hook
 * 
 * Manages the relationship between Habits and their associated Sticky'n subtasks.
 * Provides utilities for querying subtask counts, completion states, and warning indicators.
 * 
 * @see Requirements 1.1, 5.1, 5.2
 */

import { useMemo, useCallback } from 'react';
import type { Habit, Sticky } from '../types';

/**
 * Options for the useHabitSubtasks hook
 */
export interface UseHabitSubtasksOptions {
  /** Array of habits to process */
  habits: Habit[];
  /** Array of stickies that may be associated with habits */
  stickies: Sticky[];
}

/**
 * Map of habit IDs to their associated subtasks (Sticky'n items)
 */
export interface HabitSubtasksMap {
  [habitId: string]: Sticky[];
}

/**
 * Return type for the useHabitSubtasks hook
 */
export interface UseHabitSubtasksReturn {
  /** Map of habit IDs to their associated subtasks */
  subtasksByHabit: HabitSubtasksMap;
  /** Check if a habit has any subtasks */
  hasSubtasks: (habitId: string) => boolean;
  /** Get the total number of subtasks for a habit */
  getSubtaskCount: (habitId: string) => number;
  /** Get the number of incomplete subtasks for a habit */
  getIncompleteCount: (habitId: string) => number;
  /** Check if a habit needs a warning indicator (has subtasks and all are incomplete) */
  needsWarning: (habitId: string) => boolean;
}

/**
 * Build a map of habit IDs to their associated subtasks.
 * A sticky is considered a subtask of a habit if the habit appears in the sticky's habits array.
 * 
 * @param stickies - Array of stickies to process
 * @returns Map of habit IDs to their subtasks
 */
export function buildSubtasksByHabitMap(stickies: Sticky[]): HabitSubtasksMap {
  // Use Object.create(null) to avoid prototype pollution issues
  // This prevents habit IDs like "constructor", "toString", etc. from conflicting
  // with Object prototype properties
  const map: HabitSubtasksMap = Object.create(null);
  
  for (const sticky of stickies) {
    // Skip stickies without habit relations
    if (!sticky.habits || sticky.habits.length === 0) {
      continue;
    }
    
    // Add this sticky to each related habit's subtask list
    for (const habit of sticky.habits) {
      const habitId = habit.id;
      
      // Use Object.hasOwn for safe property check (works with null-prototype objects)
      if (!Object.hasOwn(map, habitId)) {
        map[habitId] = [];
      }
      
      map[habitId].push(sticky);
    }
  }
  
  return map;
}

/**
 * Custom hook for managing Habit-Sticky subtask relationships.
 * 
 * When a Sticky'n has one or more Related Habits selected, the system treats
 * that Sticky'n as a subtask of each related Habit (Requirement 1.1).
 * 
 * @param options - Configuration options containing habits and stickies
 * @returns Object with subtask map and utility functions
 * 
 * @example
 * ```tsx
 * const { subtasksByHabit, hasSubtasks, needsWarning } = useHabitSubtasks({
 *   habits,
 *   stickies
 * });
 * 
 * // Check if a habit has subtasks
 * if (hasSubtasks(habit.id)) {
 *   // Show expand button
 * }
 * 
 * // Check if warning should be displayed
 * if (needsWarning(habit.id)) {
 *   // Show warning indicator
 * }
 * ```
 */
export function useHabitSubtasks(options: UseHabitSubtasksOptions): UseHabitSubtasksReturn {
  const { stickies } = options;
  
  // Build the subtasks map, memoized to avoid recalculation on every render
  const subtasksByHabit = useMemo(() => {
    return buildSubtasksByHabitMap(stickies);
  }, [stickies]);
  
  /**
   * Check if a habit has any subtasks
   * @param habitId - The habit ID to check
   * @returns true if the habit has at least one subtask
   */
  const hasSubtasks = useCallback((habitId: string): boolean => {
    const subtasks = subtasksByHabit[habitId];
    return subtasks !== undefined && subtasks.length > 0;
  }, [subtasksByHabit]);
  
  /**
   * Get the total number of subtasks for a habit
   * @param habitId - The habit ID to check
   * @returns The number of subtasks (0 if none)
   */
  const getSubtaskCount = useCallback((habitId: string): number => {
    const subtasks = subtasksByHabit[habitId];
    return subtasks ? subtasks.length : 0;
  }, [subtasksByHabit]);
  
  /**
   * Get the number of incomplete subtasks for a habit
   * @param habitId - The habit ID to check
   * @returns The number of incomplete subtasks (0 if none)
   */
  const getIncompleteCount = useCallback((habitId: string): number => {
    const subtasks = subtasksByHabit[habitId];
    if (!subtasks || subtasks.length === 0) {
      return 0;
    }
    
    return subtasks.filter(sticky => !sticky.completed).length;
  }, [subtasksByHabit]);
  
  /**
   * Check if a habit needs a warning indicator.
   * 
   * A warning is needed when:
   * - The habit has one or more associated subtasks
   * - AND at least one subtask is uncompleted
   * 
   * A warning is NOT needed when:
   * - The habit has no subtasks
   * - OR all subtasks are completed
   * 
   * @param habitId - The habit ID to check
   * @returns true if warning indicator should be displayed
   */
  const needsWarning = useCallback((habitId: string): boolean => {
    const subtasks = subtasksByHabit[habitId];
    
    // No warning if no subtasks
    if (!subtasks || subtasks.length === 0) {
      return false;
    }
    
    // Warning if any subtask is incomplete
    const hasIncomplete = subtasks.some(sticky => !sticky.completed);
    return hasIncomplete;
  }, [subtasksByHabit]);
  
  return {
    subtasksByHabit,
    hasSubtasks,
    getSubtaskCount,
    getIncompleteCount,
    needsWarning,
  };
}
