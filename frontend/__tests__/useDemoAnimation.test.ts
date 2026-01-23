/**
 * Unit Tests for useDemoAnimation hook
 * Feature: landing-page-demo
 * Validates: Requirements 4.1, 4.5
 * - 4.1: Auto-play showing typical user interactions when demo section is visible
 * - 4.5: Loop smoothly after completing all demonstration sequences
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDemoAnimation, type AnimationStep } from '@/app/demo/hooks/useDemoAnimation';

// ============================================================================
// Test Data
// ============================================================================

const mockAnimationSteps: AnimationStep[] = [
  {
    id: 'step-1',
    type: 'highlight',
    target: '#element-1',
    duration: 100,
    description: 'Highlight first element',
  },
  {
    id: 'step-2',
    type: 'click',
    target: '#element-2',
    duration: 100,
    description: 'Click second element',
    action: jest.fn(),
  },
  {
    id: 'step-3',
    type: 'wait',
    duration: 100,
    description: 'Wait step',
  },
];

// ============================================================================
// Mocks
// ============================================================================

describe('useDemoAnimation Hook', () => {
  let mockMatchMedia: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock matchMedia for prefers-reduced-motion
    mockMatchMedia = jest.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    global.matchMedia = mockMatchMedia;

    // Mock document.querySelector
    jest.spyOn(document, 'querySelector').mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ============================================================================
  // Basic State Tests
  // ============================================================================

  describe('Initial State', () => {
    test('should return state and controls objects', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      expect(result.current).toHaveProperty('state');
      expect(result.current).toHaveProperty('controls');
    });

    test('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      expect(result.current.state.currentStep).toBe(0);
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.highlightedElement).toBeNull();
      expect(result.current.state.cursorPosition).toBeNull();
      expect(result.current.state.prefersReducedMotion).toBe(false);
      expect(result.current.state.totalSteps).toBe(3);
    });

    test('should provide all control functions', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      expect(typeof result.current.controls.play).toBe('function');
      expect(typeof result.current.controls.pause).toBe('function');
      expect(typeof result.current.controls.resume).toBe('function');
      expect(typeof result.current.controls.reset).toBe('function');
      expect(typeof result.current.controls.goToStep).toBe('function');
      expect(typeof result.current.controls.nextStep).toBe('function');
      expect(typeof result.current.controls.prevStep).toBe('function');
    });

    test('should return current step data', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      expect(result.current.state.currentStepData).toEqual(mockAnimationSteps[0]);
    });
  });

  // ============================================================================
  // Auto-play Tests (Requirement 4.1)
  // ============================================================================

  describe('Auto-play (Requirement 4.1)', () => {
    test('should auto-play when autoPlay is true', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: true })
      );

      expect(result.current.state.isPlaying).toBe(true);
    });

    test('should not auto-play when autoPlay is false', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      expect(result.current.state.isPlaying).toBe(false);
    });

    test('should not auto-play when prefers-reduced-motion is enabled', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: true })
      );

      expect(result.current.state.prefersReducedMotion).toBe(true);
      expect(result.current.state.isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // Play/Pause/Resume Controls Tests
  // ============================================================================

  describe('Play/Pause/Resume Controls', () => {
    test('should start playing when play() is called', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.play();
      });

      expect(result.current.state.isPlaying).toBe(true);
    });

    test('should pause when pause() is called', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: true })
      );

      act(() => {
        result.current.controls.pause();
      });

      expect(result.current.state.isPaused).toBe(true);
    });

    test('should resume when resume() is called after pause', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: true })
      );

      act(() => {
        result.current.controls.pause();
      });

      expect(result.current.state.isPaused).toBe(true);

      act(() => {
        result.current.controls.resume();
      });

      expect(result.current.state.isPaused).toBe(false);
    });

    test('should not play when prefers-reduced-motion is enabled', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.play();
      });

      expect(result.current.state.isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // Step Navigation Tests
  // ============================================================================

  describe('Step Navigation', () => {
    test('should go to specific step when goToStep() is called', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.goToStep(2);
      });

      expect(result.current.state.currentStep).toBe(2);
      expect(result.current.state.currentStepData).toEqual(mockAnimationSteps[2]);
    });

    test('should not go to invalid step index', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.goToStep(10);
      });

      expect(result.current.state.currentStep).toBe(0);

      act(() => {
        result.current.controls.goToStep(-1);
      });

      expect(result.current.state.currentStep).toBe(0);
    });

    test('should advance to next step when nextStep() is called', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.nextStep();
      });

      expect(result.current.state.currentStep).toBe(1);
    });

    test('should wrap to first step when nextStep() is called on last step', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.goToStep(2);
      });

      act(() => {
        result.current.controls.nextStep();
      });

      expect(result.current.state.currentStep).toBe(0);
    });

    test('should go to previous step when prevStep() is called', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.goToStep(2);
      });

      act(() => {
        result.current.controls.prevStep();
      });

      expect(result.current.state.currentStep).toBe(1);
    });

    test('should wrap to last step when prevStep() is called on first step', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      act(() => {
        result.current.controls.prevStep();
      });

      expect(result.current.state.currentStep).toBe(2);
    });
  });

  // ============================================================================
  // Reset Tests
  // ============================================================================

  describe('Reset', () => {
    test('should reset to initial state when reset() is called', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: true })
      );

      act(() => {
        result.current.controls.goToStep(2);
      });

      act(() => {
        result.current.controls.reset();
      });

      expect(result.current.state.currentStep).toBe(0);
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.highlightedElement).toBeNull();
      expect(result.current.state.cursorPosition).toBeNull();
    });
  });

  // ============================================================================
  // Loop Tests (Requirement 4.5)
  // ============================================================================

  describe('Loop Functionality (Requirement 4.5)', () => {
    test('should loop back to beginning after completing all steps', async () => {
      const onComplete = jest.fn();
      const { result } = renderHook(() =>
        useDemoAnimation({
          steps: mockAnimationSteps,
          autoPlay: true,
          loop: true,
          loopDelay: 50,
          onComplete,
        })
      );

      // Advance through all steps
      act(() => {
        jest.advanceTimersByTime(100); // Step 1
      });

      act(() => {
        jest.advanceTimersByTime(100); // Step 2
      });

      act(() => {
        jest.advanceTimersByTime(100); // Step 3
      });

      // Wait for loop delay
      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(onComplete).toHaveBeenCalled();
      expect(result.current.state.currentStep).toBe(0);
    });

    test('should stop after completing all steps when loop is false', () => {
      const onComplete = jest.fn();
      const { result } = renderHook(() =>
        useDemoAnimation({
          steps: mockAnimationSteps,
          autoPlay: true,
          loop: false,
          onComplete,
        })
      );

      // Advance through all steps
      act(() => {
        jest.advanceTimersByTime(100); // Step 1
      });

      act(() => {
        jest.advanceTimersByTime(100); // Step 2
      });

      act(() => {
        jest.advanceTimersByTime(100); // Step 3
      });

      expect(onComplete).toHaveBeenCalled();
      expect(result.current.state.isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // Callback Tests
  // ============================================================================

  describe('Callbacks', () => {
    test('should call onStepChange when step changes', () => {
      const onStepChange = jest.fn();
      renderHook(() =>
        useDemoAnimation({
          steps: mockAnimationSteps,
          autoPlay: true,
          onStepChange,
        })
      );

      // First step should trigger callback
      expect(onStepChange).toHaveBeenCalledWith(0, mockAnimationSteps[0]);

      // Advance to next step
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(onStepChange).toHaveBeenCalledWith(1, mockAnimationSteps[1]);
    });

    test('should execute step action when step starts', () => {
      const actionMock = jest.fn();
      const stepsWithAction: AnimationStep[] = [
        {
          id: 'step-with-action',
          type: 'click',
          target: '#button',
          duration: 100,
          description: 'Click button',
          action: actionMock,
        },
      ];

      renderHook(() =>
        useDemoAnimation({
          steps: stepsWithAction,
          autoPlay: true,
        })
      );

      expect(actionMock).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Reduced Motion Tests
  // ============================================================================

  describe('Reduced Motion Support', () => {
    test('should detect prefers-reduced-motion', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: false })
      );

      expect(result.current.state.prefersReducedMotion).toBe(true);
    });

    test('should respond to reduced motion preference changes', () => {
      let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;

      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn((event, handler) => {
          if (event === 'change') {
            changeHandler = handler;
          }
        }),
        removeEventListener: jest.fn(),
      });

      const { result } = renderHook(() =>
        useDemoAnimation({ steps: mockAnimationSteps, autoPlay: true })
      );

      expect(result.current.state.prefersReducedMotion).toBe(false);
      expect(result.current.state.isPlaying).toBe(true);

      // Simulate preference change
      if (changeHandler) {
        act(() => {
          changeHandler!({ matches: true } as MediaQueryListEvent);
        });

        expect(result.current.state.prefersReducedMotion).toBe(true);
        expect(result.current.state.isPlaying).toBe(false);
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle empty steps array', () => {
      const { result } = renderHook(() =>
        useDemoAnimation({ steps: [], autoPlay: false })
      );

      expect(result.current.state.totalSteps).toBe(0);
      expect(result.current.state.currentStepData).toBeNull();
    });

    test('should handle single step', () => {
      const singleStep: AnimationStep[] = [
        {
          id: 'only-step',
          type: 'highlight',
          target: '#element',
          duration: 100,
          description: 'Only step',
        },
      ];

      const { result } = renderHook(() =>
        useDemoAnimation({ steps: singleStep, autoPlay: false })
      );

      expect(result.current.state.totalSteps).toBe(1);
      expect(result.current.state.currentStepData).toEqual(singleStep[0]);
    });

    test('should handle step action errors gracefully', () => {
      const errorAction = jest.fn(() => {
        throw new Error('Test error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const stepsWithError: AnimationStep[] = [
        {
          id: 'error-step',
          type: 'click',
          target: '#button',
          duration: 100,
          description: 'Error step',
          action: errorAction,
        },
      ];

      renderHook(() =>
        useDemoAnimation({
          steps: stepsWithError,
          autoPlay: true,
        })
      );

      expect(errorAction).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Demo animation step action error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
