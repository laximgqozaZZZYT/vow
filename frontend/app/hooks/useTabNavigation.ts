'use client';

/**
 * useTabNavigation Hook
 * 
 * タブナビゲーションの状態管理を行うカスタムフック
 * 
 * Features:
 * - アクティブタブの状態管理
 * - localStorageへの永続化（最後に選択したタブを記憶）
 * - タブ間のナビゲーション関数（次へ、前へ、直接指定）
 * 
 * @module useTabNavigation
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 10.5
 */

import { useState, useCallback, useEffect } from 'react';

/** LocalStorage key for persisting active tab */
const TAB_STATE_KEY = 'habitModalActiveTab';

/** Number of tabs in the habit modal (基本, 除外日時, 負荷, 詳細) */
const TAB_COUNT = 4;

/** Minimum valid tab index */
const MIN_TAB_INDEX = 0;

/** Maximum valid tab index */
const MAX_TAB_INDEX = TAB_COUNT - 1;

/**
 * Return type for useTabNavigation hook
 */
export interface UseTabNavigationReturn {
  /** Current active tab index (0-3) */
  activeTab: number;
  /** Set active tab directly by index */
  setActiveTab: (index: number) => void;
  /** Navigate to the next tab (if not at last tab) */
  goToNextTab: () => void;
  /** Navigate to the previous tab (if not at first tab) */
  goToPreviousTab: () => void;
  /** Check if currently on the first tab */
  isFirstTab: boolean;
  /** Check if currently on the last tab */
  isLastTab: boolean;
}

/**
 * Get initial tab index from localStorage with fallback
 * 
 * Handles:
 * - localStorage not available (SSR)
 * - Invalid stored values
 * - Out of range values
 * 
 * @returns Initial tab index (defaults to 0 for Basic tab)
 */
function getInitialTabIndex(): number {
  // Return default during SSR
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const stored = localStorage.getItem(TAB_STATE_KEY);
    
    // No stored value, return default
    if (stored === null) {
      return 0;
    }

    const index = parseInt(stored, 10);
    
    // Validate the parsed value
    if (isNaN(index) || index < MIN_TAB_INDEX || index > MAX_TAB_INDEX) {
      return 0; // デフォルトは基本タブ
    }

    return index;
  } catch {
    // localStorage access failed (e.g., private browsing, quota exceeded)
    return 0; // デフォルトは基本タブ
  }
}

/**
 * Save tab index to localStorage
 * 
 * @param index - Tab index to save
 */
function saveTabIndex(index: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(TAB_STATE_KEY, String(index));
  } catch {
    // Silently fail if localStorage is not available
    // This is acceptable as tab persistence is a convenience feature
  }
}

/**
 * Validate and clamp tab index to valid range
 * 
 * @param index - Tab index to validate
 * @returns Valid tab index within range [0, 3]
 */
function validateTabIndex(index: number): number {
  if (typeof index !== 'number' || isNaN(index)) {
    return 0;
  }
  return Math.max(MIN_TAB_INDEX, Math.min(MAX_TAB_INDEX, Math.floor(index)));
}

/**
 * Custom hook for managing tab navigation state
 * 
 * Provides:
 * - Active tab state with localStorage persistence
 * - Navigation functions (setActiveTab, goToNextTab, goToPreviousTab)
 * - Boundary state indicators (isFirstTab, isLastTab)
 * 
 * @returns Tab navigation state and functions
 * 
 * @example
 * ```tsx
 * const { activeTab, setActiveTab, goToNextTab, goToPreviousTab } = useTabNavigation();
 * 
 * // Switch to specific tab
 * setActiveTab(2); // Go to Workload tab
 * 
 * // Navigate sequentially
 * goToNextTab();     // Move to next tab
 * goToPreviousTab(); // Move to previous tab
 * ```
 */
export function useTabNavigation(): UseTabNavigationReturn {
  // Initialize state with localStorage value (or default)
  const [activeTab, setActiveTabState] = useState<number>(getInitialTabIndex);

  // Sync with localStorage on mount (for SSR hydration)
  useEffect(() => {
    const storedIndex = getInitialTabIndex();
    if (storedIndex !== activeTab) {
      setActiveTabState(storedIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Set active tab with validation and persistence
   */
  const setActiveTab = useCallback((index: number) => {
    const validIndex = validateTabIndex(index);
    setActiveTabState(validIndex);
    saveTabIndex(validIndex);
  }, []);

  /**
   * Navigate to the next tab (if not at last tab)
   */
  const goToNextTab = useCallback(() => {
    setActiveTabState((current) => {
      const nextIndex = Math.min(current + 1, MAX_TAB_INDEX);
      saveTabIndex(nextIndex);
      return nextIndex;
    });
  }, []);

  /**
   * Navigate to the previous tab (if not at first tab)
   */
  const goToPreviousTab = useCallback(() => {
    setActiveTabState((current) => {
      const prevIndex = Math.max(current - 1, MIN_TAB_INDEX);
      saveTabIndex(prevIndex);
      return prevIndex;
    });
  }, []);

  return {
    activeTab,
    setActiveTab,
    goToNextTab,
    goToPreviousTab,
    isFirstTab: activeTab === MIN_TAB_INDEX,
    isLastTab: activeTab === MAX_TAB_INDEX,
  };
}

export default useTabNavigation;
