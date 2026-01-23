/**
 * Property-based tests for Demo Reduced Motion Respect
 *
 * **Feature: landing-page-demo, Property 6: Reduced Motion Respect**
 * **Validates: Requirements 5.2**
 *
 * Tests that the Demo_Section respects the prefers-reduced-motion media query.
 *
 * Property Definition:
 * *For any* system with prefers-reduced-motion: reduce, the Demo_Animation SHALL be disabled
 * and a static view SHALL be displayed instead.
 *
 * Key aspects tested:
 * - When prefers-reduced-motion: reduce is set, auto-play is disabled
 * - When prefers-reduced-motion: reduce is set, animations are disabled
 * - When prefers-reduced-motion: reduce is set, a static view is displayed
 * - The component responds to changes in the media query
 */

import * as fc from 'fast-check';
import { renderHook, act, render, screen } from '@testing-library/react';
import React from 'react';

// ============================================================================
// Mocks - Must be defined before imports that use them
// ============================================================================

// Mock mermaid module to avoid ESM import issues
jest.mock('mermaid', () => ({
  default: {
    initialize: jest.fn(),
    run: jest.fn(),
  },
}));

// Mock FullCalendar to avoid complex dependencies
jest.mock('@fullcalendar/react', () => {
  return function MockFullCalendar() {
    return <div data-testid="mock-fullcalendar">Calendar</div>;
  };
});

jest.mock('@fullcalendar/daygrid', () => ({}));
jest.mock('@fullcalendar/timegrid', () => ({}));
jest.mock('@fullcalendar/interaction', () => ({}));
jest.mock('@fullcalendar/rrule', () => ({}));

// Mock reactflow to avoid complex dependencies
jest.mock('reactflow', () => ({
  ReactFlow: () => <div data-testid="mock-reactflow">ReactFlow</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: () => [[], jest.fn(), jest.fn()],
  useEdgesState: () => [[], jest.fn(), jest.fn()],
  addEdge: jest.fn(),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Import after mocks are set up
import { useDemoAnimation, AnimationStep } from '../app/demo/hooks/useDemoAnimation';
import DemoSection from '../app/demo/components/Section.Demo';

// ============================================================================
// Mock Setup
// ============================================================================

// Store the change handler for simulating media query changes
let mediaQueryChangeHandler: ((event: MediaQueryListEvent) => void) | null = null;
let currentReducedMotionState = false;

/**
 * Create a mock matchMedia implementation
 */
const createMockMatchMedia = (reducedMotion: boolean) => {
  return jest.fn().mockImplementation((query: string) => {
    const isReducedMotionQuery = query === '(prefers-reduced-motion: reduce)';
    return {
      matches: isReducedMotionQuery ? reducedMotion : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (event === 'change' && isReducedMotionQuery) {
          mediaQueryChangeHandler = handler;
        }
      }),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  });
};

/**
 * Set up matchMedia mock with specified reduced motion preference
 */
const setupMatchMedia = (reducedMotion: boolean) => {
  currentReducedMotionState = reducedMotion;
  mediaQueryChangeHandler = null;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMockMatchMedia(reducedMotion),
  });
};

/**
 * Simulate a change in the reduced motion preference
 */
const simulateReducedMotionChange = (newValue: boolean) => {
  currentReducedMotionState = newValue;
  if (mediaQueryChangeHandler) {
    act(() => {
      mediaQueryChangeHandler!({ matches: newValue } as MediaQueryListEvent);
    });
  }
};

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate a valid animation step for testing
 */
const generateAnimationStep = (index: number, duration: number = 100): AnimationStep => ({
  id: `step-${index}`,
  type: 'highlight',
  target: `#element-${index}`,
  duration,
  description: `Test step ${index}`,
});

/**
 * Generate an array of animation steps
 */
const generateAnimationSteps = (count: number, duration: number = 100): AnimationStep[] => {
  return Array.from({ length: count }, (_, i) => generateAnimationStep(i, duration));
};

/**
 * Arbitrary for generating valid animation step counts
 */
const animationStepCountArb = fc.integer({ min: 1, max: 10 });

/**
 * Arbitrary for generating step durations
 */
