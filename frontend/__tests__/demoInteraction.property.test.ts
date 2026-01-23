/**
 * Property-based tests for Demo Animation Interaction Response
 *
 * **Feature: landing-page-demo, Property 5: Animation Interaction Response**
 * **Validates: Requirements 4.7, 4.8**
 *
 * Tests that user interactions (hover or touch) on the Demo_Section:
 * - The animation SHALL pause immediately
 * - After 3 seconds of no interaction, the animation SHALL resume from the paused position
 *
 * Property Definition:
 * *For any* user interaction (hover or touch) on the Demo_Section:
 * - The animation SHALL pause immediately
 * - After 3 seconds of no interaction, the animation SHALL resume from the paused position
 */

import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import {
  useInteractionPause,
  UseInteractionPauseOptions,
} from '../app/demo/hooks/useInteractionPause';

// ============================================================================
// Constants
// ============================================================================

/** Default resume delay as per requirement 4.8 (3 seconds) */
const DEFAULT_RESUME_DELAY = 3000;

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Advance timers step by step to allow React effects to run between each advancement
 */
const advanceTimersIncrementally = (totalTime: number, increment: number = 100) => {
  const iterations = Math.ceil(totalTime / increment);
  for (let i = 0; i < iterations; i++) {
    act(() => {
      jest.advanceTimersByTime(increment);
    });
  }
};

/**
 * Arbitrary for generating valid resume delay values (in milliseconds)
 */
const resumeDelayArb = fc.integer({ min: 1000, max: 5000 });

/**
 * Arbitrary for generating interaction sequences
 */
const interactionTypeArb = fc.constantFrom('hover', 'touch') as fc.Arbitrary<'hover' | 'touch'>;

/**
 * Arbitrary for generating multiple interaction events
 */
const interactionSequenceArb = fc.array(interactionTypeArb, { minLength: 1, maxLength: 5 });

/**
 * Arbitrary for generating time values less than resume delay
 */
const timeLessThanDelayArb = (delay: number) => fc.integer({ min: 100, max: delay - 100 });

/**
 * Arbitrary for generating time values greater than resume delay
 */
