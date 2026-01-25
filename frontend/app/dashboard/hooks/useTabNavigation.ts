import { useState, useCallback, useEffect } from 'react';
import { DEFAULT_TAB } from '../constants/tabConfig';

export interface UseTabNavigationReturn {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  isFullView: boolean;
  toggleFullView: () => void;
  exitFullView: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

/**
 * Hook for managing tab navigation state
 */
export function useTabNavigation(
  initialTab?: string,
  availableTabs?: string[]
): UseTabNavigationReturn {
  // Validate initial tab
  const getValidTab = useCallback((tabId: string | undefined): string => {
    if (!tabId) return DEFAULT_TAB;
    if (availableTabs && !availableTabs.includes(tabId)) {
      return availableTabs[0] || DEFAULT_TAB;
    }
    return tabId;
  }, [availableTabs]);

  const [activeTab, setActiveTabState] = useState<string>(() => 
    getValidTab(initialTab)
  );
  const [isFullView, setIsFullView] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Update active tab with validation
  const setActiveTab = useCallback((tabId: string) => {
    const validTab = getValidTab(tabId);
    setActiveTabState(validTab);
    // Exit full view when switching tabs
    if (isFullView) {
      setIsFullView(false);
    }
  }, [getValidTab, isFullView]);

  // Toggle full view mode
  const toggleFullView = useCallback(() => {
    setIsFullView(prev => !prev);
  }, []);

  // Exit full view mode
  const exitFullView = useCallback(() => {
    setIsFullView(false);
  }, []);

  // Toggle collapsed state
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Handle ESC key to exit full view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullView) {
        exitFullView();
      }
    };

    if (isFullView) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullView, exitFullView]);

  // Validate active tab when available tabs change
  useEffect(() => {
    if (availableTabs && availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTabState(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  return {
    activeTab,
    setActiveTab,
    isFullView,
    toggleFullView,
    exitFullView,
    isCollapsed,
    toggleCollapse,
  };
}
