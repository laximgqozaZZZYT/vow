/**
 * Unit tests for useBoardLayout Hook
 * 
 * Tests the layout mode management for the Board section.
 * 
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
 * - 1.1: Board_Section SHALL display the Detailed_Layout (Kanban_Board) by default
 * - 1.3: Clicking the layout toggle SHALL switch to the other Layout_Mode without page reload
 * - 1.4: Board_Section SHALL persist the user's Layout_Mode preference in local storage
 * - 1.5: Board_Section loads with a saved preference SHALL display the saved Layout_Mode
 */

import { renderHook, act } from '@testing-library/react';
import {
  useBoardLayout,
  STORAGE_KEY,
  DEFAULT_MODE,
  isValidLayoutMode,
  type LayoutMode,
} from '../../app/dashboard/hooks/useBoardLayout';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get store() { return store; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useBoardLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe('Constants', () => {
    it('should have correct STORAGE_KEY', () => {
      expect(STORAGE_KEY).toBe('board-layout-mode');
    });

    it('should have correct DEFAULT_MODE as "detailed"', () => {
      /**
       * **Validates: Requirement 1.1**
       * Board_Section SHALL display the Detailed_Layout (Kanban_Board) by default
       */
      expect(DEFAULT_MODE).toBe('detailed');
    });
  });

  describe('isValidLayoutMode', () => {
    it('should return true for "simple"', () => {
      expect(isValidLayoutMode('simple')).toBe(true);
    });

    it('should return true for "detailed"', () => {
      expect(isValidLayoutMode('detailed')).toBe(true);
    });

    it('should return false for invalid strings', () => {
      expect(isValidLayoutMode('invalid')).toBe(false);
      expect(isValidLayoutMode('SIMPLE')).toBe(false);
      expect(isValidLayoutMode('DETAILED')).toBe(false);
      expect(isValidLayoutMode('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidLayoutMode(null)).toBe(false);
      expect(isValidLayoutMode(undefined)).toBe(false);
      expect(isValidLayoutMode(123)).toBe(false);
      expect(isValidLayoutMode({})).toBe(false);
      expect(isValidLayoutMode([])).toBe(false);
    });
  });

  describe('Default behavior', () => {
    /**
     * **Validates: Requirement 1.1**
     * Board_Section SHALL display the Detailed_Layout (Kanban_Board) by default
     */
    it('should return "detailed" as default layout mode when no saved preference', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');
      expect(result.current.isDetailedMode).toBe(true);
      expect(result.current.isSimpleMode).toBe(false);
    });

    it('should have loading state initially false after mount', async () => {
      const { result } = renderHook(() => useBoardLayout());

      // After mount, loading should be false
      expect(result.current.loading).toBe(false);
    });
  });

  describe('toggleLayoutMode', () => {
    /**
     * **Validates: Requirement 1.3**
     * Clicking the layout toggle SHALL switch to the other Layout_Mode without page reload
     */
    it('should toggle from detailed to simple', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');

      act(() => {
        result.current.toggleLayoutMode();
      });

      expect(result.current.layoutMode).toBe('simple');
      expect(result.current.isSimpleMode).toBe(true);
      expect(result.current.isDetailedMode).toBe(false);
    });

    it('should toggle from simple to detailed', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'simple');
      
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('simple');

      act(() => {
        result.current.toggleLayoutMode();
      });

      expect(result.current.layoutMode).toBe('detailed');
      expect(result.current.isDetailedMode).toBe(true);
      expect(result.current.isSimpleMode).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');

      act(() => {
        result.current.toggleLayoutMode();
      });
      expect(result.current.layoutMode).toBe('simple');

      act(() => {
        result.current.toggleLayoutMode();
      });
      expect(result.current.layoutMode).toBe('detailed');

      act(() => {
        result.current.toggleLayoutMode();
      });
      expect(result.current.layoutMode).toBe('simple');
    });
  });

  describe('setLayoutMode', () => {
    it('should set layout mode to simple', () => {
      const { result } = renderHook(() => useBoardLayout());

      act(() => {
        result.current.setLayoutMode('simple');
      });

      expect(result.current.layoutMode).toBe('simple');
    });

    it('should set layout mode to detailed', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'simple');
      
      const { result } = renderHook(() => useBoardLayout());

      act(() => {
        result.current.setLayoutMode('detailed');
      });

      expect(result.current.layoutMode).toBe('detailed');
    });

    it('should not change mode for invalid values', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');

      act(() => {
        // @ts-expect-error - Testing invalid input
        result.current.setLayoutMode('invalid');
      });

      // Should remain unchanged
      expect(result.current.layoutMode).toBe('detailed');
    });
  });

  describe('Local storage persistence', () => {
    /**
     * **Validates: Requirement 1.4**
     * Board_Section SHALL persist the user's Layout_Mode preference in local storage
     */
    it('should save layout mode to local storage when toggled', () => {
      const { result } = renderHook(() => useBoardLayout());

      act(() => {
        result.current.toggleLayoutMode();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'simple');
    });

    it('should save layout mode to local storage when set directly', () => {
      const { result } = renderHook(() => useBoardLayout());

      act(() => {
        result.current.setLayoutMode('simple');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'simple');
    });

    /**
     * **Validates: Requirement 1.5**
     * Board_Section loads with a saved preference SHALL display the saved Layout_Mode
     */
    it('should load saved "simple" preference from local storage', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'simple');

      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('simple');
      expect(result.current.isSimpleMode).toBe(true);
    });

    it('should load saved "detailed" preference from local storage', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'detailed');

      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');
      expect(result.current.isDetailedMode).toBe(true);
    });

    it('should use default mode when local storage has invalid value', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'invalid-mode');

      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');
    });

    it('should use default mode when local storage is empty', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.layoutMode).toBe('detailed');
    });
  });

  describe('Convenience boolean flags', () => {
    it('should have correct isDetailedMode flag when detailed', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.isDetailedMode).toBe(true);
      expect(result.current.isSimpleMode).toBe(false);
    });

    it('should have correct isSimpleMode flag when simple', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'simple');
      
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.isSimpleMode).toBe(true);
      expect(result.current.isDetailedMode).toBe(false);
    });

    it('should update flags when mode changes', () => {
      const { result } = renderHook(() => useBoardLayout());

      expect(result.current.isDetailedMode).toBe(true);

      act(() => {
        result.current.toggleLayoutMode();
      });

      expect(result.current.isDetailedMode).toBe(false);
      expect(result.current.isSimpleMode).toBe(true);
    });
  });

  describe('Round-trip persistence', () => {
    /**
     * **Validates: Requirements 1.4, 1.5**
     * Tests that saving and loading produces the same value
     */
    it('should persist and restore "simple" mode correctly', () => {
      // First render - set to simple
      const { result: result1, unmount } = renderHook(() => useBoardLayout());
      
      act(() => {
        result1.current.setLayoutMode('simple');
      });
      
      expect(result1.current.layoutMode).toBe('simple');
      unmount();

      // Second render - should restore simple
      const { result: result2 } = renderHook(() => useBoardLayout());
      expect(result2.current.layoutMode).toBe('simple');
    });

    it('should persist and restore "detailed" mode correctly', () => {
      // First render - set to detailed
      const { result: result1, unmount } = renderHook(() => useBoardLayout());
      
      act(() => {
        result1.current.setLayoutMode('detailed');
      });
      
      expect(result1.current.layoutMode).toBe('detailed');
      unmount();

      // Second render - should restore detailed
      const { result: result2 } = renderHook(() => useBoardLayout());
      expect(result2.current.layoutMode).toBe('detailed');
    });

    it('should persist toggle state across renders', () => {
      // First render - toggle from default
      const { result: result1, unmount } = renderHook(() => useBoardLayout());
      
      expect(result1.current.layoutMode).toBe('detailed');
      
      act(() => {
        result1.current.toggleLayoutMode();
      });
      
      expect(result1.current.layoutMode).toBe('simple');
      unmount();

      // Second render - should be simple
      const { result: result2 } = renderHook(() => useBoardLayout());
      expect(result2.current.layoutMode).toBe('simple');
    });
  });
});