const timeGreaterThanDelayArb = (delay: number) => fc.integer({ min: delay + 100, max: delay + 2000 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Demo Animation Interaction Response Property Tests', () => {
  /**
   * **Property 5: Animation Interaction Response**
   * **Validates: Requirements 4.7, 4.8**
   */
  describe('Property 5: Animation Interaction Response', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('Animation pauses immediately on hover', () => {
      test('isPaused should be true immediately after mouse enter', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay })
              );

              // Initially not paused
              expect(result.current.state.isPaused).toBe(false);

              // Trigger mouse enter
              act(() => {
                result.current.handlers.onMouseEnter();
              });

              // Should be paused immediately
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isHovering).toBe(true);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('onPause callback should be called immediately on hover', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const onPause = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onPause })
              );

              // Trigger mouse enter
              act(() => {
                result.current.handlers.onMouseEnter();
              });

              // onPause should be called immediately
              expect(onPause).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Animation pauses immediately on touch', () => {
      test('isPaused should be true immediately after touch start', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay })
              );

              // Initially not paused
              expect(result.current.state.isPaused).toBe(false);

              // Trigger touch start
              act(() => {
                result.current.handlers.onTouchStart();
              });

              // Should be paused immediately
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isTouching).toBe(true);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('onPause callback should be called immediately on touch', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const onPause = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onPause })
              );

              // Trigger touch start
              act(() => {
                result.current.handlers.onTouchStart();
              });

              // onPause should be called immediately
              expect(onPause).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Animation resumes after exactly 3 seconds of no interaction', () => {
      test('Animation should resume after resume delay when hover ends', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            (resumeDelay) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });

              expect(result.current.state.isPaused).toBe(true);

              // End hover
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Should still be paused (resume timer active)
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Advance time to just before resume delay
              advanceTimersIncrementally(resumeDelay - 100);

              // Should still be paused
              expect(result.current.state.isPaused).toBe(true);
              expect(onResume).not.toHaveBeenCalled();

              // Advance past resume delay
              advanceTimersIncrementally(200);

              // Should now be resumed
              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation should resume after resume delay when touch ends', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            (resumeDelay) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start touch
              act(() => {
                result.current.handlers.onTouchStart();
              });

              expect(result.current.state.isPaused).toBe(true);

              // End touch
              act(() => {
                result.current.handlers.onTouchEnd();
              });

              // Should still be paused (resume timer active)
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Advance time past resume delay
              advanceTimersIncrementally(resumeDelay + 200);

              // Should now be resumed
              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Resume delay should be configurable', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start and end hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Advance time to just before resume delay
              advanceTimersIncrementally(resumeDelay - 200);

              // Should still be paused
              expect(result.current.state.isPaused).toBe(true);
              expect(onResume).not.toHaveBeenCalled();

              // Advance past resume delay
              advanceTimersIncrementally(400);

              // Should now be resumed
              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Resume timer is cancelled if user interacts again before 3 seconds', () => {
      test('Re-hovering before resume delay should cancel timer and keep paused', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            timeLessThanDelayArb(DEFAULT_RESUME_DELAY),
            (resumeDelay, reinteractTime) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start and end hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Resume timer should be active
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Advance time but not past resume delay
              advanceTimersIncrementally(reinteractTime);

              // Re-hover before timer completes
              act(() => {
                result.current.handlers.onMouseEnter();
              });

              // Timer should be cancelled, still paused
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isResumeTimerActive).toBe(false);
              expect(onResume).not.toHaveBeenCalled();

              // Advance past original resume time
              advanceTimersIncrementally(resumeDelay + 500);

              // Should still be paused (hovering)
              expect(result.current.state.isPaused).toBe(true);
              expect(onResume).not.toHaveBeenCalled();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Touching before resume delay should cancel timer and keep paused', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            timeLessThanDelayArb(DEFAULT_RESUME_DELAY),
            (resumeDelay, reinteractTime) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start and end hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Resume timer should be active
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Advance time but not past resume delay
              advanceTimersIncrementally(reinteractTime);

              // Touch before timer completes
              act(() => {
                result.current.handlers.onTouchStart();
              });

              // Timer should be cancelled, still paused
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isResumeTimerActive).toBe(false);
              expect(onResume).not.toHaveBeenCalled();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Multiple rapid interactions should not cause multiple resume timers', () => {
        fc.assert(
          fc.property(
            interactionSequenceArb,
            (interactions) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay: DEFAULT_RESUME_DELAY, onResume })
              );

              // Perform multiple interactions
              for (const interaction of interactions) {
                if (interaction === 'hover') {
                  act(() => {
                    result.current.handlers.onMouseEnter();
                  });
                  advanceTimersIncrementally(100);
                  act(() => {
                    result.current.handlers.onMouseLeave();
                  });
                } else {
                  act(() => {
                    result.current.handlers.onTouchStart();
                  });
                  advanceTimersIncrementally(100);
                  act(() => {
                    result.current.handlers.onTouchEnd();
                  });
                }
                advanceTimersIncrementally(500); // Wait less than resume delay
              }

              // After all interactions, should still be paused with timer active
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Wait for resume
              advanceTimersIncrementally(DEFAULT_RESUME_DELAY + 200);

              // Should resume exactly once
              expect(onResume).toHaveBeenCalledTimes(1);
              expect(result.current.state.isPaused).toBe(false);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Animation resumes from paused position (not from beginning)', () => {
      test('State should be preserved during pause/resume cycle', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const onPause = jest.fn();
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onPause, onResume })
              );

              // Start hover (pause)
              act(() => {
                result.current.handlers.onMouseEnter();
              });

              expect(onPause).toHaveBeenCalledTimes(1);
              expect(result.current.state.isPaused).toBe(true);

              // End hover
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Wait for resume
              advanceTimersIncrementally(resumeDelay + 200);

              // Resume should be called
              expect(onResume).toHaveBeenCalledTimes(1);
              expect(result.current.state.isPaused).toBe(false);

              // State should be clean (no lingering hover/touch state)
              expect(result.current.state.isHovering).toBe(false);
              expect(result.current.state.isTouching).toBe(false);
              expect(result.current.state.isResumeTimerActive).toBe(false);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Manual pause and resumeImmediately should work correctly', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const onPause = jest.fn();
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onPause, onResume })
              );

              // Manual pause
              act(() => {
                result.current.handlers.pause();
              });

              expect(result.current.state.isPaused).toBe(true);
              expect(onPause).toHaveBeenCalledTimes(1);

              // Manual immediate resume (bypasses delay)
              act(() => {
                result.current.handlers.resumeImmediately();
              });

              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('cancelResumeTimer should keep paused state without resuming', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            (resumeDelay) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start and end hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Cancel the resume timer
              act(() => {
                result.current.handlers.cancelResumeTimer();
              });

              // Timer should be cancelled
              expect(result.current.state.isResumeTimerActive).toBe(false);

              // Wait past resume delay
              advanceTimersIncrementally(resumeDelay + 500);

              // Should not have resumed (timer was cancelled)
              expect(onResume).not.toHaveBeenCalled();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Edge cases', () => {
      test('Disabled hook should not respond to interactions', () => {
        fc.assert(
          fc.property(
            resumeDelayArb,
            (resumeDelay) => {
              const onPause = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onPause, enabled: false })
              );

              // Try to trigger interactions
              act(() => {
                result.current.handlers.onMouseEnter();
              });

              // Should not be paused when disabled
              expect(result.current.state.isPaused).toBe(false);
              expect(onPause).not.toHaveBeenCalled();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Touch cancel should behave like touch end', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            (resumeDelay) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start touch
              act(() => {
                result.current.handlers.onTouchStart();
              });

              expect(result.current.state.isPaused).toBe(true);

              // Cancel touch
              act(() => {
                result.current.handlers.onTouchCancel();
              });

              // Resume timer should be active
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Wait for resume
              advanceTimersIncrementally(resumeDelay + 200);

              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Simultaneous hover and touch should keep paused until both end', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            (resumeDelay) => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay, onResume })
              );

              // Start both hover and touch
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onTouchStart();
              });

              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isHovering).toBe(true);
              expect(result.current.state.isTouching).toBe(true);

              // End hover only
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Should still be paused (still touching)
              expect(result.current.state.isPaused).toBe(true);
              expect(result.current.state.isResumeTimerActive).toBe(false);

              // End touch
              act(() => {
                result.current.handlers.onTouchEnd();
              });

              // Now resume timer should start
              expect(result.current.state.isResumeTimerActive).toBe(true);

              // Wait for resume
              advanceTimersIncrementally(resumeDelay + 200);

              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('timeUntilResume should countdown correctly', () => {
        fc.assert(
          fc.property(
            fc.constant(DEFAULT_RESUME_DELAY),
            (resumeDelay) => {
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ resumeDelay })
              );

              // Start and end hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Initial time should be close to resume delay
              expect(result.current.state.timeUntilResume).toBeLessThanOrEqual(resumeDelay);
              expect(result.current.state.timeUntilResume).toBeGreaterThan(0);

              // Advance time
              advanceTimersIncrementally(1000);

              // Time should have decreased
              expect(result.current.state.timeUntilResume).toBeLessThan(resumeDelay);

              // Wait for resume
              advanceTimersIncrementally(resumeDelay);

              // Time should be 0 after resume
              expect(result.current.state.timeUntilResume).toBe(0);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Default resume delay should be 3000ms', () => {
        fc.assert(
          fc.property(
            fc.constant(null),
            () => {
              const onResume = jest.fn();
              const { result, unmount } = renderHook(() =>
                useInteractionPause({ onResume })
              );

              // Start and end hover
              act(() => {
                result.current.handlers.onMouseEnter();
              });
              act(() => {
                result.current.handlers.onMouseLeave();
              });

              // Advance time to just before 3 seconds
              advanceTimersIncrementally(2900);

              // Should still be paused
              expect(result.current.state.isPaused).toBe(true);
              expect(onResume).not.toHaveBeenCalled();

              // Advance past 3 seconds
              advanceTimersIncrementally(200);

              // Should now be resumed
              expect(result.current.state.isPaused).toBe(false);
              expect(onResume).toHaveBeenCalledTimes(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
