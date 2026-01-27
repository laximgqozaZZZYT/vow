/**
 * useExpandedHabits Hook
 * 
 * Manages the expand/collapse state of Habit cards in the Kanban board.
 * Persists state to LocalStorage so that expand/collapse preferences are
 * remembered across page reloads.
 * 
 * @see Requirements 7.1, 7.2, 7.3
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { debug } from '../../../lib/debug';

/**
 * LocalStorage key for expanded habits state
 */
export const EXPANDED_HABITS_KEY = 'vow-expanded-habits';

/**
 * Format for persisting expanded habits state to LocalStorage
 */
export interface ExpandedHabitsState {
  /** Array of habit IDs that are currently expanded */
  expandedIds: string[];
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Return type for the useExpandedHabits hook
 */
export interface UseExpandedHabitsReturn {
  /** Set of habit IDs that are currently expanded */
  expandedHabits: Set<string>;
  /** Check if a specific habit is expanded */
  isExpanded: (habitId: string) => boolean;
  /** Toggle the expanded state of a habit */
  toggleExpanded: (habitId: string) => void;
  /** Set the expanded state of a habit explicitly */
  setExpanded: (habitId: string, expanded: boolean) => void;
}

/**
 * Check if LocalStorage is available.
 * Handles private browsing mode and other scenarios where LocalStorage may be unavailable.
 * 
 * @returns true if LocalStorage is available and functional
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load expanded habits state from LocalStorage.
 * Returns an empty Set on any error (corrupted data, unavailable storage, etc.)
 * 
 * @returns Set of expanded habit IDs
 */
export function loadExpandedState(): Set<string> {
  if (!isLocalStorageAvailable()) {
    debug.warn('[useExpandedHabits] LocalStorage not available, using default collapsed state');
    return new Set();
  }
  
  try {
    const stored = window.localStorage.getItem(EXPANDED_HABITS_KEY);
    
    // No stored state - return empty set (default collapsed)
    if (!stored) {
      return new Set();
    }
    
    const parsed: unknown = JSON.parse(stored);
    
    // Validate the parsed data structure
    if (!isValidExpandedHabitsState(parsed)) {
      debug.warn('[useExpandedHabits] Invalid expanded state format, using default');
      return new Set();
    }
    
    return new Set(parsed.expandedIds);
  } catch (error) {
    debug.warn('[useExpandedHabits] Failed to load expanded state:', error);
    return new Set();
  }
}

/**
 * Type guard to validate ExpandedHabitsState structure
 * 
 * @param value - Value to validate
 * @returns true if value is a valid ExpandedHabitsState
 */
function isValidExpandedHabitsState(value: unknown): value is ExpandedHabitsState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  // Check expandedIds is an array of strings
  if (!Array.isArray(obj.expandedIds)) {
    return false;
  }
  
  // Validate all items in expandedIds are strings
  if (!obj.expandedIds.every((id: unknown) => typeof id === 'string')) {
    return false;
  }
  
  // updatedAt is optional but if present should be a string
  if (obj.updatedAt !== undefined && typeof obj.updatedAt !== 'string') {
    return false;
  }
  
  return true;
}

/**
 * Save expanded habits state to LocalStorage.
 * Silently fails if LocalStorage is unavailable.
 * 
 * @param expandedIds - Set of expanded habit IDs to save
 */
export function saveExpandedState(expandedIds: Set<string>): void {
  if (!isLocalStorageAvailable()) {
    debug.warn('[useExpandedHabits] LocalStorage not available, cannot save state');
    return;
  }
  
  try {
    const state: ExpandedHabitsState = {
      expandedIds: Array.from(expandedIds),
      updatedAt: new Date().toISOString(),
    };
    
    window.localStorage.setItem(EXPANDED_HABITS_KEY, JSON.stringify(state));
  } catch (error) {
    debug.warn('[useExpandedHabits] Failed to save expanded state:', error);
  }
}

/**
 * Custom hook for managing Habit card expand/collapse state.
 * 
 * Features:
 * - Persists state to LocalStorage (Requirement 7.1)
 * - Restores state on page reload (Requirement 7.2)
 * - Defaults to collapsed for habits without stored state (Requirement 7.3)
 * - Handles private browsing mode gracefully
 * - Handles corrupted LocalStorage data gracefully
 * 
 * @returns Object with expanded state and utility functions
 * 
 * @example
 * ```tsx
 * const { isExpanded, toggleExpanded, setExpanded } = useExpandedHabits();
 * 
 * // Check if a habit is expanded
 * if (isExpanded(habit.id)) {
 *   // Show subtask list
 * }
 * 
 * // Toggle expand state on button click
 * <button onClick={() => toggleExpanded(habit.id)}>
 *   {isExpanded(habit.id) ? '▲' : '▼'}
 * </button>
 * 
 * // Explicitly set expanded state
 * setExpanded(habit.id, true);
 * ```
 */
export function useExpandedHabits(): UseExpandedHabitsReturn {
  // Initialize state with empty Set (SSR-safe)
  // Will be populated from LocalStorage in useEffect
  const [expandedHabits, setExpandedHabits] = useState<Set<string>>(() => new Set());
  
  // Track if we've loaded from LocalStorage
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Load state from LocalStorage on mount (client-side only)
  useEffect(() => {
    const loaded = loadExpandedState();
    setExpandedHabits(loaded);
    setIsInitialized(true);
  }, []);
  
  // Save to LocalStorage whenever state changes (after initialization)
  useEffect(() => {
    if (isInitialized) {
      saveExpandedState(expandedHabits);
    }
  }, [expandedHabits, isInitialized]);
  
  /**
   * Check if a specific habit is expanded
   * @param habitId - The habit ID to check
   * @returns true if the habit is expanded, false otherwise (default collapsed)
   */
  const isExpanded = useCallback((habitId: string): boolean => {
    return expandedHabits.has(habitId);
  }, [expandedHabits]);
  
  /**
   * Toggle the expanded state of a habit
   * @param habitId - The habit ID to toggle
   */
  const toggleExpanded = useCallback((habitId: string): void => {
    setExpandedHabits(prev => {
      const next = new Set(prev);
      if (next.has(habitId)) {
        next.delete(habitId);
      } else {
        next.add(habitId);
      }
      return next;
    });
  }, []);
  
  /**
   * Set the expanded state of a habit explicitly
   * @param habitId - The habit ID to set
   * @param expanded - Whether the habit should be expanded
   */
  const setExpanded = useCallback((habitId: string, expanded: boolean): void => {
    setExpandedHabits(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(habitId);
      } else {
        next.delete(habitId);
      }
      return next;
    });
  }, []);
  
  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    expandedHabits,
    isExpanded,
    toggleExpanded,
    setExpanded,
  }), [expandedHabits, isExpanded, toggleExpanded, setExpanded]);
}
