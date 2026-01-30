/**
 * Unit Tests for useSwipeGesture Hook
 * 
 * Tests the swipe gesture handling including:
 * - Touch event handlers (onTouchStart, onTouchMove, onTouchEnd)
 * - Swipe threshold (50px minimum) to prevent accidental navigation
 * - Swipe direction and velocity calculation
 * - Boundary conditions (first/last tab)
 * - Diagonal swipe filtering
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
 */

import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture, SwipeConfig } from '../app/hooks/useSwipeGesture';
import type { TouchEvent as ReactTouchEvent } from 'react';

/**
 * Helper to create a mock TouchEvent
 */
function createTouchEvent(clientX: number, clientY: number = 0): ReactTouchEvent {
  return {
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
  } as unknown as ReactTouchEvent;
}

describe('useSwipeGesture', () => {
  let onSwipeLeft: jest.Mock;
  let onSwipeRight: jest.Mock;
  let defaultConfig: SwipeConfig;

  beforeEach(() => {
    onSwipeLeft = jest.fn();
    onSwipeRight = jest.fn();
    defaultConfig = {
      onSwipeLeft,
      onSwipeRight,
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with offset 0', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));
      
      expect(result.current.offset).toBe(0);
    });

    it('should initialize with isDragging false', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));
      
      expect(result.current.isDragging).toBe(false);
    });

    it('should provide touch event handlers', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));
      
      expect(result.current.handlers.onTouchStart).toBeDefined();
      expect(result.current.handlers.onTouchMove).toBeDefined();
      expect(result.current.handlers.onTouchEnd).toBeDefined();
    });
  });

  describe('Swipe Left (Navigate to Next Tab)', () => {
    /**
     * Validates: Requirement 7.1
     * WHEN a User swipes left on tab content, THE System SHALL navigate to the next tab
     */
    it('should call onSwipeLeft when swiping left beyond threshold', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      // Start touch at x=100
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move to x=40 (60px left, beyond 50px threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });

      // End touch
      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(40, 0));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should call onSwipeLeft when swiping exactly at threshold', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move exactly 50px left
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(50, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(50, 0));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Swipe Right (Navigate to Previous Tab)', () => {
    /**
     * Validates: Requirement 7.2
     * WHEN a User swipes right on tab content, THE System SHALL navigate to the previous tab
     */
    it('should call onSwipeRight when swiping right beyond threshold', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      // Start touch at x=100
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move to x=160 (60px right, beyond 50px threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(160, 0));
      });

      // End touch
      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(160, 0));
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it('should call onSwipeRight when swiping exactly at threshold', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move exactly 50px right
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(150, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(150, 0));
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });
  });

  describe('Swipe Threshold', () => {
    /**
     * Validates: Requirement 7.6
     * THE Swipe_Navigation SHALL have a minimum swipe threshold to prevent accidental navigation
     */
    it('should NOT trigger navigation when swipe is below threshold', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move only 30px left (below 50px threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(70, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(70, 0));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should NOT trigger navigation when swipe is just below threshold (49px)', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move 49px left (just below 50px threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(51, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(51, 0));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should use custom threshold when provided', () => {
      const customConfig: SwipeConfig = {
        ...defaultConfig,
        threshold: 100, // Custom threshold of 100px
      };
      const { result } = renderHook(() => useSwipeGesture(customConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 0));
      });

      // Move 80px left (below custom 100px threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(120, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(120, 0));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();

      // Now test with movement beyond custom threshold
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 0));
      });

      // Move 110px left (beyond custom 100px threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(90, 0));
      });

      // Advance time to avoid debounce
      jest.advanceTimersByTime(400);

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(90, 0));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Boundary Conditions', () => {
    /**
     * Validates: Requirement 7.3
     * WHEN on the first tab and swiping right, THE System SHALL not navigate
     */
    it('should NOT call onSwipeRight when disableSwipeRight is true (first tab)', () => {
      const config: SwipeConfig = {
        ...defaultConfig,
        disableSwipeRight: true,
      };
      const { result } = renderHook(() => useSwipeGesture(config));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Swipe right 60px
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(160, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(160, 0));
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    /**
     * Validates: Requirement 7.4
     * WHEN on the last tab and swiping left, THE System SHALL not navigate
     */
    it('should NOT call onSwipeLeft when disableSwipeLeft is true (last tab)', () => {
      const config: SwipeConfig = {
        ...defaultConfig,
        disableSwipeLeft: true,
      };
      const { result } = renderHook(() => useSwipeGesture(config));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Swipe left 60px
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(40, 0));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it('should limit offset when swiping in disabled direction', () => {
      const config: SwipeConfig = {
        ...defaultConfig,
        disableSwipeLeft: true,
      };
      const { result } = renderHook(() => useSwipeGesture(config));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Try to swipe left
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });

      // Offset should be limited to 0 (no negative offset when left is disabled)
      expect(result.current.offset).toBe(0);
    });
  });

  describe('Diagonal Swipe Handling', () => {
    it('should NOT trigger navigation for diagonal swipes (vertical > horizontal)', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 100));
      });

      // Move diagonally with more vertical movement
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(70, 200)); // 30px horizontal, 100px vertical
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(70, 200));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should trigger navigation for diagonal swipes (horizontal > vertical)', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 100));
      });

      // Move diagonally with more horizontal movement
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(30, 120)); // 70px horizontal, 20px vertical
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(30, 120));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visual Feedback (Offset)', () => {
    it('should update offset during swipe for visual feedback', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      expect(result.current.isDragging).toBe(true);

      // Move 30px left
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(70, 0));
      });

      expect(result.current.offset).toBe(-30);

      // Move 50px right from start
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(150, 0));
      });

      expect(result.current.offset).toBe(50);
    });

    it('should reset offset after swipe ends', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });

      expect(result.current.offset).toBe(-60);

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(40, 0));
      });

      expect(result.current.offset).toBe(0);
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('Rapid Swipe Debouncing', () => {
    it('should debounce rapid swipes to prevent multiple tab changes', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      // First swipe
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });
      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(40, 0));
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);

      // Immediate second swipe (should be debounced)
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });
      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(40, 0));
      });

      // Should still be 1 due to debounce
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);

      // Advance time past debounce period
      jest.advanceTimersByTime(400);

      // Third swipe after debounce period
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0));
      });
      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(40, 0));
      });

      // Now should be 2
      expect(onSwipeLeft).toHaveBeenCalledTimes(2);
    });
  });

  describe('Interrupted Swipes', () => {
    it('should cancel navigation if touch moves back past threshold', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // Move past threshold
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(40, 0)); // 60px left
      });

      // Move back to near start
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(90, 0)); // Only 10px left now
      });

      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(90, 0));
      });

      // Should not trigger because final position is below threshold
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle touch event with no touches gracefully', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      const emptyTouchEvent = {
        touches: [],
        changedTouches: [],
      } as unknown as ReactTouchEvent;

      // Should not throw
      expect(() => {
        act(() => {
          result.current.handlers.onTouchStart(emptyTouchEvent);
        });
      }).not.toThrow();

      expect(result.current.isDragging).toBe(false);
    });

    it('should handle onTouchMove without prior onTouchStart', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      // Should not throw and should not update state
      expect(() => {
        act(() => {
          result.current.handlers.onTouchMove(createTouchEvent(50, 0));
        });
      }).not.toThrow();

      expect(result.current.offset).toBe(0);
    });

    it('should handle onTouchEnd without prior onTouchStart', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      // Should not throw and should not trigger callbacks
      expect(() => {
        act(() => {
          result.current.handlers.onTouchEnd(createTouchEvent(50, 0));
        });
      }).not.toThrow();

      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should handle zero movement swipe', () => {
      const { result } = renderHook(() => useSwipeGesture(defaultConfig));

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 0));
      });

      // No movement
      act(() => {
        result.current.handlers.onTouchEnd(createTouchEvent(100, 0));
      });

      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });
  });
});
