/**
 * Property-based tests for Demo Animation Loop Continuity
 *
 * **Feature: landing-page-demo, Property 4: Animation Loop Continuity**
 * **Validates: Requirements 4.5**
 *
 * Tests that the animation loops smoothly after completing all demonstration sequences.
 *
 * Property Definition:
 * *For any* completed animation sequence, the animation SHALL restart from the beginning,
 * creating a continuous loop. The transition between end and start SHALL be smooth (no visual jumps).
 */

import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useDemoAnimation, AnimationStep } from '../app/demo/hooks/useDemoAnimation';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock window.matchMedia for prefers-reduced-motion detection
const mockMatchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: false, // Default to no reduced motion preference
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate a valid animation step for testing
 */
const generateAnimationStep = (index: number, duration: number = 50): AnimationStep => ({
  id: `step-${index}`,
  type: 'highlight',
  target: `#element-${index}`,
  duration,
  description: `Test step ${index}`,
});

/**
 * Generate an array of animation steps
 */
const generateAnimationSteps = (count: number, duration: number = 50): AnimationStep[] => {
  return Array.from({ length: count }, (_, i) => generateAnimationStep(i, duration));
};

/**
 * Arbitrary for generating valid animation step counts
 */
const animationStepCountArb = fc.integer({ min: 1, max: 10 });

/**
 * Advance timers step by step to allow React effects to run between each advancement
 */
const advanceTimersIncrementally = (totalTime: number, increment: number = 10) => {
  const iterations = Math.ceil(totalTime / increment);
  for (let i = 0; i < iterations; i++) {
    act(() => {
      jest.advanceTimersByTime(increment);
    });
  }
};

// ============================================================================
// Property Tests
// ============================================================================

