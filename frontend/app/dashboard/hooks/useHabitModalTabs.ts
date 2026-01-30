'use client';

/**
 * useHabitModalTabs Hook
 * 
 * Custom hook for managing tab navigation state in the Habit Modal.
 * 
 * Features:
 * - Numeric tab index management (0-3 for 4 tabs)
 * - localStorage persistence for last active tab (Requirement 10.5)
 * - Navigation functions (setActiveTab, goToNextTab, goToPreviousTab)
 * - Boundary handling for first/last tab
 * 
 * @module useHabitModalTabs
 */

import { useState, useCallback, useEffect } from 'react';

/** LocalStorage key for persisting active tab */
const TAB_STATE_KEY = 'habitModalActiveTab';

/** Total number of tabs in the habit modal */
const TOTAL_TABS = 4;

/**
 * Return type for useHabitModalTabs hook
 */
export interface UseHabitModalTabsReturn {
  /** Current active tab index (0-3) */
  activeTab: number;
  /** Set the active tab by index */
  setActiveTab: (index: number) => void;
  /** Navigate to the next tab (if not at last) */
  goToNextTab: () => void;
  /** Navigate to the previous tab (if not at first) */
  goToPreviousTab: () => void;
  /** Whether currently on the first tab */
  isFirstTab: boolean;
  /** Whether currently on the last tab */
  isLastTab: boolean;
}

/**
 * Get initial tab index from localStorage with fallback
 */
function getInitialTabIndex(): number {
  if (typeof window === 'undefined') return 0;
  
  try {
    const stored = localStorage.getItem(TAB_STATE_KEY);
    if (stored === null) return 0;
    
    const index = parseInt(stored, 10);
    if (isNaN(index) || index < 0 || index >= TOTAL_TABS) {
      return 0;
    }
    return index;
  } catch {
    return 0; // Default to first tab on error
  }
}

/**
 * Save tab index to localStorage
 */
function saveTabIndex(index: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(TAB_STATE_KEY, String(index));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Custom hook for managing Habit Modal tab navigation
 * 
 * @param initialTab - Optional initial tab index (defaults to localStorage value or 0)
 * @returns Tab navigation state and functions
 * 
 * @example
 * ```tsx
 * const { activeTab, setActiveTab, goToNextTab, goToPreviousTab, isFirstTab, isLastTab } = useHabitModalTabs();
 * 
 * // Use with TabNavigation component
 * <TabNavigation
 *   tabs={HABIT_MODAL_TABS}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 * 
 * // Use with swipe gesture
 * const swipeHandlers = useSwipeGesture({
 *   onSwipeLeft: goToNextTab,
 *   onSwipeRight: goToPreviousTab,
 *   disableSwipeLeft: isLastTab,
 *   disableSwipeRight: isFirstTab,
 * });
 * ```
 */
export function useHabitModalTabs(initialTab?: number): UseHabitModalTabsReturn {
  // Initialize state from localStorage or provided initial value
  const [activeTab, setActiveTabState] = useState<number>(() => {
    if (initialTab !== undefined && initialTab >= 0 && initialTab < TOTAL_TABS) {
      return initialTab;
    }
    return getInitialTabIndex();
  });

  // Computed properties
  const isFirstTab = activeTab === 0;
  const isLastTab = activeTab === TOTAL_TABS - 1;

  /**
   * Set active tab with validation and persistence
   */
  const setActiveTab = useCallback((index: number) => {
    // Validate index is within bounds
    if (index < 0 || index >= TOTAL_TABS) {
      return;
    }
    
    setActiveTabState(index);
    saveTabIndex(index);
  }, []);

  /**
   * Navigate to the next tab (if not at last)
   */
  const goToNextTab = useCallback(() => {
    setActiveTabState((current) => {
      if (current >= TOTAL_TABS - 1) {
        return current; // Already at last tab
      }
      const newIndex = current + 1;
      saveTabIndex(newIndex);
      return newIndex;
    });
  }, []);

  /**
   * Navigate to the previous tab (if not at first)
   */
  const goToPreviousTab = useCallback(() => {
    setActiveTabState((current) => {
      if (current <= 0) {
        return current; // Already at first tab
      }
      const newIndex = current - 1;
      saveTabIndex(newIndex);
      return newIndex;
    });
  }, []);

  // Persist initial tab to localStorage if provided
  useEffect(() => {
    if (initialTab !== undefined && initialTab >= 0 && initialTab < TOTAL_TABS) {
      saveTabIndex(initialTab);
    }
  }, [initialTab]);

  return {
    activeTab,
    setActiveTab,
    goToNextTab,
    goToPreviousTab,
    isFirstTab,
    isLastTab,
  };
}

export default useHabitModalTabs;
