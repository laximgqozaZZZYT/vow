/**
 * Unit Tests for useTabNavigation Hook
 * 
 * Tests the tab navigation state management including:
 * - Active tab state management
 * - localStorage persistence
 * - Navigation functions (setActiveTab, goToNextTab, goToPreviousTab)
 * - Boundary conditions
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 10.5
 */

import { renderHook, act } from '@testing-library/react';
import { useTabNavigation } from '../app/hooks/useTabNavigation';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useTabNavigation', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with tab 0 (Basic tab) as default', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(0);
    });

    it('should restore active tab from localStorage', () => {
      localStorageMock.setItem('habitModalActiveTab', '2');
      
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(2);
    });

    it('should default to 0 if localStorage has invalid value', () => {
      localStorageMock.setItem('habitModalActiveTab', 'invalid');
      
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(0);
    });

    it('should default to 0 if localStorage has out-of-range value (negative)', () => {
      localStorageMock.setItem('habitModalActiveTab', '-1');
      
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(0);
    });

    it('should default to 0 if localStorage has out-of-range value (too high)', () => {
      localStorageMock.setItem('habitModalActiveTab', '5');
      
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(0);
    });
  });

  describe('setActiveTab', () => {
    it('should set active tab to specified index', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(2);
      });
      
      expect(result.current.activeTab).toBe(2);
    });

    it('should persist active tab to localStorage', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(3);
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('habitModalActiveTab', '3');
    });

    it('should clamp negative index to 0', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(-1);
      });
      
      expect(result.current.activeTab).toBe(0);
    });

    it('should clamp index above 3 to 3', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(10);
      });
      
      expect(result.current.activeTab).toBe(3);
    });

    it('should handle NaN by defaulting to 0', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(NaN);
      });
      
      expect(result.current.activeTab).toBe(0);
    });

    it('should floor decimal values', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(2.7);
      });
      
      expect(result.current.activeTab).toBe(2);
    });
  });

  describe('goToNextTab', () => {
    it('should navigate to next tab', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(0);
      
      act(() => {
        result.current.goToNextTab();
      });
      
      expect(result.current.activeTab).toBe(1);
    });

    it('should not go beyond last tab (index 3)', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      // Set to last tab
      act(() => {
        result.current.setActiveTab(3);
      });
      
      expect(result.current.activeTab).toBe(3);
      
      // Try to go to next
      act(() => {
        result.current.goToNextTab();
      });
      
      // Should stay at 3
      expect(result.current.activeTab).toBe(3);
    });

    it('should persist to localStorage when navigating', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.goToNextTab();
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('habitModalActiveTab', '1');
    });
  });

  describe('goToPreviousTab', () => {
    it('should navigate to previous tab', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      // Start at tab 2
      act(() => {
        result.current.setActiveTab(2);
      });
      
      act(() => {
        result.current.goToPreviousTab();
      });
      
      expect(result.current.activeTab).toBe(1);
    });

    it('should not go below first tab (index 0)', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.activeTab).toBe(0);
      
      act(() => {
        result.current.goToPreviousTab();
      });
      
      // Should stay at 0
      expect(result.current.activeTab).toBe(0);
    });

    it('should persist to localStorage when navigating', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      // Start at tab 2
      act(() => {
        result.current.setActiveTab(2);
      });
      
      jest.clearAllMocks();
      
      act(() => {
        result.current.goToPreviousTab();
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('habitModalActiveTab', '1');
    });
  });

  describe('Boundary Indicators', () => {
    it('should indicate isFirstTab when at tab 0', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      expect(result.current.isFirstTab).toBe(true);
      expect(result.current.isLastTab).toBe(false);
    });

    it('should indicate isLastTab when at tab 3', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(3);
      });
      
      expect(result.current.isFirstTab).toBe(false);
      expect(result.current.isLastTab).toBe(true);
    });

    it('should indicate neither at middle tabs', () => {
      const { result } = renderHook(() => useTabNavigation());
      
      act(() => {
        result.current.setActiveTab(1);
      });
      
      expect(result.current.isFirstTab).toBe(false);
      expect(result.current.isLastTab).toBe(false);
    });
  });

  describe('localStorage Error Handling', () => {
    it('should handle localStorage.getItem throwing error', () => {
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });
      
      // Should not throw and should default to 0
      const { result } = renderHook(() => useTabNavigation());
      expect(result.current.activeTab).toBe(0);
      
      localStorageMock.getItem = originalGetItem;
    });

    it('should handle localStorage.setItem throwing error gracefully', () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });
      
      const { result } = renderHook(() => useTabNavigation());
      
      // Should not throw
      expect(() => {
        act(() => {
          result.current.setActiveTab(2);
        });
      }).not.toThrow();
      
      // State should still update even if localStorage fails
      expect(result.current.activeTab).toBe(2);
      
      localStorageMock.setItem = originalSetItem;
    });
  });
});