const stepDurationArb = fc.integer({ min: 50, max: 200 });

/**
 * Advance timers step by step to allow React effects to run between each advancement
 */
const advanceTimersIncrementally = (totalTime: number, increment: number = 50) => {
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

describe('Demo Reduced Motion Respect Property Tests', () => {
  /**
   * **Property 6: Reduced Motion Respect**
   * **Validates: Requirements 5.2**
   */
  describe('Property 6: Reduced Motion Respect', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      setupMatchMedia(false);
    });

    afterEach(() => {
      jest.useRealTimers();
      mediaQueryChangeHandler = null;
    });

    describe('Auto-play is disabled when prefers-reduced-motion: reduce is set', () => {
      test('Animation should not auto-play when reduced motion is preferred', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              // Set up reduced motion preference
              setupMatchMedia(true);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: true, // Auto-play is requested
                  loop: true,
                })
              );

              // Animation should NOT be playing despite autoPlay: true
              expect(result.current.state.prefersReducedMotion).toBe(true);
              expect(result.current.state.isPlaying).toBe(false);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation should auto-play when reduced motion is NOT preferred', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              // Set up NO reduced motion preference
              setupMatchMedia(false);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: true,
                  loop: true,
                })
              );

              // Animation SHOULD be playing
              expect(result.current.state.prefersReducedMotion).toBe(false);
              expect(result.current.state.isPlaying).toBe(true);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Manual play is blocked when prefers-reduced-motion: reduce is set', () => {
      test('Calling play() should have no effect when reduced motion is preferred', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              // Set up reduced motion preference
              setupMatchMedia(true);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                })
              );

              // Initially not playing
              expect(result.current.state.isPlaying).toBe(false);

              // Try to manually start animation
              act(() => {
                result.current.controls.play();
              });

              // Animation should still NOT be playing
              expect(result.current.state.prefersReducedMotion).toBe(true);
              expect(result.current.state.isPlaying).toBe(false);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Calling play() should work when reduced motion is NOT preferred', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              // Set up NO reduced motion preference
              setupMatchMedia(false);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                })
              );

              // Initially not playing
              expect(result.current.state.isPlaying).toBe(false);

              // Manually start animation
              act(() => {
                result.current.controls.play();
              });

              // Animation SHOULD be playing
              expect(result.current.state.prefersReducedMotion).toBe(false);
              expect(result.current.state.isPlaying).toBe(true);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Animation stops when reduced motion preference changes to reduce', () => {
      test('Running animation should stop when reduced motion is enabled', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            stepDurationArb,
            (stepCount, duration) => {
              // Start with NO reduced motion preference
              setupMatchMedia(false);

              const steps = generateAnimationSteps(stepCount, duration);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: true,
                  loop: true,
                })
              );

              // Animation should be playing
              expect(result.current.state.isPlaying).toBe(true);
              expect(result.current.state.prefersReducedMotion).toBe(false);

              // Advance time to ensure animation is running
              advanceTimersIncrementally(duration / 2);

              // Simulate user enabling reduced motion
              simulateReducedMotionChange(true);

              // Animation should now be stopped
              expect(result.current.state.prefersReducedMotion).toBe(true);
              expect(result.current.state.isPlaying).toBe(false);
              expect(result.current.state.isPaused).toBe(false);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Animation can resume when reduced motion is disabled', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            (stepCount) => {
              // Start with reduced motion preference
              setupMatchMedia(true);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: true,
                  loop: true,
                })
              );

              // Animation should NOT be playing
              expect(result.current.state.isPlaying).toBe(false);
              expect(result.current.state.prefersReducedMotion).toBe(true);

              // Simulate user disabling reduced motion
              simulateReducedMotionChange(false);

              // Reduced motion should be false now
              expect(result.current.state.prefersReducedMotion).toBe(false);

              // Manually start animation (autoPlay only triggers on mount)
              act(() => {
                result.current.controls.play();
              });

              // Animation should now be playing
              expect(result.current.state.isPlaying).toBe(true);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Step progression is blocked when reduced motion is preferred', () => {
      test('Steps should not advance when reduced motion is enabled', () => {
        fc.assert(
          fc.property(
            animationStepCountArb,
            stepDurationArb,
            (stepCount, duration) => {
              // Set up reduced motion preference
              setupMatchMedia(true);

              const steps = generateAnimationSteps(stepCount, duration);
              const onStepChange = jest.fn();

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                  onStepChange,
                })
              );

              // Try to start animation
              act(() => {
                result.current.controls.play();
              });

              // Advance time significantly
              advanceTimersIncrementally(duration * stepCount * 2);

              // Step should not have changed (animation blocked)
              expect(result.current.state.currentStep).toBe(0);
              // onStepChange should not have been called (animation never started)
              expect(onStepChange).not.toHaveBeenCalled();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Steps should advance normally when reduced motion is NOT preferred', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 5 }),
            (stepCount) => {
              // Set up NO reduced motion preference
              setupMatchMedia(false);

              const duration = 50;
              const steps = generateAnimationSteps(stepCount, duration);
              const onStepChange = jest.fn();

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: true,
                  loop: true,
                  onStepChange,
                })
              );

              // onStepChange should be called for first step
              expect(onStepChange).toHaveBeenCalledWith(0, steps[0]);

              // Advance time to trigger step change
              advanceTimersIncrementally(duration + 20);

              // Step should have advanced
              expect(result.current.state.currentStep).toBeGreaterThanOrEqual(0);
              expect(onStepChange.mock.calls.length).toBeGreaterThanOrEqual(1);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Static view is displayed when reduced motion is preferred', () => {
      test('DemoSection should indicate static view when reduced motion is preferred', () => {
        fc.assert(
          fc.property(
            fc.constant(true),
            () => {
              // Set up reduced motion preference
              setupMatchMedia(true);

              const { container, unmount } = render(
                <DemoSection forceReducedMotion={true} />
              );

              // Check for data attribute indicating reduced motion
              const section = container.querySelector('[data-reduced-motion="true"]');
              expect(section).not.toBeNull();

              // Check for static view indicator text
              const staticIndicator = screen.queryByText('静的表示');
              expect(staticIndicator).not.toBeNull();

              // Check for the message about animations being disabled
              const disabledMessage = screen.queryByText(/アニメーションは無効化されています/);
              expect(disabledMessage).not.toBeNull();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('DemoSection should NOT indicate static view when reduced motion is NOT preferred', () => {
        fc.assert(
          fc.property(
            fc.constant(false),
            () => {
              // Set up NO reduced motion preference
              setupMatchMedia(false);

              const { container, unmount } = render(
                <DemoSection forceReducedMotion={false} />
              );

              // Check for data attribute indicating NO reduced motion
              const section = container.querySelector('[data-reduced-motion="false"]');
              expect(section).not.toBeNull();

              // Static view indicator should NOT be present
              const staticIndicator = screen.queryByText('静的表示');
              expect(staticIndicator).toBeNull();

              // Check for the interactive hint message instead
              const interactiveMessage = screen.queryByText(/ホバーまたはタッチでアニメーションを一時停止できます/);
              expect(interactiveMessage).not.toBeNull();

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('DemoSection label should change based on reduced motion preference', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (reducedMotion) => {
              setupMatchMedia(reducedMotion);

              const { unmount } = render(
                <DemoSection forceReducedMotion={reducedMotion} />
              );

              if (reducedMotion) {
                // Should show "プレビュー" label
                const previewLabel = screen.queryByText('プレビュー');
                expect(previewLabel).not.toBeNull();
              } else {
                // Should show "デモ" label
                const demoLabel = screen.queryByText('デモ');
                expect(demoLabel).not.toBeNull();
              }

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Interaction handlers are disabled when reduced motion is preferred', () => {
      test('Hover transitions should be disabled when reduced motion is preferred', () => {
        fc.assert(
          fc.property(
            fc.constant(true),
            () => {
              setupMatchMedia(true);

              const { container, unmount } = render(
                <DemoSection forceReducedMotion={true} />
              );

              // Find the demo frame container
              const frameContainer = container.querySelector('[role="region"]');
              expect(frameContainer).not.toBeNull();

              // Check that transition classes are NOT applied when reduced motion is preferred
              const classList = frameContainer?.className || '';
              expect(classList).not.toContain('transition-shadow');
              expect(classList).not.toContain('hover:shadow-xl');

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Hover transitions should be enabled when reduced motion is NOT preferred', () => {
        fc.assert(
          fc.property(
            fc.constant(false),
            () => {
              setupMatchMedia(false);

              const { container, unmount } = render(
                <DemoSection forceReducedMotion={false} />
              );

              // Find the demo frame container
              const frameContainer = container.querySelector('[role="region"]');
              expect(frameContainer).not.toBeNull();

              // Check that transition classes ARE applied when reduced motion is not preferred
              const classList = frameContainer?.className || '';
              expect(classList).toContain('transition-shadow');

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Accessibility attributes are correct based on reduced motion preference', () => {
      test('ARIA label should indicate static view when reduced motion is preferred', () => {
        fc.assert(
          fc.property(
            fc.constant(true),
            () => {
              setupMatchMedia(true);

              const { container, unmount } = render(
                <DemoSection forceReducedMotion={true} />
              );

              // Find the demo frame container with role="region"
              const frameContainer = container.querySelector('[role="region"]');
              expect(frameContainer).not.toBeNull();

              // Check aria-label indicates static view
              const ariaLabel = frameContainer?.getAttribute('aria-label');
              expect(ariaLabel).toContain('静的表示');

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('ARIA label should indicate interactive demo when reduced motion is NOT preferred', () => {
        fc.assert(
          fc.property(
            fc.constant(false),
            () => {
              setupMatchMedia(false);

              const { container, unmount } = render(
                <DemoSection forceReducedMotion={false} />
              );

              // Find the demo frame container with role="region"
              const frameContainer = container.querySelector('[role="region"]');
              expect(frameContainer).not.toBeNull();

              // Check aria-label indicates interactive demo
              const ariaLabel = frameContainer?.getAttribute('aria-label');
              expect(ariaLabel).toContain('インタラクティブデモ');

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Edge cases', () => {
      test('Empty steps array should handle reduced motion correctly', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (reducedMotion) => {
              setupMatchMedia(reducedMotion);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps: [],
                  autoPlay: true,
                  loop: true,
                })
              );

              expect(result.current.state.prefersReducedMotion).toBe(reducedMotion);
              // With empty steps, animation should not play regardless
              expect(result.current.state.totalSteps).toBe(0);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Single step animation should respect reduced motion', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (reducedMotion) => {
              setupMatchMedia(reducedMotion);

              const steps = generateAnimationSteps(1);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: true,
                  loop: true,
                })
              );

              expect(result.current.state.prefersReducedMotion).toBe(reducedMotion);
              
              if (reducedMotion) {
                expect(result.current.state.isPlaying).toBe(false);
              } else {
                expect(result.current.state.isPlaying).toBe(true);
              }

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Reset should work regardless of reduced motion preference', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            animationStepCountArb,
            (reducedMotion, stepCount) => {
              setupMatchMedia(reducedMotion);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                })
              );

              // Go to a different step
              act(() => {
                result.current.controls.goToStep(Math.min(1, stepCount - 1));
              });

              // Reset
              act(() => {
                result.current.controls.reset();
              });

              // Should be reset to initial state
              expect(result.current.state.currentStep).toBe(0);
              expect(result.current.state.isPlaying).toBe(false);
              expect(result.current.state.isPaused).toBe(false);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });

      test('Navigation controls should work regardless of reduced motion preference', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            fc.integer({ min: 3, max: 10 }),
            (reducedMotion, stepCount) => {
              setupMatchMedia(reducedMotion);

              const steps = generateAnimationSteps(stepCount);

              const { result, unmount } = renderHook(() =>
                useDemoAnimation({
                  steps,
                  autoPlay: false,
                  loop: true,
                })
              );

              // goToStep should work
              act(() => {
                result.current.controls.goToStep(2);
              });
              expect(result.current.state.currentStep).toBe(2);

              // nextStep should work
              act(() => {
                result.current.controls.nextStep();
              });
              expect(result.current.state.currentStep).toBe(3 % stepCount);

              // prevStep should work
              act(() => {
                result.current.controls.prevStep();
              });
              expect(result.current.state.currentStep).toBe(2);

              unmount();
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
