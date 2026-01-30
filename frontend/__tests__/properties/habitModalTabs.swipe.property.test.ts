/**
 * Property-Based Tests for Habit Modal Tabs - Swipe Navigation
 * 
 * **Feature: habit-modal-tabs, Property 5: Swipe navigation**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 * 
 * *For any* current tab index, swiping left should navigate to index + 1 
 * (if not at last tab), and swiping right should navigate to index - 1 
 * (if not at first tab). Boundary conditions: swiping left on last tab 
 * or right on first tab should not change the index.
 * 
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from '../../app/hooks/useSwipeGesture';
import type { TouchEvent as ReactTouchEvent } from 'react';

/**
 * Helper to create mock touch events for testing
 */
function createMockTouchEvent(clientX: number, clientY: number = 100): Partial<ReactTouchEvent> {
  return {
    touches: [{ clientX, clientY }] as unknown as React.TouchList,
  };
}

describe('Feature: habit-modal-tabs, Property 5: Swipe navigation', () => {
  // Default threshold from the hook
  const DEFAULT_THRESHOLD = 50;

  /**
   * Helper to simulate a complete horizontal swipe gesture with proper state updates
   * Each touch event is wrapped in its own act() to allow React state to update
   */
  async function simulateHorizontalSwipe(
    result: { current: ReturnType<typeof useSwipeGesture> },
    startX: number,
    endX: number
  ): Promise<void> {
    const fixedY = 100;
    const direction = endX > startX ? 1 : -1;
    
    // Touch start - must be in its own act to update state
    act(() => {
      result.current.handlers.onTouchStart(
        createMockTouchEvent(startX, fixedY) as ReactTouchEvent
      );
    });
    
    // First touch move - establish horizontal direction (move >10px horizontally)
    const firstMoveX = startX + (15 * direction);
    act(() => {
      result.current.handlers.onTouchMove(
        createMockTouchEvent(firstMoveX, fixedY) as ReactTouchEvent
      );
    });
    
    // Second touch move - move to final position
    act(() => {
      result.current.handlers.onTouchMove(
        createMockTouchEvent(endX, fixedY) as ReactTouchEvent
      );
    });
    
    // Touch end
    act(() => {
      result.current.handlers.onTouchEnd(
        createMockTouchEvent(endX, fixedY) as ReactTouchEvent
      );
    });
  }

  /**
   * Property 5.1: Swipe left navigation (Requirements 7.1)
   * 
   * *For any* current tab index that is not the last tab, swiping left 
   * should trigger onSwipeLeft callback (navigate to next tab).
   */
  describe('Property 5.1: Swipe left navigates to next tab', () => {
    it('swiping left when not at last tab should call onSwipeLeft', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 2 }), // tab indices 0-2 (not last tab)
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (tabIndex, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false, // Not at last tab
                disableSwipeRight: tabIndex === 0,
              })
            );
            
            // Simulate swipe left (negative direction: startX > endX)
            await simulateHorizontalSwipe(result, 200, 200 - swipeDistance);
            
            // onSwipeLeft should be called
            expect(onSwipeLeft).toHaveBeenCalledTimes(1);
            expect(onSwipeRight).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.2: Swipe right navigation (Requirements 7.2)
   * 
   * *For any* current tab index that is not the first tab, swiping right 
   * should trigger onSwipeRight callback (navigate to previous tab).
   */
  describe('Property 5.2: Swipe right navigates to previous tab', () => {
    it('swiping right when not at first tab should call onSwipeRight', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }), // tab indices 1-3 (not first tab)
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (tabIndex, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: tabIndex === 3,
                disableSwipeRight: false, // Not at first tab
              })
            );
            
            // Simulate swipe right (positive direction: startX < endX)
            await simulateHorizontalSwipe(result, 100, 100 + swipeDistance);
            
            // onSwipeRight should be called
            expect(onSwipeRight).toHaveBeenCalledTimes(1);
            expect(onSwipeLeft).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.3: Boundary - First tab swipe right (Requirements 7.3)
   * 
   * When on the first tab (index 0) and swiping right, the navigation 
   * should NOT occur (boundary behavior).
   */
  describe('Property 5.3: First tab boundary - swipe right does nothing', () => {
    it('swiping right on first tab should not trigger navigation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: true, // At first tab - disable swipe right
              })
            );
            
            // Simulate swipe right
            await simulateHorizontalSwipe(result, 100, 100 + swipeDistance);
            
            // Neither callback should be called
            expect(onSwipeRight).not.toHaveBeenCalled();
            expect(onSwipeLeft).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.4: Boundary - Last tab swipe left (Requirements 7.4)
   * 
   * When on the last tab (index 3) and swiping left, the navigation 
   * should NOT occur (boundary behavior).
   */
  describe('Property 5.4: Last tab boundary - swipe left does nothing', () => {
    it('swiping left on last tab should not trigger navigation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: true, // At last tab - disable swipe left
                disableSwipeRight: false,
              })
            );
            
            // Simulate swipe left
            await simulateHorizontalSwipe(result, 200, 200 - swipeDistance);
            
            // Neither callback should be called
            expect(onSwipeLeft).not.toHaveBeenCalled();
            expect(onSwipeRight).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.5: Swipe direction determines navigation direction
   * 
   * *For any* valid swipe, the direction of the swipe should determine
   * which callback is triggered (left swipe -> onSwipeLeft, right swipe -> onSwipeRight).
   */
  describe('Property 5.5: Swipe direction determines callback', () => {
    it('swipe direction should correctly determine which callback is triggered', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // true = swipe left, false = swipe right
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (isSwipeLeft, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: false,
              })
            );
            
            if (isSwipeLeft) {
              // Swipe left: startX > endX
              await simulateHorizontalSwipe(result, 200, 200 - swipeDistance);
            } else {
              // Swipe right: startX < endX
              await simulateHorizontalSwipe(result, 100, 100 + swipeDistance);
            }
            
            if (isSwipeLeft) {
              expect(onSwipeLeft).toHaveBeenCalledTimes(1);
              expect(onSwipeRight).not.toHaveBeenCalled();
            } else {
              expect(onSwipeRight).toHaveBeenCalledTimes(1);
              expect(onSwipeLeft).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.6: Tab index simulation with boundary conditions
   * 
   * *For any* tab index in [0, 3], the swipe behavior should respect
   * the boundary conditions based on the tab position.
   */
  describe('Property 5.6: Complete tab navigation simulation', () => {
    it('swipe behavior should respect tab boundaries for any tab index', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 3 }), // current tab index
          fc.boolean(), // true = swipe left, false = swipe right
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (tabIndex, isSwipeLeft, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const isFirstTab = tabIndex === 0;
            const isLastTab = tabIndex === 3;
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: isLastTab,
                disableSwipeRight: isFirstTab,
              })
            );
            
            if (isSwipeLeft) {
              await simulateHorizontalSwipe(result, 200, 200 - swipeDistance);
            } else {
              await simulateHorizontalSwipe(result, 100, 100 + swipeDistance);
            }
            
            // Verify expected behavior based on tab position and swipe direction
            if (isSwipeLeft && !isLastTab) {
              // Can swipe left (not at last tab)
              expect(onSwipeLeft).toHaveBeenCalledTimes(1);
              expect(onSwipeRight).not.toHaveBeenCalled();
            } else if (!isSwipeLeft && !isFirstTab) {
              // Can swipe right (not at first tab)
              expect(onSwipeRight).toHaveBeenCalledTimes(1);
              expect(onSwipeLeft).not.toHaveBeenCalled();
            } else {
              // Boundary condition - no navigation
              expect(onSwipeLeft).not.toHaveBeenCalled();
              expect(onSwipeRight).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.7: Offset resets after swipe completes
   * 
   * *For any* swipe gesture, the offset should reset to 0 after the swipe ends.
   */
  describe('Property 5.7: Offset resets after swipe', () => {
    it('offset should reset to 0 after swipe completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // swipe direction
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          async (isSwipeLeft, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: false,
              })
            );
            
            if (isSwipeLeft) {
              await simulateHorizontalSwipe(result, 200, 200 - swipeDistance);
            } else {
              await simulateHorizontalSwipe(result, 100, 100 + swipeDistance);
            }
            
            // After swipe completes, offset should be reset to 0
            expect(result.current.offset).toBe(0);
            expect(result.current.isDragging).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5.8: isDragging state during swipe
   * 
   * *For any* swipe gesture, isDragging should be true during the swipe
   * and false after it completes.
   */
  describe('Property 5.8: isDragging state management', () => {
    it('isDragging should be true during swipe and false after', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: DEFAULT_THRESHOLD + 10, max: 200 }), // swipe distance
          (swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: false,
              })
            );
            
            // Initially not dragging
            expect(result.current.isDragging).toBe(false);
            
            // Start touch
            act(() => {
              result.current.handlers.onTouchStart(
                createMockTouchEvent(200, 100) as ReactTouchEvent
              );
            });
            
            // Should be dragging after touch start
            expect(result.current.isDragging).toBe(true);
            
            // Move touch
            act(() => {
              result.current.handlers.onTouchMove(
                createMockTouchEvent(200 - swipeDistance, 100) as ReactTouchEvent
              );
            });
            
            // Still dragging during move
            expect(result.current.isDragging).toBe(true);
            
            // End touch
            act(() => {
              result.current.handlers.onTouchEnd(
                createMockTouchEvent(200 - swipeDistance, 100) as ReactTouchEvent
              );
            });
            
            // Not dragging after touch end
            expect(result.current.isDragging).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Property-Based Tests for Habit Modal Tabs - Swipe Threshold Boundary
 * 
 * **Feature: habit-modal-tabs, Property 6: Swipe threshold boundary**
 * **Validates: Requirements 7.6**
 * 
 * *For any* swipe gesture with distance below the threshold, the tab index 
 * should remain unchanged regardless of swipe direction.
 * 
 * Note: The hook has two conditions for triggering navigation:
 * 1. Distance >= threshold (50px)
 * 2. High velocity AND distance >= threshold/2 (25px)
 * 
 * For testing the threshold boundary, we test distances below threshold/2 (24px)
 * to ensure no navigation occurs regardless of velocity.
 * 
 * Uses fast-check for property-based testing with at least 100 iterations.
 */

describe('Feature: habit-modal-tabs, Property 6: Swipe threshold boundary', () => {
  // Default threshold from the hook
  const DEFAULT_THRESHOLD = 50;
  // Minimum distance for velocity-based navigation is threshold/2
  const VELOCITY_MIN_DISTANCE = DEFAULT_THRESHOLD / 2;

  /**
   * Helper to simulate a slow horizontal swipe gesture below threshold
   * This simulates a slow swipe that won't trigger velocity-based navigation
   */
  async function simulateSlowBelowThresholdSwipe(
    result: { current: ReturnType<typeof useSwipeGesture> },
    startX: number,
    swipeDistance: number,
    isSwipeLeft: boolean
  ): Promise<void> {
    const fixedY = 100;
    const direction = isSwipeLeft ? -1 : 1;
    const endX = startX + (swipeDistance * direction);
    
    // Touch start
    act(() => {
      result.current.handlers.onTouchStart(
        createMockTouchEvent(startX, fixedY) as ReactTouchEvent
      );
    });
    
    // First touch move - establish horizontal direction (move >10px to set isHorizontalSwipe)
    const firstMoveX = startX + (12 * direction);
    act(() => {
      result.current.handlers.onTouchMove(
        createMockTouchEvent(firstMoveX, fixedY) as ReactTouchEvent
      );
    });
    
    // Second touch move - move to final position
    act(() => {
      result.current.handlers.onTouchMove(
        createMockTouchEvent(endX, fixedY) as ReactTouchEvent
      );
    });
    
    // Touch end
    act(() => {
      result.current.handlers.onTouchEnd(
        createMockTouchEvent(endX, fixedY) as ReactTouchEvent
      );
    });
  }

  /**
   * Property 6.1: Swipe well below threshold does not trigger left navigation
   * 
   * *For any* swipe left gesture with distance below the velocity minimum (25px),
   * the onSwipeLeft callback should NOT be triggered regardless of velocity.
   */
  describe('Property 6.1: Swipe left below minimum threshold does not navigate', () => {
    it('swiping left below velocity minimum distance should not call onSwipeLeft', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 13, max: Math.floor(VELOCITY_MIN_DISTANCE) - 1 }), // 13-24px (must be >12 for horizontal detection)
          fc.integer({ min: 0, max: 2 }), // tab indices 0-2 (not last tab)
          async (swipeDistance, tabIndex) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: tabIndex === 0,
              })
            );
            
            // Simulate swipe left below velocity minimum threshold
            await simulateSlowBelowThresholdSwipe(result, 200, swipeDistance, true);
            
            // Neither callback should be called - swipe was below minimum threshold
            expect(onSwipeLeft).not.toHaveBeenCalled();
            expect(onSwipeRight).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.2: Swipe well below threshold does not trigger right navigation
   * 
   * *For any* swipe right gesture with distance below the velocity minimum (25px),
   * the onSwipeRight callback should NOT be triggered regardless of velocity.
   */
  describe('Property 6.2: Swipe right below minimum threshold does not navigate', () => {
    it('swiping right below velocity minimum distance should not call onSwipeRight', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 13, max: Math.floor(VELOCITY_MIN_DISTANCE) - 1 }), // 13-24px
          fc.integer({ min: 1, max: 3 }), // tab indices 1-3 (not first tab)
          async (swipeDistance, tabIndex) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: tabIndex === 3,
                disableSwipeRight: false,
              })
            );
            
            // Simulate swipe right below velocity minimum threshold
            await simulateSlowBelowThresholdSwipe(result, 100, swipeDistance, false);
            
            // Neither callback should be called - swipe was below minimum threshold
            expect(onSwipeLeft).not.toHaveBeenCalled();
            expect(onSwipeRight).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Helper to simulate a complete horizontal swipe at or above threshold
   * This ensures the swipe is recognized as horizontal and meets the threshold
   */
  async function simulateThresholdSwipe(
    result: { current: ReturnType<typeof useSwipeGesture> },
    startX: number,
    endX: number
  ): Promise<void> {
    const fixedY = 100;
    const direction = endX > startX ? 1 : -1;
    
    // Touch start
    act(() => {
      result.current.handlers.onTouchStart(
        createMockTouchEvent(startX, fixedY) as ReactTouchEvent
      );
    });
    
    // First touch move - establish horizontal direction (move >10px horizontally)
    const firstMoveX = startX + (15 * direction);
    act(() => {
      result.current.handlers.onTouchMove(
        createMockTouchEvent(firstMoveX, fixedY) as ReactTouchEvent
      );
    });
    
    // Second touch move - move to final position
    act(() => {
      result.current.handlers.onTouchMove(
        createMockTouchEvent(endX, fixedY) as ReactTouchEvent
      );
    });
    
    // Touch end
    act(() => {
      result.current.handlers.onTouchEnd(
        createMockTouchEvent(endX, fixedY) as ReactTouchEvent
      );
    });
  }

  /**
   * Property 6.3: Boundary case - exactly at threshold triggers navigation
   * 
   * *For any* swipe gesture with distance exactly at the threshold (50px),
   * the navigation callback SHOULD be triggered.
   */
  describe('Property 6.3: Swipe exactly at threshold triggers navigation', () => {
    it('swiping exactly at threshold should trigger navigation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // true = swipe left, false = swipe right
          async (isSwipeLeft) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: false,
              })
            );
            
            // Simulate swipe exactly at threshold
            await simulateThresholdSwipe(
              result, 
              200, 
              isSwipeLeft ? 200 - DEFAULT_THRESHOLD : 200 + DEFAULT_THRESHOLD
            );
            
            // The appropriate callback should be called
            if (isSwipeLeft) {
              expect(onSwipeLeft).toHaveBeenCalledTimes(1);
              expect(onSwipeRight).not.toHaveBeenCalled();
            } else {
              expect(onSwipeRight).toHaveBeenCalledTimes(1);
              expect(onSwipeLeft).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.4: Just below velocity minimum threshold does not trigger navigation
   * 
   * *For any* swipe gesture with distance just below the velocity minimum (24px),
   * the navigation callback should NOT be triggered.
   */
  describe('Property 6.4: Swipe just below velocity minimum does not navigate', () => {
    it('swiping at velocity minimum - 1 should not trigger navigation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // true = swipe left, false = swipe right
          async (isSwipeLeft) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: false,
              })
            );
            
            // Simulate swipe just below velocity minimum (24px)
            const justBelowVelocityMin = Math.floor(VELOCITY_MIN_DISTANCE) - 1;
            await simulateSlowBelowThresholdSwipe(result, 200, justBelowVelocityMin, isSwipeLeft);
            
            // Neither callback should be called
            expect(onSwipeLeft).not.toHaveBeenCalled();
            expect(onSwipeRight).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.5: Tab index remains unchanged for any below-minimum-threshold swipe
   * 
   * *For any* tab index and any swipe direction with distance below velocity minimum,
   * the tab index should remain unchanged (no navigation occurs).
   */
  describe('Property 6.5: Tab index unchanged for below-minimum-threshold swipes', () => {
    it('any below-minimum-threshold swipe should not change tab regardless of position', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 3 }), // any tab index
          fc.boolean(), // swipe direction
          fc.integer({ min: 13, max: Math.floor(VELOCITY_MIN_DISTANCE) - 1 }), // 13-24px
          async (tabIndex, isSwipeLeft, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const isFirstTab = tabIndex === 0;
            const isLastTab = tabIndex === 3;
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: isLastTab,
                disableSwipeRight: isFirstTab,
              })
            );
            
            // Simulate below-minimum-threshold swipe
            await simulateSlowBelowThresholdSwipe(result, 200, swipeDistance, isSwipeLeft);
            
            // Neither callback should be called regardless of tab position
            // because the swipe distance is below minimum threshold
            expect(onSwipeLeft).not.toHaveBeenCalled();
            expect(onSwipeRight).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.6: Offset resets after below-threshold swipe
   * 
   * *For any* below-threshold swipe, the offset should reset to 0 after
   * the swipe ends (even though no navigation occurred).
   */
  describe('Property 6.6: Offset resets after below-threshold swipe', () => {
    it('offset should reset to 0 after below-threshold swipe', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // swipe direction
          fc.integer({ min: 13, max: Math.floor(VELOCITY_MIN_DISTANCE) - 1 }), // 13-24px
          async (isSwipeLeft, swipeDistance) => {
            const onSwipeLeft = jest.fn();
            const onSwipeRight = jest.fn();
            
            const { result } = renderHook(() =>
              useSwipeGesture({
                onSwipeLeft,
                onSwipeRight,
                disableSwipeLeft: false,
                disableSwipeRight: false,
              })
            );
            
            // Simulate below-threshold swipe
            await simulateSlowBelowThresholdSwipe(result, 200, swipeDistance, isSwipeLeft);
            
            // After swipe completes, offset should be reset to 0
            expect(result.current.offset).toBe(0);
            expect(result.current.isDragging).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