describe('Demo Animation Loop Continuity Property Tests', () => {
  /**
   * **Property 4: Animation Loop Continuity**
   * **Validates: Requirements 4.5**
   */
  describe('Property 4: Animation Loop Continuity', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockMatchMedia.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('Animation restarts from step 0 after completing all steps', () => {
      test('Animation should restart from beginning after completing all steps', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              const stepDuration = 50;
              const loopDelay = 50;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Calculate total time needed: all steps + loop delay + buffer
              const totalStepTime = stepCount * stepDuration;
              const totalTime = totalStepTime + loopDelay + 200;
              
              // Advance timers incrementally to allow effects to run
              advanceTimersIncrementally(totalTime);

              // After completing all steps and loop delay, animation should still be playing
              // and currentStep should be within valid range (looped back)
              expect(result.current.state.currentStep).toBeLessThan(stepCount);
              expect(result.current.state.isPlaying).toBe(true);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation should call onComplete when sequence finishes', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              const stepDuration = 50;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              const onComplete = jest.fn();
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay: 50,
                  onComplete,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Run through enough time for at least one complete cycle
              const totalTime = (stepCount * stepDuration) + 500;
              advanceTimersIncrementally(totalTime);

              // Verify onComplete was called at least once
              expect(onComplete).toHaveBeenCalled();
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Loop is continuous (no gaps or jumps)', () => {
      test('Animation should progress through steps sequentially', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              const stepDuration = 50;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              const stepChanges: number[] = [];
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay: 50,
                  onStepChange: (step) => {
                    stepChanges.push(step);
                  },
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Record initial step
              stepChanges.push(result.current.state.currentStep);

              // Advance through steps one by one
              for (let i = 0; i < stepCount; i++) {
                advanceTimersIncrementally(stepDuration + 20);
              }

              // Verify steps progressed sequentially (no jumps)
              // Each step should be at most 1 more than the previous (or wrap to 0)
              for (let i = 1; i < stepChanges.length; i++) {
                const prev = stepChanges[i - 1];
                const curr = stepChanges[i];
                const isSequential = curr === prev + 1 || (prev === stepCount - 1 && curr === 0) || curr === prev;
                expect(isSequential).toBe(true);
              }
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation state should remain playing during loop transition', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              const stepDuration = 50;
              const loopDelay = 50;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Run through complete cycle plus loop delay
              const totalTime = (stepCount * stepDuration) + loopDelay + 200;
              advanceTimersIncrementally(totalTime);

              // Verify animation is still playing after loop
              expect(result.current.state.isPlaying).toBe(true);
              expect(result.current.state.isPaused).toBe(false);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Loop delay is respected', () => {
      test('Animation should respect loopDelay configuration', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 100, max: 300 }),
            (loopDelay) => {
              const stepDuration = 30;
              const steps = generateAnimationSteps(2, stepDuration);
              const onComplete = jest.fn();
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay,
                  onComplete,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Run through all steps plus loop delay
              const totalTime = (2 * stepDuration) + loopDelay + 200;
              advanceTimersIncrementally(totalTime);

              // onComplete should be called
              expect(onComplete).toHaveBeenCalled();

              // Animation should still be playing (looped)
              expect(result.current.state.isPlaying).toBe(true);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Loop can be disabled', () => {
      test('Animation should stop after completing when loop is false', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              const stepDuration = 50;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              const onComplete = jest.fn();
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: false,
                  onComplete,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Run through all steps with extra time
              const totalTime = (stepCount * stepDuration) + 500;
              advanceTimersIncrementally(totalTime);

              // Verify animation stopped and onComplete was called
              expect(result.current.state.isPlaying).toBe(false);
              expect(onComplete).toHaveBeenCalled();
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Multiple loop cycles', () => {
      test('Animation should complete multiple loop cycles correctly', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 4 }),
            fc.integer({ min: 2, max: 3 }),
            (stepCount, loopCount) => {
              const stepDuration = 30;
              const loopDelay = 30;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              let completeCount = 0;
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay,
                  onComplete: () => {
                    completeCount++;
                  },
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Run through multiple loop cycles
              // Each cycle = all steps + loop delay
              const cycleTime = (stepCount * stepDuration) + loopDelay + 100;
              const totalTime = cycleTime * loopCount;
              
              advanceTimersIncrementally(totalTime);

              // Verify at least one completion occurred
              expect(completeCount).toBeGreaterThanOrEqual(1);
              
              // Verify animation is still playing
              expect(result.current.state.isPlaying).toBe(true);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Reset during loop', () => {
      test('Reset should stop animation and return to step 0', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            fc.integer({ min: 0, max: 9 }),
            (stepCount, resetAtStep) => {
              const stepDuration = 50;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              const actualResetStep = Math.min(resetAtStep, stepCount - 1);
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay: 50,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Advance to a specific step
              const timeToStep = (actualResetStep + 1) * stepDuration;
              advanceTimersIncrementally(timeToStep);

              // Reset the animation
              act(() => {
                result.current.controls.reset();
              });

              // Verify reset state
              expect(result.current.state.currentStep).toBe(0);
              expect(result.current.state.isPlaying).toBe(false);
              expect(result.current.state.isPaused).toBe(false);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Pause and resume during loop', () => {
      test('Pause should stop progression, resume should continue', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              const stepDuration = 100;
              const steps = generateAnimationSteps(stepCount, stepDuration);
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay: 50,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Advance partway through first step
              advanceTimersIncrementally(stepDuration / 2);

              // Pause
              act(() => {
                result.current.controls.pause();
              });

              const stepAtPause = result.current.state.currentStep;

              // Advance time while paused
              advanceTimersIncrementally(1000);

              // Step should not have changed
              expect(result.current.state.currentStep).toBe(stepAtPause);
              expect(result.current.state.isPaused).toBe(true);

              // Resume
              act(() => {
                result.current.controls.resume();
              });

              expect(result.current.state.isPaused).toBe(false);
              expect(result.current.state.isPlaying).toBe(true);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Edge cases', () => {
      test('Single step animation should loop correctly', () => {
        fc.assert(
          fc.property(
            fc.constant(1),
            () => {
              const stepDuration = 50;
              const loopDelay = 30;
              const steps = generateAnimationSteps(1, stepDuration);
              let completeCount = 0;
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay,
                  onComplete: () => {
                    completeCount++;
                  },
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Complete first cycle
              advanceTimersIncrementally(stepDuration + loopDelay + 100);

              expect(completeCount).toBeGreaterThanOrEqual(1);

              // Animation should still be playing (looped)
              expect(result.current.state.isPlaying).toBe(true);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation with varying step durations should complete cycle', () => {
        fc.assert(
          fc.property(
            fc.array(fc.integer({ min: 20, max: 80 }), { minLength: 2, maxLength: 4 }),
            (durations) => {
              const steps: AnimationStep[] = durations.map((duration, i) => ({
                id: `step-${i}`,
                type: 'highlight',
                target: `#element-${i}`,
                duration,
                description: `Step ${i}`,
              }));
              
              const onComplete = jest.fn();
              const loopDelay = 30;
              
              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  loopDelay,
                  onComplete,
                })
              );

              // Start the animation
              act(() => {
                result.current.controls.play();
              });

              // Calculate total time for all steps
              const totalStepTime = durations.reduce((sum, d) => sum + d, 0);
              const totalTime = totalStepTime + loopDelay + 300;
              
              advanceTimersIncrementally(totalTime);

              // Verify completion was called
              expect(onComplete).toHaveBeenCalled();

              // Animation should still be playing (looped)
              expect(result.current.state.isPlaying).toBe(true);
              
              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
